package com.marck.tradutorlegenda

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.AudioAttributes
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.DisplayMetrics
import android.view.Display
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.Translator
import com.google.mlkit.nl.translate.TranslatorOptions
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Lê a legenda da tela (só imagem, não usa o áudio), traduz e fala.
 * Feito para ser rápido:
 *  - lê a tela de novo assim que termina a leitura anterior (~3-5 vezes por segundo)
 *  - começa a traduzir na 1ª vez que vê a legenda nova
 *  - fala assim que a 2ª leitura confirma que a legenda é a mesma
 *  - se a voz ficar atrasada, pula para a legenda atual e acelera a fala
 */
class CaptureService : Service(), TextToSpeech.OnInitListener {

    companion object {
        const val ACTION_STOP = "com.marck.tradutorlegenda.STOP"
        private const val CHANNEL = "tradutor"
        private const val NOTIF_ID = 1
        private const val GAP_MS = 30L           // pausa entre uma leitura e outra (quase nenhuma)
        private const val MAX_SIDE = 960f        // tamanho da imagem lida (menor = mais rápido)
    }

    private val main = Handler(Looper.getMainLooper())
    private val capThread = HandlerThread("captura").apply { start() }
    private val cap = Handler(capThread.looper)
    private val mainExec = java.util.concurrent.Executor { main.post(it) }
    private val capExec = java.util.concurrent.Executor { cap.post(it) }

    private var projection: MediaProjection? = null
    private val projCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            main.post { stopSelf() }
        }
    }
    private var display: VirtualDisplay? = null
    private var reader: ImageReader? = null
    private var capW = 0
    private var capH = 0

    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    private var translator: Translator? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    @Volatile private var speakingCount = 0

    private var overlay: Overlay? = null
    @Volatile private var paused = false
    @Volatile private var running = false
    private var speakOn = true
    private var showSub = true
    private var area = 0.35f
    private var speed = 1.25f
    private var duck = true
    private var pitch = 1.0f
    private var srcLang = TranslateLanguage.ENGLISH
    private var corrections: List<Pair<String, String>> = emptyList()
    private var voiceMode = "sistema"   // sistema | ia_m | ia_f | auto
    private var neural: NeuralSpeaker? = null
    private var detector: SpeakerDetector? = null
    @Volatile private var lastFaceRun = 0L
    private var lastGender: SpeakerDetector.Gender? = null
    private var candidateGender: SpeakerDetector.Gender? = null
    private var voiceName = ""
    private var focusReq: android.media.AudioFocusRequest? = null
    private var hasFocus = false
    private val releaseFocus = Runnable { abandonFocus() }
    private val speechAttrs: AudioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA) // segue o volume de mídia (bem mais alto)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build()

    // controle da legenda (usado só na thread principal)
    private var candidate = ""          // legenda vista na última leitura
    private var candidateTr: String? = null
    private var candidateConfirmed = false
    private var lastDelivered = ""      // última legenda (original) já falada
    private var lastTranslation = ""
    private var gen = 0                 // muda a cada legenda nova (descarta traduções velhas)

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null || intent.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (running) stopCapture()

        createChannel()
        val notif = buildNotif("Preparando…")
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            startForeground(NOTIF_ID, notif)
        }

        val code = intent.getIntExtra("code", 0)
        val data: Intent? = if (Build.VERSION.SDK_INT >= 33) {
            intent.getParcelableExtra("data", Intent::class.java)
        } else {
            @Suppress("DEPRECATION") intent.getParcelableExtra("data")
        }
        if (data == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        val lang = intent.getStringExtra("lang") ?: TranslateLanguage.ENGLISH
        srcLang = lang
        corrections = TextFixer.loadCorrections(this)
        area = intent.getFloatExtra("area", 0.35f)
        speed = intent.getFloatExtra("speed", 1.25f)
        speakOn = intent.getBooleanExtra("speak", true)
        showSub = intent.getBooleanExtra("showSub", true)
        duck = intent.getBooleanExtra("duck", true)
        pitch = intent.getFloatExtra("pitch", 1.0f)
        voiceName = intent.getStringExtra("voice") ?: ""
        voiceMode = intent.getStringExtra("voiceMode") ?: "sistema"
        setupVoices()
        if (ttsReady) applyVoiceSettings()
        val showBubble = intent.getBooleanExtra("bubble", true)
        paused = false
        resetState()

        if (overlay == null) overlay = Overlay(this, onToggle = { togglePause() }, onStop = { stopSelf() })
        if (showBubble) overlay?.showBubble()
        overlay?.setPaused(false)

        val mpm = getSystemService(MediaProjectionManager::class.java)
        projection = mpm.getMediaProjection(code, data)
        projection?.registerCallback(projCallback, main)

        if (tts == null) tts = TextToSpeech(this, this)

        translator?.close()
        translator = Translation.getClient(
            TranslatorOptions.Builder()
                .setSourceLanguage(lang)
                .setTargetLanguage(TranslateLanguage.PORTUGUESE)
                .build()
        )
        updateNotif("Baixando o idioma (só na 1ª vez)…")
        translator!!.downloadModelIfNeeded()
            .addOnSuccessListener {
                updateNotif("Lendo legendas… abra seu vídeo")
                startCapture()
            }
            .addOnFailureListener {
                updateNotif("Erro ao baixar o idioma. Verifique a internet e tente de novo.")
            }

        return START_NOT_STICKY
    }

    private fun setupVoices() {
        val needMale = voiceMode == "ia_m" || voiceMode == "auto"
        val needFemale = voiceMode == "ia_f" || voiceMode == "auto"
        val anyInstalled = (needMale && NeuralVoices.isInstalled(this, VoiceKind.MALE)) ||
            (needFemale && NeuralVoices.isInstalled(this, VoiceKind.FEMALE))
        if (anyInstalled) {
            if (neural == null) neural = NeuralSpeaker(
                this,
                onStart = { main.post { requestFocus() } },
                onDone = { main.post { main.removeCallbacks(releaseFocus); main.postDelayed(releaseFocus, 500) } }
            )
            if (needMale && NeuralVoices.isInstalled(this, VoiceKind.MALE)) neural?.preload(VoiceKind.MALE)
            if (needFemale && NeuralVoices.isInstalled(this, VoiceKind.FEMALE)) neural?.preload(VoiceKind.FEMALE)
        }
        if (voiceMode == "auto") {
            if (detector == null) detector = SpeakerDetector(this, capExec)
        } else {
            detector?.close(); detector = null
        }
    }

    private fun resetState() {
        candidate = ""; candidateTr = null; candidateConfirmed = false
        lastDelivered = ""; lastTranslation = ""; gen++
    }

    // ---------- Captura de tela ----------

    private fun screenSize(): Triple<Int, Int, Int> {
        val dm = getSystemService(DisplayManager::class.java)
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        dm.getDisplay(Display.DEFAULT_DISPLAY).getRealMetrics(metrics)
        val scale = min(1f, MAX_SIDE / max(metrics.widthPixels, metrics.heightPixels))
        val w = (metrics.widthPixels * scale).roundToInt()
        val h = (metrics.heightPixels * scale).roundToInt()
        val dpi = max(120, (metrics.densityDpi * scale).roundToInt())
        return Triple(w, h, dpi)
    }

    private fun startCapture() {
        val p = projection ?: return
        val (w, h, dpi) = screenSize()
        capW = w; capH = h
        reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
        display = p.createVirtualDisplay(
            "tradutor-legenda", w, h, dpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader!!.surface, null, cap
        )
        running = true
        cap.postDelayed(captureStep, 300)
    }

    private fun checkRotation() {
        val (w, h, dpi) = screenSize()
        if (w == capW && h == capH) return
        val vd = display ?: return
        val old = reader
        capW = w; capH = h
        reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
        vd.resize(w, h, dpi)
        vd.surface = reader!!.surface
        old?.close()
    }

    private fun next(delay: Long = GAP_MS) {
        if (running) cap.postDelayed(captureStep, delay)
    }

    // roda na thread de captura (não trava nada)
    private val captureStep = object : Runnable {
        override fun run() {
            if (!running) return
            if (paused) { next(300); return }
            val crop = try {
                checkRotation()
                grab()
            } catch (_: Exception) { null }
            if (crop == null) { next(80); return }
            recognizer.process(InputImage.fromBitmap(crop, 0))
                .addOnSuccessListener(mainExec) { result ->
                    val lines = result.textBlocks
                        .flatMap { it.lines }
                        .map { it.text.trim() }
                        .filter { isSubtitleLine(it) }
                    onText(lines.joinToString(" ").trim())
                }
                .addOnCompleteListener(mainExec) {
                    crop.recycle()
                    next()
                }
        }
    }

    private fun grab(): Bitmap? {
        val img = reader?.acquireLatestImage() ?: return null
        try {
            val plane = img.planes[0]
            val pixelStride = plane.pixelStride
            val rowPadding = plane.rowStride - pixelStride * img.width
            val full = Bitmap.createBitmap(img.width + rowPadding / pixelStride, img.height, Bitmap.Config.ARGB_8888)
            full.copyPixelsFromBuffer(plane.buffer)
            val top = (img.height * (1f - area)).roundToInt().coerceIn(0, img.height - 1)
            val crop = Bitmap.createBitmap(full, 0, top, img.width, img.height - top)
            feedDetector(full)
            if (crop !== full) full.recycle()
            return crop
        } finally {
            img.close()
        }
    }

    // Manda uma cópia pequena da tela para o detector de rosto (umas 3 vezes por segundo)
    private fun feedDetector(full: Bitmap) {
        val d = detector ?: return
        val now = android.os.SystemClock.elapsedRealtime()
        if (d.busy || now - lastFaceRun < 300) return
        lastFaceRun = now
        val scale = min(1f, 480f / max(full.width, full.height))
        val small = Bitmap.createScaledBitmap(
            full, max(1, (full.width * scale).roundToInt()), max(1, (full.height * scale).roundToInt()), true
        )
        if (small === full) return
        d.process(small)
    }

    // Ignora botões, tempo do vídeo e outras coisas que não são fala
    private fun isSubtitleLine(s: String): Boolean {
        if (s.length < 2) return false
        val letters = s.count { it.isLetter() }
        if (letters < 2) return false
        if (Regex("""\d{1,2}:\d{2}""").containsMatchIn(s) && letters < 6) return false
        return letters.toFloat() / s.length > 0.5f
    }

    // ---------- Comparar textos ----------

    private fun norm(s: String) = s.lowercase(Locale.ROOT).filter { it.isLetterOrDigit() }

    private fun similar(a: String, b: String): Boolean {
        val x = norm(a); val y = norm(b)
        if (x.isEmpty() || y.isEmpty()) return x == y
        if (x == y) return true
        val d = levenshtein(x, y)
        return d.toFloat() / max(x.length, y.length) < 0.2f
    }

    private fun levenshtein(a: String, b: String): Int {
        if (a.length > 300 || b.length > 300) return if (a == b) 0 else max(a.length, b.length)
        var prev = IntArray(b.length + 1) { it }
        var cur = IntArray(b.length + 1)
        for (i in 1..a.length) {
            cur[0] = i
            for (j in 1..b.length) {
                val c = if (a[i - 1] == b[j - 1]) 0 else 1
                cur[j] = min(min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + c)
            }
            val t = prev; prev = cur; cur = t
        }
        return prev[b.length]
    }

    // ---------- Decide quando falar (thread principal) ----------

    private fun onText(text: String) {
        if (paused) return
        if (text.isEmpty()) {
            candidate = ""; candidateTr = null; candidateConfirmed = false
            return
        }
        if (lastTranslation.isNotEmpty() && similar(text, lastTranslation)) return
        if (similar(text, lastDelivered)) return // já falou essa

        // mesma legenda que já está sendo traduzida: não faz nada
        if (similar(text, candidate)) return

        // legenda nova: traduz e fala na hora (sem esperar 2ª leitura)
        candidate = text
        candidateTr = null
        candidateConfirmed = false
        candidateGender = detector?.currentSpeaker()
        val myGen = ++gen

        // legenda que vai crescendo (legenda automática do YouTube): traduz só o pedaço novo
        val nt = norm(text); val nl = norm(lastDelivered)
        val toTranslate = if (nl.length >= 6 && nt.startsWith(nl) && text.length > lastDelivered.length) {
            text.substring(min(lastDelivered.length, text.length)).trim()
        } else text
        if (toTranslate.isEmpty()) return

        // limpa o texto e separa as falas antes de traduzir
        val segments = TextFixer.cleanSource(toTranslate, srcLang)
        if (segments.isEmpty()) return
        val tr0 = translator ?: return
        val tasks = segments.map { tr0.translate(it) }
        com.google.android.gms.tasks.Tasks.whenAllSuccess<String>(tasks).addOnSuccessListener(mainExec) { list ->
            if (myGen != gen || paused) return@addOnSuccessListener
            val joined = list.map { it.trim() }.filter { it.isNotEmpty() }
                .joinToString(" ") { t -> if (list.size == 1 || t.last() in ".!?…") t else "$t." }
            val tr = TextFixer.applyCorrections(joined, corrections)
            if (tr.isEmpty()) return@addOnSuccessListener
            candidateTr = tr
            candidateConfirmed = true
            deliver(candidate, tr)
        }
    }

    private fun deliver(original: String, tr: String) {
        if (tr.isBlank() || similar(original, lastDelivered)) return
        lastDelivered = original
        lastTranslation = tr
        val g = candidateGender ?: detector?.currentSpeaker() ?: lastGender
        if (g != null) lastGender = g
        val icon = if (voiceMode == "auto") when (g) {
            SpeakerDetector.Gender.MALE -> "👨 "
            SpeakerDetector.Gender.FEMALE -> "👩 "
            null -> ""
        } else ""
        if (showSub) overlay?.showSubtitle(icon + tr)
        if (speakOn) speakOut(tr, g) else updateNotif(tr)
    }

    // ---------- Voz ----------

    override fun onInit(status: Int) {
        if (status != TextToSpeech.SUCCESS) return
        val t = tts ?: return
        t.language = Locale("pt", "BR")
        t.setAudioAttributes(speechAttrs)
        applyVoiceSettings()
        t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) { finished() }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) { finished() }
            override fun onStop(utteranceId: String?, interrupted: Boolean) {
                speakingCount = 0
                main.post { abandonFocus() }
            }
        })
        ttsReady = true
    }

    // Escolhe a voz: IA masculina, IA feminina, automática (rosto) ou a do celular
    private fun speakOut(text: String, g: SpeakerDetector.Gender?) {
        val kind: VoiceKind? = when (voiceMode) {
            "ia_m" -> VoiceKind.MALE
            "ia_f" -> VoiceKind.FEMALE
            "auto" -> if (g == SpeakerDetector.Gender.FEMALE) VoiceKind.FEMALE else VoiceKind.MALE
            else -> null
        }
        val n = neural
        if (kind != null && n != null && NeuralVoices.isInstalled(this, kind)) {
            val behind = n.pending
            n.speak(text, kind, if (behind >= 1) speed * 1.2f else speed, pitch, flush = behind >= 2)
            updateNotif(text)
            return
        }
        speak(text)
    }

    // voz escolhida + tom (grossa/fina)
    private fun applyVoiceSettings() {
        val t = tts ?: return
        if (voiceName.isNotEmpty()) {
            try {
                t.voices?.firstOrNull { it.name == voiceName }?.let { t.voice = it }
            } catch (_: Exception) {}
        }
        t.setPitch(pitch)
    }

    private fun finished() {
        speakingCount = max(0, speakingCount - 1)
        if (speakingCount == 0) {
            // devolve o som do vídeo um pouquinho depois (evita sobe-e-desce)
            main.removeCallbacks(releaseFocus)
            main.postDelayed(releaseFocus, 500)
        }
    }

    // Abaixa o som do vídeo enquanto a tradução fala
    private fun requestFocus() {
        main.removeCallbacks(releaseFocus)
        if (!duck || hasFocus) return
        val am = getSystemService(android.media.AudioManager::class.java)
        val req = focusReq ?: android.media.AudioFocusRequest.Builder(
            android.media.AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
        )
            .setAudioAttributes(speechAttrs)
            .setWillPauseWhenDucked(false)
            .setOnAudioFocusChangeListener { }
            .build().also { focusReq = it }
        hasFocus = am.requestAudioFocus(req) == android.media.AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }

    private fun abandonFocus() {
        if (!hasFocus) return
        focusReq?.let { getSystemService(android.media.AudioManager::class.java).abandonAudioFocusRequest(it) }
        hasFocus = false
    }

    private fun speak(text: String) {
        val t = tts ?: return
        if (!ttsReady || text.isBlank()) return
        val behind = speakingCount
        // Ainda falando a anterior? acelera. Muito atrasado? corta e fala a atual.
        t.setSpeechRate(if (behind >= 1) speed * 1.25f else speed)
        val mode = if (behind >= 2) {
            speakingCount = 0
            TextToSpeech.QUEUE_FLUSH
        } else TextToSpeech.QUEUE_ADD
        speakingCount++
        requestFocus()
        val params = android.os.Bundle().apply {
            putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f)
        }
        t.speak(text, mode, params, "u" + System.nanoTime())
        updateNotif(text)
    }

    private fun togglePause() {
        paused = !paused
        overlay?.setPaused(paused)
        if (paused) {
            neural?.stopAll()
            tts?.stop()
            speakingCount = 0
            updateNotif("Pausado — toque na bolinha para continuar")
        } else {
            resetState()
            updateNotif("Lendo legendas…")
        }
    }

    // ---------- Notificação ----------

    private fun createChannel() {
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "Tradutor de Legenda", NotificationManager.IMPORTANCE_LOW)
            )
        }
    }

    private fun buildNotif(text: String): Notification {
        val stopIntent = PendingIntent.getService(
            this, 1,
            Intent(this, CaptureService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val openIntent = PendingIntent.getActivity(
            this, 2,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("Tradutor de Legenda ligado")
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setContentIntent(openIntent)
            .addAction(Notification.Action.Builder(null, "PARAR", stopIntent).build())
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun updateNotif(text: String) {
        getSystemService(NotificationManager::class.java).notify(NOTIF_ID, buildNotif(text))
    }

    // ---------- Encerrar ----------

    private fun stopCapture() {
        running = false
        cap.removeCallbacksAndMessages(null)
        val d = display; val r = reader; val p = projection
        display = null; reader = null; projection = null
        cap.post {
            d?.release()
            r?.close()
        }
        p?.unregisterCallback(projCallback)
        p?.stop()
    }

    override fun onDestroy() {
        stopCapture()
        overlay?.removeAll(); overlay = null
        neural?.release(); neural = null
        detector?.close(); detector = null
        main.removeCallbacks(releaseFocus)
        abandonFocus()
        tts?.stop(); tts?.shutdown(); tts = null
        translator?.close(); translator = null
        recognizer.close()
        capThread.quitSafely()
        super.onDestroy()
    }
}

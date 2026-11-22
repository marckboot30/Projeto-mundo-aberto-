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
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
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

class CaptureService : Service(), TextToSpeech.OnInitListener {

    companion object {
        const val ACTION_STOP = "com.marck.tradutorlegenda.STOP"
        private const val CHANNEL = "tradutor"
        private const val NOTIF_ID = 1
        private const val INTERVAL_MS = 700L
    }

    private val handler = Handler(Looper.getMainLooper())
    private var projection: MediaProjection? = null
    private var display: VirtualDisplay? = null
    private var reader: ImageReader? = null
    private val projCallback = object : MediaProjection.Callback() {
        override fun onStop() {
            stopSelf()
        }
    }
    private var capW = 0
    private var capH = 0

    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
    private var translator: Translator? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    @Volatile private var pending = 0

    private var overlay: Overlay? = null
    private var paused = false
    private var speakOn = true
    private var showSub = true
    private var lastTranslation = ""

    private var area = 0.35f
    private var speed = 1.25f
    private var busy = false
    private var running = false
    private var lastSeen = ""
    private var lastSpoken = ""

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
        area = intent.getFloatExtra("area", 0.35f)
        speed = intent.getFloatExtra("speed", 1.25f)
        speakOn = intent.getBooleanExtra("speak", true)
        showSub = intent.getBooleanExtra("showSub", true)
        val showBubble = intent.getBooleanExtra("bubble", true)
        paused = false
        if (overlay == null) overlay = Overlay(this, onToggle = { togglePause() }, onStop = { stopSelf() })
        if (showBubble) overlay?.showBubble()
        overlay?.setPaused(false)

        val mpm = getSystemService(MediaProjectionManager::class.java)
        projection = mpm.getMediaProjection(code, data)
        projection?.registerCallback(projCallback, handler)

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

    // ---------- Captura de tela ----------

    private fun screenSize(): Triple<Int, Int, Int> {
        val dm = getSystemService(DisplayManager::class.java)
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        dm.getDisplay(Display.DEFAULT_DISPLAY).getRealMetrics(metrics)
        // reduz para o lado maior ter ~1280px (rápido e suficiente para ler legenda)
        val scale = min(1f, 1280f / max(metrics.widthPixels, metrics.heightPixels))
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
            reader!!.surface, null, handler
        )
        running = true
        handler.postDelayed(tick, INTERVAL_MS)
    }

    // Quando o celular gira (vídeo deitado), ajusta o tamanho da captura
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

    private val tick = object : Runnable {
        override fun run() {
            if (!running) return
            if (paused) {
                handler.postDelayed(this, INTERVAL_MS)
                return
            }
            try {
                captureOnce()
            } catch (_: Exception) {
                busy = false
            }
            handler.postDelayed(this, INTERVAL_MS)
        }
    }

    private fun captureOnce() {
        if (busy) return
        checkRotation()
        val img = reader?.acquireLatestImage() ?: return
        val crop: Bitmap
        try {
            val plane = img.planes[0]
            val pixelStride = plane.pixelStride
            val rowPadding = plane.rowStride - pixelStride * img.width
            val full = Bitmap.createBitmap(img.width + rowPadding / pixelStride, img.height, Bitmap.Config.ARGB_8888)
            full.copyPixelsFromBuffer(plane.buffer)
            val top = (img.height * (1f - area)).roundToInt().coerceIn(0, img.height - 1)
            crop = Bitmap.createBitmap(full, 0, top, img.width, img.height - top)
            if (crop !== full) full.recycle()
        } finally {
            img.close()
        }
        busy = true
        recognizer.process(InputImage.fromBitmap(crop, 0))
            .addOnSuccessListener { result ->
                val lines = result.textBlocks
                    .flatMap { it.lines }
                    .map { it.text.trim() }
                    .filter { isSubtitleLine(it) }
                onText(lines.joinToString(" ").trim())
            }
            .addOnCompleteListener {
                busy = false
                crop.recycle()
            }
    }

    // Ignora botões, tempo do vídeo e outras coisas que não são fala
    private fun isSubtitleLine(s: String): Boolean {
        if (s.length < 2) return false
        val letters = s.count { it.isLetter() }
        if (letters < 2) return false
        if (Regex("""\d{1,2}:\d{2}""").containsMatchIn(s) && letters < 6) return false
        return letters.toFloat() / s.length > 0.5f
    }

    // ---------- Decide quando falar ----------

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

    private fun togglePause() {
        paused = !paused
        overlay?.setPaused(paused)
        if (paused) {
            tts?.stop()
            pending = 0
            updateNotif("Pausado — toque na bolinha para continuar")
        } else {
            lastSeen = ""
            updateNotif("Lendo legendas…")
        }
    }

    private fun onText(text: String) {
        // não lê a própria tradução se ela aparecer na captura
        if (lastTranslation.isNotEmpty() && similar(text, lastTranslation)) return
        if (text.isEmpty()) {
            lastSeen = ""
            return
        }
        // só fala quando a legenda ficou parada por 2 leituras seguidas (evita ler pela metade)
        if (similar(text, lastSeen) && !similar(text, lastSpoken)) {
            val nt = norm(text); val nl = norm(lastSpoken)
            val toSay = if (nl.length >= 6 && nt.startsWith(nl) && text.length > lastSpoken.length) {
                // legenda que vai crescendo (ex.: legenda automática do YouTube): fala só o pedaço novo
                text.substring(min(lastSpoken.length, text.length)).trim()
            } else text
            lastSpoken = text
            if (toSay.isNotEmpty()) translateAndSpeak(toSay)
        }
        lastSeen = text
    }

    private fun translateAndSpeak(text: String) {
        translator?.translate(text)
            ?.addOnSuccessListener { tr -> if (!paused) deliver(tr) }
    }

    // ---------- Voz ----------

    override fun onInit(status: Int) {
        if (status != TextToSpeech.SUCCESS) return
        val t = tts ?: return
        t.language = Locale("pt", "BR")
        t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) { pending = max(0, pending - 1) }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) { pending = max(0, pending - 1) }
        })
        ttsReady = true
    }

    private fun deliver(text: String) {
        if (text.isBlank()) return
        lastTranslation = text
        if (showSub) overlay?.showSubtitle(text)
        if (speakOn) speak(text) else updateNotif(text)
    }

    private fun speak(text: String) {
        val t = tts ?: return
        if (!ttsReady || text.isBlank()) return
        t.setSpeechRate(speed)
        // se a voz ficar muito atrasada, pula o que ficou para trás
        val mode = if (pending >= 2) {
            pending = 0
            TextToSpeech.QUEUE_FLUSH
        } else TextToSpeech.QUEUE_ADD
        pending++
        t.speak(text, mode, null, "u" + System.nanoTime())
        updateNotif(text)
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
        @Suppress("DEPRECATION")
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
        handler.removeCallbacks(tick)
        display?.release(); display = null
        reader?.close(); reader = null
        projection?.unregisterCallback(projCallback)
        projection?.stop(); projection = null
    }

    override fun onDestroy() {
        stopCapture()
        overlay?.removeAll(); overlay = null
        tts?.stop(); tts?.shutdown(); tts = null
        translator?.close(); translator = null
        recognizer.close()
        super.onDestroy()
    }
}

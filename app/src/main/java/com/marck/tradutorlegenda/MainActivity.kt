package com.marck.tradutorlegenda

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.speech.tts.Voice
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.EditText
import android.widget.ArrayAdapter
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.Switch
import android.widget.TextView
import com.google.mlkit.nl.translate.TranslateLanguage
import java.util.Locale

class MainActivity : Activity() {

    // ---------- Cores ----------
    private val bgC = Color.rgb(13, 16, 22)
    private val cardC = Color.rgb(24, 29, 39)
    private val fieldC = Color.rgb(32, 38, 51)
    private val fg = Color.rgb(238, 241, 246)
    private val muted = Color.rgb(150, 160, 178)
    private val green = Color.rgb(29, 205, 120)
    private val blue = Color.rgb(24, 160, 230)
    private val red = Color.rgb(255, 92, 108)

    private val reqCapture = 42

    private val langs = listOf(
        "🇺🇸  Inglês" to TranslateLanguage.ENGLISH,
        "🇪🇸  Espanhol" to TranslateLanguage.SPANISH,
        "🇫🇷  Francês" to TranslateLanguage.FRENCH,
        "🇩🇪  Alemão" to TranslateLanguage.GERMAN,
        "🇮🇹  Italiano" to TranslateLanguage.ITALIAN,
        "🇧🇷  Português (Brasil) — só ler em voz alta" to TranslateLanguage.PORTUGUESE
    )
    private val areas = listOf(
        "📦 Caixa ajustável (recomendado)" to -1f,
        "Parte de baixo (25%)" to 0.25f,
        "Parte de baixo (35%)" to 0.35f,
        "Metade de baixo" to 0.5f,
        "Tela inteira" to 1.0f
    )

    private lateinit var langSpinner: Spinner
    private lateinit var areaSpinner: Spinner
    private lateinit var voiceSpinner: Spinner
    private lateinit var modeSpinner: Spinner
    private val dlRows = HashMap<VoiceKind, TextView>()
    private val dlBtns = HashMap<VoiceKind, TextView>()
    private var neuralTest: NeuralSpeaker? = null
    private lateinit var fixList: LinearLayout
    private val modes = listOf(
        "🤖  IA masculina (Miro)" to "ia_m",
        "🤖  IA feminina (Dii)" to "ia_f",
        "🎭  Automático: homem/mulher pelo rosto (teste)" to "auto",
        "📱  Voz do celular" to "sistema"
    )
    private lateinit var pitchBar: SeekBar
    private lateinit var speedBar: SeekBar
    private lateinit var pitchValue: TextView
    private lateinit var speedValue: TextView
    private lateinit var status: TextView
    private lateinit var swSpeak: Switch
    private lateinit var swDuck: Switch
    private lateinit var swSub: Switch
    private lateinit var swBubble: Switch
    private lateinit var swOnline: Switch

    private var tts: TextToSpeech? = null
    private var voices: List<Voice> = emptyList()

    private fun dp(v: Int) = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics
    ).toInt()

    // tom: 0..150 -> 0.5..2.0   |  velocidade: 0..100 -> 0.8..1.8
    private fun pitchOf(p: Int) = 0.5f + p / 100f
    private fun speedOf(p: Int) = 0.8f + p / 100f

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = bgC
        window.navigationBarColor = bgC
        val prefs = getSharedPreferences("cfg", MODE_PRIVATE)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(22), dp(18), dp(28))
            setBackgroundColor(bgC)
        }

        // ---------- Cabeçalho ----------
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(4), 0, 0, dp(14))
        }
        val logo = TextView(this)
        logo.text = "🎧"
        logo.textSize = 30f
        logo.gravity = Gravity.CENTER
        logo.background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(green, blue))
            .apply { cornerRadius = dp(18).toFloat() }
        header.addView(logo, LinearLayout.LayoutParams(dp(60), dp(60)))
        val titles = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), 0, 0, 0)
        }
        titles.addView(txt("Tradutor de Legenda", 22f, fg, bold = true))
        titles.addView(txt("Lê, traduz e fala em português", 14f, muted))
        header.addView(titles)
        root.addView(header)

        status = txt("○ Parado", 14f, muted)
        status.setPadding(dp(14), dp(8), dp(14), dp(8))
        status.background = round(cardC, 50)
        root.addView(status, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(14) })

        // ---------- Card: vídeo ----------
        val cVideo = cardView("🎬  Vídeo")
        cVideo.addView(fieldLabel("Idioma da legenda"))
        langSpinner = spinner(langs.map { it.first }, prefs.getInt("lang", 0))
        cVideo.addView(langSpinner)
        cVideo.addView(fieldLabel("Onde fica a legenda"))
        areaSpinner = spinner(areas.map { it.first }, prefs.getInt("area2", 0))
        cVideo.addView(areaSpinner)
        swOnline = switch("🌐 Tradução online (melhor, usa internet)", prefs.getBoolean("online", true))
        cVideo.addView(swOnline)
        cVideo.addView(txt("Se a internet falhar ou demorar, usa o tradutor sem internet automaticamente.", 12.5f, muted))
        root.addView(cVideo)

        // ---------- Card: voz ----------
        val cVoice = cardView("🎙️  Voz")
        swSpeak = switch("Falar a tradução", prefs.getBoolean("speak", true))
        cVoice.addView(swSpeak)

        cVoice.addView(fieldLabel("Voz do tradutor"))
        modeSpinner = spinner(modes.map { it.first }, modes.indexOfFirst { it.second == prefs.getString("voiceMode", "ia_m") }.coerceAtLeast(0))
        cVoice.addView(modeSpinner)

        // vozes de IA para baixar (ficam dentro do app, funcionam sem internet)
        cVoice.addView(fieldLabel("Vozes de IA (baixar uma vez, ~70 MB cada, use Wi‑Fi)"))
        for (k in VoiceKind.values()) {
            val row = LinearLayout(this)
            row.orientation = LinearLayout.HORIZONTAL
            row.gravity = Gravity.CENTER_VERTICAL
            row.setPadding(0, dp(6), 0, dp(6))
            val name = txt((if (k == VoiceKind.MALE) "👨 " else "👩 ") + k.label, 15f, fg)
            row.addView(name, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            val btn = chip("") { onVoiceButton(k) }
            btn.setPadding(dp(14), 0, dp(14), 0)
            row.addView(btn, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, dp(38)))
            dlRows[k] = name
            dlBtns[k] = btn
            cVoice.addView(row)
        }
        refreshVoiceButtons()

        cVoice.addView(fieldLabel("Voz do celular (se escolher \"Voz do celular\")"))
        voiceSpinner = spinner(listOf("Padrão do celular"), 0)
        cVoice.addView(voiceSpinner)

        val pitchRow = rowLabel("Tom da voz")
        pitchValue = txt("", 14f, green, bold = true)
        pitchRow.addView(pitchValue)
        cVoice.addView(pitchRow)
        pitchBar = seek(150, prefs.getInt("pitchP", 50))
        cVoice.addView(pitchBar)
        cVoice.addView(scaleLabels("🐻 Grossa", "Fina 🐦"))

        val speedRow = rowLabel("Velocidade")
        speedValue = txt("", 14f, green, bold = true)
        speedRow.addView(speedValue)
        cVoice.addView(speedRow)
        speedBar = seek(100, prefs.getInt("speedP", 70))
        cVoice.addView(speedBar)
        cVoice.addView(scaleLabels("🐢 Devagar", "Rápida 🐇"))

        // atalhos de tom
        val presets = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(12), 0, 0)
        }
        val presetList = listOf("👨 Homem" to 15, "🙂 Normal" to 50, "👩 Mulher" to 70, "🧒 Criança" to 110)
        presetList.forEachIndexed { i, (name, p) ->
            presets.addView(
                chip(name) { pitchBar.progress = p; testVoice() },
                LinearLayout.LayoutParams(0, dp(40), 1f).apply {
                    if (i < presetList.size - 1) marginEnd = dp(6)
                }
            )
        }
        cVoice.addView(presets)

        cVoice.addView(
            bigButton("🔊  Testar voz", solid = false, color = blue) { testVoice() },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)).apply { topMargin = dp(14) }
        )
        root.addView(cVoice)

        val updateLabels = {
            val p = pitchBar.progress
            pitchValue.text = when {
                p < 30 -> "Bem grossa"
                p < 45 -> "Grossa"
                p <= 55 -> "Normal"
                p < 90 -> "Fina"
                else -> "Bem fina"
            }
            speedValue.text = String.format(Locale.ROOT, "%.1fx", speedOf(speedBar.progress))
        }
        val seekListener = object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(s: SeekBar?, p: Int, fromUser: Boolean) { updateLabels() }
            override fun onStartTrackingTouch(s: SeekBar?) {}
            override fun onStopTrackingTouch(s: SeekBar?) { testVoice() }
        }
        pitchBar.setOnSeekBarChangeListener(seekListener)
        speedBar.setOnSeekBarChangeListener(seekListener)
        updateLabels()

        // ---------- Card: tela ----------
        val cScreen = cardView("📱  Na tela")
        swSub = switch("Mostrar legenda traduzida", prefs.getBoolean("showSub", true))
        swBubble = switch("Bolinha flutuante (pausar/desligar)", prefs.getBoolean("bubble", true))
        swDuck = switch("Abaixar o vídeo quando a tradução falar", prefs.getBoolean("duck", true))
        cScreen.addView(swSub)
        cScreen.addView(swBubble)
        cScreen.addView(swDuck)
        root.addView(cScreen)

        // ---------- Card: correções ----------
        val cFix = cardView("📖  Correções de tradução")
        cFix.addView(txt(
            "Se uma palavra sair traduzida errado, cadastre aqui que o app troca sozinho.\nEx.: \"cara\" → \"mano\"",
            13f, muted
        ).apply { setLineSpacing(0f, 1.2f) })
        val inWrong = edit("Sai assim (errado)")
        val inRight = edit("Trocar por (certo)")
        cFix.addView(inWrong, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)).apply { topMargin = dp(10) })
        cFix.addView(inRight, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(48)).apply { topMargin = dp(8) })
        cFix.addView(
            bigButton("➕  Adicionar correção", solid = false, color = green) {
                val w = inWrong.text.toString().trim()
                val c = inRight.text.toString().trim()
                if (w.isNotEmpty()) {
                    val list = TextFixer.loadCorrections(this).filter { !it.first.equals(w, true) } + (w to c)
                    TextFixer.saveCorrections(this, list)
                    inWrong.setText(""); inRight.setText("")
                    renderFixes()
                    setStatus(false, "Correção salva (vale na próxima vez que tocar em COMEÇAR)")
                }
            },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(46)).apply { topMargin = dp(10) }
        )
        fixList = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(8), 0, 0) }
        cFix.addView(fixList)
        renderFixes()
        root.addView(cFix)

        // ---------- Botões ----------
        root.addView(
            bigButton("▶   COMEÇAR", solid = true, color = green) { askCapture() },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(62)).apply { topMargin = dp(6) }
        )
        root.addView(
            bigButton("■   PARAR", solid = false, color = red) {
                startService(Intent(this, CaptureService::class.java).setAction(CaptureService.ACTION_STOP))
                setStatus(false, "Parado")
            },
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)).apply { topMargin = dp(10) }
        )

        // ---------- Card: ajuda ----------
        val cHelp = cardView("💡  Como usar")
        val help = txt(
            "1. Escolha o idioma e a voz, depois toque em COMEÇAR.\n" +
                "2. Permita a captura de tela (escolha \"Tela inteira\").\n" +
                "3. Abra o vídeo com a legenda ligada.\n" +
                "Modo Automático (teste): olha o rosto de quem mexe a boca e escolhe voz de homem ou mulher. Erra quando a pessoa não aparece, está de lado ou em desenho/anime.\n" +
                "Caixa de leitura: a moldura branca aparece na tela. Arraste pelo ✥ e mude o tamanho pelo ⤡. O app só lê o que está dentro dela. O contorno verde mostra o que ele reconheceu.\n" +
                "4. Bolinha 🎧: toque = pausar/continuar, segure = desligar.\n" +
                "5. A legenda traduzida aparece em cima; arraste ou toque para esconder.\n\n" +
                "Na 1ª vez ele baixa o idioma (~30 MB): use Wi‑Fi.\n" +
                "Netflix e alguns apps bloqueiam a captura (tela preta).",
            13.5f, muted
        )
        help.setLineSpacing(0f, 1.25f)
        cHelp.addView(help)
        (cHelp.layoutParams as LinearLayout.LayoutParams).topMargin = dp(16)
        root.addView(cHelp)

        val scroll = ScrollView(this)
        scroll.setBackgroundColor(bgC)
        scroll.isFillViewport = true
        scroll.addView(root)
        setContentView(scroll)

        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7)
        }

        // voz para o teste + lista de vozes do celular
        tts = TextToSpeech(this) { st ->
            if (st == TextToSpeech.SUCCESS) runOnUiThread { loadVoices() }
        }
    }

    // ---------- Vozes ----------

    private fun loadVoices() {
        val t = tts ?: return
        t.language = Locale("pt", "BR")
        t.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build()
        )
        voices = try {
            (t.voices ?: emptySet<Voice>())
                .filter { it.locale.language == "pt" }
                .sortedWith(
                    compareBy<Voice>({ it.isNetworkConnectionRequired }, { it.locale.country != "BR" }, { it.name })
                )
        } catch (_: Exception) {
            emptyList()
        }

        val names = mutableListOf("Padrão do celular")
        voices.forEachIndexed { i, v ->
            val country = if (v.locale.country == "BR") "Brasil" else "Portugal"
            val net = if (v.isNetworkConnectionRequired) " · precisa internet" else ""
            names.add("Voz ${i + 1} ($country)$net")
        }
        val saved = getSharedPreferences("cfg", MODE_PRIVATE).getString("voice", "") ?: ""
        val found = voices.indexOfFirst { it.name == saved }
        voiceSpinner.adapter = adapter(names)
        voiceSpinner.setSelection(if (found >= 0) found + 1 else 0)
        voiceSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            private var first = true
            override fun onItemSelected(p: AdapterView<*>?, v: View?, pos: Int, id: Long) {
                if (first) { first = false; return }
                testVoice()
            }
            override fun onNothingSelected(p: AdapterView<*>?) {}
        }
    }

    private fun renderFixes() {
        fixList.removeAllViews()
        val list = TextFixer.loadCorrections(this)
        for (pair in list) {
            val row = LinearLayout(this)
            row.orientation = LinearLayout.HORIZONTAL
            row.gravity = Gravity.CENTER_VERTICAL
            row.setPadding(0, dp(4), 0, dp(4))
            val label = "\"${pair.first}\"  →  \"${pair.second.ifEmpty { "(apagar)" }}\""
            row.addView(txt(label, 14.5f, fg), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            val del = chip("✕") {
                TextFixer.saveCorrections(this, TextFixer.loadCorrections(this).filter { it.first != pair.first })
                renderFixes()
            }
            del.setTextColor(red)
            row.addView(del, LinearLayout.LayoutParams(dp(40), dp(34)))
            fixList.addView(row)
        }
    }

    private fun edit(hint: String): EditText {
        val e = EditText(this)
        e.hint = hint
        e.setHintTextColor(muted)
        e.setTextColor(fg)
        e.textSize = 15f
        e.isSingleLine = true
        e.background = round(fieldC, 12)
        e.setPadding(dp(12), 0, dp(12), 0)
        return e
    }

    private val downloading = HashSet<VoiceKind>()

    private fun refreshVoiceButtons() {
        for (k in VoiceKind.values()) {
            val b = dlBtns[k] ?: continue
            if (k in downloading) continue
            if (NeuralVoices.isInstalled(this, k)) {
                b.text = "✓ Baixada"
                b.setTextColor(green)
            } else {
                b.text = "⬇ Baixar"
                b.setTextColor(blue)
            }
        }
    }

    private fun onVoiceButton(k: VoiceKind) {
        if (k in downloading) return
        if (NeuralVoices.isInstalled(this, k)) {
            // já baixada: toca um teste com ela
            playNeural(k)
            return
        }
        downloading.add(k)
        val b = dlBtns[k] ?: return
        b.text = "0%"
        Thread {
            val err = NeuralVoices.download(this, k) { pct -> runOnUiThread { b.text = "$pct%" } }
            runOnUiThread {
                downloading.remove(k)
                refreshVoiceButtons()
                if (err != null) setStatus(false, err) else {
                    setStatus(false, "Voz ${k.label} pronta!")
                    playNeural(k)
                }
            }
        }.start()
    }

    private fun playNeural(k: VoiceKind) {
        tts?.stop()
        val n = neuralTest ?: NeuralSpeaker(this).also { neuralTest = it }
        n.speak(
            "Olá! Esta é a voz do seu tradutor de legenda.",
            k, speedOf(speedBar.progress), pitchOf(pitchBar.progress), flush = true
        )
    }

    private fun selectedVoiceName(): String {
        val i = voiceSpinner.selectedItemPosition - 1
        return if (i in voices.indices) voices[i].name else ""
    }

    private fun testVoice() {
        when (modes[modeSpinner.selectedItemPosition].second) {
            "ia_m", "auto" -> if (NeuralVoices.isInstalled(this, VoiceKind.MALE)) { playNeural(VoiceKind.MALE); return }
            "ia_f" -> if (NeuralVoices.isInstalled(this, VoiceKind.FEMALE)) { playNeural(VoiceKind.FEMALE); return }
        }
        neuralTest?.stopAll()
        val t = tts ?: return
        val i = voiceSpinner.selectedItemPosition - 1
        if (i in voices.indices) t.voice = voices[i] else t.language = Locale("pt", "BR")
        t.setPitch(pitchOf(pitchBar.progress))
        t.setSpeechRate(speedOf(speedBar.progress))
        t.speak("Olá! Esta é a voz do seu tradutor de legenda.", TextToSpeech.QUEUE_FLUSH, null, "teste")
    }

    // ---------- Começar ----------

    private fun askCapture() {
        getSharedPreferences("cfg", MODE_PRIVATE).edit()
            .putInt("lang", langSpinner.selectedItemPosition)
            .putInt("area2", areaSpinner.selectedItemPosition)
            .putInt("pitchP", pitchBar.progress)
            .putInt("speedP", speedBar.progress)
            .putString("voice", selectedVoiceName())
            .putString("voiceMode", modes[modeSpinner.selectedItemPosition].second)
            .putBoolean("speak", swSpeak.isChecked)
            .putBoolean("showSub", swSub.isChecked)
            .putBoolean("bubble", swBubble.isChecked)
            .putBoolean("duck", swDuck.isChecked)
            .putBoolean("online", swOnline.isChecked)
            .apply()
        val needOverlay = swSub.isChecked || swBubble.isChecked || areas[areaSpinner.selectedItemPosition].second < 0f
        if (needOverlay && !Settings.canDrawOverlays(this)) {
            setStatus(false, "Permita \"Sobrepor a outros apps\" e toque em COMEÇAR de novo")
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            return
        }
        val mode = modes[modeSpinner.selectedItemPosition].second
        val missing = when (mode) {
            "ia_m" -> !NeuralVoices.isInstalled(this, VoiceKind.MALE)
            "ia_f" -> !NeuralVoices.isInstalled(this, VoiceKind.FEMALE)
            "auto" -> !NeuralVoices.isInstalled(this, VoiceKind.MALE) || !NeuralVoices.isInstalled(this, VoiceKind.FEMALE)
            else -> false
        }
        if (missing) {
            setStatus(false, "Baixe a voz de IA primeiro (botão ⬇ Baixar)")
            return
        }
        tts?.stop()
        neuralTest?.stopAll()
        val mpm = getSystemService(MediaProjectionManager::class.java)
        @Suppress("DEPRECATION")
        startActivityForResult(mpm.createScreenCaptureIntent(), reqCapture)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != reqCapture) return
        if (resultCode != RESULT_OK || data == null) {
            setStatus(false, "Permissão de captura negada")
            return
        }
        val i = Intent(this, CaptureService::class.java).apply {
            putExtra("code", resultCode)
            putExtra("data", data)
            putExtra("lang", langs[langSpinner.selectedItemPosition].second)
            putExtra("area", areas[areaSpinner.selectedItemPosition].second)
            putExtra("speed", speedOf(speedBar.progress))
            putExtra("pitch", pitchOf(pitchBar.progress))
            putExtra("voice", selectedVoiceName())
            putExtra("voiceMode", modes[modeSpinner.selectedItemPosition].second)
            putExtra("speak", swSpeak.isChecked)
            putExtra("showSub", swSub.isChecked)
            putExtra("bubble", swBubble.isChecked)
            putExtra("duck", swDuck.isChecked)
            putExtra("online", swOnline.isChecked)
        }
        startForegroundService(i)
        setStatus(true, "Rodando — abra seu vídeo")
        moveTaskToBack(true)
    }

    override fun onDestroy() {
        tts?.shutdown()
        neuralTest?.release()
        super.onDestroy()
    }

    // ---------- Peças do visual ----------

    private fun setStatus(on: Boolean, msg: String) {
        status.text = (if (on) "● " else "○ ") + msg
        status.setTextColor(if (on) green else muted)
    }

    private fun round(color: Int, radiusDp: Int): GradientDrawable {
        val d = GradientDrawable()
        d.setColor(color)
        d.cornerRadius = dp(radiusDp).toFloat()
        return d
    }

    private fun txt(t: String, size: Float, color: Int, bold: Boolean = false): TextView {
        val v = TextView(this)
        v.text = t
        v.textSize = size
        v.setTextColor(color)
        if (bold) v.typeface = Typeface.DEFAULT_BOLD
        return v
    }

    private fun cardView(title: String): LinearLayout {
        val c = LinearLayout(this)
        c.orientation = LinearLayout.VERTICAL
        c.setPadding(dp(16), dp(14), dp(16), dp(16))
        c.background = round(cardC, 20)
        c.layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(14) }
        val t = txt(title, 17f, fg, bold = true)
        t.setPadding(0, 0, 0, dp(6))
        c.addView(t)
        return c
    }

    private fun fieldLabel(t: String): TextView {
        val v = txt(t, 13f, muted)
        v.setPadding(0, dp(10), 0, dp(4))
        return v
    }

    private fun rowLabel(t: String): LinearLayout {
        val r = LinearLayout(this)
        r.orientation = LinearLayout.HORIZONTAL
        r.setPadding(0, dp(14), 0, 0)
        r.addView(txt(t, 13f, muted), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        return r
    }

    private fun scaleLabels(left: String, right: String): LinearLayout {
        val r = LinearLayout(this)
        r.orientation = LinearLayout.HORIZONTAL
        r.addView(txt(left, 12f, muted), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        r.addView(txt(right, 12f, muted))
        return r
    }

    private fun adapter(items: List<String>): ArrayAdapter<String> {
        val a = object : ArrayAdapter<String>(this, android.R.layout.simple_spinner_item, items) {
            override fun getView(position: Int, convertView: View?, parent: ViewGroup): View {
                val v = super.getView(position, convertView, parent) as TextView
                v.setTextColor(fg)
                v.textSize = 16f
                v.setPadding(dp(12), dp(10), dp(12), dp(10))
                return v
            }

            override fun getDropDownView(position: Int, convertView: View?, parent: ViewGroup): View {
                val v = super.getDropDownView(position, convertView, parent) as TextView
                v.setTextColor(fg)
                v.textSize = 16f
                v.setBackgroundColor(cardC)
                v.setPadding(dp(16), dp(14), dp(16), dp(14))
                return v
            }
        }
        a.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        return a
    }

    private fun spinner(items: List<String>, sel: Int): Spinner {
        val s = Spinner(this)
        s.adapter = adapter(items)
        s.setSelection(sel.coerceIn(0, items.size - 1))
        s.background = round(fieldC, 12)
        s.setPopupBackgroundDrawable(round(cardC, 12))
        return s
    }

    private fun seek(max: Int, value: Int): SeekBar {
        val s = SeekBar(this)
        s.max = max
        s.progress = value.coerceIn(0, max)
        s.progressTintList = ColorStateList.valueOf(green)
        s.thumbTintList = ColorStateList.valueOf(green)
        s.progressBackgroundTintList = ColorStateList.valueOf(Color.rgb(60, 68, 84))
        s.setPadding(dp(8), dp(12), dp(8), dp(6))
        return s
    }

    private fun switch(t: String, checked: Boolean): Switch {
        val s = Switch(this)
        s.text = t
        s.textSize = 15f
        s.setTextColor(fg)
        s.isChecked = checked
        s.setPadding(0, dp(12), 0, dp(12))
        val states = arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf())
        s.thumbTintList = ColorStateList(states, intArrayOf(green, Color.rgb(170, 176, 190)))
        s.trackTintList = ColorStateList(states, intArrayOf(Color.argb(120, 29, 205, 120), Color.rgb(60, 68, 84)))
        return s
    }

    private fun chip(t: String, onClick: () -> Unit): TextView {
        val c = txt(t, 12.5f, fg)
        c.gravity = Gravity.CENTER
        c.background = round(Color.rgb(36, 43, 58), 20)
        c.setOnClickListener { onClick() }
        return c
    }

    private fun bigButton(t: String, solid: Boolean, color: Int, onClick: () -> Unit): TextView {
        val b = txt(t, 17f, color, bold = true)
        b.gravity = Gravity.CENTER
        b.isClickable = true
        b.isFocusable = true
        if (solid) {
            b.setTextColor(Color.rgb(5, 30, 18))
            val g = GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT, intArrayOf(green, Color.rgb(80, 230, 160)))
            g.cornerRadius = dp(18).toFloat()
            b.background = g
        } else {
            val g = GradientDrawable()
            g.setColor(Color.TRANSPARENT)
            g.setStroke(dp(2), color)
            g.cornerRadius = dp(16).toFloat()
            b.background = g
        }
        b.setOnClickListener { onClick() }
        return b
    }
}

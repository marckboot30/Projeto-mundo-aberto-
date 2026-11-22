package com.marck.tradutorlegenda

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.Switch
import android.net.Uri
import android.provider.Settings
import android.widget.TextView
import com.google.mlkit.nl.translate.TranslateLanguage

class MainActivity : Activity() {

    private val reqCapture = 42

    private val langs = listOf(
        "Inglês" to TranslateLanguage.ENGLISH,
        "Espanhol" to TranslateLanguage.SPANISH,
        "Francês" to TranslateLanguage.FRENCH,
        "Alemão" to TranslateLanguage.GERMAN,
        "Italiano" to TranslateLanguage.ITALIAN
    )
    private val areas = listOf(
        "Parte de baixo (25%)" to 0.25f,
        "Parte de baixo (35%)" to 0.35f,
        "Metade de baixo" to 0.5f,
        "Tela inteira" to 1.0f
    )
    private val speeds = listOf(
        "Normal" to 1.0f,
        "Rápida" to 1.25f,
        "Muito rápida" to 1.5f
    )

    private lateinit var langSpinner: Spinner
    private lateinit var areaSpinner: Spinner
    private lateinit var speedSpinner: Spinner
    private lateinit var status: TextView
    private lateinit var swSpeak: Switch
    private lateinit var swSub: Switch
    private lateinit var swBubble: Switch
    private lateinit var swDuck: Switch

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = getSharedPreferences("cfg", MODE_PRIVATE)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 48, 48, 48)
        }

        fun label(t: String, size: Float = 15f, bold: Boolean = false) = TextView(this).apply {
            text = t
            textSize = size
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, 24, 0, 8)
        }

        fun spinner(items: List<String>, sel: Int) = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, items)
            setSelection(sel.coerceIn(0, items.size - 1))
        }

        root.addView(label("🎧 Tradutor de Legenda", 22f, true))
        root.addView(label("Lê a legenda do vídeo na tela, traduz e fala em português."))

        root.addView(label("Idioma da legenda", bold = true))
        langSpinner = spinner(langs.map { it.first }, prefs.getInt("lang", 0))
        root.addView(langSpinner)

        root.addView(label("Onde fica a legenda", bold = true))
        areaSpinner = spinner(areas.map { it.first }, prefs.getInt("area", 1))
        root.addView(areaSpinner)

        root.addView(label("Velocidade da voz", bold = true))
        speedSpinner = spinner(speeds.map { it.first }, prefs.getInt("speed", 2))
        root.addView(speedSpinner)

        fun switch(t: String, key: String) = Switch(this).apply {
            text = t
            textSize = 16f
            isChecked = prefs.getBoolean(key, true)
            setPadding(0, 20, 0, 20)
        }
        root.addView(label("Opções", bold = true))
        swSpeak = switch("🔊 Falar a tradução", "speak")
        swSub = switch("💬 Mostrar legenda traduzida na tela", "showSub")
        swBubble = switch("🎧 Botão flutuante por cima do vídeo", "bubble")
        swDuck = switch("🔉 Abaixar o som do vídeo quando a tradução falar", "duck")
        root.addView(swSpeak); root.addView(swDuck); root.addView(swSub); root.addView(swBubble)

        val start = Button(this).apply {
            text = "▶  COMEÇAR"
            textSize = 18f
            setOnClickListener { askCapture() }
        }
        val stop = Button(this).apply {
            text = "■  PARAR"
            textSize = 18f
            setOnClickListener {
                startService(Intent(this@MainActivity, CaptureService::class.java).setAction(CaptureService.ACTION_STOP))
                status.text = "Parado."
            }
        }
        root.addView(start, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(stop, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        status = label("", 15f).apply { gravity = Gravity.CENTER; setTextColor(Color.rgb(0, 120, 70)) }
        root.addView(status)

        root.addView(label(
            "Como usar:\n" +
            "1. Escolha o idioma e toque em COMEÇAR.\n" +
            "2. Permita a captura de tela (escolha \"Tela inteira\" se perguntar).\n" +
            "3. Abra o vídeo com legenda ligada (YouTube, Netflix etc.).\n" +
            "4. A voz usa o volume de mídia (o mesmo do vídeo). O vídeo abaixa sozinho enquanto ela fala.\n" +
            "5. Bolinha flutuante: toque = pausar/continuar, segure = desligar. Dá para arrastar.\n" +
            "6. A legenda traduzida aparece em cima; arraste para onde quiser, toque para esconder.\n\n" +
            "Na 1ª vez ele baixa o idioma (uns 30 MB) — use Wi‑Fi.\n" +
            "Obs.: Netflix e alguns apps bloqueiam captura de tela; aí a tela fica preta e não funciona.",
            13f
        ))

        setContentView(ScrollView(this).apply { addView(root) })

        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 7)
        }
    }

    private fun askCapture() {
        getSharedPreferences("cfg", MODE_PRIVATE).edit()
            .putInt("lang", langSpinner.selectedItemPosition)
            .putInt("area", areaSpinner.selectedItemPosition)
            .putInt("speed", speedSpinner.selectedItemPosition)
            .putBoolean("speak", swSpeak.isChecked)
            .putBoolean("showSub", swSub.isChecked)
            .putBoolean("bubble", swBubble.isChecked)
            .putBoolean("duck", swDuck.isChecked)
            .apply()

        if ((swSub.isChecked || swBubble.isChecked) && !Settings.canDrawOverlays(this)) {
            status.text = "Permita \"Sobrepor a outros apps\" para o Tradutor de Legenda, volte aqui e toque em COMEÇAR de novo."
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            return
        }
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
            status.text = "Permissão de captura negada."
            return
        }
        val i = Intent(this, CaptureService::class.java).apply {
            putExtra("code", resultCode)
            putExtra("data", data)
            putExtra("lang", langs[langSpinner.selectedItemPosition].second)
            putExtra("area", areas[areaSpinner.selectedItemPosition].second)
            putExtra("speed", speeds[speedSpinner.selectedItemPosition].second)
            putExtra("speak", swSpeak.isChecked)
            putExtra("showSub", swSub.isChecked)
            putExtra("bubble", swBubble.isChecked)
            putExtra("duck", swDuck.isChecked)
        }
        startForegroundService(i)
        status.text = "✅ Rodando! Agora abra seu vídeo com legenda."
        moveTaskToBack(true)
    }
}

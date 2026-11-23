package com.marck.tradutorlegenda

import android.os.SystemClock
import android.text.Html
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors

/**
 * Tradução online (MyMemory, grátis, sem conta).
 * Se falhar, demorar ou acabar o limite do dia, o app usa o tradutor sem internet.
 */
object OnlineTranslator {
    private val pool = Executors.newFixedThreadPool(3)
    @Volatile private var blockedUntil = 0L

    fun available(): Boolean = SystemClock.elapsedRealtime() > blockedUntil

    /** Traduz em segundo plano; [done] recebe a tradução ou null se falhou. */
    fun translateAsync(text: String, srcLang: String, done: (String?) -> Unit) {
        if (!available()) { done(null); return }
        pool.execute { done(translate(text, srcLang)) }
    }

    private fun translate(text: String, srcLang: String): String? {
        if (text.isBlank()) return null
        val q = if (text.length > 450) text.substring(0, 450) else text
        return try {
            val url = URL(
                "https://api.mymemory.translated.net/get?q=" + URLEncoder.encode(q, "UTF-8") +
                    "&langpair=" + srcLang + "%7Cpt-BR"
            )
            val c = url.openConnection() as HttpURLConnection
            c.connectTimeout = 2500
            c.readTimeout = 3000
            c.setRequestProperty("User-Agent", "TradutorLegenda/2.7 (Android)")
            val code = c.responseCode
            if (code == 429) { blockedUntil = SystemClock.elapsedRealtime() + 30 * 60_000L; return null }
            if (code != 200) return null
            val body = c.inputStream.bufferedReader().use { it.readText() }
            val o = JSONObject(body)
            val status = o.opt("responseStatus")?.toString()?.toIntOrNull() ?: 0
            var t = o.optJSONObject("responseData")?.optString("translatedText") ?: return null
            if (t.contains("MYMEMORY WARNING", true) || status == 429) {
                // acabou o limite grátis do dia: usa o tradutor sem internet por um tempo
                blockedUntil = SystemClock.elapsedRealtime() + 60 * 60_000L
                return null
            }
            if (status != 200 || t.isBlank()) return null
            @Suppress("DEPRECATION")
            t = Html.fromHtml(t).toString().trim()
            // resposta estranha (tudo maiúsculo quando a frase não era) -> ignora
            val letters = t.filter { it.isLetter() }
            val qLetters = q.filter { it.isLetter() }
            if (letters.length > 6 && letters.all { it.isUpperCase() } && !qLetters.all { it.isUpperCase() }) return null
            t
        } catch (_: Exception) {
            null
        }
    }
}

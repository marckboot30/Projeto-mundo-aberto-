package com.marck.tradutorlegenda

import android.content.Context
import com.google.mlkit.nl.translate.TranslateLanguage
import java.util.Locale

/**
 * Melhora o texto antes e depois da tradução.
 */
object TextFixer {

    // gírias e contrações do inglês que o tradutor entende mal
    private val englishSlang = listOf(
        "gonna" to "going to", "wanna" to "want to", "gotta" to "have to",
        "gimme" to "give me", "lemme" to "let me", "dunno" to "don't know",
        "kinda" to "kind of", "sorta" to "sort of", "outta" to "out of",
        "lotta" to "lot of", "hafta" to "have to", "betcha" to "bet you",
        "gotcha" to "got you", "whatcha" to "what are you", "ya" to "you",
        "y'all" to "you all", "ain't" to "is not", "c'mon" to "come on",
        "'cause" to "because", "cuz" to "because", "'em" to "them",
        "nah" to "no", "yeah" to "yes", "yep" to "yes", "nope" to "no",
        "tryna" to "trying to", "finna" to "going to", "imma" to "I am going to",
        "y'know" to "you know", "doin'" to "doing", "goin'" to "going",
        "nothin'" to "nothing", "somethin'" to "something", "talkin'" to "talking"
    )

    /** Limpa o texto lido da tela e separa as falas. */
    fun cleanSource(raw: String, lang: String): List<String> {
        var s = raw
        // sons e anotações: [música], (risos), ♪ ... ♪
        s = s.replace(Regex("""[\[(（【][^\])）】]{0,40}[\])）】]"""), " ")
        s = s.replace(Regex("[♪♫♬#*]"), " ")
        // nome de quem fala no começo: "JOHN:" ou "MARY :"
        s = s.replace(Regex("""(^|\s[-–—]?\s*)[A-ZÀ-Ý][A-ZÀ-Ý .']{1,20}\s?:\s"""), "$1")

        if (lang == TranslateLanguage.ENGLISH) s = fixEnglishOcr(s)

        // separa falas de pessoas diferentes ("- Oi. - Tudo bem?")
        val parts = s.split(Regex("""(?:^|\s)[-–—]\s+""")).map { normalizeCase(it.trim()) }
            .filter { p -> p.count { it.isLetter() } >= 2 }

        return parts.map { if (lang == TranslateLanguage.ENGLISH) expandSlang(it) else it }
    }

    // letras que o leitor de tela costuma trocar no inglês
    private fun fixEnglishOcr(t: String): String {
        var s = t.replace('|', 'I')
        s = s.replace(Regex("""\bl(['’](m|ll|ve|d))\b"""), "I$1")
        s = s.replace(Regex("""(^|[.!?]\s+|\s)l\s"""), "$1I ")
        s = s.replace(Regex("""\b0(?=[a-zA-Z])"""), "O")
        s = s.replace('’', '\'')
        return s
    }

    // TUDO EM MAIÚSCULA -> Normal (o tradutor erra muito com maiúsculas)
    private fun normalizeCase(t: String): String {
        val letters = t.filter { it.isLetter() }
        if (letters.length < 4) return t
        val upper = letters.count { it.isUpperCase() }
        if (upper.toFloat() / letters.length < 0.8f) return t
        val low = t.lowercase(Locale.ROOT)
        val sb = StringBuilder(low)
        var capNext = true
        for (i in sb.indices) {
            val c = sb[i]
            if (capNext && c.isLetter()) { sb.setCharAt(i, c.uppercaseChar()); capNext = false }
            if (c == '.' || c == '!' || c == '?') capNext = true
        }
        // "i" sozinho em inglês
        return sb.toString().replace(Regex("""\bi\b"""), "I").replace(Regex("""\bi'"""), "I'")
    }

    private fun expandSlang(t: String): String {
        var s = t
        for ((from, to) in englishSlang) {
            val pattern = Regex("(?i)(?<![\\w'])" + Regex.escape(from) + "(?![\\w'])")
            s = pattern.replace(s) { m ->
                val orig = m.value
                if (orig.firstOrNull()?.isUpperCase() == true) to.replaceFirstChar { it.uppercaseChar() } else to
            }
        }
        return s
    }

    // ---------- Correções do usuário (depois de traduzir) ----------

    fun loadCorrections(ctx: Context): List<Pair<String, String>> {
        val raw = ctx.getSharedPreferences("cfg", Context.MODE_PRIVATE).getString("corrections", "") ?: ""
        return raw.split("\n").mapNotNull { line ->
            val i = line.indexOf("=>")
            if (i <= 0) null else line.substring(0, i).trim() to line.substring(i + 2).trim()
        }.filter { it.first.isNotEmpty() }
    }

    fun saveCorrections(ctx: Context, list: List<Pair<String, String>>) {
        ctx.getSharedPreferences("cfg", Context.MODE_PRIVATE).edit()
            .putString("corrections", list.joinToString("\n") { "${it.first}=>${it.second}" })
            .apply()
    }

    fun applyCorrections(text: String, list: List<Pair<String, String>>): String {
        var s = text
        for ((wrong, right) in list) {
            val pattern = Regex("(?i)(?<![\\p{L}\\d])" + Regex.escape(wrong) + "(?![\\p{L}\\d])")
            s = pattern.replace(s) { m ->
                val orig = m.value
                if (orig.firstOrNull()?.isUpperCase() == true) right.replaceFirstChar { it.uppercaseChar() } else right
            }
        }
        // limpa espaços duplos e espaço antes de pontuação
        s = s.replace(Regex("\\s+"), " ").replace(Regex("\\s+([,.!?])"), "$1").trim()
        return s
    }
}

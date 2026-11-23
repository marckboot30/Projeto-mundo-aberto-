package com.marck.controletv

import android.content.Context
import androidx.compose.ui.graphics.Color
import okhttp3.OkHttpClient
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager

enum class TvType(val label: String) {
    ANDROID("Android TV / Google TV"),
    SAMSUNG("Samsung"),
    LG("LG"),
    ROKU("Roku TV"),
}

data class TvDevice(val name: String, val ip: String, val type: TvType) {
    val id get() = "${type.name}@$ip"

    fun toJson(): JSONObject = JSONObject().put("name", name).put("ip", ip).put("type", type.name)

    companion object {
        fun fromJson(j: JSONObject) = TvDevice(j.getString("name"), j.getString("ip"), TvType.valueOf(j.getString("type")))
    }
}

enum class Key {
    UP, DOWN, LEFT, RIGHT, OK, BACK, HOME, MENU, SETTINGS,
    VOL_UP, VOL_DOWN, MUTE, CH_UP, CH_DOWN, POWER,
    PLAY_PAUSE, REWIND, FORWARD, INPUT,
    N0, N1, N2, N3, N4, N5, N6, N7, N8, N9;

    val digit: Int? get() = if (name.startsWith("N") && name.length == 2) name[1].digitToInt() else null

    companion object {
        fun digit(d: Int) = valueOf("N$d")
    }
}

enum class StreamApp(val label: String, val color: Color, val text: Color = Color.White) {
    NETFLIX("Netflix", Color(0xFFE50914)),
    YOUTUBE("YouTube", Color(0xFFFF0033)),
    PRIME("Prime Video", Color(0xFF00A8E1)),
    DISNEY("Disney+", Color(0xFF113CCF)),
    GLOBOPLAY("Globoplay", Color(0xFFFB0234)),
}

sealed interface ConnectResult {
    data object Ok : ConnectResult
    data object NeedCode : ConnectResult
    data class Error(val msg: String) : ConnectResult
}

interface TvController {
    val tv: TvDevice
    suspend fun connect(): ConnectResult
    suspend fun submitCode(code: String): ConnectResult = ConnectResult.Error("Essa TV não usa código")
    /** Retorna false se a conexão caiu. */
    suspend fun press(key: Key): Boolean
    val apps: Map<StreamApp, String>
    suspend fun launch(app: StreamApp): Boolean
    fun close()
}

/** Guarda TVs, tokens e o certificado do app no celular. */
class Store(ctx: Context) {
    private val sp = ctx.getSharedPreferences("controle_tv", Context.MODE_PRIVATE)

    fun get(k: String): String? = sp.getString(k, null)
    fun put(k: String, v: String?) = sp.edit().putString(k, v).apply()

    var savedTvs: List<TvDevice>
        get() = runCatching {
            val a = JSONArray(get("tvs") ?: "[]")
            List(a.length()) { TvDevice.fromJson(a.getJSONObject(it)) }
        }.getOrDefault(emptyList())
        set(v) = put("tvs", JSONArray().apply { v.forEach { put(it.toJson()) } }.toString())

    var lastTvId: String?
        get() = get("last")
        set(v) = put("last", v)
}

object Net {
    /** As TVs usam certificado próprio (não oficial), então aceitamos o da rede de casa. */
    val trustAll = object : X509TrustManager {
        override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
        override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
        override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
    }

    val client: OkHttpClient by lazy {
        val ctx = SSLContext.getInstance("TLS").apply { init(null, arrayOf(trustAll), SecureRandom()) }
        OkHttpClient.Builder()
            .sslSocketFactory(ctx.socketFactory, trustAll)
            .hostnameVerifier { _, _ -> true }
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)
            .build()
    }

    fun http(url: String, method: String = "GET", timeout: Int = 3000): String? = try {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = method
        c.connectTimeout = timeout
        c.readTimeout = timeout
        if (method == "POST") {
            c.doOutput = true
            c.outputStream.close()
        }
        val code = c.responseCode
        val body = (if (code < 400) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        c.disconnect()
        if (code < 400) body else null
    } catch (e: Exception) {
        null
    }
}

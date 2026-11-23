package com.marck.controletv

import android.util.Base64
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject

/** Samsung Smart TV (Tizen, 2016 em diante). Na 1ª vez a TV pede para "Permitir". */
class SamsungController(override val tv: TvDevice, private val store: Store) : TvController {
    @Volatile private var ws: WebSocket? = null
    @Volatile private var alive = false
    private var playing = true

    override val apps = mapOf(
        StreamApp.NETFLIX to "3201907018807",
        StreamApp.YOUTUBE to "111299001912",
        StreamApp.PRIME to "3201910019365",
        StreamApp.DISNEY to "3201901017640",
    )

    private val tokenKey get() = "samsung_token_${tv.ip}"

    override suspend fun connect(): ConnectResult {
        val r = open(secure = true)
        if (r is ConnectResult.Ok) return r
        val r2 = open(secure = false) // TVs de 2016/2017
        return if (r2 is ConnectResult.Ok) r2 else r
    }

    private suspend fun open(secure: Boolean): ConnectResult {
        close()
        val name = Base64.encodeToString("Controle TV".toByteArray(), Base64.NO_WRAP)
        val token = store.get(tokenKey)
        val url = if (secure) {
            "wss://${tv.ip}:8002/api/v2/channels/samsung.remote.control?name=$name" + (token?.let { "&token=$it" } ?: "")
        } else {
            "ws://${tv.ip}:8001/api/v2/channels/samsung.remote.control?name=$name"
        }
        val result = CompletableDeferred<ConnectResult>()
        val socket = Net.client.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                val j = runCatching { JSONObject(text) }.getOrNull() ?: return
                when (j.optString("event")) {
                    "ms.channel.connect" -> {
                        j.optJSONObject("data")?.optString("token")?.takeIf { it.isNotEmpty() }?.let { store.put(tokenKey, it) }
                        alive = true
                        result.complete(ConnectResult.Ok)
                    }
                    "ms.channel.unauthorized" -> result.complete(ConnectResult.Error("A TV recusou. Aceite o pedido na TV ou libere em Configurações > Geral > Gerenciador de dispositivos externos."))
                    "ms.channel.timeOut" -> result.complete(ConnectResult.Error("Tempo esgotado. Tente de novo e aceite na TV."))
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (webSocket === ws) alive = false
                result.complete(ConnectResult.Error("Não consegui falar com a TV Samsung. Ela está ligada e no mesmo Wi-Fi?"))
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                if (webSocket === ws) alive = false
            }
        })
        ws = socket
        return withTimeoutOrNull(45_000) { result.await() }
            ?: ConnectResult.Error("A TV não respondeu. Aceite o pedido que aparece na tela da TV.")
    }

    private fun sendKey(code: String): Boolean {
        val s = ws ?: return false
        if (!alive) return false
        val j = JSONObject().put("method", "ms.remote.control").put("params", JSONObject()
            .put("Cmd", "Click").put("DataOfCmd", code).put("Option", "false").put("TypeOfRemote", "SendRemoteKey"))
        return s.send(j.toString())
    }

    override suspend fun press(key: Key): Boolean {
        val code = key.digit?.let { "KEY_$it" } ?: when (key) {
            Key.UP -> "KEY_UP"; Key.DOWN -> "KEY_DOWN"; Key.LEFT -> "KEY_LEFT"; Key.RIGHT -> "KEY_RIGHT"
            Key.OK -> "KEY_ENTER"; Key.BACK -> "KEY_RETURN"; Key.HOME -> "KEY_HOME"; Key.MENU -> "KEY_MENU"
            Key.SETTINGS -> "KEY_TOOLS"; Key.VOL_UP -> "KEY_VOLUP"; Key.VOL_DOWN -> "KEY_VOLDOWN"; Key.MUTE -> "KEY_MUTE"
            Key.CH_UP -> "KEY_CHUP"; Key.CH_DOWN -> "KEY_CHDOWN"; Key.POWER -> "KEY_POWER"
            Key.PLAY_PAUSE -> { playing = !playing; if (playing) "KEY_PLAY" else "KEY_PAUSE" }
            Key.REWIND -> "KEY_REWIND"; Key.FORWARD -> "KEY_FF"; Key.INPUT -> "KEY_SOURCE"
            else -> return true
        }
        if (sendKey(code)) return true
        if (connect() !is ConnectResult.Ok) return false
        return sendKey(code)
    }

    override suspend fun launch(app: StreamApp): Boolean {
        val id = apps[app] ?: return false
        val s = ws
        if (s != null && alive) {
            val j = JSONObject().put("method", "ms.channel.emit").put("params", JSONObject()
                .put("event", "ed.apps.launch").put("to", "host")
                .put("data", JSONObject().put("appId", id).put("action_type", "DEEP_LINK")))
            if (s.send(j.toString())) return true
        }
        return withContext(Dispatchers.IO) { Net.http("http://${tv.ip}:8001/api/v2/applications/$id", "POST") != null }
    }

    override fun close() {
        alive = false
        ws?.cancel()
        ws = null
    }
}

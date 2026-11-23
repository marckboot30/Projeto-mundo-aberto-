package com.marck.controletv

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/** LG webOS. Na 1ª vez a TV pergunta se aceita o controle. */
class LgController(override val tv: TvDevice, private val store: Store) : TvController {
    @Volatile private var ws: WebSocket? = null
    @Volatile private var pointer: WebSocket? = null
    @Volatile private var alive = false
    private val pending = ConcurrentHashMap<String, CompletableDeferred<JSONObject>>()
    private val ids = AtomicInteger()
    private var playing = true

    override val apps = mapOf(
        StreamApp.NETFLIX to "netflix",
        StreamApp.YOUTUBE to "youtube.leanback.v4",
        StreamApp.PRIME to "amazon",
        StreamApp.DISNEY to "com.disney.disneyplus-prod",
    )

    private val keyKey get() = "lg_key_${tv.ip}"

    private val permissions = listOf(
        "LAUNCH", "LAUNCH_WEBAPP", "APP_TO_APP", "CONTROL_AUDIO", "CONTROL_DISPLAY",
        "CONTROL_INPUT_JOYSTICK", "CONTROL_INPUT_MEDIA_RECORDING", "CONTROL_INPUT_MEDIA_PLAYBACK",
        "CONTROL_INPUT_TV", "CONTROL_POWER", "READ_APP_STATUS", "READ_CURRENT_CHANNEL",
        "READ_INPUT_DEVICE_LIST", "READ_NETWORK_STATE", "READ_RUNNING_APPS", "READ_TV_CHANNEL_LIST",
        "WRITE_NOTIFICATION_TOAST", "READ_POWER_STATE", "READ_COUNTRY_INFO", "CONTROL_INPUT_TEXT",
        "CONTROL_MOUSE_AND_KEYBOARD", "READ_INSTALLED_APPS",
    )

    override suspend fun connect(): ConnectResult {
        val r = open("wss://${tv.ip}:3001")
        if (r is ConnectResult.Ok) return r
        val r2 = open("ws://${tv.ip}:3000") // TVs mais antigas
        return if (r2 is ConnectResult.Ok) r2 else r
    }

    private suspend fun open(url: String): ConnectResult {
        close()
        val result = CompletableDeferred<ConnectResult>()
        val socket = Net.client.newWebSocket(Request.Builder().url(url).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                val payload = JSONObject()
                    .put("forcePairing", false)
                    .put("pairingType", "PROMPT")
                    .put("manifest", JSONObject()
                        .put("manifestVersion", 1)
                        .put("appVersion", "1.0")
                        .put("permissions", JSONArray(permissions)))
                store.get(keyKey)?.let { payload.put("client-key", it) }
                webSocket.send(JSONObject().put("type", "register").put("id", "reg0").put("payload", payload).toString())
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val j = runCatching { JSONObject(text) }.getOrNull() ?: return
                val id = j.optString("id")
                when (j.optString("type")) {
                    "registered" -> {
                        j.optJSONObject("payload")?.optString("client-key")?.takeIf { it.isNotEmpty() }?.let { store.put(keyKey, it) }
                        alive = true
                        result.complete(ConnectResult.Ok)
                    }
                    "error" -> {
                        if (id == "reg0") result.complete(ConnectResult.Error("A TV LG recusou a conexão."))
                        pending.remove(id)?.complete(j)
                    }
                    "response" -> pending.remove(id)?.complete(j)
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                if (webSocket === ws) alive = false
                result.complete(ConnectResult.Error("Não consegui falar com a TV LG. Ela está ligada e no mesmo Wi-Fi?"))
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                if (webSocket === ws) alive = false
            }
        })
        ws = socket
        val r = withTimeoutOrNull(60_000) { result.await() }
            ?: ConnectResult.Error("A TV não respondeu. Aceite o pedido que aparece na tela da TV.")
        if (r is ConnectResult.Ok) openPointer()
        return r
    }

    private suspend fun openPointer() {
        val res = request("ssap://com.webos.service.networkinput/getPointerInputSocket") ?: return
        val path = res.optJSONObject("payload")?.optString("socketPath")?.takeIf { it.isNotEmpty() } ?: return
        pointer = Net.client.newWebSocket(Request.Builder().url(path).build(), object : WebSocketListener() {})
    }

    private suspend fun request(uri: String, payload: JSONObject? = null): JSONObject? {
        val s = ws ?: return null
        val id = "r${ids.incrementAndGet()}"
        val d = CompletableDeferred<JSONObject>()
        pending[id] = d
        val msg = JSONObject().put("type", "request").put("id", id).put("uri", uri)
        if (payload != null) msg.put("payload", payload)
        if (!s.send(msg.toString())) { pending.remove(id); return null }
        return withTimeoutOrNull(5000) { d.await() }
    }

    private fun button(name: String): Boolean =
        pointer?.send("type:button\nname:$name\n\n") ?: false

    private suspend fun doPress(key: Key): Boolean {
        if (!alive) return false
        key.digit?.let { return button("$it") }
        return when (key) {
            Key.POWER -> request("ssap://system/turnOff") != null
            Key.INPUT -> request("ssap://system.launcher/launch", JSONObject().put("id", "com.webos.app.inputpicker")) != null
            Key.VOL_UP -> button("VOLUMEUP") || request("ssap://audio/volumeUp") != null
            Key.VOL_DOWN -> button("VOLUMEDOWN") || request("ssap://audio/volumeDown") != null
            Key.CH_UP -> button("CHANNELUP") || request("ssap://tv/channelUp") != null
            Key.CH_DOWN -> button("CHANNELDOWN") || request("ssap://tv/channelDown") != null
            Key.PLAY_PAUSE -> {
                playing = !playing
                button(if (playing) "PLAY" else "PAUSE") ||
                    request(if (playing) "ssap://media.controls/play" else "ssap://media.controls/pause") != null
            }
            Key.REWIND -> button("REWIND") || request("ssap://media.controls/rewind") != null
            Key.FORWARD -> button("FASTFORWARD") || request("ssap://media.controls/fastForward") != null
            Key.MUTE -> button("MUTE")
            Key.UP -> button("UP"); Key.DOWN -> button("DOWN"); Key.LEFT -> button("LEFT"); Key.RIGHT -> button("RIGHT")
            Key.OK -> button("ENTER"); Key.BACK -> button("BACK"); Key.HOME -> button("HOME")
            Key.MENU -> button("MENU"); Key.SETTINGS -> button("QMENU")
            else -> true
        }
    }

    override suspend fun press(key: Key): Boolean {
        if (doPress(key)) return true
        if (connect() !is ConnectResult.Ok) return false
        return doPress(key)
    }

    override suspend fun launch(app: StreamApp): Boolean {
        val id = apps[app] ?: return false
        return request("ssap://system.launcher/launch", JSONObject().put("id", id)) != null
    }

    override fun close() {
        alive = false
        pointer?.cancel(); pointer = null
        ws?.cancel(); ws = null
    }
}

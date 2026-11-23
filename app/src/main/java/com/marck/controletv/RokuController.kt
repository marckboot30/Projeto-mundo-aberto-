package com.marck.controletv

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Roku TV (TCL Roku, AOC Roku, Philco Roku...). Usa comandos HTTP na porta 8060. */
class RokuController(override val tv: TvDevice) : TvController {
    override val apps = mapOf(
        StreamApp.NETFLIX to "12",
        StreamApp.YOUTUBE to "837",
        StreamApp.PRIME to "13",
        StreamApp.DISNEY to "291097",
    )

    private val base get() = "http://${tv.ip}:8060"

    override suspend fun connect(): ConnectResult = withContext(Dispatchers.IO) {
        if (Net.http("$base/query/device-info") != null) ConnectResult.Ok
        else ConnectResult.Error("Não consegui falar com a Roku. Ela está ligada e no mesmo Wi-Fi? Em Configurações > Sistema > Configurações avançadas > Controle por apps móveis, deixe Ativado.")
    }

    override suspend fun press(key: Key): Boolean {
        val k = key.digit?.let { "Lit_$it" } ?: when (key) {
            Key.UP -> "Up"; Key.DOWN -> "Down"; Key.LEFT -> "Left"; Key.RIGHT -> "Right"
            Key.OK -> "Select"; Key.BACK -> "Back"; Key.HOME -> "Home"; Key.MENU -> "Info"
            Key.SETTINGS -> "Info"; Key.VOL_UP -> "VolumeUp"; Key.VOL_DOWN -> "VolumeDown"
            Key.MUTE -> "VolumeMute"; Key.CH_UP -> "ChannelUp"; Key.CH_DOWN -> "ChannelDown"
            Key.POWER -> "Power"; Key.PLAY_PAUSE -> "Play"; Key.REWIND -> "Rev"; Key.FORWARD -> "Fwd"
            Key.INPUT -> "InputHDMI1"
            else -> return true
        }
        return withContext(Dispatchers.IO) { Net.http("$base/keypress/$k", "POST") != null }
    }

    override suspend fun launch(app: StreamApp): Boolean {
        val id = apps[app] ?: return false
        return withContext(Dispatchers.IO) { Net.http("$base/launch/$id", "POST") != null }
    }

    override fun close() {}
}

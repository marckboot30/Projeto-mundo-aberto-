package com.marck.controletv

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Roku TV (TCL Roku, AOC Roku, Philco Roku...). Usa comandos HTTP na porta 8060. */
class RokuController(override val tv: TvDevice) : TvController {
    override suspend fun installedApps(): List<TvApp> = withContext(Dispatchers.IO) {
        val xml = Net.http("$base/query/apps") ?: return@withContext emptyList()
        Regex("""<app id="([^"]+)"[^>]*type="appl"[^>]*>(.*?)</app>""").findAll(xml).map {
            val id = it.groupValues[1]
            TvApp(id, it.groupValues[2].replace("&amp;", "&").trim(), "$base/query/icon/$id")
        }.toList()
    }

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

    override suspend fun open(app: TvApp): Boolean {
        return withContext(Dispatchers.IO) { Net.http("$base/launch/${app.id}", "POST") != null }
    }

    override fun close() {}
}

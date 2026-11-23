package com.marck.controletv

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

sealed interface Conn {
    data object Idle : Conn
    data class Connecting(val msg: String) : Conn
    data class NeedCode(val error: String? = null) : Conn
    data object Connected : Conn
    data class Failed(val msg: String) : Conn
}

class RemoteViewModel(app: Application) : AndroidViewModel(app) {
    private val store = Store(app)
    private val discovery = Discovery(app)

    val tvs = mutableStateListOf<TvDevice>()
    var scanning by mutableStateOf(false)
        private set
    var current by mutableStateOf<TvDevice?>(null)
        private set
    var conn by mutableStateOf<Conn>(Conn.Idle)
        private set
    var toast by mutableStateOf<String?>(null)

    private var ctrl: TvController? = null
    private var connectJob: Job? = null

    val apps: List<StreamApp> get() = ctrl?.apps?.keys?.toList() ?: emptyList()

    init {
        tvs.addAll(store.savedTvs)
        val last = store.lastTvId?.let { id -> tvs.firstOrNull { it.id == id } }
        if (last != null) select(last)
        scan()
    }

    fun scan() {
        if (scanning) return
        scanning = true
        viewModelScope.launch {
            try {
                discovery.scan { d ->
                    val i = tvs.indexOfFirst { it.id == d.id }
                    if (i >= 0) tvs[i] = d else tvs.add(d)
                    store.savedTvs = tvs.toList()
                }
            } catch (_: Exception) {
            }
            scanning = false
        }
    }

    fun addManual(ip: String, type: TvType) {
        val d = TvDevice("${type.label} ($ip)", ip.trim(), type)
        if (tvs.none { it.id == d.id }) tvs.add(d)
        store.savedTvs = tvs.toList()
        select(d)
    }

    fun forget(d: TvDevice) {
        tvs.removeAll { it.id == d.id }
        store.savedTvs = tvs.toList()
    }

    private fun waitMsg(t: TvType) = when (t) {
        TvType.SAMSUNG, TvType.LG -> "Se aparecer um aviso na TV, escolha Permitir / Aceitar"
        else -> "Conectando…"
    }

    fun select(d: TvDevice) {
        connectJob?.cancel()
        ctrl?.close()
        current = d
        store.lastTvId = d.id
        val c = when (d.type) {
            TvType.ANDROID -> AndroidTvController(d, store)
            TvType.SAMSUNG -> SamsungController(d, store)
            TvType.LG -> LgController(d, store)
            TvType.ROKU -> RokuController(d)
        }
        ctrl = c
        conn = Conn.Connecting(waitMsg(d.type))
        connectJob = viewModelScope.launch { apply(c.connect()) }
    }

    private fun apply(r: ConnectResult) {
        conn = when (r) {
            ConnectResult.Ok -> Conn.Connected
            ConnectResult.NeedCode -> Conn.NeedCode()
            is ConnectResult.Error -> Conn.Failed(r.msg)
        }
    }

    fun submitCode(code: String) {
        val c = ctrl ?: return
        conn = Conn.Connecting("Pareando…")
        viewModelScope.launch {
            when (val r = c.submitCode(code)) {
                is ConnectResult.Error -> conn = Conn.NeedCode(r.msg)
                else -> apply(r)
            }
        }
    }

    fun retry() { current?.let { select(it) } }

    fun cancel() {
        connectJob?.cancel()
        ctrl?.close()
        ctrl = null
        current = null
        store.lastTvId = null
        conn = Conn.Idle
    }

    fun press(key: Key) {
        val c = ctrl ?: return
        viewModelScope.launch {
            if (!c.press(key)) toast = "A TV não respondeu. Ela está ligada?"
        }
    }

    fun launch(app: StreamApp) {
        val c = ctrl ?: return
        viewModelScope.launch {
            if (!c.launch(app)) toast = "Não consegui abrir o ${app.label}"
        }
    }

    override fun onCleared() {
        ctrl?.close()
    }
}

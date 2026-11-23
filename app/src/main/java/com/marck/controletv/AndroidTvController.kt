package com.marck.controletv

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.OutputStream
import java.math.BigInteger
import java.net.InetSocketAddress
import java.security.MessageDigest
import java.security.cert.X509Certificate
import java.security.interfaces.RSAPublicKey
import javax.net.ssl.SSLSocket

/**
 * Android TV / Google TV (TCL, Philco, Sony, Xiaomi, Chromecast com Google TV...).
 * Usa o mesmo protocolo do app oficial "Google TV": pareamento com código na porta 6467
 * e controle na porta 6466.
 */
class AndroidTvController(override val tv: TvDevice, private val store: Store) : TvController {
    private val cert by lazy { ClientCert(store) }
    private var sock: SSLSocket? = null
    private var out: OutputStream? = null
    @Volatile private var alive = false

    private var pairSock: SSLSocket? = null
    private var serverCert: X509Certificate? = null

    // O Android TV não informa os apps instalados, então mostramos os mais usados no Brasil.
    // Se o app estiver na TV ele abre; se não, a TV pode abrir a Play Store.
    override val listsInstalled get() = false

    override suspend fun installedApps() = listOf(
        TvApp("com.netflix.ninja", "Netflix"),
        TvApp("com.google.android.youtube.tv", "YouTube"),
        TvApp("com.amazon.amazonvideo.livingroom", "Prime Video"),
        TvApp("com.disney.disneyplus", "Disney+"),
        TvApp("com.wbd.stream", "Max"),
        TvApp("com.globo.globotv", "Globoplay"),
        TvApp("com.spotify.tv.android", "Spotify"),
        TvApp("com.google.android.youtube.tvmusic", "YouTube Music"),
        TvApp("tv.pluto.android", "Pluto TV"),
        TvApp("com.cbs.ott", "Paramount+"),
        TvApp("com.crunchyroll.crunchyroid", "Crunchyroll"),
        TvApp("com.apple.atve.androidtv.appletv", "Apple TV"),
        TvApp("tv.twitch.android.app", "Twitch"),
        TvApp("deezer.android.tv", "Deezer"),
        TvApp("com.plexapp.android", "Plex"),
        TvApp("org.xbmc.kodi", "Kodi"),
        TvApp("org.videolan.vlc", "VLC"),
        TvApp("com.liskovsoft.smarttubetv.beta", "SmartTube"),
        TvApp("com.android.vending", "Play Store"),
        TvApp("com.android.tv.settings", "Configurações"),
    )

    override suspend fun connect(): ConnectResult = withContext(Dispatchers.IO) {
        try {
            openRemote()
            ConnectResult.Ok
        } catch (e: Exception) {
            try {
                startPairing()
                ConnectResult.NeedCode
            } catch (e2: Exception) {
                ConnectResult.Error("Não consegui falar com a TV. Ela está ligada e no mesmo Wi-Fi?")
            }
        }
    }

    // ---------- Controle (porta 6466) ----------
    private fun openRemote() {
        close()
        val s = cert.socketFactory.createSocket() as SSLSocket
        s.connect(InetSocketAddress(tv.ip, 6466), 4000)
        s.soTimeout = 4000
        s.startHandshake()
        val o = s.outputStream
        val ins = s.inputStream
        // A TV manda a configuração primeiro. Se não mandar, o celular não está pareado.
        handle(Pb.read(ins), o)
        s.soTimeout = 0
        sock = s; out = o; alive = true
        Thread {
            try {
                while (alive) handle(Pb.read(ins), o)
            } catch (_: Exception) {
            }
            alive = false
        }.apply { isDaemon = true }.start()
    }

    private fun handle(m: Fields, o: OutputStream) {
        when {
            m.has(1) -> Pb.write(o, Pb().msg(1, Pb().int(1, 622).msg(2, Pb()
                .str(1, "Controle TV").str(2, "Marck").int(3, 1).str(4, "1")
                .str(5, "atvremote").str(6, "1.0.0"))))
            m.has(2) -> Pb.write(o, Pb().msg(2, Pb().int(1, 622)))
            m.has(8) -> Pb.write(o, Pb().msg(9, Pb().int(1, m.msg(8)?.long(1) ?: 0L)))
        }
    }

    private fun send(m: Pb): Boolean {
        val o = out ?: return false
        if (!alive) return false
        return try { Pb.write(o, m); true } catch (e: Exception) { alive = false; false }
    }

    private suspend fun sendOrReconnect(m: Pb): Boolean = withContext(Dispatchers.IO) {
        if (send(m)) return@withContext true
        try { openRemote(); send(m) } catch (e: Exception) { false }
    }

    override suspend fun press(key: Key): Boolean {
        val code = keyCode(key)
        return sendOrReconnect(Pb().msg(10, Pb().int(1, code).int(2, 3)))
    }

    override suspend fun open(app: TvApp): Boolean {
        val link = if ("://" in app.id) app.id else "market://launch?id=${app.id}"
        return sendOrReconnect(Pb().msg(90, Pb().str(1, link)))
    }

    private fun keyCode(k: Key): Int = k.digit?.let { 7 + it } ?: when (k) {
        Key.UP -> 19; Key.DOWN -> 20; Key.LEFT -> 21; Key.RIGHT -> 22; Key.OK -> 23
        Key.BACK -> 4; Key.HOME -> 3; Key.MENU -> 82; Key.SETTINGS -> 176
        Key.VOL_UP -> 24; Key.VOL_DOWN -> 25; Key.MUTE -> 164
        Key.CH_UP -> 166; Key.CH_DOWN -> 167; Key.POWER -> 26
        Key.PLAY_PAUSE -> 85; Key.REWIND -> 89; Key.FORWARD -> 90; Key.INPUT -> 178
        else -> 0
    }

    // ---------- Pareamento (porta 6467) ----------
    private fun pairMsg(build: Pb.() -> Unit) = Pb().int(1, 2).int(2, 200).apply(build)

    private fun pairExchange(s: SSLSocket, m: Pb) {
        Pb.write(s.outputStream, m)
        val r = Pb.read(s.inputStream)
        if (r.long(2) != 200L) throw IllegalStateException("status ${r.long(2)}")
    }

    private fun hexEncoding() = Pb().int(1, 3).int(2, 6)

    private fun startPairing() {
        pairSock?.runCatching { close() }
        val s = cert.socketFactory.createSocket() as SSLSocket
        s.connect(InetSocketAddress(tv.ip, 6467), 5000)
        s.soTimeout = 10000
        s.startHandshake()
        serverCert = s.session.peerCertificates[0] as X509Certificate
        pairSock = s
        pairExchange(s, pairMsg { msg(10, Pb().str(1, "atvremote").str(2, "Controle TV")) })
        pairExchange(s, pairMsg { msg(20, Pb().msg(1, hexEncoding()).int(3, 1)) })
        pairExchange(s, pairMsg { msg(30, Pb().msg(1, hexEncoding()).int(2, 1)) })
        // Agora a TV mostra o código de 6 letras/números na tela
    }

    private fun unsigned(b: BigInteger): ByteArray {
        val a = b.toByteArray()
        return if (a.size > 1 && a[0] == 0.toByte()) a.copyOfRange(1, a.size) else a
    }

    override suspend fun submitCode(code: String): ConnectResult = withContext(Dispatchers.IO) {
        val c = code.trim().uppercase()
        if (!Regex("[0-9A-F]{6}").matches(c)) return@withContext ConnectResult.Error("O código tem 6 letras ou números (0-9 e A-F)")
        val s = pairSock
        val srv = serverCert
        if (s == null || srv == null) {
            return@withContext try { startPairing(); ConnectResult.NeedCode } catch (e: Exception) {
                ConnectResult.Error("A TV fechou o pareamento. Tente de novo.")
            }
        }
        val cp = cert.cert.publicKey as RSAPublicKey
        val sp = srv.publicKey as RSAPublicKey
        val md = MessageDigest.getInstance("SHA-256")
        md.update(unsigned(cp.modulus)); md.update(unsigned(cp.publicExponent))
        md.update(unsigned(sp.modulus)); md.update(unsigned(sp.publicExponent))
        md.update(c.substring(2).chunked(2).map { it.toInt(16).toByte() }.toByteArray())
        val hash = md.digest()
        if (hash[0] != c.substring(0, 2).toInt(16).toByte()) {
            return@withContext ConnectResult.Error("Código errado. Confira na TV e digite de novo.")
        }
        try {
            pairExchange(s, pairMsg { msg(40, Pb().bytes(1, hash)) })
            s.runCatching { close() }
            pairSock = null
            Thread.sleep(500)
            openRemote()
            ConnectResult.Ok
        } catch (e: Exception) {
            ConnectResult.Error("O pareamento falhou. Tente de novo.")
        }
    }

    override fun close() {
        alive = false
        sock?.runCatching { close() }
        sock = null; out = null
    }
}

package com.marck.controletv

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.SocketTimeoutException
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.resume

/** Procura TVs na rede Wi-Fi (SSDP para Samsung/LG/Roku e mDNS para Android TV). */
class Discovery(private val ctx: Context) {

    private val searchTargets = listOf(
        "roku:ecp",
        "urn:samsung.com:device:RemoteControlReceiver:1",
        "urn:lge-com:service:webos-second-screen:1",
        "urn:dial-multiscreen-org:service:dial:1",
    )

    suspend fun scan(seconds: Int = 7, onFound: (TvDevice) -> Unit) {
        val wifi = ctx.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        val lock = wifi.createMulticastLock("controle-tv").apply { setReferenceCounted(false) }
        runCatching { lock.acquire() }
        val main = Handler(Looper.getMainLooper())
        val seen = ConcurrentHashMap<String, Boolean>()
        val found: (TvDevice) -> Unit = { d ->
            if (seen.putIfAbsent(d.id, true) == null) main.post { onFound(d) }
        }
        try {
            coroutineScope {
                launch(Dispatchers.IO) { ssdp(seconds, found) }
                launch(Dispatchers.Main) { nsd(seconds, found) }
            }
        } finally {
            runCatching { lock.release() }
        }
    }

    // ---------------- SSDP ----------------
    private suspend fun ssdp(seconds: Int, found: (TvDevice) -> Unit) = coroutineScope {
        val sock = DatagramSocket()
        sock.soTimeout = 700
        val group = InetAddress.getByName("239.255.255.250")
        val asked = ConcurrentHashMap<String, Boolean>()
        try {
            repeat(2) {
                for (st in searchTargets) {
                    val msg = "M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 2\r\nST: $st\r\n\r\n"
                    val b = msg.toByteArray()
                    runCatching { sock.send(DatagramPacket(b, b.size, group, 1900)) }
                }
            }
            val end = System.currentTimeMillis() + seconds * 1000L
            val buf = ByteArray(4096)
            while (System.currentTimeMillis() < end) {
                val p = DatagramPacket(buf, buf.size)
                try { sock.receive(p) } catch (e: SocketTimeoutException) { continue } catch (e: Exception) { break }
                val ip = p.address.hostAddress ?: continue
                val headers = String(p.data, 0, p.length).split("\r\n").mapNotNull {
                    val i = it.indexOf(':'); if (i > 0) it.substring(0, i).trim().lowercase() to it.substring(i + 1).trim() else null
                }.toMap()
                val st = headers["st"] ?: ""
                val server = headers["server"] ?: ""
                val location = headers["location"]
                val type = when {
                    st == "roku:ecp" || server.contains("Roku", true) -> TvType.ROKU
                    st.contains("samsung", true) || server.contains("Samsung", true) -> TvType.SAMSUNG
                    st.contains("lge", true) || server.contains("webos", true) -> TvType.LG
                    else -> null
                }
                val key = "$ip/$type"
                if (asked.putIfAbsent(key, true) != null) continue
                launch(Dispatchers.IO) { identify(ip, type, location)?.let(found) }
            }
        } finally {
            sock.close()
        }
    }

    private fun friendlyName(location: String?): String? {
        val xml = location?.let { Net.http(it, timeout = 2000) } ?: return null
        return Regex("<friendlyName>(.*?)</friendlyName>", RegexOption.DOT_MATCHES_ALL).find(xml)?.groupValues?.get(1)
            ?.replace("&amp;", "&")?.replace("&quot;", "\"")?.replace("&#39;", "'")?.trim()
    }

    private fun identify(ip: String, type: TvType?, location: String?): TvDevice? {
        if (type == TvType.SAMSUNG || type == null) {
            // As Samsung novas respondem nessa porta com o nome da TV
            val j = Net.http("http://$ip:8001/api/v2/", timeout = 2000)?.let { runCatching { JSONObject(it) }.getOrNull() }
            val dev = j?.optJSONObject("device")
            if (dev != null) {
                val name = dev.optString("name").ifEmpty { j.optString("name") }.replace("[TV] ", "")
                return TvDevice(name.ifEmpty { "TV Samsung" }, ip, TvType.SAMSUNG)
            }
            return if (type == TvType.SAMSUNG) TvDevice(friendlyName(location) ?: "TV Samsung", ip, TvType.SAMSUNG) else null
        }
        if (type == TvType.ROKU) {
            val info = Net.http("http://$ip:8060/query/device-info", timeout = 2000)
            val name = info?.let {
                Regex("<user-device-name>(.*?)</user-device-name>").find(it)?.groupValues?.get(1)?.takeIf { n -> n.isNotBlank() }
                    ?: Regex("<friendly-device-name>(.*?)</friendly-device-name>").find(it)?.groupValues?.get(1)
            }
            return TvDevice(name ?: friendlyName(location) ?: "Roku TV", ip, TvType.ROKU)
        }
        if (type == TvType.LG) return TvDevice(friendlyName(location) ?: "TV LG", ip, TvType.LG)
        return null
    }

    // ---------------- mDNS (Android TV / Google TV) ----------------
    private suspend fun nsd(seconds: Int, found: (TvDevice) -> Unit) {
        val nsd = ctx.getSystemService(Context.NSD_SERVICE) as NsdManager
        val queue = Channel<NsdServiceInfo>(Channel.UNLIMITED)
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {}
            override fun onDiscoveryStopped(serviceType: String) {}
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
            override fun onServiceLost(serviceInfo: NsdServiceInfo) {}
            override fun onServiceFound(serviceInfo: NsdServiceInfo) { queue.trySend(serviceInfo) }
        }
        try {
            nsd.discoverServices("_androidtvremote2._tcp", NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (e: Exception) {
            return
        }
        withTimeoutOrNull(seconds * 1000L) {
            for (info in queue) {
                val r = resolve(nsd, info) ?: continue
                val ip = r.host?.hostAddress ?: continue
                if (ip.contains(':')) continue
                found(TvDevice(r.serviceName ?: "Android TV", ip, TvType.ANDROID))
            }
        }
        runCatching { nsd.stopServiceDiscovery(listener) }
    }

    @Suppress("DEPRECATION")
    private suspend fun resolve(nsd: NsdManager, info: NsdServiceInfo): NsdServiceInfo? =
        withTimeoutOrNull(3000) {
            suspendCancellableCoroutine { cont ->
                try {
                    nsd.resolveService(info, object : NsdManager.ResolveListener {
                        override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                            if (cont.isActive) cont.resume(null)
                        }
                        override fun onServiceResolved(serviceInfo: NsdServiceInfo) {
                            if (cont.isActive) cont.resume(serviceInfo)
                        }
                    })
                } catch (e: Exception) {
                    if (cont.isActive) cont.resume(null)
                }
            }
        }
}

package com.marck.controletv

import android.util.Base64
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.math.BigInteger
import java.net.Socket
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.Principal
import java.security.PrivateKey
import java.security.SecureRandom
import java.security.Signature
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.security.spec.PKCS8EncodedKeySpec
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLEngine
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.X509ExtendedKeyManager

/**
 * Certificado próprio do app. O Android TV lembra dele depois do pareamento,
 * então ele é criado uma vez e fica guardado no celular.
 */
class ClientCert(store: Store) {
    val key: PrivateKey
    val cert: X509Certificate

    init {
        val k = store.get("atv_key")
        val c = store.get("atv_cert")
        if (k != null && c != null) {
            key = KeyFactory.getInstance("RSA").generatePrivate(PKCS8EncodedKeySpec(Base64.decode(k, Base64.NO_WRAP)))
            cert = parseCert(Base64.decode(c, Base64.NO_WRAP))
        } else {
            val kp = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
            key = kp.private
            cert = parseCert(selfSigned(kp.public.encoded, kp.private))
            store.put("atv_key", Base64.encodeToString(key.encoded, Base64.NO_WRAP))
            store.put("atv_cert", Base64.encodeToString(cert.encoded, Base64.NO_WRAP))
        }
    }

    val socketFactory: SSLSocketFactory by lazy {
        val km = object : X509ExtendedKeyManager() {
            override fun getClientAliases(t: String?, i: Array<out Principal>?) = arrayOf("c")
            override fun chooseClientAlias(t: Array<out String>?, i: Array<out Principal>?, s: Socket?) = "c"
            override fun chooseEngineClientAlias(t: Array<out String>?, i: Array<out Principal>?, e: SSLEngine?) = "c"
            override fun getServerAliases(t: String?, i: Array<out Principal>?): Array<String>? = null
            override fun chooseServerAlias(t: String?, i: Array<out Principal>?, s: Socket?): String? = null
            override fun getCertificateChain(alias: String?) = arrayOf(cert)
            override fun getPrivateKey(alias: String?) = key
        }
        SSLContext.getInstance("TLS").apply { init(arrayOf(km), arrayOf(Net.trustAll), SecureRandom()) }.socketFactory
    }

    private fun parseCert(der: ByteArray) =
        CertificateFactory.getInstance("X.509").generateCertificate(ByteArrayInputStream(der)) as X509Certificate

    // ---- Montagem do certificado (DER) ----
    private fun der(tag: Int, content: ByteArray): ByteArray {
        val o = ByteArrayOutputStream()
        o.write(tag)
        val n = content.size
        when {
            n < 128 -> o.write(n)
            n < 256 -> { o.write(0x81); o.write(n) }
            else -> { o.write(0x82); o.write(n shr 8); o.write(n and 0xFF) }
        }
        o.write(content)
        return o.toByteArray()
    }

    private fun seq(vararg parts: ByteArray) = der(0x30, parts.fold(ByteArray(0)) { a, b -> a + b })

    private fun utc(d: Date): ByteArray {
        val f = SimpleDateFormat("yyMMddHHmmss'Z'", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
        return der(0x17, f.format(d).toByteArray())
    }

    private fun selfSigned(spki: ByteArray, priv: PrivateKey): ByteArray {
        val sha256Rsa = seq(
            byteArrayOf(0x06, 0x09, 0x2A, 0x86.toByte(), 0x48, 0x86.toByte(), 0xF7.toByte(), 0x0D, 0x01, 0x01, 0x0B),
            byteArrayOf(0x05, 0x00),
        )
        val name = seq(der(0x31, seq(byteArrayOf(0x06, 0x03, 0x55, 0x04, 0x03), der(0x0C, "atvremote".toByteArray()))))
        val now = Date(System.currentTimeMillis() - 86_400_000L)
        val end = Date(now.time + 3650L * 86_400_000L)
        val tbs = seq(
            der(0xA0, der(0x02, byteArrayOf(2))),
            der(0x02, BigInteger.valueOf(System.currentTimeMillis()).toByteArray()),
            sha256Rsa,
            name,
            seq(utc(now), utc(end)),
            name,
            spki,
        )
        val sig = Signature.getInstance("SHA256withRSA").run { initSign(priv); update(tbs); sign() }
        return seq(tbs, sha256Rsa, der(0x03, byteArrayOf(0) + sig))
    }
}

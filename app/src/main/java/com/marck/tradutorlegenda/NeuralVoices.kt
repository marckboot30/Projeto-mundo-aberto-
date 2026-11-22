package com.marck.tradutorlegenda

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.PlaybackParams
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsVitsModelConfig
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.LinkedBlockingDeque
import java.util.zip.ZipInputStream

/** Vozes de IA que funcionam sem internet (Piper, via sherpa-onnx). */
enum class VoiceKind(val dir: String, val zip: String, val label: String) {
    MALE("vits-piper-pt_BR-miro-high", "voz-masculina.zip", "Masculina (Miro)"),
    FEMALE("vits-piper-pt_BR-dii-high", "voz-feminina.zip", "Feminina (Dii)")
}

object NeuralVoices {
    private const val BASE =
        "https://github.com/marckboot30/Projeto-mundo-aberto-/releases/download/vozes/"

    private fun root(ctx: Context) = File(ctx.filesDir, "vozes")
    private fun dir(ctx: Context, k: VoiceKind) = File(root(ctx), k.dir)

    private fun modelFile(ctx: Context, k: VoiceKind): File? =
        dir(ctx, k).listFiles()?.firstOrNull { it.name.endsWith(".onnx") }

    fun isInstalled(ctx: Context, k: VoiceKind): Boolean =
        File(dir(ctx, k), ".ok").exists() && modelFile(ctx, k) != null

    /** Baixa e instala a voz. Roda numa thread separada. Retorna mensagem de erro ou null. */
    fun download(ctx: Context, k: VoiceKind, onProgress: (Int) -> Unit): String? {
        val tmp = File(ctx.cacheDir, k.zip)
        try {
            var url = URL(BASE + k.zip)
            var conn: HttpURLConnection
            var redirects = 0
            while (true) {
                conn = url.openConnection() as HttpURLConnection
                conn.instanceFollowRedirects = false
                conn.connectTimeout = 20000
                conn.readTimeout = 30000
                val code = conn.responseCode
                if (code in 300..399 && redirects < 6) {
                    val loc = conn.getHeaderField("Location") ?: return "Erro no download"
                    url = URL(url, loc)
                    redirects++
                    conn.disconnect()
                    continue
                }
                if (code != 200) return "Erro no download ($code)"
                break
            }
            val total = conn.contentLengthLong
            conn.inputStream.use { input ->
                FileOutputStream(tmp).use { out ->
                    val buf = ByteArray(64 * 1024)
                    var done = 0L
                    var lastPct = -1
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        done += n
                        if (total > 0) {
                            val pct = (done * 100 / total).toInt()
                            if (pct != lastPct) { lastPct = pct; onProgress(pct) }
                        }
                    }
                }
            }
            // descompacta
            val base = root(ctx)
            dir(ctx, k).deleteRecursively()
            base.mkdirs()
            val canon = base.canonicalPath
            ZipInputStream(tmp.inputStream().buffered()).use { zin ->
                while (true) {
                    val e = zin.nextEntry ?: break
                    val f = File(base, e.name)
                    if (!f.canonicalPath.startsWith(canon)) continue
                    if (e.isDirectory) { f.mkdirs(); continue }
                    f.parentFile?.mkdirs()
                    FileOutputStream(f).use { zin.copyTo(it) }
                }
            }
            if (modelFile(ctx, k) == null) return "Arquivo da voz incompleto"
            File(dir(ctx, k), ".ok").writeText("ok")
            return null
        } catch (e: Exception) {
            return "Sem internet ou download interrompido"
        } finally {
            tmp.delete()
        }
    }

    fun delete(ctx: Context, k: VoiceKind) {
        dir(ctx, k).deleteRecursively()
    }

    fun createEngine(ctx: Context, k: VoiceKind): OfflineTts? {
        val m = modelFile(ctx, k) ?: return null
        val d = dir(ctx, k)
        return try {
            OfflineTts(
                config = OfflineTtsConfig(
                    model = OfflineTtsModelConfig(
                        vits = OfflineTtsVitsModelConfig(
                            model = m.absolutePath,
                            tokens = File(d, "tokens.txt").absolutePath,
                            dataDir = File(d, "espeak-ng-data").absolutePath
                        ),
                        numThreads = 2,
                        debug = false,
                        provider = "cpu"
                    ),
                    maxNumSentences = 1
                )
            )
        } catch (_: Throwable) {
            null
        }
    }
}

/**
 * Fala textos com as vozes de IA, uma frase por vez, numa thread própria.
 */
class NeuralSpeaker(
    private val ctx: Context,
    private val onStart: () -> Unit = {},
    private val onDone: () -> Unit = {}
) {
    private class Job(val text: String, val kind: VoiceKind, val speed: Float, val pitch: Float)

    private val queue = LinkedBlockingDeque<Job>()
    private val engines = HashMap<VoiceKind, OfflineTts>()
    @Volatile private var running = true
    @Volatile private var cancel = false
    @Volatile var busy = false
        private set
    private var track: AudioTrack? = null
    private var trackRate = 0

    val pending: Int get() = queue.size + (if (busy) 1 else 0)

    private val worker = Thread({ loop() }, "voz-ia").apply { start() }

    fun speak(text: String, kind: VoiceKind, speed: Float, pitch: Float, flush: Boolean) {
        if (flush) stopAll()
        queue.offer(Job(text, kind, speed, pitch))
    }

    fun stopAll() {
        queue.clear()
        cancel = true
        try { track?.pause(); track?.flush() } catch (_: Exception) {}
    }

    /** Carrega a voz antes (para a primeira frase não demorar). */
    fun preload(kind: VoiceKind) {
        Thread { synchronized(engines) { engineFor(kind) } }.start()
    }

    private fun engineFor(kind: VoiceKind): OfflineTts? {
        engines[kind]?.let { return it }
        val e = NeuralVoices.createEngine(ctx, kind) ?: return null
        engines[kind] = e
        return e
    }

    private fun loop() {
        while (running) {
            val job = try { queue.take() } catch (_: InterruptedException) { break }
            if (!running) break
            busy = true
            cancel = false
            try {
                val eng = synchronized(engines) { engineFor(job.kind) }
                if (eng != null && !cancel) {
                    val audio = eng.generate(job.text, 0, job.speed)
                    if (!cancel && audio.samples.isNotEmpty()) {
                        onStart()
                        play(audio.samples, audio.sampleRate, job.pitch)
                    }
                }
            } catch (_: Throwable) {
            } finally {
                busy = false
                if (queue.isEmpty()) onDone()
            }
        }
    }

    private fun play(samples: FloatArray, rate: Int, pitch: Float) {
        if (track == null || trackRate != rate) {
            track?.release()
            val min = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT)
            track = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
                        .setSampleRate(rate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(maxOf(min, rate)) // ~0,25 s
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()
            trackRate = rate
        }
        val t = track ?: return
        // tom (grossa/fina) sem mudar a velocidade
        try {
            t.playbackParams = PlaybackParams().setPitch(pitch.coerceIn(0.5f, 2.0f)).setSpeed(1.0f)
        } catch (_: Exception) {}
        t.play()
        var off = 0
        val chunk = rate / 10
        while (off < samples.size && !cancel) {
            val n = minOf(chunk, samples.size - off)
            val w = t.write(samples, off, n, AudioTrack.WRITE_BLOCKING)
            if (w <= 0) break
            off += w
        }
        if (!cancel) {
            // espera terminar de tocar
            val endFrames = samples.size
            var waited = 0
            while (!cancel && waited < 4000) {
                val pos = try { t.playbackHeadPosition } catch (_: Exception) { endFrames }
                if (pos >= endFrames) break
                Thread.sleep(20); waited += 20
            }
        }
        try { t.stop(); t.flush() } catch (_: Exception) {}
        // AudioTrack conta posição desde o início: recria a cada frase
        try { t.release() } catch (_: Exception) {}
        track = null
    }

    fun release() {
        running = false
        stopAll()
        worker.interrupt()
        synchronized(engines) {
            engines.values.forEach { try { it.release() } catch (_: Throwable) {} }
            engines.clear()
        }
        try { track?.release() } catch (_: Exception) {}
        track = null
    }
}

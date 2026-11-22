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
 * Fala textos com as vozes de IA.
 * Duas threads: uma gera o áudio, outra toca. Assim, enquanto um pedaço toca,
 * o próximo já está sendo gerado (começa a falar mais rápido).
 */
class NeuralSpeaker(
    private val ctx: Context,
    private val onStart: () -> Unit = {},
    private val onDone: () -> Unit = {}
) {
    private class Job(val text: String, val kind: VoiceKind, val speed: Float, val pitch: Float, val epoch: Int)
    private class Clip(val samples: FloatArray, val rate: Int, val pitch: Float, val epoch: Int, val last: Boolean)

    private val genQueue = LinkedBlockingDeque<Job>()
    private val playQueue = LinkedBlockingDeque<Clip>()
    private val engines = HashMap<VoiceKind, OfflineTts>()
    private val epoch = java.util.concurrent.atomic.AtomicInteger(0)
    private val sentences = java.util.concurrent.atomic.AtomicInteger(0)
    @Volatile private var running = true
    @Volatile private var track: AudioTrack? = null

    /** Quantas frases ainda vão ser faladas. */
    val pending: Int get() = sentences.get()

    private val generator = Thread({ genLoop() }, "voz-ia-gera").apply { start() }
    private val player = Thread({ playLoop() }, "voz-ia-toca").apply { start() }

    fun speak(text: String, kind: VoiceKind, speed: Float, pitch: Float, flush: Boolean) {
        if (flush) stopAll()
        sentences.incrementAndGet()
        genQueue.offer(Job(text, kind, speed, pitch, epoch.get()))
    }

    fun stopAll() {
        epoch.incrementAndGet()
        genQueue.clear()
        playQueue.clear()
        sentences.set(0)
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

    // corta a frase em pedaços (vírgula, ponto...) para começar a falar antes
    private fun chunks(text: String): List<String> {
        val parts = text.split(Regex("(?<=[.!?;:,])\\s+")).map { it.trim() }.filter { it.isNotEmpty() }
        val out = ArrayList<String>()
        var acc = ""
        for (p in parts) {
            acc = if (acc.isEmpty()) p else "$acc $p"
            if (acc.split(" ").size >= 3) { out.add(acc); acc = "" }
        }
        if (acc.isNotEmpty()) {
            if (out.isEmpty()) out.add(acc) else out[out.size - 1] = out.last() + " " + acc
        }
        return out.ifEmpty { listOf(text) }
    }

    private fun genLoop() {
        while (running) {
            val job = try { genQueue.take() } catch (_: InterruptedException) { break }
            if (job.epoch != epoch.get()) continue
            val pieces = chunks(job.text)
            var sentLast = false
            try {
                val eng = synchronized(engines) { engineFor(job.kind) }
                if (eng != null) {
                    for ((i, piece) in pieces.withIndex()) {
                        if (job.epoch != epoch.get()) break
                        val audio = synchronized(engines) { eng.generate(piece, 0, job.speed) }
                        if (job.epoch != epoch.get()) break
                        val last = i == pieces.size - 1
                        playQueue.offer(Clip(audio.samples, audio.sampleRate, job.pitch, job.epoch, last))
                        if (last) sentLast = true
                    }
                }
            } catch (_: Throwable) {
            }
            if (!sentLast && job.epoch == epoch.get()) {
                // falhou: avisa o player para descontar a frase
                playQueue.offer(Clip(FloatArray(0), 22050, 1f, job.epoch, true))
            }
        }
    }

    private fun playLoop() {
        var speaking = false
        while (running) {
            val clip = try {
                playQueue.poll(150, java.util.concurrent.TimeUnit.MILLISECONDS)
            } catch (_: InterruptedException) { break }
            if (clip == null) {
                if (speaking && sentences.get() == 0) { speaking = false; onDone() }
                continue
            }
            if (clip.epoch != epoch.get()) continue
            if (clip.samples.isNotEmpty()) {
                if (!speaking) { speaking = true; onStart() }
                try { play(clip) } catch (_: Throwable) {}
            }
            if (clip.last && clip.epoch == epoch.get()) {
                if (sentences.decrementAndGet() < 0) sentences.set(0)
            }
            if (sentences.get() == 0 && playQueue.isEmpty() && speaking) { speaking = false; onDone() }
        }
    }

    private fun play(clip: Clip) {
        val rate = clip.rate
        val min = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT)
        val t = AudioTrack.Builder()
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
        track = t
        val myEpoch = clip.epoch
        try {
            // tom (grossa/fina) sem mudar a velocidade
            try {
                t.playbackParams = PlaybackParams().setPitch(clip.pitch.coerceIn(0.5f, 2.0f)).setSpeed(1.0f)
            } catch (_: Exception) {}
            t.play()
            val samples = clip.samples
            var off = 0
            val chunk = rate / 20
            while (off < samples.size && myEpoch == epoch.get()) {
                val n = minOf(chunk, samples.size - off)
                val w = t.write(samples, off, n, AudioTrack.WRITE_BLOCKING)
                if (w <= 0) break
                off += w
            }
            var waited = 0
            while (myEpoch == epoch.get() && waited < 4000) {
                val pos = try { t.playbackHeadPosition } catch (_: Exception) { samples.size }
                if (pos >= samples.size) break
                Thread.sleep(10); waited += 10
            }
        } finally {
            track = null
            try { t.stop() } catch (_: Exception) {}
            try { t.release() } catch (_: Exception) {}
        }
    }

    fun release() {
        running = false
        stopAll()
        generator.interrupt()
        player.interrupt()
        synchronized(engines) {
            engines.values.forEach { try { it.release() } catch (_: Throwable) {} }
            engines.clear()
        }
    }
}

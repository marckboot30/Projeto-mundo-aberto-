package com.marck.tradutorlegenda

import android.annotation.SuppressLint
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.projection.MediaProjection
import android.os.Build
import android.os.Process
import android.os.SystemClock
import kotlin.math.sqrt

/**
 * Escuta o som que está tocando no celular (o vídeo) e mede o tom da voz.
 * Voz grave (< ~160 Hz) = homem, voz aguda (> ~175 Hz) = mulher.
 * Precisa de Android 10+ e o app do vídeo precisa permitir captura de áudio.
 */
class PitchTracker(private val projection: MediaProjection) {

    enum class Gender { MALE, FEMALE }

    private val rate = 16000
    private val frame = 1024
    @Volatile private var running = false
    private var record: AudioRecord? = null
    private var thread: Thread? = null

    private val times = LongArray(200)
    private val pitches = FloatArray(200)
    private var count = 0
    private var idx = 0
    private val lock = Any()

    @Volatile var hearingSomething = false
        private set

    @SuppressLint("MissingPermission")
    fun start(): Boolean {
        if (Build.VERSION.SDK_INT < 29) return false
        return try {
            val cfg = AudioPlaybackCaptureConfiguration.Builder(projection)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                .excludeUid(Process.myUid()) // não escuta a própria voz traduzida
                .build()
            val fmt = AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(rate)
                .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                .build()
            val minBuf = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
            val r = AudioRecord.Builder()
                .setAudioFormat(fmt)
                .setBufferSizeInBytes(maxOf(minBuf, frame * 4))
                .setAudioPlaybackCaptureConfig(cfg)
                .build()
            if (r.state != AudioRecord.STATE_INITIALIZED) {
                r.release(); return false
            }
            record = r
            r.startRecording()
            running = true
            thread = Thread({ loop() }, "pitch").apply { start() }
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun loop() {
        val buf = ShortArray(frame)
        val x = FloatArray(frame)
        while (running) {
            val r = record ?: break
            val n = r.read(buf, 0, frame)
            if (n < frame) continue
            var sum = 0.0
            for (i in 0 until frame) {
                x[i] = buf[i] / 32768f
                sum += x[i] * x[i]
            }
            val rms = sqrt(sum / frame)
            if (rms > 0.002) hearingSomething = true
            if (rms < 0.01) continue // silêncio
            val p = detectPitch(x)
            if (p > 0) {
                synchronized(lock) {
                    times[idx] = SystemClock.elapsedRealtime()
                    pitches[idx] = p
                    idx = (idx + 1) % times.size
                    if (count < times.size) count++
                }
            }
        }
    }

    // Autocorrelação normalizada, procura tom entre 70 e 350 Hz
    private fun detectPitch(x: FloatArray): Float {
        val minLag = rate / 350
        val maxLag = rate / 70
        var e0 = 0f
        for (v in x) e0 += v * v
        if (e0 <= 0f) return -1f
        var bestLag = -1
        var best = 0f
        val corr = FloatArray(maxLag + 2)
        for (lag in minLag..maxLag) {
            var c = 0f
            var i = 0
            val end = x.size - lag
            while (i < end) { c += x[i] * x[i + lag]; i++ }
            corr[lag] = c / e0
        }
        for (lag in minLag + 1 until maxLag) {
            val c = corr[lag]
            if (c > corr[lag - 1] && c >= corr[lag + 1] && c > best) {
                best = c; bestLag = lag
            }
        }
        if (bestLag < 0 || best < 0.45f) return -1f // não é voz clara
        // evita pegar o dobro do período (erro de oitava): prefere o 1º pico forte
        for (lag in minLag + 1 until bestLag) {
            if (corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1] && corr[lag] > best * 0.85f) {
                bestLag = lag; break
            }
        }
        return rate.toFloat() / bestLag
    }

    /** Quem falou nos últimos [windowMs] milissegundos (null = não deu pra saber). */
    fun recentGender(windowMs: Long = 3500): Gender? {
        val now = SystemClock.elapsedRealtime()
        val list = ArrayList<Float>()
        synchronized(lock) {
            for (i in 0 until count) {
                if (now - times[i] <= windowMs) list.add(pitches[i])
            }
        }
        if (list.size < 4) return null
        list.sort()
        val median = list[list.size / 2]
        return when {
            median < 162f -> Gender.MALE
            median > 172f -> Gender.FEMALE
            else -> null
        }
    }

    fun stop() {
        running = false
        try { record?.stop() } catch (_: Exception) {}
        try { thread?.join(300) } catch (_: Exception) {}
        record?.release()
        record = null
    }
}

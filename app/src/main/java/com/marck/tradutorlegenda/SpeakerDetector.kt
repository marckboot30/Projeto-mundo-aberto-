package com.marck.tradutorlegenda

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.SystemClock
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceContour
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import java.util.concurrent.Executor
import kotlin.math.max
import kotlin.math.min

/**
 * TESTE: olha a imagem do vídeo (sem áudio) e tenta saber quem está falando.
 *  1. acha o rosto principal na tela
 *  2. vê se a boca está mexendo
 *  3. estima se o rosto é de homem ou mulher
 */
class SpeakerDetector(ctx: Context, private val exec: Executor) {

    enum class Gender { MALE, FEMALE }

    private val detector = FaceDetection.getClient(
        FaceDetectorOptions.Builder()
            .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
            .setContourMode(FaceDetectorOptions.CONTOUR_MODE_ALL)
            .setMinFaceSize(0.12f)
            .build()
    )

    private val interpreter: Interpreter? = try {
        Interpreter(loadModel(ctx, "model_gender_q.tflite"), Interpreter.Options().setNumThreads(2))
    } catch (_: Throwable) { null }

    private val input = ByteBuffer.allocateDirect(1 * 128 * 128 * 3 * 4).order(ByteOrder.nativeOrder())
    private val output = Array(1) { FloatArray(2) }
    private val pixels = IntArray(128 * 128)

    private class Obs(val t: Long, val mouth: Float, val male: Float)
    private val history = ArrayDeque<Obs>()
    private val lock = Any()

    @Volatile var busy = false
        private set

    private fun loadModel(ctx: Context, name: String): MappedByteBuffer {
        val fd = ctx.assets.openFd(name)
        FileInputStream(fd.fileDescriptor).use { fis ->
            return fis.channel.map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
        }
    }

    /** Recebe a tela (pequena) e analisa. Recicla o bitmap no final. */
    fun process(frame: Bitmap) {
        if (busy) { frame.recycle(); return }
        busy = true
        detector.process(InputImage.fromBitmap(frame, 0))
            .addOnSuccessListener(exec) { faces ->
                try { analyze(frame, faces) } catch (_: Throwable) {}
            }
            .addOnCompleteListener(exec) {
                frame.recycle()
                busy = false
            }
    }

    private fun analyze(frame: Bitmap, faces: List<Face>) {
        val now = SystemClock.elapsedRealtime()
        val face = faces.maxByOrNull { it.boundingBox.width() * it.boundingBox.height() }
        if (face == null) {
            add(Obs(now, -1f, -1f))
            return
        }
        val box = face.boundingBox
        val h = max(1, box.height()).toFloat()

        // abertura da boca (distância entre lábio de cima e de baixo / altura do rosto)
        val upper = face.getContour(FaceContour.UPPER_LIP_BOTTOM)?.points
        val lower = face.getContour(FaceContour.LOWER_LIP_TOP)?.points
        val mouth = if (upper != null && lower != null && upper.isNotEmpty() && lower.isNotEmpty()) {
            val uy = upper.map { it.y }.average().toFloat()
            val ly = lower.map { it.y }.average().toFloat()
            max(0f, ly - uy) / h
        } else -1f

        // homem ou mulher
        val male = classify(frame, box)
        add(Obs(now, mouth, male))
    }

    private fun classify(frame: Bitmap, box: Rect): Float {
        val itp = interpreter ?: return -1f
        val padW = (box.width() * 0.1f).toInt()
        val padH = (box.height() * 0.1f).toInt()
        val l = max(0, box.left - padW)
        val t = max(0, box.top - padH)
        val r = min(frame.width, box.right + padW)
        val b = min(frame.height, box.bottom + padH)
        if (r - l < 16 || b - t < 16) return -1f
        val crop = Bitmap.createBitmap(frame, l, t, r - l, b - t)
        val small = Bitmap.createScaledBitmap(crop, 128, 128, true)
        if (crop !== small && crop !== frame) crop.recycle()
        small.getPixels(pixels, 0, 128, 0, 0, 128, 128)
        if (small !== frame) small.recycle()
        input.rewind()
        for (p in pixels) {
            input.putFloat(((p shr 16) and 0xFF) / 255f)
            input.putFloat(((p shr 8) and 0xFF) / 255f)
            input.putFloat((p and 0xFF) / 255f)
        }
        input.rewind()
        itp.run(input, output)
        val m = output[0][0]
        val f = output[0][1]
        val sum = m + f
        return if (sum > 0f) m / sum else -1f // 1 = homem, 0 = mulher
    }

    private fun add(o: Obs) {
        synchronized(lock) {
            history.addLast(o)
            while (history.size > 40) history.removeFirst()
        }
    }

    /** Quem está falando agora? null = não deu para saber. */
    fun currentSpeaker(windowMs: Long = 1800): Gender? {
        val now = SystemClock.elapsedRealtime()
        val recent = synchronized(lock) { history.filter { now - it.t <= windowMs } }
        if (recent.size < 2) return null
        val withFace = recent.filter { it.male >= 0f }
        // rosto precisa aparecer na maior parte do tempo
        if (withFace.size < recent.size * 0.6f) return null
        val mouths = withFace.map { it.mouth }.filter { it >= 0f }
        val moving = mouths.size >= 2 && (mouths.maxOrNull()!! - mouths.minOrNull()!!) > 0.025f
        if (!moving) return null
        val avg = withFace.map { it.male }.average()
        return when {
            avg > 0.6 -> Gender.MALE
            avg < 0.4 -> Gender.FEMALE
            else -> null
        }
    }

    fun close() {
        try { detector.close() } catch (_: Throwable) {}
        try { interpreter?.close() } catch (_: Throwable) {}
    }
}

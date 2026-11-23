package com.marck.tradutorlegenda

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.drawable.GradientDrawable
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.util.TypedValue
import android.view.Display
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Caixa de leitura: só o que está dentro dela é lido.
 *  - moldura branca (o meio é transparente para não esconder a legenda)
 *  - ✥ em cima à esquerda: arrastar a caixa
 *  - ⤡ embaixo à direita: mudar o tamanho
 *  - contorno verde: o que o app acabou de reconhecer
 */
class ReadBox(private val ctx: Context, start: RectF, private val onChanged: (RectF) -> Unit) {

    private val wm = ctx.getSystemService(WindowManager::class.java)
    private val handler = Handler(Looper.getMainLooper())
    private val frac = RectF(start) // posição em fração da tela (0..1)

    private var frame: View? = null
    private var hilite: View? = null
    private var moveH: TextView? = null
    private var sizeH: TextView? = null
    private val pFrame = params(false)
    private val pHilite = params(false)
    private val pMove = params(true)
    private val pSize = params(true)
    private val hideHilite = Runnable { hilite?.visibility = View.GONE }

    private fun dp(v: Int) = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), ctx.resources.displayMetrics
    ).toInt()

    fun screenW(): Int = real().widthPixels
    fun screenH(): Int = real().heightPixels

    private fun real(): DisplayMetrics {
        val m = DisplayMetrics()
        @Suppress("DEPRECATION")
        ctx.getSystemService(DisplayManager::class.java).getDisplay(Display.DEFAULT_DISPLAY).getRealMetrics(m)
        return m
    }

    /** Fração da tela coberta pela caixa (para cortar a imagem capturada). */
    fun fraction(): RectF = RectF(frac)

    private fun params(touchable: Boolean): WindowManager.LayoutParams {
        var flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        if (!touchable) flags = flags or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
        return WindowManager.LayoutParams(
            1, 1,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            flags,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.START }
    }

    private class FrameView(ctx: Context, private val stroke: Float, private val color: Int, dashed: Boolean) : View(ctx) {
        private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = stroke
            this.color = color
            if (dashed) pathEffect = DashPathEffect(floatArrayOf(stroke * 4, stroke * 3), 0f)
        }
        override fun onDraw(c: Canvas) {
            val h = stroke / 2
            c.drawRoundRect(h, h, width - h, height - h, stroke * 3, stroke * 3, paint)
        }
    }

    private fun handle(text: String) = TextView(ctx).apply {
        this.text = text
        textSize = 18f
        gravity = Gravity.CENTER
        setTextColor(Color.BLACK)
        background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.argb(235, 255, 255, 255))
            setStroke(dp(2), Color.argb(200, 0, 0, 0))
        }
    }

    fun show() {
        if (frame != null) return
        frame = FrameView(ctx, dp(2).toFloat(), Color.argb(220, 255, 255, 255), true)
        hilite = FrameView(ctx, dp(3).toFloat(), Color.argb(230, 40, 220, 120), false).apply { visibility = View.GONE }
        moveH = handle("✥")
        sizeH = handle("⤡")
        try {
            wm.addView(frame, pFrame)
            wm.addView(hilite, pHilite)
            wm.addView(moveH, pMove)
            wm.addView(sizeH, pSize)
        } catch (_: Exception) {}
        moveH?.setOnTouchListener(Drag(resize = false))
        sizeH?.setOnTouchListener(Drag(resize = true))
        layout()
    }

    /** Recalcula as posições (também quando o celular gira). */
    fun layout() {
        val w = screenW().toFloat(); val h = screenH().toFloat()
        val l = (frac.left * w).roundToInt(); val t = (frac.top * h).roundToInt()
        val r = (frac.right * w).roundToInt(); val b = (frac.bottom * h).roundToInt()
        pFrame.x = l; pFrame.y = t; pFrame.width = max(1, r - l); pFrame.height = max(1, b - t)
        val hs = dp(40)
        pMove.width = hs; pMove.height = hs
        pMove.x = l - hs / 2; pMove.y = t - hs - dp(2)
        pSize.width = hs; pSize.height = hs
        pSize.x = r - hs / 2; pSize.y = b + dp(2)
        update(frame, pFrame); update(moveH, pMove); update(sizeH, pSize)
    }

    private fun update(v: View?, p: WindowManager.LayoutParams) {
        if (v == null) return
        try { wm.updateViewLayout(v, p) } catch (_: Exception) {}
    }

    /** Mostra o contorno verde em volta do que foi reconhecido (coordenadas da tela). */
    fun highlight(r: Rect) {
        val v = hilite ?: return
        val pad = dp(6)
        pHilite.x = r.left - pad; pHilite.y = r.top - pad
        pHilite.width = max(1, r.width() + pad * 2); pHilite.height = max(1, r.height() + pad * 2)
        update(v, pHilite)
        v.visibility = View.VISIBLE
        handler.removeCallbacks(hideHilite)
        handler.postDelayed(hideHilite, 1500)
    }

    fun remove() {
        handler.removeCallbacks(hideHilite)
        listOf(frame, hilite, moveH, sizeH).forEach { v ->
            if (v != null) try { wm.removeView(v) } catch (_: Exception) {}
        }
        frame = null; hilite = null; moveH = null; sizeH = null
    }

    private inner class Drag(private val resize: Boolean) : View.OnTouchListener {
        private var lx = 0f
        private var ly = 0f
        override fun onTouch(v: View, e: MotionEvent): Boolean {
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> { lx = e.rawX; ly = e.rawY }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (e.rawX - lx) / screenW()
                    val dy = (e.rawY - ly) / screenH()
                    lx = e.rawX; ly = e.rawY
                    if (resize) {
                        frac.right = min(1f, max(frac.left + 0.08f, frac.right + dx))
                        frac.bottom = min(1f, max(frac.top + 0.04f, frac.bottom + dy))
                    } else {
                        val w = frac.width(); val h = frac.height()
                        val nl = min(1f - w, max(0f, frac.left + dx))
                        val nt = min(1f - h, max(0f, frac.top + dy))
                        frac.set(nl, nt, nl + w, nt + h)
                    }
                    layout()
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> onChanged(RectF(frac))
            }
            return true
        }
    }
}

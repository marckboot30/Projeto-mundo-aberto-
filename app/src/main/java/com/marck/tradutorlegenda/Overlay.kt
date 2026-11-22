package com.marck.tradutorlegenda

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.TextView
import kotlin.math.abs

/**
 * Janelas por cima dos outros apps:
 *  - bolinha flutuante: toque = pausar/continuar, segurar = desligar
 *  - caixa com a legenda traduzida (arrastável)
 * Usam FLAG_SECURE para não aparecerem na captura de tela
 * (assim o app não tenta ler a própria tradução).
 */
class Overlay(
    private val ctx: Context,
    private val onToggle: () -> Unit,
    private val onStop: () -> Unit
) {
    private val wm = ctx.getSystemService(WindowManager::class.java)
    private val handler = Handler(Looper.getMainLooper())
    private var bubble: TextView? = null
    private var sub: TextView? = null
    private var subParams: WindowManager.LayoutParams? = null
    private val hideSub = Runnable { sub?.visibility = View.GONE }

    private fun dp(v: Int) = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), ctx.resources.displayMetrics
    ).toInt()

    fun allowed() = Settings.canDrawOverlays(ctx)

    private fun params(w: Int, h: Int, gravity: Int, x: Int, y: Int) =
        WindowManager.LayoutParams(
            w, h,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_SECURE,
            PixelFormat.TRANSLUCENT
        ).apply {
            this.gravity = gravity
            this.x = x
            this.y = y
        }

    // ---------- Bolinha ----------

    fun showBubble() {
        if (!allowed() || bubble != null) return
        val size = dp(54)
        val tv = TextView(ctx).apply {
            text = "🎧"
            textSize = 22f
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.argb(230, 29, 185, 84))
                setStroke(dp(2), Color.WHITE)
            }
            elevation = dp(6).toFloat()
        }
        val lp = params(size, size, Gravity.TOP or Gravity.START, dp(8), dp(180))
        tv.setOnTouchListener(Dragger(lp, tv, horizontal = true, onClick = onToggle, onLongClick = onStop))
        try {
            wm.addView(tv, lp)
            bubble = tv
        } catch (_: Exception) {}
    }

    fun setPaused(paused: Boolean) {
        val b = bubble ?: return
        b.text = if (paused) "⏸" else "🎧"
        (b.background as? GradientDrawable)?.setColor(
            if (paused) Color.argb(230, 120, 120, 120) else Color.argb(230, 29, 185, 84)
        )
        if (paused) hideSubtitle()
    }

    // ---------- Legenda traduzida ----------

    fun showSubtitle(text: String) {
        if (!allowed()) return
        if (sub == null) {
            val tv = TextView(ctx).apply {
                setTextColor(Color.WHITE)
                textSize = 18f
                gravity = Gravity.CENTER
                setShadowLayer(4f, 0f, 0f, Color.BLACK)
                setPadding(dp(14), dp(8), dp(14), dp(8))
                background = GradientDrawable().apply {
                    cornerRadius = dp(12).toFloat()
                    setColor(Color.argb(200, 0, 0, 0))
                }
            }
            val lp = params(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                Gravity.TOP or Gravity.CENTER_HORIZONTAL, 0, dp(36)
            ).apply { horizontalMargin = 0.04f }
            tv.setOnTouchListener(Dragger(lp, tv, horizontal = false, onClick = { hideSubtitle() }, onLongClick = {}))
            try {
                wm.addView(tv, lp)
                sub = tv
                subParams = lp
            } catch (_: Exception) {
                return
            }
        }
        val s = sub ?: return
        s.text = text
        s.visibility = View.VISIBLE
        handler.removeCallbacks(hideSub)
        handler.postDelayed(hideSub, 5000L + text.length * 50L)
    }

    fun hideSubtitle() {
        handler.removeCallbacks(hideSub)
        sub?.visibility = View.GONE
    }

    fun removeAll() {
        handler.removeCallbacks(hideSub)
        listOf(bubble, sub).forEach { v ->
            if (v != null) try { wm.removeView(v) } catch (_: Exception) {}
        }
        bubble = null
        sub = null
    }

    // ---------- Arrastar / tocar / segurar ----------

    private inner class Dragger(
        private val lp: WindowManager.LayoutParams,
        private val view: View,
        private val horizontal: Boolean,
        private val onClick: () -> Unit,
        private val onLongClick: () -> Unit
    ) : View.OnTouchListener {
        private val slop = ViewConfiguration.get(ctx).scaledTouchSlop
        private var downX = 0f
        private var downY = 0f
        private var startX = 0
        private var startY = 0
        private var moved = false
        private var longDone = false
        private val longPress = Runnable {
            if (!moved) {
                longDone = true
                onLongClick()
            }
        }

        override fun onTouch(v: View, e: MotionEvent): Boolean {
            when (e.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = e.rawX; downY = e.rawY
                    startX = lp.x; startY = lp.y
                    moved = false; longDone = false
                    handler.postDelayed(longPress, 700)
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = e.rawX - downX
                    val dy = e.rawY - downY
                    if (!moved && (abs(dx) > slop || abs(dy) > slop)) {
                        moved = true
                        handler.removeCallbacks(longPress)
                    }
                    if (moved) {
                        if (horizontal) lp.x = startX + dx.toInt()
                        lp.y = startY + dy.toInt()
                        try { wm.updateViewLayout(view, lp) } catch (_: Exception) {}
                    }
                }
                MotionEvent.ACTION_UP -> {
                    handler.removeCallbacks(longPress)
                    if (!moved && !longDone) onClick()
                }
                MotionEvent.ACTION_CANCEL -> handler.removeCallbacks(longPress)
            }
            return true
        }
    }
}

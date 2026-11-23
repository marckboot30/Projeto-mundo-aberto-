package com.marck.controletv

import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
        )
        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = Palette.Accent1,
                    secondary = Palette.Accent2,
                    background = Palette.Bg1,
                    surface = Palette.Card,
                    onSurface = Color.White,
                    onBackground = Color.White,
                )
            ) {
                App(viewModel())
            }
        }
    }
}

@Composable
fun App(vm: RemoteViewModel) {
    val ctx = LocalContext.current
    LaunchedEffect(vm.toast) {
        vm.toast?.let {
            Toast.makeText(ctx, it, Toast.LENGTH_SHORT).show()
            vm.toast = null
        }
    }
    Box(
        Modifier
            .fillMaxSize()
            .background(Palette.background)
            .systemBarsPadding()
    ) {
        val tv = vm.current
        if (tv != null && vm.conn == Conn.Connected) {
            BackHandler { vm.cancel() }
            RemoteScreen(vm, tv)
        } else {
            TvListScreen(vm)
        }
        when (val c = vm.conn) {
            is Conn.Connecting -> ConnectingDialog(vm.current, c.msg, onCancel = vm::cancel)
            is Conn.NeedCode -> CodeDialog(c.error, onSubmit = vm::submitCode, onCancel = vm::cancel)
            is Conn.Failed -> FailedDialog(c.msg, onRetry = vm::retry, onCancel = vm::cancel)
            else -> {}
        }
    }
}

package com.marck.controletv

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.VolumeOff
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Dialpad
import androidx.compose.material.icons.rounded.FastForward
import androidx.compose.material.icons.rounded.FastRewind
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Input
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.KeyboardArrowLeft
import androidx.compose.material.icons.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.KeyboardArrowUp
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.PowerSettingsNew
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Remove
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Tv
import androidx.compose.material.icons.rounded.Wifi
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.view.HapticFeedbackConstants
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

object Palette {
    val Bg1 = Color(0xFF0E0F1F)
    val Bg2 = Color(0xFF1A1B3A)
    val Card = Color(0xFF22244A)
    val CardHi = Color(0xFF2D3060)
    val Accent1 = Color(0xFF7C5CFF)
    val Accent2 = Color(0xFF3FA9F5)
    val Power = Color(0xFFFF4D6A)
    val Muted = Color(0xFF9EA3C7)
    val background = Brush.verticalGradient(listOf(Bg1, Bg2))
    val accent = Brush.linearGradient(listOf(Accent1, Accent2))
}

// ======================= Lista de TVs =======================

@Composable
fun TvListScreen(vm: RemoteViewModel) {
    var showAdd by remember { mutableStateOf(false) }
    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item { Column {
            Spacer(Modifier.height(12.dp))
            Box(
                Modifier.size(64.dp).clip(RoundedCornerShape(20.dp)).background(Palette.accent),
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Rounded.Tv, null, tint = Color.White, modifier = Modifier.size(34.dp)) }
            Spacer(Modifier.height(16.dp))
            Text("Controle TV", fontSize = 32.sp, fontWeight = FontWeight.Bold, color = Color.White)
            Text(
                "Escolha sua TV. O celular e a TV precisam estar no mesmo Wi-Fi.",
                color = Palette.Muted, fontSize = 15.sp,
            )
            Spacer(Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.Wifi, null, tint = Palette.Accent2, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    if (vm.scanning) "Procurando TVs na rede…" else "${vm.tvs.size} TV(s) encontrada(s)",
                    color = Color.White, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f),
                )
                if (vm.scanning) {
                    CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.5.dp, color = Palette.Accent2)
                } else {
                    TextButton(onClick = vm::scan) {
                        Icon(Icons.Rounded.Refresh, null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Procurar de novo")
                    }
                }
            }
        } }
        items(vm.tvs, key = { it.id }) { tv ->
            TvCard(tv, onClick = { vm.select(tv) }, onForget = { vm.forget(tv) })
        }
        if (!vm.scanning && vm.tvs.isEmpty()) {
            item {
                Text(
                    "Nenhuma TV apareceu. Confira se ela está ligada e no mesmo Wi-Fi, ou adicione pelo número IP da TV (fica em Configurações > Rede na TV).",
                    color = Palette.Muted, fontSize = 14.sp,
                )
            }
        }
        item {
            Button(
                onClick = { showAdd = true },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Palette.Card, contentColor = Color.White),
            ) {
                Icon(Icons.Rounded.Add, null)
                Spacer(Modifier.width(8.dp))
                Text("Adicionar TV pelo IP")
            }
        }
    }
    if (showAdd) AddTvDialog(onDismiss = { showAdd = false }) { ip, type ->
        showAdd = false
        vm.addManual(ip, type)
    }
}

@Composable
private fun TvCard(tv: TvDevice, onClick: () -> Unit, onForget: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Palette.Card)
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(Palette.CardHi),
            contentAlignment = Alignment.Center,
        ) { Icon(Icons.Rounded.Tv, null, tint = Palette.Accent2) }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(tv.name, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${tv.type.label} · ${tv.ip}", color = Palette.Muted, fontSize = 13.sp)
        }
        Icon(
            Icons.Rounded.Close, "Esquecer", tint = Palette.Muted,
            modifier = Modifier.size(36.dp).clip(CircleShape).clickable(onClick = onForget).padding(8.dp),
        )
    }
}

@Composable
private fun AddTvDialog(onDismiss: () -> Unit, onAdd: (String, TvType) -> Unit) {
    var ip by remember { mutableStateOf("192.168.") }
    var type by remember { mutableStateOf(TvType.ANDROID) }
    val valid = Regex("""\d{1,3}(\.\d{1,3}){3}""").matches(ip.trim())
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Palette.Bg2,
        title = { Text("Adicionar TV") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = ip, onValueChange = { ip = it }, singleLine = true,
                    label = { Text("IP da TV") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                Text("Marca / sistema da TV:", color = Palette.Muted)
                TvType.entries.forEach { t ->
                    FilterChip(selected = type == t, onClick = { type = t }, label = { Text(t.label) })
                }
            }
        },
        confirmButton = { TextButton(enabled = valid, onClick = { onAdd(ip, type) }) { Text("Conectar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}

// ======================= Diálogos de conexão =======================

@Composable
fun ConnectingDialog(tv: TvDevice?, msg: String, onCancel: () -> Unit) {
    AlertDialog(
        onDismissRequest = {},
        containerColor = Palette.Bg2,
        title = { Text(tv?.name ?: "Conectando") },
        text = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(28.dp), color = Palette.Accent2)
                Spacer(Modifier.width(16.dp))
                Text(msg)
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onCancel) { Text("Cancelar") } },
    )
}

@Composable
fun CodeDialog(error: String?, onSubmit: (String) -> Unit, onCancel: () -> Unit) {
    var code by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = {},
        containerColor = Palette.Bg2,
        title = { Text("Código da TV") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Apareceu um código de 6 letras/números na tela da TV. Digite ele aqui:")
                OutlinedTextField(
                    value = code,
                    onValueChange = { v -> code = v.uppercase().filter { it in "0123456789ABCDEF" }.take(6) },
                    singleLine = true,
                    textStyle = androidx.compose.ui.text.TextStyle(fontSize = 28.sp, letterSpacing = 6.sp, textAlign = TextAlign.Center, color = Color.White),
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, keyboardType = KeyboardType.Ascii),
                    isError = error != null,
                )
                if (error != null) Text(error, color = Palette.Power, fontSize = 14.sp)
            }
        },
        confirmButton = { TextButton(enabled = code.length == 6, onClick = { onSubmit(code) }) { Text("Parear") } },
        dismissButton = { TextButton(onClick = onCancel) { Text("Cancelar") } },
    )
}

@Composable
fun FailedDialog(msg: String, onRetry: () -> Unit, onCancel: () -> Unit) {
    AlertDialog(
        onDismissRequest = onCancel,
        containerColor = Palette.Bg2,
        title = { Text("Não conectou") },
        text = { Text(msg) },
        confirmButton = { TextButton(onClick = onRetry) { Text("Tentar de novo") } },
        dismissButton = { TextButton(onClick = onCancel) { Text("Escolher outra TV") } },
    )
}

// ======================= Controle =======================

@Composable
fun RemoteScreen(vm: RemoteViewModel, tv: TvDevice) {
    var showNumbers by remember { mutableStateOf(false) }
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 22.dp, vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Topo: ligar/desligar, nome da TV, fonte
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            RBtn(onClick = { vm.press(Key.POWER) }, size = 52.dp, bg = Palette.Power.copy(alpha = 0.18f)) {
                Icon(Icons.Rounded.PowerSettingsNew, "Ligar/desligar", tint = Palette.Power)
            }
            Column(
                Modifier.weight(1f).clip(RoundedCornerShape(14.dp)).clickable { vm.cancel() }.padding(8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(tv.name, color = Color.White, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(7.dp).clip(CircleShape).background(Color(0xFF3DDC97)))
                    Spacer(Modifier.width(5.dp))
                    Text("Conectado · trocar TV", color = Palette.Muted, fontSize = 12.sp)
                }
            }
            RBtn(onClick = { vm.press(Key.INPUT) }, size = 52.dp) {
                Icon(Icons.Rounded.Input, "Fonte", tint = Color.White)
            }
        }

        Spacer(Modifier.height(26.dp))
        DPad(vm)
        Spacer(Modifier.height(24.dp))

        // Voltar, início, menu
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            LabeledBtn(Icons.AutoMirrored.Rounded.ArrowBack, "Voltar") { vm.press(Key.BACK) }
            LabeledBtn(Icons.Rounded.Home, "Início") { vm.press(Key.HOME) }
            LabeledBtn(Icons.Rounded.Menu, "Menu") { vm.press(Key.MENU) }
            LabeledBtn(Icons.Rounded.Settings, "Ajustes") { vm.press(Key.SETTINGS) }
        }

        Spacer(Modifier.height(24.dp))

        // Volume | mídia | canal
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Rocker("VOL", onUp = { vm.press(Key.VOL_UP) }, onDown = { vm.press(Key.VOL_DOWN) }, upIcon = Icons.Rounded.Add, downIcon = Icons.Rounded.Remove)
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                RBtn(onClick = { vm.press(Key.PLAY_PAUSE) }, size = 64.dp, brush = Palette.accent) {
                    Icon(Icons.Rounded.PlayArrow, "Play/Pause", tint = Color.White, modifier = Modifier.size(32.dp))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    RBtn(onClick = { vm.press(Key.REWIND) }, size = 48.dp, repeat = true) { Icon(Icons.Rounded.FastRewind, "Voltar", tint = Color.White) }
                    RBtn(onClick = { vm.press(Key.FORWARD) }, size = 48.dp, repeat = true) { Icon(Icons.Rounded.FastForward, "Avançar", tint = Color.White) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    RBtn(onClick = { vm.press(Key.MUTE) }, size = 48.dp) { Icon(Icons.AutoMirrored.Rounded.VolumeOff, "Mudo", tint = Color.White) }
                    RBtn(
                        onClick = { showNumbers = !showNumbers }, size = 48.dp,
                        bg = if (showNumbers) Palette.Accent1 else Palette.Card,
                    ) { Icon(Icons.Rounded.Dialpad, "Números", tint = Color.White) }
                }
            }
            Rocker("CH", onUp = { vm.press(Key.CH_UP) }, onDown = { vm.press(Key.CH_DOWN) }, upIcon = Icons.Rounded.KeyboardArrowUp, downIcon = Icons.Rounded.KeyboardArrowDown)
        }

        if (showNumbers) {
            Spacer(Modifier.height(20.dp))
            NumberPad { vm.press(Key.digit(it)) }
        }

        val apps = vm.apps
        if (apps.isNotEmpty()) {
            Spacer(Modifier.height(26.dp))
            Text("Abrir app", color = Palette.Muted, fontSize = 13.sp, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(10.dp))
            LazyRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(apps) { app ->
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(app.color)
                            .clickable { vm.launch(app) }
                            .padding(horizontal = 18.dp, vertical = 14.dp),
                    ) { Text(app.label, color = app.text, fontWeight = FontWeight.Bold) }
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

@Composable
private fun DPad(vm: RemoteViewModel) {
    Box(
        Modifier
            .size(270.dp)
            .shadow(24.dp, CircleShape, ambientColor = Palette.Accent1, spotColor = Palette.Accent1)
            .clip(CircleShape)
            .background(Brush.radialGradient(listOf(Palette.CardHi, Palette.Card)))
            .border(BorderStroke(1.5.dp, Brush.linearGradient(listOf(Palette.Accent1.copy(alpha = 0.7f), Palette.Accent2.copy(alpha = 0.4f)))), CircleShape),
    ) {
        val arrow = 76.dp
        RBtn({ vm.press(Key.UP) }, Modifier.align(Alignment.TopCenter).padding(top = 6.dp), size = arrow, bg = Color.Transparent, repeat = true) {
            Icon(Icons.Rounded.KeyboardArrowUp, "Cima", tint = Color.White, modifier = Modifier.size(40.dp))
        }
        RBtn({ vm.press(Key.DOWN) }, Modifier.align(Alignment.BottomCenter).padding(bottom = 6.dp), size = arrow, bg = Color.Transparent, repeat = true) {
            Icon(Icons.Rounded.KeyboardArrowDown, "Baixo", tint = Color.White, modifier = Modifier.size(40.dp))
        }
        RBtn({ vm.press(Key.LEFT) }, Modifier.align(Alignment.CenterStart).padding(start = 6.dp), size = arrow, bg = Color.Transparent, repeat = true) {
            Icon(Icons.Rounded.KeyboardArrowLeft, "Esquerda", tint = Color.White, modifier = Modifier.size(40.dp))
        }
        RBtn({ vm.press(Key.RIGHT) }, Modifier.align(Alignment.CenterEnd).padding(end = 6.dp), size = arrow, bg = Color.Transparent, repeat = true) {
            Icon(Icons.Rounded.KeyboardArrowRight, "Direita", tint = Color.White, modifier = Modifier.size(40.dp))
        }
        RBtn({ vm.press(Key.OK) }, Modifier.align(Alignment.Center), size = 104.dp, brush = Palette.accent) {
            Text("OK", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 24.sp)
        }
    }
}

@Composable
private fun LabeledBtn(icon: ImageVector, label: String, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        RBtn(onClick = onClick, size = 58.dp) { Icon(icon, label, tint = Color.White) }
        Spacer(Modifier.height(6.dp))
        Text(label, color = Palette.Muted, fontSize = 12.sp)
    }
}

@Composable
private fun Rocker(label: String, onUp: () -> Unit, onDown: () -> Unit, upIcon: ImageVector, downIcon: ImageVector) {
    Column(
        Modifier.width(72.dp).clip(RoundedCornerShape(36.dp)).background(Palette.Card).padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        RBtn(onClick = onUp, size = 64.dp, bg = Color.Transparent, repeat = true) { Icon(upIcon, "$label +", tint = Color.White, modifier = Modifier.size(30.dp)) }
        Text(label, color = Palette.Muted, fontWeight = FontWeight.Bold, fontSize = 13.sp, modifier = Modifier.padding(vertical = 10.dp))
        RBtn(onClick = onDown, size = 64.dp, bg = Color.Transparent, repeat = true) { Icon(downIcon, "$label -", tint = Color.White, modifier = Modifier.size(30.dp)) }
    }
}

@Composable
private fun NumberPad(onDigit: (Int) -> Unit) {
    val rows = listOf(listOf(1, 2, 3), listOf(4, 5, 6), listOf(7, 8, 9), listOf(-1, 0, -1))
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        rows.forEach { r ->
            Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                r.forEach { d ->
                    if (d < 0) Spacer(Modifier.size(64.dp))
                    else RBtn(onClick = { onDigit(d) }, size = 64.dp) {
                        Text("$d", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

/** Botão redondo com vibração leve, animação ao apertar e repetição ao segurar. */
@Composable
fun RBtn(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    size: Dp = 56.dp,
    shape: Shape = CircleShape,
    bg: Color = Palette.Card,
    brush: Brush? = null,
    repeat: Boolean = false,
    content: @Composable BoxScope.() -> Unit,
) {
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    val click by rememberUpdatedState(onClick)
    var pressed by remember { mutableStateOf(false) }
    val scale by animateFloatAsState(if (pressed) 0.88f else 1f, label = "press")
    Box(
        modifier
            .size(size)
            .scale(scale)
            .clip(shape)
            .then(if (brush != null) Modifier.background(brush) else Modifier.background(if (pressed && bg == Color.Transparent) Color.White.copy(alpha = 0.08f) else bg))
            .pointerInput(repeat) {
                detectTapGestures(onPress = {
                    pressed = true
                    view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                    click()
                    val job = if (repeat) scope.launch {
                        delay(450)
                        while (isActive) {
                            click()
                            view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                            delay(140)
                        }
                    } else null
                    tryAwaitRelease()
                    job?.cancel()
                    pressed = false
                })
            },
        contentAlignment = Alignment.Center,
        content = content,
    )
}

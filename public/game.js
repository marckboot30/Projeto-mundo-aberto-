// Últimos Dias — sobrevivência zumbi 3D (three.js), celular e navegador.
// Jogo mais próximo: Project Zomboid; este difere em câmera atrás do personagem, mapa compacto em 3 zonas e partidas curtas.
(function () {
'use strict';
const T = THREE;
const DT = 1 / 30;
const PI = Math.PI;
const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window);
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rr = (a, b) => a + Math.random() * (b - a);
function seeded(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let wr = seeded(20261116); // aleatório do mundo (fixo, para o save funcionar)

// ---------------------------------------------------------------- itens
const ITEMS = {
  lata:     { n: 'Lata de feijão', p: .5, t: 'comida', fome: 35 },
  chips:    { n: 'Batata chips', p: .2, t: 'comida', fome: 15, sede: -5 },
  maca:     { n: 'Maçã', p: .2, t: 'comida', fome: 12, sede: 4 },
  cenoura:  { n: 'Cenoura', p: .15, t: 'comida', fome: 10, sede: 2 },
  agua:     { n: 'Garrafa de água', p: 1, t: 'bebida', sede: 45, vira: 'vazia' },
  refri:    { n: 'Refrigerante', p: .4, t: 'bebida', sede: 25, fome: 3 },
  vazia:    { n: 'Garrafa vazia', p: .2, t: 'material' },
  pano:     { n: 'Pano', p: .1, t: 'material' },
  curativo: { n: 'Curativo', p: .1, t: 'cura' },
  tabua:    { n: 'Tábua', p: 1.5, t: 'material' },
  pregos:   { n: 'Pregos', p: .02, t: 'material' },
  tronco:   { n: 'Tronco', p: 4, t: 'material' },
  fosforos: { n: 'Fósforos', p: .1, t: 'material' },
  lanterna: { n: 'Lanterna', p: .5, t: 'ferramenta' },
  municao:  { n: 'Munição', p: .02, t: 'material' },
  taco:     { n: 'Taco', p: 2, t: 'arma', dano: 26, alc: 1.9, cd: .7, dur: 60 },
  faca:     { n: 'Faca', p: .5, t: 'arma', dano: 17, alc: 1.45, cd: .4, dur: 45 },
  machado:  { n: 'Machado', p: 3, t: 'arma', dano: 42, alc: 1.85, cd: 1.0, dur: 80 },
  feijaoq:  { n: 'Feijão quente', p: .5, t: 'comida', fome: 50 },
  pecabra:  { n: 'Pé de cabra', p: 2.2, t: 'arma', dano: 30, alc: 1.7, cd: .75, dur: 110 },
  corda:    { n: 'Corda', p: .5, t: 'material' },
  espingarda: { n: 'Espingarda', p: 3.2, t: 'arma', dano: 95, alc: 16, cd: 1.15, dur: 9999, tiro: true, ammo: 'cartucho', alto: 1.4 },
  cartucho: { n: 'Cartucho', p: .05, t: 'material' },
  carnecrua: { n: 'Carne crua', p: .5, t: 'comida', fome: 12, crua: true },
  carneassada: { n: 'Carne assada', p: .5, t: 'comida', fome: 45 },
  ovo:      { n: 'Ovo', p: .1, t: 'comida', fome: 8 },
  galinha:  { n: 'Galinha', p: 1.8, t: 'animal' },
  vela:     { n: 'Vela de ignição', p: .1, t: 'peca' },
  bateria:  { n: 'Bateria de carro', p: 8, t: 'peca' },
  pneu:     { n: 'Pneu', p: 7, t: 'peca' },
  galao:    { n: 'Galão vazio', p: .5, t: 'material' },
  galaocheio: { n: 'Galão de gasolina', p: 4, t: 'material' },
  pistola:  { n: 'Pistola', p: 1, t: 'arma', dano: 60, alc: 25, cd: .45, dur: 9999, tiro: true },
};
const PUNCH = { n: 'Soco', dano: 6, alc: 1.35, cd: .6 };
const LOOT = {
  armario:   [['lata', .35], ['chips', .35], ['pano', .5, 1, 2], ['agua', .25], ['fosforos', .2], ['pregos', .15, 2, 6], ['faca', .08], ['refri', .2], ['vazia', .2]],
  geladeira: [['maca', .6, 1, 3], ['refri', .45], ['agua', .45], ['lata', .15]],
  mercado:   [['lata', .6, 1, 3], ['chips', .6, 1, 3], ['refri', .5, 1, 2], ['agua', .5, 1, 2], ['maca', .3, 1, 2], ['fosforos', .2]],
  posto:     [['refri', .6, 1, 2], ['chips', .6, 1, 2], ['fosforos', .4], ['agua', .4], ['pano', .3, 1, 2], ['galao', .45], ['vela', .2], ['bateria', .08]],
  farmacia:  [['curativo', .7, 1, 2], ['pano', .6, 1, 3], ['curativo', .4]],
  delegacia: [['pistola', .3], ['municao', .7, 6, 14], ['taco', .25], ['curativo', .35], ['espingarda', .06], ['cartucho', .2, 2, 6]],
  ferragens: [['pregos', .8, 6, 16], ['tabua', .6, 1, 3], ['machado', .3], ['fosforos', .35], ['vela', .35], ['bateria', .15], ['galao', .3]],
  celeiro:   [['machado', .25], ['tabua', .6, 1, 3], ['pregos', .5, 4, 10], ['pano', .3], ['corda', .35], ['pecabra', .1]],
  estante:   [['pano', .3], ['fosforos', .25], ['curativo', .1]],
  rack:      [['fosforos', .3], ['pano', .3], ['municao', .04, 2, 4], ['pregos', .1, 2, 4]],
  mesacentro:[['chips', .3], ['refri', .2]],
  mesa:      [['maca', .3, 1, 2], ['lata', .15], ['refri', .15]],
  vaso:      [['fosforos', .04]],
  gaveta:    [['curativo', .15], ['pano', .3], ['municao', .05, 2, 5]],
  prisao:    [['pistola', .25], ['espingarda', .12], ['municao', .6, 6, 16], ['cartucho', .35, 2, 8], ['taco', .2], ['faca', .2], ['curativo', .3]],
  bombeiros: [['machado', .55], ['pecabra', .5], ['corda', .6, 1, 2], ['curativo', .4], ['pano', .4, 1, 3], ['agua', .3]],
  hospital:  [['curativo', .8, 1, 3], ['pano', .6, 1, 4], ['agua', .3]],
  armazem:   [['bateria', .2], ['pneu', .2], ['vela', .2], ['galao', .25], ['pregos', .7, 5, 20], ['tabua', .6, 2, 5], ['pecabra', .15], ['corda', .3], ['machado', .12], ['fosforos', .2]],
  cabana:    [['machado', .3], ['corda', .4], ['fosforos', .5], ['lata', .4], ['faca', .2], ['tabua', .3, 1, 2]],
  ninho:     [['ovo', .75, 1, 3]],
  tora:      [['tronco', 1, 1, 2]],
  lixeira:   [['vazia', .3], ['pano', .15], ['chips', .1], ['refri', .08]],
  correio:   [['pano', .05], ['curativo', .03]],
  carro:     [['agua', .3], ['pano', .3], ['pregos', .2, 2, 5], ['taco', .08], ['chips', .3], ['municao', .06, 3, 6], ['pneu', .12], ['galao', .12], ['vela', .08]],
};
function rollLoot(table) {
  const out = [];
  for (const [id, ch, a, b] of LOOT[table]) if (wr() < ch) itemAdd(out, id, a ? a + Math.floor(wr() * (b - a + 1)) : 1);
  return out;
}
function itemAdd(list, id, q, d) {
  const it = ITEMS[id];
  if (it.t === 'arma') { for (let i = 0; i < q; i++) list.push({ id, q: 1, d: d != null ? d : it.dur }); return; }
  const e = list.find(e => e.id === id);
  if (e) e.q += q; else list.push({ id, q });
}
function itemRemove(list, id, q) {
  for (let i = list.length - 1; i >= 0 && q > 0; i--) {
    const e = list[i]; if (e.id !== id) continue;
    const k = Math.min(q, e.q); e.q -= k; q -= k;
    if (e.q <= 0) { if (P.arma === e) P.arma = null; list.splice(i, 1); }
  }
}
const pesoMax = () => C('pesoMax') + (P && P.mochila ? 10 : 0);
const count = (id) => P.inv.reduce((s, e) => s + (e.id === id ? e.q : 0), 0);
const weight = (list) => list.reduce((s, e) => s + ITEMS[e.id].p * e.q, 0);

// ---------------------------------------------------------------- render
const renderer = new T.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.3 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.id = 'c3d'; $('view').appendChild(renderer.domElement);
const scene = new T.Scene();
const ISO_YAW = PI / 4, ISO_PITCH = 0.66, ISO_DIST = 60; // visão de cima, na diagonal
let viewH = isTouch ? 15 : 20; // metros visíveis na altura da tela (zoom)
const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 200);
function updateCamProj() { const a = innerWidth / innerHeight; camera.left = -viewH * a / 2; camera.right = viewH * a / 2; camera.top = viewH / 2; camera.bottom = -viewH / 2; camera.updateProjectionMatrix(); }
updateCamProj();
scene.fog = new T.Fog(0x8a9590, 25, 70);
scene.background = new T.Color(0x8a9590);
const hemi = new T.HemisphereLight(0xcfd8e0, 0x3a3a2a, 1.5); scene.add(hemi); hemi.layers.enableAll();
const sun = new T.DirectionalLight(0xfff0d8, 2); sun.position.set(40, 80, 20); scene.add(sun);
const flash = new T.SpotLight(0xfff2d0, 0, 26, 0.5, 0.55, 1); scene.add(flash); scene.add(flash.target);
[sun, flash].forEach(l => l.layers.enableAll());
const aura = new T.PointLight(0xa8b8e0, 0, 9, 1); scene.add(aura); aura.layers.enableAll(); // enxergar um pouco em volta à noite
const fillL = new T.PointLight(0xfff2e0, 0, 6, 1.2); scene.add(fillL); fillL.layers.enableAll(); // realça o jogador
const muzzle = new T.PointLight(0xffd080, 0, 14, 1); scene.add(muzzle); muzzle.layers.enableAll();
const fireLights = [0, 1, 2].map(() => { const l = new T.PointLight(0xff8a30, 0, 16, 1); scene.add(l); l.layers.enableAll(); return l; });
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); updateCamProj(); });

const SHADOWS = !isTouch;
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
if (SHADOWS) {
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  sun.castShadow = true; sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 140 });
  sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.03; scene.add(sun.target);
}

// texturas desenhadas em código (sem arquivos de imagem)
function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t;
}
const rnd8 = seeded(77);
function speckle(g, s, base, n, a, b, size) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) { const v = a + rnd8() * (b - a); g.fillStyle = `rgba(${v},${v},${v},${.08 + rnd8() * .12})`; const z = size * (.5 + rnd8()); g.fillRect(rnd8() * s, rnd8() * s, z, z); }
}
const TEX = {
  grama: canvasTex(256, (g, s) => { speckle(g, s, '#c8d6b0', 2600, 40, 255, 3); g.strokeStyle = 'rgba(40,70,20,.25)'; for (let i = 0; i < 500; i++) { const x = rnd8() * s, y = rnd8() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd8() * 3 - 1.5, y - 3 - rnd8() * 4); g.stroke(); } }),
  asfalto: canvasTex(256, (g, s) => speckle(g, s, '#d0d0d0', 4000, 0, 255, 2)),
  calcada: canvasTex(128, (g, s) => { speckle(g, s, '#e8e8e2', 800, 80, 255, 2); g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 2; g.strokeRect(1, 1, s - 2, s - 2); }),
  terra: canvasTex(256, (g, s) => speckle(g, s, '#d8c8a8', 3000, 30, 255, 3)),
  concreto: canvasTex(256, (g, s) => { speckle(g, s, '#dcdcd8', 2500, 60, 255, 3); g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 2; g.strokeRect(0, 0, s, s); }),
  tabuas: canvasTex(128, (g, s) => { g.fillStyle = '#e8e2d8'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 16) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, y, s, 2); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, y + 2, s, 1); } speckle2(g, s); }),
  tijolo: canvasTex(128, (g, s) => { g.fillStyle = '#d8d0c8'; g.fillRect(0, 0, s, s); const bh = 16, bw = 32; for (let r = 0; r < s / bh; r++) for (let c = -1; c < s / bw + 1; c++) { const v = 200 + rnd8() * 55; g.fillStyle = `rgb(${v},${v * .93},${v * .88})`; g.fillRect(c * bw + (r % 2) * bw / 2 + 2, r * bh + 2, bw - 3, bh - 3); } }),
  madeira: canvasTex(128, (g, s) => { g.fillStyle = '#e0d4c0'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 21) { g.fillStyle = 'rgba(60,30,10,.3)'; g.fillRect(x, 0, 2, s); } for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(80,50,20,.12)'; g.fillRect(rnd8() * s, rnd8() * s, 1, 10 + rnd8() * 20); } }),
  piso: canvasTex(128, (g, s) => { g.fillStyle = '#ede9e0'; g.fillRect(0, 0, s, s); g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2; for (let i = 0; i <= s; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); } }),
  pintura: canvasTex(128, (g, s) => { g.fillStyle = '#f2f2f0'; g.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++) { const v = 200 + rnd8() * 55; g.fillStyle = `rgba(${v},${v},${v},.08)`; g.fillRect(rnd8() * s, rnd8() * s, 3, 3); } }),
  papel: canvasTex(128, (g, s) => { g.fillStyle = '#f4f0e8'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 16) { g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(x, 0, 6, s); } for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(120,90,60,.08)'; g.beginPath(); g.arc((i * 37) % s, (i * 53) % s, 3, 0, 7); g.fill(); } }),
  telha: canvasTex(128, (g, s) => { g.fillStyle = '#ddd'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 12) for (let x = -(y % 24 ? 8 : 0); x < s; x += 16) { const v = 190 + rnd8() * 65; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.arc(x + 8, y + 12, 8, PI, 0); g.fill(); } }),
};
function speckle2(g, s) { for (let i = 0; i < 300; i++) { const v = rnd8() * 255; g.fillStyle = `rgba(${v},${v},${v},.05)`; g.fillRect(rnd8() * s, rnd8() * s, 2, 2); } }
const boxG = new T.BoxGeometry(1, 1, 1);
const matCache = {};
const M = (c, tex) => { const k = c + (tex || ''); return matCache[k] || (matCache[k] = new T.MeshLambertMaterial({ color: c, map: tex ? TEX[tex] : null })); };
function shade(m, cast) { if (SHADOWS) { m.receiveShadow = true; m.castShadow = cast !== false; } return m; }
function box(w, h, d, color, x, y, z, parent) {
  const m = new T.Mesh(boxG, M(color)); m.scale.set(w, h, d); m.position.set(x, y, z);
  (parent || ROOT).add(m); m.matrixAutoUpdate = !!parent; if (!parent) m.updateMatrix(); return shade(m);
}
// caixa com textura em escala do mundo (tile = metros por repetição)
function tbox(w, h, d, color, tex, tile, x, y, z) {
  const g = ownGeo(new T.BoxGeometry(w, h, d)), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  const m = new T.Mesh(g, M(color, tex)); m.position.set(x, y, z); ROOT.add(m); m.matrixAutoUpdate = false; m.updateMatrix(); return shade(m);
}
function plane(w, d, color, x, z, y, tex, tile) {
  const g = ownGeo(new T.PlaneGeometry(w, d));
  if (tex) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile); }
  const m = new T.Mesh(g, M(color, tex)); m.rotation.x = -PI / 2; m.position.set(x, y || 0, z);
  ROOT.add(m); m.matrixAutoUpdate = false; m.updateMatrix(); if (SHADOWS) m.receiveShadow = true; return m;
}

// ---------------------------------------------------------------- colisão
const CELL = 8, grid = new Map(); let stamp = 1;
const gkey = (gx, gz) => gx * 10007 + gz;
function addCol(c) {
  c.on = c.on !== false;
  const x0 = c.r ? c.cx - c.r : c.x0, x1 = c.r ? c.cx + c.r : c.x1, z0 = c.r ? c.cz - c.r : c.z0, z1 = c.r ? c.cz + c.r : c.z1;
  for (let gx = Math.floor(x0 / CELL); gx <= Math.floor(x1 / CELL); gx++)
    for (let gz = Math.floor(z0 / CELL); gz <= Math.floor(z1 / CELL); gz++) {
      const k = gkey(gx, gz); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(c); (c._keys || (c._keys = [])).push(k);
    }
  if (c.lv === undefined && CUR_LV !== null) c.lv = CUR_LV;
  if (CUR) CUR.cols.push(c);
  return c;
}
function near(x, z, out) {
  out.length = 0; stamp++;
  const gx = Math.floor(x / CELL), gz = Math.floor(z / CELL);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const a = grid.get(gkey(gx + i, gz + j)); if (!a) continue;
    for (const c of a) if (c._s !== stamp) { c._s = stamp; out.push(c); }
  }
  return out;
}
const tmpList = [];
function collide(e, r) {
  for (const c of near(e.x, e.z, tmpList)) {
    if (!c.on) continue;
    if (c.lv != null && c.lv !== (e.lv || 0)) continue;
    if (c.r) {
      const dx = e.x - c.cx, dz = e.z - c.cz, rr2 = c.r + r, d2 = dx * dx + dz * dz;
      if (d2 < rr2 * rr2 && d2 > 1e-8) { const d = Math.sqrt(d2); e.x += dx / d * (rr2 - d); e.z += dz / d * (rr2 - d); }
      continue;
    }
    const px = clamp(e.x, c.x0, c.x1), pz = clamp(e.z, c.z0, c.z1);
    const dx = e.x - px, dz = e.z - pz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) { const d = Math.sqrt(d2); e.x += dx / d * (r - d); e.z += dz / d * (r - d); }
      else {
        const l = e.x - c.x0, ri = c.x1 - e.x, t = e.z - c.z0, b = c.z1 - e.z, m = Math.min(l, ri, t, b);
        if (m === l) e.x = c.x0 - r; else if (m === ri) e.x = c.x1 + r; else if (m === t) e.z = c.z0 - r; else e.z = c.z1 + r;
      }
    }
  }
  e.x = clamp(e.x, -HALF, HALF); e.z = clamp(e.z, -HALF, HALF);
}
function pointBlocked(x, z, y, lv) {
  for (const c of near(x, z, tmpList)) {
    if (!c.on || !c.wall || c.r) continue;
    if (c.lv != null && c.lv !== (lv || 0)) continue;
    if (y != null && y > c.h) continue;
    if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return true;
  }
  return false;
}
function losBlocked(x0, z0, x1, z1, lv) {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.6);
  for (let i = 1; i < n; i++) { const t = i / n; if (pointBlocked(lerp(x0, x1, t), lerp(z0, z1, t), undefined, lv)) return true; }
  return false;
}

function mergeGeos(list) {
  const pos = [], nor = [];
  for (const g0 of list) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); return g;
}
// ---------------------------------------------------------------- lote de peças (junta muitas peças em poucos desenhos = leve no celular)
let dr = seeded(4242); // aleatório só da decoração (não mexe no mundo)
const _m4 = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _v = new T.Vector3(), _one = new T.Vector3(1, 1, 1);
class Batch {
  constructor() { this.b = {}; }
  geo(geo, color, tex, x, y, z, ry, rx, rz, sx, sy, sz) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); _v.set(x, y, z);
    _m4.compose(_v, _q, sx ? new T.Vector3(sx, sy, sz) : _one); g.applyMatrix4(_m4);
    const k = color + '|' + (tex || ''); (this.b[k] || (this.b[k] = [])).push(g);
  }
  box(w, h, d, color, x, y, z, ry, tex, tile) {
    const g = new T.BoxGeometry(w, h, d);
    if (tex) { const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let q = 0; q < 4; q++) { const i = f * 4 + q; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); } }
    this.geo(g, color, tex, x, y, z, ry);
  }
  build(cast) {
    const out = [];
    for (const k in this.b) {
      const [c, tex] = k.split('|'), list = this.b[k];
      let n = 0; for (const g of list) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
      for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; }
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nor, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
      geo.computeBoundingSphere(); geo.userData.own = true;
      const m = new T.Mesh(geo, M(+c, tex || null)); m.matrixAutoUpdate = false; ROOT.add(m);
      if (SHADOWS) { m.receiveShadow = true; m.castShadow = cast !== false; }
      out.push(m);
    }
    this.b = {}; return out;
  }
}
let FB = new Batch(); // móveis e detalhes do pedaço
const cylG = new T.CylinderGeometry(.5, .5, 1, 12);
const icoG = new T.IcosahedronGeometry(.5, 1);
// Móvel desenhado em coordenadas locais: frente = +z, centro no chão. ry gira para olhar para dentro do cômodo.
function drawFurn(nome, px, pz, fw, fh, fd, color, ry) {
  const B = FB;
  const L = (lx, ly, lz) => { const c = Math.cos(ry), sn = Math.sin(ry); return [px + lx * c + lz * sn, ly, pz - lx * sn + lz * c]; };
  const bx = (w, h, d, col, lx, ly, lz, tex, tile) => { const [X, Y, Z] = L(lx, ly, lz); B.box(w, h, d, col, X, Y, Z, ry, tex, tile); };
  const cy = (r, h, col, lx, ly, lz, rx) => { const [X, Y, Z] = L(lx, ly, lz); B.geo(cylG, col, null, X, Y, Z, ry, rx || 0, 0, r * 2, h, r * 2); };
  const fx = fw / 2, fz = fd / 2;
  switch (nome) {
    case 'Cama': {
      const blanket = [0x4a6a9a, 0x8a3a3a, 0x3a7a5a, 0x7a5a9a][Math.floor(dr() * 4)];
      bx(fw, .28, fd, 0x7a5236, 0, .24, 0, 'madeira', 1);
      for (const [a, c] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) bx(.08, .12, .08, 0x5a3a24, a * (fx - .06), .06, c * (fz - .06));
      bx(fw - .08, .16, fd - .12, 0xf0ece4, 0, .45, .02);
      bx(fw + .02, .19, fd * .62, blanket, 0, .45, fz - fd * .31);
      bx(fw + .04, .05, fd * .14, blanket, 0, .53, fz - fd * .6);
      bx(fw * .72, .12, .34, 0xffffff, 0, .58, -fz + .32);
      bx(fw + .06, .95, .08, 0x6a4430, 0, .48, -fz + .04, 'madeira', 1);
      bx(fw + .12, .06, .12, 0x5a3a24, 0, .97, -fz + .04);
      break;
    }
    case 'Armário': case 'Guarda-roupa': {
      if (color === 0x4a5058) { drawFurn('Armário de armas', px, pz, fw, fh, fd, color, ry); return; }
      bx(fw, fh - .1, fd, color, 0, (fh - .1) / 2 + .1, 0, 'madeira', 1.2);
      bx(fw + .06, .08, fd + .06, 0x4a3020, 0, fh - .02, 0);
      bx(fw - .04, .1, fd - .04, 0x3a2418, 0, .05, 0);
      for (const sd of [-1, 1]) {
        bx(fw / 2 - .08, fh - .34, .03, 0x8a6244, sd * fw / 4, fh / 2 + .02, fz + .01, 'madeira', 1);
        bx(.03, .22, .04, 0xc8c8c0, sd * .07, fh * .55, fz + .04);
      }
      break;
    }
    case 'Geladeira': {
      bx(fw, fh, fd, 0xeceae6, 0, fh / 2, 0);
      bx(fw - .04, .02, .02, 0x9a9a96, 0, fh * .68, fz + .005);
      bx(.04, .4, .05, 0xb0b0ac, fx - .1, fh * .82, fz + .03);
      bx(.04, .55, .05, 0xb0b0ac, fx - .1, fh * .45, fz + .03);
      bx(fw - .06, .06, fd - .06, 0x6a6a66, 0, .03, 0);
      break;
    }
    case 'Pia': {
      bx(fw, fh - .06, fd - .04, 0xf2efe8, 0, (fh - .06) / 2, -.02);
      for (const sd of [-1, 1]) { bx(fw / 2 - .06, fh - .3, .02, 0xe2ded6, sd * fw / 4, (fh - .06) / 2 + .02, fz - .02); bx(.12, .03, .03, 0xa0a09a, sd * .1, fh - .22, fz); }
      bx(fw + .04, .05, fd + .02, 0x6a6e72, 0, fh - .03, 0);
      bx(fw * .45, .03, fd * .55, 0x2e3236, 0, fh - .001, .02);
      cy(.025, .28, 0xc8c8c8, 0, fh + .14, -fz + .1);
      cy(.02, .18, 0xc8c8c8, 0, fh + .27, -fz + .19, PI / 2);
      break;
    }
    case 'Prateleira': {
      const metal = color, shelves = Math.max(3, Math.round(fh / .5));
      for (const a of [-1, 1]) for (const c of [-1, 1]) bx(.05, fh, .05, 0x5a5e66, a * (fx - .03), fh / 2, c * (fz - .03));
      bx(fw - .04, fh - .1, .03, metal, 0, fh / 2, 0);
      const pal = [0xc0392b, 0xe6b422, 0x2a7ab8, 0x3a9a4a, 0xe07a2a, 0xf0f0f0, 0x8a3a8a];
      for (let i = 0; i < shelves; i++) {
        const y = .08 + i * (fh - .15) / (shelves - 1);
        bx(fw - .04, .04, fd - .02, metal, 0, y, 0);
        if (i === shelves - 1) continue;
        for (const side of [-1, 1]) {
          let xx = -fx + .1;
          while (xx < fx - .12) {
            const pw = .1 + dr() * .14, ph = .12 + dr() * .2;
            if (xx + pw > fx - .06) break;
            if (dr() < .85) bx(pw, ph, fd / 2 - .08, pal[Math.floor(dr() * pal.length)], xx + pw / 2, y + .02 + ph / 2, side * fd / 4);
            xx += pw + .03;
          }
        }
      }
      break;
    }
    case 'Balcão': {
      bx(fw, fh - .06, fd, color, 0, (fh - .06) / 2, 0, 'madeira', 1.2);
      bx(fw + .08, .06, fd + .08, 0xd8d2c4, 0, fh - .03, 0);
      bx(fw - .1, .1, .04, 0x3a2a1e, 0, .05, fz + .01);
      bx(.36, .16, .3, 0x2a2a2e, -fx + .4, fh + .08, 0);
      bx(.3, .2, .03, 0x3a8a6a, -fx + .4, fh + .26, -.1);
      break;
    }
    case 'Armário de armas': {
      bx(fw, fh, fd, 0x4a5462, 0, fh / 2, 0);
      bx(.02, fh - .1, .02, 0x22262c, 0, fh / 2, fz + .005);
      for (const sd of [-1, 1]) {
        for (let i = 0; i < 4; i++) bx(fw / 2 - .25, .025, .02, 0x2a3038, sd * fw / 4, fh - .25 - i * .07, fz + .005);
        bx(.04, .25, .04, 0xb8b8b0, sd * .1, fh * .52, fz + .03);
      }
      break;
    }
    case 'Mesa': {
      bx(fw, .06, fd, color, 0, fh - .03, 0, 'madeira', 1.2);
      for (const sd of [-1, 1]) bx(.06, fh - .06, fd - .1, 0x4a3424, sd * (fx - .06), (fh - .06) / 2, 0);
      bx(.55, .38, .04, 0x1e1e22, -.3, fh + .26, -fz + .35);
      bx(.5, .32, .01, 0x2a5a8a, -.3, fh + .27, -fz + .375);
      bx(.12, .07, .12, 0x1e1e22, -.3, fh + .035, -fz + .32);
      bx(.45, .02, .16, 0x2a2a2e, -.3, fh + .01, -fz + .65);
      bx(.22, .03, .3, 0xf0f0f0, .5, fh + .015, 0);
      break;
    }
    case 'Caixote': {
      bx(fw - .04, fh - .04, fd - .04, 0x9a7448, 0, fh / 2, 0, 'madeira', .7);
      for (const a of [-1, 1]) for (const c of [-1, 1]) bx(.1, fh, .1, 0x6a4a2a, a * (fx - .05), fh / 2, c * (fz - .05));
      for (const y of [.06, fh - .06]) { bx(fw, .08, .1, 0x6a4a2a, 0, y, fz - .05); bx(fw, .08, .1, 0x6a4a2a, 0, y, -fz + .05); bx(.1, .08, fd, 0x6a4a2a, fx - .05, y, 0); bx(.1, .08, fd, 0x6a4a2a, -fx + .05, y, 0); }
      break;
    }
    case 'Elevador': {
      bx(fw + .3, fh + .25, fd, 0xb8bcc2, 0, (fh + .25) / 2, 0);
      for (const sd of [-1, 1]) bx(fw / 2 - .08, fh - .1, .04, 0x9aa2ac, sd * fw / 4, fh / 2, fz + .01);
      bx(.02, fh - .1, .05, 0x5a6068, 0, fh / 2, fz + .02);
      bx(.5, .12, .04, 0x1e1e22, 0, fh + .1, fz + .02); bx(.1, .2, .05, 0x2a2a2e, fx + .25, 1.2, fz + .02);
      break;
    }
    case 'Caixas de correio': {
      bx(fw, fh, fd, 0x8a8e94, 0, fh / 2 + .2, 0);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { bx(fw / 6 - .05, fh / 4 - .06, .02, 0xa8acb2, -fx + (i + .5) * fw / 6, .2 + (j + .5) * fh / 4, fz + .01); bx(.04, .02, .03, 0x3a3a3a, -fx + (i + .5) * fw / 6 + .1, .2 + (j + .5) * fh / 4, fz + .03); }
      break;
    }
    case 'Ninho': {
      bx(fw, .3, fd, 0x8a6a40, 0, .15, 0, 'madeira', .8); bx(fw - .1, .12, fd - .1, 0xd8b85a, 0, .34, 0, 'terra', .6);
      for (let i = 0; i < 3; i++) cy(.05, .08, 0xf4ecd8, -fx + .3 + i * .3, .43, 0);
      break;
    }
    case 'Feno': {
      for (const [ox, oz, hh] of [[-fw / 4, 0, fh * .5], [fw / 4, 0, fh * .5]]) {
        bx(fw / 2 - .05, hh, fd - .05, 0xd8b85a, ox, hh / 2, oz, 'terra', .6);
        bx(fw / 2 - .02, .04, .05, 0x8a6a3a, ox, hh * .6, fz - .3); bx(fw / 2 - .02, .04, .05, 0x8a6a3a, ox, hh * .6, -fz + .3);
      }
      bx(fw / 2 - .05, fh * .45, fd - .3, 0xd0b052, 0, fh * .5 + fh * .22, 0, 'terra', .6);
      break;
    }
    case 'Fogão': {
      bx(fw, fh - .05, fd, 0xe8e6e2, 0, (fh - .05) / 2, 0);
      bx(fw - .1, fh * .5, .02, 0x2a2a2e, 0, fh * .42, fz + .005);
      bx(fw - .2, .03, .03, 0xb0b0ac, 0, fh * .72, fz + .02);
      bx(fw + .02, .04, fd + .02, 0x2a2a2e, 0, fh - .02, 0);
      for (const a of [-1, 1]) for (const c of [-1, 1]) cy(.11, .02, 0x4a4a4e, a * fw / 4, fh + .01, c * fd / 4);
      bx(fw, .25, .05, 0xd8d6d2, 0, fh + .12, -fz + .03);
      break;
    }
    case 'Sofá': {
      const sc = color;
      bx(fw, .42, fd, sc, 0, .25, 0);
      bx(fw - .3, .14, fd - .25, sc, 0, .52, .08);
      for (const a of [-1, 1]) { bx(fw / 2 - .18, .12, fd - .3, 0xffffff & (sc + 0x101010), a * (fw / 4 - .04), .63, .1); bx(.16, .6, fd, sc, a * (fx - .08), .4, 0); }
      bx(fw, .55, .2, sc, 0, .65, -fz + .1);
      bx(.35, .3, .1, 0xe0c060, -fx + .5, .78, -fz + .3, null, null);
      for (const a of [-1, 1]) for (const c of [-1, 1]) bx(.06, .05, .06, 0x2a1e14, a * (fx - .1), .025, c * (fz - .1));
      break;
    }
    case 'TV': {
      bx(fw, .5, fd, 0x5a3e2a, 0, .25, 0, 'madeira', 1);
      bx(fw - .1, .02, .02, 0x2a1e14, 0, .26, fz + .005);
      bx(fw * .75, .5, .05, 0x151518, 0, .82, -.05);
      bx(fw * .72, .46, .01, 0x1e2a3a, 0, .82, -.02);
      bx(.2, .06, .15, 0x151518, 0, .53, -.05);
      break;
    }
    case 'Rack': { // rack baixo de madeira clara com pés inclinados
      bx(fw, .38, fd, 0xd8a868, 0, .36, 0, 'madeira', 1.5);
      for (const a of [-1, 0, 1]) bx(fw / 3 - .04, .3, .02, 0xc89858, a * fw / 3, .36, fz + .005);
      for (const a of [-1, 0, 1]) bx(.12, .02, .02, 0x5a4030, a * fw / 3, .44, fz + .02);
      for (const a of [-1, 1]) for (const c of [-1, 1]) { const [X, Y, Z] = L(a * (fx - .1), .09, c * (fz - .08)); FB.geo(cylG, 0x6a4a30, null, X, Y, Z, ry, c * .25, 0, .04, .2, .04); }
      bx(.16, .12, .03, 0xe8e4dc, -fx + .3, .62, 0); bx(.08, .1, .08, 0x3a8a4a, fx - .3, .6, 0);
      break;
    }
    case 'SofáL': { // sofá em L laranja
      const c = color, cl = 0xffffff & (c + 0x0a0a0a);
      bx(fw, .3, fd, c, 0, .28, 0); bx(fw - .1, .14, fd - .25, cl, 0, .5, .08);
      bx(fw, .5, .22, c, 0, .6, -fz + .11);
      for (const a of [-1, 1]) bx(.18, .45, fd, c, a * (fx - .09), .43, 0);
      bx(.85, .3, .85, c, fx - .43 - .18, .28, fz + .42); bx(.75, .14, .8, cl, fx - .43 - .18, .5, fz + .42);
      bx(.18, .45, .85, c, fx - .09, .43, fz + .42);
      for (const a of [-1, 1]) for (const z2 of [-fz + .1, fz - .1]) bx(.05, .14, .05, 0x5a3e28, a * (fx - .1), .07, z2);
      bx(.05, .14, .05, 0x5a3e28, fx - .1, .07, fz + .78); bx(.05, .14, .05, 0x5a3e28, fx - .95, .07, fz + .78);
      bx(.42, .3, .1, 0x6a8ac8, -fx + .45, .7, -fz + .3); bx(.38, .28, .1, 0xe8a0a0, -fx + .9, .7, -fz + .3);
      break;
    }
    case 'Estante': { // estante de madeira com livros, vasos e gavetas
      const wd = 0xdcb070;
      bx(fw, fh, .04, 0xc89a5a, 0, fh / 2, -fz + .02);
      for (const a of [-1, 1]) bx(.05, fh, fd, wd, a * (fx - .025), fh / 2, 0);
      const ys = [.02, .5, .9, 1.3, fh - .03];
      for (const y of ys) bx(fw, .04, fd, wd, 0, y, 0);
      bx(fw - .1, .44, .02, 0xd0a060, 0, .26, fz - .01); bx(.14, .03, .03, 0x5a4030, 0, .3, fz);
      const bookC = [0x3a6ab0, 0xe0b040, 0x3a9a5a, 0xc04a3a, 0xf0f0e8, 0x7a5aa0];
      for (const y of [.52, .92]) { let xx = -fx + .08; while (xx < fx - .12) { const bw = .04 + dr() * .04, bh2 = .22 + dr() * .12; bx(bw, bh2, fd - .1, bookC[Math.floor(dr() * 6)], xx + bw / 2, y + .02 + bh2 / 2, 0); xx += bw + .005; if (dr() < .1) xx += .12; } }
      for (let i = 0; i < 3; i++) { const vx = -fx + .2 + i * .25; cy(.06, .16 + i * .04, [0xe07a6a, 0x6a8ac8, 0xd8a050][i], vx, 1.32 + (.16 + i * .04) / 2, 0); }
      bx(.2, .16, .03, 0xf0f0f0, fx - .25, 1.4, -fz + .08);
      break;
    }
    case 'Poltrona': { // poltrona azul com almofada rosa
      bx(fw - .1, .12, fd - .1, 0x6a8ac8, 0, .4, .02);
      bx(fw - .1, .5, .12, 0x6a8ac8, 0, .72, -fz + .1);
      for (const a of [-1, 1]) { bx(.06, .06, fd, 0xc89858, a * (fx - .03), .58, 0); for (const c of [-1, 1]) bx(.05, .58, .05, 0xc89858, a * (fx - .03), .29, c * (fz - .05)); }
      bx(.36, .3, .1, 0xe89a9a, 0, .66, -fz + .22);
      break;
    }
    case 'MesaCentro': {
      bx(fw, .08, fd, 0xd8a868, 0, .36, 0, 'madeira', 1);
      bx(fw - .1, .04, fd - .1, 0xc89858, 0, .14, 0);
      for (const a of [-1, 1]) for (const c of [-1, 1]) bx(.05, .32, .05, 0xb88848, a * (fx - .06), .16, c * (fz - .06));
      cy(.07, .08, 0xe05a4a, 0, .44, 0); FB.geo(icoG, 0x3a8a4a, null, ...L(0, .52, 0), 0, 0, 0, .12, .1, .12);
      break;
    }
    case 'Escrivaninha': {
      bx(fw, .05, fd, 0xf0ece4, 0, .74, 0);
      for (const a of [-1, 1]) for (const c of [-1, 1]) bx(.04, .72, .04, 0xe8e4dc, a * (fx - .05), .36, c * (fz - .05));
      bx(.6, .38, .03, 0x1e1e22, 0, 1.0, -fz + .15); bx(.56, .32, .01, 0x3a6ab0, 0, 1.0, -fz + .17); bx(.08, .2, .08, 0xd8d8d8, 0, .85, -fz + .12);
      bx(.42, .02, .14, 0xf4f4f4, 0, .77, .02); bx(fw * .55, .01, .35, 0xe08a4a, .1, .77, .05);
      cy(.04, .1, 0xe0a040, fx - .2, .82, 0);
      break;
    }
    case 'Cadeira': {
      bx(fw, .06, fd, 0xe0c060, 0, .46, 0); bx(fw, .4, .06, 0xe0c060, 0, .72, -fz + .03);
      for (const a of [-1, 1]) for (const c of [-1, 1]) bx(.04, .46, .04, 0xf0f0f0, a * (fx - .04), .23, c * (fz - .04));
      break;
    }
    default: bx(fw, fh, fd, color, 0, fh / 2, 0);
  }
}
function drawPlant(px, pz, big) {
  const B = FB, k = big ? 1.4 : 1;
  B.geo(cylG, 0xa0583a, null, px, .17 * k, pz, 0, 0, 0, .34 * k, .34 * k, .34 * k);
  B.geo(cylG, 0x3a2a1e, null, px, .34 * k, pz, 0, 0, 0, .3 * k, .02, .3 * k);
  for (let i = 0; i < 4; i++) { const a = i * 1.7 + dr(); B.geo(icoG, i % 2 ? 0x3a7a3a : 0x4a8a3a, null, px + Math.cos(a) * .1 * k, (.55 + i * .1) * k, pz + Math.sin(a) * .1 * k, a, 0, 0, .42 * k, .5 * k, .42 * k); }
}
function drawLamp(px, pz) {
  FB.geo(cylG, 0x2a2a2a, null, px, .02, pz, 0, 0, 0, .3, .04, .3);
  FB.geo(cylG, 0x3a3a3a, null, px, .75, pz, 0, 0, 0, .04, 1.5, .04);
  FB.geo(new T.CylinderGeometry(.14, .24, .3, 12, 1, true), 0xf0e2b8, null, px, 1.55, pz);
}
function plantAt(px, pz, big) { drawPlant(px, pz, big); addCol({ cx: px, cz: pz, r: big ? .26 : .2 }); lateBox('Vaso de planta', px, pz, .25, .25, 'vaso'); }
function drawBush(px, pz, sc) {
  addCol({ cx: px, cz: pz + .05, r: .55 * sc });
  for (let i = 0; i < 3; i++) FB.geo(icoG, [0x3a6a32, 0x46783a, 0x345e2c][i], null, px + (i - 1) * .35 * sc, .4 * sc, pz + (i % 2) * .12, i, 0, 0, .8 * sc, .75 * sc, .8 * sc);
}
function drawTable(px, pz) {
  const B = FB;
  B.box(1.4, .06, .9, 0x7a5636, px, .74, pz, 0, 'madeira', 1);
  for (const a of [-1, 1]) for (const c of [-1, 1]) B.box(.06, .72, .06, 0x5a3e28, px + a * .62, .36, pz + c * .38);
  B.box(.3, .02, .3, 0xe8e4dc, px - .3, .78, pz); // prato
  B.geo(cylG, 0xd04a3a, null, px + .35, .83, pz - .1, 0, 0, 0, .1, .14, .1); // copo
}

// ================================================================ MUNDO ABERTO 5 × 5 km, gerado em pedaços (só perto do jogador)
const buildings = [], containers = [], beds = [], sinks = [], trees = [], wells = [], hortas = [], animals = [];
const CH = 80, HALF = 2480, LOAD_R = 2, FLOOR_H = 3;
let CUR_LV = null; // andar sendo construído (null = vale para todos)
let ROOT = scene, CUR = null;
const chunks = new Map(); let deltas = {};
function hash2(a, b, s) { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul((s | 0) + 1, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h = h ^ (h >>> 16); return (h >>> 0) / 4294967296; }
function vnoise(x, z, s) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return lerp(lerp(hash2(xi, zi, s), hash2(xi + 1, zi, s), u), lerp(hash2(xi, zi + 1, s), hash2(xi + 1, zi + 1, s), u), v);
}
const SPECIAL = {};
[['prisao', 23, -19], ['prisao', -24, 21], ['bombeiros', 2, 1], ['bombeiros', -9, 5], ['bombeiros', 7, -8], ['bombeiros', -14, -12], ['bombeiros', 14, 13], ['bombeiros', -18, 15], ['bombeiros', 18, -4], ['bombeiros', -3, 18], ['bombeiros', 4, -19],
 ['delegacia', -1, -2], ['delegacia', 10, 4], ['delegacia', -7, -10], ['delegacia', 15, -10], ['delegacia', -13, 10], ['delegacia', 6, 15], ['delegacia', -17, -3], ['delegacia', 1, -14],
 ['hospital', 1, -1], ['hospital', -11, -4], ['hospital', 12, 9], ['hospital', -5, 13], ['inicio', -6, 0]]
  .forEach(([k, cx, cz]) => SPECIAL[cx + ',' + cz] = k);
const ZONE_NAME = { centro: 'Centro da cidade', bairro: 'Bairro residencial', inicio: 'Bairro residencial', industrial: 'Zona industrial', fazenda: 'Fazenda', floresta: 'Floresta', campo: 'Campo aberto', prisao: 'Prisão estadual', bombeiros: 'Quartel dos bombeiros', delegacia: 'Delegacia de polícia', hospital: 'Hospital' };
const ZONE_COLOR = { centro: '#8a8a86', bairro: '#5f7c44', inicio: '#5f7c44', industrial: '#77756e', fazenda: '#8a9a4e', floresta: '#2f4a28', campo: '#7a9a52', prisao: '#9a6a4a', bombeiros: '#b84a3a', delegacia: '#3a5a9a', hospital: '#d8d8d8' };
function baseZone(cx, cz) {
  const d = Math.hypot(cx + .5, cz + .5) * CH + (vnoise(cx / 4, cz / 4, 7) - .5) * 320;
  if (d < 650) return 'centro';
  const ang = Math.atan2(cz + .5, cx + .5);
  if (d < 1700) return ((ang > -.75 && ang < .55) || (ang > 2.3 || ang < -2.6)) && d > 900 ? 'industrial' : 'bairro';
  if (d < 1950 && hash2(cx, cz, 3) < .35) return 'bairro';
  const n = vnoise(cx / 3 + 40, cz / 3 - 20, 11);
  return n < .43 ? 'floresta' : n < .74 ? 'fazenda' : 'campo';
}
const zoneAt = (cx, cz) => SPECIAL[cx + ',' + cz] || baseZone(cx, cz);
const URBAN = new Set(['centro', 'bairro', 'industrial', 'prisao', 'bombeiros', 'delegacia', 'hospital', 'inicio']);
const isUrban = (cx, cz) => URBAN.has(zoneAt(cx, cz));
const roadV = (i, cz) => isUrban(i - 1, cz) || isUrban(i, cz) || i % 6 === 0; // estrada na linha x = i*CH
const roadH = (j, cx) => isUrban(cx, j - 1) || isUrban(cx, j) || j % 6 === 0; // estrada na linha z = j*CH
const chunkOf = (v) => Math.floor(v / CH);
const zoneNameAt = (x, z) => ZONE_NAME[zoneAt(chunkOf(x), chunkOf(z))];
const rr2 = (a, b) => a + wr() * (b - a);
const ownGeo = (g) => { g.userData.own = true; return g; };

// ---- árvores e grama (um desenho por pedaço)
const trunkG = new T.CylinderGeometry(0.16, 0.26, 2.6, 7); trunkG.translate(0, 1.3, 0);
const pineG = (() => { const cone = (r, h, y) => { const g = new T.ConeGeometry(r, h, 8); g.translate(0, y, 0); return g; }; return mergeGeos([cone(1.8, 2.4, 2.6), cone(1.4, 2.2, 3.8), cone(.9, 1.8, 5)]); })();
const roundG = (() => { const ico = (r, x, y, z) => { const g = new T.IcosahedronGeometry(r, 1); g.translate(x, y, z); return g; }; return mergeGeos([ico(1.5, 0, 3.4, 0), ico(1.1, .8, 4.1, .3), ico(1.0, -.7, 4.0, -.4)]); })();
const crownMat = new T.MeshLambertMaterial({ flatShading: true });
const bladeG = mergeGeos([0, 1, 2].map(i => { const g = new T.PlaneGeometry(.16, .5, 1, 1); g.translate(0, .25, 0); g.rotateY(i * PI / 3); return g; }));
const flowerG = new T.IcosahedronGeometry(.06, 0); flowerG.translate(0, .22, 0);
const grassMat = new T.MeshLambertMaterial({ side: T.DoubleSide }), flowerMat = new T.MeshLambertMaterial();
function tryTree(x, z, s, pine) {
  if (!CUR || x < CUR.x0 + 1 || x > CUR.x0 + CH - 1 || z < CUR.z0 + 1 || z > CUR.z0 + CH - 1) return false;
  if (onRoad(x, z, 2)) return false;
  for (const b of CUR.bl) if (x > b.x0 - 2.5 && x < b.x1 + 2.5 && z > b.z0 - 4.5 && z < b.z1 + 4.5) return false;
  for (const r of CUR.keep) if (x > r[0] && x < r[1] && z > r[2] && z < r[3]) return false;
  trees.push({ x, z, s, hp: 3, alive: true, pine, tint: .8 + wr() * .35 }); return true;
}
function onRoad(x, z, m) {
  const ch = CUR, lx = x - ch.x0, lz = z - ch.z0, w = (ch.urbanEdge ? 6.5 : 4.5) + (m || 0);
  return (ch.rw && lx < w) || (ch.re && lx > CH - w) || (ch.rn && lz < w) || (ch.rs && lz > CH - w);
}
function buildTrees(ch, list) {
  ch.treeList = list; if (!list.length) return;
  const nP = list.filter(t => t.pine).length;
  ch.tTrunk = new T.InstancedMesh(trunkG, M(0x5a4230), list.length);
  ch.tPine = new T.InstancedMesh(pineG, crownMat, Math.max(1, nP));
  ch.tRound = new T.InstancedMesh(roundG, crownMat, Math.max(1, list.length - nP));
  let ip = 0, ir = 0; const c = new T.Color();
  list.forEach((t, i) => { t.i = i; t.ci = t.pine ? ip++ : ir++; t.ch = ch; t.col = addCol({ cx: t.x, cz: t.z, r: 0.35 * t.s }); c.setHex(t.pine ? 0x2f5a34 : 0x4f7a34).multiplyScalar(t.tint); (t.pine ? ch.tPine : ch.tRound).setColorAt(t.ci, c); });
  if (!nP) ch.tPine.count = 0; if (nP === list.length) ch.tRound.count = 0;
  for (const m of [ch.tTrunk, ch.tPine, ch.tRound]) { if (SHADOWS) m.castShadow = true; ROOT.add(m); }
  updateTrees(ch);
}
function updateTrees(ch) {
  if (!ch || !ch.tTrunk) return;
  const m = new T.Matrix4();
  for (const t of ch.treeList) {
    m.makeScale(t.alive ? t.s : .0001, t.alive ? t.s : .0001, t.alive ? t.s : .0001); m.setPosition(t.x, 0, t.z); ch.tTrunk.setMatrixAt(t.i, m);
    if (t.alive && !t.cut) { m.makeRotationY(t.x * 7.3); m.scale(new T.Vector3(t.s, t.s, t.s)); m.setPosition(t.x, 0, t.z); } else { m.makeScale(.0001, .0001, .0001); m.setPosition(t.x, -5, t.z); }
    (t.pine ? ch.tPine : ch.tRound).setMatrixAt(t.ci, m); t.col.on = t.alive;
  }
  for (const im of [ch.tTrunk, ch.tPine, ch.tRound]) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
}
function grassChunk(ch, n) {
  const pts = [];
  for (let i = 0; i < n * 2 && pts.length < n; i++) {
    const x = ch.x0 + dr() * CH, z = ch.z0 + dr() * CH;
    if (onRoad(x, z, .5)) continue;
    let bad = false; for (const b of ch.bl) if (x > b.x0 - .6 && x < b.x1 + .6 && z > b.z0 - .6 && z < b.z1 + .6) { bad = true; break; }
    for (const r of ch.keep) if (x > r[0] && x < r[1] && z > r[2] && z < r[3]) { bad = true; break; }
    if (!bad) pts.push([x, z]);
  }
  if (!pts.length) return;
  const G = new T.InstancedMesh(bladeG, grassMat, pts.length), F = new T.InstancedMesh(flowerG, flowerMat, Math.ceil(pts.length / 8));
  const m = new T.Matrix4(), c = new T.Color(); let nf = 0;
  pts.forEach(([x, z], i) => {
    const sc = .7 + dr() * .8; m.makeRotationY(dr() * 6); m.scale(new T.Vector3(sc, sc * (.8 + dr() * .6), sc)); m.setPosition(x, 0, z); G.setMatrixAt(i, m);
    c.setHSL(.22 + dr() * .08, .45 + dr() * .2, .22 + dr() * .12); G.setColorAt(i, c);
    if (i % 8 === 0 && nf < F.count) { m.makeTranslation(x + .1, 0, z - .1); F.setMatrixAt(nf, m); c.setHex([0xf0e050, 0xf0f0f0, 0xd060a0, 0x8a70e0][nf % 4]); F.setColorAt(nf++, c); }
  });
  F.count = nf; G.computeBoundingSphere(); F.computeBoundingSphere(); ROOT.add(G, F);
}

// ---- carros (desenhados no lote do pedaço)

// ---- chão, estradas, calçadas e postes de cada pedaço
const bulbMat = new T.MeshBasicMaterial({ color: 0x444444 });
const poolTex = canvasTex(128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 63); gr.addColorStop(0, 'rgba(255,225,150,.9)'); gr.addColorStop(.5, 'rgba(255,200,120,.35)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
const poolMat = new T.MeshBasicMaterial({ map: poolTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0 });
const poolG = (() => { const g = new T.PlaneGeometry(9, 9); g.rotateX(-PI / 2); return g; })();
const GROUND = { centro: [0x8a8a86, 'concreto', 4], industrial: [0x7a7a74, 'concreto', 4], prisao: [0x7f8a5a, 'grama', 6], hospital: [0x8a8a86, 'concreto', 4], delegacia: [0x6f8c4c, 'grama', 6], bombeiros: [0x6f8c4c, 'grama', 6],
  bairro: [0x6f8c4c, 'grama', 6], inicio: [0x6f8c4c, 'grama', 6], fazenda: [0x84914e, 'grama', 7], floresta: [0x51703c, 'grama', 6], campo: [0x7f9a52, 'grama', 7] };
function groundChunk(ch) {
  const { x0, z0, zone } = ch, mx = x0 + CH / 2, mz = z0 + CH / 2, urb = URBAN.has(zone);
  const [gc, gt, gtl] = GROUND[zone]; plane(CH, CH, gc, mx, mz, 0, gt, gtl);
  ch.rw = roadV(ch.cx, ch.cz); ch.re = roadV(ch.cx + 1, ch.cz); ch.rn = roadH(ch.cz, ch.cx); ch.rs = roadH(ch.cz + 1, ch.cx); ch.urbanEdge = urb;
  const asph = 0x3a3b3d, side = urb ? 0xa8a8a0 : 0x8a8270, lamps2 = [];
  const strip = (alongX, pos, inward) => { // pos = linha da estrada; inward = +1/-1 para dentro do pedaço
    const c0 = pos + inward * 2, len = CH;
    if (alongX) { plane(len, 4, asph, mx, c0, .03, 'asfalto', 5); ch.roads.push([x0, alongX, pos]); } else { plane(4, len, asph, c0, mz, .03, 'asfalto', 5); ch.roads.push([z0, alongX, pos]); }
    for (let t2 = 2; t2 < CH; t2 += 8) alongX ? plane(2.5, .2, 0xd8c060, x0 + t2, pos, .04) : plane(.2, 2.5, 0xd8c060, pos, z0 + t2, .04);
    if (urb) {
      const sc = pos + inward * 5;
      alongX ? plane(len, 2, side, mx, sc, .025, 'calcada', 2) : plane(2, len, side, sc, mz, .025, 'calcada', 2);
      alongX ? FB.box(len, .12, .16, 0xb8b6ae, mx, .06, pos + inward * 4.05, 0, 'concreto', 1.5) : FB.box(.16, .12, len, 0xb8b6ae, pos + inward * 4.05, .06, mz, 0, 'concreto', 1.5);
      for (let t2 = 13; t2 < CH - 6; t2 += 27) { const px = alongX ? x0 + t2 : pos + inward * 5.7, pz = alongX ? pos + inward * 5.7 : z0 + t2; lamps2.push([px, pz, alongX ? 0 : 1, -inward]); }
    } else alongX ? plane(len, 1.2, side, mx, pos + inward * 4.6, .02, 'terra', 2) : plane(1.2, len, side, pos + inward * 4.6, mz, .02, 'terra', 2);
  };
  if (ch.rn) strip(true, z0, 1); if (ch.rs) strip(true, z0 + CH, -1); if (ch.rw) strip(false, x0, 1); if (ch.re) strip(false, x0 + CH, -1);
  const pools = [];
  for (const [px, pz, vert, out] of lamps2) {
    const ox = vert ? out * .6 : 0, oz = vert ? 0 : out * .6;
    FB.geo(cylG, 0x3a3e44, null, px, 2.4, pz, 0, 0, 0, .14, 4.8, .14);
    FB.box(vert ? 1.3 : .1, .1, vert ? .1 : 1.3, 0x3a3e44, px + ox, 4.75, pz + oz);
    FB.box(vert ? .5 : .36, .12, vert ? .36 : .5, 0x2a2e34, px + ox * 2, 4.7, pz + oz * 2);
    ch.bulbs.push([px + ox * 2, pz + oz * 2]); addCol({ cx: px, cz: pz, r: .14 }); pools.push([px + ox * 2.6, pz + oz * 2.6]);
    if (dr() < .35) { const tx = px + (vert ? 0 : 1.4), tz = pz + (vert ? 1.4 : 0); FB.geo(cylG, 0x2e5a3a, null, tx, .45, tz, 0, 0, 0, .55, .9, .55); FB.geo(cylG, 0x24402c, null, tx, .93, tz, 0, 0, 0, .6, .06, .6); addCol({ cx: tx, cz: tz, r: .3 }); lateBox('Lixeira', tx, tz, .3, .3, 'lixeira'); }
  }
  if (ch.bulbs.length) { const im = new T.InstancedMesh(boxG, bulbMat, ch.bulbs.length), m = new T.Matrix4(); ch.bulbs.forEach(([x, z], i) => { m.makeScale(.3, .04, .3); m.setPosition(x, 4.63, z); im.setMatrixAt(i, m); }); im.computeBoundingSphere(); ROOT.add(im); }
  if (pools.length) { const im = new T.InstancedMesh(poolG, poolMat, pools.length), m = new T.Matrix4(); pools.forEach(([x, z], i) => { m.makeTranslation(x, .05, z); im.setMatrixAt(i, m); }); im.renderOrder = 2; im.computeBoundingSphere(); ROOT.add(im); }
  // carros parados nas ruas
  if (urb) for (let i = 0; i < 3; i++) if (dr() < .55) {
    const opts = []; if (ch.rn) opts.push([true, z0 + 2.2]); if (ch.rs) opts.push([true, z0 + CH - 2.2]); if (ch.rw) opts.push([false, x0 + 2.2]); if (ch.re) opts.push([false, x0 + CH - 2.2]);
    if (!opts.length) break; const [ax, p] = opts[Math.floor(dr() * opts.length)], t2 = 12 + dr() * (CH - 24);
    makeCar(ax ? x0 + t2 : p, ax ? p : z0 + t2, !ax, [0x6a2a2a, 0x2a3a5a, 0x5a5a5a, 0x2a4a3a, 0x8a7a4a, 0xd8d8d0][Math.floor(dr() * 6)]);
  }
}

// ---- construtores de zona
const houseC = [0xb8a98a, 0x9fb0a8, 0xc2a08a, 0xa8a28e, 0xb5b39a, 0xc8c0a8, 0x98a8b8];
const aptC = [0x7d7a78, 0x8a7f72, 0x6f7680, 0x86827a, 0x76706a, 0x9a8a7a];
const B2 = (o) => { const b = building(o); CUR.bl.push(b); return b; };
function houseRow(ch, row, startK, skipFn) {
  const door = row, zc = row === 'n' ? ch.z0 + 14 : ch.z0 + CH - 14;
  for (let k = 0; k < 4; k++) {
    if (k < startK) continue;
    const x = ch.x0 + 14 + k * 17;
    if (skipFn && skipFn(k)) continue;
    if (wr() < .1 && !(ch.zone === 'inicio' && row === 'n' && k === 0)) { for (let i = 0; i < 3; i++) tryTree(x + rr2(-5, 5), zc + rr2(-3, 3), rr2(.7, 1.1), false); continue; }
    B2({ x, z: zc, kind: 'casa', door, w: 10 + Math.floor(wr() * 3), d: 8, h: 3, wallC: houseC[Math.floor(wr() * houseC.length)] });
  }
}
function backyard(ch, n) { for (let i = 0; i < n; i++) tryTree(rr2(ch.x0 + 8, ch.x0 + CH - 8), rr2(ch.z0 + 22, ch.z0 + CH - 22), rr2(.7, 1.15), wr() < .25); for (let i = 0; i < 4; i++) { const x = rr2(ch.x0 + 10, ch.x0 + CH - 10), z = rr2(ch.z0 + 24, ch.z0 + CH - 24); if (!CUR.bl.some(b => x > b.x0 - 3 && x < b.x1 + 3 && z > b.z0 - 3 && z < b.z1 + 3)) drawBush(x, z, .8 + wr() * .5); } }
function fillGalao(px, pz) {
  if (!count('galao')) { log('Precisa de um galão vazio. Procure em postos e lojas.'); return; }
  P.rot = Math.atan2(px - P.x, pz - P.z);
  startAction('Enchendo o galão', 3, 'mexer', () => { if (!count('galao')) return; itemRemove(P.inv, 'galao', 1); itemAdd(P.inv, 'galaocheio', 1); log('Galão cheio de gasolina.'); noise(P.x, P.z, 5); });
}
function shopAt(ch, x, row, kind) {
  const d = kind === 'mercado' ? 12 : 12, w = kind === 'mercado' ? 16 : kind === 'posto' ? 12 : 14;
  const zc = row === 'n' ? ch.z0 + 7 + 1 + d / 2 : ch.z0 + CH - 8 - d / 2;
  const b = B2({ x, z: zc, kind, door: row, w, d, h: kind === 'posto' ? 3.5 : 5, wallC: kind === 'posto' ? 0xd8d4c8 : kind === 'farmacia' ? 0xdfe6e0 : 0xd0c8b0 });
  if (kind === 'posto') { const pz = row === 'n' ? b.z0 - 3.6 : b.z1 + 3.6; for (const e of [-3, 3]) {
    const px = x + e; FB.box(.9, .15, .9, 0x8a8a84, px, .075, pz); FB.box(.7, 1.5, .5, 0xd03a2a, px, .9, pz); FB.box(.5, .4, .52, 0xe8e4dc, px, 1.3, pz); FB.box(.36, .22, .54, 0x1a2a1a, px, 1.32, pz); FB.box(.06, .5, .06, 0x1e1e1e, px + .38, 1.0, pz); FB.box(.12, .2, .12, 0x2a2a2a, px + .38, .7, pz);
    addCol({ x0: px - .4, x1: px + .4, z0: pz - .3, z1: pz + .3 }); pumps.push({ x: px, z: pz, ch: CUR }); addUse(px, pz, .45, .35, () => count('galao') ? 'Encher galão de gasolina' : 'Bomba de gasolina', () => fillGalao(px, pz)); } }
  return b;
}
function genBairro(ch) {
  const commercial = ch.zone === 'bairro' && hash2(ch.cx, ch.cz, 5) < .22;
  const kind = ['mercado', 'posto', 'farmacia', 'ferragens'][Math.floor(hash2(ch.cx, ch.cz, 6) * 4)];
  if (commercial) { shopAt(ch, ch.x0 + 39.5, 'n', kind); houseRow(ch, 'n', 0, k => k === 1 || k === 2); }
  else houseRow(ch, 'n', 0);
  houseRow(ch, 's', 0);
  backyard(ch, 10);
  if (ch.zone === 'inicio') { // casa onde você acorda: o armário tem um taco
    const b = ch.bl[0]; const arm = containers.find(c => c.b === b && c.nome === 'Armário');
    if (arm) { arm.items = []; itemAdd(arm.items, 'taco', 1); itemAdd(arm.items, 'lata', 1); itemAdd(arm.items, 'pano', 2); }
    ch.start = { x: b.x, z: b.z + 1 };
    if (!ch.startCar) makeCar(b.x + 9, ch.z0 + 6.2, false, 0, null, 'carro');
  }
}
function genCentro(ch) { // centro antigo: casas e comércios pequenos (sem prédios)
  const kinds = ['mercado', 'farmacia', 'ferragens', 'posto'];
  for (const row of ['n', 's']) {
    const shop = hash2(ch.cx, ch.cz, row === 'n' ? 8 : 9) < .55;
    if (shop) { shopAt(ch, ch.x0 + 39.5, row, kinds[Math.floor(hash2(ch.cx, ch.cz, row === 'n' ? 18 : 19) * 4)]); houseRow(ch, row, 0, k => k === 1 || k === 2); }
    else houseRow(ch, row, 0);
  }
  backyard(ch, 6);
}
function genIndustrial(ch) {
  for (const x of [ch.x0 + 23, ch.x0 + 57]) B2({ x, z: ch.z0 + 18, kind: 'armazem', door: 'n', w: 30, d: 20, h: 7, wallC: [0x8a8e94, 0x9a8a72, 0x7a8a7a][Math.floor(wr() * 3)] });
  if (wr() < .5) B2({ x: ch.x0 + 40, z: ch.z0 + CH - 18, kind: 'armazem', door: 's', w: 34, d: 20, h: 7, wallC: 0x8a8e94 });
  else for (let i = 0; i < 6; i++) { // contêineres empilhados
    const x = ch.x0 + 14 + i * 9, z = ch.z0 + CH - 18, c = [0xa04030, 0x3a6a9a, 0x4a8a4a, 0xc08a30][i % 4];
    FB.box(2.4, 2.6, 6, c, x, 1.3, z); for (let r = -2; r <= 2; r++) FB.box(2.45, 2.4, .05, 0xffffff & (c - 0x101010), x, 1.3, z + r * 1.2);
    addCol({ x0: x - 1.2, x1: x + 1.2, z0: z - 3, z1: z + 3, wall: true, h: 2.6 }); containers.push({ nome: 'Contêiner', x, z, hx: 1.2, hz: 3, loot: 'armazem', items: rollLoot('armazem') });
  }
  makeCar(ch.x0 + 40, ch.z0 + 40, false, 0x3a5a8a, 'Caminhão', 'armazem', true);
}
function fence(x0, z0, x1, z1, gateSide) { // cerca de madeira com porteira
  const seg = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az);
    for (let t2 = 0; t2 <= len; t2 += 2.5) FB.box(.12, 1.1, .12, 0x6a4a2a, lerp(ax, bx, t2 / len), .55, lerp(az, bz, t2 / len));
    for (const y of [.45, .9]) FB.box(.06, .1, len, 0x8a6a40, (ax + bx) / 2, y, (az + bz) / 2, ang);
    addCol({ x0: Math.min(ax, bx) - .08, x1: Math.max(ax, bx) + .08, z0: Math.min(az, bz) - .08, z1: Math.max(az, bz) + .08 });
  };
  const mx = (x0 + x1) / 2;
  seg(x0, z0, x0, z1); seg(x1, z0, x1, z1); seg(x0, z0, x1, z0);
  if (gateSide === 's') { seg(x0, z1, mx - 1.6, z1); seg(mx + 1.6, z1, x1, z1); } else seg(x0, z1, x1, z1);
}
function makeWell(x, z) {
  FB.geo(cylG, 0x7a7a72, null, x, .45, z, 0, 0, 0, 2, .9, 2);
  FB.box(.15, 2, .15, 0x5a4030, x - .9, 1, z); FB.box(.15, 2, .15, 0x5a4030, x + .9, 1, z); FB.box(2.2, .15, .3, 0x5a4030, x, 2, z);
  addCol({ cx: x, cz: z, r: 1 }); wells.push({ x, z }); CUR.keep.push([x - 3, x + 3, z - 3, z + 3]);
}
function makeHorta(x, z) {
  plane(10, 6, 0x5a4026, x, z, .02, 'terra', 2);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { FB.geo(icoG, 0x4f8a34, null, x - 3.75 + i * 2.5, .3, z - 2 + j * 2, i, 0, 0, .7, .55, .7); FB.box(.06, .05, .3, 0xd87a2a, x - 3.75 + i * 2.5, .08, z - 2 + j * 2 + .25); }
  hortas.push({ x, z, w: 10, d: 6, day: 0 }); CUR.keep.push([x - 6, x + 6, z - 4, z + 4]);
}
function genFazenda(ch) {
  const X = ch.x0, Z = ch.z0;
  if (hash2(ch.cx, ch.cz, 12) < .6) {
    B2({ x: X + 20, z: Z + 16, kind: 'casafazenda', door: 's', w: 12, d: 9, h: 3, wallC: 0xc8b89a });
    B2({ x: X + 58, z: Z + 52, kind: 'celeiro', door: 'n', w: 16, d: 14, h: 6, wallC: 0x8a3a2a });
    B2({ x: X + 58, z: Z + 18, kind: 'galinheiro', door: 's', w: 6, d: 5, h: 2.6, wallC: 0xc8a878 });
    if (wr() < .6) makeCar(X + 34, Z + 16, true, 0, null, 'carro');
    fence(X + 14, Z + 42, X + 40, Z + 68, 'n'); CUR.keep.push([X + 13, X + 41, Z + 41, Z + 69]);
    ch.pen = { x0: X + 15, x1: X + 39, z0: Z + 43, z1: Z + 67 };
    // porteira: deixa um vão no lado de cima
    makeWell(X + 38, Z + 28); makeHorta(X + 40, Z + 14);
    for (let i = 0; i < 4; i++) { const hx = X + 48 + i * 2.6, hz = Z + 36; FB.geo(cylG, 0xd8b85a, null, hx, .55, hz, 0, 0, PI / 2, 1.1, 1.3, 1.1); addCol({ cx: hx, cz: hz, r: .6 }); }
    ch.animalsBase = { vaca: 2, porco: 3, galinha: 5 };
    ch.chickenArea = { x0: X + 46, x1: X + 72, z0: Z + 10, z1: Z + 32 };
  } else { // lavoura grande
    plane(56, 40, 0x6a5034, X + 40, Z + 40, .015, 'terra', 3);
    for (let r = 0; r < 12; r++) FB.box(54, .18, .5, 0x5a4026, X + 40, .09, Z + 22 + r * 3.3, 0, 'terra', 1);
    for (let r = 0; r < 12; r += 1) for (let i = 0; i < 10; i++) FB.geo(icoG, [0x5a8a34, 0x6a9a3a, 0xa8a040][r % 3], null, X + 15 + i * 5.5, .35, Z + 22 + r * 3.3, i + r, 0, 0, .6, .5, .6);
    CUR.keep.push([X + 11, X + 69, Z + 19, Z + 61]);
    makeHorta(X + 20, Z + 12); makeHorta(X + 60, Z + 12);
    // espantalho
    FB.box(.1, 2.2, .1, 0x5a4030, X + 40, 1.1, Z + 40); FB.box(1.4, .1, .1, 0x5a4030, X + 40, 1.7, Z + 40); FB.box(.5, .6, .3, 0x8a3a2a, X + 40, 1.6, Z + 40); FB.geo(sphG, 0xd8c890, null, X + 40, 2.15, Z + 40, 0, 0, 0, .3, .3, .3); FB.geo(cylG, 0xc8a050, null, X + 40, 2.32, Z + 40, 0, 0, 0, .5, .06, .5);
    ch.animalsBase = { galinha: 2 }; ch.chickenArea = { x0: X + 10, x1: X + 30, z0: Z + 64, z1: Z + 74 };
  }
  for (let i = 0; i < 45; i++) { const e = Math.floor(wr() * 4), t2 = rr2(3, CH - 3); const x = e === 0 ? X + rr2(2, 7) : e === 1 ? X + CH - rr2(2, 7) : X + t2, z = e === 2 ? Z + rr2(2, 7) : e === 3 ? Z + CH - rr2(2, 7) : Z + t2; tryTree(x, z, rr2(.8, 1.2), wr() < .5); }
}
function genFloresta(ch) {
  if (hash2(ch.cx, ch.cz, 13) < .16) { B2({ x: ch.x0 + 40, z: ch.z0 + 40, kind: 'cabana', door: 's', w: 8, d: 6, h: 2.8, wallC: 0x9a7a52 }); CUR.keep.push([ch.x0 + 32, ch.x0 + 48, ch.z0 + 34, ch.z0 + 50]); }
  for (let i = 0; i < 4; i++) { // troncos caídos com madeira
    const x = rr2(ch.x0 + 8, ch.x0 + CH - 8), z = rr2(ch.z0 + 8, ch.z0 + CH - 8), a = wr() * PI;
    FB.geo(cylG, 0x5a4230, null, x, .3, z, a, 0, PI / 2, .55, 3, .55); addCol({ cx: x, cz: z, r: .9 });
    containers.push({ nome: 'Tronco caído', x, z, hx: .9, hz: .9, loot: 'tora', items: rollLoot('tora') }); CUR.keep.push([x - 2.5, x + 2.5, z - 2.5, z + 2.5]);
  }
  for (let i = 0; i < 260; i++) tryTree(rr2(ch.x0 + 1, ch.x0 + CH - 1), rr2(ch.z0 + 1, ch.z0 + CH - 1), rr2(.8, 1.35), wr() < .82);
  for (let i = 0; i < 10; i++) drawBush(rr2(ch.x0 + 4, ch.x0 + CH - 4), rr2(ch.z0 + 4, ch.z0 + CH - 4), .8 + wr() * .6);
}
function genCampo(ch) {
  for (let i = 0; i < 14; i++) tryTree(rr2(ch.x0 + 1, ch.x0 + CH - 1), rr2(ch.z0 + 1, ch.z0 + CH - 1), rr2(.8, 1.3), wr() < .4);
  for (let i = 0; i < 8; i++) { const x = rr2(ch.x0 + 6, ch.x0 + CH - 6), z = rr2(ch.z0 + 6, ch.z0 + CH - 6); if (!onRoad(x, z, 2)) drawBush(x, z, .7 + wr() * .7); }
  for (let i = 0; i < 6; i++) { const x = rr2(ch.x0 + 6, ch.x0 + CH - 6), z = rr2(ch.z0 + 6, ch.z0 + CH - 6), r = .3 + wr() * .5; if (onRoad(x, z, 2)) continue; FB.geo(icoG, 0x8a8a84, null, x, r * .5, z, wr() * 3, 0, 0, r * 2, r * 1.3, r * 1.6); addCol({ cx: x, cz: z, r: r * .9 }); }
  if (hash2(ch.cx, ch.cz, 14) < .2) makeCar(ch.x0 + 40, ch.z0 + 40, wr() < .5, 0x6a5a4a);
  if (hash2(ch.cx, ch.cz, 15) < .14 && (ch.rn || ch.rs)) shopAt(ch, ch.x0 + 40, ch.rn ? 'n' : 's', 'posto');
}
function genPrisao(ch) {
  const X = ch.x0 + 8, Z = ch.z0 + 8, X1 = ch.x0 + CH - 8, Z1 = ch.z0 + CH - 8, h = 3.2, gx = (X + X1) / 2;
  const wall = (ax, az, bx, bz) => { const w = Math.abs(bx - ax) || .5, d = Math.abs(bz - az) || .5; FB.box(w, h, d, 0x9a9890, (ax + bx) / 2, h / 2, (az + bz) / 2, 0, 'concreto', 3); FB.box(w + .1, .12, d + .1, 0x5a5a5a, (ax + bx) / 2, h + .3, (az + bz) / 2); addCol({ x0: Math.min(ax, bx) - .25, x1: Math.max(ax, bx) + .25, z0: Math.min(az, bz) - .25, z1: Math.max(az, bz) + .25, wall: true, h }); };
  wall(X, Z, X1, Z); wall(X, Z, X, Z1); wall(X1, Z, X1, Z1); wall(X, Z1, gx - 3, Z1); wall(gx + 3, Z1, X1, Z1);
  for (const [tx, tz] of [[X, Z], [X1, Z], [X, Z1], [X1, Z1]]) { FB.box(2.2, 6, 2.2, 0x8a8880, tx, 3, tz, 0, 'concreto', 2); FB.box(2.8, .3, 2.8, 0x4a4a4a, tx, 6.2, tz); addCol({ x0: tx - 1.1, x1: tx + 1.1, z0: tz - 1.1, z1: tz + 1.1, wall: true, h: 6 }); }
  B2({ x: ch.x0 + 40, z: ch.z0 + 32, kind: 'prisao', door: 's', w: 40, d: 24, h: 6, wallC: 0xb0aca0 });
  plane(30, 14, 0x9a9a92, ch.x0 + 40, ch.z0 + 58, .02, 'concreto', 3); // pátio
  makeCar(gx + 10, Z1 + 3.5, false, 0xe0e0d8, 'Viatura', 'delegacia');
}
function genServico(ch, kind) {
  const sizes = { bombeiros: [26, 18, 6.4, 0xb8382e], delegacia: [16, 12, 5, 0x6a7a8a], hospital: [30, 20, 9, 0xe0e0dc] }[kind];
  const QB = kind === 'bombeiros';
  const b = B2({ x: ch.x0 + (QB ? 10 : 9) + sizes[0] / 2, z: ch.z0 + (QB ? 14 : 8) + sizes[1] / 2, kind, door: 'n', w: sizes[0], d: sizes[1], h: sizes[2], wallC: sizes[3] });
  if (QB) { // pátio de concreto na frente dos portões, calçada, mastro e hidrante
    plane(11, b.z1 + 2 - (ch.z0 + 6), 0x9c9c98, b.x1 + 5.5, (ch.z0 + 6 + b.z1 + 2) / 2, .026, 'concreto', 3); CUR.keep.push([b.x1, b.x1 + 11.5, ch.z0 + 5, b.z1 + 3]);
    for (const gz of b.gates) for (const sd of [-1, 1]) plane(9, .14, 0xf0f0ea, b.x1 + 5, gz + sd * 2.1, .032);
    plane(3, b.z0 - (ch.z0 + 6), 0xb8b4ac, b.x, (ch.z0 + 6 + b.z0) / 2, .026, 'concreto', 1.5);
    const fx = b.x - 4, fz = b.z0 - 3; FB.geo(cylG, 0xd8d8d8, null, fx, 3.5, fz, 0, 0, 0, .1, 7, .1); FB.box(1.4, .9, .02, 0x2a8a3a, fx + .75, 6.4, fz); FB.box(.7, .45, .03, 0xf0d020, fx + .75, 6.4, fz); addCol({ cx: fx, cz: fz, r: .1 });
    const hx2 = b.x1 + 1.2, hz2 = b.z0 - 1.5; FB.geo(cylG, 0xd02a20, null, hx2, .35, hz2, 0, 0, 0, .3, .7, .3); FB.geo(sphG, 0xd02a20, null, hx2, .72, hz2, 0, 0, 0, .3, .2, .3); FB.geo(cylG, 0xc8c8c8, null, hx2, .45, hz2, 0, 0, PI / 2, .12, .5, .12); addCol({ cx: hx2, cz: hz2, r: .2 });
    makeCar(b.x1 - 5.2, b.gates[0], false, 0xc02a20, 'Caminhão de bombeiros', 'bombeiros', true);
  }
  if (kind === 'delegacia') { makeCar(b.x1 + 6, ch.z0 + 14, true, 0x1e1e22, 'Viatura', 'delegacia'); makeCar(b.x1 + 11, ch.z0 + 14, true, 0xe8e8e0, 'Viatura', 'delegacia'); }
  if (kind === 'hospital') makeCar(b.x1 + 7, ch.z0 + 16, true, 0xf0f0ec, 'Ambulância', 'hospital', true);
  houseRow(ch, 's', 0); backyard(ch, 6);
}

// ---- gerar / descarregar pedaços
function genChunk(cx, cz) {
  const key = cx + ',' + cz, zone = zoneAt(cx, cz);
  const ch = { key, cx, cz, zone, x0: cx * CH, z0: cz * CH, group: new T.Group(), cols: [], bl: [], keep: [], roads: [], bulbs: [] };
  const L0 = { b: buildings.length, c: containers.length, be: beds.length, si: sinks.length, u: usables.length, tv: tvs.length, la: lamps.length, w: wells.length, h: hortas.length, t: trees.length };
  ROOT = ch.group; CUR = ch;
  wr = seeded(Math.floor(hash2(cx, cz, 101) * 4e9)); dr = seeded(Math.floor(hash2(cx, cz, 202) * 4e9));
  FB = new Batch();
  groundChunk(ch);
  if (zone === 'bairro' || zone === 'inicio') genBairro(ch);
  else if (zone === 'centro') genCentro(ch);
  else if (zone === 'industrial') genIndustrial(ch);
  else if (zone === 'fazenda') genFazenda(ch);
  else if (zone === 'floresta') genFloresta(ch);
  else if (zone === 'campo') genCampo(ch);
  else if (zone === 'prisao') genPrisao(ch);
  else genServico(ch, zone);
  FB.build(); containers.push(...lateContainers); lateContainers.length = 0;
  const myTrees = trees.slice(L0.t); buildTrees(ch, myTrees);
  grassChunk(ch, { bairro: 380, inicio: 380, centro: 60, industrial: 120, fazenda: 700, floresta: 500, campo: 1000, prisao: 300, bombeiros: 250, delegacia: 250, hospital: 120 }[zone]);
  ch.containers = containers.slice(L0.c); ch.buildings = buildings.slice(L0.b); ch.hortas = hortas.slice(L0.h);
  for (const [arr, k] of [[buildings, 'b'], [containers, 'c'], [beds, 'be'], [sinks, 'si'], [usables, 'u'], [tvs, 'tv'], [lamps, 'la'], [wells, 'w'], [hortas, 'h']]) for (let i = L0[k]; i < arr.length; i++) arr[i].ch = ch;
  for (const p of pumps) if (p.ch === undefined || p.ch === null) p.ch = ch;
  applyDelta(ch);
  scene.add(ch.group); ROOT = scene; CUR = null;
  if (NET) { writeDelta(ch); NET.lastSent[key] = stableStr(deltas[key] || {}); }
  chunks.set(key, ch);
  spawnChunkZombies(ch, false); spawnChunkAnimals(ch);
  if (!NET || NET.host) for (const b of ch.buildings) if (b.stairs) for (let l = 1; l < b.nLv; l++) if (Math.random() < .5 && zombies.length < C('maxZumbis')) {
    const zz = spawnZombie(pickType(ch.zone), rr(b.x0 + 1.2, b.x1 - 4), rr(b.z0 + 1.2, b.z1 - 1.2)); zz.lv = l; zz.home = ch.key; }
  return ch;
}
function unloadChunk(ch) {
  writeDelta(ch);
  for (const c of ch.cols) removeCol(c);
  scene.remove(ch.group);
  ch.group.traverse(o => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && o.geometry.userData.own) o.geometry.dispose(); });
  const keep = (o) => o.ch !== ch;
  for (const v of vehicles) if (v.ch === ch && v.moved === undefined && S.veh && S.veh[v.id]) markVeh(v);
  for (const arr of [buildings, containers, beds, sinks, usables, tvs, lamps, wells, hortas, trees, vehicles, pumps]) { const f = arr.filter(keep); arr.length = 0; arr.push(...f); }
  for (const t of [...cutTrees]) if (t.ch === ch) cutTrees.delete(t);
  for (const b of [...fading]) if (b.ch === ch) fading.delete(b);
  for (const z of [...zombies]) if (z.home === ch.key && (z.state !== 'chase' || Math.hypot(z.x - P.x, z.z - P.z) > 90)) removeZombie(z);
  for (const a of [...animals]) if (a.home === ch.key) removeAnimal(a);
  chunks.delete(ch.key);
}
function ensureChunks(sync) {
  const centers = [[chunkOf(P.x), chunkOf(P.z), LOAD_R]];
  if (NET && NET.host) for (const r of NET.remotes.values()) if (r.st && !r.st.dead) centers.push([chunkOf(r.st.x), chunkOf(r.st.z), 1]); // zumbis perto dos amigos também
  const want = [], seen = new Set();
  centers.forEach(([pcx, pcz, R], ci) => { for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
    const cx = pcx + dx, cz = pcz + dz, k = cx + ',' + cz; if (Math.abs(cx * CH) > HALF + CH || Math.abs(cz * CH) > HALF + CH || seen.has(k)) continue; seen.add(k);
    if (!chunks.has(k)) want.push([Math.abs(dx) + Math.abs(dz) + ci * 10, cx, cz]);
  } });
  want.sort((a, b) => a[0] - b[0]);
  for (const [, cx, cz] of sync ? want : want.slice(0, 1)) genChunk(cx, cz);
  for (const ch of [...chunks.values()]) if (centers.every(([pcx, pcz, R]) => Math.max(Math.abs(ch.cx - pcx), Math.abs(ch.cz - pcz)) > R + 1)) unloadChunk(ch);
}
function unloadAll() { for (const ch of [...chunks.values()]) unloadChunk(ch); }

// ---- o que mudou em cada pedaço (para salvar)
function writeDelta(ch) {
  const d = deltas[ch.key] || (deltas[ch.key] = {});
  ch.containers.forEach((c, i) => { if (c.touched) (d.c || (d.c = {}))[i] = c.items; });
  ch.buildings.forEach((b, i) => { if (!b.doorClosed || b.doorHp !== DOOR_HP || b.doorBroken || b.barr) (d.b || (d.b = {}))[i] = [b.doorClosed ? 1 : 0, b.doorHp, b.doorBroken ? 1 : 0, b.barr]; else if (d.b) delete d.b[i]; });
  const dead = (ch.treeList || []).filter(t => !t.alive).map(t => t.i); if (dead.length) d.t = dead;
  ch.hortas.forEach((h, i) => { if (h.day) (d.h || (d.h = {}))[i] = h.day; });
}
function applyDelta(ch) {
  const d = deltas[ch.key]; if (!d) return;
  if (d.c) for (const i in d.c) if (ch.containers[i]) { ch.containers[i].items = d.c[i]; ch.containers[i].touched = true; }
  if (d.b) for (const i in d.b) { const b = ch.buildings[i], s = d.b[i]; if (!b) continue; b.doorHp = s[1]; b.doorBroken = !!s[2]; b.barr = s[3] || 0; setDoor(b, !!s[0]); b.doorAng = b.doorClosed ? 0 : 1; refreshBarr(b); }
  if (d.t && ch.treeList) { for (const i of d.t) if (ch.treeList[i]) ch.treeList[i].alive = false; updateTrees(ch); }
  if (d.h) for (const i in d.h) if (ch.hortas[i]) ch.hortas[i].day = d.h[i];
}
const deltaOf = (key) => deltas[key] || (deltas[key] = {});
function removeCol(c) { if (!c._keys) return; for (const k of c._keys) { const a = grid.get(k); if (a) { const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); } } c.on = false; }

// ---- zumbis por pedaço
const ZBASE = { centro: 8, bairro: 3, inicio: 0, industrial: 4, prisao: 14, bombeiros: 4, delegacia: 5, hospital: 7, fazenda: 1, floresta: 1, campo: 1 };
function chunkPop(ch) { const d = deltas[ch.key]; return Math.max(0, Math.round(ZBASE[ch.zone] * (1 + C('crescimentoDia') * (S.dia - 1))) - ((d && d.k) || 0)); }
function freeSpotIn(ch, hidden) {
  for (let i = 0; i < 25; i++) {
    const x = ch.x0 + 3 + Math.random() * (CH - 6), z = ch.z0 + 3 + Math.random() * (CH - 6), d = Math.hypot(x - P.x, z - P.z);
    if (d < 20) continue; if (hidden && d < 45 && !losBlocked(x, z, P.x, P.z)) continue;
    const e = { x, z }; collide(e, .4); if (Math.hypot(e.x - x, e.z - z) > .01) continue; return e;
  }
  return null;
}
function pickType(zone) { return Math.random() < (zone === 'centro' || zone === 'hospital' ? .65 : .75) ? 'comum' : 'magro'; } // sem o zumbi gordo
function spawnChunkZombies(ch, hidden, max) {
  if (NET && !NET.host) return;
  const alive = zombies.filter(z => !z.dead && z.home === ch.key).length; let need = chunkPop(ch) - alive; if (max != null) need = Math.min(need, max);
  while (need-- > 0 && zombies.length < C('maxZumbis')) { const p = freeSpotIn(ch, hidden); if (!p) break; spawnZombie(pickType(ch.zone), p.x, p.z).home = ch.key; }
}
function hourly() { for (const ch of chunks.values()) spawnChunkZombies(ch, true, 2); }

function building(o) {
  const b = Object.assign({}, o);
  const { x, z, w, d, h, door } = b, t = 0.3;
  b.x0 = x - w / 2; b.x1 = x + w / 2; b.z0 = z - d / 2; b.z1 = z + d / 2;
  const wc = b.wallC || 0xaaaaaa, gap = 1.8;
  const k = b.kind, wtex = (k === 'casa' || k === 'casafazenda') ? 'tabuas' : (k === 'celeiro' || k === 'cabana' || k === 'galinheiro') ? 'madeira' : (k === 'mercado' || k === 'posto' || k === 'prisao' || k === 'armazem' || k === 'hospital' || k === 'bombeiros') ? 'concreto' : 'tijolo';
  const wtile = wtex === 'tijolo' ? 1.6 : wtex === 'concreto' ? 3 : 2.2;
  const DBb = new Batch(), DBf = new Batch(); // fundo (paredes norte/oeste ficam em pé) e frente
  const DB = { box: (w2, h2, d2, c, px, py, pz, ry, tex, tile) => ((pz < b.z0 + .6 || px < b.x0 + .6) ? DBb : DBf).box(w2, h2, d2, c, px, py, pz, ry, tex, tile) };
  const interior = k === 'casa' || k === 'casafazenda' || k === 'apartamento';
  const isHouse = k === 'casa' || k === 'casafazenda';
  const QB = k === 'bombeiros'; // quartel dos bombeiros: garagem com portões no lado leste
  const trim = isHouse ? 0xf2eee4 : k === 'celeiro' || QB ? 0xf2f0ea : 0xd8d4cc;
  const shutC = [0x2e4a3a, 0x2a3a5a, 0x5a3a2a, 0x3a3a3a][Math.floor(dr() * 4)];
  const win = (px, py, pz, alongX, ww, wh) => { // janela com moldura, vidro, cruz, peitoril e venezianas
    const ry = alongX ? 0 : PI / 2;
    DB.box(ww + .2, wh + .2, t + .1, trim, px, py, pz, ry);
    DB.box(ww, wh, t + .14, 0x2a3a48, px, py, pz, ry);
    DB.box(ww, .05, t + .17, trim, px, py, pz, ry);
    DB.box(.05, wh, t + .17, trim, px, py, pz, ry);
    DB.box(ww + .34, .07, t + .3, trim, px, py - wh / 2 - .12, pz, ry);
    const backWin = alongX ? pz === b.z0 : px === b.x0;
    if (interior && backWin && py < 3) { // cortinas por dentro
      const inx = alongX ? 0 : t / 2 + .1, inz = alongX ? t / 2 + .1 : 0;
      DBb.box(ww + .9, .04, .04, 0x3a3a3a, px + inx, py + wh / 2 + .22, pz + inz, ry);
      for (const sd of [-1, 1]) { const o2 = sd * (ww / 2 + .2); DBb.box(.34, wh + .55, .05, 0x7a7e86, px + inx + (alongX ? o2 : 0), py - .08, pz + inz + (alongX ? 0 : o2), ry); }
    }
    if (isHouse) for (const sd of [-1, 1]) {
      const ox = sd * (ww / 2 + .26);
      DB.box(.36, wh + .1, t + .14, shutC, px + (alongX ? ox : 0), py, pz + (alongX ? 0 : ox), ry);
      for (let i = 0; i < 4; i++) DB.box(.3, .03, t + .18, 0x1e1e1e, px + (alongX ? ox : 0), py - wh / 2 + .15 + i * (wh - .2) / 3, pz + (alongX ? 0 : ox), ry);
    }
  };
  const PAL = [[0x5a8a52, 0x6a74b8], [0xd0a060, 0x4f8a9a], [0xb8705a, 0xe4d8bc], [0x7a9ab8, 0xe8d4a8], [0x6a8a6a, 0xd8a0a0]];
  b.paint = PAL[Math.floor(dr() * PAL.length)];
  const lining = (len, alongX, cx, cz) => { // parede pintada por dentro
    if (k === 'celeiro') return;
    const back = alongX ? cz < z : cx < x;
    const col = interior ? (back ? (alongX ? b.paint[0] : b.paint[1]) : 0xe8e4dc) : 0xe4e0d8;
    tbox(alongX ? len : .03, h - .02, alongX ? .03 : len, col, 'pintura', 2, cx, (h - .02) / 2, cz);
    if (interior && back) { // rodapé e faixa branca no alto
      DBb.box(alongX ? len : .04, .1, alongX ? .04 : len, 0x3a2a1e, cx, .05, cz);
      DBb.box(alongX ? len : .05, .08, alongX ? .05 : len, 0xf4f2ec, cx, h - .06, cz);
    }
  };
  const n0 = ROOT.children.length;
  const wallX = (zc, split) => { // parede ao longo de x
    const segs = split ? [[b.x0, x - gap / 2], [x + gap / 2, b.x1]] : [[b.x0, b.x1]];
    const inw = zc === b.z0 ? 1 : -1;
    for (const [a, c] of segs) { tbox(c - a, h, t, wc, wtex, wtile, (a + c) / 2, h / 2, zc); addCol({ x0: a, x1: c, z0: zc - t / 2, z1: zc + t / 2, wall: true, h }); lining(c - a - (a === b.x0 ? t : 0) - (c === b.x1 ? t : 0), true, (a + c) / 2 + (a === b.x0 ? t / 2 : 0) - (c === b.x1 ? t / 2 : 0), zc + inw * (t / 2 + .016)); }
    if (split) {
      tbox(gap, h - 2.3, t, wc, wtex, wtile, x, 2.3 + (h - 2.3) / 2, zc);
      DB.box(gap + .3, .16, t + .12, trim, x, 2.32, zc); for (const s2 of [-1, 1]) DB.box(.15, 2.3, t + .12, trim, x + s2 * (gap / 2 + .075), 1.15, zc);
      const out = -inw;
      if (isHouse || k === 'apartamento') { // toldo sobre a porta
        DB.box(gap + .6, .07, .45, isHouse ? 0x5a4a3e : 0x3a5a7a, x, 2.62, zc + out * .38, 0);
      }
      FB.box(gap + 1.2, .06, 1.3, 0xb8b4ac, x, .03, zc + out * .8, 0, 'concreto', 1.5); // degrau / calçadinha
      FB.box(1.0, .015, .6, 0x6a3a2a, x, .065, zc + out * .55); // capacho
    }
    for (const fx of split ? [x - w / 3.4, x + w / 3.4] : [x - w / 4, x + w / 4]) if (k !== 'celeiro') win(fx, 1.6, zc, true, Math.min(1.6, w / 6), 1.0);
  };
  const wallZ = (xc) => { tbox(t, h, d, wc, wtex, wtile, xc, h / 2, z); addCol({ x0: xc - t / 2, x1: xc + t / 2, z0: b.z0, z1: b.z1, wall: true, h }); lining(d - 2 * t, false, xc + (xc === b.x0 ? 1 : -1) * (t / 2 + .016), z); if (k !== 'celeiro') win(xc, 1.6, z, false, Math.min(1.6, d / 4), 1.0); };
  const garageWall = (xc) => { // parede com dois portões grandes (portas de enrolar abertas)
    const gw = 4.4, gh = 3.0, zs = [z - d / 4, z + d / 4]; b.gates = zs;
    const cuts = [b.z0]; for (const zz of zs) cuts.push(zz - gw / 2, zz + gw / 2); cuts.push(b.z1);
    for (let i = 0; i < cuts.length; i += 2) {
      const a = cuts[i], c = cuts[i + 1], len = c - a, mid = (a + c) / 2;
      tbox(t, h, len, wc, wtex, wtile, xc, h / 2, mid); addCol({ x0: xc - t / 2, x1: xc + t / 2, z0: a, z1: c, wall: true, h });
      lining(len - (a === b.z0 ? t : 0) - (c === b.z1 ? t : 0), false, xc - (t / 2 + .016), mid + (a === b.z0 ? t / 2 : 0) - (c === b.z1 ? t / 2 : 0));
    }
    for (const zz of zs) {
      tbox(t, h - gh, gw, wc, wtex, wtile, xc, gh + (h - gh) / 2, zz);
      DB.box(t + .16, .2, gw + .4, trim, xc, gh + .02, zz); for (const sd of [-1, 1]) DB.box(t + .16, gh, .2, trim, xc, gh / 2, zz + sd * (gw / 2 + .1));
      DB.box(.5, .42, gw - .02, 0xdcdee0, xc - .22, gh - .24, zz); for (let i = 0; i < 3; i++) DB.box(.52, .02, gw - .06, 0xa4a8ac, xc - .22, gh - .38 + i * .13, zz);
    }
  };
  wallX(b.z0, door === 'n'); wallX(b.z1, door === 's'); wallZ(b.x0); if (QB) garageWall(b.x1); else wallZ(b.x1);
  const floorYs = []; if (k === 'apartamento') for (let l = 1; l < Math.round(h / FLOOR_H); l++) floorYs.push(l * FLOOR_H + 1.6); else if (h > 5 && k !== 'celeiro') for (let y = 4.4; y < h - 1; y += 2.6) floorYs.push(y);
  for (const y of floorYs) { // janelas dos andares
    for (let kk = -1; kk <= 1; kk++) { win(x + kk * w / 3.3, y, b.z0, true, 1.4, 1.1); win(x + kk * w / 3.3, y, b.z1, true, 1.4, 1.1); }
    for (const xc of [b.x0, b.x1]) if (!(QB && xc === b.x1)) win(xc, y, z, false, 1.4, 1.1);
  }
  // quinas, rodapé de pedra e faixas entre andares
  for (const [cx2, cz2] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) DB.box(t + .14, h, t + .14, trim, cx2, h / 2, cz2);
  if (h > 4.5 && k !== 'celeiro') for (let y = k === 'apartamento' ? FLOOR_H : 3.2; y < h - .5; y += k === 'apartamento' ? FLOOR_H : 2.6) { DB.box(w + .1, .12, t + .14, trim, x, y, b.z0); DB.box(w + .1, .12, t + .14, trim, x, y, b.z1); DB.box(t + .14, .12, d + .1, trim, b.x0, y, z); DB.box(t + .14, .12, d + .1, trim, b.x1, y, z); }
  const baseC = k === 'celeiro' ? 0x6a6660 : 0x8a8680;
  FB.box(w + .12, .3, .1, baseC, x, .15, b.z0 - t / 2 - .04, 0, 'concreto', 1); FB.box(w + .12, .3, .1, baseC, x, .15, b.z1 + t / 2 + .04, 0, 'concreto', 1);
  FB.box(.1, .3, d + .12, baseC, b.x0 - t / 2 - .04, .15, z, 0, 'concreto', 1); FB.box(.1, .3, d + .12, baseC, b.x1 + t / 2 + .04, .15, z, 0, 'concreto', 1);
  b.walls = []; b.decor = [];
  for (const m of ROOT.children.slice(n0)) {
    const bottom = m.position.y - (m.geometry.parameters ? m.geometry.parameters.height * (m.scale.y) / 2 : m.scale.y / 2);
    if (m.material.map && bottom < .1) {
      m.userData.y0 = m.position.y; const pr = m.geometry.parameters;
      m.userData.front = pr.width >= pr.depth ? m.position.z > b.z : m.position.x > b.x;
      b.walls.push(m);
    } else b.decor.push(m);
  }
  b.decor.push(...DBf.build()); b.decorBack = DBb.build();
  b.cut = 0;
  const ftex = (k === 'casa' || k === 'casafazenda' || k === 'apartamento') ? 'madeira' : k === 'celeiro' ? 'terra' : 'piso';
  plane(w - t, d - t, ftex === 'madeira' ? 0x9a6440 : ftex === 'terra' ? 0x8a7050 : 0xc8c4bc, x, z, 0.02, ftex, ftex === 'piso' ? 1.2 : 2);
  if (k === 'casa' || k === 'casafazenda' || k === 'celeiro' || k === 'cabana' || k === 'galinheiro') {
    const rh = k === 'celeiro' ? 3.2 : k === 'galinheiro' ? 1.0 : 1.7, hw = d / 2 + .12; b.rh = rh;
    const sh = new T.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0, rh); sh.closePath();
    const rg = new T.ExtrudeGeometry(sh, { depth: w + .24, bevelEnabled: false }); rg.rotateY(PI / 2); rg.translate(-(w + .24) / 2, 0, 0);
    const uv = rg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.5, uv.getY(i) / 1.5);
    b.roof = new T.Mesh(rg, M(k === 'celeiro' ? 0x7a3a2a : k === 'cabana' || k === 'galinheiro' ? 0x5a4a3a : [0x8a4a3a, 0x5a5a62, 0x6a4a3a][Math.abs(x) % 3], 'telha'));
    rg.userData.own = true; b.roof.position.set(x, h, z); shade(b.roof); ROOT.add(b.roof);
    const fasc = new T.Mesh(boxG, M(trim)); fasc.scale.set(w + .28, .1, .1); for (const sd of [-1, 1]) { const f2 = fasc.clone(); f2.position.set(0, .02, sd * hw); b.roof.add(f2); }
    if (isHouse && dr() < .6) { const ch = tbox(.6, 1.6, .6, 0x9a5a48, 'tijolo', .8, 0, 0, 0); ROOT.remove(ch); ch.position.set(w / 2 - 1.4, rh * .55, -hw * .35); ch.matrixAutoUpdate = true; b.roof.add(ch); const cap = new T.Mesh(boxG, M(0x5a5a5a)); cap.scale.set(.72, .1, .72); cap.position.set(w / 2 - 1.4, rh * .55 + .82, -hw * .35); b.roof.add(cap); }
  } else {
    b.roof = tbox(w + .3, .35, d + .3, QB ? 0x58595d : 0x6a6662, 'concreto', 3, x, h + .17, z);
    const add = (sx, sy, sz, c, px2, py2, pz2) => { const m2 = new T.Mesh(boxG, M(c)); m2.scale.set(sx, sy, sz); m2.position.set(px2 - x, py2 - h - .17, pz2 - z); b.roof.add(m2); m2.updateMatrix(); return m2; };
    for (const sd of [-1, 1]) { add(w + .3, .4, .12, trim, x, h + .55, z + sd * (d / 2 + .09)); add(.12, .4, d + .3, trim, x + sd * (w / 2 + .09), h + .55, z); }
    if (QB) roofQuartel(b, add, x, z, w, d, h);
    else if (h > 5) { add(1.2, .7, .9, 0xa8aaae, x - w / 4, h + .7, z - d / 5); add(.8, .08, .6, 0x5a5e62, x - w / 4, h + 1.08, z - d / 5); const tank = new T.Mesh(cylG, M(0x3a6a9a)); tank.scale.set(1.3, 1.1, 1.3); tank.position.set(w / 5, .9, d / 6); b.roof.add(tank); }
    if (QB) { const sE = textSign('BOMBEIROS', 7, 1.25); sE.position.set(b.x1 + t / 2 + .05, 4.65, z); sE.rotation.y = PI / 2; ROOT.add(sE); b.decor.push(sE);
      const sN = textSign('BOMBEIROS', 3.2, .58); sN.position.set(x, 2.8, b.z0 - t / 2 - .05); sN.rotation.y = PI; ROOT.add(sN); b.decor.push(sN); }
    if (k === 'posto' || k === 'mercado' || k === 'hospital' || k === 'farmacia' || k === 'delegacia') b.decor.push(box(Math.min(w * .6, 10), .9, .12, { posto: 0xc0392b, mercado: 0x2a7a4a, bombeiros: 0xc02a20, hospital: 0xd03030, farmacia: 0x2a9a5a, delegacia: 0x2a4a8a }[k], x, h - .2, door === 's' ? b.z1 + .2 : b.z0 - .2));
  }
  const s = door === 's' ? 1 : -1, dz = door === 's' ? b.z1 : b.z0;
  b.doorX = x; b.doorZ = dz;
  if (isHouse) {
    FB.box(1.3, .03, 3.2, 0xb8b2a6, x, .015, dz + s * 2.9, 0, 'concreto', 1.5);
    for (const sd of [-1, 1]) {
      drawBush(x + sd * (gap / 2 + 1.0), dz + s * .7, 1);
      FB.box(2.6, .08, .8, 0x5a4030, x + sd * (w / 2 - 1.6), .04, dz + s * .65, 0, 'terra', 1);
      for (let i = 0; i < 7; i++) FB.geo(icoG, [0xe04a5a, 0xf0d040, 0xf0f0f0, 0xb05ad0][Math.floor(dr() * 4)], null, x + sd * (w / 2 - 1.6) - 1.1 + i * .37, .14, dz + s * (.5 + dr() * .3), 0, 0, 0, .14, .14, .14);
    }
    const mx = x + 1.1, mz = dz + s * 4.3;
    addCol({ cx: mx, cz: mz, r: .16 }); lateBox('Caixa de correio', mx, mz, .15, .22, 'correio');
    FB.box(.08, 1.0, .08, 0x5a4030, mx, .5, mz); FB.box(.24, .22, .42, 0x2a3a5a, mx, 1.08, mz); FB.box(.03, .14, .05, 0xc03030, mx + .13, 1.15, mz - .12);
  }
  b.out = { x, z: dz + s * 1.3 }; b.inn = { x, z: dz - s * 1.3 };
  b.barr = 0;
  b.barrCol = addCol({ x0: x - gap / 2, x1: x + gap / 2, z0: dz - .2, z1: dz + .2, wall: true, h: 2.3, on: false });
  // porta de verdade: dobradiça num lado do vão, abre para dentro
  b.doorHp = DOOR_HP; b.doorClosed = true; b.doorBroken = false; b.doorAng = 0;
  b.doorCol = addCol({ x0: x - gap / 2, x1: x + gap / 2, z0: dz - .12, z1: dz + .12, wall: true, h: 2.3 });
  b.doorG = new T.Group(); b.doorG.position.set(x - gap / 2 + .02, 0, dz); ROOT.add(b.doorG);
  { const leafC = isHouse ? [0x7a4a2a, 0xf0ece4, 0x3a5a7a, 0x8a2a2a][Math.floor(dr() * 4)] : k === 'celeiro' ? 0x7a3a2a : 0x5a6068;
    const add = (w2, h2, d2, c, px2, py2, pz2, tex) => { const m = new T.Mesh(tex ? (() => { const g = new T.BoxGeometry(w2, h2, d2); return g; })() : boxG, M(c, tex)); if (!tex) m.scale.set(w2, h2, d2); m.position.set(px2, py2, pz2); shade(m); b.doorG.add(m); return m; };
    add(gap - .06, 2.24, .07, leafC, (gap - .06) / 2, 1.13, 0, isHouse ? null : null);
    for (const sd of [-1, 1]) { add(gap * .34, .7, .09, 0xffffff & (leafC + 0x141414), gap * .27, 1.62, 0); add(gap * .34, .7, .09, 0xffffff & (leafC + 0x141414), gap * .7, 1.62, 0); add(gap * .34, .75, .09, 0xffffff & (leafC + 0x141414), gap * .27, .62, 0); add(gap * .34, .75, .09, 0xffffff & (leafC + 0x141414), gap * .7, .62, 0); break; }
    for (const sd of [-1, 1]) { const kn = new T.Mesh(sphG, M(0xd8b860)); kn.scale.set(.08, .08, .08); kn.position.set(gap - .22, 1.05, sd * .07); b.doorG.add(kn); }
  }
  b.doorInward = -s; // abre para dentro
  b.doorFront = door === 's'; // porta na parede da frente (abaixa junto quando corta)
  b.planks = [0.6, 1.2, 1.8].map((y, i) => { const p = box(gap + .3, .22, .08, 0x8a6a40, x, y, dz + s * .2); p.rotation.z = (i - 1) * .12; p.updateMatrix(); p.visible = false; return p; });
  buildings.push(b);
  furnish(b);
  return b;
}
function homeUnit(b, put, apt) {
  const LY = (CUR_LV || 0) * FLOOR_H;
  const t = 0.3, s = b.door === 's' ? 1 : -1, backZ = b.door === 's' ? b.z0 + t / 2 : b.z1 - t / 2, W = b.w;
      put(-W / 2 + 1.0, 0.1, 1.3, 0.55, 2.1, 0x7a8aa0, { bed: true, nome: 'Cama' });
      put(-W / 2 + 2.6, 0.05, 1.3, 2, 0.6, 0x6a4a30, { loot: 'armario', nome: 'Armário' });
      put(W / 2 - 1.0, 0.05, 0.9, 1.9, 0.75, 0xdedede, { loot: 'geladeira', nome: 'Geladeira' });
      put(W / 2 - 2.3, 0.05, 1.2, 0.95, 0.65, 0xbab4a8, { sink: true, nome: 'Pia' });
      if (apt) put(0.6, 0.05, 1.6, 1.9, 0.6, 0x5a4030, { loot: 'armario', nome: 'Guarda-roupa' });
      { const tx3 = b.x + 1.2, tz3 = (b.z0 + b.z1) / 2 + s * 0.4; drawTable(tx3, tz3); addCol({ x0: tx3 - .7, x1: tx3 + .7, z0: tz3 - .45, z1: tz3 + .45 }); lateBox('Mesa', tx3, tz3, .7, .45, 'mesa'); }
      { const fg = put(1.75, 0.05, 0.7, 0.9, 0.62, 0xe8e6e2, { nome: 'Fogão' }); addUse(fg.x, fg.z, fg.hx, fg.hz, () => 'Fogão: esquentar comida', cook); }
      { // sala no estilo da referência: TV na parede, rack, sofá em L, mesa de centro, estante, poltrona, quadros
        const xw = b.x0 + t / 2, zc = (b.z0 + b.z1) / 2, ztv = zc + s * Math.min(1.9, b.d / 2 - 2);
        const WB = new Batch(); // itens presos na parede do fundo
        drawFurn('Rack', xw + .25, ztv, 1.7, .5, .45, 0, PI / 2); addCol({ x0: xw, x1: xw + .5, z0: ztv - .85, z1: ztv + .85 }); lateBox('Gavetas do rack', xw + .25, ztv, .25, .85, 'rack');
        { const scr = new T.Mesh(boxG, M(0x1a2430)); scr.scale.set(.012, .62, 1.12); scr.position.set(xw + .096, 1.45, ztv); ROOT.add(scr); b.decorBack.push(scr);
          const tv = { mesh: scr, on: false, x: xw + .3, z: ztv }; tvs.push(tv); addUse(xw + .3, ztv, .35, .3, () => tv.on ? 'Desligar TV' : 'Ligar TV', () => toggleTv(tv)); }
        WB.box(.06, .72, 1.25, 0x151518, xw + .05, 1.45, ztv); WB.box(.01, .66, 1.18, 0x1a2430, xw + .085, 1.45, ztv);
        FB.box(2.4, .012, 2.6, 0x3a6a8a, xw + 1.6, .03, ztv); FB.box(2.15, .014, 2.35, 0x44789a, xw + 1.6, .031, ztv);
        drawFurn('MesaCentro', xw + 1.15, ztv, 1.0, .4, .55, 0, PI / 2); addCol({ x0: xw + .88, x1: xw + 1.42, z0: ztv - .5, z1: ztv + .5 }); lateBox('Mesa de centro', xw + 1.15, ztv, .27, .5, 'mesacentro');
        const xs = xw + 3.05;
        drawFurn('SofáL', xs, ztv - s * .35, 2.3, .8, .9, 0xe08a4a, -PI / 2);
        addCol({ x0: xs - .45, x1: xs + .45, z0: ztv - s * .35 - 1.15, z1: ztv - s * .35 + 1.15 });
        { const cz2 = ztv - s * .35 + (2.3 / 2 - .6); addCol({ x0: xs - 1.3, x1: xs - .45, z0: cz2 - .43, z1: cz2 + .43 }); }
        addUse(xs, ztv - s * .35, .45, 1.15, () => 'Sentar e descansar no sofá', () => trySleep(.6, { k: 'sentar', x: xs + .08, y: LY - .38, z: ztv - s * .35, rot: -PI / 2 }));
        { const lx = xs + .25, lz = ztv - s * 1.8; drawLamp(lx, lz); addCol({ cx: lx, cz: lz, r: .17 });
          const sh = new T.Mesh(new T.CylinderGeometry(.14, .24, .3, 12, 1, true), M(0xf0e2b8)); sh.position.set(lx, 1.55, lz); ROOT.add(sh);
          const lamp = { mesh: sh, on: false }; lamps.push(lamp); addUse(lx, lz, .2, .2, () => lamp.on ? 'Apagar luminária' : 'Acender luminária', () => toggleLamp(lamp)); }
        const zb = backZ + s * 2.75;
        drawFurn('Estante', xw + .21, zb, 1.0, 1.75, .4, 0, PI / 2); addCol({ x0: xw, x1: xw + .42, z0: zb - .5, z1: zb + .5 }); lateBox('Estante', xw + .21, zb, .21, .5, 'estante');
        const zp = backZ + s * 3.0; drawFurn('Poltrona', xw + 1.6, zp, .75, .9, .75, 0, s === 1 ? PI * .75 : PI * .25); addCol({ x0: xw + 1.25, x1: xw + 1.95, z0: zp - .35, z1: zp + .35 }); addUse(xw + 1.6, zp, .35, .35, () => 'Sentar na poltrona', () => trySleep(.5, { k: 'sentar', x: xw + 1.6, y: LY - .42, z: zp, rot: s === 1 ? PI * .75 : PI * .25 }));
        plantAt(xw + .4, ztv + s * 1.3, true); plantAt(xw + .45, zb + s * .9, false);
        // quadros, mural e ar-condicionado na parede norte
        const zn = b.z0 + t / 2 + .03;
        const fx0 = b.door === 's' ? b.x - .4 : b.x0 + 1.2;
        const art = [[0xd8a050, .34, .44, -.32, 1.85], [0xe08a9a, .44, .3, .14, 1.95], [0x3a3a3a, .26, .3, .1, 1.55], [0x6a8ac8, .3, .36, -.3, 1.38]];
        if (b.door === 's') for (const [c, ww2, hh2, ox, oy] of art) { WB.box(ww2 + .06, hh2 + .06, .03, 0xf2eee4, fx0 + ox, oy, zn); WB.box(ww2, hh2, .035, c, fx0 + ox, oy, zn + .002); }
        if (b.door === 's') { WB.box(.9, .62, .04, 0xc89858, b.x + 1.0, 1.75, zn); WB.box(.82, .54, .045, 0xd8b078, b.x + 1.0, 1.75, zn); for (const [ox, oy, c] of [[-.2, .1, 0xf0e040], [.15, -.05, 0x7ac0e0], [.05, .15, 0xf0a0b0]]) WB.box(.16, .14, .05, c, b.x + 1.0 + ox, 1.75 + oy, zn + .01); }
        WB.box(.95, .3, .22, 0xf4f4f2, b.x1 - 1.9, 2.55, zn + .1); WB.box(.85, .03, .02, 0xb8b8b8, b.x1 - 1.9, 2.44, zn + .22);
        if (false) { // cantinho de estudo
          const xd = b.x1 - t / 2 - .4, zd = zc + s * 1.4;
          drawFurn('Escrivaninha', xd, zd, 1.3, .78, .65, 0, -PI / 2); addCol({ x0: xd - .33, x1: xd + .33, z0: zd - .65, z1: zd + .65 }); lateBox('Gaveta da escrivaninha', xd, zd, .33, .65, 'gaveta');
          drawFurn('Cadeira', xd - .75, zd, .45, .9, .45, 0, PI / 2); addCol({ x0: xd - .98, x1: xd - .52, z0: zd - .23, z1: zd + .23 }); addUse(xd - .75, zd, .23, .23, () => 'Sentar na cadeira', () => trySleep(.4, { k: 'sentar', x: xd - .78, y: -.38, z: zd, rot: PI / 2 }));
          plantAt(xd, zd + s * 1.1, false);
        }
        b.decorBack.push(...WB.build());
      }
}
// prédio de apartamentos: portaria no térreo, escada e um apartamento por andar
function furnishApartment(b, put) {
  const n = Math.max(2, Math.round(b.h / FLOOR_H)), s = b.door === 's' ? 1 : -1, t = .3;
  const zF = b.door === 's' ? b.z1 - t / 2 : b.z0 + t / 2; // parede da porta (frente)
  const sx1 = b.x1 - t / 2 - .1, sx0 = sx1 - 2.3, sz0 = zF - s * .3, sz1 = zF - s * 4.8; // vão da escada
  const zlo = Math.min(sz0, sz1), zhi = Math.max(sz0, sz1);
  b.stairs = { up: { x: (sx0 + sx1) / 2, z: sz1 - s * .7 }, arrive: { x: sx0 - .65, z: zF - s * 1.1 }, n };
  b.levels = []; b.nLv = n;
  const R0 = ROOT, F0 = FB;
  for (let l = 0; l < n; l++) {
    const g = new T.Group(); g.position.y = l * FLOOR_H; R0.add(g); b.levels.push(g);
    ROOT = g; FB = new Batch(); CUR_LV = l;
    const L0 = { c: containers.length, be: beds.length, si: sinks.length, u: usables.length, tv: tvs.length, la: lamps.length, lc: lateContainers.length };
    if (l > 0) { // piso com o buraco da escada
      const zr0 = b.z0 + t / 2, zr1 = b.z1 - t / 2, wx0 = b.x0 + t / 2;
      FB.box(sx0 - wx0, .12, zr1 - zr0, 0x9a6440, (wx0 + sx0) / 2, -.04, (zr0 + zr1) / 2, 0, 'madeira', 2);
      if (zlo - zr0 > .05) FB.box(b.x1 - t / 2 - sx0, .12, zlo - zr0, 0x9a6440, (sx0 + b.x1 - t / 2) / 2, -.04, (zr0 + zlo) / 2, 0, 'madeira', 2);
      if (zr1 - zhi > .05) FB.box(b.x1 - t / 2 - sx0, .12, zr1 - zhi, 0x9a6440, (sx0 + b.x1 - t / 2) / 2, -.04, (zhi + zr1) / 2, 0, 'madeira', 2);
      FB.box(.06, .95, zhi - zlo, 0xe8e4dc, sx0 - .03, .48, (zlo + zhi) / 2); FB.box(sx1 - sx0 + .1, .95, .06, 0xe8e4dc, (sx0 + sx1) / 2, .48, sz1);
      FB.box(.08, .06, zhi - zlo, 0x5a4030, sx0 - .03, .97, (zlo + zhi) / 2);
      addCol({ x0: sx0 - .1, x1: sx1 + .2, z0: zlo, z1: zhi });
      addCol({ x0: b.doorX - 1.1, x1: b.doorX + 1.1, z0: b.doorZ - .2, z1: b.doorZ + .2, wall: true, h: FLOOR_H });
      addUse(b.stairs.arrive.x, b.stairs.arrive.z, .4, .5, () => 'Descer a escada', () => climb(b, -1));
    }
    if (l < n - 1) { // degraus subindo até o próximo andar
      const steps = 12;
      for (let i = 0; i < steps; i++) { const f = (i + .5) / steps, zc = lerp(sz1, sz0, f), hh = (i + 1) * FLOOR_H / steps; FB.box(sx1 - sx0, .14, Math.abs(sz1 - sz0) / steps + .02, 0xc8b090, (sx0 + sx1) / 2, hh - .07, zc, 0, 'madeira', 1); FB.box(sx1 - sx0, hh - .14, .04, 0xe8e2d4, (sx0 + sx1) / 2, (hh - .14) / 2, zc - s * Math.abs(sz1 - sz0) / steps / 2); }
      for (let i = 0; i <= 4; i++) { const zc = lerp(sz1, sz0, i / 4); FB.box(.05, 1, .05, 0x3a3a3a, sx0 + .03, i / 4 * FLOOR_H + .5, zc); }
      if (l === 0) addCol({ x0: sx0 - .05, x1: sx1 + .2, z0: zlo, z1: zhi });
      addUse(b.stairs.up.x, b.stairs.up.z, .7, .35, () => 'Subir a escada', () => climb(b, 1));
    }
    if (l === 0) lobby(b, put); else homeUnit(b, put, true);
    FB.build();
    for (const [arr, k] of [[containers, 'c'], [beds, 'be'], [sinks, 'si'], [usables, 'u'], [tvs, 'tv'], [lamps, 'la'], [lateContainers, 'lc']]) for (let i = L0[k]; i < arr.length; i++) arr[i].lv = l;
    if (l > 0) g.visible = false;
  }
  ROOT = R0; FB = F0; CUR_LV = null;
}
function lobby(b, put) { // portaria do prédio
  const W = b.w;
  put(-W / 2 + 2.2, 0.05, 2.6, 1.7, .35, 0x8a8a92, { loot: 'correio', nome: 'Caixas de correio' });
  const el = put(-.5, 0.05, 2.2, 2.5, .4, 0x9aa0a8, { nome: 'Elevador' }); addUse(el.x, el.z, el.hx, el.hz + .3, () => 'Elevador', () => log('O elevador está sem energia. Use a escada.'));
  put(-2.5, 6.2, 3, 1.05, .8, 0x6a5038, { loot: 'gaveta', nome: 'Balcão' });
  const s = b.door === 's' ? 1 : -1, backZ = b.door === 's' ? b.z0 + .15 : b.z1 - .15;
  const p1 = put(-W / 2 + 1.2, 3.5, .75, .9, .75, 0, { nome: 'Poltrona' }); addUse(p1.x, p1.z, .35, .35, () => 'Sentar na poltrona', () => trySleep(.5, { k: 'sentar', x: p1.x, y: -.42, z: p1.z, rot: s === 1 ? 0 : PI }));
  const p2 = put(-W / 2 + 2.2, 3.5, .75, .9, .75, 0, { nome: 'Poltrona' }); addUse(p2.x, p2.z, .35, .35, () => 'Sentar na poltrona', () => trySleep(.5, { k: 'sentar', x: p2.x, y: -.42, z: p2.z, rot: s === 1 ? 0 : PI }));
  plantAt(b.x0 + .7, backZ + s * .7, true); plantAt(b.x - 2, backZ + s * .7, false);
  FB.box(3, .012, 4, 0x7a2a2a, b.x, .03, (b.z0 + b.z1) / 2 + s * 2.5); FB.box(2.7, .014, 3.7, 0xa04a3a, b.x, .031, (b.z0 + b.z1) / 2 + s * 2.5);
  lateBox('Lixeira', b.x + 1.6, backZ + s * .5, .3, .3, 'lixeira'); FB.geo(cylG, 0x3a3a3a, null, b.x + 1.6, .4, backZ + s * .5, 0, 0, 0, .5, .8, .5); addCol({ cx: b.x + 1.6, cz: backZ + s * .5, r: .28 });
}
function climb(b, dir) {
  if (!b.stairs) return;
  startAction(dir > 0 ? 'Subindo a escada' : 'Descendo a escada', 1.3, 'andar', () => {
    P.lv = (P.lv || 0) + dir; const pt = dir > 0 ? b.stairs.arrive : b.stairs.up; P.x = pt.x; P.z = pt.z;
    noise(P.x, P.z, 4);
  });
}
function furnish(b) {
  const t = 0.3, s = b.door === 's' ? 1 : -1;
  const backZ = b.door === 's' ? b.z0 + t / 2 : b.z1 - t / 2;
  // u: posição em x; v: distância da parede do fundo; fw/fd: tamanho
  const put = (u, v, fw, fh, fd, color, extra) => {
    const px = b.x + u, pz = backZ + s * (v + fd / 2);
    drawFurn(extra && extra.nome, px, pz, fw, fh, fd, color, s === 1 ? 0 : PI);
    const c = addCol({ x0: px - fw / 2, x1: px + fw / 2, z0: pz - fd / 2, z1: pz + fd / 2 });
    const o = Object.assign({ x: px, z: pz, hx: fw / 2, hz: fd / 2 }, extra || {});
    if (o.loot) { o.items = rollLoot(o.loot); containers.push(o); }
    if (CUR_LV !== null) o.lv = CUR_LV;
    o.ry = s === 1 ? 0 : PI;
    if (o.bed) beds.push(o);
    if (o.sink) sinks.push(o);
    o.b = b; return o;
  };
  const W = b.w;
  if (b.kind === 'apartamento') { furnishApartment(b, put); return; }
  switch (b.kind) {
    case 'casa': case 'casafazenda':
      homeUnit(b, put, false);
      break;
    case 'mercado':
      for (const v of [1.5, 4.5]) for (const u of [-W / 4, W / 4]) put(u, v, W / 2 - 2.5, 1.6, 0.9, 0x8a8a92, { loot: 'mercado', nome: 'Prateleira' });
      put(-W / 2 + 1, 0.05, 0.9, 1.9, 0.75, 0xdedede, { loot: 'geladeira', nome: 'Geladeira' });
      break;
    case 'posto':
      put(-2, 0.05, 4, 1.6, 0.8, 0x8a8a92, { loot: 'posto', nome: 'Prateleira' });
      put(3, 0.05, 1, 1.9, 0.75, 0xdedede, { loot: 'geladeira', nome: 'Geladeira' });
      put(1.5, 4.5, 3, 1, 0.8, 0x6a5038, { loot: 'posto', nome: 'Balcão' });
      break;
    case 'farmacia':
      for (const u of [-4, 0, 4]) put(u, 0.05, 3, 1.8, 0.7, 0xd8dce0, { loot: 'farmacia', nome: 'Prateleira' });
      put(0, 5, 4, 1, 0.8, 0x6a5038, { loot: 'farmacia', nome: 'Balcão' });
      break;
    case 'delegacia': {
      const f = put(-4, 0.05, 2, 2, 0.6, 0x4a5058, { loot: 'delegacia', nome: 'Armário de armas' });
      put(0, 0.05, 2, 2, 0.6, 0x4a5058, { loot: 'delegacia', nome: 'Armário' });
      put(4, 4, 2.5, 0.8, 1.2, 0x6a5038, { loot: 'delegacia', nome: 'Mesa' });
      break;
    }
    case 'ferragens':
      for (const u of [-4, 0, 4]) put(u, 0.05, 3, 2, 0.8, 0x6a6a5a, { loot: 'ferragens', nome: 'Prateleira' });
      put(-2, 5, 3, 1, 0.8, 0x6a5038, { loot: 'ferragens', nome: 'Balcão' });
      break;
    case 'prisao':
      for (let i = 0; i < 8; i++) put(-W / 2 + 2.5 + i * 4.6, 0.1, 1.2, 0.5, 2.0, 0x8a8a8a, { bed: true, nome: 'Cama' });
      for (let i = 0; i < 4; i++) put(-W / 2 + 4 + i * 3, 9, 2, 2, 0.6, 0x4a5058, { loot: 'prisao', nome: 'Armário de armas' });
      put(W / 2 - 6, 9, 3, 0.8, 1.2, 0x6a5038, { loot: 'prisao', nome: 'Mesa' });
      put(W / 2 - 3, 0.1, 2, 2, 0.6, 0x4a5058, { loot: 'prisao', nome: 'Armário de armas' });
      break;
    case 'bombeiros': furnishQuartel(b); break;
    case 'hospital':
      for (let i = 0; i < 6; i++) put(-W / 2 + 2.5 + i * 4.6, 0.1, 1.2, 0.6, 2.0, 0xe8e8f0, { bed: true, nome: 'Cama' });
      for (const u of [-8, -2, 4, 10]) put(u, 9, 3, 1.8, 0.7, 0xd8dce0, { loot: 'hospital', nome: 'Prateleira' });
      put(0, 14, 4, 1, 0.8, 0x6a5038, { loot: 'hospital', nome: 'Balcão' });
      break;
    case 'armazem':
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) put(-W / 2 + 4 + i * 7, 2 + j * 7, 1.4, 1.1, 1.4, 0x8a6a40, { loot: 'armazem', nome: 'Caixote' });
      for (const u of [-9, 0, 9]) put(u, 0.05, 4, 2.4, 0.9, 0x6a6a5a, { loot: 'armazem', nome: 'Prateleira' });
      break;
    case 'cabana':
      put(-W / 2 + 1, 0.1, 1.2, 0.5, 2.0, 0x8a5a3a, { bed: true, nome: 'Cama' });
      put(W / 2 - 1.2, 0.05, 1.3, 1.8, 0.6, 0x6a4a30, { loot: 'cabana', nome: 'Armário' });
      put(0.3, 2.5, 1.4, 0.8, 0.9, 0x6a5038, { loot: 'cabana', nome: 'Mesa' });
      break;
    case 'galinheiro':
      for (let i = 0; i < 3; i++) put(-W / 2 + 1 + i * 1.8, 0.05, 1.2, 0.5, 0.8, 0xc8b060, { loot: 'ninho', nome: 'Ninho' });
      break;
    case 'celeiro': {
      const c = put(-5, 0.2, 1.4, 1.1, 1.4, 0x8a6a40, { loot: 'celeiro', nome: 'Caixote' });
      put(-2.5, 0.2, 1.4, 1.1, 1.4, 0x8a6a40, { loot: 'celeiro', nome: 'Caixote' });
      { const fn = put(4, 0.3, 4, 1.2, 2, 0xc8b060, { nome: 'Feno' }); addUse(fn.x, fn.z, fn.hx, fn.hz, () => 'Deitar no feno e descansar', () => trySleep(.7, { k: 'deitar', x: fn.x, y: 1.25, z: fn.z, rot: 0 })); }
      put(4.5, 6, 1.4, 1.1, 1.4, 0x8a6a40, { loot: 'celeiro', nome: 'Caixote' });
      break;
    }
  }
}
// ---- quartel dos bombeiros: placa, telhado com heliponto, divisórias e móveis
const signCache = {};
function textSign(txt, w2, h2) {
  let mat = signCache[txt];
  if (!mat) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 112; const g = c.getContext('2d');
    g.fillStyle = '#2b2d31'; g.fillRect(0, 0, 512, 112); g.fillStyle = '#c0392b'; g.fillRect(0, 98, 512, 14);
    g.fillStyle = '#ffffff'; g.font = 'bold 76px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 256, 52);
    const tx = new T.CanvasTexture(c); tx.colorSpace = T.SRGBColorSpace; tx.anisotropy = 4; mat = signCache[txt] = new T.MeshLambertMaterial({ map: tx });
  }
  return new T.Mesh(ownGeo(new T.PlaneGeometry(w2, h2)), mat);
}
function roofQuartel(b, add, x, z, w, d, h) {
  const top = .19, disc = (r, c, y, ox, oz) => { const m = new T.Mesh(cylG, M(c)); m.scale.set(r * 2, .03, r * 2); m.position.set(ox, top + y, oz); b.roof.add(m); };
  const hx = -w / 4 + .3; // heliponto
  disc(3.7, 0xf0f0ec, 0, hx, 0); disc(3.45, 0xe8b820, .012, hx, 0); disc(3.0, 0x3c3e42, .024, hx, 0);
  const yH = h + .17 + top + .05;
  for (const sd of [-1, 1]) add(.5, .03, 2.6, 0xe8b820, x + hx + sd * .75, yH, z); add(1.0, .03, .45, 0xe8b820, x + hx, yH, z);
  for (const [ox, oz] of [[3.9, 0], [-3.9, 0], [0, 3.9], [0, -3.9]]) add(.16, .14, .16, 0xe02a20, x + hx + ox, yH + .05, z + oz);
  for (const i of [0, 1]) { add(1.2, .75, 1.0, 0xb8bcc0, x + w / 5 + i * 1.7, h + .17 + .55, z + d / 4); add(.8, .04, .8, 0x4a4e52, x + w / 5 + i * 1.7, h + .17 + .94, z + d / 4); }
  for (let i = 0; i < 4; i++) { const m = new T.Mesh(cylG, M(i % 2 ? 0xf2f2f2 : 0xd02a20)); m.scale.set(.12, 1, .12); m.position.set(w / 2 - 1.6, top + .5 + i, -d / 2 + 1.6); b.roof.add(m); }
}
function quartelPart(b, ax, az, bx, bz, holes) { // divisória interna com vãos de porta
  const alongX = az === bz, a0 = alongX ? Math.min(ax, bx) : Math.min(az, bz), a1 = alongX ? Math.max(ax, bx) : Math.max(az, bz), H = 3.0, th = .16;
  const cuts = [a0]; for (const c of holes.sort((p, q) => p - q)) cuts.push(c - .75, c + .75); cuts.push(a1);
  if (!b.parts) b.parts = [];
  for (let i = 0; i < cuts.length; i += 2) {
    const s0 = cuts[i], s1 = cuts[i + 1], len = s1 - s0, mid = (s0 + s1) / 2; if (len < .05) continue;
    const m = alongX ? tbox(len, H, th, 0xe6e0d2, 'pintura', 2, mid, H / 2, az) : tbox(th, H, len, 0xe6e0d2, 'pintura', 2, ax, H / 2, mid);
    m.visible = false; m.matrixAutoUpdate = true;
    const cap = alongX ? tbox(len + .02, .06, th + .04, 0xf4f2ec, null, 1, mid, H, az) : tbox(th + .04, .06, len + .02, 0xf4f2ec, null, 1, ax, H, mid); cap.visible = false;
    addCol(alongX ? { x0: s0, x1: s1, z0: az - th / 2, z1: az + th / 2, wall: true, h: H } : { x0: ax - th / 2, x1: ax + th / 2, z0: s0, z1: s1, wall: true, h: H });
    b.parts.push({ m, cap, H, ax: alongX ? s0 : ax, az: alongX ? az : s0, bx: alongX ? s1 : ax, bz: alongX ? az : s1 });
  }
}
function updateParts(b) { // como no PZ: divisória entre a câmera e o jogador fica baixinha
  if (!b || !b.parts) return;
  const cx = Math.sin(camYaw), cz = Math.cos(camYaw);
  for (const p of b.parts) {
    const dx = p.bx - p.ax, dz = p.bz - p.az, L2 = dx * dx + dz * dz || 1, u = clamp(((P.x - p.ax) * dx + (P.z - p.az) * dz) / L2, 0, 1);
    const qx = p.ax + dx * u - P.x, qz = p.az + dz * u - P.z, low = qx * cx + qz * cz > -.25;
    const k = low ? .5 / p.H : 1; if (p.m.scale.y === k) continue;
    p.m.scale.y = k; p.m.position.y = p.H * k / 2; p.cap.visible = !low;
  }
}
function furnishQuartel(b) {
  const t = .3, X0 = b.x0 + t / 2, X1 = b.x1 - t / 2, Z0 = b.z0 + t / 2, Z1 = b.z1 - t / 2, zc = b.z, xg = b.x1 - 11.5, zA = zc - 1.1, zB = zc + 1.1;
  const F = (nome, px, pz, fw, fh, fd, color, ry, extra) => {
    if (nome) drawFurn(nome, px, pz, fw, fh, fd, color, ry);
    const rot = Math.abs(Math.sin(ry)) > .5, hx = rot ? fd / 2 : fw / 2, hz = rot ? fw / 2 : fd / 2;
    addCol({ x0: px - hx, x1: px + hx, z0: pz - hz, z1: pz + hz });
    const o = Object.assign({ x: px, z: pz, hx, hz, ry, b }, extra || {});
    if (o.loot) { o.items = rollLoot(o.loot); containers.push(o); }
    if (o.bed) beds.push(o); if (o.sink) sinks.push(o);
    return o;
  };
  // pisos de cada área
  plane(X1 - xg, Z1 - Z0, 0x76787c, (xg + X1) / 2, b.z, .03, 'concreto', 3); // garagem
  for (const gz of b.gates) { for (const sd of [-1, 1]) plane(7.6, .14, 0xe8c020, X1 - 4.2, gz + sd * 1.7, .036); plane(.14, 3.54, 0xe8c020, X1 - 8, gz, .036); }
  plane(.5, Z1 - Z0, 0xe8c020, X1 - .45, b.z, .034); // faixa no portão
  plane(xg - X0, zB - zA, 0xd2cec4, (X0 + xg) / 2, zc, .03, 'piso', 1.2); // corredor
  plane(7, zA - Z0, 0xb8bec4, (X0 + X0 + 7) / 2, (Z0 + zA) / 2, .03, 'piso', 1); // vestiário
  plane(xg - X0 - 7, zA - Z0, 0x6a4a34, (X0 + 7 + xg) / 2, (Z0 + zA) / 2, .03, 'madeira', 2); // escritório
  plane(8, Z1 - zB, 0x8a6a4a, (X0 + X0 + 8) / 2, (zB + Z1) / 2, .03, 'madeira', 2); // dormitório
  plane(xg - X0 - 8, Z1 - zB, 0xe6e2da, (X0 + 8 + xg) / 2, (zB + Z1) / 2, .03, 'piso', 1); // cozinha
  // divisórias
  quartelPart(b, xg, Z0, xg, Z1, [zc]);
  quartelPart(b, X0, zA, xg, zA, [X0 + 3.5, X0 + 11]);
  quartelPart(b, X0, zB, xg, zB, [X0 + 4, X0 + 11.5]);
  quartelPart(b, X0 + 7, Z0, X0 + 7, zA, []);
  quartelPart(b, X0 + 8, zB, X0 + 8, Z1, []);
  // GARAGEM: prateleiras, caixa de ferramentas, bancada, mangueiras e extintores
  for (const pz of [Z0 + 1.2, Z0 + 3.3, Z1 - 1.2, Z1 - 3.3]) F('Prateleira', xg + .55, pz, 1.9, 1.9, .7, 0x6a6e76, PI / 2, { loot: 'ferragens', nome: 'Prateleira' });
  { const px = xg + 3.2, pz = Z0 + .4; FB.box(1.2, .9, .55, 0xc0392b, px, .45, pz); for (let i = 0; i < 4; i++) FB.box(1.1, .02, .02, 0x3a1a18, px, .2 + i * .2, pz + .28); FB.box(1.2, .3, .5, 0xd84a3a, px, 1.05, pz); F(null, px, pz, 1.2, 1, .55, 0, 0, { loot: 'ferragens', nome: 'Caixa de ferramentas' }); }
  { const px = xg + 5.6, pz = Z0 + .45; FB.box(2.2, .06, .7, 0x8a6a48, px, .9, pz, 0, 'madeira', 1); for (const a of [-1, 1]) FB.box(.08, .88, .6, 0x4a4e54, px + a * 1.0, .44, pz); FB.box(2.1, .5, .04, 0x5a5e66, px, 1.35, Z0 + .04); FB.box(.4, .12, .2, 0x2a5aa0, px - .5, .99, pz); FB.box(.3, .2, .25, 0xd8a020, px + .4, 1.03, pz);
    F(null, px, pz, 2.2, .95, .7, 0, 0, { loot: 'bombeiros', nome: 'Bancada' }); }
  for (const i of [0, 1, 2]) { const px = xg + 4 + i * 1.4, pz = Z1 - .25; FB.geo(cylG, 0xc02a20, null, px, 1.5, pz, 0, PI / 2, 0, .9, .25, .9); FB.geo(cylG, 0xe8e4d8, null, px, 1.5, pz, 0, PI / 2, 0, .75, .27, .75); FB.box(.1, 1.5, .08, 0x4a4e54, px, .75, pz + .06); }
  for (const pz of [zc - 2.2, zc + 2.2]) { FB.geo(cylG, 0xd02a20, null, xg + .2, .4, pz, 0, 0, 0, .22, .55, .22); FB.box(.06, .12, .06, 0x1a1a1a, xg + .2, .74, pz); }
  for (const [px, pz] of [[X1 - 1, Z0 + .8], [X1 - 1.6, Z0 + .8], [X1 - 1, Z1 - .8]]) { FB.geo(cylG, 0xf07a20, null, px, .3, pz, 0, 0, 0, .3, .6, .3); FB.box(.4, .04, .4, 0x2a2a2a, px, .02, pz); FB.box(.31, .08, .31, 0xf4f4f4, px, .36, pz); }
  // VESTIÁRIO: roupas de bombeiro penduradas, armários de metal e banco
  for (let i = 0; i < 4; i++) {
    const px = X0 + 1.0 + i * 1.3, pz = Z0 + .35;
    FB.box(1.15, 2.1, .06, 0x5a5e66, px, 1.05, Z0 + .03); FB.box(1.15, .05, .6, 0x6a6e76, px, 1.75, pz); FB.box(1.15, .05, .6, 0x6a6e76, px, .3, pz); for (const a of [-1, 1]) FB.box(.05, 2.1, .6, 0x6a6e76, px + a * .56, 1.05, pz);
    FB.box(.62, .8, .26, 0xc8a24a, px, 1.15, pz + .02); for (const y of [.88, 1.3]) FB.box(.64, .05, .28, 0xd8e070, px, y, pz + .02); FB.box(.62, .04, .27, 0x8a8a8a, px, .9, pz + .02);
    FB.geo(sphG, i % 2 ? 0xd02a20 : 0x1e1e20, null, px, 1.92, pz, 0, 0, 0, .34, .26, .38); FB.box(.4, .02, .5, i % 2 ? 0xd02a20 : 0x1e1e20, px, 1.8, pz + .03);
    for (const a of [-1, 1]) FB.box(.14, .3, .26, 0x1e1e1e, px + a * .12, .48, pz + .05);
    F(null, px, pz, 1.15, 2.1, .6, 0, 0, { loot: 'bombeiros', nome: 'Equipamento de bombeiro' });
  }
  for (const pz of [Z0 + 2.4, Z0 + 3.4, Z0 + 4.4, Z0 + 5.4]) F('Armário', X0 + .32, pz, .95, 1.9, .55, 0x4a5058, PI / 2, { loot: 'bombeiros', nome: 'Armário' });
  { const px = X0 + 3.6, pz = Z0 + 4.2; FB.box(2.4, .06, .4, 0x9a7048, px, .46, pz, 0, 'madeira', 1); for (const a of [-1, 1]) FB.box(.06, .44, .34, 0x4a4e54, px + a * 1.05, .22, pz); F(null, px, pz, 2.4, .5, .4, 0, 0); }
  // ESCRITÓRIO / RECEPÇÃO
  { const xo = X0 + 7;
    F('Balcão', xo + 2.2, Z0 + 2.2, 2.4, 1.05, .7, 0x7a5236, PI, { loot: 'gaveta', nome: 'Balcão' });
    for (const px of [xo + 1.9, xo + 5.9]) { F('Escrivaninha', px, zA - .45, 1.3, .78, .65, 0, PI, { loot: 'gaveta', nome: 'Gaveta da mesa' }); drawFurn('Cadeira', px, zA - 1.25, .45, .9, .45, 0, 0); addCol({ x0: px - .23, x1: px + .23, z0: zA - 1.48, z1: zA - 1.02 }); }
    for (const pz of [Z0 + 3.4, Z0 + 4.3]) { const px = xg - .4; FB.box(.55, 1.3, .8, 0x8a9098, px, .65, pz); for (let i = 0; i < 3; i++) FB.box(.02, .3, .6, 0x6a7078, px - .28, .25 + i * .42, pz); F(null, px, pz, .55, 1.3, .8, 0, 0, { loot: 'gaveta', nome: 'Arquivo' }); }
    { const px = xg - .45, pz = Z0 + 5.5; FB.box(.35, 1.0, .35, 0xe8e8e4, px, .5, pz); FB.geo(cylG, 0x4a8ad0, null, px, 1.22, pz, 0, 0, 0, .28, .42, .28); F(null, px, pz, .35, 1.4, .35, 0, 0); }
    FB.box(1.6, .9, .04, 0xf4f4f2, xo + 4.0, 1.7, Z0 + .03); FB.box(1.5, .8, .045, 0xfafafa, xo + 4.0, 1.7, Z0 + .035);
    plantAt(xo + .5, Z0 + .5, true);
  }
  // DORMITÓRIO
  for (let i = 0; i < 4; i++) { const px = X0 + 1.0 + i * 1.95; F('Cama', px, Z1 - 1.05, 1.1, .55, 2.0, 0x7a8aa0, PI, { bed: true, nome: 'Cama' }); FB.box(.45, .55, .4, 0x7a5236, px + .85, .28, Z1 - .25, 0, 'madeira', 1); }
  for (const pz of [zB + .9, zB + 1.9]) F('Guarda-roupa', X0 + .32, pz, .95, 1.9, .55, 0x6a4a30, PI / 2, { loot: 'armario', nome: 'Armário' });
  // COZINHA E REFEITÓRIO
  { const xo = X0 + 8;
    F('Geladeira', xo + .6, Z1 - .4, .9, 1.9, .75, 0xdedede, PI, { loot: 'geladeira', nome: 'Geladeira' });
    F('Pia', xo + 1.7, Z1 - .35, 1.2, .95, .65, 0xbab4a8, PI, { sink: true, nome: 'Pia' });
    { const fg = F('Fogão', xo + 2.85, Z1 - .35, .9, .9, .62, 0xe8e6e2, PI, { nome: 'Fogão' }); addUse(fg.x, fg.z, fg.hx, fg.hz, () => 'Fogão: esquentar comida', cook); }
    F('Armário', xo + 4.1, Z1 - .32, 1.4, .95, .6, 0x8a6244, PI, { loot: 'mercado', nome: 'Armário da cozinha' });
    for (const px of [xo + 2.0, xo + 3.4]) { drawTable(px, zc + 4.6); for (const sd of [-1, 1]) { drawFurn('Cadeira', px, zc + 4.6 + sd * .75, .45, .9, .45, 0, sd < 0 ? 0 : PI); } }
    addCol({ x0: xo + 1.3, x1: xo + 4.1, z0: zc + 4.15, z1: zc + 5.05 }); lateBox('Mesa', xo + 2.7, zc + 4.6, 1.4, .45, 'mesa');
    FB.box(.04, .7, 1.2, 0x1a2430, xg - .1, 1.6, zc + 4.6); // TV na parede
  }
}
let delegaciaGarantida = false;
const lateContainers = [], usables = [], tvs = [], lamps = []; // móveis novos (entram no fim da lista p/ não estragar saves)
function rollLootR(table) { const out = []; for (const [id, ch, a, b2] of LOOT[table]) if (dr() < ch) itemAdd(out, id, a ? a + Math.floor(dr() * (b2 - a + 1)) : 1); return out; }
function lateBox(nome, x, z, hx, hz, table) { lateContainers.push({ nome, x, z, hx, hz, loot: table, items: rollLootR(table) }); }
function addUse(x, z, hx, hz, label, act) { usables.push({ x, z, hx, hz, label, act }); }
const energiaOk = () => S.dia < C('diaSemAgua');
function cook() {
  if (!energiaOk()) { log('Sem energia. O fogão não liga.'); return; }
  if (count('carnecrua')) { startAction('Fritando carne', 4, 'mexer', () => { if (!count('carnecrua')) return; itemRemove(P.inv, 'carnecrua', 1); itemAdd(P.inv, 'carneassada', 1); log('Carne pronta!'); }); return; }
  if (!count('lata')) { log('Precisa de uma lata de feijão ou carne crua.'); return; }
  startAction('Esquentando comida', 4, 'mexer', () => { if (!count('lata')) return; itemRemove(P.inv, 'lata', 1); itemAdd(P.inv, 'feijaoq', 1); log('Feijão quente pronto! Mata mais a fome.'); });
}
function toggleTv(tv) {
  if (!tv.on && !energiaOk()) { log('Sem energia. A TV não liga.'); return; }
  playAnim('empurrar', .45); P.rot = Math.atan2(tv.x - P.x, tv.z - P.z);
  tv.on = !tv.on; tv.mesh.material = tv.on ? tvOnMat : M(0x1a2430); log(tv.on ? 'TV ligada. Cuidado: o barulho atrai zumbis.' : 'TV desligada.');
}
function toggleLamp(l) {
  if (!l.on && !energiaOk()) { log('Sem energia. A luminária não acende.'); return; }
  playAnim('empurrar', .45);
  l.on = !l.on; l.mesh.material = l.on ? lampOnMat : M(0xf0e2b8);
}
const tvOnMat = new T.MeshBasicMaterial({ color: 0x6ab0ff }), lampOnMat = new T.MeshBasicMaterial({ color: 0xfff2b0 });
const DOOR_HP = 80;
function setDoor(b, closed) {
  b.doorClosed = closed && !b.doorBroken; b.doorCol.on = b.doorClosed;
}
function animDoors(dt) {
  for (const b of buildings) {
    const target = b.doorBroken ? 0 : b.doorClosed ? 0 : 1;
    if (Math.abs(b.doorAng - target) > .001) b.doorAng += clamp(target - b.doorAng, -dt * 4, dt * 4);
    b.doorG.rotation.y = -b.doorInward * b.doorAng * PI / 2;
    b.doorG.visible = !b.doorBroken;
    const low = b.cut === 1 && b.doorFront; b.doorG.scale.y = low ? .55 / 2.3 : 1;
  }
}
const cutTrees = new Set(); let cutT = 0;
function setCut(b, mode) {
  mode = mode === true ? 2 : mode || 0;
  const lv = mode ? (P.lv || 0) : 0, key = mode * 10 + lv;
  if (b.cutKey === key) return; b.cutKey = key; b.cut = mode;
  for (const m of b.walls) { const low = mode === 2 || (mode === 1 && m.userData.front); const k = low ? (lv * FLOOR_H + .55) / b.h : 1; m.scale.y = k; m.position.y = m.userData.y0 * k; m.updateMatrix(); }
  if (b.levels) b.levels.forEach((g, l) => g.visible = l === 0 || (mode === 1 && l <= lv));
  for (const m of b.decor) m.visible = !mode;
  for (const m of b.decorBack) m.visible = mode !== 2;
  b.roof.visible = !mode;
  if (b.parts) for (const p of b.parts) { p.m.visible = !!mode; p.cap.visible = !!mode; }
}
let fading = new Set();
const fadeCache = new Map();
function fadeMat(m) { let f = fadeCache.get(m); if (!f) { f = m.clone(); f.transparent = true; f.opacity = .28; f.depthWrite = false; fadeCache.set(m, f); } return f; }
function setFade(b, on) {
  if (!!b.faded === on) return; b.faded = on;
  const all = [...b.walls, ...b.decor, ...(b.decorBack || []), ...b.planks];
  b.roof.traverse(o => all.push(o)); b.doorG.traverse(o => all.push(o));
  for (const m of all) { if (!m.isMesh) continue; if (on) { m.userData.mat0 = m.material; m.material = fadeMat(m.material); m.renderOrder = 3; } else if (m.userData.mat0) { m.material = m.userData.mat0; m.renderOrder = 0; } }
}
function cutaway() { // paredes e árvores entre a câmera e o jogador somem, como no PZ
  const cx = Math.sin(camYaw), cz = Math.cos(camYaw), px = cz, pz = -cx;
  const inside = buildingAt(P.x, P.z);
  for (const b of buildings) setCut(b, b === inside ? 1 : 0); // por dentro só aparece quando você entra
  updateParts(inside);
  // prédio que tapa o jogador fica transparente (como no Project Zomboid)
  const tp = Math.tan(ISO_PITCH), fadeNow = new Set();
  for (const b of buildings) {
    if (b === inside || Math.abs(b.x - P.x) > 30 || Math.abs(b.z - P.z) > 30) continue;
    for (let t = .2; t < 16; t += .3) {
      const x = P.x + cx * t, z = P.z + cz * t, y = .3 + t * tp;
      if (x <= b.x0 - .2 || x >= b.x1 + .2 || z <= b.z0 - .2 || z >= b.z1 + .2) continue;
      const top = b.h + (b.rh ? b.rh * Math.max(0, 1 - Math.abs(z - b.z) / (b.d / 2)) : .5);
      if (y < top) { fadeNow.add(b); break; }
    }
  }
  for (const b of fading) if (!fadeNow.has(b)) setFade(b, false);
  for (const b of fadeNow) setFade(b, true);
  fading = fadeNow;
  const hidden = false;
  ghostOn = hidden;
  if (--cutT > 0) return; cutT = 6;
  const now = new Set();
  for (const t of trees) {
    if (!t.alive || Math.abs(t.x - P.x) > 14 || Math.abs(t.z - P.z) > 14) continue; const dx = t.x - P.x, dz = t.z - P.z;
    const along = dx * cx + dz * cz, perp = Math.abs(dx * px + dz * pz);
    if (along > -1.5 && along < 10 && perp < 2.6) now.add(t);
  }
  const changed = new Set();
  for (const t of cutTrees) if (!now.has(t)) { t.cut = false; changed.add(t.ch); }
  for (const t of now) if (!t.cut) { t.cut = true; changed.add(t.ch); }
  cutTrees.clear(); now.forEach(t => cutTrees.add(t));
  for (const ch of changed) updateTrees(ch);
}
function buildingAt(x, z) {
  for (const b of buildings) if (x > b.x0 + .15 && x < b.x1 - .15 && z > b.z0 + .15 && z < b.z1 - .15) return b;
  return null;
}

// ---------------------------------------------------------------- personagens
const sphG = new T.SphereGeometry(.5, 14, 10), capCache = {};
const capG = (r, l) => { const k = r.toFixed(3) + '_' + l.toFixed(3); return capCache[k] || (capCache[k] = new T.CapsuleGeometry(r, Math.max(.01, l), 4, 10)); };
const hairG = new T.SphereGeometry(.5, 14, 8, 0, PI * 2, 0, PI * .55);
const eyeMatZ = new T.MeshBasicMaterial({ color: 0xe6f08a });
const blobTex = canvasTex(64, (g, s) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
const blobMat = new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
const blobG = new T.PlaneGeometry(1, 1); blobG.rotateX(-PI / 2);
const hoodG = new T.SphereGeometry(.5, 16, 12, PI * .78, PI * 1.44, 0, PI * .78);
const hoodMat = new T.MeshLambertMaterial({ color: 0x474c55, side: T.DoubleSide, map: null });
const torusG = new T.TorusGeometry(.5, .14, 6, 14);
// roupa do sobrevivente: moletom com capuz, boné, máscara, luvas, jeans, botas, coldre, cinto com corda e mochila tática
function dressSurvivor(r, s, mk) {
  const { torso, upper, legs, arms, hy, hz } = r, B = s.bodyW, H = s.bodyH, D = s.bodyD, hs = s.headS;
  const hood = 0x474c55, hood2 = 0x575d68, pack = 0x4f5642, strap = 0x2a2c26, tan = 0xc8a878;
  // capuz e boné
  mk(hoodG, hood, 0, hy + .01, hz - .01, hs * 1.32, hs * 1.42, hs * 1.3, torso, hoodMat);
  mk(sphG, hood, 0, H + .02, -.02, B * .62, .12, D * 1.05, torso); // gola do capuz
  mk(boxG, 0x34363a, 0, hy + hs * .5, hz + hs * .52, hs * .62, .02, hs * .4, torso); // aba do boné
  // máscara
  mk(sphG, 0xeceae4, 0, hy - hs * .22, hz + hs * .4, hs * .66, hs * .44, hs * .36, torso);
  for (const e of [-1, 1]) mk(cylG, 0x8a8a88, e * hs * .24, hy - hs * .26, hz + hs * .52, .05, .03, .05, torso).rotation.x = PI / 2;
  // detalhes do moletom
  mk(boxG, hood2, 0, H * .3, D / 2 + .01, B * .62, H * .26, .025, torso); // bolso canguru
  for (const e of [-1, 1]) mk(boxG, 0xd8d8d0, e * .045, H * .74, D / 2 + .02, .012, H * .22, .012, torso); // cordões
  mk(boxG, hood2, 0, .05, 0, B * 1.02, .08, D * 1.08, torso); // barra do moletom
  // cinto, corda e bolsinha
  mk(boxG, 0x3a2a1c, 0, .02, 0, B * 1.0, .06, D * 1.1, upper);
  mk(boxG, 0xb8a060, 0, .02, D * .56, .07, .05, .02, upper);
  const rope = mk(torusG, 0xc8b088, B * .32, -.04, -D * .45, .16, .16, .16, upper); rope.rotation.y = PI / 2;
  mk(boxG, 0x4a4a3a, -B * .42, -.02, -D * .2, .08, .1, .12, upper);
  // mochila tática
  mk(capG(.5, .4), pack, 0, H * .55, -D / 2 - .11, B * .86, H * .62 / 1.4, .22, torso);
  mk(boxG, 0x262a24, 0, H * .92, -D / 2 - .11, B * .8, .08, .24, torso); // tampa
  mk(boxG, 0x3a3e36, 0, H * .38, -D / 2 - .24, B * .58, H * .32, .07, torso); // bolso da frente
  for (const yy of [.5, .62]) mk(boxG, strap, 0, H * yy, -D / 2 - .275, B * .5, .02, .012, torso);
  mk(boxG, 0x5a5e54, 0, H * .52, -D / 2 - .28, .07, .05, .02, torso); // fivela
  mk(cylG, 0x9ab0b8, B * .47, H * .4, -D / 2 - .1, .08, .2, .08, torso); // garrafa
  mk(cylG, 0x3a3a3a, B * .47, H * .52, -D / 2 - .1, .05, .04, .05, torso);
  mk(cylG, 0x7a5a3a, -B * .47, H * .58, -D / 2 - .12, .035, .5, .035, torso); // machadinha: cabo
  mk(boxG, 0xb04a3a, -B * .47, H * .84, -D / 2 - .06, .02, .09, .13, torso); // machadinha: lâmina
  for (const e of [-1, 1]) { mk(boxG, strap, e * B * .26, H * .68, D / 2 + .012, .05, H * .5, .015, torso); mk(boxG, strap, e * B * .26, H * .93, 0, .055, .03, D * 1.1, torso); }
  // luvas
  for (const a of arms) a.traverse(o => { if (o.isMesh && o.material === PM(s.skin)) o.material = PM(0x5a5048); });
  // botas e coldre
  legs.forEach((g, i) => {
    mk(capG(s.legW * .54, .14), tan, 0, -s.legLen + .17, 0, 1, 1, 1, g);
    mk(boxG, 0x8a6e4e, 0, -s.legLen + .27, 0, s.legW * 1.1, .035, s.legW * 1.1, g);
    mk(boxG, 0x1e222a, 0, -s.legLen * .55, s.legW * .45, s.legW * .9, .05, .02, g); // costura do joelho
    if (i === 1) { mk(boxG, 0x1c1c1c, s.legW * .62, -.28, .02, .07, .22, .14, g); mk(boxG, 0x1c1c1c, 0, -.22, 0, s.legW * 1.3, .03, s.legW * 1.3, g); mk(boxG, 0x2a2a2a, s.legW * .62, -.13, .02, .08, .06, .16, g); }
  });
}
const fabricTex = canvasTex(128, (g, s) => { g.fillStyle = '#ececec'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 2) { g.fillStyle = `rgba(0,0,0,${.03 + rnd8() * .04})`; g.fillRect(0, y, s, 1); } for (let i = 0; i < 500; i++) { const v = 150 + rnd8() * 105; g.fillStyle = `rgba(${v},${v},${v},.12)`; g.fillRect(rnd8() * s, rnd8() * s, 2, 2); } });
const pmCache = {};
const PM = (c) => pmCache[c] || (pmCache[c] = new T.MeshLambertMaterial({ color: c, map: fabricTex }));
function makeRig(s) {
  const root = new T.Group();
  const mk = (geo, c, x, y, z, sx, sy, sz, par, mat) => { const m = new T.Mesh(geo, mat || PM(c)); m.position.set(x, y, z); if (sx) m.scale.set(sx, sy, sz); if (SHADOWS) m.castShadow = true; par.add(m); return m; };
  const upper = new T.Group(); upper.position.y = s.legLen; root.add(upper);
  const legs = [-1, 1].map(k => {
    const g = new T.Group(); g.position.set(k * s.bodyW * .24, s.legLen, 0);
    mk(capG(s.legW / 2, s.legLen - s.legW), s.pants, 0, -s.legLen / 2 + .02, 0, 0, 0, 0, g);
    mk(sphG, s.shoes || 0x2a2420, 0, -s.legLen + .05, .04, s.legW * 1.05, s.legW * .6, s.legW * 1.5, g);
    root.add(g); return g;
  });
  mk(sphG, s.pants, 0, 0, 0, s.bodyW * .98, .3, s.bodyD * 1.05, upper);
  const torso = new T.Group(); torso.rotation.x = s.hunch || 0; upper.add(torso);
  mk(capG(.5, .6), s.shirt, 0, s.bodyH / 2, 0, s.bodyW, s.bodyH / 1.6, s.bodyD, torso);
  if (s.blood) { mk(sphG, 0x5a1414, s.bodyW * .15, s.bodyH * .55, s.bodyD * .45, s.bodyW * .35, s.bodyH * .3, .06, torso); mk(sphG, 0x4a1010, -s.bodyW * .2, s.bodyH * .25, s.bodyD * .47, s.bodyW * .25, s.bodyH * .2, .05, torso); }
  mk(capG(.05, .06), s.skin, 0, s.bodyH + .04, (s.headF || 0) * .5, 1, 1, 1, torso);
  const hy = s.bodyH + s.headS * .62, hz = s.headF || 0;
  const head = mk(sphHi, s.skin, 0, hy, hz, s.headS, s.headS * 1.15, s.headS * 1.05, torso);
  if (s.hair) mk(hairG, s.hair, 0, hy + .015, hz - .01, s.headS * 1.08, s.headS * 1.2, s.headS * 1.12, torso);
  for (const e of [-1, 1]) mk(sphG, 0x1a1a1a, e * s.headS * .2, hy + s.headS * .08, hz + s.headS * .48, s.headS * .13, s.headS * .13, s.headS * .08, torso, s.eyes ? eyeMatZ : null);
  const arms = [-1, 1].map(k => {
    const g = new T.Group(); g.position.set(k * (s.bodyW / 2 + s.armW * .35), s.bodyH * .85, 0);
    mk(capG(s.armW / 2, s.armLen - s.armW), s.sleeve || s.skin, 0, -s.armLen / 2, 0, 0, 0, 0, g);
    mk(sphG, s.skin, 0, -s.armLen + .02, 0, s.armW * 1.1, s.armW * 1.25, s.armW * 1.1, g);
    torso.add(g); return g;
  });
  if (s.outfit === 'sobrevivente') dressSurvivor({ root, legs, arms, torso, upper, hy, hz }, s, mk);
  if (!SHADOWS) { const b = new T.Mesh(blobG, blobMat); b.scale.set(s.bodyW * 2, 1, s.bodyW * 2); b.position.y = .03; b.renderOrder = -1; root.add(b); }
  scene.add(root);
  return { root, legs, arms, torso, head, s };
}
const ZTYPES = {
  comum: { hp: 60, vel: 1, dano: 1, rig: { legLen: .85, legW: .2, bodyW: .5, bodyH: .62, bodyD: .28, headS: .27, armLen: .68, armW: .14, skin: 0x7d9a6a, shirt: 0x4a5a6e, sleeve: 0x4a5a6e, pants: 0x3a3328, hunch: .15, headF: .04, eyes: 1, blood: 1, hair: 0x3a3a2a } },
  gordo: { hp: 110, vel: .78, dano: 1.4, rig: { legLen: .7, legW: .28, bodyW: .82, bodyH: .72, bodyD: .58, headS: .3, armLen: .62, armW: .2, skin: 0x8a9a6a, shirt: 0x8b6b4a, sleeve: 0x8a9a6a, pants: 0x2e3540, hunch: .05, eyes: 1, blood: 1 } },
  magro: { hp: 40, vel: 1.35, dano: .7, rig: { legLen: 1.05, legW: .14, bodyW: .34, bodyH: .66, bodyD: .2, headS: .24, armLen: .88, armW: .1, skin: 0xa3b096, shirt: 0x2a2a2a, sleeve: 0xa3b096, pants: 0x4a4a44, hunch: .45, headF: .1, eyes: 1, hair: 0x6a6a5a } },
};
const zombies = [];

// ---------------------------------------------------------------- visual dos zumbis (cada parte do corpo é uma peça só = leve)
const grimeTex = canvasTex(128, (g, s) => {
  g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) { const v = 90 + rnd8() * 120; g.fillStyle = `rgba(${v * .9},${v * .85},${v * .7},${.06 + rnd8() * .12})`; g.beginPath(); g.ellipse(rnd8() * s, rnd8() * s, 2 + rnd8() * 9, 2 + rnd8() * 6, rnd8() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(70,20,15,${.08 + rnd8() * .12})`; g.beginPath(); g.arc(rnd8() * s, rnd8() * s, 1 + rnd8() * 4, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 60; i++) { g.beginPath(); const x = rnd8() * s, y = rnd8() * s; g.moveTo(x, y); g.lineTo(x + rnd8() * 14 - 7, y + rnd8() * 14 - 7); g.stroke(); }
});
const zMat = new T.MeshLambertMaterial({ vertexColors: true, map: grimeTex });
const zEyeMat = new T.MeshBasicMaterial({ color: 0xd8dccc });
class Part {
  constructor() { this.list = []; }
  add(geo, color, x, y, z, rx, ry, rz, sx, sy, sz) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); _v.set(x || 0, y || 0, z || 0);
    _m4.compose(_v, _q, new T.Vector3(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz)); g.applyMatrix4(_m4);
    const c = new T.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = this.flat ? 1 : .9 + ((i * 7919) % 13) / 60; col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); this.list.push(g); return this;
  }
  addPre(geo, x, y, z, rx, ry, rz) { // junta uma peça que já tem cores próprias
    const g = geo.clone(); _e.set(rx || 0, ry || 0, rz || 0); _q.setFromEuler(_e); _v.set(x, y, z); _m4.compose(_v, _q, _one); g.applyMatrix4(_m4); this.list.push(g); return this;
  }
  build() {
    let n = 0; for (const g of this.list) n += g.attributes.position.count;
    const A = { position: new Float32Array(n * 3), normal: new Float32Array(n * 3), uv: new Float32Array(n * 2), color: new Float32Array(n * 3) }; let o = 0;
    for (const g of this.list) { A.position.set(g.attributes.position.array, o * 3); A.normal.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) A.uv.set(g.attributes.uv.array, o * 2); A.color.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
    const geo = new T.BufferGeometry(); for (const k in A) geo.setAttribute(k, new T.BufferAttribute(A[k], k === 'uv' ? 2 : 3)); geo.computeBoundingSphere(); return geo;
  }
}
const fringeG = new T.ConeGeometry(.03, .11, 4); fringeG.rotateX(PI); // ponta para baixo: pano rasgado
const fingerG = new T.CapsuleGeometry(.012, .07, 2, 5);
const hairStrandG = new T.ConeGeometry(.025, .12, 4);
const ZLOOK = {
  comum: [{ skin: 0x9aa48a, jacket: 0x6e4c34, shirt: 0x6c76a6, pants: 0x575142, boots: 0x5a4030, hair: 0x3a2e22, jacketOn: 1 },
          { skin: 0xa0a890, jacket: 0x3e4a5a, shirt: 0xb8b0a0, pants: 0x3a3a40, boots: 0x2a2420, hair: 0x6a5a40, jacketOn: 1 },
          { skin: 0x94a084, jacket: 0x5a6a3a, shirt: 0x8a3a30, pants: 0x4a4436, boots: 0x4a3a2a, hair: 0x1e1a16, jacketOn: 1 }],
  gordo: [{ skin: 0x9ea488, jacket: 0x8a3c32, shirt: 0x8a3c32, pants: 0x3c4250, boots: 0x3a3028, hair: 0x2a2620, jacketOn: 0, plaid: 1 },
          { skin: 0xa4a88a, jacket: 0x3a5a7a, shirt: 0x3a5a7a, pants: 0x4a4a40, boots: 0x2a2420, hair: 0x4a3e30, jacketOn: 0, plaid: 1 },
          { skin: 0x98a084, jacket: 0xb8b0a0, shirt: 0xc8c0a8, pants: 0x2e3a4a, boots: 0x3a3028, hair: 0x2a2620, jacketOn: 0 }],
  magro: [{ skin: 0xaab29e, jacket: 0x34363a, shirt: 0x8a8e94, pants: 0x4c4a44, boots: 0x2e2a26, hair: 0x5a564c, jacketOn: 1, longCoat: 1 },
          { skin: 0xb0b6a2, jacket: 0x5a4a3a, shirt: 0xd0c8b0, pants: 0x3a3a34, boots: 0x2a2420, hair: 0x8a8070, jacketOn: 1, longCoat: 1 },
          { skin: 0xa6ae98, jacket: 0x2a3a2a, shirt: 0x6a6a6a, pants: 0x4a4038, boots: 0x3a2e24, hair: 0x2a2620, jacketOn: 1, longCoat: 1 }],
};
const sphHi = new T.SphereGeometry(.5, 22, 16);
const zGeoCache = {};
// zumbi mais orgânico: tudo arredondado, cotovelos e joelhos dobrados, rosto detalhado
function zombieGeos(type, v) {
  const key = type + v; if (zGeoCache[key]) return zGeoCache[key];
  const s = ZTYPES[type].rig, L = ZLOOK[type][v], R = seeded(type.length * 97 + v * 13 + 3);
  const B = s.bodyW, H = s.bodyH, D = s.bodyD, hs = s.headS, hy = H + hs * .62, hz = s.headF || 0;
  const dark = (c, k) => { const C2 = new T.Color(c).multiplyScalar(k || .75); return C2.getHex(); };
  const torn = (P2, n, rx, rz, y, col, cx, cz) => { for (let i = 0; i < n; i++) { const a = i / n * PI * 2 + R() * .3; P2.add(fringeG, col, (cx || 0) + Math.cos(a) * rx, y - R() * .03, (cz || 0) + Math.sin(a) * rz, (R() - .5) * .3, 0, (R() - .5) * .3, .8, .5 + R() * .8, .8); } };
  // ---- tronco
  const tq = new Part();
  tq.add(capG(.5, .6), L.shirt, 0, H / 2, 0, 0, 0, 0, B * .9, H / 1.6, D * .95);
  tq.add(sphHi, L.shirt, 0, H * .78, D * .05, 0, 0, 0, B * .95, H * .35, D * 1.0); // peito
  for (let i = 0; i < 4; i++) tq.add(sphG, dark(L.shirt, .5), 0, H * (.3 + i * .15), D * .49, 0, 0, 0, .022, .022, .012);
  for (const e of [-1, 1]) tq.add(sphG, L.shirt, e * B * .1, H * .96, D * .3, 0, 0, e * .5, B * .24, .05, .12); // gola
  if (L.plaid) { for (const e of [-1, 1]) tq.add(sphG, dark(L.shirt, .6), e * B * .28, H * .7, D * .42, 0, 0, 0, B * .14, .2, .04); tq.add(sphG, 0xc8c0a0, 0, H * .7, D * .43, 0, 0, 0, B * .26, H * .45, .04); for (let i = 0; i < 4; i++) tq.add(sphG, dark(L.shirt, .55), 0, H * (.22 + i * .2), 0, 0, 0, 0, B * .93, .02, D * .98); }
  if (L.jacketOn) { // paletó/casaco: costas e laterais arredondadas, frente aberta
    const jl = L.longCoat ? 1.45 : 1, jh = H * jl, jy = H - jh / 2 + .02;
    tq.add(capG(.5, .5), L.jacket, 0, jy, -D * .12, 0, 0, 0, B * 1.08, jh / 1.5, D * .95);
    for (const e of [-1, 1]) {
      tq.add(sphHi, L.jacket, e * B * .32, jy + jh * .05, D * .3, 0, e * .25, 0, B * .36, jh * .95, D * .42); // frente aberta
      tq.add(sphG, dark(L.jacket), e * B * .19, H * .82, D * .5, 0, 0, e * .5, B * .1, H * .3, .03); // lapela
      tq.add(sphHi, L.jacket, e * B * .42, H * .95, 0, 0, 0, 0, B * .44, .17, D * 1.12); // ombro
    }
    tq.add(sphG, dark(L.jacket), -B * .33, H * .3, D * .52, 0, 0, 0, B * .2, .045, .03); // bolso
    tq.add(sphG, 0x2a1e16, B * .36, H * .48, D * .5, 0, 0, 0, .05, .07, .02); // furo
    torn(tq, 24, B / 2 + .02, D / 2 + .05, jy - jh / 2 + .04, L.jacket);
  } else torn(tq, 16, B / 2, D / 2, .04, L.shirt);
  tq.add(sphG, 0x5a1414, B * .12, H * .55, D * .5, 0, 0, 0, B * .3, H * .22, .03); // sangue
  tq.add(sphG, 0x4a1010, -B * .2, H * .2, D * .49, 0, 0, 0, B * .22, H * .14, .03);
  tq.add(capG(.065, .1), L.skin, 0, H + .06, hz * .5, .25, 0, 0);
  // ---- cabeça: magra, queixo caído, olheiras, orelhas, cabelo ralo
  const hd = new Part();
  hd.add(sphHi, L.skin, 0, 0, 0, 0, 0, 0, hs * .92, hs * 1.18, hs * 1.0);
  hd.add(sphHi, L.skin, 0, -hs * .45, hs * .14, .3, 0, 0, hs * .55, hs * .36, hs * .62); // mandíbula caída
  hd.add(sphG, dark(L.skin, .85), 0, hs * .2, hs * .4, 0, 0, 0, hs * .7, hs * .14, hs * .22); // sobrancelha
  for (const e of [-1, 1]) {
    hd.add(sphG, 0x4a3a50, e * hs * .19, hs * .07, hs * .42, 0, 0, 0, hs * .3, hs * .24, hs * .14);
    hd.add(sphG, dark(L.skin, .8), e * hs * .3, -hs * .17, hs * .36, 0, 0, 0, hs * .17, hs * .26, hs * .1);
    hd.add(sphG, L.skin, e * hs * .47, 0, 0, 0, 0, 0, hs * .1, hs * .2, hs * .12);
  }
  hd.add(sphG, L.skin, 0, -hs * .04, hs * .5, .2, 0, 0, hs * .13, hs * .24, hs * .14); // nariz
  hd.add(sphG, 0x2a1214, 0, -hs * .36, hs * .42, 0, 0, 0, hs * .3, hs * .22, hs * .1); // boca
  hd.add(sphG, 0xc8c0a0, 0, -hs * .27, hs * .46, 0, 0, 0, hs * .24, hs * .05, hs * .05); // dentes
  hd.add(sphG, 0x6a1a14, -hs * .3, hs * .3, hs * .3, 0, 0, 0, hs * .16, hs * .12, hs * .06); // ferida
  hd.add(hairG, L.hair, 0, hs * .08, -hs * .04, 0, 0, 0, hs * 1.0, hs * 1.08, hs * 1.04);
  for (let i = 0; i < 20; i++) { const a = R() * PI * 2, up = .2 + R() * .9; hd.add(hairStrandG, L.hair, Math.cos(a) * hs * .4, hs * (.38 + up * .2), Math.sin(a) * hs * .4 - hs * .06, Math.sin(a) * (.6 + R()), 0, -Math.cos(a) * (.6 + R()), .8, .7 + R() * .9, .8); }
  tq.addPre(hd.build(), 0, hy, hz, .12, 0, .16);
  // ---- braço com cotovelo dobrado e mão com dedos
  const arm = (side) => {
    const a = new Part(), al = s.armLen, aw = s.armW, sl = L.jacketOn || L.plaid ? L.jacket : L.shirt, ua = al * .5, fa = al * .5, bend = .45;
    a.add(capG(aw * .55, ua - aw * .4), sl, 0, -ua / 2, 0);
    const ex = 0, ey = -ua, ez = 0; // cotovelo
    a.add(sphG, sl, ex, ey, ez, 0, 0, 0, aw * 1.1, aw * 1.1, aw * 1.1);
    const fy = ey - Math.cos(bend) * fa / 2, fz = ez + Math.sin(bend) * fa / 2;
    a.add(capG(aw * .5, fa * .45), sl, 0, ey - Math.cos(bend) * fa * .22, ez + Math.sin(bend) * fa * .22, -bend, 0, 0);
    torn(a, 8, aw * .5, aw * .5, ey - Math.cos(bend) * fa * .45, sl, 0, Math.sin(bend) * fa * .45);
    a.add(capG(aw * .36, fa * .45), L.skin, 0, fy - Math.cos(bend) * fa * .18, fz + Math.sin(bend) * fa * .18, -bend, 0, 0);
    const hx = 0, hy2 = ey - Math.cos(bend) * fa - .02, hz2 = ez + Math.sin(bend) * fa;
    a.add(sphG, L.skin, hx, hy2, hz2, -bend, 0, 0, aw * .95, aw * .55, aw * 1.0); // palma
    for (let f = 0; f < 4; f++) { const fx = (f - 1.5) * aw * .2; a.add(fingerG, L.skin, fx, hy2 - .05, hz2 + .05, -bend + .7, 0, 0); a.add(sphG, 0x4a3a30, fx, hy2 - .09, hz2 + .11, 0, 0, 0, .016, .016, .016); }
    a.add(fingerG, L.skin, side * aw * .45, hy2, hz2 + .03, .3, 0, side * .6);
    return a.build();
  };
  // ---- perna com joelho dobrado, rasgo no joelho e bota arredondada
  const leg = (side) => {
    const g = new Part(), ll = s.legLen, lw = s.legW, th = ll * .5, kb = .18;
    g.add(capG(lw * .52, th - lw * .5), L.pants, 0, -th / 2, 0);
    const ky = -th, kz = 0;
    g.add(sphG, L.pants, 0, ky, kz, 0, 0, 0, lw * 1.05, lw * 1.05, lw * 1.05);
    g.add(sphG, L.skin, side * .01, ky, lw * .4, 0, 0, 0, lw * .5, lw * .55, lw * .22); // joelho aparecendo
    torn(g, 7, lw * .3, lw * .08, ky + .03, L.pants, 0, lw * .44);
    g.add(capG(lw * .48, th - lw * .7), L.pants, 0, ky - th / 2 + .02, kz - Math.sin(kb) * th / 2, kb, 0, 0);
    torn(g, 10, lw * .52, lw * .52, -ll + .2, L.pants, 0, -Math.sin(kb) * th);
    const fz0 = -Math.sin(kb) * th;
    g.add(capG(lw * .5, .1), L.boots, 0, -ll + .13, fz0);
    g.add(sphHi, L.boots, 0, -ll + .06, fz0 + .06, 0, 0, 0, lw * 1.1, .14, lw * 1.9);
    g.add(sphG, 0x241a12, 0, -ll + .01, fz0 + .06, 0, 0, 0, lw * 1.16, .04, lw * 1.96); // sola
    for (let i = 0; i < 3; i++) g.add(sphG, 0x8a7a60, 0, -ll + .1 + i * .03, fz0 + lw * .5, 0, 0, 0, lw * .45, .014, .014);
    return g.build();
  };
  return (zGeoCache[key] = { torso: tq.build(), armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1) });
}
function makeZombieRig(type) {
  const s = ZTYPES[type].rig, G2 = zombieGeos(type, Math.floor(Math.random() * 3));
  const root = new T.Group(), mesh = (g, par) => { const m = new T.Mesh(g, zMat); if (SHADOWS) m.castShadow = true; par.add(m); return m; };
  const upper = new T.Group(); upper.position.y = s.legLen; root.add(upper);
  const legs = [-1, 1].map((k, i) => { const g = new T.Group(); g.position.set(k * s.bodyW * .24, s.legLen, 0); mesh(i ? G2.legR : G2.legL, g); root.add(g); return g; });
  const torso = new T.Group(); torso.rotation.x = s.hunch || 0; upper.add(torso); mesh(G2.torso, torso);
  // olhos brancos que brilham um pouco no escuro
  const hs = s.headS, hy = s.bodyH + hs * .62, hz = s.headF || 0;
  for (const e of [-1, 1]) { const ey = new T.Mesh(sphG, zEyeMat); ey.scale.set(hs * .14, hs * .12, hs * .06); ey.position.set(e * hs * .19 + .01, hy + hs * .08 - e * .012, hz + hs * .47); torso.add(ey); }
  const arms = [-1, 1].map((k, i) => { const g = new T.Group(); g.position.set(k * (s.bodyW / 2 + s.armW * .35), s.bodyH * .85, 0); mesh(i ? G2.armR : G2.armL, g); torso.add(g); return g; });
  if (!SHADOWS) { const b = new T.Mesh(blobG, blobMat); b.scale.set(s.bodyW * 2, 1, s.bodyW * 2); b.position.y = .03; b.renderOrder = -1; root.add(b); }
  scene.add(root);
  return { root, legs, arms, torso, head: torso, s };
}
// ---------------------------------------------------------------- animais da fazenda
const ATYPES = {
  galinha: { hp: 8, vel: 2.6, carne: 0, r: .25, medo: 3.5 },
  porco: { hp: 45, vel: 1.9, carne: 3, r: .45, medo: 3 },
  vaca: { hp: 90, vel: 1.4, carne: 5, r: .7, medo: 2.4 },
};
const aGeoCache = {};
function animalGeos(type) {
  if (aGeoCache[type]) return aGeoCache[type];
  const body = new Part(), legsF = new Part(), legsB = new Part();
  if (type === 'galinha') {
    body.add(sphG, 0xf2efe6, 0, .32, 0, 0, 0, 0, .34, .3, .42);
    body.add(sphG, 0xf2efe6, 0, .5, .16, 0, 0, 0, .18, .2, .18);
    body.add(boxG, 0xd02a20, 0, .62, .17, 0, 0, 0, .03, .08, .12);
    body.add(boxG, 0xd02a20, 0, .45, .26, 0, 0, 0, .03, .06, .04);
    body.add(boxG, 0xe8b030, 0, .5, .28, 0, 0, 0, .05, .04, .08);
    for (const e of [-1, 1]) { body.add(sphG, 0x111111, e * .07, .53, .23, 0, 0, 0, .03, .03, .02); body.add(sphG, 0xe6e2d8, e * .17, .33, -.02, 0, 0, 0, .06, .18, .26); }
    body.add(boxG, 0xe6e2d8, 0, .42, -.22, -.6, 0, 0, .14, .16, .06);
    for (const e of [-1, 1]) legsF.add(boxG, 0xe8b030, e * .07, -.08, 0, 0, 0, 0, .025, .18, .025);
  } else if (type === 'porco') {
    body.add(capG(.5, .9), 0xe8a8a0, 0, .55, 0, PI / 2, 0, 0, .55, .5, .5);
    body.add(sphG, 0xe8a8a0, 0, .62, .62, 0, 0, 0, .38, .36, .36);
    body.add(cylG, 0xd88a88, 0, .58, .82, PI / 2, 0, 0, .16, .06, .12);
    for (const e of [-1, 1]) { body.add(sphG, 0x2a1a1a, e * .06, .58, .86, 0, 0, 0, .03, .04, .02); body.add(sphG, 0x111111, e * .1, .72, .76, 0, 0, 0, .04, .04, .03); body.add(boxG, 0xd88a88, e * .14, .82, .6, .5, 0, e * .4, .12, .14, .03); }
    body.add(torusG, 0xd88a88, 0, .7, -.72, 0, PI / 2, 0, .08, .08, .08);
    for (const e of [-1, 1]) { legsF.add(cylG, 0xd89890, e * .17, -.15, 0, 0, 0, 0, .1, .32, .1); legsB.add(cylG, 0xd89890, e * .17, -.15, 0, 0, 0, 0, .1, .32, .1); }
  } else {
    body.add(capG(.5, 1.2), 0xf0ece4, 0, 1.05, 0, PI / 2, 0, 0, .8, .7, .7);
    for (const [px, py, pz, s2] of [[.25, 1.2, .3, .4], [-.3, 1.0, -.4, .45], [.1, 1.3, -.7, .3], [-.25, 1.25, .55, .3]]) body.add(sphG, 0x1e1e1e, px, py, pz, 0, 0, 0, s2 * 1.6, s2, s2 * 1.4);
    body.add(boxG, 0xf0ece4, 0, 1.2, 1.05, -.3, 0, 0, .36, .42, .55);
    body.add(boxG, 0xd8a8a0, 0, 1.06, 1.33, -.3, 0, 0, .3, .2, .14);
    for (const e of [-1, 1]) { body.add(sphG, 0x111111, e * .16, 1.3, 1.18, 0, 0, 0, .05, .05, .04); body.add(boxG, 0xe8e0c8, e * .2, 1.48, .98, 0, 0, e * .6, .05, .18, .05); body.add(boxG, 0x1e1e1e, e * .26, 1.36, .95, 0, 0, e * 1.1, .05, .16, .1); }
    body.add(sphG, 0xe8a8a8, 0, .7, -.25, 0, 0, 0, .3, .18, .3);
    body.add(cylG, 0x1e1e1e, 0, .9, -1.05, .4, 0, 0, .04, .7, .04);
    for (const e of [-1, 1]) { legsF.add(cylG, 0xf0ece4, e * .22, -.35, 0, 0, 0, 0, .16, .7, .16); legsF.add(boxG, 0x2a2a2a, e * .22, -.68, 0, 0, 0, 0, .17, .08, .17); legsB.add(cylG, 0xf0ece4, e * .22, -.35, 0, 0, 0, 0, .16, .7, .16); legsB.add(boxG, 0x2a2a2a, e * .22, -.68, 0, 0, 0, 0, .17, .08, .17); }
  }
  return (aGeoCache[type] = { body: body.build(), legsF: legsF.build(), legsB: legsB.list.length ? legsB.build() : null });
}
function spawnAnimal(type, x, z, home, area) {
  const G2 = animalGeos(type), root = new T.Group();
  const mk = (g) => { const m = new T.Mesh(g, zMat); if (SHADOWS) m.castShadow = true; return m; };
  root.add(mk(G2.body));
  const hipY = type === 'vaca' ? .72 : type === 'porco' ? .32 : .18, zf = type === 'vaca' ? .65 : type === 'porco' ? .35 : 0, zb = type === 'vaca' ? -.65 : -.35;
  const lf = new T.Group(); lf.position.set(0, hipY, zf); lf.add(mk(G2.legsF)); root.add(lf);
  let lb = null; if (G2.legsB) { lb = new T.Group(); lb.position.set(0, hipY, zb); lb.add(mk(G2.legsB)); root.add(lb); }
  if (!SHADOWS) { const b = new T.Mesh(blobG, blobMat); const s2 = type === 'vaca' ? 2.4 : type === 'porco' ? 1.4 : .7; b.scale.set(s2 * .7, 1, s2); b.position.y = .03; root.add(b); }
  scene.add(root);
  const a = { type, x, z, rot: Math.random() * 6, hp: ATYPES[type].hp, dead: false, deadT: 0, root, lf, lb, home, area, t: Math.random() * 3, tx: x, tz: z, phase: 0, moving: false };
  animals.push(a); return a;
}
function removeAnimal(a) { scene.remove(a.root); const i = animals.indexOf(a); if (i >= 0) animals.splice(i, 1); }
function spawnChunkAnimals(ch) {
  if (!ch.animalsBase) return;
  const d = deltas[ch.key], gone = (d && d.a) || {};
  for (const type in ch.animalsBase) {
    const n = ch.animalsBase[type] - (gone[type] || 0), area = type === 'galinha' ? ch.chickenArea : ch.pen;
    for (let i = 0; i < n; i++) spawnAnimal(type, rr(area.x0 + 1, area.x1 - 1), rr(area.z0 + 1, area.z1 - 1), ch.key, area);
  }
}
function animalGone(a) { const d = deltaOf(a.home); d.a = d.a || {}; d.a[a.type] = (d.a[a.type] || 0) + 1; }
function updateAnimal(a, dt) {
  if (a.dead) { a.deadT += dt; return; }
  const A = ATYPES[a.type], dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz);
  let sp = 0, tx = a.tx, tz = a.tz;
  if (!P.dead && d < A.medo && (!P.crouch || d < A.medo * .5)) { tx = a.x + dx / (d || 1) * 4; tz = a.z + dz / (d || 1) * 4; sp = A.vel; a.t = 1.5; }
  else { a.t -= dt; if (a.t <= 0) { a.t = rr(2, 6); a.idle = Math.random() < .45; a.tx = rr(a.area.x0 + .5, a.area.x1 - .5); a.tz = rr(a.area.z0 + .5, a.area.z1 - .5); } if (!a.idle) sp = A.vel * .3; tx = a.tx; tz = a.tz; }
  const mx = tx - a.x, mz = tz - a.z, m = Math.hypot(mx, mz);
  a.moving = sp > 0 && m > .3;
  if (a.moving) { a.x += mx / m * sp * dt; a.z += mz / m * sp * dt; a.rot = angLerp(a.rot, Math.atan2(mx, mz), Math.min(1, dt * 6)); a.phase += dt * sp * 6; }
  collide(a, A.r);
  if (a.area) { a.x = clamp(a.x, a.area.x0 - 6, a.area.x1 + 6); a.z = clamp(a.z, a.area.z0 - 6, a.area.z1 + 6); }
}
function hitAnimal(a, dmg) {
  if (a.dead) return; a.hp -= dmg; a.t = 0;
  const dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz) || 1; a.x += dx / d * .5; a.z += dz / d * .5;
  if (a.hp <= 0) { a.dead = true; a.deadT = 0; if (a.type === 'galinha') { log('Você abateu uma galinha.'); a.carne = 1; } else { a.carne = ATYPES[a.type].carne; log('Você abateu um' + (a.type === 'vaca' ? 'a vaca' : ' porco') + '. Pegue a carne.'); } animalGone(a); }
}
function animAnimal(a) {
  a.root.position.set(a.x, 0, a.z); a.root.rotation.set(0, a.rot, 0); a.root.rotation.order = 'YXZ';
  if (a.dead) { a.root.rotation.z = PI / 2 * Math.min(1, a.deadT * 3); a.root.position.y = a.type === 'vaca' ? .4 : .15; return; }
  const sw = a.moving ? Math.sin(a.phase) * .5 : 0;
  a.lf.rotation.x = sw; if (a.lb) a.lb.rotation.x = -sw;
  if (a.type === 'galinha' && !a.moving) a.root.rotation.x = Math.max(0, Math.sin(simTime * 3 + a.x)) * .35; // bicando o chão
}

// ================================================================ VEÍCULOS (dirigíveis, com peças e gasolina)
const vehicles = [], pumps = [];
const carMat = new T.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x3a3a3a }); // pintura limpa com brilho
const wheelMat = new T.MeshLambertMaterial({ vertexColors: true });
const VT = { // tipos: comprimento, largura, velocidade máx (m/s), nome
  sedan: { L: 4.4, W: 1.8, max: 17, n: 'Sedã' }, taxi: { L: 4.4, W: 1.8, max: 17, n: 'Táxi' }, policia: { L: 4.5, W: 1.85, max: 20, n: 'Viatura' },
  pickup: { L: 4.8, W: 1.9, max: 15, n: 'Picape' }, limo: { L: 6.4, W: 1.9, max: 14, n: 'Limusine' }, van: { L: 4.9, W: 2.0, max: 13, n: 'Van' },
  ambulancia: { L: 5.4, W: 2.1, max: 15, n: 'Ambulância' }, caminhao: { L: 6.2, W: 2.2, max: 11, n: 'Caminhãozinho' }, bombeiros: { L: 7.2, W: 2.4, max: 11, n: 'Caminhão de bombeiros' },
};
const extrudeSide = (pts, W, bev) => { const sh = new T.Shape(); pts.forEach((p, i) => i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])); sh.closePath(); const b = bev == null ? .05 : bev; const g = new T.ExtrudeGeometry(sh, { depth: W, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 3 }); g.translate(0, 0, -W / 2); return g; };
const archG = new T.CylinderGeometry(.5, .5, 1, 14, 1, false, -PI / 2, PI); // meia roda: caixa de roda
const vGeoCache = {};
const wheelAxles = (type) => { const t = VT[type], h = t.L / 2, big = type === 'caminhao' || type === 'bombeiros'; return { r: big ? .46 : .36, ax: type === 'limo' ? [h - .85, -h + .85] : big ? [h - .9, -h + 1.1] : [h - .85, -h + .8] }; };
function vehicleGeo(type, color) {
  const key = type + color; if (vGeoCache[key]) return vGeoCache[key];
  const t = VT[type], L = t.L, W = t.W, h = L / 2, P2 = new Part(); P2.flat = true;
  const glass = 0x26323e, chrome = 0xc4c8cc, dark = 0x1a1b1d, plastic = 0x2c2d30, side = W / 2 + .05;
  const dk = (c, f) => new T.Color(c).multiplyScalar(f).getHex(), seam = dk(color, .62);
  const seg = (x1, y1, x2, y2, z, th, wd, col) => { const dx = x2 - x1, dy = y2 - y1; P2.add(boxG, col, (x1 + x2) / 2, (y1 + y2) / 2, z, 0, 0, Math.atan2(dy, dx), Math.hypot(dx, dy) + .02, th, wd); };
  const { r, ax } = wheelAxles(type);
  // cabine de vidro com teto e colunas na cor do carro (vidros visíveis de cima e de lado)
  const house = (x1, x2, x3, x4, yb, yt, Wg, bPil) => {
    P2.add(extrudeSide([[x1, yb], [x2, yt], [x3, yt], [x4, yb]], Wg, .03), glass);
    P2.add(boxG, color, (x2 + x3) / 2, yt + .03, 0, 0, 0, 0, x2 - x3 + .1, .07, Wg + .1);
    for (const e of [-1, 1]) {
      const z = e * (Wg / 2 + .04);
      seg(x1, yb, x2, yt, z, .1, .06, color); seg(x4, yb, x3, yt, z, .16, .06, color);
      for (const bx of bPil) P2.add(boxG, color, bx, (yb + yt) / 2, z, 0, 0, 0, .1, yt - yb, .06);
      P2.add(boxG, color, x1 - .12, yb + .1, e * (Wg / 2 + .22), 0, 0, 0, .1, .1, .16); // retrovisor
      P2.add(boxG, dark, x1 - .12, yb + .1, e * (Wg / 2 + .3), 0, 0, 0, .06, .08, .02);
    }
    seg(x1, yb, x2, yt, 0, .03, Wg + .02, dk(color, .8)); // friso do para-brisa
  };
  const arches = (y0) => { for (const x of ax) for (const e of [-1, 1]) P2.add(archG, dark, x, y0 == null ? r : y0, e * side, -PI / 2, 0, 0, r * 2.35, .02, r * 2.35); };
  const doors = (xs, y0, y1, handles) => { for (const e of [-1, 1]) { for (const x of xs) P2.add(boxG, seam, x, (y0 + y1) / 2, e * side, 0, 0, 0, .025, y1 - y0, .012); for (const x of handles) P2.add(boxG, chrome, x, y1 - .1, e * (side + .01), 0, 0, 0, .16, .035, .02); } };
  const front = (y, wl) => { // faróis, grade e placas
    for (const e of [-1, 1]) {
      P2.add(boxG, plastic, h + .04, y, e * W * .32, 0, 0, 0, .05, .2, .38); P2.add(boxG, 0xfff6d8, h + .065, y, e * W * .32, 0, 0, 0, .02, .14, .3);
      P2.add(boxG, 0xf0a020, h + .06, y - .14, e * W * .4, 0, 0, 0, .02, .05, .12); // pisca
      P2.add(boxG, 0x8a1010, -h - .04, y, e * W * .35, 0, 0, 0, .05, .18, .3); P2.add(boxG, 0xe03030, -h - .065, y, e * W * .35, 0, 0, 0, .02, .13, .24);
    }
    P2.add(boxG, plastic, h + .04, y, 0, 0, 0, 0, .04, .18, wl || W * .4);
    for (let i = 0; i < 3; i++) P2.add(boxG, 0x55585c, h + .065, y - .05 + i * .05, 0, 0, 0, 0, .01, .015, (wl || W * .4) - .06);
    for (const s of [1, -1]) { P2.add(boxG, 0xeeeee6, s * (h + .1), y - .26, 0, 0, 0, 0, .02, .13, .4); P2.add(boxG, 0x30343a, s * (h + .112), y - .26, 0, 0, 0, 0, .005, .05, .28); }
  };
  const bumpers = (y) => { for (const s of [1, -1]) { P2.add(boxG, plastic, s * (h + .05), y, 0, 0, 0, 0, .14, .16, W + .04); P2.add(boxG, chrome, s * (h + .125), y + .03, 0, 0, 0, 0, .01, .03, W * .9); } };
  const skirt = (y, len) => { for (const e of [-1, 1]) P2.add(boxG, plastic, 0, y, e * (side - .01), 0, 0, 0, len, .1, .02); };
  if (type === 'van' || type === 'ambulancia') {
    P2.add(extrudeSide([[-h, .3], [h, .3], [h + .05, .82], [h - .2, 1.08], [h - .9, 1.9], [-h, 1.95]], W), color);
    P2.add(extrudeSide([[h - .2, 1.12], [h - .82, 1.86], [h - .95, 1.86], [h - .3, 1.1]], W - .3, .03), glass); // para-brisa
    for (const e of [-1, 1]) {
      P2.add(boxG, glass, h - .95, 1.45, e * side, 0, 0, 0, .7, .5, .02); // janela da porta
      for (const x of [.25, -.75, -1.7]) if (x < h - 1.45 && x > -h + .45 && type === 'van') P2.add(boxG, glass, x, 1.48, e * side, 0, 0, 0, .8, .44, .02);
    }
    P2.add(boxG, glass, -h - .045, 1.5, 0, 0, 0, 0, .02, .48, W * .32 * 2); P2.add(boxG, seam, -h - .05, 1.15, 0, 0, 0, 0, .012, 1.5, .025); // vidro e vão da porta traseira
    P2.add(boxG, dk(color, .85), -.2, 1.97, 0, 0, 0, 0, L - 1.4, .05, W - .2); // teto
    doors([h - .6, h - 1.35, -h + .15], .45, 1.85, [h - 1.25, h - 1.5]);
    if (type === 'ambulancia') { for (const e of [-1, 1]) { P2.add(boxG, 0xc02020, -.2, .95, e * (side + .005), 0, 0, 0, L * .88, .16, .012); P2.add(boxG, 0xc02020, -.9, 1.5, e * (side + .006), 0, 0, 0, .14, .5, .012); P2.add(boxG, 0xc02020, -.9, 1.5, e * (side + .006), 0, 0, 0, .5, .14, .012); } P2.add(boxG, plastic, h - 1.2, 2.03, 0, 0, 0, 0, .3, .08, W * .72); for (const e of [-1, 1]) P2.add(boxG, 0xe02020, h - 1.2, 2.11, e * W * .2, 0, 0, 0, .26, .1, W * .3); }
    front(.7); bumpers(.4); arches(); skirt(.36, L * .5);
  } else if (type === 'caminhao' || type === 'bombeiros') {
    const cab = 1.9, bx = -h + (L - cab) / 2, bl = L - cab - .1;
    P2.add(extrudeSide([[h - cab, .45], [h, .45], [h + .05, .95], [h - .15, 1.2], [h - .5, 2.1], [h - cab, 2.15]], W), color);
    P2.add(extrudeSide([[h - .14, 1.24], [h - .46, 2.04], [h - .6, 2.04], [h - .26, 1.22]], W - .3, .03), glass);
    for (const e of [-1, 1]) { P2.add(boxG, glass, h - 1.05, 1.68, e * side, 0, 0, 0, .75, .5, .02); P2.add(boxG, plastic, h - .4, 1.7, e * (side + .2), 0, 0, 0, .06, .4, .1); }
    doors([h - .55, h - 1.55], .6, 2.05, [h - 1.4]);
    if (type === 'bombeiros') {
      P2.add(extrudeSide([[bx - bl / 2, .55], [bx + bl / 2, .55], [bx + bl / 2, 2.35], [bx - bl / 2, 2.35]], W), color);
      for (const e of [-1, 1]) { for (let i = 0; i < 3; i++) P2.add(boxG, 0xbfc3c7, bx - bl * .32 + i * (bl * .32), 1.45, e * side, 0, 0, 0, bl * .28, 1.1, .02); P2.add(boxG, 0xf2f2ea, bx, .78, e * (side + .005), 0, 0, 0, bl, .1, .012); P2.add(boxG, 0xf2f2ea, h - cab / 2, .78, e * (side + .005), 0, 0, 0, cab - .2, .1, .012); }
      P2.add(boxG, 0xb8bcc0, bx, 2.48, 0, 0, 0, 0, bl - .3, .07, .5); for (let i = 0; i < 9; i++) P2.add(boxG, 0x9a9ea2, bx - bl / 2 + .35 + i * (bl - .7) / 8, 2.53, 0, 0, 0, 0, .05, .05, .5); for (const e of [-1, 1]) P2.add(boxG, 0x9a9ea2, bx, 2.53, e * .25, 0, 0, 0, bl - .3, .05, .05);
      P2.add(boxG, plastic, h - .9, 2.19, 0, 0, 0, 0, .3, .08, W * .7); for (const e of [-1, 1]) P2.add(boxG, e < 0 ? 0xe02020 : 0x2a5ae0, h - .9, 2.27, e * W * .18, 0, 0, 0, .26, .1, W * .3);
    } else {
      P2.add(extrudeSide([[bx - bl / 2, .62], [bx + bl / 2, .62], [bx + bl / 2, 2.5], [bx - bl / 2, 2.5]], W, .03), 0xe6e2d8); // baú
      for (const e of [-1, 1]) for (let i = 1; i < 6; i++) P2.add(boxG, 0xc8c4ba, bx - bl / 2 + i * bl / 6, 1.56, e * (W / 2 + .035), 0, 0, 0, .04, 1.8, .012);
      P2.add(boxG, 0xc8c4ba, -h - .02, 1.56, 0, 0, 0, 0, .02, 1.8, .02); for (const e of [-1, 1]) P2.add(boxG, 0x8a8a8a, -h - .03, 1.56, e * .3, 0, 0, 0, .02, 1.6, .03);
    }
    P2.add(boxG, dark, 0, .5, 0, 0, 0, 0, L - .2, .22, W * .7); // chassi
    front(.82, W * .55); bumpers(.5); arches();
  } else if (type === 'pickup') {
    P2.add(extrudeSide([[-h, .32], [h, .32], [h + .05, .62], [h - .1, .86], [h - 1.15, .96], [h - 2.6, .98], [-h, .98], [-h - .05, .6]], W), color);
    house(h - 1.15, h - 1.68, h - 2.42, h - 2.58, .96, 1.46, W - .22, [h - 2.05]);
    P2.add(boxG, dark, -h + 1.0, 1.0, 0, 0, 0, 0, 1.95, .02, W - .3); // caçamba
    for (const e of [-1, 1]) P2.add(boxG, color, -h + 1.0, 1.05, e * (W / 2 - .07), 0, 0, 0, 1.95, .12, .14);
    P2.add(boxG, color, -h + .08, 1.05, 0, 0, 0, 0, .14, .12, W - .1); P2.add(boxG, dk(color, .9), h - 2.62, 1.12, 0, 0, 0, 0, .1, .2, W - .1);
    doors([h - 1.2, h - 2.55], .42, .92, [h - 2.35]);
    front(.66); bumpers(.42); arches(); skirt(.36, L * .38);
  } else { // sedã, táxi, viatura, limusine
    const limo = type === 'limo', x1 = h - 1.15, x4 = -h + 1.0, x2 = h - 1.72, x3 = -h + 1.55, yt = 1.36;
    P2.add(extrudeSide([[-h, .3], [h, .3], [h + .05, .58], [h - .05, .8], [x1, .9], [x4, .92], [-h, .86], [-h - .05, .58]], W), color);
    const bp = []; const n = limo ? 4 : 2; for (let i = 1; i < n; i++) bp.push(lerp(x2, x3, i / n));
    house(x1, x2, x3, x4, .9, yt, W - .26, bp);
    const ds = [x1 + .05]; for (const b of bp) ds.push(b); ds.push(x4 + .2);
    doors(ds, .42, .86, bp.map(b => b + .2).concat([x2 + .05]));
    P2.add(boxG, dk(color, .85), h - .58, .83, 0, 0, 0, Math.atan2(.1, 1.1) * 0, .9, .015, W * .55); // vinco do capô
    for (const e of [-1, 1]) P2.add(boxG, chrome, 0, .62, e * (side + .005), 0, 0, 0, L * .82, .03, .012);
    if (type === 'taxi') { P2.add(boxG, 0xf4f4ea, -.1, yt + .15, 0, 0, 0, 0, .5, .18, .32); P2.add(boxG, 0x222222, -.1, yt + .15, 0, 0, 0, 0, .3, .08, .33); for (const e of [-1, 1]) for (let i = 0; i < 10; i++) P2.add(boxG, i % 2 ? 0x141414 : 0xf4f4ea, -1.35 + i * .27, .72, e * (side + .006), 0, 0, 0, .27, .09, .012); }
    if (type === 'policia') { for (const e of [-1, 1]) { P2.add(boxG, 0xf2f2f2, -.15, .64, e * (side + .006), 0, 0, 0, 2.3, .4, .012); P2.add(boxG, 0x1a1a1a, -.15, .66, e * (side + .009), 0, 0, 0, .7, .1, .012); } P2.add(boxG, plastic, -.1, yt + .1, 0, 0, 0, 0, .3, .07, 1.2); P2.add(boxG, 0xe02020, -.1, yt + .17, -.33, 0, 0, 0, .26, .09, .5); P2.add(boxG, 0x2a5ae0, -.1, yt + .17, .33, 0, 0, 0, .26, .09, .5); }
    front(.62); bumpers(.4); arches(); skirt(.36, L * .45);
  }
  return (vGeoCache[key] = P2.build());
}
const wGeoCache = {};
function wheelGeo(type, flat) {
  const key = type + flat; if (wGeoCache[key]) return wGeoCache[key];
  const t = VT[type], W = t.W, { r, ax } = wheelAxles(type), P2 = new Part(); P2.flat = true;
  let i = 0;
  for (const x of ax) for (const e of [-1, 1]) {
    const f = i++ === flat, rr3 = f ? r * .78 : r, z = e * (W / 2 - .12);
    P2.add(cylG, 0x181818, x, rr3, z, PI / 2, 0, 0, rr3 * 2, .26, rr3 * 2); // pneu
    P2.add(cylG, 0x2a2a2a, x, rr3, z + e * .135, PI / 2, 0, 0, rr3 * 1.7, .01, rr3 * 1.7); // flanco
    P2.add(cylG, 0xc0c4c8, x, rr3, z + e * .14, PI / 2, 0, 0, rr3 * 1.15, .03, rr3 * 1.15); // aro
    P2.add(cylG, 0x5a5e62, x, rr3, z + e * .16, PI / 2, 0, 0, rr3 * .38, .03, rr3 * .38); // cubo
  }
  return (wGeoCache[key] = P2.build());
}
let vehN = 0;
function makeCar(x, z, v, cc, nome, loot, big) {
  const id = CUR ? CUR.key + '#' + (CUR.vn = (CUR.vn || 0) + 1) : 'v' + (vehN++);
  if (vehicles.some(o => Math.hypot(o.x - x, o.z - z) < 6)) return null; // não empilhar carros
  let type = nome === 'Viatura' ? 'policia' : nome === 'Ambulância' ? 'ambulancia' : nome === 'Caminhão de bombeiros' ? 'bombeiros' : nome === 'Caminhão' ? 'caminhao' : null;
  if (!type) { const r = wr(); type = r < .42 ? 'sedan' : r < .54 ? 'taxi' : r < .72 ? 'pickup' : r < .86 ? 'van' : r < .96 ? 'caminhao' : 'limo'; }
  const PAL = { sedan: [0xd8dcd8, 0x1e1e22, 0x4a4e54, 0x8a2a2a, 0x2a3a5a, 0x6a6a4a, 0xa89a7a], taxi: [0xf0c020], policia: [0x1a1e2a], pickup: [0x7a7a5a, 0x8a3a2a, 0x3a4a6a, 0xd8d4c8], limo: [0xeceae6, 0x1a1a1e], van: [0xe8e4dc, 0x6a8aa8, 0x8a8a6a, 0xa86a3a], ambulancia: [0xf2f0ea], caminhao: [0x3a5a8a, 0xc8c4b8, 0x8a2a2a, 0x4a6a4a], bombeiros: [0xc02a20] };
  const color = PAL[type][Math.floor(wr() * PAL[type].length)];
  // problemas: alguns 100%, outros faltando algo
  const r = wr(), st = { fuel: Math.round(rr2(.15, .7) * 100), bat: true, vela: true, pneu: -1 };
  if (r < .2) st.bat = false; else if (r < .38) st.vela = false; else if (r < .55) st.pneu = Math.floor(wr() * 4); else if (r < .72) st.fuel = 0;
  const veh = { id, type, x, z, rot: v ? 0 : PI / 2, speed: 0, color, st, ch: CUR, items: rollLoot(loot || 'carro'), nome: VT[type].n };
  if (CUR && CUR.zone === 'inicio' && !CUR.startCar) { CUR.startCar = veh; st.bat = st.vela = true; st.pneu = -1; st.fuel = 30; }
  const saved = S && S.veh && S.veh[id]; if (saved) { if (saved.moved) return null; Object.assign(veh, saved); }
  buildVehicle(veh, ROOT);
  return veh;
}
function buildVehicle(veh, parent) {
  const g = new T.Group(), body = new T.Mesh(vehicleGeo(veh.type, veh.color), carMat), wh = new T.Mesh(wheelGeo(veh.type, veh.st.pneu), wheelMat);
  if (SHADOWS) { body.castShadow = wh.castShadow = true; }
  g.add(body, wh); g.position.set(veh.x, 0, veh.z); g.rotation.y = veh.rot - PI / 2; parent.add(g); veh.g = g; veh.wh = wh;
  veh.cont = { nome: veh.nome + ': porta-malas', x: veh.x, z: veh.z, hx: .1, hz: .1, items: veh.items, veh, isTrunk: true, ch: veh.ch };
  vehicles.push(veh); setVehCols(veh, true);
}
function vehCircles(v) { const t = VT[v.type], n = Math.max(3, Math.round(t.L / 1.6)), out = []; for (let i = 0; i < n; i++) { const o = lerp(-t.L / 2 + t.W / 2, t.L / 2 - t.W / 2, i / (n - 1)); out.push([v.x + Math.sin(v.rot) * o, v.z + Math.cos(v.rot) * o, t.W / 2]); } return out; }
function setVehCols(v, on) {
  if (v.cols) for (const c of v.cols) removeCol(c); v.cols = [];
  if (!on) return;
  const C0 = CUR; if (!v.ch) CUR = null;
  for (const [x, z, r] of vehCircles(v)) v.cols.push(addCol({ cx: x, cz: z, r, veh: v }));
  CUR = C0;
}
function markVeh(v) { if (!S.veh) S.veh = {}; S.veh[v.id] = { type: v.type, color: v.color, x: v.x, z: v.z, rot: v.rot, st: v.st, items: v.items, moved: !!v.moved }; netSend('veh', { id: v.id, sv: S.veh[v.id] }); }
const vehProblem = (v) => !v.st.bat ? 'Sem bateria. Ache uma bateria de carro.' : !v.st.vela ? 'Falta a vela de ignição.' : v.st.pneu >= 0 ? 'Um pneu está furado. Troque o pneu.' : v.st.fuel <= 0 ? 'Sem gasolina.' : null;
function nearVehicle() { let best = null, bd = 2.0; for (const v of vehicles) { if (v === P.drive || v.remoteDrive) continue; for (const [x, z, r] of vehCircles(v)) { const d = Math.hypot(P.x - x, P.z - z) - r; if (d < bd) { bd = d; best = v; } } } return best; }
function nearPump() { return pumps.find(p => Math.hypot(P.x - p.x, P.z - p.z) < 6 || (P.drive && Math.hypot(P.drive.x - p.x, P.drive.z - p.z) < 6)); }
// ---- painel do carro
function openCar(v) {
  closePanels(); openPanel = 'car'; curCar = v; renderCar(); $('pBox').style.display = 'block';
}
let curCar = null;
function renderCar() {
  const v = curCar, st = v.st, ok = (b) => b ? '<span style="color:#7ad07a">ok</span>' : '<span style="color:#ff7a6a">faltando</span>';
  const btn = (a, label, en) => `<button class="pb g" data-a="${a}" ${en ? '' : 'disabled'}>${label}</button>`;
  let h = `<button class="pb close" data-a="close">Fechar</button><h2>${v.nome}</h2>`;
  h += `<div class="row"><span class="n">Gasolina</span><b style="color:${st.fuel > 0 ? '#e8e4d8' : '#ff7a6a'}">${Math.round(st.fuel)}%</b></div>`;
  h += `<div class="row"><span class="n">Bateria</span>${ok(st.bat)}</div><div class="row"><span class="n">Vela de ignição</span>${ok(st.vela)}</div>`;
  h += `<div class="row"><span class="n">Pneus</span>${st.pneu < 0 ? ok(true) : '<span style="color:#ff7a6a">1 furado</span>'}</div>`;
  h += '<h3>Ações</h3><div style="display:flex;flex-wrap:wrap;gap:6px">';
  h += btn('drive', 'Entrar e dirigir', true) + btn('trunk', 'Porta-malas', true);
  if (!st.bat) h += btn('pbat', 'Instalar bateria', count('bateria') > 0);
  if (!st.vela) h += btn('pvela', 'Instalar vela', count('vela') > 0);
  if (st.pneu >= 0) h += btn('ppneu', 'Trocar pneu', count('pneu') > 0);
  if (st.fuel < 100) h += btn('galao', 'Abastecer com galão', count('galaocheio') > 0) + btn('bomba', 'Abastecer na bomba', !!nearPump());
  if (st.bat) h += btn('tbat', 'Tirar a bateria', true);
  if (st.vela) h += btn('tvela', 'Tirar a vela', true);
  h += '</div><div style="font-size:12px;opacity:.7;margin-top:8px">Peças aparecem em lojas de ferragens, armazéns, postos e porta-malas. Gasolina: encha um galão na bomba de um posto.</div>';
  $('pBox').innerHTML = h;
}
function carAction(a) {
  const v = curCar; if (!v) return;
  const done = (msg) => () => { markVeh(v); log(msg); };
  if (a === 'drive') { closePanels(); enterCar(v); return; }
  if (a === 'trunk') { openBox(v.cont); return; }
  if (a === 'pbat') startAction('Instalando bateria', 4, 'martelar', () => { if (!count('bateria')) return; itemRemove(P.inv, 'bateria', 1); v.st.bat = true; done('Bateria instalada.')(); });
  if (a === 'pvela') startAction('Instalando vela', 3, 'mexer', () => { if (!count('vela')) return; itemRemove(P.inv, 'vela', 1); v.st.vela = true; done('Vela instalada.')(); });
  if (a === 'ppneu') startAction('Trocando o pneu', 6, 'martelar', () => { if (!count('pneu')) return; itemRemove(P.inv, 'pneu', 1); v.st.pneu = -1; v.wh.geometry = wheelGeo(v.type, -1); done('Pneu trocado.')(); });
  if (a === 'galao') startAction('Abastecendo', 3, 'mexer', () => { if (!count('galaocheio')) return; itemRemove(P.inv, 'galaocheio', 1); itemAdd(P.inv, 'galao', 1); v.st.fuel = Math.min(100, v.st.fuel + 35); done(`Tanque em ${Math.round(v.st.fuel)}%.`)(); });
  if (a === 'bomba') startAction('Abastecendo na bomba', 5, 'mexer', () => { v.st.fuel = 100; done('Tanque cheio!')(); });
  if (a === 'tbat') startAction('Tirando a bateria', 4, 'martelar', () => { if (!v.st.bat) return; v.st.bat = false; itemAdd(P.inv, 'bateria', 1); done('Você tirou a bateria.')(); });
  if (a === 'tvela') startAction('Tirando a vela', 3, 'mexer', () => { if (!v.st.vela) return; v.st.vela = false; itemAdd(P.inv, 'vela', 1); done('Você tirou a vela.')(); });
}
// ---- dirigir
function enterCar(v) {
  const prob = vehProblem(v);
  P.rot = Math.atan2(v.x - P.x, v.z - P.z);
  startAction('Entrando no carro', .8, 'mexer', () => {
    P.drive = v; P.lv = 0; P.crouch = false; P.run = false; P.luz = false; v.speed = 0; setVehCols(v, false);
    if (!v.moved) { // o carro sai do pedaço e passa a existir no mundo todo
      v.moved = true; const p = v.g.parent; if (p) p.remove(v.g); scene.add(v.g);
      if (v.ch) { v.ch = null; v.cont.ch = null; }
    }
    markVeh(v); P.zoom0 = viewH; setZoom(Math.max(viewH, 26));
    log(prob ? 'O carro não liga: ' + prob : 'Motor ligado! Use o joystick para dirigir.');
    v.dead = !!prob; noise(v.x, v.z, prob ? 4 : 14);
  });
}
function exitCar() {
  const v = P.drive; if (!v) return;
  if (Math.abs(v.speed) > 2) { log('Pare o carro antes de sair.'); return; }
  const sx = Math.cos(v.rot), sz = -Math.sin(v.rot);
  for (const e of [1, -1, 0]) {
    const t = VT[v.type], px = v.x + (e ? sx * (t.W / 2 + .6) * e : -Math.sin(v.rot) * (t.L / 2 + .7)), pz = v.z + (e ? sz * (t.W / 2 + .6) * e : -Math.cos(v.rot) * (t.L / 2 + .7));
    const p = { x: px, z: pz }; collide(p, .33); if (Math.hypot(p.x - px, p.z - pz) > .05) continue;
    P.x = px; P.z = pz; P.drive = null; v.speed = 0; setVehCols(v, true); v.cont.x = v.x; v.cont.z = v.z; markVeh(v); setZoom(P.zoom0 || viewH); log('Você saiu do carro.'); return;
  }
  log('Não tem espaço para sair aqui.');
}
const _tmpV = { x: 0, z: 0 };
function driveStep(dt) {
  const v = P.drive, t = VT[v.type], inp = inputVec();
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  const dx = fx * inp.f + rx * inp.r, dz = fz * inp.f + rz * inp.r;
  const prob = vehProblem(v); v.dead = !!prob;
  let thr = 0, steer = 0;
  if (inp.l > .15 && !prob) {
    const tgt = Math.atan2(dx, dz), diff = angLerp(0, tgt - v.rot, 1);
    if (Math.abs(diff) > 2.1 && v.speed < 2) { thr = -inp.l; steer = -clamp(angLerp(0, tgt + PI - v.rot, 1) * 1.5, -1, 1); }
    else { thr = inp.l * Math.max(.15, Math.cos(diff)); steer = clamp(diff * 1.6, -1, 1); }
  }
  const max = thr < 0 ? 5 : t.max;
  v.speed += thr * (thr < 0 ? 5 : 8) * dt;
  v.speed *= 1 - (thr ? .25 : 1.6) * dt;
  v.speed = clamp(v.speed, -5, max);
  v.rot += steer * 2.0 * dt * clamp(Math.abs(v.speed) / 4, 0, 1) * Math.sign(v.speed || 1);
  v.x += Math.sin(v.rot) * v.speed * dt; v.z += Math.cos(v.rot) * v.speed * dt;
  // batidas
  let push = 0;
  for (const [cx, cz, r] of vehCircles(v)) {
    _tmpV.x = cx; _tmpV.z = cz;
    collideIgnore(_tmpV, r * .95, v);
    const px = _tmpV.x - cx, pz = _tmpV.z - cz; if (px || pz) { v.x += px; v.z += pz; push += Math.hypot(px, pz); }
  }
  if (push > .03 && Math.abs(v.speed) > 3) { const s0 = v.speed; v.speed *= -.25; noise(v.x, v.z, 18); if (Math.abs(s0) > 9) { P.hp -= Math.abs(s0) * .8; hurtFx(); log('Batida forte!'); } }
  // atropelar zumbis
  for (const z of zombies) {
    if (z.dead || (z.lv || 0)) continue;
    for (const [cx, cz, r] of vehCircles(v)) { const d = Math.hypot(z.x - cx, z.z - cz); if (d < r + .35) {
      if (Math.abs(v.speed) > 2.5) { if ((z.hitCd || 0) < simTime) { z.hitCd = simTime + .5; hitZombie(z, Math.abs(v.speed) * 9, 1.6, v.x - Math.sin(v.rot) * 3 * Math.sign(v.speed), v.z - Math.cos(v.rot) * 3 * Math.sign(v.speed)); v.speed *= .8; } }
      else { const k = (r + .35 - d) / (d || 1); z.x += (z.x - cx) * k; z.z += (z.z - cz) * k; }
      break; } }
  }
  v.st.fuel = Math.max(0, v.st.fuel - Math.abs(v.speed) * dt * .016);
  if (v.st.fuel <= 0 && !v.fuelMsg) { v.fuelMsg = 1; log('A gasolina acabou!'); }
  P.x = v.x; P.z = v.z; P.rot = v.rot; P.moving = false;
  v.nT = (v.nT || 0) - dt; if (v.nT <= 0 && !prob) { v.nT = .6; noise(v.x, v.z, 6 + Math.abs(v.speed) * .8); }
  v.g.position.set(v.x, 0, v.z); v.g.rotation.y = v.rot - PI / 2;
  v.cont.x = v.x; v.cont.z = v.z;
}
function collideIgnore(e, r, v) {
  for (const c of near(e.x, e.z, tmpList)) {
    if (!c.on || c.veh === v || (c.lv != null && c.lv !== 0)) continue;
    if (c.r) { const dx = e.x - c.cx, dz = e.z - c.cz, rr2b = c.r + r, d2 = dx * dx + dz * dz; if (d2 < rr2b * rr2b && d2 > 1e-8) { const d = Math.sqrt(d2); e.x += dx / d * (rr2b - d); e.z += dz / d * (rr2b - d); } continue; }
    const px = clamp(e.x, c.x0, c.x1), pz = clamp(e.z, c.z0, c.z1), dx = e.x - px, dz = e.z - pz, d2 = dx * dx + dz * dz;
    if (d2 < r * r) { if (d2 > 1e-8) { const d = Math.sqrt(d2); e.x += dx / d * (r - d); e.z += dz / d * (r - d); } else { const l = e.x - c.x0, ri = c.x1 - e.x, t2 = e.z - c.z0, b = c.z1 - e.z, m = Math.min(l, ri, t2, b); if (m === l) e.x = c.x0 - r; else if (m === ri) e.x = c.x1 + r; else if (m === t2) e.z = c.z0 - r; else e.z = c.z1 + r; } }
  }
}

// ================================================================ ONLINE (PlayDrop / Colyseus)
let NET = null, SDK = null;
const isHost = () => !NET || NET.host;
const netSend = (t, m) => { if (NET && NET.room) try { NET.room.send(t, m || {}); } catch (e) {} };
function stableStr(o) { if (o === null || typeof o !== 'object') return JSON.stringify(o); if (Array.isArray(o)) return '[' + o.map(stableStr).join(',') + ']'; return '{' + Object.keys(o).sort().map(k => JSON.stringify(k) + ':' + stableStr(o[k])).join(',') + '}'; }
const nameTag = (txt) => { const d = document.createElement('div'); d.className = 'hud nametag'; d.textContent = txt; document.body.appendChild(d); return d; };
async function initSDK() {
  try { if (window.playdrop) { SDK = await playdrop.init(); } } catch (e) { SDK = null; }
  const can = !!SDK || /[?&]local=/.test(location.search) || !!window.UD_SERVER;
  $('mName').style.display = can && !SDK ? '' : 'none'; try { $('mName').value = localStorage.getItem('ud_nome') || ''; } catch (e) {}
  $('mOnline').style.display = can ? '' : 'none'; $('mParty').style.display = SDK ? '' : 'none';
  if (SDK) {
    try { SDK.host.ready(); } catch (e) {}
    try { const party = await SDK.social.getParty(); if (party && party.launch) startOnline(); } catch (e) {}
    try { SDK.me.onAuthChange(() => { if (NET && NET.wantRetry) startOnline(); }); } catch (e) {}
  }
}
async function connectRoom() {
  let key = 'publico';
  if (SDK) {
    try { const party = await SDK.social.getParty(); if (party && party.launch) key = party.partyId + ':' + party.launch.revision; } catch (e) {}
    return await SDK.multiplayer.join('mundo', { key, create: true });
  }
  const url = new URLSearchParams(location.search).get('local') || (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
  const client = new Colyseus.Client(url);
  return await client.joinOrCreate('mundo', { key, create: true, name: myName() });
}
function myName() { const q = new URLSearchParams(location.search).get('nome'); const n = (q || ($('mName') && $('mName').value) || '').trim().slice(0, 20); return n || 'Sobrevivente'; }
async function startOnline() {
  if (!SDK) { if (!myName() || myName() === 'Sobrevivente') { if (!$('mName').value.trim()) { $('menuSub').textContent = 'Escreva seu nome pra jogar online.'; $('mName').focus(); return; } } try { localStorage.setItem('ud_nome', myName()); } catch (e) {} }
  $('menuSub').textContent = 'Conectando ao servidor...';
  let room;
  try { room = await connectRoom(); }
  catch (e) {
    const msg = String(e && e.message || e);
    if (msg.includes('authentication_required')) { $('menuSub').textContent = 'Entre na sua conta PlayDrop pra jogar online.'; NET = { wantRetry: true }; }
    else $('menuSub').textContent = 'Não deu pra conectar: ' + msg;
    return;
  }
  NET = { room, me: room.sessionId, host: false, remotes: new Map(), lastSent: {}, zMap: new Map(), t: { p: 0, zs: 0, time: 0, ch: 0, save: 0 }, nid: 1 };
  room.onMessage('bem-vindo', (m) => netWelcome(m));
  room.onMessage('p', (m) => netPlayer(m.from, m));
  room.onMessage('entrou', (m) => { log(m.name + ' entrou no mundo.'); });
  room.onMessage('saiu', (m) => { const r = NET.remotes.get(m.id); if (r) { scene.remove(r.rig.root); r.tag.remove(); NET.remotes.delete(m.id); } log((m.name || 'Um jogador') + ' saiu.'); });
  room.onMessage('host', (m) => { NET.host = m.id === NET.me; if (NET.host) { log('Você agora controla os zumbis deste mundo.'); for (const z of zombies) { z.state = z.state || 'wander'; z.t = 0; } } });
  room.onMessage('zs', (m) => { if (!NET.host) netZombies(m.z); });
  room.onMessage('hurt', (m) => { if (P && !P.dead && !P.drive) applyZombieHit(m.k, m.r, m.inf); });
  room.onMessage('hit', (m) => { if (!NET.host) return; const z = NET.zMap.get(m.id); if (z && !z.dead) hitZombie(z, m.dmg, m.knock, m.px, m.pz); });
  room.onMessage('ahit', (m) => {});
  room.onMessage('noise', (m) => { if (NET.host) noise(m.x, m.z, m.r, true); });
  room.onMessage('chunk', (m) => { deltas[m.key] = m.d; NET.lastSent[m.key] = stableStr(m.d); const ch = chunks.get(m.key); if (ch) { applyDelta(ch); if (curBox && openPanel === 'box') renderBox(); } });
  room.onMessage('veh', (m) => netVehicle(m.id, m.sv));
  room.onMessage('drop', (m) => netDrop(m.id, m.d));
  room.onMessage('time', (m) => { if (S && !NET.host && Math.abs(S.totalH - m.totalH) > .05) S.totalH = m.totalH; });
  room.onLeave(() => { if (NET && NET.room === room) { log('Conexão com o servidor perdida.'); leaveOnline(true); } });
}
function netWelcome(m) {
  NET.host = m.host === NET.me;
  $('menu').style.display = 'none'; $('sleepfx').style.opacity = 0;
  if (prig) scene.remove(prig.root);
  resetWorld(); buildPlayer(); newState(); camYaw = ISO_YAW;
  deltas = m.world.deltas || {}; S.veh = m.world.veh || {}; S.totalH = m.world.totalH || 0; S.hora = (C('horaInicio') + S.totalH) % 24; S.dia = 1 + Math.floor((C('horaInicio') + S.totalH - 6) / 24); S.lastHour = Math.floor(S.totalH);
  if (m.me && !m.me.dead) { Object.assign(P, m.me); P.arma = m.me.arma >= 0 ? P.inv[m.me.arma] : null; P.drive = null; }
  else { P.x = START.x + rr(-3, 3); P.z = START.z + rr(-1, 1); }
  ensureChunks(true); restoreFreeVehicles();
  if (!m.me) { const st = [...chunks.values()].find(c => c.start); if (st) { P.x = st.start.x + rr(-1.5, 1.5); P.z = st.start.z + rr(-.5, .5); } }
  for (const id in (m.world.drops || {})) netDrop(id, m.world.drops[id]);
  for (const p of m.players || []) if (p.st) netPlayer(p.id, Object.assign({ n: p.name }, p.st));
  running = true;
  log(NET.host ? 'Você está online. Chame seus amigos!' : 'Você entrou no mundo online.');
  log((m.players || []).length ? 'Jogadores aqui: ' + m.players.map(p => p.name).join(', ') : 'Por enquanto só você neste mundo.');
}
function leaveOnline(lost) {
  if (!NET) return; const r = NET.room; netSaveMe();
  for (const rp of NET.remotes.values()) { scene.remove(rp.rig.root); rp.tag.remove(); }
  NET = null; try { r && !lost && r.leave(); } catch (e) {}
  showMenu(lost ? 'Você foi desconectado.' : 'Você saiu do mundo online.', true);
}
function netSaveMe() { if (!NET || !P) return; netSend('save', { P: { x: P.x, z: P.z, rot: P.rot, hp: P.hp, fome: P.fome, sede: P.sede, energia: P.energia, sangrando: P.sangrando, mordido: P.mordido, infectado: P.infectado, infH: P.infH, inv: P.inv, arma: P.arma ? P.inv.indexOf(P.arma) : -1, mochila: !!P.mochila, lv: P.lv || 0, dead: P.dead } }); }
// ---- outros jogadores
function netPlayer(id, st) {
  if (!NET) return; let r = NET.remotes.get(id);
  if (!r) { const rig = makePlayerRig(PRIG); r = { id, rig, tag: nameTag(st.n || 'Jogador'), st, x: st.x, z: st.z, rot: st.rot, phase: 0, deadT: 0 }; NET.remotes.set(id, r); }
  if (st.n && r.tag.textContent !== st.n) r.tag.textContent = st.n;
  r.st = st;
  if (st.car) { const v = vehicles.find(v => v.id === st.car[0]); if (v) { v.x = st.car[1]; v.z = st.car[2]; v.rot = st.car[3]; v.speed = st.car[4]; v.g.position.set(v.x, 0, v.z); v.g.rotation.y = v.rot - PI / 2; if (v.cols && v.cols.length) setVehCols(v, false); v.remoteDrive = true; } else if (S.veh && S.veh[st.car[0]]) { netVehicle(st.car[0], Object.assign({}, S.veh[st.car[0]], { moved: true })); } }
}
function remoteProxy(r) {
  const s = r.st;
  return { remote: true, id: r.id, x: r.x, z: r.z, rot: r.rot, lv: s.lv || 0, crouch: !!s.cr, luz: !!s.luz, sleeping: !!s.sl, dead: !!s.dead, drive: s.car ? { speed: s.car[4] } : null,
    moving: !!s.mv, isRunning: !!s.run, phase: r.phase, arma: s.w ? { id: s.w } : null, anim: null, action: s.act ? { anim: s.act, t: simTime % 3, dur: 3, label: '' } : null, swing: s.sw ? .15 : 0, hurtT: 0, deadT: r.deadT, pose: s.pose || null, hp: 100 };
}
function netRender(dt) {
  if (!NET) return;
  const P0 = P;
  for (const r of NET.remotes.values()) {
    const s = r.st, k = Math.min(1, dt * 10);
    r.x = lerp(r.x, s.x, k); r.z = lerp(r.z, s.z, k); r.rot = angLerp(r.rot, s.rot, k);
    if (s.mv) r.phase += dt * (s.run ? 5.6 : 3.2) * 2.6; if (s.dead) r.deadT += dt; else r.deadT = 0;
    const show = !s.car && Math.abs(r.x - P0.x) < 70 && Math.abs(r.z - P0.z) < 70 && (s.lv || 0) === (P0.lv || 0);
    r.rig.root.visible = show;
    if (show) { P = remoteProxy(r); try { animPlayer(r.rig, dt); } finally { P = P0; } }
    const pos = new T.Vector3(s.car ? s.car[1] : r.x, (s.lv || 0) * FLOOR_H + 2.6, s.car ? s.car[2] : r.z).project(camera);
    const vis = Math.abs(r.x - P0.x) < 70 && Math.abs(r.z - P0.z) < 70 && pos.z < 1;
    r.tag.style.display = vis ? 'block' : 'none';
    if (vis) { r.tag.style.left = ((pos.x + 1) / 2 * innerWidth) + 'px'; r.tag.style.top = ((1 - pos.y) / 2 * innerHeight) + 'px'; }
  }
}
// ---- zumbis (o anfitrião manda a posição; os outros só desenham)
function netZombies(arr) {
  const seen = new Set();
  for (const a of arr) {
    const [id, ty, x, z, rot, fl, lv, hp] = a; seen.add(id);
    let zz = NET.zMap.get(id);
    if (!zz) { zz = spawnZombie(ty === 1 ? 'magro' : 'comum', x, z, hp); zz.nid = id; zz.net = true; NET.zMap.set(id, zz); }
    zz.tx2 = x; zz.tz2 = z; zz.rot = rot; zz.lv = lv; zz.hp = hp; zz.moving = !!(fl & 1); zz.state = fl & 2 ? 'chase' : 'wander'; if (fl & 4) zz.swing = .4; zz.seenT = 0;
    if (fl & 8 && !zz.dead) { zz.dead = true; zz.deadT = 0; }
  }
  for (const zz of [...zombies]) if (zz.net && !seen.has(zz.nid)) { zz.seenT = (zz.seenT || 0) + 1; if (zz.seenT > 10) { removeZombie(zz); NET.zMap.delete(zz.nid); } }
}
function netClientZombies(dt) {
  for (const z of zombies) { if (z.tx2 == null) continue; const k = Math.min(1, dt * 8); z.x = lerp(z.x, z.tx2, k); z.z = lerp(z.z, z.tz2, k); if (z.dead) z.deadT += dt; if (z.swing > 0) z.swing -= dt; }
}
function netHostSnapshot() {
  const out = [], rs = [...NET.remotes.values()];
  if (!rs.length) return;
  for (const z of zombies) {
    if (!z.nid) { z.nid = NET.me.slice(0, 4) + (NET.nid++); NET.zMap.set(z.nid, z); }
    let near = false; for (const r of rs) if (Math.abs(z.x - r.st.x) < 80 && Math.abs(z.z - r.st.z) < 80) { near = true; break; }
    if (!near) continue;
    out.push([z.nid, z.type === 'magro' ? 1 : 0, +z.x.toFixed(2), +z.z.toFixed(2), +z.rot.toFixed(2), (z.moving ? 1 : 0) | (z.state === 'chase' ? 2 : 0) | (z.swing > 0 ? 4 : 0) | (z.dead ? 8 : 0), z.lv || 0, Math.round(z.hp)]);
  }
  netSend('zs', { z: out });
}
// alvos dos zumbis: o jogador mais perto (local ou online)
function zombieTargets() { const t = [P]; if (NET) for (const r of NET.remotes.values()) t.push(remoteProxy(r)); return t; }
function applyZombieHit(k, r, inf) {
  P.hp -= C('danoZumbi') * k; hurtFx(); P.hurtT = .4; cancelAction();
  if (P.sleeping) wake('Você acordou com um zumbi te atacando!');
  if (r < C('chanceMordida')) { log('Você foi mordido!'); P.sangrando = true; P.mordido = true; if (inf < C('chanceInfeccao')) P.infectado = true; }
  else if (r < C('chanceMordida') + C('chanceArranhao')) { if (!P.sangrando) log('Você levou um arranhão e está sangrando.'); P.sangrando = true; }
  if (P.hp <= 0) die();
}
// ---- carros e bolsas
function netVehicle(id, sv) {
  if (!S) return; if (!S.veh) S.veh = {}; S.veh[id] = sv;
  let v = vehicles.find(o => o.id === id);
  if (!v) { if (!sv.moved) return; v = Object.assign({ id, speed: 0, ch: null, nome: VT[sv.type].n, moved: true }, JSON.parse(JSON.stringify(sv))); buildVehicle(v, scene); }
  if (sv.moved && !v.moved) { v.moved = true; const p = v.g.parent; if (p) p.remove(v.g); scene.add(v.g); v.ch = null; v.cont.ch = null; }
  const pn = v.st.pneu; v.st = sv.st; v.items = sv.items; v.cont.items = sv.items; if (pn !== v.st.pneu) v.wh.geometry = wheelGeo(v.type, v.st.pneu);
  if (v !== P.drive) { v.x = sv.x; v.z = sv.z; v.rot = sv.rot; v.g.position.set(v.x, 0, v.z); v.g.rotation.y = v.rot - PI / 2; v.cont.x = v.x; v.cont.z = v.z; v.remoteDrive = false; setVehCols(v, true); }
}
function netDrop(id, d) {
  let o = drops.find(x => x.id === id);
  if (!d) { if (o) { scene.remove(o.m); drops.splice(drops.indexOf(o), 1); } return; }
  if (!o) { o = makeDrop(d.x, d.z, d.items, d.lv || 0); o.id = id; } else o.items = d.items;
}
const sendDrop = (o) => { if (!NET) return; if (!o.id) o.id = NET.me.slice(0, 4) + Math.random().toString(36).slice(2, 8); netSend('drop', { id: o.id, d: { x: o.x, z: o.z, lv: o.lv || 0, items: o.items } }); };
// ---- envio periódico
function netTick(dt) {
  if (!NET || !NET.room) return;
  const T2 = NET.t; T2.p -= dt; T2.zs -= dt; T2.time -= dt; T2.ch -= dt; T2.save -= dt;
  if (T2.p <= 0) { T2.p = .125; const v = P.drive;
    netSend('p', { n: (SDK && SDK.me && SDK.me.username) || myName(), x: +P.x.toFixed(2), z: +P.z.toFixed(2), rot: +P.rot.toFixed(2), lv: P.lv || 0, mv: P.moving ? 1 : 0, run: P.isRunning ? 1 : 0, cr: P.crouch ? 1 : 0,
      w: P.arma ? P.arma.id : 0, luz: P.luz ? 1 : 0, act: P.action ? P.action.anim : 0, sw: P.swing > 0 ? 1 : 0, dead: P.dead ? 1 : 0, sl: P.sleeping ? 1 : 0, pose: P.sleeping ? P.pose : 0,
      car: v ? [v.id, +v.x.toFixed(2), +v.z.toFixed(2), +v.rot.toFixed(3), +v.speed.toFixed(2)] : 0 }); }
  if (NET.host && T2.zs <= 0) { T2.zs = .2; netHostSnapshot(); }
  if (NET.host && T2.time <= 0) { T2.time = 3; netSend('time', { totalH: S.totalH }); }
  if (T2.ch <= 0) { T2.ch = 1; for (const ch of chunks.values()) { writeDelta(ch); const d = deltas[ch.key]; if (!d) continue; const s2 = stableStr(d); if (NET.lastSent[ch.key] === undefined) { NET.lastSent[ch.key] = s2; continue; } if (s2 !== NET.lastSent[ch.key]) { NET.lastSent[ch.key] = s2; netSend('chunk', { key: ch.key, d }); } } }
  if (T2.save <= 0) { T2.save = 20; netSaveMe(); }
}

function spawnZombie(type, x, z, hp) {
  const zt = ZTYPES[type];
  const rig = makeZombieRig(type);
  const zz = { type, x, z, rot: Math.random() * PI * 2, hp: hp != null ? hp : zt.hp, state: 'wander', tx: x, tz: z, t: Math.random() * 3, atk: 0, stun: 0, dead: false, deadT: 0, rig, phase: Math.random() * 6, zone: '', barrT: 0, far: 0 };
  zombies.push(zz); return zz;
}
function removeZombie(z) { scene.remove(z.rig.root); zombies.splice(zombies.indexOf(z), 1); }

// ---------------------------------------------------------------- estado
let P, S, fires = [], drops = [];
const PRIG = { outfit: 'sobrevivente', shoes: 0xc8a878, legLen: .85, legW: .2, bodyW: .5, bodyH: .62, bodyD: .28, headS: .27, armLen: .66, armW: .14, skin: 0xe2b28c, shirt: 0x474c55, sleeve: 0x474c55, pants: 0x3c5c88, hair: null };
let prig, handItems = {}, weaponMeshes = {}, ghosts = [], ghostOn = null;
// ---------------------------------------------------------------- sobrevivente detalhado (cada parte do corpo é uma peça só)
const playerMat = new T.MeshLambertMaterial({ vertexColors: true, map: fabricTex });
function makePlayerRig(s) {
  const B = s.bodyW, H = s.bodyH, D = s.bodyD, hs = s.headS, ll = s.legLen, lw = s.legW, al = s.armLen, aw = s.armW;
  const C2 = { hood: 0x4c525c, hood2: 0x5c6370, hoodIn: 0x2a2d32, skin: s.skin, jeans: 0x3d5f8e, jeans2: 0x2e4a70, stitch: 0xc8a050, boot: 0xc4a274, boot2: 0x8a6a46, sole: 0x2a2018, glove: 0x3a3632, glove2: 0x5a5048,
    pack: 0x56603f, pack2: 0x454e33, strap: 0x2a2c26, belt: 0x3a2a1c, buckle: 0xc0a860, mask: 0xeeece6, cap: 0x2e3238 };
  const root = new T.Group();
  const mesh = (g, par) => { const m = new T.Mesh(g, playerMat); if (SHADOWS) m.castShadow = true; par.add(m); return m; };
  // ---- tronco: moletom com capuz, bolso canguru, cordões, mochila tática, cinto
  const tq = new Part();
  tq.add(capG(.5, .6), C2.hood, 0, H / 2, 0, 0, 0, 0, B * .94, H / 1.6, D * 1.02);
  tq.add(sphHi, C2.hood, 0, H * .78, D * .04, 0, 0, 0, B * .92, H * .34, D * 1.02); // peito
  for (const e of [-1, 1]) tq.add(sphHi, C2.hood, e * B * .4, H * .93, 0, 0, 0, 0, B * .3, .12, D * .95); // ombros
  tq.add(sphHi, C2.hood2, 0, H * .28, D * .44, 0, 0, 0, B * .66, H * .3, .07); // bolso canguru
  tq.add(sphG, C2.hoodIn, 0, H * .36, D * .48, 0, 0, 0, B * .5, .015, .02);
  for (const e of [-1, 1]) { tq.add(capG(.008, H * .2), 0xe8e6de, e * .05, H * .72, D * .52); tq.add(sphG, 0xd8d0c0, e * .05, H * .6, D * .52, 0, 0, 0, .02, .03, .02); }
  tq.add(capG(.5, .2), C2.hood2, 0, .04, 0, 0, 0, 0, B * 1.0, .07, D * 1.08); // barra
  for (let i = 0; i < 3; i++) tq.add(sphG, C2.hoodIn, (i - 1) * B * .25, H * .55, D * .5, 0, 0, (i - 1) * .3, .015, H * .3, .01); // dobras
  tq.add(sphHi, C2.hood, 0, H + .02, -D * .1, 0, 0, 0, B * .7, .13, D * 1.1); // gola do capuz
  // mochila
  tq.add(capG(.5, .45), C2.pack, 0, H * .52, -D / 2 - .12, 0, 0, 0, B * .9, H * .7 / 1.45, .24);
  tq.add(sphHi, C2.pack2, 0, H * .9, -D / 2 - .12, 0, 0, 0, B * .86, .1, .26); // tampa
  tq.add(sphHi, C2.pack2, 0, H * .36, -D / 2 - .25, 0, 0, 0, B * .6, H * .34, .09); // bolso
  for (const yy of [.42, .52, .62]) tq.add(boxG, C2.strap, 0, H * yy, -D / 2 - .3, 0, 0, 0, B * .55, .016, .012); // fitas molle
  tq.add(boxG, 0x7a7e72, 0, H * .3, -D / 2 - .3, 0, 0, 0, .07, .05, .02);
  for (const e of [-1, 1]) tq.add(capG(.06, .08), C2.pack2, e * B * .5, H * .38, -D / 2 - .1); // bolsos laterais
  tq.add(cylG, 0x9ab8c8, B * .54, H * .5, -D / 2 - .1, 0, 0, 0, .085, .22, .085); tq.add(cylG, 0x2a2a2a, B * .54, H * .63, -D / 2 - .1, 0, 0, 0, .055, .04, .055); // garrafa
  tq.add(cylG, 0x7a5a3a, -B * .52, H * .62, -D / 2 - .12, 0, 0, 0, .035, .5, .035); tq.add(boxG, 0xa8a8a8, -B * .52, H * .86, -D / 2 - .06, 0, 0, 0, .02, .09, .13); tq.add(boxG, 0xb04a3a, -B * .52, H * .86, -D / 2 - .13, 0, 0, 0, .025, .1, .03); // machadinha
  tq.add(torusG, 0xc8b088, 0, H * .02, -D / 2 - .14, PI / 2, 0, 0, .2, .2, .2); // corda
  for (const e of [-1, 1]) { tq.add(capG(.025, H * .55), C2.strap, e * B * .26, H * .62, D * .51, .05, 0, 0, 1, 1, .6); tq.add(capG(.025, D * .9), C2.strap, e * B * .26, H * .96, 0, PI / 2, 0, 0, 1, 1, .6); tq.add(boxG, 0x7a7e72, e * B * .26, H * .45, D * .54, 0, 0, 0, .05, .03, .015); }
  tq.add(boxG, C2.strap, 0, H * .7, D * .53, 0, 0, 0, B * .5, .03, .015); // fita do peito
  // ---- cabeça: rosto, olhos, sobrancelhas, máscara, boné e capuz
  const hd = new Part();
  hd.add(sphHi, C2.skin, 0, 0, 0, 0, 0, 0, hs * .9, hs * 1.12, hs * .98);
  for (const e of [-1, 1]) {
    hd.add(sphG, 0xf4f2ee, e * hs * .19, hs * .06, hs * .42, 0, 0, 0, hs * .2, hs * .13, hs * .08);
    hd.add(sphG, 0x4a3424, e * hs * .19, hs * .06, hs * .46, 0, 0, 0, hs * .1, hs * .1, hs * .05);
    hd.add(sphG, 0x111111, e * hs * .19, hs * .06, hs * .48, 0, 0, 0, hs * .05, hs * .05, hs * .03);
    hd.add(boxG, 0x3a2a1e, e * hs * .19, hs * .2, hs * .44, 0, 0, e * -.15, hs * .26, hs * .05, hs * .05);
    hd.add(sphG, C2.skin, e * hs * .46, -hs * .02, 0, 0, 0, 0, hs * .1, hs * .2, hs * .12);
  }
  hd.add(sphG, C2.skin, 0, -hs * .02, hs * .47, .1, 0, 0, hs * .14, hs * .22, hs * .14); // nariz
  hd.add(sphHi, C2.mask, 0, -hs * .3, hs * .3, 0, 0, 0, hs * .74, hs * .5, hs * .5); // máscara
  for (const e of [-1, 1]) { hd.add(cylG, 0x8a8c8a, e * hs * .27, -hs * .34, hs * .52, PI / 2, 0, 0, hs * .22, hs * .1, hs * .22); hd.add(cylG, 0x5a5c5a, e * hs * .27, -hs * .34, hs * .58, PI / 2, 0, 0, hs * .16, hs * .03, hs * .16); }
  hd.add(boxG, 0xc8c6c0, 0, -hs * .1, hs * .46, 0, 0, 0, hs * .5, hs * .03, hs * .03);
  hd.add(hairG, C2.cap, 0, hs * .1, 0, 0, 0, 0, hs * .98, hs * 1.0, hs * 1.02); // boné
  hd.add(sphHi, C2.cap, 0, hs * .38, hs * .45, 0, 0, 0, hs * .74, hs * .07, hs * .5); // aba
  hd.add(hoodG, C2.hood, 0, hs * .02, -hs * .04, 0, 0, 0, hs * 1.16, hs * 1.24, hs * 1.16); // capuz
  hd.add(torusG, C2.hood2, 0, -hs * .02, hs * .26, 0, 0, 0, hs * 1.0, hs * 1.12, hs * .7); // borda do capuz
  // ---- grupos e animação (mesmo esqueleto de antes)
  const upper = new T.Group(); upper.position.y = ll; root.add(upper);
  const hip = new Part(); hip.add(sphHi, C2.jeans, 0, 0, 0, 0, 0, 0, B * .98, .3, D * 1.05); hip.add(capG(.5, .2), C2.belt, 0, .06, 0, 0, 0, 0, B * 1.02, .06, D * 1.12); hip.add(boxG, C2.buckle, 0, .06, D * .56, 0, 0, 0, .07, .05, .02); hip.add(capG(.05, .05), 0x4a4a3a, -B * .44, .02, -D * .15);
  mesh(hip.build(), upper);
  const torso = new T.Group(); upper.add(torso); mesh(tq.build(), torso);
  const neck = new T.Group(); neck.position.set(0, H + .02, 0); torso.add(neck);
  const nk = new Part(); nk.add(capG(.06, .06), C2.skin, 0, .03, 0); mesh(nk.build(), neck);
  const head = new T.Group(); head.position.set(0, hs * .6, 0); neck.add(head); mesh(hd.build(), head);
  const arm = (side) => {
    const a = new Part(), ua = al * .48, fa = al * .5, bend = .22;
    a.add(capG(aw * .48, ua - aw * .4), C2.hood, 0, -ua / 2, 0);
    a.add(sphG, C2.hood, 0, -ua, 0, 0, 0, 0, aw * .95, aw * .95, aw * .95);
    a.add(sphG, C2.hoodIn, 0, -ua * .55, aw * .5, 0, 0, 0, aw * .8, .01, .01);
    a.add(capG(aw * .44, fa * .62), C2.hood, 0, -ua - Math.cos(bend) * fa * .36, Math.sin(bend) * fa * .36, -bend, 0, 0);
    a.add(capG(aw * .48, .02), C2.hood2, 0, -ua - Math.cos(bend) * fa * .78, Math.sin(bend) * fa * .78, -bend, 0, 0); // punho
    const hy = -ua - Math.cos(bend) * fa - .02, hz = Math.sin(bend) * fa;
    a.add(sphG, C2.glove, 0, hy, hz, -bend, 0, 0, aw * 1.0, aw * .95, aw * .8); // mão de luva
    for (let f = 0; f < 4; f++) a.add(fingerG, C2.glove, (f - 1.5) * aw * .2, hy - .06, hz + .02, -bend + .3, 0, 0);
    a.add(fingerG, C2.glove, side * aw * .45, hy - .01, hz + .03, .3, 0, side * .7);
    a.add(sphG, C2.glove2, 0, hy + .02, hz + aw * .38, 0, 0, 0, aw * .6, aw * .4, .01);
    return a.build();
  };
  const arms = [-1, 1].map((k, i) => { const g = new T.Group(); g.position.set(k * (B / 2 + aw * .3), H * .86, 0); mesh(arm(k), g); torso.add(g); return g; });
  const leg = (side) => {
    const g = new Part(), th = ll * .5, kb = .1;
    g.add(capG(lw * .52, th - lw * .5), C2.jeans, 0, -th / 2, 0);
    g.add(sphG, C2.jeans, 0, -th, 0, 0, 0, 0, lw * .98, lw * .98, lw * .98);
    g.add(capG(lw * .5, th - lw * .7), C2.jeans, 0, -th - th / 2 + .02, -Math.sin(kb) * th / 2, kb, 0, 0);
    g.add(boxG, C2.stitch, side * lw * .5, -th * .9, 0, 0, 0, 0, .008, th * 1.6, .008); // costura lateral
    g.add(sphG, C2.jeans2, 0, -th * .45, -lw * .5, 0, 0, 0, lw * .7, lw * .7, .02); // bolso de trás
    g.add(sphG, C2.jeans2, 0, -th, lw * .5, 0, 0, 0, lw * .7, lw * .5, .02); // joelho gasto
    const fz = -Math.sin(kb) * th, by = -ll;
    g.add(capG(lw * .5, .12), C2.boot, 0, by + .18, fz); // cano da bota
    g.add(capG(lw * .53, .01), C2.boot2, 0, by + .27, fz); // dobra
    g.add(sphHi, C2.boot, 0, by + .065, fz + .05, 0, 0, 0, lw * 1.0, .13, lw * 1.65); // pé
    g.add(sphG, C2.boot2, 0, by + .07, fz + .17, 0, 0, 0, lw * .78, .09, lw * .6); // biqueira
    g.add(sphHi, C2.sole, 0, by + .015, fz + .05, 0, 0, 0, lw * 1.06, .045, lw * 1.72); // sola
    for (let i = 0; i < 4; i++) g.add(boxG, 0xe8dcc8, 0, by + .11 + i * .04, fz + lw * .48, 0, 0, 0, lw * .48, .012, .012); // cadarço
    if (side > 0) { g.add(sphHi, 0x1c1c1c, lw * .62, -th * .55, .02, 0, 0, 0, .09, .26, .16); g.add(capG(.5, .2), 0x1c1c1c, 0, -th * .35, 0, 0, 0, 0, lw * 1.3, .035, lw * 1.3); g.add(boxG, 0x3a3a3a, lw * .66, -th * .4, .02, 0, 0, 0, .05, .06, .14); } // coldre
    return g.build();
  };
  const legs = [-1, 1].map(k => { const g = new T.Group(); g.position.set(k * B * .24, ll, 0); mesh(leg(k), g); root.add(g); return g; });
  if (!SHADOWS) { const b = new T.Mesh(blobG, blobMat); b.scale.set(B * 2, 1, B * 2); b.position.y = .03; b.renderOrder = -1; root.add(b); }
  scene.add(root);
  return { root, legs, arms, torso, head, s };
}
function buildPlayer() {
  if (prig) scene.remove(prig.root);
  prig = makePlayerRig(PRIG); ghosts = []; ghostOn = null;
  const ghost = new T.MeshBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: .55, depthWrite: false, depthFunc: T.GreaterDepth });
  const parts = []; prig.root.traverse(o => { if (o.isMesh && o.material !== blobMat) parts.push(o); });
  // (a silhueta azul foi trocada por desenhar o personagem por cima quando algo o tapa)
  const hand = prig.arms[1];
  const wg = (parts) => { const g = new T.Group(); g.position.set(0, -PRIG.armLen + .04, .07); parts.forEach(p => { const m = new T.Mesh(boxG, M(p[6])); m.scale.set(p[0], p[1], p[2]); m.position.set(p[3], p[4], p[5]); g.add(m); }); g.visible = false; hand.add(g); return g; };
  handItems = {
    bottle: wg([[.09, .22, .09, 0, -.02, .08, 0x9ab8c8]]), food: wg([[.14, .1, .1, 0, -.02, .08, 0xc0392b]]),
    roll: wg([[.08, .08, .08, 0, -.02, .06, 0xf4f4f0]]), hammer: wg([[.04, .04, .32, 0, 0, .12, 0x6a4a2a], [.06, .06, .14, 0, 0, .28, 0x8a8a8a]]),
  };
  handItems.hammer.children[1].scale.set(.14, .06, .06);
  { const lg = new T.Group(); lg.position.set(0, -PRIG.armLen + .04, .09); const body = new T.Mesh(cylG, M(0x2a2a2e)); body.scale.set(.07, .22, .07); body.position.y = -.06; lg.add(body);
    const lens = new T.Mesh(cylG, new T.MeshBasicMaterial({ color: 0xfff6c0 })); lens.scale.set(.085, .03, .085); lens.position.y = -.18; lg.add(lens); prig.arms[0].add(lg); lg.visible = false; handItems.lantern = lg; }
  for (const k of ['bottle', 'food', 'roll', 'hammer']) handItems[k].visible = false;
  { const band = new T.Mesh(cylG, M(0xf4f4f0)); band.scale.set(PRIG.armW * 1.25, .12, PRIG.armW * 1.25); band.position.set(0, -PRIG.armLen * .6, .04); prig.arms[0].add(band); band.visible = false; handItems.band = band; }
  weaponMeshes.taco = wg([[.07, .07, .9, 0, 0, .4, 0x8a6236]]);
  const bat = weaponMeshes.taco.children[0]; bat.geometry = new T.CylinderGeometry(.5, .32, 1, 10); bat.geometry.rotateX(PI / 2); bat.scale.set(.09, .09, .9);
  weaponMeshes.faca = wg([[.04, .03, .25, 0, 0, .14, 0xc8c8c8], [.05, .05, .1, 0, 0, 0, 0x222222]]);
  weaponMeshes.machado = wg([[.05, .05, .85, 0, 0, .35, 0x6a4a2a], [.04, .28, .2, 0, -.08, .72, 0x9a9a9a]]);
  weaponMeshes.pistola = wg([[.06, .12, .22, 0, -.02, .1, 0x1e1e1e]]);
}
const START = { x: -6 * CH + 14, z: 15 }; // dentro da casa onde você acorda
function newState() {
  S = { totalH: 0, hora: C('horaInicio'), dia: 1, lastHour: 0, aguaAviso: false };
  P = { x: START.x, z: START.z, rot: 0, hp: 100, fome: 85, sede: 80, energia: 90, sangrando: false, mordido: false, infectado: false, infH: 0, febreAviso: 0,
        run: false, crouch: false, luz: false, inv: [], arma: null, atkCd: 0, swing: 0, hurtT: 0, dead: false, deadT: 0, phase: 0, noiseT: 0, sleeping: false, sleepH: 0, sleepRate: 1, action: null, bandH: 0, anim: null, pose: null };
  itemAdd(P.inv, 'lanterna', 1); itemAdd(P.inv, 'maca', 1); itemAdd(P.inv, 'agua', 1);
}

// ---------------------------------------------------------------- input
const keys = {}; const holds = []; let simTime = 0;
const pressed = new Set();
const joy = { on: false, id: null, cx: 0, cy: 0, x: 0, y: 0 };
let camYaw = ISO_YAW;
const aim = { x: 0, z: 0, t: -99 };
const ray = new T.Raycaster(), groundPl = new T.Plane(new T.Vector3(0, 1, 0), 0), v2 = new T.Vector2(), v3 = new T.Vector3();
function setZoom(h) { viewH = clamp(h, 11, 40); updateCamProj(); }
addEventListener('wheel', (e) => { if (running && !openPanel) setZoom(viewH * (e.deltaY > 0 ? 1.1 : 0.9)); }, { passive: true });
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', KeyD: 'right', ArrowLeft: 'left', ArrowRight: 'right' };
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = KEYMAP[e.code]; if (k) keys[k] = true;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.run = true;
  if (e.code === 'Space') { pressed.add('attack'); e.preventDefault(); }
  if (e.code === 'KeyE') pressed.add('interact');
  if (e.code === 'KeyC') pressed.add('crouch');
  if (e.code === 'KeyF') pressed.add('light');
  if (e.code === 'KeyM') toggleBigMap();
  if (e.code === 'KeyB' && running && P && !P.dead) { const b = nearDoor(); if (b) barricade(b); }
  if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); togglePanel('inv'); }
  if (e.code === 'Escape') { if (openPanel) closePanels(); else if (running) showMenu(); }
});
addEventListener('keyup', (e) => {
  const k = KEYMAP[e.code]; if (k) keys[k] = false;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.run = false;
});
const cv = renderer.domElement;
const drags = new Map(); let pinchD = 0;
cv.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45 && !joy.on) {
    joy.on = true; joy.id = e.pointerId; joy.cx = e.clientX; joy.cy = e.clientY; joy.x = joy.y = 0;
    const j = $('joy'); j.style.display = 'block'; j.style.left = (e.clientX - 60) + 'px'; j.style.top = (e.clientY - 60) + 'px'; $('joyk').style.transform = '';
  } else drags.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, mouse: e.pointerType === 'mouse' });
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (joy.on && e.pointerId === joy.id) {
    let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const l = Math.hypot(dx, dy), m = 50;
    if (l > m) { dx *= m / l; dy *= m / l; }
    joy.x = dx / m; joy.y = dy / m; $('joyk').style.transform = `translate(${dx}px,${dy}px)`;
    return;
  }
  if (e.pointerType === 'mouse') {
    v2.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(v2, camera);
    if (ray.ray.intersectPlane(groundPl, v3)) { aim.x = v3.x; aim.z = v3.z; aim.t = simTime; }
  }
  const d = drags.get(e.pointerId); if (!d) return;
  d.x = e.clientX; d.y = e.clientY;
  const ts = [...drags.values()].filter(q => !q.mouse);
  if (ts.length === 2) { const dist = Math.hypot(ts[0].x - ts[1].x, ts[0].y - ts[1].y); if (pinchD) setZoom(viewH * pinchD / dist); pinchD = dist; }
});
const endPtr = (e) => {
  if (joy.on && e.pointerId === joy.id) { joy.on = false; joy.x = joy.y = 0; $('joy').style.display = 'none'; return; }
  const d = drags.get(e.pointerId);
  if (d && d.mouse && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 6 && e.type === 'pointerup') pressed.add('attack');
  drags.delete(e.pointerId); pinchD = 0;
};
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
const tap = (id, fn) => { const el = $(id); el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); }); };
tap('bAtk', () => pressed.add('attack'));
tap('bInt', () => pressed.add('interact'));
tap('bRun', () => { P.run = !P.run; if (P.run) P.crouch = false; });
tap('bCrouch', () => pressed.add('crouch'));
tap('bLight', () => pressed.add('light'));
tap('bInv2', () => togglePanel('inv'));
tap('bZin', () => setZoom(viewH * .8));
tap('bZout', () => setZoom(viewH * 1.25));
tap('bMap', () => toggleBigMap());
tap('minimap', () => toggleBigMap());
$('mapBack').addEventListener('pointerdown', (e) => { e.preventDefault(); closePanels(); });
$('mapClose').addEventListener('click', () => closePanels());
tap('bPause', () => { if (running) showMenu(); });
if (!isTouch) $('btns').style.display = 'none';

function inputVec() {
  let f = 0, r = 0;
  if (keys.up) f += 1; if (keys.down) f -= 1; if (keys.right) r += 1; if (keys.left) r -= 1;
  for (const h of holds) { if (h.k === 'up') f += 1; if (h.k === 'down') f -= 1; if (h.k === 'right') r += 1; if (h.k === 'left') r -= 1; }
  if (joy.on) { f -= joy.y; r += joy.x; }
  const l = Math.hypot(f, r); if (l > 1) { f /= l; r /= l; }
  return { f, r, l: Math.min(1, l) };
}

// ---------------------------------------------------------------- mensagens / UI
function log(msg) {
  const el = document.createElement('div'); el.textContent = msg; const L = $('log'); L.appendChild(el);
  while (L.children.length > 4) L.removeChild(L.firstChild);
  setTimeout(() => { el.style.opacity = 0; }, 3800); setTimeout(() => el.remove(), 4500);
}
function noise(x, z, r, fromNet) {
  if (r <= 0) return;
  if (NET && !NET.host) { if (!fromNet && r >= 3) netSend('noise', { x: +x.toFixed(1), z: +z.toFixed(1), r }); return; }
  for (const zz of zombies) {
    if (zz.dead || zz.state === 'chase') continue;
    const d = Math.hypot(zz.x - x, zz.z - z);
    if (d < r) { zz.state = 'investigate'; zz.tx = x + rr(-2, 2); zz.tz = z + rr(-2, 2); zz.t = 12; }
  }
}
function hurtFx() { const h = $('hurt'); h.style.boxShadow = 'inset 0 0 120px 40px rgba(170,0,0,.55)'; setTimeout(() => h.style.boxShadow = '', 250); }

// ---------------------------------------------------------------- tempo e luz
function isNight(h) { return h < 6 || h >= 20; }
function hourRate(h) {
  const D = C('duracaoDiaSeg'), f = C('fracaoDia');
  return isNight(h) ? 10 / (D * (1 - f)) : 14 / (D * f);
}
function daylight(h) {
  if (h >= 7 && h < 19) return 1;
  if (h >= 5 && h < 7) return (h - 5) / 2;
  if (h >= 19 && h < 21) return 1 - (h - 19) / 2;
  return 0;
}
const skyDay = new T.Color(0x8a9590), skyNight = new T.Color(0x070a12), skyDusk = new T.Color(0x6a5048);
function applyLight() {
  const L = daylight(S.hora);
  const dusk = Math.max(0, 1 - Math.abs(L - 0.5) * 2) * (L < 1 && L > 0 ? 1 : 0);
  const col = skyNight.clone().lerp(skyDay, L).lerp(skyDusk, dusk * .4);
  scene.background.copy(col); scene.fog.color.copy(col);
  hemi.intensity = 0.6 + 2.4 * L; sun.intensity = 3.4 * L;
  hemi.color.setHex(L > .3 ? 0xdde4ea : 0x7088b8);
  scene.fog.near = ISO_DIST + lerp(5, 40, L); scene.fog.far = ISO_DIST + lerp(24, 90, L);
  const has = count('lanterna') > 0; if (!has) P.luz = false;
  flash.intensity = P.drive ? (L < .6 && P.drive.st.bat && !P.drive.dead ? 60 : 0) : P.luz ? (L > .6 ? 15 : 45) : 0;
  const lit = L < .5 && energiaOk(); bulbMat.color.setHex(lit ? 0xfff0b0 : 0x55585c); poolMat.opacity = lit ? (1 - L * 2) * .75 : 0;
  aura.intensity = (1 - L) * 5; aura.position.set(P.x, 2.2 + (P.lv || 0) * FLOOR_H, P.z);
  fillL.intensity = 2.2 + L * 1.5; fillL.position.set(P.x + 1.3, 2.4 + (P.lv || 0) * FLOOR_H, P.z + 1.3);
}

// ---------------------------------------------------------------- jogador
function speedNow() {
  let v = C('velAndar'); const heavy = weight(P.inv) > pesoMax();
  if (P.crouch) v = C('velAgachar'); else if (P.run && !heavy && P.energia > 12) v = C('velCorrer');
  if (heavy) v *= .8; if (P.energia < 15) v *= .8; if (P.energia <= 0) v *= .75;
  if (P.hp < 25) v *= .85;
  return v;
}
function updatePlayer(dt) {
  if (P.dead) { P.deadT += dt; return; }
  if (P.drive) {
    driveStep(dt);
    if (pressed.has('interact')) exitCar();
    if (pressed.has('attack')) { noise(P.x, P.z, 25); log('Buzina!'); }
    if (P.sangrando) P.hp -= C('sangramentoSeg') * dt;
    if (P.hp <= 0) { P.drive.speed = 0; P.drive = null; die(); }
    return;
  }
  const inp = inputVec();
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  let vx = fx * inp.f + rx * inp.r, vz = fz * inp.f + rz * inp.r;
  const heavy = weight(P.inv) > pesoMax();
  const running = (P.run || keys.run) && !P.crouch && inp.l > .2 && !heavy && P.energia > 12;
  let sp = P.crouch ? C('velAgachar') : running ? C('velCorrer') : C('velAndar');
  if (heavy) sp *= .8; if (P.energia < 15) sp *= .8; if (P.energia <= 0) sp *= .75; if (P.hp < 25) sp *= .85;
  sp *= Math.max(.35, inp.l);
  P.moving = inp.l > .1;
  if (P.moving) {
    P.x += vx * sp * dt; P.z += vz * sp * dt;
    if (P.swing <= 0) P.rot = angLerp(P.rot, Math.atan2(vx, vz), Math.min(1, dt * 12));
    P.phase += dt * sp * 2.6;
    P.noiseT -= dt;
    if (P.noiseT <= 0) { P.noiseT = 0.5; noise(P.x, P.z, running ? C('ruidoCorrer') : P.crouch ? 0 : C('ruidoAndar')); }
    if (running) P.energia -= dt * hourRate(S.hora) * (100 / C('horasCansaco')) * 1.5;
  }
  P.isRunning = running && P.moving;
  if (!P.moving && !isTouch && simTime - aim.t < 4 && P.swing <= 0) P.rot = angLerp(P.rot, Math.atan2(aim.x - P.x, aim.z - P.z), Math.min(1, dt * 10));
  collide(P, 0.33);
  P.atkCd -= dt; P.swing -= dt; P.hurtT -= dt;
  if (P.action) {
    if (P.moving) cancelAction('Ação cancelada.');
    else if (pressed.has('attack')) cancelAction();
    else { P.action.t += dt; if (P.action.anim === 'martelar' && Math.floor(P.action.t * 2.5) !== Math.floor((P.action.t - dt) * 2.5)) noise(P.x, P.z, 7); if (P.action.t >= P.action.dur) { const a = P.action; P.action = null; a.done(); } }
  }
  if (P.bandH > 0) P.bandH -= dt * hourRate(S.hora);
  if (P.anim) { P.anim.t += dt; if (P.anim.t >= P.anim.dur) { const a = P.anim; P.anim = null; if (a.end) a.end(); } }
  if (pressed.has('attack')) attack();
  if (pressed.has('interact')) { const it = findInteract(); if (it) it.act(); }
  if (pressed.has('crouch')) { P.crouch = !P.crouch; if (P.crouch) P.run = false; }
  if (pressed.has('light')) toggleFlashlight();
  // sangramento / regeneração
  if (P.sangrando) P.hp -= C('sangramentoSeg') * dt;
  else if (!P.infectado && P.fome > 40 && P.sede > 40) P.hp = Math.min(100, P.hp + C('regenSeg') * dt);
  if (P.hp <= 0) die();
}
function angLerp(a, b, t) { let d = (b - a) % (PI * 2); if (d > PI) d -= PI * 2; if (d < -PI) d += PI * 2; return a + d * t; }
function needsTick(dh) {
  const sleepK = P.sleeping ? .6 : 1;
  P.fome -= dh * (100 / C('horasFome')) * sleepK;
  P.sede -= dh * (100 / C('horasSede')) * sleepK;
  if (P.sleeping) P.energia += dh * (100 / C('horasDormirCheio')) * P.sleepRate;
  else P.energia -= dh * (100 / C('horasCansaco'));
  P.fome = clamp(P.fome, 0, 100); P.sede = clamp(P.sede, 0, 100); P.energia = clamp(P.energia, 0, 100);
  if (P.fome <= 0) P.hp -= dh * C('danoNecessidadeH');
  if (P.sede <= 0) P.hp -= dh * C('danoNecessidadeH') * 1.3;
  if (P.infectado) {
    P.infH += dh;
    const cap = 100 * (1 - (P.infH - 12) / (C('horasInfeccao') - 12));
    if (P.infH > 12) { P.hp = Math.min(P.hp, cap); if (P.febreAviso < 1) { P.febreAviso = 1; log('Você está com febre...'); } }
    if (P.infH > 30 && P.febreAviso < 2) { P.febreAviso = 2; log('Você está muito mal. A mordida infeccionou.'); }
  }
  if (P.hp <= 0) die();
}
function equippedDef() { return P.arma ? ITEMS[P.arma.id] : PUNCH; }
function attack() {
  if (P.atkCd > 0 || P.dead) return;
  const w = equippedDef();
  P.atkCd = w.cd; P.swing = 0.3; P.energia = Math.max(0, P.energia - 0.25);
  const facing = { x: Math.sin(P.rot), z: Math.cos(P.rot) };
  // mira automática: zumbi mais próximo à frente
  const mouseAim = !isTouch && simTime - aim.t < 4;
  if (mouseAim) P.rot = Math.atan2(aim.x - P.x, aim.z - P.z);
  const range = w.tiro ? w.alc : w.alc + .6, cone = mouseAim ? (w.tiro ? .25 : .8) : isTouch ? (w.tiro ? .9 : PI) : 1.1;
  let best = null, bd = 1e9;
  for (const z of zombies) {
    if (z.dead || (z.lv || 0) !== (P.lv || 0)) continue; const dx = z.x - P.x, dz = z.z - P.z, d = Math.hypot(dx, dz); if (d > range) continue;
    const a = Math.abs(angLerp(0, Math.atan2(dx, dz) - P.rot, 1));
    if ((a < cone || d < 1.4) && d < bd && !losBlocked(P.x, P.z, z.x, z.z)) { bd = d; best = z; }
  }
  if (best) P.rot = Math.atan2(best.x - P.x, best.z - P.z);
  if (w.tiro) {
    const am = w.ammo || 'municao';
    if (count(am) <= 0) { log(am === 'cartucho' ? 'Sem cartuchos.' : 'Sem munição.'); P.atkCd = .3; return; }
    itemRemove(P.inv, am, 1);
    noise(P.x, P.z, C('ruidoTiro') * (w.alto || 1)); muzzle.intensity = 6; muzzle.position.set(P.x + Math.sin(P.rot), 1.4, P.z + Math.cos(P.rot));
    if (!best) { let ba = null, bad = 1e9; for (const a of animals) { if (a.dead) continue; const dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz); if (d < w.alc && d < bad && Math.abs(angLerp(0, Math.atan2(dx, dz) - P.rot, 1)) < .4) { bad = d; ba = a; } } if (ba) { hitAnimal(ba, w.dano); return; } }
    if (best && Math.random() < clamp(1.05 - bd / 35, .45, .95)) {
      const head = Math.random() < .3; hitZombie(best, head ? 999 : w.dano, 0.3);
    }
    return;
  }
  noise(P.x, P.z, C('ruidoGolpe'));
  let hitAny = false;
  for (const z of zombies) {
    if (z.dead || (z.lv || 0) !== (P.lv || 0)) continue; const dx = z.x - P.x, dz = z.z - P.z, d = Math.hypot(dx, dz);
    if (d > w.alc) continue;
    const a = Math.abs(angLerp(0, Math.atan2(dx, dz) - P.rot, 1));
    if (a > 1.0 && d > .8) continue;
    hitZombie(z, w.dano * rr(.85, 1.15), P.arma ? .7 : 1.0); hitAny = true;
  }
  for (const a of animals) { if (a.dead || (P.lv || 0)) continue; const dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz) - ATYPES[a.type].r; if (d > w.alc) continue; if (Math.abs(angLerp(0, Math.atan2(dx, dz) - P.rot, 1)) > 1.1 && d > .6) continue; hitAnimal(a, w.dano); hitAny = true; }
  if (hitAny && P.arma) {
    P.arma.d -= 1;
    if (P.arma.d <= 0) { log(ITEMS[P.arma.id].n + ' quebrou!'); P.inv.splice(P.inv.indexOf(P.arma), 1); P.arma = null; }
  }
}
function hitZombie(z, dmg, knock, sx, sz) {
  if (sx == null) { sx = P.x; sz = P.z; }
  if (NET && !NET.host) { netSend('hit', { id: z.nid, dmg, knock, px: sx, pz: sz }); z.stun = .55; return; }
  z.hp -= dmg; z.stun = 0.55; z.state = 'chase';
  const dx = z.x - sx, dz = z.z - sz, d = Math.hypot(dx, dz) || 1;
  z.x += dx / d * knock; z.z += dz / d * knock; collide(z, .3);
  if (z.hp <= 0 && !z.dead) { z.dead = true; z.deadT = 0; if (z.home) { const d = deltaOf(z.home); d.k = (d.k || 0) + 1; } }
}
function die() {
  if (P.dead) return;
  P.dead = true; P.hp = 0; P.deadT = 0; P.sleeping = false;
  const dias = Math.floor(S.totalH / 24), horas = Math.floor(S.totalH % 24);
  let rec = 0; try { rec = +localStorage.getItem('ultimosdias_rec') || 0; if (S.totalH > rec) localStorage.setItem('ultimosdias_rec', S.totalH); localStorage.removeItem(SAVE_KEY); } catch (e) {}
  log('Você morreu.');
  setTimeout(() => {
    showMenu(`Você morreu. Sobreviveu ${plural(dias, 'dia', 'dias')} e ${plural(horas, 'hora', 'horas')}.`, true);
  }, 2200);
}

// ---------------------------------------------------------------- zumbis
function zSpeed(z) {
  const base = C('velAndar') * C('velZumbiFator') * ZTYPES[z.type].vel * (isNight(S.hora) ? C('bonusNoite') : 1);
  return z.state === 'chase' ? base : z.state === 'investigate' ? base * .8 : base * .3;
}
const blockedDoor = (b) => b.barr > 0 || b.doorClosed;
function chaseTarget(z) { // persegue até em outros andares, usando a escada
  const zl = z.lv || 0, pl = P.lv || 0;
  if (zl === pl) return routeTo(z, P.x, P.z);
  const b = buildingAt(P.x, P.z) || buildingAt(z.x, z.z);
  if (!b || !b.stairs) return routeTo(z, P.x, P.z);
  if (buildingAt(z.x, z.z) !== b) return routeTo(z, b.inn.x, b.inn.z);
  const st = b.stairs, pt = zl < pl ? st.up : st.arrive;
  if (Math.hypot(z.x - pt.x, z.z - pt.z) < .8) {
    if (zl < pl) { z.lv = zl + 1; z.x = st.arrive.x; z.z = st.arrive.z; } else { z.lv = zl - 1; z.x = st.up.x; z.z = st.up.z; }
    return { x: z.x, z: z.z };
  }
  return { x: pt.x, z: pt.z };
}
function routeTo(z, tx, tz) {
  const bt = buildingAt(tx, tz), bz = buildingAt(z.x, z.z);
  if (bz && bz !== bt) {
    if (Math.hypot(z.x - bz.inn.x, z.z - bz.inn.z) > 1.0 && Math.abs(z.x - bz.doorX) > .5) return bz.inn;
    return blockedDoor(bz) ? { x: bz.inn.x, z: bz.inn.z, barr: bz } : bz.out;
  }
  if (bt && bz !== bt) {
    if (Math.hypot(z.x - bt.out.x, z.z - bt.out.z) > 1.0 && Math.abs(z.x - bt.doorX) > .5) return bt.out;
    if (Math.abs(z.z - bt.doorZ) > 1.6 && Math.abs(z.x - bt.doorX) > .5) return bt.out;
    return blockedDoor(bt) ? { x: bt.out.x, z: bt.out.z, barr: bt } : bt.inn;
  }
  return { x: tx, z: tz };
}
function segHitsRect(x0, z0, x1, z1, b) {
  const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5);
  for (let i = 1; i < n; i++) { const t = i / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t); if (x > b.x0 - .2 && x < b.x1 + .2 && z > b.z0 - .2 && z < b.z1 + .2) return true; }
  return false;
}
function detour(z, tx, tz) { // contorna o prédio que está no caminho, indo pela quina
  for (const b of buildings) {
    if (z.x < b.x0 - 30 || z.x > b.x1 + 30 || z.z < b.z0 - 30 || z.z > b.z1 + 30) continue;
    if (!segHitsRect(z.x, z.z, tx, tz, b)) continue;
    const m = 1.1, cs = [[b.x0 - m, b.z0 - m], [b.x1 + m, b.z0 - m], [b.x1 + m, b.z1 + m], [b.x0 - m, b.z1 + m]];
    let best = null, bd = 1e9;
    const D = (a, b2) => Math.hypot(a[0] - b2[0], a[1] - b2[1]), tz2 = [tx, tz], zp = [z.x, z.z];
    cs.forEach((c, i) => {
      if (D(c, zp) < .5 || segHitsRect(z.x, z.z, c[0], c[1], b)) return;
      let d;
      if (!segHitsRect(c[0], c[1], tx, tz, b)) d = D(zp, c) + D(c, tz2);
      else { d = 1e9; for (const j of [(i + 1) % 4, (i + 3) % 4]) { const c2 = cs[j]; if (!segHitsRect(c2[0], c2[1], tx, tz, b)) d = Math.min(d, D(zp, c) + D(c, c2) + D(c2, tz2)); } }
      if (d < bd) { bd = d; best = c; }
    });
    if (best) return { x: best[0], z: best[1] };
  }
  return null;
}
let barrMsgT = 0, tvT = 0, chunkT = 0;
function updateZombie(z, dt, d) {
  const rig = z.rig;
  if (z.dead) { z.deadT += dt; return; }
  z.stun -= dt;
  // percepção
  if (!P.dead && !P.sleepSafe) {
    const night = isNight(S.hora);
    let range = night ? (P.luz ? C('visaoDia') * .9 : C('visaoNoite')) : C('visaoDia');
    if (P.crouch) range *= .5; if (P.sleeping) range *= .4;
    const fx = Math.sin(z.rot), fz = Math.cos(z.rot);
    const ahead = ((P.x - z.x) * fx + (P.z - z.z) * fz) / (d || 1);
    if (z.state === 'chase') range *= 1.6; else if (ahead < -0.2) range *= .45;
    if ((z.lv || 0) === (P.lv || 0) && (d < 1.5 || (d < range && !losBlocked(z.x, z.z, P.x, P.z, z.lv || 0)))) { if (z.state !== 'chase') z.t = 0; z.state = 'chase'; z.lost = 0; }
    else if (z.state === 'chase') { z.lost = (z.lost || 0) + dt; if (z.lost > 6) { z.state = 'investigate'; z.tx = P.x; z.tz = P.z; z.t = 10; } }
  } else if (z.state === 'chase' && P.dead) z.state = 'wander';
  let target = null;
  if (z.state === 'chase') target = chaseTarget(z);
  else if (z.state === 'investigate') {
    target = routeTo(z, z.tx, z.tz); z.t -= dt;
    if (z.t <= 0 || Math.hypot(z.x - z.tx, z.z - z.tz) < 1) { z.state = 'wander'; z.t = 0; }
  } else {
    z.t -= dt;
    if (z.t <= 0) { z.t = rr(3, 8); const a = rr(0, PI * 2), r = rr(2, 9); z.tx = z.x + Math.cos(a) * r; z.tz = z.z + Math.sin(a) * r; z.idle = Math.random() < .35; }
    if (!z.idle) target = { x: z.tx, z: z.tz };
  }
  let moving = false;
  if (target && !target.barr && z.state !== 'wander' && !buildingAt(z.x, z.z)) {
    z.detT = (z.detT || 0) - dt;
    if (z.detT <= 0) { z.detT = .4; z.det = detour(z, target.x, target.z); }
    if (z.det && Math.hypot(z.det.x - z.x, z.det.z - z.z) > .5) target = z.det;
  }
  if (target && z.stun <= 0) {
    if (target.barr) {
      z.rot = Math.atan2(target.barr.doorX - z.x, target.barr.doorZ - z.z);
      const dxb = target.x - z.x, dzb = target.z - z.z, db = Math.hypot(dxb, dzb);
      if (db > .6) { z.x += dxb / db * zSpeed(z) * dt; z.z += dzb / db * zSpeed(z) * dt; moving = true; }
      z.barrT -= dt;
      if (z.barrT <= 0 && db < 1.6) {
        z.barrT = 1.6; z.swing = .4;
        const b = target.barr, dmg = 12 * ZTYPES[z.type].dano, near = Math.hypot(P.x - b.doorX, P.z - b.doorZ) < 25;
        noise(b.doorX, b.doorZ, C('ruidoBarricada'));
        if (b.barr > 0) {
          b.barr -= dmg;
          if (barrMsgT <= 0 && near) { log('Zumbis batendo na barricada!'); barrMsgT = 8; }
          if (b.barr <= 0) { b.barr = 0; if (near) log('A barricada quebrou!'); }
          refreshBarr(b);
        } else if (b.doorClosed) {
          b.doorHp -= dmg;
          if (barrMsgT <= 0 && near) { log('Zumbis batendo na porta!'); barrMsgT = 8; }
          if (b.doorHp <= 0) { b.doorBroken = true; setDoor(b, false); if (near) log('Um zumbi arrombou a porta!'); }
        }
      }
    } else {
      const dx = target.x - z.x, dz = target.z - z.z, dd = Math.hypot(dx, dz);
      const stop = (z.state === 'chase' && target.x === P.x) ? .85 : .3;
      if (dd > stop) {
        const v = zSpeed(z);
        let mx = dx / dd, mz = dz / dd;
        if (z.sideT > 0) { z.sideT -= dt; const s = z.side; const nx = mx * .25 - mz * s, nz = mz * .25 + mx * s, nl = Math.hypot(nx, nz); mx = nx / nl; mz = nz / nl; }
        z.x += mx * v * dt; z.z += mz * v * dt; moving = true;
        z.rot = angLerp(z.rot, Math.atan2(mx, mz), Math.min(1, dt * 6));
        z.chk = (z.chk || 0) - dt;
        if (z.chk <= 0) {
          if (z.cx != null && Math.hypot(z.x - z.cx, z.z - z.cz) < v * .5 * .35) { z.side = Math.random() < .5 ? -1 : 1; z.sideT = 1.3; }
          z.chk = .5; z.cx = z.x; z.cz = z.z;
        }
      } else if (z.state === 'chase') z.rot = angLerp(z.rot, Math.atan2(P.x - z.x, P.z - z.z), Math.min(1, dt * 8));
    }
  }
  z.moving = moving;
  // ataque
  if (z.state === 'chase' && !P.dead && d < (P.drive ? 2.3 : 1.15) && (!P.drive || Math.abs(P.drive.speed) < .6) && z.stun <= 0 && (z.lv || 0) === (P.lv || 0) && buildingAt(z.x, z.z) === buildingAt(P.x, P.z)) {
    z.atk += dt;
    if (z.atk > .65) { z.atk = -0.6; z.swing = .4; if (d < 1.45) zombieHits(z); }
  } else z.atk = Math.max(0, z.atk - dt);
  if (z.swing > 0) z.swing -= dt;
  collide(z, .3);
}
function zombieHits(z) {
  const k = ZTYPES[z.type].dano;
  if (P.remote) { netSend('hurt', { to: P.id, k, r: Math.random(), inf: Math.random() }); return; }
  P.hp -= C('danoZumbi') * k; hurtFx(); P.hurtT = .4; cancelAction();
  if (P.sleeping) wake('Você acordou com um zumbi te atacando!');
  const r = Math.random();
  if (r < C('chanceMordida')) {
    log('Você foi mordido!'); P.sangrando = true; P.mordido = true;
    if (Math.random() < C('chanceInfeccao')) P.infectado = true;
  } else if (r < C('chanceMordida') + C('chanceArranhao')) { if (!P.sangrando) log('Você levou um arranhão e está sangrando.'); P.sangrando = true; }
  if (P.hp <= 0) die();
}
function separate(list) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]; if (b.dead || (b.lv || 0) !== (a.lv || 0)) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz;
      if (d2 < .49 && d2 > 1e-6) { const d = Math.sqrt(d2), p = (.7 - d) / 2; a.x -= dx / d * p; a.z -= dz / d * p; b.x += dx / d * p; b.z += dz / d * p; }
    }
    const dx = P.x - a.x, dz = P.z - a.z, d2 = dx * dx + dz * dz;
    if (!P.dead && (a.lv || 0) === (P.lv || 0) && d2 < .4 && d2 > 1e-6) { const d = Math.sqrt(d2), p = (.63 - d); a.x -= dx / d * p; a.z -= dz / d * p; }
  }
}
// ---------------------------------------------------------------- barricada / fogueira / interação
function refreshBarr(b) {
  const lv = Math.ceil(b.barr / C('vidaBarricada'));
  b.planks.forEach((p, i) => p.visible = i < lv);
  b.barrCol.on = b.barr > 0;
}
function nearDoor() {
  for (const b of buildings) if (Math.abs(P.x - b.doorX) < 1.6 && Math.abs(P.z - b.doorZ) < 1.8) return b;
  return null;
}
function distBox(o) { const dx = Math.max(Math.abs(P.x - o.x) - o.hx, 0), dz = Math.max(Math.abs(P.z - o.z) - o.hz, 0); return Math.hypot(dx, dz); }
function findInteract() {
  if (P.dead) return null;
  if (P.drive) return { d: 0, label: 'Sair do carro', act: exitCar };
  const opts = [];
  const LV = P.lv || 0, onLv = (o) => (o.lv || 0) === LV;
  if (LV === 0) { const nv = nearVehicle(); if (nv) opts.push({ d: .3, label: nv.nome, act: () => openCar(nv) }); }
  for (const c of containers) { if (!onLv(c)) continue; const d = distBox(c); if (d < 1.1) opts.push({ d, label: c.nome + (c.items.length ? '' : ' (vazio)'), act: () => startAction('Procurando', .8, 'mexer', () => openBox(c)) }); }
  for (const c of drops) { if (!onLv(c)) continue; const d = Math.hypot(P.x - c.x, P.z - c.z); if (d < 1.4) opts.push({ d: d - .3, label: 'Bolsa no chão', act: () => startAction('Procurando', .6, 'mexer', () => openBox(c)) }); }
  for (const u of usables) { if (!onLv(u)) continue; const d = distBox(u); if (d < 1.0) opts.push({ d: d - .05, label: u.label(), act: u.act }); }
  for (const b of beds) { if (!onLv(b)) continue; const d = distBox(b); if (d < 1.0) opts.push({ d, label: 'Dormir', act: () => trySleep(1, { k: 'deitar', x: b.x, y: .64 + (b.lv || 0) * FLOOR_H, z: b.z, rot: b.ry }) }); }
  for (const s of sinks) { if (!onLv(s)) continue; const d = distBox(s); if (d < 1.0) opts.push({ d, label: 'Beber da torneira', act: () => { if (S.dia >= C('diaSemAgua')) drink('torneira'); else startAction('Bebendo água', 2.5, 'mexer', () => drink('torneira')); } }); }
  if (LV === 0) for (const w of wells) { const d = Math.hypot(P.x - w.x, P.z - w.z) - 1; if (d < 1.2) opts.push({ d, label: 'Beber do poço', act: () => startAction('Puxando água do poço', 3, 'mexer', () => drink('poco')) }); }
  if (LV === 0) for (const h of hortas) if (Math.abs(P.x - h.x) < h.w / 2 + .8 && Math.abs(P.z - h.z) < h.d / 2 + .8) { const ok = h.day < S.dia; opts.push({ d: .5, label: ok ? 'Colher cenouras' : 'Horta (volta amanhã)', act: () => { if (ok) startAction('Colhendo', 3, 'mexer', () => harvest(h)); else harvest(h); } }); }
  if (LV === 0) for (const f of fires) { const d = Math.hypot(P.x - f.x, P.z - f.z); if (d < 2.2) opts.push(count('carnecrua') ? { d, label: 'Assar carne no fogo', act: () => roast() } : { d, label: 'Descansar perto do fogo', act: () => trySleep(.6, { k: 'sentar', x: P.x, y: -.74, z: P.z, rot: Math.atan2(f.x - P.x, f.z - P.z) }) }); }
  if (LV === 0) for (const a of animals) {
    const d = Math.hypot(P.x - a.x, P.z - a.z) - ATYPES[a.type].r;
    if (a.dead && a.carne > 0 && d < 1.3) opts.push({ d, label: a.type === 'galinha' ? 'Pegar a galinha' : 'Pegar carne', act: () => butcher(a) });
    else if (!a.dead && a.type === 'galinha' && d < 1.1) opts.push({ d, label: 'Pegar galinha', act: () => catchChicken(a) });
  }
  const b = LV === 0 ? nearDoor() : null;
  if (b) {
    if (b.barr > 0) opts.push({ d: .6, label: 'Porta barricada', act: () => log('A porta está barricada.') });
    else if (b.doorBroken) opts.push({ d: .6, label: 'Porta arrombada', act: () => log('Essa porta foi arrombada. Use tábuas pra barricar.') });
    else opts.push({ d: .6, label: b.doorClosed ? 'Abrir porta' : 'Fechar porta', act: () => toggleDoor(b) });
  }
  if (LV === 0 && P.arma && P.arma.id === 'machado') {
    for (const t of trees) { if (!t.alive) continue; const d = Math.hypot(P.x - t.x, P.z - t.z) - .4; if (d < 1.2) { opts.push({ d: d + .2, label: 'Cortar árvore', act: () => chop(t) }); break; } }
  }
  opts.sort((a, b) => a.d - b.d);
  return opts[0] || null;
}
function drink(src) {
  if (src === 'torneira' && S.dia >= C('diaSemAgua')) { log('A torneira está seca. A água acabou.'); return; }
  P.sede = 100; const v = count('vazia');
  if (v) { itemRemove(P.inv, 'vazia', v); itemAdd(P.inv, 'agua', v); log(`Você bebeu água e encheu ${v} ${v > 1 ? 'garrafas' : 'garrafa'}.`); }
  else log('Você bebeu água.');
}
function harvest(h) { if (h.day >= S.dia) { log('Já colheu hoje. Volte amanhã.'); return; } itemAdd(P.inv, 'cenoura', 3); log('Você colheu 3 cenouras.'); h.day = S.dia; }
function roast() { startAction('Assando carne', 5, 'mexer', () => { if (!count('carnecrua')) return; itemRemove(P.inv, 'carnecrua', 1); itemAdd(P.inv, 'carneassada', 1); log('Carne assada pronta!'); }); }
function butcher(a) {
  if (a.type === 'galinha') { startAction('Pegando', 1, 'mexer', () => { itemAdd(P.inv, 'galinha', 1); removeAnimal(a); log('Você pegou a galinha.'); }); return; }
  const tool = P.inv.some(e => e.id === 'faca' || e.id === 'machado');
  if (!tool) { log('Precisa de uma faca ou machado pra tirar a carne.'); return; }
  startAction('Tirando a carne', 5, 'mexer', () => { if (!a.carne) return; itemAdd(P.inv, 'carnecrua', a.carne); log(`Você pegou ${a.carne} pedaços de carne crua.`); a.carne = 0; a.deadT = 99; });
}
function catchChicken(a) {
  P.rot = Math.atan2(a.x - P.x, a.z - P.z);
  startAction('Pegando a galinha', 1.2, 'mexer', () => {
    if (a.dead || Math.hypot(P.x - a.x, P.z - a.z) > 1.9) { log('A galinha escapou!'); return; }
    itemAdd(P.inv, 'galinha', 1); animalGone(a); removeAnimal(a); log('Você pegou uma galinha viva!');
  });
}
function chop(t) {
  if (P.atkCd > 0) return; P.atkCd = 1; P.swing = .3; noise(P.x, P.z, C('ruidoGolpe')); P.energia -= 1;
  P.rot = Math.atan2(t.x - P.x, t.z - P.z);
  t.hp--; P.arma.d -= 1;
  if (t.hp <= 0) { t.alive = false; updateTrees(t.ch); itemAdd(P.inv, 'tronco', 1); log('Você cortou a árvore e pegou um tronco.'); }
  else log('Cortando... (' + t.hp + ')');
  if (P.arma.d <= 0) { log('O machado quebrou!'); P.inv.splice(P.inv.indexOf(P.arma), 1); P.arma = null; }
}
function toggleDoor(b) {
  P.rot = Math.atan2(b.doorX - P.x, b.doorZ - P.z); playAnim('empurrar', .45);
  if (b.doorClosed) { setDoor(b, false); noise(P.x, P.z, 3); return; }
  for (const e of [P, ...zombies.filter(z => !z.dead)]) if (Math.abs(e.x - b.doorX) < 1.1 && Math.abs(e.z - b.doorZ) < .5) { if (e === P) log('Saia do vão da porta primeiro.'); else log('Tem um zumbi na porta!'); return; }
  setDoor(b, true); noise(P.x, P.z, 3);
}
function barricade(b) {
  const lv = Math.ceil(b.barr / C('vidaBarricada'));
  if (lv >= C('maxBarricada')) { log('Essa porta já está bem barricada.'); return; }
  if (count('tabua') < 2 || count('pregos') < 4) { log('Precisa de 2 tábuas e 4 pregos.'); return; }
  if (Math.abs(P.z - b.doorZ) < .45) { log('Saia do vão da porta primeiro.'); return; }
  P.rot = Math.atan2(b.doorX - P.x, b.doorZ - P.z);
  startAction('Barricando a porta', 4, 'martelar', () => {
  if (count('tabua') < 2 || count('pregos') < 4) return;
  itemRemove(P.inv, 'tabua', 2); itemRemove(P.inv, 'pregos', 4);
  b.barr = (lv + 1) * C('vidaBarricada'); refreshBarr(b); setDoor(b, true); noise(P.x, P.z, 10);
  log('Porta barricada. (' + (lv + 1) + '/' + C('maxBarricada') + ')');
  });
}
function makeFire(x, z) {
  if (fires.length >= 3) removeFire(fires[0]);
  const g = new T.Group(); g.position.set(x, 0, z);
  for (let i = 0; i < 4; i++) { const m = new T.Mesh(boxG, M(0x4a3020)); m.scale.set(.12, .12, .9); m.rotation.y = i * PI / 4; m.position.y = .08; g.add(m); }
  const fl = new T.Mesh(new T.ConeGeometry(.3, .7, 6), new T.MeshBasicMaterial({ color: 0xffa040 })); fl.position.y = .4; g.add(fl);
  scene.add(g);
  const f = { x, z, h: 18, g, fl, col: addCol({ cx: x, cz: z, r: .45 }) };
  fires.push(f); return f;
}
function removeFire(f) { scene.remove(f.g); f.col.on = false; fires.splice(fires.indexOf(f), 1); }
function trySleep(rate, pose) {
  if (P.sangrando) { log('Você está sangrando. Faça um curativo antes.'); return; }
  if (P.energia > 75) { log('Você não está com sono.'); return; }
  for (const z of zombies) if (!z.dead && Math.hypot(z.x - P.x, z.z - P.z) < 12 && (z.state === 'chase' || !losBlocked(z.x, z.z, P.x, P.z))) { log('Não dá pra dormir com zumbis por perto.'); return; }
  P.sleeping = true; P.sleepH = 0; P.sleepRate = rate; P.run = false; P.pose = pose || { k: 'sentar', x: P.x, y: -.72, z: P.z, rot: P.rot }; P.luz = false; closePanels();
  $('sleepfx').textContent = rate < 1 ? 'Descansando...' : 'Dormindo...'; $('sleepfx').style.opacity = .45;
}
function wake(msg) {
  if (P.action) P.action = null; P.pose = null; if (!P.sleeping) return; P.sleeping = false; $('sleepfx').style.opacity = 0; if (msg) log(msg); save(); }

// ---------------------------------------------------------------- painéis
let openPanel = null, curBox = null;
function closePanels() { curCar = null; $('pMap').style.display = 'none'; $('mapBack').style.display = 'none'; $('pInv').style.display = 'none'; $('pBox').style.display = 'none'; openPanel = null; curBox = null; }
function togglePanel(k) { if (!running || P.dead) return; if (openPanel === k) { closePanels(); return; } closePanels(); openPanel = k; renderInv(); $('pInv').style.display = 'block'; }
function openBox(c) { closePanels(); openPanel = 'box'; curBox = c; renderBox(); $('pBox').style.display = 'block'; }
const RECIPES = [
  { n: 'Mochila grande', req: '2 cordas + 4 panos (+10 kg)', ok: () => !P.mochila && count('corda') >= 2 && count('pano') >= 4, run: () => { itemRemove(P.inv, 'corda', 2); itemRemove(P.inv, 'pano', 4); P.mochila = true; log('Mochila grande pronta! Você carrega mais 10 kg.'); } },
  { n: 'Curativo', req: '2 panos', ok: () => count('pano') >= 2, run: () => { itemRemove(P.inv, 'pano', 2); itemAdd(P.inv, 'curativo', 1); log('Você fez um curativo.'); } },
  { n: '3 Tábuas', req: '1 tronco + machado', ok: () => count('tronco') >= 1 && P.inv.some(e => e.id === 'machado'), run: () => { itemRemove(P.inv, 'tronco', 1); itemAdd(P.inv, 'tabua', 3); const m = P.inv.find(e => e.id === 'machado'); m.d -= 2; if (m.d <= 0) { P.inv.splice(P.inv.indexOf(m), 1); if (P.arma === m) P.arma = null; log('O machado quebrou!'); } log('Você fez 3 tábuas.'); } },
  { n: 'Barricar porta', req: '2 tábuas + 4 pregos, perto de uma porta', ok: () => !!nearDoor() && count('tabua') >= 2 && count('pregos') >= 4, run: () => barricade(nearDoor()) },
  { n: 'Fogueira', req: '2 tábuas + fósforos, do lado de fora', ok: () => count('tabua') >= 2 && count('fosforos') >= 1 && !buildingAt(P.x, P.z), run: () => { itemRemove(P.inv, 'tabua', 2); itemRemove(P.inv, 'fosforos', 1); makeFire(P.x + Math.sin(P.rot) * 1.3, P.z + Math.cos(P.rot) * 1.3); log('Você acendeu uma fogueira.'); } },
];
function itemLabel(e) { const it = ITEMS[e.id]; return it.n + (it.t === 'arma' && !it.tiro ? ` (${Math.max(0, Math.round(e.d / it.dur * 100))}%)` : e.q > 1 ? ` ×${e.q}` : ''); }
function useLabel(e) { const t = ITEMS[e.id].t; return t === 'animal' ? 'Preparar' : t === 'comida' ? 'Comer' : t === 'bebida' ? 'Beber' : t === 'cura' ? 'Usar' : t === 'arma' ? (P.arma === e ? 'Guardar' : 'Equipar') : t === 'ferramenta' ? (P.luz ? 'Desligar' : 'Ligar') : ''; }
function renderInv() {
  const w = weight(P.inv).toFixed(1);
  let h = `<button class="pb close" data-a="close">Fechar</button><h2>Mochila</h2><div style="font-size:13px;opacity:.75">Peso ${w} / ${pesoMax()}${w > pesoMax() ? ' — pesado demais, você fica lento' : ''} · O jogo fica pausado aqui</div>`;
  h += '<h3>Itens</h3>';
  if (!P.inv.length) h += '<div class="row">Vazia</div>';
  P.inv.forEach((e, i) => {
    const u = useLabel(e);
    h += `<div class="row"><span class="n">${itemLabel(e)}${P.arma === e ? ' — <b>na mão</b>' : ''}</span><span class="w">${(ITEMS[e.id].p * e.q).toFixed(1)}kg</span>${u ? `<button class="pb g" data-a="use" data-i="${i}">${u}</button>` : ''}<button class="pb" data-a="drop" data-i="${i}">Largar</button></div>`;
  });
  h += '<h3>Fabricar</h3>';
  RECIPES.forEach((r, i) => { h += `<div class="row"><span class="n">${r.n} <span style="opacity:.6;font-size:13px">— ${r.req}</span></span><button class="pb g" data-a="craft" data-i="${i}" ${r.ok() ? '' : 'disabled'}>Fazer</button></div>`; });
  h += `<div class="row" style="opacity:.75;font-size:13px">Barricar: fique perto de uma porta com 2 tábuas e 4 pregos (no PC também pela tecla B).</div>`;
  $('pInv').innerHTML = h;
}
function renderBox() {
  const c = curBox; if (!c) return;
  let h = `<button class="pb close" data-a="close">Fechar</button><h2>${c.nome || 'Bolsa no chão'}</h2>`;
  h += '<h3>Aqui dentro</h3>';
  if (!c.items.length) h += '<div class="row">Vazio</div>';
  c.items.forEach((e, i) => { h += `<div class="row"><span class="n">${itemLabel(e)}</span><span class="w">${(ITEMS[e.id].p * e.q).toFixed(1)}kg</span><button class="pb g" data-a="take" data-i="${i}">Pegar</button></div>`; });
  if (c.items.length > 1) h += `<div class="row"><span class="n"></span><button class="pb g" data-a="takeall">Pegar tudo</button></div>`;
  h += `<h3>Sua mochila (${weight(P.inv).toFixed(1)} / ${pesoMax()})</h3>`;
  P.inv.forEach((e, i) => { h += `<div class="row"><span class="n">${itemLabel(e)}</span><button class="pb" data-a="store" data-i="${i}">Guardar</button></div>`; });
  $('pBox').innerHTML = h;
}
function moveEntry(from, i, to, all) {
  const e = from[i]; if (!e) return; if (curBox) { curBox.touched = true; if (drops.includes(curBox)) { const cb = curBox; setTimeout(() => sendDrop(cb), 0); } if (curBox.isTrunk) setTimeout(() => markVeh(curBox ? curBox.veh : e), 0); }
  if (P.arma === e) P.arma = null;
  from.splice(i, 1);
  if (ITEMS[e.id].t === 'arma') to.push(e); else itemAdd(to, e.id, e.q);
}
function panelClick(ev) {
  const b = ev.target.closest('button'); if (!b) return;
  const a = b.dataset.a, i = +b.dataset.i;
  if (a === 'close') { closePanels(); return; }
  if (a === 'use') useItem(P.inv[i]);
  if (a === 'drop') { let d = drops.find(d => Math.hypot(d.x - P.x, d.z - P.z) < 1.4); if (!d) d = makeDrop(P.x, P.z, []); moveEntry(P.inv, i, d.items); sendDrop(d); }
  if (a === 'craft') { const r = RECIPES[i]; if (r.ok()) { if (r.n === 'Barricar porta') { closePanels(); r.run(); return; } startAction('Fazendo: ' + r.n, r.n === '3 Tábuas' ? 4 : 3, r.n === 'Curativo' ? 'mexer' : 'martelar', () => { if (r.ok()) r.run(); }); return; } }
  if (openPanel === 'car') { carAction(a); if (openPanel === 'car') renderCar(); return; }
  if (a === 'take') moveEntry(curBox.items, i, P.inv);
  if (a === 'takeall') while (curBox.items.length) moveEntry(curBox.items, 0, P.inv);
  if (a === 'store') moveEntry(P.inv, i, curBox.items);
  if (openPanel === 'inv') renderInv(); else if (openPanel === 'box') renderBox();
}
$('pInv').addEventListener('click', panelClick); $('pBox').addEventListener('click', panelClick);
function makeDrop(x, z, items, lv) {
  lv = lv != null ? lv : (P ? P.lv || 0 : 0);
  const m = new T.Mesh(boxG, M(0x3a3a2a)); m.scale.set(.5, .35, .4); m.position.set(x, .17 + lv * FLOOR_H, z); scene.add(m);
  const d = { x, z, items, m, lv, nome: 'Bolsa no chão' }; drops.push(d); return d;
}
// ações com tempo (barrinha sobre a cabeça + animação). Andar, atacar ou levar dano cancela.
function playAnim(k, dur, end, extra) { P.anim = Object.assign({ k, t: 0, dur, end }, extra || {}); }
function toggleFlashlight() {
  if (!count('lanterna')) { log('Você não tem lanterna.'); return; }
  if (P.anim && P.anim.k.startsWith('lanterna')) return;
  if (!P.luz) playAnim('lanterna_on', .6, () => { P.luz = true; });
  else { P.luz = false; playAnim('lanterna_off', .45); }
}
function startAction(label, dur, anim, done) {
  if (P.dead || P.sleeping) return false;
  if (P.action) { log('Termine o que está fazendo primeiro.'); return false; }
  closePanels();
  P.action = { label, dur, t: 0, anim, done };
  return true;
}
function cancelAction(msg) { if (!P.action) return; P.action = null; if (msg) log(msg); }
function useItem(e) {
  if (!e) return; const it = ITEMS[e.id];
  if (it.t === 'comida' || it.t === 'bebida') {
    const id = e.id;
    startAction(it.t === 'comida' ? 'Comendo' : 'Bebendo', it.t === 'comida' ? 2.5 : 2, it.t === 'comida' ? 'comer' : 'beber', () => {
      if (!count(id)) return; if (it.fome) P.fome = clamp(P.fome + it.fome, 0, 100); if (it.sede) P.sede = clamp(P.sede + it.sede, 0, 100);
      itemRemove(P.inv, id, 1); if (it.vira) itemAdd(P.inv, it.vira, 1);
      if (it.crua) { P.hp -= 6; log('Carne crua fez mal. Melhor assar.'); } else log((it.t === 'comida' ? 'Você comeu: ' : 'Você bebeu: ') + it.n);
    });
    return;
  }
  if (it.t === 'animal') {
    if (!P.inv.some(e2 => e2.id === 'faca' || e2.id === 'machado')) { log('Precisa de uma faca ou machado.'); return; }
    startAction('Preparando a galinha', 4, 'mexer', () => { if (!count('galinha')) return; itemRemove(P.inv, 'galinha', 1); itemAdd(P.inv, 'carnecrua', 2); log('Você preparou 2 pedaços de carne crua.'); });
    return;
  }
  if (it.t === 'cura') {
    startAction('Fazendo curativo', 3, 'curativo', () => {
      if (!count('curativo')) return; itemRemove(P.inv, 'curativo', 1); P.bandH = 6;
      if (P.sangrando) { P.sangrando = false; log('Você fez um curativo e parou de sangrar.'); } else log('Você não está sangrando, mas o curativo ajudou um pouco.');
      P.hp = Math.min(100, P.hp + 5);
    });
    return;
  }
  useItemNow(e);
}
function useItemNow(e) {
  if (!e) return; const it = ITEMS[e.id];
  if (it.t === 'comida' || it.t === 'bebida') {
    if (it.fome) P.fome = clamp(P.fome + it.fome, 0, 100); if (it.sede) P.sede = clamp(P.sede + it.sede, 0, 100);
    itemRemove(P.inv, e.id, 1); if (it.vira) itemAdd(P.inv, it.vira, 1);
    log((it.t === 'comida' ? 'Você comeu: ' : 'Você bebeu: ') + it.n);
  } else if (it.t === 'cura') {
    itemRemove(P.inv, e.id, 1);
    if (P.sangrando) { P.sangrando = false; log('Você fez um curativo e parou de sangrar.'); } else log('Você não está sangrando, mas o curativo ajudou um pouco.');
    P.hp = Math.min(100, P.hp + 5);
  } else if (it.t === 'arma') {
    closePanels();
    if (P.arma === e) { playAnim('guardar', .5, () => { if (P.arma === e) P.arma = null; }); }
    else if (P.arma) { const old = P.arma; playAnim('guardar', .4, () => { P.arma = e; playAnim('sacar', .5); }); }
    else { P.arma = e; playAnim('sacar', .5); }
  }
  else if (it.t === 'ferramenta') { closePanels(); toggleFlashlight(); }
}

// ---------------------------------------------------------------- save
const SAVE_KEY = 'ultimosdias_save2';
function save() {
  if (!P || P.dead || NET) return;
  for (const ch of chunks.values()) writeDelta(ch);
  for (const v of vehicles) if (v.moved) markVeh(v);
  const data = {
    v: 2, P: { x: P.x, z: P.z, rot: P.rot, hp: P.hp, fome: P.fome, sede: P.sede, energia: P.energia, sangrando: P.sangrando, mordido: P.mordido, infectado: P.infectado, infH: P.infH, febreAviso: P.febreAviso, inv: P.inv, arma: P.arma ? P.inv.indexOf(P.arma) : -1, mochila: !!P.mochila, lv: P.lv || 0 },
    S, deltas, drops: drops.map(d => ({ x: d.x, z: d.z, items: d.items, lv: d.lv || 0 })), fires: fires.map(f => [f.x, f.z, f.h]),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
}
function load() {
  let data; try { data = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
  if (!data || data.v !== 2) return false;
  newState();
  Object.assign(P, data.P); P.arma = data.P.arma >= 0 ? P.inv[data.P.arma] : null;
  Object.assign(S, data.S); deltas = data.deltas || {};
  ensureChunks(true); restoreFreeVehicles();
  data.drops.forEach(d => makeDrop(d.x, d.z, d.items, d.lv || 0));
  data.fires.forEach(f => { makeFire(f[0], f[1]).h = f[2]; });
  camYaw = ISO_YAW;
  return true;
}
function restoreFreeVehicles() {
  for (const id in (S.veh || {})) { const sv = S.veh[id]; if (!sv.moved || vehicles.some(v => v.id === id)) continue;
    const v = Object.assign({ id, speed: 0, ch: null, nome: VT[sv.type].n, moved: true }, JSON.parse(JSON.stringify(sv))); buildVehicle(v, scene); }
}
function resetWorld() {
  if (P && P.drive) P.drive = null;
  for (const v of [...vehicles]) { if (v.g.parent) v.g.parent.remove(v.g); setVehCols(v, false); } vehicles.length = 0;
  if (P) unloadAll(); else for (const ch of [...chunks.values()]) unloadChunk(ch);
  while (zombies.length) removeZombie(zombies[0]);
  while (animals.length) removeAnimal(animals[0]);
  while (fires.length) removeFire(fires[0]);
  drops.forEach(d => scene.remove(d.m)); drops = [];
  deltas = {};
}

// ---------------------------------------------------------------- passo fixo
function step(dt) {
  if (!P) return;
  simTime += dt;
  for (let i = holds.length - 1; i >= 0; i--) if (simTime >= holds[i].until) holds.splice(i, 1);
  // relógio
  const dh = dt * hourRate(S.hora);
  S.totalH += dh; S.hora = (C('horaInicio') + S.totalH) % 24;
  const newDia = 1 + Math.floor((C('horaInicio') + S.totalH - 6) / 24);
  if (newDia !== S.dia) {
    S.dia = newDia; log(`Dia ${S.dia} começou.`);
    if (S.dia >= C('diaSemAgua') && !S.aguaAviso) { S.aguaAviso = true; log('A água e a energia acabaram. Agora só o poço e as garrafas.'); tvs.forEach(t => { if (t.on) toggleTv(t); }); lamps.forEach(l => { if (l.on) toggleLamp(l); }); }
    save();
  }
  if (Math.floor(S.totalH) !== S.lastHour) { S.lastHour = Math.floor(S.totalH); hourly(); }
  needsTick(dh);
  tvT -= dt; if (tvT <= 0) { tvT = 3; for (const tv of tvs) if (tv.on) noise(tv.x, tv.z, 12); }
  for (const f of fires) f.h -= dh;
  for (let i = fires.length - 1; i >= 0; i--) if (fires[i].h <= 0) removeFire(fires[i]);
  // dormir
  if (P.sleeping) {
    P.sleepH += dh;
    if ((P.energia >= 99.5 && !isNight(S.hora)) || P.sleepH > 11) wake(P.sleepRate < 1 ? 'Você descansou.' : 'Você acordou.');
    else for (const z of zombies) if (!z.dead && z.state === 'chase' && Math.hypot(z.x - P.x, z.z - P.z) < 7) { wake('Um barulho te acordou!'); break; }
  }
  if (!P.sleeping) updatePlayer(dt); else if (P.sangrando || P.hp <= 0) { P.hp -= C('sangramentoSeg') * dt; if (P.hp <= 0) die(); }
  pressed.clear();
  // zumbis
  const active = [];
  if (NET && !NET.host) { netClientZombies(dt); for (let i = zombies.length - 1; i >= 0; i--) { const z = zombies[i]; if (z.dead && z.deadT > 40) { removeZombie(z); if (z.nid) NET.zMap.delete(z.nid); } } }
  else { const TG = NET ? zombieTargets() : null;
  for (let i = zombies.length - 1; i >= 0; i--) {
    const z = zombies[i];
    if (z.dead && z.deadT > 40) { removeZombie(z); if (NET && z.nid) NET.zMap.delete(z.nid); continue; }
    let tg = P, d = Math.hypot(z.x - P.x, z.z - P.z);
    if (TG) for (const t of TG) { if (t === P || t.dead) continue; const dd = Math.hypot(z.x - t.x, z.z - t.z); if (dd < d) { d = dd; tg = t; } }
    const P0 = P; if (tg !== P0) P = tg;
    try {
      if (d < 70 || z.state === 'chase') { updateZombie(z, dt, d); active.push(z); }
      else { z.far += dt; if (z.far > .5) { updateZombie(z, z.far, d); z.far = 0; } }
    } finally { P = P0; }
  } }
  separate(active);
  for (const a of animals) { if (a.dead && a.deadT > 90 && !a.carne) { removeAnimal(a); continue; } if (Math.abs(a.x - P.x) < 90 && Math.abs(a.z - P.z) < 90) updateAnimal(a, dt); }
  chunkT -= dt; if (chunkT <= 0) { chunkT = .25; ensureChunks(false); markExplored(); if (!NET || NET.host) { const TG = NET ? zombieTargets() : [P]; for (const z of [...zombies]) if (TG.every(t => Math.hypot(z.x - t.x, z.z - t.z) > 230)) { removeZombie(z); if (NET && z.nid) NET.zMap.delete(z.nid); } } }
  netTick(dt);
  barrMsgT -= dt;
}

// ---------------------------------------------------------------- render
const camTarget = new T.Vector3();
function animRig(r, o, dt, isZ) {
  if (!isZ) { animPlayer(r, dt); return; }
  r.root.rotation.order = 'YXZ';
  r.root.position.set(o.x, (o.lv || 0) * FLOOR_H, o.z); r.root.rotation.y = o.rot;
  if (o.dead || (o === P && P.dead)) {
    const t = Math.min(1, (o.deadT || 0) * 2.5);
    r.root.rotation.x = -PI / 2 * t; r.root.position.y = .15 * t;
    return;
  }
  r.root.rotation.x = 0; r.root.position.y = 0;
  const mv = o.moving ? 1 : 0, ph = o.phase;
  r.legs[0].rotation.x = Math.sin(ph) * .6 * mv; r.legs[1].rotation.x = -Math.sin(ph) * .6 * mv;
  if (isZ) {
    const sw = o.swing > 0 ? -.6 : 0, lp = o.limp || (o.limp = .4 + Math.random() * .6), t2 = simTime + (o.seed || (o.seed = Math.random() * 9));
    r.legs[0].rotation.x *= lp; // uma perna arrasta
    r.arms[0].rotation.x = -1.2 + Math.sin(ph * .7 + 1) * .18 + Math.sin(t2 * 1.3) * .08 + sw; r.arms[1].rotation.x = -1.05 - Math.sin(ph * .7) * .14 + sw;
    r.arms[0].rotation.z = .12 + Math.sin(t2 * .9) * .06; r.arms[1].rotation.z = -.1 - Math.sin(t2 * 1.1) * .06;
    r.torso.rotation.z = Math.sin(ph * .5) * .1 + Math.sin(t2 * .7) * .04; r.torso.rotation.y = Math.sin(ph * .5) * .08;
    r.root.position.y += Math.abs(Math.sin(ph)) * .03 * (o.moving ? 1 : 0);
  }
}
function animPlayer(r, dt) {
  const R = r.root, A0 = r.arms[0], A1 = r.arms[1], L0 = r.legs[0], L1 = r.legs[1], Tq = r.torso;
  const BY = (P.lv || 0) * FLOOR_H;
  R.rotation.order = 'YXZ'; R.position.set(P.x, BY, P.z); R.rotation.set(0, P.rot, 0); R.scale.y = 1;
  for (const g of [A0, A1, L0, L1]) g.rotation.set(0, 0, 0);
  Tq.rotation.set(0, 0, 0); r.head.rotation.set(0, 0, 0);
  if (P.dead) { const t = Math.min(1, P.deadT * 2.5); R.rotation.x = -PI / 2 * t; R.position.y = BY + .15 * t; return; }
  if (P.sleeping && P.pose) { // deitado na cama/feno, sentado no sofá/poltrona/cadeira, ou no chão perto do fogo
    const q = P.pose; R.rotation.y = q.rot;
    if (q.k === 'deitar') { R.rotation.x = -PI / 2; R.position.set(q.x + Math.sin(q.rot) * .85, q.y, q.z + Math.cos(q.rot) * .85); A0.rotation.z = .12; A1.rotation.z = -.12; r.head.rotation.y = Math.sin(simTime * .7) * .1; }
    else { R.position.set(q.x, q.y, q.z); L0.rotation.x = L1.rotation.x = -1.4; L0.rotation.z = .06; L1.rotation.z = -.06; A0.rotation.x = A1.rotation.x = -.55; Tq.rotation.x = -.08 + Math.sin(simTime * 1.4) * .02; }
    return;
  }
  const mv = P.moving ? 1 : 0, ph = P.phase, run = P.isRunning;
  // pernas e corpo: andar, correr, agachar
  const amp = run ? .9 : P.crouch ? .35 : .6;
  if (P.crouch) { R.position.y = BY - .2; L0.rotation.x = -.6 + Math.sin(ph) * amp * mv; L1.rotation.x = -.6 - Math.sin(ph) * amp * mv; Tq.rotation.x = .5; }
  else { L0.rotation.x = Math.sin(ph) * amp * mv; L1.rotation.x = -Math.sin(ph) * amp * mv; if (run) Tq.rotation.x = .24; R.position.y = BY + (run ? Math.abs(Math.sin(ph)) * .05 : 0); }
  const aamp = run ? 1.05 : .5;
  let a0x = -Math.sin(ph) * aamp * mv, a1x = Math.sin(ph) * aamp * mv;
  if (run) { a0x -= .35; a1x -= .35; }
  const an = P.anim, u = an ? an.t / an.dur : 0;
  if (P.arma) a1x = ITEMS[P.arma.id].tiro ? -.85 + Math.sin(ph) * .1 * mv : -.5 + Math.sin(ph) * .2 * mv + (run ? -.3 : 0);
  // lanterna: leva a mão à cintura, pega e aponta pra frente
  const lan = an && an.k.startsWith('lanterna') ? an : null;
  if (P.luz || lan) {
    if (lan && lan.k === 'lanterna_on') { if (u < .4) { a0x = .45 * (u / .4); A0.rotation.z = .35 * (u / .4); } else { const k = (u - .4) / .6; a0x = lerp(.45, -1.3, k); A0.rotation.z = .35 * (1 - k); } }
    else if (lan) { a0x = lerp(-1.3, .4, u); A0.rotation.z = .3 * u; }
    else { a0x = -1.3 + Math.sin(simTime * 1.3) * .03 + Math.sin(ph) * .06 * mv; A0.rotation.y = -.12; }
  }
  A0.rotation.x = a0x; A1.rotation.x = a1x;
  if (P.action) { // ações com barrinha
    const t = P.action.t, a = P.action.anim;
    A0.rotation.set(0, 0, 0); A1.rotation.set(0, 0, 0); if (!P.crouch) Tq.rotation.x = 0;
    if (a === 'curativo') { A0.rotation.set(-1.25, .3, .55); A1.rotation.x = -1.1 + Math.sin(t * 9) * .28; A1.rotation.z = -.55 + Math.cos(t * 9) * .3; Tq.rotation.x += .12; r.head.rotation.x = .35; }
    else if (a === 'comer' || a === 'beber') { const up = Math.min(1, t * 3) * (.85 + Math.sin(t * (a === 'comer' ? 8 : 3)) * .12); A1.rotation.x = -2.55 * up; A1.rotation.z = -.35 * up; A0.rotation.x = -.15; if (a === 'beber') { Tq.rotation.x -= .12 * up; r.head.rotation.x = -.3 * up; } }
    else if (a === 'andar') { const w2 = Math.sin(t * 9); L0.rotation.x = w2 * .7 - .3; L1.rotation.x = -w2 * .7 - .3; A0.rotation.x = -w2 * .5; A1.rotation.x = w2 * .5; Tq.rotation.x += .15; R.position.y += (t / P.action.dur) * FLOOR_H * (P.action.label.startsWith('Subindo') ? 1 : -1) * .6; }
    else if (a === 'martelar') { A0.rotation.x = -1.3; A0.rotation.z = .2; A1.rotation.x = -1.9 + Math.abs(Math.sin(t * 7.8)) * 1.1; }
    else { A0.rotation.x = -1.15 + Math.sin(t * 6) * .25; A1.rotation.x = -1.15 - Math.sin(t * 6) * .25; Tq.rotation.x += .18; r.head.rotation.x = .25; }
  }
  if (an && !lan) { // animações curtas
    const sw = Math.sin(u * PI);
    if (an.k === 'empurrar') { A1.rotation.x = -1.5 * sw; A1.rotation.z = -.12 * sw; Tq.rotation.x += .12 * sw; }
    else if (an.k === 'sacar') { A1.rotation.x = u < .45 ? lerp(a1x, .9, u / .45) : lerp(.9, a1x, (u - .45) / .55); A1.rotation.z = -.45 * sw; Tq.rotation.y = .2 * sw; }
    else if (an.k === 'guardar') { A1.rotation.x = u < .55 ? lerp(-.5, .9, u / .55) : lerp(.9, 0, (u - .55) / .45); A1.rotation.z = -.45 * sw; Tq.rotation.y = .2 * sw; }
  }
  if (P.swing > 0 && !P.action) { // ataques
    const t = 1 - P.swing / .3;
    if (P.arma && ITEMS[P.arma.id].tiro) { A1.rotation.x = -1.55 - (t < .35 ? .3 * (1 - t / .35) : 0); A1.rotation.z = .05; A0.rotation.x = -1.45; A0.rotation.z = -.4; r.head.rotation.x = .08; }
    else { A1.rotation.x = -2.4 + t * 3.0; Tq.rotation.y = .35 - t * .7; if (P.arma && P.arma.id === 'machado') A0.rotation.x = -2.2 + t * 2.4; }
  }
  if (P.hurtT > 0) { Tq.rotation.x -= .32 * (P.hurtT / .4); r.head.rotation.x = -.2 * (P.hurtT / .4); }
}
let lastUi = 0, lastTb = 0;
const _ab = new T.Vector3();
// reações do personagem (emoji sobre a cabeça)
function moodEmoji() {
  if (P.dead) return '';
  if (P.sleeping) return P.sleepRate < 1 ? '😌' : '😴';
  if (P.hurtT > 0) return '😣';
  if (P.action) { const a = P.action.anim; if (a === 'comer') return '😋'; if (a === 'beber') return '🥤'; if (a === 'curativo') return '🩹'; if (a === 'martelar') return '🔨'; }
  if (P.sangrando) return '🩸';
  if (P.infectado && P.infH > 12) return '🤒';
  for (const z of zombies) if (!z.dead && z.state === 'chase' && (z.lv || 0) === (P.lv || 0) && Math.hypot(z.x - P.x, z.z - P.z) < 6) return '😱';
  if (P.energia < 25) return '🫩';
  if (P.sede < 20) return '🥵';
  if (P.fome < 20) return '🤤';
  if (P.hp < 30) return '🤕';
  if (weight(P.inv) > pesoMax()) return '😩';
  return '';
}
const _mb = new T.Vector3();
function updateMood() {
  const el = $('mood'), e = moodEmoji();
  if (!e) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
  _mb.set(P.x, (P.crouch ? 2.1 : 2.45) + (P.lv || 0) * FLOOR_H + (P.action ? .45 : 0), P.z).project(camera);
  el.style.display = 'block'; el.style.left = ((_mb.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - _mb.y) / 2 * innerHeight) + 'px';
  if (el.textContent !== e) el.textContent = e;
}
function updateActBar() {
  const el = $('actbar');
  if (!P.action || P.dead) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
  _ab.set(P.x, (P.crouch ? 2.0 : 2.35) + (P.lv || 0) * FLOOR_H, P.z).project(camera);
  el.style.display = 'block';
  el.style.left = ((_ab.x + 1) / 2 * innerWidth) + 'px'; el.style.top = ((1 - _ab.y) / 2 * innerHeight) + 'px';
  if ($('actlbl').textContent !== P.action.label) $('actlbl').textContent = P.action.label;
  $('actfill').style.width = Math.min(100, P.action.t / P.action.dur * 100) + '%';
}
function render(dtReal) {
  if (!P) { renderer.render(scene, camera); return; }
  applyLight();
  camYaw = ISO_YAW;
  P.phase = P.phase || 0;
  animRig(prig, P, dtReal, false);
  const act = P.action && !P.dead ? P.action.anim : null;
  const an = P.anim, au = an ? an.t / an.dur : 0;
  const hideW = act || P.sleeping || (an && an.k === 'sacar' && au < .45) || (an && an.k === 'guardar' && au > .55);
  for (const k in weaponMeshes) weaponMeshes[k].visible = !hideW && !!(P.arma && P.arma.id === k);
  handItems.lantern.visible = !!(!P.sleeping && !act && (P.luz || (an && ((an.k === 'lanterna_on' && au > .35) || an.k === 'lanterna_off'))));
  handItems.bottle.visible = act === 'beber'; handItems.food.visible = act === 'comer'; handItems.roll.visible = act === 'curativo'; handItems.hammer.visible = act === 'martelar';
  handItems.band.visible = act === 'curativo' ? P.action.t > .6 : P.bandH > 0;
  updateActBar();
  if (tvs.some(t => t.on)) tvOnMat.color.setHSL(.58 + Math.sin(performance.now() * .003) * .05, .6, .55 + Math.sin(performance.now() * .011) * .12);
  const vis = C('distanciaVisivel');
  for (const z of zombies) {
    const d = Math.hypot(z.x - P.x, z.z - P.z);
    z.rig.root.visible = d < vis && (z.lv || 0) === (P.lv || 0); // só aparece no mesmo andar do jogador
    if (!z.rig.root.visible) continue;
    if (z.moving) z.phase += dtReal * zSpeed(z) * 2.6;
    animRig(z.rig, z, dtReal, true);
  }
  for (const a of animals) { const v = Math.abs(a.x - P.x) < vis && Math.abs(a.z - P.z) < vis; a.root.visible = v; if (v) animAnimal(a); }
  // câmera isométrica (de cima, na diagonal)
  const cp = Math.cos(ISO_PITCH), sp = Math.sin(ISO_PITCH);
  const CY = 1 + (P.lv || 0) * FLOOR_H;
  camera.position.set(P.x + Math.sin(camYaw) * cp * ISO_DIST, CY + sp * ISO_DIST, P.z + Math.cos(camYaw) * cp * ISO_DIST);
  camera.lookAt(P.x, CY, P.z);
  cutaway();
  animDoors(dtReal);
  if (SHADOWS) { sun.position.set(P.x + 30, 60, P.z + 18); sun.target.position.set(P.x, 0, P.z); sun.target.updateMatrixWorld(); }
  // telhado some quando você entra

  // lanterna
  const fx = Math.sin(P.rot), fz = Math.cos(P.rot);
  prig.root.visible = !P.drive;
  if (P.drive) { const v = P.drive; flash.position.set(v.x + Math.sin(v.rot) * VT[v.type].L / 2, 1, v.z + Math.cos(v.rot) * VT[v.type].L / 2); flash.target.position.set(v.x + Math.sin(v.rot) * 16, 0, v.z + Math.cos(v.rot) * 16); }
  else if (P.luz && handItems.lantern) { prig.root.updateMatrixWorld(true); handItems.lantern.getWorldPosition(flash.position); }
  else flash.position.set(P.x + fx * .3, 1.35 + (P.lv || 0) * FLOOR_H, P.z + fz * .3);
  if (!P.drive) flash.target.position.set(P.x + fx * 8, 0.3 + (P.lv || 0) * FLOOR_H, P.z + fz * 8);
  muzzle.intensity = Math.max(0, muzzle.intensity - dtReal * 40);
  fireLights.forEach((l, i) => { const f = fires[i]; if (f) { l.position.set(f.x, 1.2, f.z); l.intensity = 2.6 + Math.sin(performance.now() * .013 + i) * .4; f.fl.scale.y = 1 + Math.sin(performance.now() * .02 + i) * .15; } else l.intensity = 0; });
  if (false) { // passo 1: mundo sem o jogador; passo 2: só o jogador, por cima
    prig.root.traverse(o => o.layers.set(1));
    renderer.autoClear = true; camera.layers.set(0); renderer.render(scene, camera);
    const bg = scene.background, fg = scene.fog; scene.background = null;
    renderer.autoClear = false; renderer.clearDepth(); camera.layers.set(1); renderer.render(scene, camera);
    scene.background = bg;
    renderer.autoClear = true; camera.layers.set(0);
    prig.root.traverse(o => o.layers.set(0));
  } else renderer.render(scene, camera);
  netRender(dtReal);
  lastUi -= dtReal; if (lastUi <= 0) { lastUi = .1; updateUI(); }
}
function updateUI() {
  const tbh = $('topbar').offsetHeight; if (tbh !== lastTb) { lastTb = tbh; document.documentElement.style.setProperty('--tb', tbh + 'px'); }
  for (const [k, v] of [['Vida', P.hp], ['Fome', P.fome], ['Sede', P.sede], ['Cans', P.energia]]) {
    const pc = Math.max(0, Math.round(v)); $('f' + k).style.width = pc + '%';
    const el = $('p' + k); const t = pc + '%'; if (el.textContent !== t) el.textContent = t; el.classList.toggle('low', pc <= 25);
  }
  const w = weight(P.inv); $('fPeso').style.width = Math.min(100, w / pesoMax() * 100) + '%'; $('fPeso').style.background = w > pesoMax() ? '#c0602b' : '#8a8a7a'; $('pPeso').textContent = w.toFixed(1) + '/' + pesoMax() + 'kg'; $('pPeso').classList.toggle('low', w > pesoMax());
  const hh = Math.floor(S.hora), mm = Math.floor((S.hora - hh) * 6) * 10;
  $('clockT').textContent = `Dia ${S.dia} — ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${isNight(S.hora) ? ' (noite)' : ''}`;
  const zn = zoneNameAt(P.x, P.z); if ($('zoneT').textContent !== zn) $('zoneT').textContent = zn;
  const chips = []; // estados e emoções como emoji no canto
  if (P.drive) chips.push(['🚗', 'Dirigindo']);
  if (P.sleeping) chips.push([P.sleepRate < 1 ? '😌' : '😴', P.sleepRate < 1 ? 'Descansando' : 'Dormindo']);
  if (P.action) { const em = { comer: '😋', beber: '🥤', curativo: '🩹', martelar: '🔨', andar: '🪜', mexer: '🔎' }[P.action.anim]; if (em) chips.push([em, P.action.label]); }
  if (P.hurtT > 0) chips.push(['😣', 'Levou dano']);
  if (P.sangrando) chips.push(['🩸', 'Sangrando']);
  if (P.mordido) chips.push(['🧟', 'Mordida']);
  if (P.infectado && P.infH > 12) chips.push(['🤒', 'Febre']);
  if (!P.dead) for (const z of zombies) if (!z.dead && z.state === 'chase' && (z.lv || 0) === (P.lv || 0) && Math.hypot(z.x - P.x, z.z - P.z) < 6) { chips.push(['😱', 'Com medo']); break; }
  if (P.hp < 30) chips.push(['🤕', 'Machucado']);
  if (P.fome < 20) chips.push(['🤤', 'Com fome']); if (P.sede < 20) chips.push(['🥵', 'Com sede']); if (P.energia < 25) chips.push([P.energia <= 0 ? '😵' : '🫩', P.energia <= 0 ? 'Exausto' : 'Cansado']);
  if (w > pesoMax()) chips.push(['😩', 'Pesado']); if (P.crouch) chips.push(['🧎', 'Agachado']); if (P.isRunning) chips.push(['🏃', 'Correndo']);
  const ch = chips.map((c, i) => `<span class="emo" title="${c[1]}">${c[0]}</span>`).join(''); // em coluna (vertical)
  if ($('chips').innerHTML !== ch) $('chips').innerHTML = ch;
  const it = (!openPanel && !P.sleeping) ? findInteract() : null;
  const pr = $('prompt'), bi = $('bInt');
  if (it && !isTouch) { pr.style.display = 'block'; pr.textContent = '[E] ' + it.label; } else pr.style.display = 'none';
  // no celular o botão de usar só aparece quando há algo na frente, com o nome da ação
  bi.style.visibility = it ? 'visible' : 'hidden';
  if (it && bi.textContent !== it.label) bi.textContent = it.label;
  $('bRun').classList.toggle('on', !!P.run); $('bCrouch').classList.toggle('on', P.crouch); $('bLight').classList.toggle('on', P.luz);
  const def = equippedDef();
  if (P.drive) { const v = P.drive; $('weapon').textContent = `${v.nome} — gasolina ${Math.round(v.st.fuel)}% — ${Math.round(Math.abs(v.speed) * 3.6)} km/h`; } else $('weapon').textContent = P.arma ? (def.tiro ? `${def.n} — ${def.ammo === 'cartucho' ? 'cartuchos' : 'munição'} ${count(def.ammo || 'municao')}` : `${def.n} — ${Math.max(0, Math.round(P.arma.d / def.dur * 100))}%`) : 'Mãos vazias (Mochila → Equipar)';
  drawMinimap();
}
// minimapa redondo (gira junto com a câmera, você sempre no meio)
const mm = $('minimap'), mctx = mm.getContext('2d');
function drawMinimap() {
  const S2 = mm.width, R2 = S2 / 2, k = R2 / 40; // ~40 m de raio
  mctx.clearRect(0, 0, S2, S2);
  mctx.save(); mctx.beginPath(); mctx.arc(R2, R2, R2 - 2, 0, PI * 2); mctx.clip();
  mctx.translate(R2, R2); mctx.rotate(camYaw); mctx.scale(k, k); mctx.translate(-P.x, -P.z);
  const pcx = chunkOf(P.x), pcz = chunkOf(P.z);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const cx = pcx + dx, cz = pcz + dz; mctx.fillStyle = ZONE_COLOR[zoneAt(cx, cz)]; mctx.fillRect(cx * CH, cz * CH, CH + .5, CH + .5); }
  mctx.fillStyle = '#26272a';
  for (const ch of chunks.values()) { if (Math.abs(ch.cx - pcx) > 1 || Math.abs(ch.cz - pcz) > 1) continue; for (const [a, alongX, pos] of ch.roads) alongX ? mctx.fillRect(a, pos - 4, CH, 8) : mctx.fillRect(pos - 4, a, 8, CH); }
  mctx.fillStyle = '#26381e'; for (const t of trees) if (t.alive && Math.abs(t.x - P.x) < 45 && Math.abs(t.z - P.z) < 45) { mctx.beginPath(); mctx.arc(t.x, t.z, 1.6 * t.s, 0, 7); mctx.fill(); }
  mctx.lineWidth = .5; mctx.strokeStyle = 'rgba(0,0,0,.5)';
  for (const b of buildings) { if (Math.abs(b.x - P.x) > 60 || Math.abs(b.z - P.z) > 60) continue; mctx.fillStyle = b.kind === 'casa' || b.kind === 'casafazenda' ? '#c8b088' : b.kind === 'apartamento' ? '#a8a8a8' : b.kind === 'celeiro' ? '#a04a3a' : '#e0b050'; mctx.fillRect(b.x0, b.z0, b.w, b.d); mctx.strokeRect(b.x0, b.z0, b.w, b.d); }
  for (const v of vehicles) { if (Math.abs(v.x - P.x) > 50 || Math.abs(v.z - P.z) > 50) continue; mctx.save(); mctx.translate(v.x, v.z); mctx.rotate(-v.rot); mctx.fillStyle = v === P.drive ? '#ffe070' : '#3a6ad0'; mctx.fillRect(-VT[v.type].W / 2, -VT[v.type].L / 2, VT[v.type].W, VT[v.type].L); mctx.restore(); }
  mctx.fillStyle = '#5a9ad0'; for (const w of wells) { mctx.beginPath(); mctx.arc(w.x, w.z, 1.2, 0, 7); mctx.fill(); }
  mctx.fillStyle = 'rgba(6,8,10,.7)'; const gx0 = Math.floor(P.x / EXC), gz0 = Math.floor(P.z / EXC);
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (!(S.exp && S.exp[(gx0 + i) + ',' + (gz0 + j)])) mctx.fillRect((gx0 + i) * EXC, (gz0 + j) * EXC, EXC + .3, EXC + .3);
  mctx.restore();
  const ca = Math.cos(camYaw), sa = Math.sin(camYaw), fx = Math.sin(P.rot), fz = Math.cos(P.rot), dx = fx * ca - fz * sa, dy = fx * sa + fz * ca;
  mctx.save(); mctx.translate(R2, R2); mctx.rotate(Math.atan2(dx, -dy));
  mctx.fillStyle = '#ffe070'; mctx.strokeStyle = '#000'; mctx.lineWidth = 2; mctx.beginPath(); mctx.moveTo(0, -9); mctx.lineTo(6, 7); mctx.lineTo(0, 3); mctx.lineTo(-6, 7); mctx.closePath(); mctx.stroke(); mctx.fill();
  mctx.restore();
  mctx.strokeStyle = 'rgba(230,225,210,.85)'; mctx.lineWidth = 4; mctx.beginPath(); mctx.arc(R2, R2, R2 - 3, 0, PI * 2); mctx.stroke();
  const nx = R2 + Math.sin(camYaw) * (R2 - 14), ny = R2 - Math.cos(camYaw) * (R2 - 14);
  mctx.fillStyle = '#d04a3a'; mctx.beginPath(); mctx.arc(nx, ny, 10, 0, 7); mctx.fill(); mctx.fillStyle = '#fff'; mctx.font = 'bold 13px system-ui'; mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.fillText('N', nx, ny + 1);
}
// mapa grande da cidade (5 × 5 km)
let bigMapBase = null, bigMapLabels = null;
const EXC = 40, EXN = Math.ceil(HALF / EXC) + 1; // células de 40 m
const expKey = (x, z) => Math.floor(x / EXC) + ',' + Math.floor(z / EXC);
function markExplored() {
  if (!S.exp) S.exp = {};
  const gx = Math.floor(P.x / EXC), gz = Math.floor(P.z / EXC);
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (i * i + j * j <= 5) S.exp[(gx + i) + ',' + (gz + j)] = 1;
}
const explored = (x, z) => !!(S.exp && S.exp[expKey(x, z)]);
const NCH = Math.ceil(HALF / CH) + 1;
function drawBigMap() {
  const cv2 = $('bigmap'), g = cv2.getContext('2d'), N = NCH * 2, px = cv2.width / N;
  if (!bigMapBase) {
    bigMapBase = document.createElement('canvas'); bigMapBase.width = bigMapBase.height = cv2.width; const b = bigMapBase.getContext('2d');
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const cx = i - NCH, cz = j - NCH; b.fillStyle = ZONE_COLOR[zoneAt(cx, cz)]; b.fillRect(i * px, j * px, px + .5, px + .5); }
    b.strokeStyle = '#2a2a2c'; b.lineWidth = Math.max(1, px * .18);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const cx = i - NCH, cz = j - NCH;
      if (roadV(cx, cz)) { b.beginPath(); b.moveTo(i * px, j * px); b.lineTo(i * px, (j + 1) * px); b.stroke(); }
      if (roadH(cz, cx)) { b.beginPath(); b.moveTo(i * px, j * px); b.lineTo((i + 1) * px, j * px); b.stroke(); } }
    bigMapLabels = document.createElement('canvas'); bigMapLabels.width = bigMapLabels.height = cv2.width; const bl = bigMapLabels.getContext('2d');
    bl.font = `bold ${Math.max(10, px * 1.4)}px system-ui`; bl.textAlign = 'center'; bl.textBaseline = 'middle';
    const LBL = { prisao: 'PRISÃO', bombeiros: 'BOMBEIROS', delegacia: 'POLÍCIA', hospital: 'HOSPITAL' };
    for (const key in SPECIAL) { const k = SPECIAL[key]; if (!LBL[k]) continue; const [cx, cz] = key.split(',').map(Number); const x = (cx + NCH + .5) * px, y = (cz + NCH + .5) * px;
      bl.fillStyle = ZONE_COLOR[k]; bl.beginPath(); bl.arc(x, y, px * .8, 0, 7); bl.fill(); bl.strokeStyle = '#fff'; bl.lineWidth = 2; bl.stroke();
      bl.fillStyle = '#fff'; bl.strokeStyle = '#000'; bl.lineWidth = 3; bl.strokeText(LBL[k], x, y - px * 1.5); bl.fillText(LBL[k], x, y - px * 1.5); }
  }
  g.drawImage(bigMapBase, 0, 0);
  const ppm = cv2.width / (NCH * 2 * CH), off = NCH * CH, cs = EXC * ppm; // pixels por metro
  g.fillStyle = 'rgba(6,8,10,.72)';
  for (let i = -EXN; i < EXN; i++) for (let j = -EXN; j < EXN; j++) if (!(S.exp && S.exp[i + ',' + j])) g.fillRect((i * EXC + off) * ppm, (j * EXC + off) * ppm, cs + .6, cs + .6);
  // marcos importantes aparecem sempre por cima, para você saber para onde ir
  g.drawImage(bigMapLabels, 0, 0);
  const x = (P.x / CH + NCH) * px, y = (P.z / CH + NCH) * px;
  g.fillStyle = '#ffe070'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 13px system-ui'; g.textAlign = 'left'; g.strokeText('Você', x + 9, y); g.fillText('Você', x + 9, y);
}
function toggleBigMap() { if (!running || P.dead) return; if (openPanel === 'map') { closePanels(); return; } closePanels(); openPanel = 'map'; markExplored(); $('mapBack').style.display = 'block'; $('pMap').style.display = 'block'; drawBigMap(); }

// ---------------------------------------------------------------- menu / loop
let running = false;
const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);
function showMenu(sub, dead) {
  running = false; closePanels();
  if (P && !P.dead) save();
  $('menu').style.display = 'flex';
  let rec = 0, hasSave = false; try { rec = +localStorage.getItem('ultimosdias_rec') || 0; hasSave = !!localStorage.getItem(SAVE_KEY); } catch (e) {}
  $('menuSub').textContent = sub || 'Sobreviva o máximo de dias que conseguir.';
  $('menuRec').textContent = rec ? `Recorde: ${plural(Math.floor(rec / 24), 'dia', 'dias')} e ${plural(Math.floor(rec % 24), 'hora', 'horas')}` : '';
  $('mCont').style.display = (!NET && !dead && (hasSave || (P && !P.dead))) ? '' : 'none';
  $('mLeave').style.display = NET ? '' : 'none';
  $('mOnline').textContent = NET ? (P && P.dead ? 'Renascer no mundo online' : 'Voltar ao jogo online') : 'Jogar online com amigos';
  $('mNew').textContent = NET ? 'Sair e jogar sozinho' : 'Novo jogo';
  $('mCont').textContent = (P && !P.dead) ? 'Continuar' : 'Continuar jogo salvo';
}
function startGame(fresh) {
  $('menu').style.display = 'none'; $('sleepfx').style.opacity = 0;
  if (fresh || !P || P.dead) {
    if (prig) { scene.remove(prig.root); }
    resetWorld(); buildPlayer();
    if (fresh || !load()) {
      newState(); camYaw = ISO_YAW; ensureChunks(true);
      const st = [...chunks.values()].find(c => c.start); if (st) { P.x = st.start.x; P.z = st.start.z; }
      log('Você acordou. Ache comida, água e uma arma.'); setTimeout(() => log('O mundo é enorme: use o Mapa pra se orientar.'), 1500);
    } else log('Jogo carregado.');
  }
  running = true;
}
$('mNew').addEventListener('click', () => { if (NET) leaveOnline(); startGame(true); });
$('mOnline').addEventListener('click', () => { if (NET) { if (P && P.dead) netRespawn(); else { $('menu').style.display = 'none'; running = true; } } else startOnline(); });
$('mParty').addEventListener('click', async () => { try { await SDK.social.openParty({ mode: 'online' }); const party = await SDK.social.getParty(); if (party && party.launch && !NET) startOnline(); } catch (e) {} });
$('mLeave').addEventListener('click', () => leaveOnline());
function netRespawn() {
  buildPlayer(); newState();
  const st = [...chunks.values()].find(c => c.start); if (st) { P.x = st.start.x + rr(-1, 1); P.z = st.start.z; } else { P.x = START.x; P.z = START.z; }
  if (NET && NET.host === undefined) {}
  $('menu').style.display = 'none'; running = true; ensureChunks(true); log('Você renasceu. Cuidado lá fora.');
}
$('mCont').addEventListener('click', () => startGame(false));
addEventListener('visibilitychange', () => { if (document.hidden && running) save(); });
setInterval(() => { if (running) save(); }, 30000);

let acc = 0, last = performance.now();
function frame(now) {
  const real = Math.min(.1, (now - last) / 1000); last = now;
  if ((running || NET) && (!openPanel || NET) && P && !(P.dead && P.deadT > 3)) {
    acc += real;
    let n = 0;
    while (acc >= DT && n < 6) { step(DT); acc -= DT; n++; }
    if (acc > DT) acc = 0;
    if (P.sleeping && !NET) for (let i = 0; i < 30 && P.sleeping; i++) step(DT);
  }
  render(real);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- init
camera.position.set(START.x + 40, 50, START.z + 40); camera.lookAt(START.x, 0, START.z);
showMenu();
requestAnimationFrame(frame);
initSDK();

// API para testes automatizados
window.game = {
  get state() {
    if (!P) return { mode: 'menu' };
    return { mode: running ? 'jogando' : 'menu', dead: P.dead, sleeping: P.sleeping, x: +P.x.toFixed(2), z: +P.z.toFixed(2), hp: +P.hp.toFixed(1), fome: +P.fome.toFixed(1), sede: +P.sede.toFixed(1), energia: +P.energia.toFixed(1),
      dia: S.dia, hora: +S.hora.toFixed(2), zona: zoneNameAt(P.x, P.z), pedacos: chunks.size, animais: animals.length, zumbis: zombies.filter(z => !z.dead).length, perseguindo: zombies.filter(z => z.state === 'chase' && !z.dead).length,
      inv: P.inv.map(itemLabel), arma: P.arma ? P.arma.id : null, interagir: (findInteract() || {}).label || null, painel: openPanel };
  },
  start(fresh) { startGame(fresh !== false); },
  press(k) { if (k === 'inventory') togglePanel('inv'); else if (k === 'run') P.run = !P.run; else pressed.add(k); },
  hold(k, ms) { holds.push({ k, until: simTime + ms / 1000 }); },
  step(n) { for (let i = 0; i < (n || 1); i++) step(DT); render(DT); },
  _debug: { leave: () => leaveOnline(), chunkMap: () => chunks, deltas: () => deltas, net: () => NET, mkveh: (t, x, z) => { const v = { id: 'dbg' + Math.random(), type: t, x, z, rot: PI / 2, speed: 0, color: { taxi: 0xf0c020, policia: 0x1a1e2a, ambulancia: 0xf2f0ea, bombeiros: 0xc02a20, sedan: 0xd8dcd8, pickup: 0x7a7a5a, van: 0x6a8aa8, caminhao: 0x3a5a8a, limo: 0xeceae6 }[t], st: { fuel: 50, bat: true, vela: true, pneu: -1 }, items: [], nome: VT[t].n, moved: true }; buildVehicle(v, scene); return v; }, vehicles: () => vehicles, enter: (v) => { P.drive = null; enterCar(v); }, spawn: (t, x, z) => spawnZombie(t, x, z), hash2, animals: () => animals, info: () => renderer.info.render, tp: (x, z) => { P.x = x; P.z = z; ensureChunks(true); }, zoneAt, chunks: () => chunks.size, zoom: (h) => { viewH = h; updateCamProj(); }, P: () => P, S: () => S, zombies, buildings, containers, useItem, setCam: (y) => { camYaw = y; } },
};
})();

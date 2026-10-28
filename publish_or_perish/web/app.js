// 農場の画面. rosbridge (ws://<host>:9090) で /farm/state を読み, /farm/ui に操作を送る.
// 座標: 農場の (x, y) [m] を three.js の (x, 0, -y) に置く. 1 マス = 1 m.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/OrbitControls.js'

const $ = id => document.getElementById(id)
const CROP_NAME = { wheat: '小麦', tomato: 'トマト', pumpkin: 'カボチャ' }

// ---------------------------------------------------------------- rosbridge
const ros = {
  ws: null, open: false, handlers: {},
  connect() {
    const ws = new WebSocket(`ws://${location.hostname || 'localhost'}:9090`)
    this.ws = ws
    ws.onopen = () => {
      this.open = true
      ws.send(JSON.stringify({ op: 'subscribe', topic: '/farm/state', type: 'std_msgs/msg/String', throttle_rate: 50 }))
      ws.send(JSON.stringify({ op: 'advertise', topic: '/farm/ui', type: 'std_msgs/msg/String' }))
      setConn(true)
    }
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data)
      if (m.op === 'publish' && this.handlers[m.topic]) this.handlers[m.topic](m.msg)
    }
    ws.onclose = () => { this.open = false; setConn(false); setTimeout(() => this.connect(), 1500) }
  },
  publish(topic, data) {
    if (this.open) this.ws.send(JSON.stringify({ op: 'publish', topic, msg: { data } }))
  },
}

// ---------------------------------------------------------------- 3D シーン
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.95
$('scene').appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#a8dcf5')
scene.fog = new THREE.Fog('#bfe6f7', 40, 80)
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.maxPolarAngle = 1.35
controls.minDistance = 5
controls.maxDistance = 40

scene.add(new THREE.HemisphereLight('#dff3ff', '#5a7a3a', 1.0))
const sun = new THREE.DirectionalLight('#fff1d6', 2.4)
sun.position.set(-8, 16, 10)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 })
sun.shadow.bias = -0.0005
scene.add(sun, sun.target)

// 決まった並びの乱数 (毎回同じ景色にする)
let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...o })
const M = {
  grass: mat('#6cbf45'), trunk: mat('#8a5a34'), leaf: mat('#4f9e3d'), leaf2: mat('#6dbb4a'), rock: mat('#a7a39a'),
  fence: mat('#c99a5b'), stone: mat('#9c9a92'), roof: mat('#c2533a'), water: mat('#4aa8e8', { roughness: 0.2, metalness: 0.1 }),
  stalk: mat('#79b84a'), gold: mat('#e9bf45'), dead: mat('#8b7355'), tomato: mat('#e0402f', { roughness: 0.5 }),
  green: mat('#3f8f3a'), pumpkin: mat('#ee8a2a', { roughness: 0.6 }), white: mat('#f5f2ea'), orange: mat('#f08a24'),
  dark: mat('#2b3236'), wheel: mat('#3a3f44'), hub: mat('#c9ced3'),
  eye: new THREE.MeshBasicMaterial({ color: '#6ff3ff' }), coin: mat('#f5c542', { metalness: 0.4, roughness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.35, roughness: 0.1 }),
}

// 地面
{
  const g = new THREE.PlaneGeometry(120, 120, 60, 60)
  g.rotateX(-Math.PI / 2)
  const colors = []
  const c = new THREE.Color()
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, (rand() - 0.5) * 0.12)
    c.setHSL(0.27 + rand() * 0.05, 0.55, 0.33 + rand() * 0.07)
    colors.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }))
  ground.position.set(7, -0.06, -4.5)
  ground.receiveShadow = true
  scene.add(ground)
}

// 周りの木・岩・花 (畑の最大サイズ 14 x 9 の外に置く)
function tree(x, z, s) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 6), M.trunk)
  trunk.position.y = 0.4
  g.add(trunk)
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.75 - i * 0.18, 0.9, 7), i % 2 ? M.leaf2 : M.leaf)
    cone.position.y = 0.9 + i * 0.45
    g.add(cone)
  }
  g.position.set(x, 0, z)
  g.scale.setScalar(s)
  g.rotation.y = rand() * 6
  g.traverse(o => { o.castShadow = true })
  scene.add(g)
}
for (let i = 0; i < 70; i++) {
  const x = -10 + rand() * 34, z = -20 + rand() * 30
  if (x > -3 && x < 17 && z > -12.5 && z < 3.5) continue
  if (rand() < 0.75) tree(x, z, 0.8 + rand() * 0.7)
  else {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rand() * 0.3, 0), M.rock)
    r.position.set(x, 0.1, z)
    r.castShadow = true
    scene.add(r)
  }
}
{
  const flower = new THREE.SphereGeometry(0.06, 5, 4)
  const fm = ['#ffffff', '#ffd84a', '#ff8fb1', '#b58cff'].map(c => mat(c))
  for (let i = 0; i < 160; i++) {
    const x = -6 + rand() * 26, z = -16 + rand() * 22
    if (x > -1.2 && x < 15.2 && z > -10.2 && z < 1.2) continue
    const f = new THREE.Mesh(flower, fm[i % 4])
    f.position.set(x, 0.05, z)
    scene.add(f)
  }
}

// ---------------------------------------------------------------- 畑
const field = new THREE.Group()
scene.add(field)
let fieldW = 0, fieldH = 0
const tiles = []          // tiles[y][x] = { soil, crop, key }
const soilGeo = new THREE.BoxGeometry(0.94, 0.14, 0.94)
const soilTex = (() => {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const g = cv.getContext('2d')
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, 64, 64)
  for (let i = 0; i < 4; i++) {
    g.fillStyle = 'rgba(0,0,0,0.13)'
    g.fillRect(0, 6 + i * 16, 64, 5)
  }
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`
    g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2)
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
})()
const DRY = new THREE.Color('#d2a873'), WET = new THREE.Color('#6b4428')

function buildField(w, h) {
  field.clear()
  tiles.length = 0
  fieldW = w
  fieldH = h
  for (let y = 0; y < h; y++) {
    const row = []
    for (let x = 0; x < w; x++) {
      const soil = new THREE.Mesh(soilGeo, new THREE.MeshStandardMaterial({ map: soilTex, roughness: 1, color: DRY.clone() }))
      soil.position.set(x + 0.5, 0.02, -(y + 0.5))
      soil.receiveShadow = true
      soil.userData = { x, y }
      field.add(soil)
      row.push({ soil, crop: null, key: '' })
    }
    tiles.push(row)
  }
  // 柵
  const post = new THREE.CylinderGeometry(0.05, 0.06, 0.55, 5)
  const m = 0.35
  const addPost = (px, pz) => {
    const p = new THREE.Mesh(post, M.fence)
    p.position.set(px, 0.25, pz)
    p.castShadow = true
    field.add(p)
  }
  const rail = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1)
    for (const yy of [0.18, 0.38]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.04), M.fence)
      r.position.set((x1 + x2) / 2, yy, (z1 + z2) / 2)
      r.rotation.y = -Math.atan2(z2 - z1, x2 - x1)
      r.castShadow = true
      field.add(r)
    }
  }
  const x0 = -m, x1 = w + m, z0 = m, z1 = -h - m
  for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / Math.ceil(x1 - x0)) { addPost(x, z0); addPost(x, z1) }
  for (let z = z1; z <= z0 + 1e-6; z += (z0 - z1) / Math.ceil(z0 - z1)) { addPost(x0, z); addPost(x1, z) }
  rail(x0, z0, x1, z0); rail(x0, z1, x1, z1); rail(x0, z0, x0, z1); rail(x1, z0, x1, z1)
  // 座標の目盛り (data[y * width + x] の x, y)
  for (let x = 0; x < w; x++) field.add(label(`x=${x}`, x + 0.5, 0.05, 0.75, 0.32, '#4d5a3c'))
  for (let y = 0; y < h; y++) field.add(label(`y=${y}`, -0.85, 0.05, -(y + 0.5), 0.32, '#4d5a3c'))
  // 井戸
  well.position.set(0.5, 0, -0.5)
  field.add(well)
  retarget()
}

function label(text, x, y, z, h, color = '#ffffff', bg = null) {
  const cv = document.createElement('canvas')
  const g = cv.getContext('2d')
  const fs = 48
  g.font = `700 ${fs}px sans-serif`
  const w = Math.ceil(g.measureText(text).width) + 24
  cv.width = w
  cv.height = fs + 20
  g.font = `700 ${fs}px sans-serif`
  if (bg) {
    g.fillStyle = bg
    g.beginPath()
    g.roundRect(0, 0, w, cv.height, 18)
    g.fill()
  }
  g.fillStyle = color
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, w / 2, cv.height / 2 + 2)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false }))
  s.scale.set(h * w / cv.height, h, 1)
  s.position.set(x, y, z)
  return s
}

// 井戸
const well = new THREE.Group()
{
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.38, 10, 1, true), M.stone)
  ring.position.y = 0.19
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 10), M.water)
  water.position.y = 0.3
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.32, 4), M.roof)
  roof.position.y = 1.05
  roof.rotation.y = Math.PI / 4
  well.add(ring, water, roof)
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), M.trunk)
    p.position.set(s * 0.34, 0.5, 0)
    well.add(p)
  }
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 8), M.fence)
  bucket.position.y = 0.6
  well.add(bucket)
  well.scale.setScalar(0.8)
  well.traverse(o => { o.castShadow = true })
}

// ---------------------------------------------------------------- 作物
const G = {
  stalk: new THREE.CylinderGeometry(0.012, 0.018, 1, 4),
  head: new THREE.CapsuleGeometry(0.035, 0.12, 2, 5),
  leaf: new THREE.SphereGeometry(0.06, 5, 3),
  bush: new THREE.IcosahedronGeometry(0.16, 0),
  berry: new THREE.SphereGeometry(0.055, 7, 5),
  pumpkin: new THREE.SphereGeometry(0.22, 10, 7),
  stem: new THREE.CylinderGeometry(0.02, 0.03, 0.1, 5),
}

function makeCrop(kind, stage, dead) {
  const g = new THREE.Group()
  const r = (() => { let s = kind.length * 99 + stage; return () => ((s = (s * 16807) % 2147483647) / 2147483647) })()
  if (stage === 0) {
    // 芽
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(G.leaf, dead ? M.dead : M.stalk)
      l.scale.set(1, 0.4, 0.6)
      l.position.set(s * 0.05, 0.1, 0)
      g.add(l)
    }
    const st = new THREE.Mesh(G.stalk, dead ? M.dead : M.stalk)
    st.scale.y = 0.1
    st.position.y = 0.05
    g.add(st)
    return g
  }
  if (kind === 'wheat') {
    const n = 7
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r(), d = 0.08 + r() * 0.16
      const h = 0.18 + stage * 0.11
      const st = new THREE.Mesh(G.stalk, dead ? M.dead : stage >= 4 ? M.gold : M.stalk)
      st.scale.y = h
      st.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d)
      st.rotation.z = dead ? 0.6 : (r() - 0.5) * 0.2
      g.add(st)
      if (stage >= 3) {
        const head = new THREE.Mesh(G.head, dead ? M.dead : stage >= 4 ? M.gold : M.leaf2)
        head.position.set(st.position.x + (dead ? 0.1 : 0), h + 0.05, st.position.z)
        head.rotation.z = dead ? 1.2 : 0
        g.add(head)
      }
    }
  } else if (kind === 'tomato') {
    const s = 0.5 + stage * 0.17
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(G.bush, dead ? M.dead : M.green)
      b.position.set((r() - 0.5) * 0.2, 0.14 + i * 0.07, (r() - 0.5) * 0.2)
      b.scale.setScalar(s * (0.8 + r() * 0.4))
      g.add(b)
    }
    if (stage >= 3 && !dead) {
      for (let i = 0; i < 6; i++) {
        const t = new THREE.Mesh(G.berry, stage >= 4 ? M.tomato : M.leaf2)
        const a = i * 1.05
        t.position.set(Math.cos(a) * 0.17 * s, 0.14 + (i % 3) * 0.08, Math.sin(a) * 0.17 * s)
        g.add(t)
      }
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(G.leaf, dead ? M.dead : M.green)
      const a = i * 1.26
      l.scale.set(2, 0.5, 1.4)
      l.position.set(Math.cos(a) * 0.22, 0.06, Math.sin(a) * 0.22)
      l.rotation.y = -a
      g.add(l)
    }
    if (stage >= 2) {
      const p = new THREE.Mesh(G.pumpkin, dead ? M.dead : stage >= 4 ? M.pumpkin : M.leaf2)
      const s = 0.35 + stage * 0.17
      p.scale.set(s, s * 0.72, s)
      p.position.y = 0.2 * s * 0.72 + 0.02
      const stem = new THREE.Mesh(G.stem, M.trunk)
      stem.position.y = p.position.y * 2 + 0.03
      g.add(p, stem)
    }
  }
  g.traverse(o => { o.castShadow = true })
  return g
}

// ---------------------------------------------------------------- ロボット
const bots = {}
function makeBot(name) {
  const g = new THREE.Group()
  const body = new THREE.Group()
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.29, 0.16, 6), M.white)
  base.position.y = 0.17
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.04, 6), M.orange)
  stripe.position.y = 0.27
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.26), M.white)
  head.position.set(0.12, 0.36, 0)
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, 0.2), M.dark)
  face.position.set(0.205, 0.37, 0)
  const eyes = []
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.045, 0.035), M.eye)
    e.position.set(0.216, 0.38, s * 0.05)
    eyes.push(e)
    body.add(e)
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 10), M.glass)
  tank.position.set(-0.1, 0.4, 0)
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1, 10), M.water)
  water.position.set(-0.1, 0.29, 0)
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), M.dark)
  ant.position.set(0.1, 0.53, 0.08)
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#999' }))
  led.position.set(0.1, 0.64, 0.08)
  body.add(base, stripe, head, face, tank, water, ant, led)
  const wheels = []
  for (let i = 0; i < 3; i++) {
    const a = i * (Math.PI * 2 / 3) + Math.PI / 3
    const w = new THREE.Group()
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 10), M.wheel)
    tire.rotation.x = Math.PI / 2
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.065, 8), M.hub)
    hub.rotation.x = Math.PI / 2
    w.add(tire, hub)
    w.position.set(Math.cos(a) * 0.27, 0.085, -Math.sin(a) * 0.27)
    w.rotation.y = a + Math.PI / 2
    wheels.push(w)
    g.add(w)
  }
  g.add(body)
  g.scale.setScalar(1.35)
  g.traverse(o => { o.castShadow = true })
  const tag = label(name, 0, 0.95, 0, 0.22, '#ffffff', 'rgba(40,50,40,0.75)')
  scene.add(tag)
  scene.add(g)
  return { g, body, eyes, water, led, wheels, tag, x: null, y: null, th: 0, tx: 0, ty: 0, tth: 0, moving: 0, blink: 2 }
}

// ---------------------------------------------------------------- エフェクト
const parts = []
const pGeo = new THREE.SphereGeometry(0.04, 5, 4)
const coinGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10)
const fxMats = {
  water: new THREE.MeshBasicMaterial({ color: '#58b8f5', transparent: true }),
  dirt: new THREE.MeshBasicMaterial({ color: '#8a5a30', transparent: true }),
  smoke: new THREE.MeshBasicMaterial({ color: '#9a9a9a', transparent: true }),
  spark: new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true }),
  confetti: ['#e05244', '#f0a020', '#4caf50', '#3b82c4', '#9b6bd6'].map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true })),
}
function burst(kind, x, z, n) {
  for (let i = 0; i < n; i++) {
    let m, v, geo = pGeo, y = 0.3, life = 1
    const a = rand() * Math.PI * 2, s = rand()
    if (kind === 'water') { m = fxMats.water; v = [Math.cos(a) * s * 0.6, 1 + rand(), Math.sin(a) * s * 0.6]; y = 0.7 }
    if (kind === 'dirt') { m = fxMats.dirt; v = [Math.cos(a) * s, 1.4 + rand(), Math.sin(a) * s] }
    if (kind === 'smoke') { m = fxMats.smoke; v = [Math.cos(a) * 0.2, 0.6 + rand() * 0.4, Math.sin(a) * 0.2]; life = 1.6 }
    if (kind === 'spark') { m = fxMats.spark; v = [Math.cos(a) * s * 1.2, 1.5 + rand() * 1.5, Math.sin(a) * s * 1.2] }
    if (kind === 'coin') { m = M.coin; geo = coinGeo; v = [Math.cos(a) * s * 1.2, 2.5 + rand() * 1.5, Math.sin(a) * s * 1.2]; life = 1.3 }
    if (kind === 'confetti') { m = fxMats.confetti[i % 5]; v = [Math.cos(a) * s * 3, 3 + rand() * 3, Math.sin(a) * s * 3]; y = 1; life = 2 }
    const mesh = new THREE.Mesh(geo, m.clone ? m.clone() : m)
    mesh.position.set(x, y, z)
    if (kind === 'smoke') mesh.scale.setScalar(2.5)
    scene.add(mesh)
    parts.push({ mesh, v, life, max: life, kind })
  }
}
function stepParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    p.life -= dt
    const g = p.kind === 'smoke' ? -0.2 : 6
    p.v[1] -= g * dt
    p.mesh.position.x += p.v[0] * dt
    p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.v[1] * dt)
    p.mesh.position.z += p.v[2] * dt
    p.mesh.rotation.x += dt * 6
    if (p.mesh.material.transparent) p.mesh.material.opacity = Math.max(0, p.life / p.max)
    if (p.life <= 0) {
      scene.remove(p.mesh)
      parts.splice(i, 1)
    }
  }
}
// 3D の位置に文字を浮かべる
function floatText(text, x, y, z, color) {
  const v = new THREE.Vector3(x, y, z).project(camera)
  const d = document.createElement('div')
  d.className = 'float'
  d.textContent = text
  if (color) d.style.color = color
  d.style.left = `${(v.x + 1) / 2 * innerWidth - 30}px`
  d.style.top = `${(1 - v.y) / 2 * innerHeight - 20}px`
  document.body.appendChild(d)
  setTimeout(() => d.remove(), 1400)
}

// ---------------------------------------------------------------- 音
let actx = null
function tone(freq, t0, dur, type = 'sine', vol = 0.15) {
  if (!actx) return
  const o = actx.createOscillator(), g = actx.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(vol, actx.currentTime + t0)
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + t0 + dur)
  o.connect(g).connect(actx.destination)
  o.start(actx.currentTime + t0)
  o.stop(actx.currentTime + t0 + dur + 0.05)
}
const sfx = {
  harvest: () => { tone(988, 0, 0.12, 'square', 0.06); tone(1319, 0.08, 0.3, 'square', 0.06) },
  water: () => { tone(420, 0, 0.12, 'sine', 0.12); tone(300, 0.05, 0.15, 'sine', 0.1) },
  plant: () => tone(180, 0, 0.15, 'triangle', 0.2),
  wither: () => { tone(300, 0, 0.3, 'sawtooth', 0.04); tone(200, 0.2, 0.4, 'sawtooth', 0.04) },
  wall: () => tone(90, 0, 0.12, 'square', 0.08),
  buy: () => { tone(1568, 0, 0.1, 'square', 0.05); tone(2093, 0.1, 0.25, 'square', 0.05) },
  mission: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.3, 'triangle', 0.15)),
  achievement: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.25, 'sine', 0.12)),
  level: () => [392, 523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.35, 'square', 0.06)),
}
$('soundbtn').onclick = () => {
  if (!actx) { actx = new AudioContext(); $('soundbtn').textContent = '音: 入'; sfx.buy() }
  else { actx.close(); actx = null; $('soundbtn').textContent = '音: 切' }
}

// ---------------------------------------------------------------- 状態の反映
let state = null, lastFx = -1, lastNotice = -1, shownMoney = null, missionKey = ''

ros.handlers['/farm/state'] = msg => {
  const s = JSON.parse(msg.data)
  if (!state) {
    // 開いた時点より前のエフェクトと通知は出さない
    lastFx = s.fx.length ? s.fx[s.fx.length - 1].id : -1
    lastNotice = s.notices.length ? s.notices[s.notices.length - 1].id : -1
  }
  state = s
  apply(s)
}

function apply(s) {
  if (s.w !== fieldW || s.h !== fieldH) buildField(s.w, s.h)
  // マス
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const [moist, kind, growth, dead, isWell] = s.tiles[y * s.w + x]
      const t = tiles[y][x]
      t.soil.visible = !isWell
      t.soil.material.color.copy(DRY).lerp(WET, moist / 100)
      const stage = kind ? Math.min(4, Math.floor(growth * 4 + 1e-6)) : -1
      const key = kind ? `${kind}:${stage}:${dead}` : ''
      if (key !== t.key) {
        if (t.crop) field.remove(t.crop)
        t.crop = kind ? makeCrop(kind, stage, dead) : null
        if (t.crop) {
          t.crop.position.set(x + 0.5, 0.09, -(y + 0.5))
          field.add(t.crop)
        }
        t.key = key
      }
      if (t.crop) {
        t.crop.userData.ripe = stage >= 4 && !dead
        t.crop.userData.grow = 0.7 + 0.3 * Math.min(1, growth)
      }
    }
  }
  // ロボット
  for (const b of s.bots) {
    const r = bots[b.name] ?? (bots[b.name] = makeBot(b.name))
    if (r.x === null) { r.x = b.x; r.y = b.y; r.th = b.th }
    Object.assign(r, { tx: b.x, ty: b.y, tth: b.th, moving: b.moving })
    const lvl = Math.max(0.02, b.tank / b.tank_max)
    r.water.scale.y = 0.22 * lvl
    r.water.position.y = 0.29 + 0.11 * lvl
    r.led.material.color.set(b.src === 'player' ? '#5bf06a' : b.src === 'cli' ? '#ffb43a' : b.src === 'mixed' ? '#ff5a4a' : '#999999')
  }
  // エフェクト
  for (const f of s.fx) {
    if (f.id <= lastFx) continue
    lastFx = f.id
    effect(f, s)
  }
  syncHuts(s)
  for (const n of s.notices) {
    if (n.id <= lastNotice) continue
    lastNotice = n.id
    notify(n)
  }
  hud(s)
}

function effect(f, s) {
  const x = f.x + 0.5, z = -(f.y + 0.5)
  if (f.kind === 'water') { burst('water', x, z, 18); sfx.water() }
  if (f.kind === 'plant') { burst('dirt', x, z, 10); sfx.plant(); floatText(`-${f.value} G`, x, 0.6, z, '#ffd0c8') }
  if (f.kind === 'harvest') { burst('coin', x, z, 8); burst('spark', x, z, 12); sfx.harvest(); floatText(`+${f.value} G`, x, 0.8, z) }
  if (f.kind === 'clear') { burst('dirt', x, z, 8); sfx.plant() }
  if (f.kind === 'wither') { burst('smoke', x, z, 6); sfx.wither() }
  if (f.kind === 'ripe') burst('spark', x, z, 6)
  if (f.kind === 'refill') { burst('water', 0.5, -0.5, 12); floatText('満タン', 0.5, 1.1, -0.5, '#bfe8ff') }
  if (f.kind === 'wall') {
    const b = bots[f.bot]
    if (b && Math.random() < 0.3) { floatText('ゴツン', b.x, 0.8, -b.y, '#ffe0a0'); sfx.wall() }
  }
  if (f.kind === 'buy') { burst('confetti', s.w / 2, -s.h / 2, 40); sfx.buy() }
}

function notify(n) {
  const d = document.createElement('div')
  d.className = `toast ${n.kind}`
  d.innerHTML = `<b></b><span></span>`
  d.querySelector('b').textContent = n.title
  d.querySelector('span').textContent = n.body
  $('toasts').appendChild(d)
  setTimeout(() => d.remove(), 4200)
  if (n.kind === 'level') {
    $('bannertext').textContent = n.title
    $('bannersub').textContent = n.body
    $('banner').classList.add('show')
    setTimeout(() => $('banner').classList.remove('show'), 2600)
    burst('confetti', fieldW / 2, -fieldH / 2, 70)
    sfx.level()
  } else if (n.kind === 'achievement') sfx.achievement()
  else sfx.mission()
  if (n.kind === 'stage') burst('confetti', fieldW / 2, -fieldH / 2, 70)
}

// ---------------------------------------------------------------- HUD
function hud(s) {
  $('lv').innerHTML = `Lv<b>${s.level}</b>`
  $('title').textContent = s.title
  const span = Math.max(1, s.next_xp - s.lv_xp)
  $('xpfill').style.width = `${Math.min(100, (s.xp - s.lv_xp) / span * 100)}%`
  $('xptext').textContent = s.next_xp > s.lv_xp ? `${s.xp} / ${s.next_xp} XP` : `${s.xp} XP`
  if (shownMoney !== s.money) {
    if (shownMoney !== null) { $('money').classList.remove('bump'); void $('money').offsetWidth; $('money').classList.add('bump') }
    shownMoney = s.money
    $('moneyv').textContent = s.money.toLocaleString()
  }
  // ROS
  const mode = $('mode')
  const moving = s.bots.some(b => b.moving)
  if (s.graph.auto) { mode.className = 'pill auto'; mode.textContent = '無人運転中' }
  else if (s.graph.cli > 0) { mode.className = 'pill cli'; mode.textContent = `CLI で操作中 (${s.graph.cli})` }
  else if (moving) { mode.className = 'pill cli'; mode.textContent = '動作中' }
  else { mode.className = 'pill off'; mode.textContent = '停止中' }
  $('players').textContent = s.graph.players.length ? s.graph.players.join(', ') : 'なし'
  $('botinfo').textContent = s.bots.map(b => `${b.name} タンク ${b.tank}/${b.tank_max} ・ ${CROP_NAME[b.seed]}`).join(' / ')
  // ステージ
  const total = s.stage_count + s.upcoming.length
  $('stagebar').innerHTML = Array.from({ length: total }, (_, i) =>
    `<span class="${i < s.stage_index ? 'done' : i === s.stage_index ? 'now' : ''}"></span>`).join('')
  const key = JSON.stringify(s.stage ?? null)
  if (key !== missionKey) {
    missionKey = key
    if (s.stage) {
      $('stagetitle').textContent = s.stage.title
      $('lesson').textContent = `対応する講習: ${s.stage.lesson}`
      let opened = false
      $('missions').innerHTML = ''
      for (const m of s.stage.missions) {
        const el = document.createElement('div')
        el.className = `m${m.done ? ' done' : ''}`
        const open = !m.done && !opened
        if (open) opened = true
        const pct = Math.min(100, m.value / m.goal * 100)
        const val = m.unit === 'm' ? m.value.toFixed(1) : Math.floor(m.value)
        el.innerHTML = `
          <div class="head"><span class="check">${m.done ? '✓' : ''}</span><span class="t"></span><span class="reward">+${m.reward} G</span></div>
          ${m.goal > 1 || m.unit ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="num">${val} / ${m.goal} ${m.unit}</div>` : ''}
          ${open ? `<div class="desc"></div><div class="hint mono"><span></span><button>コピー</button></div>` : ''}`
        el.querySelector('.t').textContent = m.title
        if (open) {
          el.querySelector('.desc').textContent = m.desc
          el.querySelector('.hint span').textContent = m.hint
          el.querySelector('.hint button').onclick = e => {
            navigator.clipboard?.writeText(m.hint)
            e.target.textContent = '済'
          }
        }
        $('missions').appendChild(el)
      }
    } else {
      $('stagetitle').textContent = '今あるステージをすべてクリアした'
      $('lesson').textContent = '次のステージを準備中'
      $('missions').innerHTML = ''
    }
    $('upcoming').innerHTML = s.upcoming.map(u => `<div>準備中: ${u}</div>`).join('')
  }
  // ログ
  $('log').innerHTML = s.log.slice(-8).map(l => `<div class="${l.ok ? '' : 'ng'}"></div>`).join('')
  ;[...$('log').children].forEach((d, i) => { d.textContent = s.log.slice(-8)[i].text })
  // 実績
  const got = s.achievements.filter(a => a.done).length
  $('achcount').textContent = `${got}/${s.achievements.length}`
  if ($('achs').classList.contains('open')) renderAch(s)
  if ($('shop').classList.contains('open')) renderShop(s)
  if ($('wires').classList.contains('open')) renderWires(s)
  $('wirewarn').style.display = s.wires.some(w => w.warn) ? '' : 'none'
  $('speedbtn').textContent = `時間 ×${s.speed}`
}

function renderShop(s) {
  const box = $('shopitems')
  const key = JSON.stringify([s.shop, s.money])
  if (box.dataset.key === key) return
  box.dataset.key = key
  box.innerHTML = s.shop.length ? '' : '<div class="item">売り切れ</div>'
  for (const it of s.shop) {
    const d = document.createElement('div')
    d.className = 'item'
    d.innerHTML = `<div><div class="name"></div><div class="d"></div></div><button class="btn">${it.price} G</button>`
    d.querySelector('.name').textContent = it.name
    d.querySelector('.d').textContent = it.desc
    const btn = d.querySelector('button')
    btn.disabled = s.money < it.price
    btn.onclick = () => ros.publish('/farm/ui', `buy ${it.id}`)
    box.appendChild(d)
  }
}

function renderAch(s) {
  $('achitems').innerHTML = s.achievements.map(a => `<div class="${a.done ? 'got' : ''}"><b></b><span></span></div>`).join('')
  ;[...$('achitems').children].forEach((d, i) => {
    d.querySelector('b').textContent = s.achievements[i].name
    d.querySelector('span').textContent = s.achievements[i].desc
  })
}

$('shopbtn').onclick = () => { $('shop').classList.add('open'); $('shopitems').dataset.key = ''; state && renderShop(state) }
$('achbtn').onclick = () => { $('achs').classList.add('open'); state && renderAch(state) }
document.querySelectorAll('.modal').forEach(m => {
  m.onclick = e => { if (e.target === m || e.target.hasAttribute('data-close')) m.classList.remove('open') }
})

function setConn(ok) {
  $('conn').className = `pill ${ok ? 'auto' : 'bad'}`
  $('conn').textContent = ok ? '接続中' : '切断'
  $('connect').classList.toggle('hide', ok)
}

// ---------------------------------------------------------------- マスの情報 (マウス)
const ray = new THREE.Raycaster()
const mouse = new THREE.Vector2()
renderer.domElement.addEventListener('pointermove', e => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1)
  ray.setFromCamera(mouse, camera)
  const hit = ray.intersectObjects(tiles.flat().map(t => t.soil))[0]
  const tip = $('tip')
  if (!hit || !state) { tip.style.display = 'none'; return }
  const { x, y } = hit.object.userData
  const i = y * state.w + x
  const [moist, kind, growth, dead] = state.tiles[i]
  const crop = kind ? `${CROP_NAME[kind]} ${dead ? '(枯れた)' : growth >= 1 ? '(実った)' : `${Math.floor(growth * 100)}%`}` : 'なし'
  tip.innerHTML = `<b>マス (${x}, ${y})</b><br>水分 ${moist} ・ 作物 ${crop}<br>
    <span class="mono">data[${y} * ${state.w} + ${x}] = data[${i}]</span>`
  tip.style.display = 'block'
  tip.style.left = `${e.clientX + 16}px`
  tip.style.top = `${e.clientY + 12}px`
})

// ---------------------------------------------------------------- 配線の見える化 (農場の中)
// プレイヤーのノードと CLI ごとに, 畑の手前に小屋を建てる. メッセージ 1 つ = 光の粒 1 つ.
// 受け手のいない topic の粒は小屋の前に落ちて積もる.
const huts = {}            // ノード名 -> { g, x, pile: [] }
const flows = []           // 飛んでいる粒
const flowGeo = new THREE.SphereGeometry(0.07, 8, 6)
const FLOW_COLOR = { cmd_vel: '#ffb43a', pose: '#5ab8ff', tank: '#5ab8ff', field: '#7be07b', money: '#f5c542' }
const flowMats = {}
const flowMat = c => flowMats[c] ?? (flowMats[c] = new THREE.MeshBasicMaterial({ color: c, transparent: true }))
const spawnAcc = {}        // 粒を出す時間の端数

function topicColor(t) {
  for (const [k, c] of Object.entries(FLOW_COLOR)) if (t.includes(k)) return c
  return '#ffffff'
}

function makeHut(name, kind) {
  const g = new THREE.Group()
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.6), mat(kind === 'cli' ? '#f3d9a6' : '#e8efe0'))
  wall.position.y = 0.22
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.35, 4), mat(kind === 'cli' ? '#f0a020' : '#4caf50'))
  roof.position.y = 0.62
  roof.rotation.y = Math.PI / 4
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.02), M.trunk)
  door.position.set(0, 0.13, 0.31)
  g.add(wall, roof, door)
  g.traverse(o => { o.castShadow = true })
  const tag = label(kind === 'cli' ? 'CLI' : name, 0, 1.05, 0, 0.2, '#ffffff', kind === 'cli' ? 'rgba(160,100,0,0.8)' : 'rgba(40,110,50,0.8)')
  g.add(tag)
  scene.add(g)
  return { g, pile: [], kind }
}

// 状態が来るたびに小屋をそろえる
function syncHuts(s) {
  const want = new Map()
  for (const w of s.wires) {
    for (const [n, k] of [...w.pubs, ...w.subs]) if (k === 'player' || k === 'cli') want.set(k === 'cli' ? 'CLI' : n, k)
  }
  for (const n of Object.keys(huts)) {
    if (!want.has(n)) {
      scene.remove(huts[n].g)
      huts[n].pile.forEach(p => scene.remove(p))
      delete huts[n]
    }
  }
  let i = 0
  for (const [n, k] of want) {
    const h = huts[n] ?? (huts[n] = makeHut(n, k))
    // 畑の奥 (柵の向こう) に並べる. 粒は畑の上を飛ぶ
    h.x = 1 + i * 1.6
    h.z = -s.h - 1.5
    h.g.position.set(h.x, 0, h.z)
    i++
  }
}

function hutOf(name, kind) { return huts[kind === 'cli' ? 'CLI' : name] }

// topic の向こう側の 3D の位置 (ロボット, 畑の中央, 井戸)
function topicPoint(topic, s) {
  const m = topic.match(/^\/(bot\d+)\//)
  if (m && bots[m[1]]?.x != null) return new THREE.Vector3(bots[m[1]].x, 0.5, -bots[m[1]].y)
  if (topic.startsWith('/field/')) return new THREE.Vector3(s.w / 2, 0.3, -s.h / 2)
  return new THREE.Vector3(0.5, 0.6, -0.5)
}

function spawnFlows(dt, s) {
  for (const w of s.wires) {
    const rate = Math.min(w.hz, 12)
    if (rate <= 0) continue
    const color = topicColor(w.topic)
    const delivered = w.subs.length > 0
    // プレイヤーが出す topic: 小屋 → 相手 (受け手がいなければ小屋の前に落ちる)
    for (const [n, k] of w.pubs) {
      if (k !== 'player' && k !== 'cli') continue
      const h = hutOf(n, k)
      if (!h) continue
      const key = `p:${w.topic}:${n}`
      spawnAcc[key] = (spawnAcc[key] ?? Math.random()) + rate * dt
      while (spawnAcc[key] >= 1) {
        spawnAcc[key] -= 1
        const from = new THREE.Vector3(h.x, 0.6, h.z)
        const to = delivered ? topicPoint(w.topic, s) : new THREE.Vector3(h.x + (Math.random() - 0.5) * 1.2, 0.03, h.z + 0.7 + Math.random() * 0.3)
        launch(from, to, color, !delivered, h)
      }
    }
    // プレイヤーが受ける topic: 相手 → 小屋
    for (const [n, k] of w.subs) {
      if (k !== 'player' && k !== 'cli') continue
      const h = hutOf(n, k)
      if (!h || !w.pubs.length) continue
      const key = `s:${w.topic}:${n}`
      spawnAcc[key] = (spawnAcc[key] ?? Math.random()) + Math.min(rate, 6) * dt
      while (spawnAcc[key] >= 1) {
        spawnAcc[key] -= 1
        launch(topicPoint(w.topic, s), new THREE.Vector3(h.x, 0.6, h.z), color, false, h)
      }
    }
  }
}

function launch(from, to, color, drop, hut) {
  const mesh = new THREE.Mesh(flowGeo, flowMat(color))
  mesh.position.copy(from)
  scene.add(mesh)
  flows.push({ mesh, from, to, t: 0, dur: drop ? 0.7 : 0.55 + from.distanceTo(to) * 0.05, drop, hut })
}

function stepFlows(dt) {
  for (let i = flows.length - 1; i >= 0; i--) {
    const f = flows[i]
    f.t += dt / f.dur
    const k = Math.min(1, f.t)
    f.mesh.position.lerpVectors(f.from, f.to, k)
    f.mesh.position.y += Math.sin(Math.PI * k) * (f.drop ? 0.4 : 0.9)
    if (k >= 1) {
      if (f.drop && f.hut) {
        // 届かなかった粒は地面に残る (小屋ごとに 60 個まで)
        f.mesh.scale.setScalar(0.6)
        f.hut.pile.push(f.mesh)
        if (f.hut.pile.length > 60) scene.remove(f.hut.pile.shift())
      } else scene.remove(f.mesh)
      flows.splice(i, 1)
    }
  }
}

// ---------------------------------------------------------------- 配線図の画面
function renderWires(s) {
  const box = $('wireitems')
  if (!s.wires.length) { box.innerHTML = '<div class="legend">つながっている topic はまだない</div>'; return }
  const node = ([n, k]) => `<span class="node ${k}">${k === 'cli' ? 'CLI (' + esc(n) + ')' : esc(n)}</span>`
  const rate = w => w.hz >= 0.05 ? `${w.hz.toFixed(w.hz < 10 ? 1 : 0)} Hz ・ ${fmtBytes(w.bps)}/s` : '流れていない'
  box.innerHTML = s.wires.map(w => {
    const dur = w.hz > 0.05 ? Math.max(0.15, 2 / w.hz) : 0
    // 農場が出しているのを誰も見ていないだけなら, 間違いではないので灰色にする
    const idle = !w.subs.length && w.pubs.every(([, k]) => k === 'farm')
    const dead = !idle && (!w.pubs.length || !w.subs.length || w.hz < 0.05)
    return `<div class="wire">
      <div class="ends l">${w.pubs.length ? w.pubs.map(node).join('') : '<span class="node none">送り手なし</span>'}</div>
      <div class="mid${dead ? ' dead' : ''}"><svg><line x1="0" y1="2" x2="100%" y2="2" style="animation-duration:${dur}s"/></svg>
        <span class="pill2">${esc(w.topic)}<small>${esc(w.type.split('/').pop())} ・ ${rate(w)}</small></span></div>
      <div class="ends r">${w.subs.length ? w.subs.map(node).join('') : idle ? '<span class="node tool">まだ誰も見ていない</span>' : '<span class="node none">受け手なし</span>'}</div>
      ${w.warn ? `<div class="warnline">${esc(w.warn)}${w.hint ? ` → <b>${esc(w.hint)}</b>` : ''}</div>` : ''}
    </div>`
  }).join('')
}
const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const fmtBytes = b => b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(1)} kB` : `${b} B`

$('wirebtn').onclick = () => { $('wires').classList.add('open'); state && renderWires(state) }
$('speedbtn').onclick = () => {
  const next = { 1: 2, 2: 4, 4: 1 }[state?.speed ?? 1]
  ros.publish('/farm/ui', `speed ${next}`)
}

// ---------------------------------------------------------------- 描画ループ
let camSet = false
function retarget() {
  const cx = fieldW / 2, cz = -fieldH / 2
  // 右の課題パネルの分だけ畑を左に寄せて見せる
  controls.target.set(cx + 1.6, 0, cz - 0.6)
  if (!camSet) {
    camera.position.set(cx + 0.2, 6.5 + fieldH * 0.75, cz + 6.5 + fieldH * 0.95)
    camSet = true
  }
  sun.target.position.set(cx, 0, cz)
  sun.position.set(cx - 8, 16, cz + 10)
}
function resize() {
  renderer.setSize(innerWidth, innerHeight)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)
resize()

const clock = new THREE.Clock()
function loop() {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime
  for (const r of Object.values(bots)) {
    if (r.x === null) continue
    const k = 1 - Math.exp(-dt * 14)
    r.x += (r.tx - r.x) * k
    r.y += (r.ty - r.y) * k
    let d = r.tth - r.th
    d = Math.atan2(Math.sin(d), Math.cos(d))
    r.th += d * k
    r.g.position.set(r.x, 0, -r.y)
    r.g.rotation.y = r.th
    r.body.position.y = r.moving ? Math.abs(Math.sin(t * 14)) * 0.02 : Math.sin(t * 2) * 0.008
    r.wheels.forEach(w => { w.children[0].rotation.y += r.moving ? dt * 12 : 0 })
    r.tag.position.set(r.x, 1.15, -r.y)
    r.blink -= dt
    const closed = r.blink < 0.12
    r.eyes.forEach(e => { e.scale.y = closed ? 0.15 : 1 })
    if (r.blink < 0) r.blink = 2 + Math.random() * 3
  }
  for (const row of tiles) {
    for (const tl of row) {
      if (!tl.crop) continue
      const sway = tl.crop.userData.ripe ? Math.sin(t * 2.4 + tl.soil.userData.x) * 0.06 : Math.sin(t * 1.5 + tl.soil.userData.y) * 0.02
      tl.crop.rotation.z = sway
      tl.crop.scale.setScalar(tl.crop.userData.grow ?? 1)
    }
  }
  well.children[1].position.y = 0.3 + Math.sin(t * 2) * 0.01
  stepParts(dt)
  if (state) spawnFlows(dt, state)
  stepFlows(dt)
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(loop)
}
buildField(8, 5)
ros.connect()
loop()

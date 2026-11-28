// 大会モードの画面. tools/mjcf_export.py が書き出した scenes/<名前>/ を読み, 農場と同じ光と色づかいで描く.
// MuJoCo は Z 上なので, 全体を X 軸まわりに -90 度回して three.js の Y 上に合わせる.
// シミュレーター (match_sim.py) が動いていれば, rosbridge で /match/state を読んで物を動かし,
// キーの操作を /match/ui に送る (キーと自分のノードの操作を, シミュレーターが分けて判定するため).
// モードは 自由走行 / 練習 (課題) / 試合. ?scene=scenes/src2026 は SRC2026 の見た目の試作 (動かない).
// React Three Fiber での作り直しは docs/design/web-architecture.md の移行の段階 4 で行う. ここでは書き方を変えずに型だけ付けた.

import { esc, expandMessages, render as renderGuide } from '@pop/guide'
import { currentLang, initI18n, type Msg, tm, tr } from '@pop/i18n'
import { defaultUrl, RosLink } from '@pop/ros'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// 操作の結果・知らせ・課題の題 (/match/state のキーと値) を訳すので, 訳の表を先に読む
await initI18n()

const params = new URLSearchParams(location.search)
const SCENE_DIR = params.get('scene') ?? 'scenes/harurobo2027'
const FREE = !SCENE_DIR.includes('src2026')
const $ = (id: string) => document.getElementById(id) as HTMLElement

// ---------------------------------------------------------------- 書き出したシーンの形 (tools/mjcf_export.py)
type Vec3 = [number, number, number]
type Quat = [number, number, number, number]
type Geom = {
  name: string
  type: 'box' | 'sphere' | 'ellipsoid' | 'cylinder' | 'capsule' | 'mesh' | string
  size: Vec3
  pos: Vec3
  quat: Quat
  rgba: Quat
  material?: string
  mesh: number
}
type SceneDesc = {
  source: string
  meshes: { vert_offset: number; nvert: number; face_offset: number; nface: number }[]
  bodies: { name: string; pos: Vec3; quat: Quat; geoms: Geom[] }[]
}
type Mode = 'free' | 'course' | 'match'
type Phase = 'ready' | 'setting' | 'match' | 'finished'
/** 練習の課題 (段階 manual / semi / auto ごと). 題は訳の表の match.task.<id>, 段階の名前は match.level.<id> */
type Course = {
  levels: { id: string; tasks: { id: string; done: boolean }[] }[]
  current: string | null
  /** いまの課題が済まない理由 */
  note: Msg | null
  /** この回に台車 (drive) と機構 (mech) を動かした送り手 (keyboard / cli / player) */
  run: { drive: string[]; mech: string[] }
  elapsed: number
  /** 試し (課題を選んで始めた. 進み具合を保存しない) か */
  trial: boolean
}
/** 試合と練習の状態 (match_sim.py の publish) */
type MatchStatus = {
  mode: Mode
  phase: Phase
  remaining: number | null
  score: number
  /** 得点の項目 A〜F. 名前は訳の表の match.item.<記号> */
  items: Record<string, { points: number; count?: number }>
  stopped: Msg | null
  message: Msg | null
  result: { score: number; declared: boolean; time: number } | null
  best: { score?: number; declared?: boolean; time?: number }
  course: Course | null
  /** 動かしているお手本の種類 (auto / semi) */
  demo: string | null
  /** この回にお手本を動かしたか (数えない) */
  demo_run: boolean
  trial: boolean
}
/** /match/state: 物の位置 [x, y, z, qw, qx, qy, qz] と, ロボットの状態 */
type MatchState = {
  t: number
  bodies: Record<string, [number, number, number, number, number, number, number]>
  /** action は最後の操作の結果 (キーと値. 訳の表の match.*), action_ok はそれがうまくいったか */
  robot?: { extend: number; lift: number; carried: string[]; dice: number; signal: boolean; action: Msg | null; action_ok: boolean }
  match?: MatchStatus
}

// ---------------------------------------------------------------- rosbridge
function setConn(text: string) {
  const e = document.getElementById('conn')
  if (e) e.textContent = text
}
function setAction(text: string, ok: boolean) {
  const e = document.getElementById('action')
  if (!e || !text) return
  e.textContent = text
  e.className = ok ? 'ok' : 'ng'
}
let pubUi: ((m: { data: string }) => void) | null = null
/** キーの操作をシミュレーターへ送る ("drive 0.6 0 0", "act grab", "mode course" など) */
const ui = (text: string) => pubUi?.({ data: text })

function connect(onState: (s: MatchState) => void) {
  const link = new RosLink(defaultUrl(), ok => {
    if (!ok) setConn('シミュレーターにつながっていない')
  })
  link.subscribe<{ data: string }>('/match/state', 'std_msgs/msg/String', m => onState(JSON.parse(m.data) as MatchState), 30)
  pubUi = link.publisher('/match/ui', 'std_msgs/msg/String')
}

// ---------------------------------------------------------------- 3D
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.95
$('scene').appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#a8dcf5')
scene.fog = new THREE.Fog('#bfe6f7', 14, 34)
const camera = new THREE.PerspectiveCamera(36, 1, 0.02, 100)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.maxPolarAngle = 1.4

scene.add(new THREE.HemisphereLight('#dff3ff', '#5a7a3a', 1.0))
const sun = new THREE.DirectionalLight('#fff1d6', 2.4)
sun.position.set(-3, 7, 4)
sun.castShadow = true
sun.shadow.mapSize.set(4096, 4096)
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 })
sun.shadow.bias = -0.0003
sun.shadow.normalBias = 0.01
scene.add(sun)

// CAD の材料名 → ゲームの色. 名前にない材料は MJCF の色を使う
const PALETTE: Record<string, string> = {
  field_plywood: '#f1deb0',
  field_timber: '#b98552',
  field_line_black: '#2b2b2b',
  field_line_red: '#e05244',
  robot_white: '#f5f2ea',
  robot_black: '#3a3f44',
  robot_aluminium: '#c9ced6',
  robot_steel: '#9aa3ad',
  robot_red: '#e8613f',
  robot_rubber: '#2f3337',
  lidar_visual_housing: '#2b3236',
  lidar_visual_window: '#5a6670',
}
const matCache: Record<string, THREE.MeshStandardMaterial> = {}
function material(g: Geom): THREE.MeshStandardMaterial {
  const key = g.material || g.name
  const cached = matCache[key]
  if (cached) return cached
  const named = g.material ? PALETTE[g.material] : undefined
  const c = named ? new THREE.Color(named) : new THREE.Color().setRGB(g.rgba[0], g.rgba[1], g.rgba[2], THREE.SRGBColorSpace)
  // 色を少しだけ鮮やかにする (CAD の色はくすみやすい)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, Math.min(1, hsl.s * 1.25), hsl.l)
  // 透明な材料 (ペットボトル) は奥の物が透けて見えるように深度を書かない
  const alpha = g.rgba[3]
  return (matCache[key] = new THREE.MeshStandardMaterial({
    color: c,
    roughness: alpha < 1 ? 0.2 : 0.85,
    metalness: g.material?.includes('steel') ? 0.3 : 0,
    flatShading: true,
    transparent: alpha < 1,
    opacity: alpha,
    depthWrite: alpha >= 1,
  }))
}

function primitive(g: Geom): THREE.BufferGeometry | undefined {
  const [a, b, c] = g.size
  if (g.type === 'box') return new THREE.BoxGeometry(2 * a, 2 * b, 2 * c)
  if (g.type === 'sphere') return new THREE.SphereGeometry(a, 16, 12)
  if (g.type === 'ellipsoid') return new THREE.SphereGeometry(1, 16, 12).scale(a, b, c)
  if (g.type === 'cylinder') return new THREE.CylinderGeometry(a, a, 2 * b, 24).rotateX(Math.PI / 2)
  if (g.type === 'capsule') return new THREE.CapsuleGeometry(a, 2 * b, 6, 12).rotateX(Math.PI / 2)
  return undefined
}

const quat = (q: Quat) => new THREE.Quaternion(q[1], q[2], q[3], q[0]) // MuJoCo は (w, x, y, z)

async function load() {
  const [desc, bin] = await Promise.all([
    fetch(`${SCENE_DIR}/scene.json`).then(r => r.json() as Promise<SceneDesc>),
    fetch(`${SCENE_DIR}/meshes.bin`).then(r => r.arrayBuffer()),
  ])
  const meshGeo = desc.meshes.map(m => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bin, m.vert_offset, m.nvert * 3), 3))
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(bin, m.face_offset, m.nface * 3), 1))
    geo.computeVertexNormals()
    return geo
  })
  const root = new THREE.Group()
  root.rotation.x = -Math.PI / 2
  scene.add(root)
  const bodies: Record<string, THREE.Group> = {}
  for (const b of desc.bodies) {
    const bg = new THREE.Group()
    bg.position.set(...b.pos)
    bg.quaternion.copy(quat(b.quat))
    for (const g of b.geoms) {
      const geo = g.type === 'mesh' ? meshGeo[g.mesh] : primitive(g)
      if (!geo) continue
      const mesh = new THREE.Mesh(geo, material(g))
      mesh.name = g.name
      mesh.position.set(...g.pos)
      mesh.quaternion.copy(quat(g.quat))
      mesh.castShadow = true
      mesh.receiveShadow = true
      bg.add(mesh)
    }
    bg.name = b.name
    root.add(bg)
    bodies[b.name] = bg
  }
  if (!FREE) $('note').textContent = `見た目の試作: ${desc.source} を読み込んで描いている (動きはまだない)`
  // フィールドの大きさ (SRC2026 は 2.65 x 4.8 m, 春ロボ 2027 は 7 x 7 m) に周りの木・影・霧を合わせる
  scene.updateMatrixWorld(true) // root の回転を入れた後の大きさ (three.js の x と z が床の向き) を測る
  const size = new THREE.Box3().setFromObject(bodies.field ?? root, true).getSize(new THREE.Vector3())
  return { bodies, half: { x: size.x / 2, z: size.z / 2 } }
}

// 周りの地面と木 (農場の画面と同じ作り). half はフィールドの半分の大きさ [m]. 木はフィールドの外にだけ植える
let seed = 11
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
function surroundings(half: { x: number; z: number }) {
  const r = Math.max(half.x, half.z)
  Object.assign(sun.shadow.camera, { left: -r - 0.5, right: r + 0.5, top: r + 0.5, bottom: -r - 0.5, far: 20 + 2 * r })
  sun.position.set(-3, 7, 4).multiplyScalar(Math.max(1, r / 3))
  sun.shadow.camera.updateProjectionMatrix()
  scene.fog = new THREE.Fog('#bfe6f7', 14 * Math.max(1, r / 2.4), 34 * Math.max(1, r / 2.4))
  const g = new THREE.PlaneGeometry(60 + 4 * r, 60 + 4 * r, 40, 40)
  g.rotateX(-Math.PI / 2)
  const colors: number[] = [],
    c = new THREE.Color(),
    pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, (rand() - 0.5) * 0.04)
    c.setHSL(0.27 + rand() * 0.05, 0.55, 0.33 + rand() * 0.07)
    colors.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }))
  ground.position.y = -0.03
  ground.receiveShadow = true
  scene.add(ground)
  const leaf = new THREE.MeshStandardMaterial({ color: '#4f9e3d', flatShading: true }),
    trunk = new THREE.MeshStandardMaterial({ color: '#8a5a34', flatShading: true })
  for (let i = 0; i < 40; i++) {
    const x = (-10 + rand() * 20) * Math.max(1, r / 2.4),
      z = (-12 + rand() * 24) * Math.max(1, r / 2.4)
    if (Math.abs(x) < half.x + 1.3 && Math.abs(z) < half.z + 1.2) continue
    // カメラはスタートゾーンの側 (+z) の上にあるので, その手前には植えない (木がフィールドを隠す)
    if (z > 0 && Math.abs(x) < half.x + 4) continue
    const t = new THREE.Group()
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.6, 6), trunk)
    tr.position.y = 0.3
    t.add(tr)
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.55 - k * 0.13, 0.7, 7), leaf)
      cone.position.y = 0.7 + k * 0.33
      t.add(cone)
    }
    t.position.set(x, 0, z)
    t.scale.setScalar(0.9 + rand() * 0.6)
    t.traverse(o => {
      o.castShadow = true
    })
    scene.add(t)
  }
}

function resize() {
  renderer.setSize(innerWidth, innerHeight)
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
}
addEventListener('resize', resize)
resize()

// ---------------------------------------------------------------- キーの操作
// 台車は機体の向きで動かす: W 前 / S 後 / A 左 / D 右 / Q 左回り / E 右回り. Shift で速く
const KEYS: Record<string, Vec3> = {
  KeyW: [1, 0, 0],
  KeyS: [-1, 0, 0],
  KeyA: [0, 1, 0],
  KeyD: [0, -1, 0],
  KeyQ: [0, 0, 1],
  KeyE: [0, 0, -1],
  ArrowUp: [1, 0, 0],
  ArrowDown: [-1, 0, 0],
  ArrowLeft: [0, 0, 1],
  ArrowRight: [0, 0, -1],
}
type ArmKey = 'extend' | 'lift'
// アームとリフト: 押している間, 目標を 0.4 m/s・0.3 m/s で動かす
const ARM_KEYS: Record<string, [ArmKey, number]> = {
  KeyI: ['extend', 0.4],
  KeyK: ['extend', -0.4],
  KeyU: ['lift', 0.3],
  KeyJ: ['lift', -0.3],
}
const ARM_MAX: Record<ArmKey, number> = { extend: 0.42, lift: 0.35 }
const armTarget: Record<ArmKey, number> = { extend: 0, lift: 0 }
// 1 回押すと 1 回送る操作
const ONCE: Record<string, string> = {
  KeyG: 'act grab',
  KeyP: 'act place',
  KeyT: 'act throw',
  KeyX: 'act dice',
  KeyZ: 'act signal',
  KeyR: 'reset',
  Enter: 'start',
  KeyY: 'retry',
  Digit1: 'button 1',
  Digit2: 'button 2',
  Digit3: 'button 3',
  Digit4: 'button 4',
}
const held = new Set<string>()
let fast = false,
  follow = false,
  sending = false,
  mode: Mode = 'free'
addEventListener('keydown', e => {
  // 説明を読んでいる間はロボットを動かさない
  if (e.code === 'Escape') {
    closeGuide()
    return
  }
  if ($('guide').classList.contains('open')) return
  fast = e.shiftKey
  if (KEYS[e.code] || ARM_KEYS[e.code]) {
    held.add(e.code)
    e.preventDefault()
  }
  if (e.code === 'KeyF') follow = !follow
  const once = ONCE[e.code]
  if (once && !e.repeat) {
    if (e.code === 'Enter' && mode !== 'match') return
    ui(once)
  }
})
addEventListener('keyup', e => {
  fast = e.shiftKey
  held.delete(e.code)
})
addEventListener('blur', () => held.clear())
setInterval(() => {
  for (const k of held) {
    const a = ARM_KEYS[k]
    if (!a) continue
    const [joint, speed] = a
    armTarget[joint] = Math.max(0, Math.min(ARM_MAX[joint], armTarget[joint] + speed * 0.05))
    ui(`arm ${joint} ${armTarget[joint].toFixed(3)}`)
  }
}, 50)
// 押している間は 20 Hz で送る. 離したら 1 回だけ 0 を送る (押していないときは送らない)
setInterval(() => {
  const v: Vec3 = [0, 0, 0]
  const drive = [...held].filter(k => KEYS[k])
  for (const k of drive)
    (KEYS[k] as Vec3).forEach((a, i) => {
      v[i] = (v[i] as number) + a
    })
  if (!drive.length && !sending) return
  sending = drive.length > 0
  const lin = fast ? 1.5 : 0.6,
    ang = fast ? 2.5 : 1.2
  ui(`drive ${(v[0] * lin).toFixed(2)} ${(v[1] * lin).toFixed(2)} ${(v[2] * ang).toFixed(2)}`)
}, 50)

// ---------------------------------------------------------------- 説明 (public/guide/<言語>/<id>.md)
const guides = new Map<string, Promise<string | null>>()
const fetchText = (path: string) =>
  fetch(path, { cache: 'no-cache' })
    .then(r => (r.ok ? r.text() : null))
    .catch(() => null)
function loadGuide(id: string): Promise<string | null> {
  const lang = currentLang()
  let p = guides.get(`${lang}/${id}`)
  if (!p) {
    p = fetchText(`guide/${lang}/${id}.md`).then(t => t ?? (lang === 'ja' ? null : fetchText(`guide/ja/${id}.md`)))
    guides.set(`${lang}/${id}`, p)
  }
  return p
}
async function openGuide(id: string) {
  const text = await loadGuide(id)
  const lang = currentLang()
  const label = tr('guide.translation')
  // ターミナルに出る文 ({{msg:...}}) は英語の原文と訳にしてから描く
  const md = text
    ? expandMessages(text, {
        original: (key, args) => tr(key, args, 'en'),
        translated: lang === 'en' ? null : (key, args) => tr(key, args, lang),
        label,
      })
    : null
  const body = $('guidebody')
  body.innerHTML = md ? renderGuide(md, { copy: tr('ui.copy'), translation: label }) : '<p>この課題の説明はまだない。</p>'
  for (const b of body.querySelectorAll<HTMLButtonElement>('.code button')) {
    b.onclick = () => {
      void navigator.clipboard?.writeText(b.nextElementSibling?.textContent ?? '')
      b.textContent = tr('ui.copied')
    }
  }
  $('guide').classList.add('open')
  body.scrollTop = 0
  held.clear()
}
function closeGuide() {
  $('guide').classList.remove('open')
}

// ---------------------------------------------------------------- モードごとの表示
const PHASE: Record<Phase, string> = { ready: '始める前', setting: 'セッティング', match: '試合', finished: '終了' }
const MODE_NOTE: Record<Mode, string> = {
  free: '自由走行: 時間も課題もない。キーで好きに動かす',
  course: '練習: 右の課題を上から順に済ませる。「説明を読む」に手順がある',
  match: '試合: Enter でセッティング 60 秒 → 試合 3 分。得点は右',
}
let lastMessage = '',
  bannerUntil = 0

function showBanner(m: MatchStatus) {
  // 知らせは変わってから 4 秒出す. 止められているあいだと試合が終わったあとは出したまま
  const key = JSON.stringify(m.message)
  if (m.message && key !== lastMessage) {
    lastMessage = key
    bannerUntil = performance.now() + 4000
  }
  const shown = m.stopped ?? (m.mode === 'match' && m.phase === 'finished' ? m.message : performance.now() < bannerUntil ? m.message : null)
  $('banner').textContent = shown ? tm(shown) : ''
  $('banner').className = `card${m.stopped ? ' ng' : ''}${shown ? '' : ' hide'}`
}

/** 札の中身は, 変わったときだけ描き直す (毎回描き直すと, 押している途中のボタンが入れ替わって押せない) */
function setSide(html: string) {
  const side = $('side')
  if (side.dataset.html === html) return
  side.dataset.html = html
  side.innerHTML = html
}

function showScore(m: MatchStatus) {
  const r = m.remaining
  $('phase').textContent = PHASE[m.phase] ?? m.phase
  $('clock').textContent =
    r == null
      ? m.phase === 'finished' && m.result
        ? `${m.result.time.toFixed(1)}s`
        : '--:--'
      : `${Math.floor(r / 60)}:${String(Math.floor(r % 60)).padStart(2, '0')}`
  $('timer').dataset.phase = m.phase
  const items = Object.entries(m.items)
    .map(([k, it]) => {
      const cnt = it.count != null ? ` × ${it.count}` : ''
      const cls = it.points > 0 ? 'ok' : it.points < 0 ? 'ng' : 'wait'
      return `<div class="${cls}"><i>${esc(k)}</i><span>${esc(tr(`match.item.${k}`))}${cnt}</span><b>${it.points}</b></div>`
    })
    .join('')
  const b = m.best
  const best = b.score != null ? `自己ベスト ${b.score} 点${b.declared ? ` (満開宣言 ${b.time} 秒)` : ''}` : '自己ベスト なし'
  const demo = m.demo_run ? '<div class="sub">この回はお手本を動かしたので, 自己ベストにしない</div>' : ''
  setSide(`<h3>得点 <b>${m.score}</b></h3><div class="items">${items}</div><div class="sub">${best}</div>${demo}
  <div class="sub"><button class="link" data-guide="match_rules">得点とルールの説明</button></div>`)
}

function showCourse(c: Course, m: MatchStatus) {
  const cur = c.current
  // お手本の種類: 半自動の課題は match_semi (走るのはキー), ほかは match_auto
  const kind = c.levels.find(l => l.tasks.some(t => t.id === cur))?.id === 'semi' ? 'semi' : 'auto'
  const who = (list: string[]) => list.map(s => tr(`match.src.${s}`)).join('・') || 'なし'
  // いまの課題を上に出し, その下に全部の課題を並べる
  let html = c.trial
    ? '<div class="trial">試し中 (進み具合は保存しない) <button class="link" data-ui="trial off">記録に戻る</button></div>'
    : ''
  if (cur) {
    const demo = m.demo
      ? '<button class="go2" data-ui="demo stop">お手本を止める</button>'
      : `<button class="go2" data-ui="demo ${kind}">お手本を見る</button>`
    const skip = c.trial ? '<button class="go2" data-ui="skip">済みにする</button>' : ''
    const demoNote = m.demo
      ? `<div class="sub">お手本: ${kind === 'semi' ? 'match_semi が機構を動かす。走るのはキー、ボタン 1〜4 で動きを選ぶ' : 'match_auto が全部を動かす'}。お手本の回は数えない</div>`
      : ''
    html += `<div class="current"><div class="k">いまの課題</div><div class="t">${esc(tr(`match.task.${cur}`))}</div>
      <button class="go" data-guide="${esc(cur)}">説明を読む</button> ${demo} ${skip}${demoNote}
      ${c.note ? `<div class="note">${esc(tm(c.note))}</div>` : ''}
      <div class="sub">この回の操作 (R で最初に戻すと消える): 台車 ${esc(who(c.run.drive))} / 機構 ${esc(who(c.run.mech))}</div></div>`
  } else {
    html += '<div class="current"><div class="t">全部済んだ。試合に挑戦する</div></div>'
  }
  html += '<h3 style="margin-top:12px">練習の課題</h3>'
  for (const lv of c.levels) {
    const done = lv.tasks.filter(t => t.done).length
    html += `<div class="level"><b>${esc(tr(`match.level.${lv.id}.name`))}</b> <span>${esc(tr(`match.level.${lv.id}.desc`))}</span> <em>${done} / ${lv.tasks.length}</em></div>`
    for (const t of lv.tasks) {
      const cls = t.done ? 'ok' : t.id === cur ? 'now' : 'wait'
      const mark = t.done ? '✓' : t.id === cur ? '▶' : ''
      const link = t.done || t.id === cur ? ` <button class="link" data-guide="${esc(t.id)}">説明</button>` : ''
      // 試す: この課題から, 進み具合を保存せずに始める
      const tryIt = ` <button class="link" data-ui="trial ${esc(t.id)}" title="この課題から試す (進み具合は保存しない)">試す</button>`
      html += `<div class="${cls}"><i>${mark}</i><span>${esc(tr(`match.task.${t.id}`))}</span>${link}${tryIt}</div>`
    }
  }
  setSide(html)
}

function showMode(m: MatchStatus) {
  if (m.mode === mode && $('side').dataset.filled) return
  mode = m.mode
  document.body.dataset.mode = mode
  for (const b of document.querySelectorAll<HTMLElement>('#modes button[data-mode]')) b.classList.toggle('on', b.dataset.mode === mode)
  $('note').textContent = MODE_NOTE[mode]
  $('side').dataset.filled = '1'
}

function startFree(bodies: Record<string, THREE.Group>) {
  // シミュレーターにつながる前から, モードの切り替えと「はじめに」を出しておく
  document.body.dataset.mode = 'free'
  $('note').textContent = MODE_NOTE.free
  $('score').style.display = 'none'
  $('checks').style.display = 'none'
  $('drive').style.display = ''
  $('timer').innerHTML =
    '<span class="phase" id="phase">始める前</span><b id="clock">--:--</b><div class="hint"><kbd>Enter</kbd> 試合を始める</div>'
  for (const b of document.querySelectorAll<HTMLElement>('#modes button[data-mode]')) b.onclick = () => ui(`mode ${b.dataset.mode}`)
  document.addEventListener('click', e => {
    const g = (e.target as HTMLElement).closest<HTMLElement>('[data-guide]')
    if (g?.dataset.guide) void openGuide(g.dataset.guide)
    // 試し・お手本・済みにする のボタンは, 書いてある操作をそのまま送る
    const u = (e.target as HTMLElement).closest<HTMLElement>('[data-ui]')
    if (u?.dataset.ui) ui(u.dataset.ui)
  })
  $('guideclose').onclick = closeGuide
  let shown = 0,
    actionKey = ''
  const beacon = scene.getObjectByName('robot_beacon') as THREE.Mesh | undefined
  const beaconOff = beacon?.material
  const beaconOn = new THREE.MeshStandardMaterial({ color: '#7dff5a', emissive: '#4cff2a', emissiveIntensity: 1.2 })
  connect(st => {
    for (const [name, v] of Object.entries(st.bodies)) {
      const b = bodies[name]
      if (!b) continue
      b.position.set(v[0], v[1], v[2])
      b.quaternion.set(v[4], v[5], v[6], v[3])
    }
    const r = st.bodies.robot
    if (r) {
      const yaw = (2 * Math.atan2(r[6], r[3]) * 180) / Math.PI
      $('pose').textContent = `x ${r[0].toFixed(2)} m, y ${r[1].toFixed(2)} m, 向き ${(((yaw + 540) % 360) - 180).toFixed(0)}°`
    }
    const m = st.match
    if (m) {
      showMode(m)
      if (m.mode === 'match') showScore(m)
      else if (m.mode === 'course' && m.course) showCourse(m.course, m)
      showBanner(m)
    }
    const rs = st.robot
    if (rs) {
      // キーを押していないあいだは, キーで動かす目標を今のアームとリフトに合わせる (自分のノードが動かしたあと用)
      for (const k of ['extend', 'lift'] as const) if (![...held].some(h => ARM_KEYS[h]?.[0] === k)) armTarget[k] = rs[k]
      $('arm').textContent =
        `アーム ${rs.extend.toFixed(2)} m, リフト ${rs.lift.toFixed(2)} m, 持っている ${rs.carried.length} 本, サイコロの目 ${rs.dice}`
      if (beacon && beaconOff) beacon.material = rs.signal ? beaconOn : beaconOff
      const key = JSON.stringify(rs.action)
      if (rs.action && key !== actionKey) {
        actionKey = key
        setAction(tm(rs.action), rs.action_ok)
      }
    }
    if (performance.now() - shown > 500) {
      setConn(`シミュレーターの時刻 ${st.t.toFixed(1)} 秒`)
      shown = performance.now()
    }
  })
}

void load().then(({ bodies, half }) => {
  surroundings(half)
  if (FREE) startFree(bodies)
  // #close でロボットに寄る. MuJoCo の (x, y) は three.js の (x, -y)
  const robot = bodies.base_link
  if (location.hash === '#robotcam' && robot) {
    // ロボットのマスト上のカメラ (base_link から見て y 0.16 m, 高さ 0.36 m, 35 度見下ろし, 縦の画角 70 度)
    const mount = new THREE.Object3D()
    mount.position.set(0, 0.16, 0.36)
    const s = Math.sin((35 * Math.PI) / 180),
      c = Math.cos((35 * Math.PI) / 180)
    mount.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, s, c), new THREE.Vector3(0, -c, s)),
    )
    robot.add(mount)
    scene.updateMatrixWorld(true)
    mount.getWorldPosition(camera.position)
    mount.getWorldQuaternion(camera.quaternion)
    camera.fov = 70
    camera.near = 0.05
    camera.updateProjectionMatrix()
    controls.enabled = false
    controls.update = () => false
    document.querySelectorAll<HTMLElement>('.card').forEach(e => {
      e.style.display = 'none'
    })
  } else if (location.hash === '#close' && robot) {
    const p = new THREE.Vector3(robot.position.x, 0.12, -robot.position.y)
    controls.target.copy(p)
    camera.position.set(p.x - 0.55, 0.5, p.z + 0.7)
  } else if (half.x > 2) {
    // 広いフィールドはスタートゾーンの側 (図の下) から斜めに見下ろす
    controls.target.set(0, 0, 0.3)
    camera.position.set(-0.6 * half.x, 1.5 * half.z, 2.1 * half.z)
  } else {
    controls.target.set(0.25, 0, 0.2)
    camera.position.set(-2.2, 3.4, 4.6)
  }
  document.body.dataset.ready = '1'
})

const followed = new THREE.Vector3()
function loop() {
  // F: カメラをロボットについていかせる (見る向きと距離はそのまま)
  const robot = FREE && follow && document.body.dataset.ready ? scene.getObjectByName('robot') : undefined
  if (robot) {
    robot.getWorldPosition(followed)
    const d = followed.clone().sub(controls.target)
    controls.target.add(d)
    camera.position.add(d)
  }
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(loop)
}
loop()

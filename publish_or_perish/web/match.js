// 大会モードの画面. tools/mjcf_export.py が書き出した scenes/<名前>/ を読み, 農場と同じ光と色づかいで描く.
// MuJoCo は Z 上なので, 全体を X 軸まわりに -90 度回して three.js の Y 上に合わせる.
// シミュレーター (match_sim.py) が動いていれば, rosbridge で /match/state を読んで物を動かし,
// キー (W A S D / Q E) で /robot/cmd_vel を送る (自由走行). ?scene=scenes/src2026 は SRC2026 の見た目の試作 (動かない).
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/OrbitControls.js'

const params = new URLSearchParams(location.search)
const SCENE_DIR = params.get('scene') ?? 'scenes/harurobo2027'
const FREE = !SCENE_DIR.includes('src2026')
const $ = id => document.getElementById(id)

// ---------------------------------------------------------------- rosbridge (農場の画面と同じ作り)
const ros = {
  ws: null, open: false, handlers: {},
  connect() {
    const port = params.get('rosbridge') ?? 9090
    const ws = new WebSocket(`ws://${location.hostname || 'localhost'}:${port}`)
    this.ws = ws
    ws.onopen = () => {
      this.open = true
      ws.send(JSON.stringify({ op: 'subscribe', topic: '/match/state', type: 'std_msgs/msg/String', throttle_rate: 30 }))
      ws.send(JSON.stringify({ op: 'advertise', topic: '/robot/cmd_vel', type: 'geometry_msgs/msg/Twist' }))
      for (const t of ['/robot/arm/extend', '/robot/arm/lift']) ws.send(JSON.stringify({ op: 'advertise', topic: t, type: 'std_msgs/msg/Float64' }))
    }
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data)
      if (m.op === 'publish' && this.handlers[m.topic]) this.handlers[m.topic](m.msg)
      if (m.op === 'service_response' && m.values) setAction(m.values.message, m.values.success)
    }
    ws.onclose = () => { this.open = false; setConn('シミュレーターにつながっていない'); setTimeout(() => this.connect(), 1500) }
  },
  send(obj) { if (this.open) this.ws.send(JSON.stringify(obj)) },
}
function setConn(text) { if ($('conn')) $('conn').textContent = text }
function setAction(text, ok) {
  const e = $('action')
  if (!e || !text) return
  e.textContent = text
  e.className = ok ? 'ok' : 'ng'
}

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 0.95
document.getElementById('scene').appendChild(renderer.domElement)

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
const PALETTE = {
  field_plywood: '#f1deb0', field_timber: '#b98552', field_line_black: '#2b2b2b', field_line_red: '#e05244',
  robot_white: '#f5f2ea', robot_black: '#3a3f44', robot_aluminium: '#c9ced6', robot_steel: '#9aa3ad',
  robot_red: '#e8613f', robot_rubber: '#2f3337', lidar_visual_housing: '#2b3236', lidar_visual_window: '#5a6670',
}
const matCache = {}
function material(g) {
  const key = g.material || g.name
  if (!matCache[key]) {
    const c = PALETTE[g.material] ? new THREE.Color(PALETTE[g.material]) : new THREE.Color().setRGB(...g.rgba.slice(0, 3), THREE.SRGBColorSpace)
    // 色を少しだけ鮮やかにする (CAD の色はくすみやすい)
    const hsl = {}
    c.getHSL(hsl)
    c.setHSL(hsl.h, Math.min(1, hsl.s * 1.25), hsl.l)
    // 透明な材料 (ペットボトル) は奥の物が透けて見えるように深度を書かない
    const alpha = g.rgba[3]
    matCache[key] = new THREE.MeshStandardMaterial({ color: c, roughness: alpha < 1 ? 0.2 : 0.85, metalness: g.material?.includes('steel') ? 0.3 : 0,
      flatShading: true, transparent: alpha < 1, opacity: alpha, depthWrite: alpha >= 1 })
  }
  return matCache[key]
}

function primitive(g) {
  const [a, b, c] = g.size
  let geo
  if (g.type === 'box') geo = new THREE.BoxGeometry(2 * a, 2 * b, 2 * c)
  else if (g.type === 'sphere') geo = new THREE.SphereGeometry(a, 16, 12)
  else if (g.type === 'ellipsoid') { geo = new THREE.SphereGeometry(1, 16, 12); geo.scale(a, b, c) }
  else if (g.type === 'cylinder') { geo = new THREE.CylinderGeometry(a, a, 2 * b, 24); geo.rotateX(Math.PI / 2) }
  else if (g.type === 'capsule') { geo = new THREE.CapsuleGeometry(a, 2 * b, 6, 12); geo.rotateX(Math.PI / 2) }
  return geo
}

const quat = q => new THREE.Quaternion(q[1], q[2], q[3], q[0])   // MuJoCo は (w, x, y, z)

async function load() {
  const [desc, bin] = await Promise.all([
    fetch(`${SCENE_DIR}/scene.json`).then(r => r.json()),
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
  const bodies = {}
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
  scene.updateMatrixWorld(true)   // root の回転を入れた後の大きさ (three.js の x と z が床の向き) を測る
  const size = new THREE.Box3().setFromObject(bodies.field ?? root, true).getSize(new THREE.Vector3())
  return { bodies, half: { x: size.x / 2, z: size.z / 2 } }
}

// 周りの地面と木 (農場の画面と同じ作り). half はフィールドの半分の大きさ [m]. 木はフィールドの外にだけ植える
let seed = 11
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
function surroundings(half) {
  const r = Math.max(half.x, half.z)
  Object.assign(sun.shadow.camera, { left: -r - 0.5, right: r + 0.5, top: r + 0.5, bottom: -r - 0.5, far: 20 + 2 * r })
  sun.position.set(-3, 7, 4).multiplyScalar(Math.max(1, r / 3))
  sun.shadow.camera.updateProjectionMatrix()
  scene.fog = new THREE.Fog('#bfe6f7', 14 * Math.max(1, r / 2.4), 34 * Math.max(1, r / 2.4))
  const g = new THREE.PlaneGeometry(60 + 4 * r, 60 + 4 * r, 40, 40)
  g.rotateX(-Math.PI / 2)
  const colors = [], c = new THREE.Color(), pos = g.attributes.position
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
  const leaf = new THREE.MeshStandardMaterial({ color: '#4f9e3d', flatShading: true }), trunk = new THREE.MeshStandardMaterial({ color: '#8a5a34', flatShading: true })
  for (let i = 0; i < 40; i++) {
    const x = (-10 + rand() * 20) * Math.max(1, r / 2.4), z = (-12 + rand() * 24) * Math.max(1, r / 2.4)
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
    t.traverse(o => { o.castShadow = true })
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

// ---------------------------------------------------------------- 自由走行
// 台車は機体の向きで動かす: W 前 / S 後 / A 左 / D 右 / Q 左回り / E 右回り. Shift で速く
const KEYS = { KeyW: [1, 0, 0], KeyS: [-1, 0, 0], KeyA: [0, 1, 0], KeyD: [0, -1, 0], KeyQ: [0, 0, 1], KeyE: [0, 0, -1],
  ArrowUp: [1, 0, 0], ArrowDown: [-1, 0, 0], ArrowLeft: [0, 0, 1], ArrowRight: [0, 0, -1] }
// アームとリフト: 押している間, 目標を 0.4 m/s・0.3 m/s で動かす
const ARM_KEYS = { KeyI: ['extend', 0.4], KeyK: ['extend', -0.4], KeyU: ['lift', 0.3], KeyJ: ['lift', -0.3] }
const ARM_MAX = { extend: 0.42, lift: 0.35 }
const armTarget = { extend: 0, lift: 0 }
// 作業の service
const ACTIONS = { KeyG: '/robot/grab', KeyP: '/robot/place', KeyT: '/robot/throw', KeyX: '/robot/dice', KeyZ: '/robot/signal', KeyR: '/match/reset' }
const held = new Set()
let fast = false, follow = false, sending = false
addEventListener('keydown', e => {
  fast = e.shiftKey
  if (KEYS[e.code] || ARM_KEYS[e.code]) { held.add(e.code); e.preventDefault() }
  if (e.code === 'KeyF') follow = !follow
  if (ACTIONS[e.code] && !e.repeat) {
    ros.send({ op: 'call_service', service: ACTIONS[e.code], args: {} })
    if (e.code === 'KeyR') { armTarget.extend = 0; armTarget.lift = 0 }
  }
})
addEventListener('keyup', e => { fast = e.shiftKey; held.delete(e.code) })
addEventListener('blur', () => held.clear())
setInterval(() => {
  for (const k of held) {
    const a = ARM_KEYS[k]
    if (!a) continue
    armTarget[a[0]] = Math.max(0, Math.min(ARM_MAX[a[0]], armTarget[a[0]] + a[1] * 0.05))
    ros.send({ op: 'publish', topic: `/robot/arm/${a[0]}`, msg: { data: armTarget[a[0]] } })
  }
}, 50)
// 押している間は 20 Hz で送る. 離したら 1 回だけ 0 を送る (ほかのノードの指令を邪魔しないよう, 押していないときは送らない)
setInterval(() => {
  const v = [0, 0, 0]
  const drive = [...held].filter(k => KEYS[k])
  for (const k of drive) KEYS[k].forEach((a, i) => { v[i] += a })
  if (!drive.length && !sending) return
  sending = drive.length > 0
  const lin = fast ? 1.5 : 0.6, ang = fast ? 2.5 : 1.2
  ros.send({ op: 'publish', topic: '/robot/cmd_vel', msg: { linear: { x: v[0] * lin, y: v[1] * lin, z: 0 }, angular: { x: 0, y: 0, z: v[2] * ang } } })
}, 50)

function startFree(bodies) {
  for (const id of ['score', 'timer', 'checks']) $(id).style.display = 'none'
  $('drive').style.display = ''
  $('note').textContent = '自分のノードからも動かせる: /robot/cmd_vel, /robot/arm/extend, /robot/arm/lift, /robot/grab など (README)'
  let shown = 0, synced = false
  const beacon = scene.getObjectByName('robot_beacon')
  const beaconOff = beacon?.material, beaconOn = new THREE.MeshStandardMaterial({ color: '#7dff5a', emissive: '#4cff2a', emissiveIntensity: 1.2 })
  ros.handlers['/match/state'] = msg => {
    const st = JSON.parse(msg.data)
    for (const [name, v] of Object.entries(st.bodies)) {
      const b = bodies[name]
      if (!b) continue
      b.position.set(v[0], v[1], v[2])
      b.quaternion.set(v[4], v[5], v[6], v[3])
    }
    const r = st.bodies.robot
    if (r) {
      const yaw = 2 * Math.atan2(r[6], r[3]) * 180 / Math.PI
      $('pose').textContent = `x ${r[0].toFixed(2)} m, y ${r[1].toFixed(2)} m, 向き ${(((yaw + 540) % 360) - 180).toFixed(0)}°`
    }
    const rs = st.robot
    if (rs) {
      // 最初の 1 回だけ, キーで動かす目標を今のアームとリフトに合わせる (ほかのノードが動かしていたとき用)
      if (!synced) { armTarget.extend = rs.extend; armTarget.lift = rs.lift; synced = true }
      $('arm').textContent = `アーム ${rs.extend.toFixed(2)} m, リフト ${rs.lift.toFixed(2)} m, 持っている ${rs.carried.length} 本, サイコロの目 ${rs.dice}`
      if (beacon) beacon.material = rs.signal ? beaconOn : beaconOff
    }
    if (performance.now() - shown > 500) { setConn(`シミュレーターの時刻 ${st.t.toFixed(1)} 秒`); shown = performance.now() }
  }
  ros.connect()
}

load().then(({ bodies, half }) => {
  surroundings(half)
  if (FREE) startFree(bodies)
  // #close でロボットに寄る. MuJoCo の (x, y) は three.js の (x, -y)
  const robot = bodies.base_link
  if (location.hash === '#robotcam' && robot) {
    // ロボットのマスト上のカメラ (base_link から見て y 0.16 m, 高さ 0.36 m, 35 度見下ろし, 縦の画角 70 度)
    const mount = new THREE.Object3D()
    mount.position.set(0, 0.16, 0.36)
    const s = Math.sin(35 * Math.PI / 180), c = Math.cos(35 * Math.PI / 180)
    mount.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, s, c), new THREE.Vector3(0, -c, s)))
    robot.add(mount)
    scene.updateMatrixWorld(true)
    mount.getWorldPosition(camera.position)
    mount.getWorldQuaternion(camera.quaternion)
    camera.fov = 70
    camera.near = 0.05
    camera.updateProjectionMatrix()
    controls.enabled = false
    controls.update = () => {}
    document.querySelectorAll('.card').forEach(e => { e.style.display = 'none' })
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
  const robot = FREE && follow && document.body.dataset.ready && controls.target && scene.getObjectByName('robot')
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

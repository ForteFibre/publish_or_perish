// 大会モードの画面 (見た目の試作). tools/mjcf_export.py が書き出した scenes/<名前>/ を読み,
// 農場と同じ光と色づかいで描く. MuJoCo は Z 上なので, 全体を X 軸まわりに -90 度回して three.js の Y 上に合わせる.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/OrbitControls.js'

const SCENE_DIR = new URLSearchParams(location.search).get('scene') ?? 'scenes/src2026'

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
    matCache[key] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: g.material?.includes('steel') ? 0.3 : 0, flatShading: true })
  }
  return matCache[key]
}

function primitive(g) {
  const [a, b, c] = g.size
  let geo
  if (g.type === 'box') geo = new THREE.BoxGeometry(2 * a, 2 * b, 2 * c)
  else if (g.type === 'sphere') geo = new THREE.SphereGeometry(a, 16, 12)
  else if (g.type === 'ellipsoid') { geo = new THREE.SphereGeometry(1, 16, 12); geo.scale(a, b, c) }
  else if (g.type === 'cylinder') { geo = new THREE.CylinderGeometry(a, a, 2 * b, 20); geo.rotateX(Math.PI / 2) }
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
      mesh.position.set(...g.pos)
      mesh.quaternion.copy(quat(g.quat))
      mesh.castShadow = true
      mesh.receiveShadow = true
      bg.add(mesh)
    }
    root.add(bg)
    bodies[b.name] = bg
  }
  return bodies
}

// 周りの地面と木 (農場の画面と同じ作り)
let seed = 11
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
{
  const g = new THREE.PlaneGeometry(60, 60, 40, 40)
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
    const x = -10 + rand() * 20, z = -12 + rand() * 24
    if (Math.abs(x) < 2.6 && Math.abs(z) < 3.6) continue
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

load().then(bodies => {
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
  } else {
    controls.target.set(0.25, 0, 0.2)
    camera.position.set(-2.2, 3.4, 4.6)
  }
  document.body.dataset.ready = '1'
})

function loop() {
  controls.update()
  renderer.render(scene, camera)
  requestAnimationFrame(loop)
}
loop()

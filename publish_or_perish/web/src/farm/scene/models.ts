// コードで作るローポリの形 (材質, 作物, ロボット, 井戸, 看板, 小屋, 文字の札).
// Blender で作った glb に差し替えるときも, 画面が動かす部分は同じ名前にする (docs/design/web-architecture.md).

import { tr } from '@pop/i18n'
import { DISPLAY_FONT, HUT, SCENE_TEXT } from '@pop/ui/tokens'
import * as THREE from 'three'

/** 決まった並びの乱数 (毎回同じ景色にする) */
export function seeded(seed: number): () => number {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

export const mat = (color: THREE.ColorRepresentation, o: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...o })

export const M = {
  grass: mat('#6cbf45'),
  trunk: mat('#8a5a34'),
  leaf: mat('#4f9e3d'),
  leaf2: mat('#6dbb4a'),
  rock: mat('#a7a39a'),
  fence: mat('#c99a5b'),
  stone: mat('#9c9a92'),
  roof: mat('#c2533a'),
  water: mat('#4aa8e8', { roughness: 0.2, metalness: 0.1 }),
  stalk: mat('#79b84a'),
  gold: mat('#e9bf45'),
  dead: mat('#8b7355'),
  tomato: mat('#e0402f', { roughness: 0.5 }),
  green: mat('#3f8f3a'),
  pumpkin: mat('#ee8a2a', { roughness: 0.6 }),
  white: mat('#f5f2ea'),
  orange: mat('#f08a24'),
  dark: mat('#2b3236'),
  wheel: mat('#3a3f44'),
  hub: mat('#c9ced3'),
  eye: new THREE.MeshBasicMaterial({ color: '#6ff3ff' }),
  coin: mat('#f5c542', { metalness: 0.4, roughness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: '#cfefff', transparent: true, opacity: 0.35, roughness: 0.1 }),
}

const castShadow = (o: THREE.Object3D) =>
  o.traverse(c => {
    c.castShadow = true
  })

/** 文字の札 (canvas に描いて Sprite にする. 見出しと同じ丸い書体で描く. 同梱の書体なのでオフラインでも出る) */
export function label(text: string, x: number, y: number, z: number, h: number, color = '#ffffff', bg: string | null = null) {
  const cv = document.createElement('canvas')
  const g = cv.getContext('2d') as CanvasRenderingContext2D
  const fs = 48
  g.font = `700 ${fs}px ${DISPLAY_FONT}`
  const w = Math.ceil(g.measureText(text).width) + 24
  cv.width = w
  cv.height = fs + 20
  g.font = `700 ${fs}px ${DISPLAY_FONT}`
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
  s.scale.set((h * w) / cv.height, h, 1)
  s.position.set(x, y, z)
  return s
}

// ---------------------------------------------------------------- 周りの景色
export function makeScenery(rand: () => number): THREE.Group {
  const root = new THREE.Group()
  // 地面
  {
    const g = new THREE.PlaneGeometry(120, 120, 60, 60)
    g.rotateX(-Math.PI / 2)
    const colors: number[] = []
    const c = new THREE.Color()
    const pos = g.attributes.position as THREE.BufferAttribute
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
    root.add(ground)
  }
  // 周りの木・岩 (畑の最大サイズ 14 x 9 の外に置く)
  const tree = (x: number, z: number, s: number) => {
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
    castShadow(g)
    root.add(g)
  }
  for (let i = 0; i < 70; i++) {
    const x = -10 + rand() * 34,
      z = -20 + rand() * 30
    if (x > -3 && x < 17 && z > -12.5 && z < 3.5) continue
    if (rand() < 0.75) tree(x, z, 0.8 + rand() * 0.7)
    else {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rand() * 0.3, 0), M.rock)
      r.position.set(x, 0.1, z)
      r.castShadow = true
      root.add(r)
    }
  }
  // 花
  const flower = new THREE.SphereGeometry(0.06, 5, 4)
  const fm = ['#ffffff', '#ffd84a', '#ff8fb1', '#b58cff'].map(c => mat(c))
  for (let i = 0; i < 160; i++) {
    const x = -6 + rand() * 26,
      z = -16 + rand() * 22
    if (x > -1.2 && x < 15.2 && z > -10.2 && z < 1.2) continue
    const f = new THREE.Mesh(flower, fm[i % 4])
    f.position.set(x, 0.05, z)
    root.add(f)
  }
  return root
}

// ---------------------------------------------------------------- 畑のマスと柵
export const soilGeo = new THREE.BoxGeometry(0.94, 0.14, 0.94)
let soilTexCache: THREE.Texture | null = null
export function soilTex(): THREE.Texture {
  if (soilTexCache) return soilTexCache
  const cv = document.createElement('canvas')
  cv.width = cv.height = 64
  const g = cv.getContext('2d') as CanvasRenderingContext2D
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
  soilTexCache = new THREE.CanvasTexture(cv)
  soilTexCache.colorSpace = THREE.SRGBColorSpace
  return soilTexCache
}

/** 畑 (w x h) の周りの柵と, 座標の目盛り */
export function makeFence(w: number, h: number): THREE.Group {
  const g = new THREE.Group()
  const post = new THREE.CylinderGeometry(0.05, 0.06, 0.55, 5)
  const m = 0.35
  const addPost = (px: number, pz: number) => {
    const p = new THREE.Mesh(post, M.fence)
    p.position.set(px, 0.25, pz)
    p.castShadow = true
    g.add(p)
  }
  const rail = (x1: number, z1: number, x2: number, z2: number) => {
    const len = Math.hypot(x2 - x1, z2 - z1)
    for (const yy of [0.18, 0.38]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.04), M.fence)
      r.position.set((x1 + x2) / 2, yy, (z1 + z2) / 2)
      r.rotation.y = -Math.atan2(z2 - z1, x2 - x1)
      r.castShadow = true
      g.add(r)
    }
  }
  const x0 = -m,
    x1 = w + m,
    z0 = m,
    z1 = -h - m
  for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / Math.ceil(x1 - x0)) {
    addPost(x, z0)
    addPost(x, z1)
  }
  for (let z = z1; z <= z0 + 1e-6; z += (z0 - z1) / Math.ceil(z0 - z1)) {
    addPost(x0, z)
    addPost(x1, z)
  }
  rail(x0, z0, x1, z0)
  rail(x0, z1, x1, z1)
  rail(x0, z0, x0, z1)
  rail(x1, z0, x1, z1)
  // 座標の目盛り (data[y * width + x] の x, y)
  for (let x = 0; x < w; x++) g.add(label(`x=${x}`, x + 0.5, 0.05, 0.75, 0.32, SCENE_TEXT.coord))
  for (let y = 0; y < h; y++) g.add(label(`y=${y}`, -0.85, 0.05, -(y + 0.5), 0.32, SCENE_TEXT.coord))
  return g
}

// ---------------------------------------------------------------- 井戸
export type WellView = { g: THREE.Group; water: THREE.Mesh }

export function makeWell(): WellView {
  const g = new THREE.Group()
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.38, 10, 1, true), M.stone)
  ring.position.y = 0.19
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 10), M.water)
  water.name = 'water'
  water.position.y = 0.3
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.32, 4), M.roof)
  roof.position.y = 1.05
  roof.rotation.y = Math.PI / 4
  g.add(ring, water, roof)
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), M.trunk)
    p.position.set(s * 0.34, 0.5, 0)
    g.add(p)
  }
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 8), M.fence)
  bucket.position.y = 0.6
  g.add(bucket)
  g.scale.setScalar(0.8)
  castShadow(g)
  return { g, water }
}

// ---------------------------------------------------------------- 看板 (ステージ 4)
export type BoardView = { g: THREE.Group; cv: HTMLCanvasElement; tex: THREE.CanvasTexture; bell: THREE.Group }

export function makeBoard(): BoardView {
  const g = new THREE.Group()
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 320
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.1, 0.08), M.fence)
  frame.position.y = 1.1
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: tex }))
  face.name = 'screen'
  face.position.set(0, 1.1, 0.041)
  g.add(frame, face)
  for (const sx of [-0.7, 0.7]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), M.trunk)
    p.position.set(sx, 0.3, 0)
    g.add(p)
  }
  // 鐘: 看板の右上の腕から下げる. 鳴ると揺れる
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.4), M.trunk)
  arm.position.set(0.8, 1.72, 0.12)
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), M.trunk)
  mast.position.set(0.8, 1.68, -0.06)
  const bell = new THREE.Group()
  bell.position.set(0.8, 1.7, 0.3)
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.12, 0.18, 10, 1, true),
    mat('#e9bf45', { metalness: 0.5, roughness: 0.35, side: THREE.DoubleSide }),
  )
  cup.position.y = -0.12
  bell.add(cup)
  g.add(arm, mast, bell)
  castShadow(g)
  g.rotation.y = 0.2 // 正面をカメラ (右手前) へ向ける
  g.scale.setScalar(1.5)
  return { g, cv, tex, bell }
}

export type BoardFace = { text: string; text_src: string; number: number; answer: number; ok: number; bells: number }

export function drawBoard(v: BoardView, b: BoardFace) {
  const g = v.cv.getContext('2d') as CanvasRenderingContext2D
  g.fillStyle = SCENE_TEXT.boardBg
  g.fillRect(0, 0, 512, 320)
  g.textBaseline = 'middle'
  g.fillStyle = SCENE_TEXT.boardSub
  g.font = `600 26px ${DISPLAY_FONT}`
  g.fillText('/board/text', 24, 34)
  // 届いた文字は幅に収まるまで小さくする
  const text = b.text || tr('ui.scene.board_empty')
  let fs = 56
  g.font = `700 ${fs}px ${DISPLAY_FONT}`
  while (fs > 22 && g.measureText(text).width > 464) {
    fs -= 2
    g.font = `700 ${fs}px ${DISPLAY_FONT}`
  }
  g.fillStyle = b.text ? SCENE_TEXT.boardText : SCENE_TEXT.boardSub
  g.fillText(text, 24, 98)
  if (b.text) {
    g.font = `500 22px ${DISPLAY_FONT}`
    g.fillStyle = SCENE_TEXT.boardSub
    const from = ['player', 'cli', 'mixed'].includes(b.text_src) ? tr(`ui.scene.from_${b.text_src}`) : ''
    g.fillText(from, 24, 146)
  }
  g.strokeStyle = 'rgba(255,255,255,0.25)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(16, 176)
  g.lineTo(496, 176)
  g.stroke()
  g.font = `600 26px ${DISPLAY_FONT}`
  g.fillStyle = SCENE_TEXT.boardSub
  g.fillText('/board/number', 24, 210)
  g.fillText('/board/answer', 24, 260)
  g.font = `700 40px ${DISPLAY_FONT}`
  g.fillStyle = SCENE_TEXT.boardNumber
  g.fillText(b.number > 0 ? String(b.number) : '-', 230, 210)
  if (b.ok >= 0) {
    g.fillStyle = '#ffffff'
    g.fillText(String(b.answer), 230, 260)
    g.font = `700 30px ${DISPLAY_FONT}`
    g.fillStyle = b.ok ? SCENE_TEXT.boardOk : SCENE_TEXT.boardNg
    g.fillText(tr(b.ok ? 'ui.scene.correct' : 'ui.scene.wrong'), 340, 260)
  }
  g.font = `500 22px ${DISPLAY_FONT}`
  g.fillStyle = SCENE_TEXT.boardSub
  g.textAlign = 'right'
  g.fillText(tr('ui.scene.bells', { n: String(b.bells) }), 492, 300)
  g.textAlign = 'left'
  v.tex.needsUpdate = true
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

/** 作物 1 株. stage は 0 (芽) 〜 4 (実った) */
export function makeCrop(kind: string, stage: number, dead: boolean): THREE.Group {
  const g = new THREE.Group()
  const r = seeded(kind.length * 99 + stage)
  if (stage === 0) {
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
      const a = (i / n) * Math.PI * 2 + r(),
        d = 0.08 + r() * 0.16
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
  castShadow(g)
  return g
}

// ---------------------------------------------------------------- ロボット
export type BotParts = {
  g: THREE.Group
  body: THREE.Group
  eyes: THREE.Mesh[]
  /** タンクの水. 残りに合わせて高さを変える */
  water: THREE.Mesh
  /** 誰が操作しているかで色を変える */
  led: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  wheels: THREE.Group[]
}

export function makeBot(): BotParts {
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
  const eyes: THREE.Mesh[] = []
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.045, 0.035), M.eye)
    e.position.set(0.216, 0.38, s * 0.05)
    eyes.push(e)
    body.add(e)
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.24, 10), M.glass)
  tank.position.set(-0.1, 0.4, 0)
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1, 10), M.water)
  water.name = 'water'
  water.position.set(-0.1, 0.29, 0)
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), M.dark)
  ant.position.set(0.1, 0.53, 0.08)
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: '#999' }))
  led.material.name = 'led'
  led.position.set(0.1, 0.64, 0.08)
  body.add(base, stripe, head, face, tank, water, ant, led)
  const wheels: THREE.Group[] = []
  for (let i = 0; i < 3; i++) {
    const a = i * ((Math.PI * 2) / 3) + Math.PI / 3
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
  castShadow(g)
  return { g, body, eyes, water, led, wheels }
}

// ---------------------------------------------------------------- ノードの小屋
export function makeHut(name: string, kind: string): THREE.Group {
  const cli = kind === 'cli'
  const c = cli ? HUT.cli : HUT.player
  const g = new THREE.Group()
  const wall = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.6), mat(c.wall))
  wall.position.y = 0.22
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.35, 4), mat(c.roof))
  roof.position.y = 0.62
  roof.rotation.y = Math.PI / 4
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.02), M.trunk)
  door.position.set(0, 0.13, 0.31)
  g.add(wall, roof, door)
  castShadow(g)
  g.add(label(cli ? 'CLI' : name, 0, 1.05, 0, 0.2, '#ffffff', c.tag))
  return g
}

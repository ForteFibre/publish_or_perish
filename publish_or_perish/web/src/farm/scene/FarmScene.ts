// 農場の 3D. 状態 (FarmState) を受けて畑, 作物, ロボット, 小屋を置き, 毎フレーム補間とエフェクトを動かす.
// 座標: 農場の (x, y) [m] を three.js の (x, 0, -y) に置く. 1 マス = 1 m.
// HUD は React (../hud) が描く. ここから HUD へは ui.ts のストア (マスの情報, 浮かぶ文字) を通して渡す.

import { tr } from '@pop/i18n'
import type { FarmState, Fx } from '@pop/ros'
import { CONFETTI, SCENE_TEXT, SRC_GLOW, srcOf } from '@pop/ui/tokens'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { sfx } from '../sfx'
import { pushFloat, useUi } from '../ui'
import {
  type BoardView,
  type BotParts,
  drawBoard,
  label,
  M,
  makeBoard,
  makeBot,
  makeCrop,
  makeFence,
  makeHut,
  makeScenery,
  makeWell,
  seeded,
  soilGeo,
  soilTex,
} from './models'

type TileView = {
  soil: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  crop: THREE.Group | null
  key: string
  x: number
  y: number
  ripe: boolean
  grow: number
}

type BotView = BotParts & {
  tag: THREE.Sprite
  x: number | null
  y: number
  th: number
  tx: number
  ty: number
  tth: number
  moving: boolean
  blink: number
}

type Part = { mesh: THREE.Mesh; v: [number, number, number]; life: number; max: number; kind: string }
type Flow = { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; drop: boolean; hut: Hut }
type Hut = { g: THREE.Group; pile: THREE.Mesh[]; x: number; z: number }

const DRY = new THREE.Color('#d2a873'),
  WET = new THREE.Color('#6b4428')

/** 幅 560 px 未満か高さ 420 px 未満を小窓として扱う (VSCode の浮動ウィンドウ, ブラウザの小窓など) */
export const isMini = () => innerWidth < 560 || innerHeight < 420

export class FarmScene {
  readonly renderer = new THREE.WebGLRenderer({ antialias: true })
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200)
  readonly controls: OrbitControls
  readonly sun = new THREE.DirectionalLight('#fff1d6', 2.4)
  readonly rand = seeded(7)

  readonly field = new THREE.Group()
  fieldW = 0
  fieldH = 0
  tiles: TileView[][] = []
  readonly well = makeWell()
  readonly board: BoardView = makeBoard()
  readonly boardPos = new THREE.Vector3(-0.9, 0, -6.4)
  boardKey = ''
  bellSwing = 0
  readonly bots: Record<string, BotView> = {}
  readonly parts: Part[] = []
  readonly huts: Record<string, Hut> = {}
  readonly flows: Flow[] = []
  readonly spawnAcc: Record<string, number> = {}
  state: FarmState | null = null
  lastFx = -1

  camSet = false
  wasMini: boolean | null = null
  frames = 0
  #raf = 0
  #timers: ReturnType<typeof setTimeout>[] = []
  readonly #clock = new THREE.Clock()
  readonly #ray = new THREE.Raycaster()
  readonly #mouse = new THREE.Vector2()

  constructor(
    readonly container: HTMLElement,
    readonly onDiag: (text: string) => void,
  ) {
    const r = this.renderer
    r.setPixelRatio(Math.min(devicePixelRatio, 2))
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFSoftShadowMap
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 0.95
    container.appendChild(r.domElement)

    this.scene.background = new THREE.Color('#a8dcf5')
    this.scene.fog = new THREE.Fog('#bfe6f7', 40, 80)
    this.controls = new OrbitControls(this.camera, r.domElement)
    Object.assign(this.controls, { enableDamping: true, maxPolarAngle: 1.35, minDistance: 5, maxDistance: 40 })

    this.scene.add(new THREE.HemisphereLight('#dff3ff', '#5a7a3a', 1.0))
    const sun = this.sun
    sun.position.set(-8, 16, 10)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 })
    sun.shadow.bias = -0.0005
    this.scene.add(sun, sun.target)

    this.scene.add(makeScenery(this.rand), this.field, this.board.g)
    // 農場の状態が届く前も, 空の看板を出しておく
    drawBoard(this.board, { text: '', text_src: '', number: 0, answer: 0, ok: -1, bells: 0 })

    r.domElement.addEventListener('pointermove', this.#onPointer)
    r.domElement.addEventListener('pointerleave', this.#onLeave)
    addEventListener('resize', this.resize)
    this.buildField(8, 5)
    this.resize()
    this.#loop()
    // 開いて 5 秒後に, 描画の方式・フレームレート・音が使えるかを農場に送る (ログに残る).
    // WSL などで GPU を使えず CPU で描いている (llvmpipe, SwiftShader) と遅くなるので, その確認に使う.
    this.#timers.push(
      setTimeout(() => {
        this.frames = 0
        this.#timers.push(setTimeout(() => this.#diagnose(), 5000))
      }, 2000),
    )
  }

  dispose() {
    cancelAnimationFrame(this.#raf)
    this.#timers.forEach(clearTimeout)
    removeEventListener('resize', this.resize)
    this.controls.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ---------------------------------------------------------------- 畑
  buildField(w: number, h: number) {
    this.field.clear()
    this.tiles = []
    this.fieldW = w
    this.fieldH = h
    for (let y = 0; y < h; y++) {
      const row: TileView[] = []
      for (let x = 0; x < w; x++) {
        const soil = new THREE.Mesh(soilGeo, new THREE.MeshStandardMaterial({ map: soilTex(), roughness: 1, color: DRY.clone() }))
        soil.name = 'soil'
        soil.position.set(x + 0.5, 0.02, -(y + 0.5))
        soil.receiveShadow = true
        soil.userData = { x, y }
        this.field.add(soil)
        row.push({ soil, crop: null, key: '', x, y, ripe: false, grow: 1 })
      }
      this.tiles.push(row)
    }
    this.field.add(makeFence(w, h))
    this.well.g.position.set(0.5, 0, -0.5)
    this.field.add(this.well.g)
    // 看板は畑の左奥 (ノードの小屋の列の左). 畑を広げると奥へ動かす
    this.boardPos.set(-0.9, 0, -h - 1.4)
    this.board.g.position.copy(this.boardPos)
    this.retarget()
  }

  // ---------------------------------------------------------------- 状態の反映
  apply(s: FarmState) {
    if (!this.state) {
      // 開いた時点より前のエフェクトは出さない
      this.lastFx = s.fx.at(-1)?.id ?? -1
    }
    this.state = s
    if (s.w !== this.fieldW || s.h !== this.fieldH) this.buildField(s.w, s.h)
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const tile = s.tiles[y * s.w + x]
        const t = this.tiles[y]?.[x]
        if (!tile || !t) continue
        const [moist, kind, growth, dead, isWell] = tile
        t.soil.visible = !isWell
        t.soil.material.color.copy(DRY).lerp(WET, moist / 100)
        const stage = kind ? Math.min(4, Math.floor(growth * 4 + 1e-6)) : -1
        const key = kind ? `${kind}:${stage}:${dead}` : ''
        if (key !== t.key) {
          if (t.crop) this.field.remove(t.crop)
          t.crop = kind ? makeCrop(kind, stage, !!dead) : null
          if (t.crop) {
            t.crop.position.set(x + 0.5, 0.09, -(y + 0.5))
            this.field.add(t.crop)
          }
          t.key = key
        }
        t.ripe = stage >= 4 && !dead
        t.grow = 0.7 + 0.3 * Math.min(1, growth)
      }
    }
    for (const b of s.bots) {
      const r = this.bots[b.name] ?? (this.bots[b.name] = this.#makeBotView(b.name))
      if (r.x === null) {
        r.x = b.x
        r.y = b.y
        r.th = b.th
      }
      Object.assign(r, { tx: b.x, ty: b.y, tth: b.th, moving: !!b.moving })
      const lvl = Math.max(0.02, b.tank / b.tank_max)
      r.water.scale.y = 0.22 * lvl
      r.water.position.y = 0.29 + 0.11 * lvl
      // まだ誰も cmd_vel を送っていない (src が空) ときは, 誰もいない色
      r.led.material.color.set(b.src ? SRC_GLOW[srcOf(b.src)] : SRC_GLOW.tool)
    }
    for (const f of s.fx) {
      if (f.id <= this.lastFx) continue
      this.lastFx = f.id
      this.#effect(f, s)
    }
    const key = JSON.stringify(s.board)
    if (key !== this.boardKey) {
      this.boardKey = key
      drawBoard(this.board, s.board)
    }
    this.#syncHuts(s)
  }

  #makeBotView(name: string): BotView {
    const parts = makeBot()
    const tag = label(name, 0, 0.95, 0, 0.22, '#ffffff', SCENE_TEXT.botTag)
    this.scene.add(tag, parts.g)
    return { ...parts, tag, x: null, y: 0, th: 0, tx: 0, ty: 0, tth: 0, moving: false, blink: 2 }
  }

  /** レベルアップ, ステージクリア, 買い物の紙吹雪 */
  celebrate(n = 70) {
    this.#burst('confetti', this.fieldW / 2, -this.fieldH / 2, n)
  }

  #effect(f: Fx, s: FarmState) {
    const x = f.x + 0.5,
      z = -(f.y + 0.5)
    const bp = this.boardPos
    switch (f.kind) {
      case 'water':
        this.#burst('water', x, z, 18)
        sfx.water()
        break
      case 'plant':
        this.#burst('dirt', x, z, 10)
        sfx.plant()
        this.#float(`-${f.value} G`, x, 0.6, z, '#ffd0c8')
        break
      case 'harvest':
        this.#burst('coin', x, z, 8)
        this.#burst('spark', x, z, 12)
        sfx.harvest()
        this.#float(`+${f.value} G`, x, 0.8, z)
        break
      case 'clear':
        this.#burst('dirt', x, z, 8)
        sfx.plant()
        break
      case 'wither':
        this.#burst('smoke', x, z, 6)
        sfx.wither()
        break
      case 'ripe':
        this.#burst('spark', x, z, 6)
        break
      case 'refill':
        this.#burst('water', 0.5, -0.5, 12)
        this.#float(tr('ui.scene.refill'), 0.5, 1.1, -0.5, '#bfe8ff')
        break
      case 'wall': {
        const b = this.bots[f.bot]
        if (b?.x != null && Math.random() < 0.3) {
          this.#float(tr('ui.scene.bump'), b.x, 0.8, -b.y, '#ffe0a0')
          sfx.wall()
        }
        break
      }
      case 'buy':
        this.#burst('confetti', s.w / 2, -s.h / 2, 40)
        sfx.buy()
        break
      case 'board_answer':
        if (f.value > 0) {
          this.#float(tr('ui.scene.correct'), bp.x, 2.8, bp.z, '#b8ffb0')
          this.#burst('spark', bp.x, bp.z, 10)
          sfx.mission()
        } else this.#float(tr('ui.scene.wrong'), bp.x, 2.8, bp.z, '#ffc0b8')
        break
      case 'board_bell':
        this.bellSwing = 1
        sfx.bell()
        break
    }
  }

  // ---------------------------------------------------------------- エフェクト
  static readonly #pGeo = new THREE.SphereGeometry(0.04, 5, 4)
  static readonly #coinGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10)
  static readonly #fxMats = {
    water: new THREE.MeshBasicMaterial({ color: '#58b8f5', transparent: true }),
    dirt: new THREE.MeshBasicMaterial({ color: '#8a5a30', transparent: true }),
    smoke: new THREE.MeshBasicMaterial({ color: '#9a9a9a', transparent: true }),
    spark: new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true }),
    confetti: CONFETTI.map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true })),
  }

  #burst(kind: string, x: number, z: number, n: number) {
    const rand = this.rand,
      fm = FarmScene.#fxMats
    for (let i = 0; i < n; i++) {
      let m: THREE.Material = fm.spark,
        v: [number, number, number] = [0, 0, 0],
        geo: THREE.BufferGeometry = FarmScene.#pGeo
      let y = 0.3,
        life = 1
      const a = rand() * Math.PI * 2,
        s = rand()
      if (kind === 'water') {
        m = fm.water
        v = [Math.cos(a) * s * 0.6, 1 + rand(), Math.sin(a) * s * 0.6]
        y = 0.7
      }
      if (kind === 'dirt') {
        m = fm.dirt
        v = [Math.cos(a) * s, 1.4 + rand(), Math.sin(a) * s]
      }
      if (kind === 'smoke') {
        m = fm.smoke
        v = [Math.cos(a) * 0.2, 0.6 + rand() * 0.4, Math.sin(a) * 0.2]
        life = 1.6
      }
      if (kind === 'spark') {
        m = fm.spark
        v = [Math.cos(a) * s * 1.2, 1.5 + rand() * 1.5, Math.sin(a) * s * 1.2]
      }
      if (kind === 'coin') {
        m = M.coin
        geo = FarmScene.#coinGeo
        v = [Math.cos(a) * s * 1.2, 2.5 + rand() * 1.5, Math.sin(a) * s * 1.2]
        life = 1.3
      }
      if (kind === 'confetti') {
        m = fm.confetti[i % 5] as THREE.Material
        v = [Math.cos(a) * s * 3, 3 + rand() * 3, Math.sin(a) * s * 3]
        y = 1
        life = 2
      }
      // 薄くしていく材質は粒ごとに複製する. 硬貨は消さずに落とすだけなので共有でよい
      const mesh = new THREE.Mesh(geo, m.transparent ? m.clone() : m)
      mesh.position.set(x, y, z)
      if (kind === 'smoke') mesh.scale.setScalar(2.5)
      this.scene.add(mesh)
      this.parts.push({ mesh, v, life, max: life, kind })
    }
  }

  #stepParts(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i] as Part
      p.life -= dt
      const g = p.kind === 'smoke' ? -0.2 : 6
      p.v[1] -= g * dt
      p.mesh.position.x += p.v[0] * dt
      p.mesh.position.y = Math.max(0.05, p.mesh.position.y + p.v[1] * dt)
      p.mesh.position.z += p.v[2] * dt
      p.mesh.rotation.x += dt * 6
      const m = p.mesh.material as THREE.Material
      if (m.transparent) m.opacity = Math.max(0, p.life / p.max)
      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        if (m.transparent) m.dispose()
        this.parts.splice(i, 1)
      }
    }
  }

  /** 3D の位置に文字を浮かべる (HUD の Floats が描く) */
  #float(text: string, x: number, y: number, z: number, color?: string) {
    const v = new THREE.Vector3(x, y, z).project(this.camera)
    pushFloat(text, ((v.x + 1) / 2) * innerWidth - 30, ((1 - v.y) / 2) * innerHeight - 20, color)
  }

  // ---------------------------------------------------------------- ノードの小屋と, メッセージの粒
  // プレイヤーのノードと CLI ごとに, 畑の奥に小屋を建てる. メッセージ 1 つ = 光の粒 1 つ.
  // 受け手のいない topic の粒は小屋の前に落ちて積もる.
  #syncHuts(s: FarmState) {
    const want = new Map<string, string>()
    for (const w of s.wires) {
      for (const [n, k] of [...w.pubs, ...w.subs]) if (k === 'player' || k === 'cli') want.set(k === 'cli' ? 'CLI' : n, k)
    }
    for (const [n, h] of Object.entries(this.huts)) {
      if (!want.has(n)) {
        this.scene.remove(h.g)
        h.pile.forEach(p => this.scene.remove(p))
        delete this.huts[n]
      }
    }
    let i = 0
    for (const [n, k] of want) {
      const h = this.huts[n] ?? (this.huts[n] = { g: makeHut(n, k), pile: [], x: 0, z: 0 })
      if (!h.g.parent) this.scene.add(h.g)
      h.x = 1 + i * 1.6
      h.z = -s.h - 1.5
      h.g.position.set(h.x, 0, h.z)
      i++
    }
  }

  #hutOf(name: string, kind: string) {
    return this.huts[kind === 'cli' ? 'CLI' : name]
  }

  /** topic の向こう側の 3D の位置 (ロボット, 畑の中央, 看板, 井戸) */
  #topicPoint(topic: string, s: FarmState): THREE.Vector3 {
    const m = topic.match(/^\/(bot\d+)\//)
    const b = m ? this.bots[m[1] as string] : undefined
    if (b && b.x != null) return new THREE.Vector3(b.x, 0.5, -b.y)
    if (topic.startsWith('/field/')) return new THREE.Vector3(s.w / 2, 0.3, -s.h / 2)
    if (topic.startsWith('/board/')) return new THREE.Vector3(this.boardPos.x, 1.7, this.boardPos.z)
    return new THREE.Vector3(0.5, 0.6, -0.5)
  }

  static readonly #flowGeo = new THREE.SphereGeometry(0.07, 8, 6)
  static readonly #flowMats: Record<string, THREE.MeshBasicMaterial> = {}
  static #flowMat(c: string) {
    return FarmScene.#flowMats[c] ?? (FarmScene.#flowMats[c] = new THREE.MeshBasicMaterial({ color: c, transparent: true }))
  }

  #spawnFlows(dt: number, s: FarmState) {
    for (const w of s.wires) {
      const rate = Math.min(w.hz, 12)
      if (rate <= 0) continue
      // 粒は送り手の色で塗る (topic の種類は, 粒の行き先で分かる)
      const delivered = w.subs.length > 0
      // プレイヤーが出す topic: 小屋 → 相手 (受け手がいなければ小屋の前に落ちる)
      for (const [n, k] of w.pubs) {
        if (k !== 'player' && k !== 'cli') continue
        const h = this.#hutOf(n, k)
        if (!h) continue
        const key = `p:${w.topic}:${n}`
        this.spawnAcc[key] = (this.spawnAcc[key] ?? Math.random()) + rate * dt
        while ((this.spawnAcc[key] as number) >= 1) {
          this.spawnAcc[key] -= 1
          const from = new THREE.Vector3(h.x, 0.6, h.z)
          const to = delivered
            ? this.#topicPoint(w.topic, s)
            : new THREE.Vector3(h.x + (Math.random() - 0.5) * 1.2, 0.03, h.z + 0.7 + Math.random() * 0.3)
          this.#launch(from, to, SRC_GLOW[srcOf(k)], !delivered, h)
        }
      }
      // プレイヤーが受ける topic: 相手 → 小屋. 送り手が何人かいるときは, 最初の送り手の色にする
      const fromColor = SRC_GLOW[srcOf(w.pubs[0]?.[1] ?? 'tool')]
      for (const [n, k] of w.subs) {
        if (k !== 'player' && k !== 'cli') continue
        const h = this.#hutOf(n, k)
        if (!h || !w.pubs.length) continue
        const key = `s:${w.topic}:${n}`
        this.spawnAcc[key] = (this.spawnAcc[key] ?? Math.random()) + Math.min(rate, 6) * dt
        while ((this.spawnAcc[key] as number) >= 1) {
          this.spawnAcc[key] -= 1
          this.#launch(this.#topicPoint(w.topic, s), new THREE.Vector3(h.x, 0.6, h.z), fromColor, false, h)
        }
      }
    }
  }

  #launch(from: THREE.Vector3, to: THREE.Vector3, color: string, drop: boolean, hut: Hut) {
    const mesh = new THREE.Mesh(FarmScene.#flowGeo, FarmScene.#flowMat(color))
    mesh.position.copy(from)
    this.scene.add(mesh)
    this.flows.push({ mesh, from, to, t: 0, dur: drop ? 0.7 : 0.55 + from.distanceTo(to) * 0.05, drop, hut })
  }

  #stepFlows(dt: number) {
    for (let i = this.flows.length - 1; i >= 0; i--) {
      const f = this.flows[i] as Flow
      f.t += dt / f.dur
      const k = Math.min(1, f.t)
      f.mesh.position.lerpVectors(f.from, f.to, k)
      f.mesh.position.y += Math.sin(Math.PI * k) * (f.drop ? 0.4 : 0.9)
      if (k >= 1) {
        if (f.drop) {
          // 届かなかった粒は地面に残る (小屋ごとに 60 個まで)
          f.mesh.scale.setScalar(0.6)
          f.hut.pile.push(f.mesh)
          if (f.hut.pile.length > 60) this.scene.remove(f.hut.pile.shift() as THREE.Mesh)
        } else this.scene.remove(f.mesh)
        this.flows.splice(i, 1)
      }
    }
  }

  // ---------------------------------------------------------------- マスの情報 (マウス)
  #onPointer = (e: PointerEvent) => {
    this.#mouse.set((e.clientX / innerWidth) * 2 - 1, (-e.clientY / innerHeight) * 2 + 1)
    this.#ray.setFromCamera(this.#mouse, this.camera)
    const hit = this.#ray.intersectObjects(this.tiles.flat().map(t => t.soil))[0]
    if (!hit || !this.state) {
      this.#onLeave()
      return
    }
    const { x, y } = hit.object.userData as { x: number; y: number }
    useUi.setState({ tip: { px: e.clientX, py: e.clientY, x, y } })
  }

  #onLeave = () => {
    if (useUi.getState().tip) useUi.setState({ tip: null })
  }

  // ---------------------------------------------------------------- カメラと描画
  retarget() {
    const cx = this.fieldW / 2,
      cz = -this.fieldH / 2
    const mini = isMini()
    const camera = this.camera
    // 右の課題パネルの分だけ畑を左に寄せて見せる (狭い画面ほどパネルが占める割合が大きい). 小窓にはパネルがない
    const target = new THREE.Vector3(cx + (mini ? -0.4 : innerWidth < 1100 ? 2.6 : 1.6), 0, cz - (mini ? 0.3 : 0.6))
    this.controls.target.copy(target)
    // 小窓は畑を広げたときや窓の大きさを変えたときも収まるように毎回置き直す
    if (!this.camSet || mini) {
      if (mini) {
        // 畑の幅と奥行きが両方収まる距離まで引く. 上の 1 行の分だけ少し余分に引く
        const vfov = (camera.fov * Math.PI) / 180,
          hfov = 2 * Math.atan((Math.tan(vfov / 2) * innerWidth) / innerHeight)
        const dist = Math.max((this.fieldW + 2.4) / 2 / Math.tan(hfov / 2), ((this.fieldH + 1.5) / 2 / Math.tan(vfov / 2)) * 1.35) * 0.98
        camera.position.copy(target).add(new THREE.Vector3(0, 0.78, 0.62).normalize().multiplyScalar(dist))
      } else {
        // 縦長に近い画面では横に映る範囲が狭いので, その分カメラを引く
        const k = Math.min(2, Math.max(1, 1.5 / (innerWidth / innerHeight)))
        camera.position.copy(target).add(new THREE.Vector3(-1.4, 6.5 + this.fieldH * 0.75, 7.1 + this.fieldH * 0.95).multiplyScalar(k))
      }
      this.camSet = true
    }
    this.sun.target.position.set(cx, 0, cz)
    this.sun.position.set(cx - 8, 16, cz + 10)
  }

  resize = () => {
    this.renderer.setSize(innerWidth, innerHeight)
    this.camera.aspect = innerWidth / innerHeight
    this.camera.updateProjectionMatrix()
    // 小窓と大きい画面を行き来したら, その画面に合う位置にカメラを置き直す
    const mini = isMini()
    document.body.classList.toggle('mini', mini)
    if (mini !== this.wasMini) {
      this.wasMini = mini
      this.camSet = false
    }
    if (this.fieldW) this.retarget()
  }

  #loop = () => {
    const dt = Math.min(0.05, this.#clock.getDelta()),
      t = this.#clock.elapsedTime
    for (const r of Object.values(this.bots)) {
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
      r.wheels.forEach(w => {
        ;(w.children[0] as THREE.Object3D).rotation.y += r.moving ? dt * 12 : 0
      })
      r.tag.position.set(r.x, 1.15, -r.y)
      r.blink -= dt
      const closed = r.blink < 0.12
      r.eyes.forEach(e => {
        e.scale.y = closed ? 0.15 : 1
      })
      if (r.blink < 0) r.blink = 2 + Math.random() * 3
    }
    for (const row of this.tiles) {
      for (const tl of row) {
        if (!tl.crop) continue
        tl.crop.rotation.z = tl.ripe ? Math.sin(t * 2.4 + tl.x) * 0.06 : Math.sin(t * 1.5 + tl.y) * 0.02
        tl.crop.scale.setScalar(tl.grow)
      }
    }
    this.well.water.position.y = 0.3 + Math.sin(t * 2) * 0.01
    this.bellSwing = Math.max(0, this.bellSwing - dt * 0.8)
    this.board.bell.rotation.x = Math.sin(t * 16) * 0.5 * this.bellSwing
    this.#stepParts(dt)
    if (this.state) this.#spawnFlows(dt, this.state)
    this.#stepFlows(dt)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
    this.frames++
    this.#raf = requestAnimationFrame(this.#loop)
  }

  #diagnose() {
    const gl = this.renderer.getContext()
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
    const fps = this.frames / 5
    const where = /Code\/[\d.]+/.exec(navigator.userAgent)?.[0] ?? 'browser'
    const audio = typeof AudioContext !== 'undefined' ? 'audio:yes' : 'audio:no'
    this.onDiag(`${where} fps:${fps.toFixed(0)} ${audio} gl:${gpu}`)
  }
}

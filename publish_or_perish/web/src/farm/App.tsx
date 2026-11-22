// 農場の画面の全体. 畑の面 (3D の畑と, その上の札) と, 説明を開いたときの説明の面.
// 説明は畑に重ねず, 画面を分けて畑の隣に出す (畑は縮むが, 隠れない).
//   幅 860px 以上: 左右に分ける (左が説明, 右が畑). 境は分割の持ち手で動かせる
//   幅 860px 未満: 上下に分ける (上が畑, 下が説明)
//   小さい窓 (幅 560px 未満か高さ 420px 未満): 説明を全面に出し, 上の 1 行の「畑を見る」で畑と入れ替える
// 札の畳み方 (narrow:, mini:) は, 窓ではなく畑の面の大きさで決まる (field-container).
import { useTr } from '@pop/i18n'
import { Splitter, ToastRegion, TooltipProvider } from '@pop/ui'
import { type CSSProperties, useEffect, useState } from 'react'
import { GuideView } from './hud/GuideView'
import { Modals } from './hud/Modals'
import { Banner, Buttons, Connect, Floats, Log, Mini, RosCard, Status, TipBox } from './hud/Panels'
import { Quest } from './hud/Quest'
import { SceneView } from './SceneView'
import { useUi } from './ui'

const GUIDE_MIN = 480
const FIELD_MIN = 320
const SPLITTER = 8
const FIELD_MIN_H = 220

function useViewport() {
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight })
  useEffect(() => {
    const on = () => setSize({ w: innerWidth, h: innerHeight })
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  return size
}

/** ブラウザに覚えさせる数 (分割の幅). 覚えられなくても動く */
function useStoredNumber(key: string): [number | null, (v: number | null) => void] {
  const [v, setV] = useState<number | null>(() => {
    try {
      const s = localStorage.getItem(key)
      return s ? Number(s) : null
    } catch {
      return null
    }
  })
  const set = (n: number | null) => {
    setV(n)
    try {
      if (n === null) localStorage.removeItem(key)
      else localStorage.setItem(key, String(n))
    } catch {
      // 次に開いたときに最初の幅に戻るだけ
    }
  }
  return [v, set]
}

/** 3D の畑と, その上の札. questShown が false (説明を開いている) なら課題の札を出さない */
export function Field({
  scene = true,
  questShown = true,
  className,
  style,
}: {
  scene?: boolean
  questShown?: boolean
  className?: string
  style?: CSSProperties
}) {
  return (
    <div style={style} className={`field-container relative min-h-0 min-w-0 overflow-hidden ${className ?? ''}`}>
      {scene && <SceneView />}
      <Status />
      <RosCard />
      {questShown && <Quest />}
      <Log questShown={questShown} />
      <Mini />
      <Buttons />
    </div>
  )
}

/** 畑の面と説明の面の並べ方 */
export function Screen({ scene = true }: { scene?: boolean }) {
  const { tr } = useTr()
  const guideId = useUi(u => u.guideId)
  const peek = useUi(u => u.peekField)
  const { w, h } = useViewport()
  const [guideW, setGuideW] = useStoredNumber('pop.guide-width')
  const [fieldH, setFieldH] = useStoredNumber('pop.field-height')
  const layout = !guideId ? 'none' : w < 560 || h < 420 ? 'mini' : w < 860 ? 'stack' : 'split'

  if (layout === 'none') return <Field scene={scene} className="h-dvh w-screen" />

  if (layout === 'mini')
    return (
      <div className="flex h-dvh w-screen flex-col">
        {!peek && <Mini inGuide />}
        {!peek && guideId && <GuideView id={guideId} compact className="min-h-0 flex-1" />}
        {/* 畑は消さずに隠す (3D を作り直さない) */}
        <Field scene={scene} questShown={false} className={peek ? 'flex-1' : 'hidden'} />
      </div>
    )

  if (layout === 'stack') {
    const max = h - 200 - SPLITTER
    const initial = Math.max(FIELD_MIN_H, Math.round(h * 0.38))
    const fh = Math.min(max, Math.max(FIELD_MIN_H, fieldH ?? initial))
    return (
      // 上が畑, 下が説明. 並びは説明の面から書き, 逆さに積む (持ち手の値は畑の高さ)
      <div className="flex h-dvh w-screen flex-col-reverse">
        {guideId && <GuideView id={guideId} className="min-h-0 flex-1" />}
        <Splitter
          orientation="horizontal"
          value={fh}
          min={FIELD_MIN_H}
          max={max}
          onChange={setFieldH}
          onReset={() => setFieldH(null)}
          label={tr('ui.guide.resize')}
        />
        <Field scene={scene} questShown={false} className="shrink-0" style={{ height: fh }} />
      </div>
    )
  }

  const max = w - FIELD_MIN - SPLITTER
  const initial = Math.min(720, Math.round(w * 0.62))
  const gw = Math.min(max, Math.max(GUIDE_MIN, guideW ?? initial))
  return (
    <div className="flex h-dvh w-screen">
      {guideId && <GuideView id={guideId} className="shrink-0 animate-fade-in" style={{ width: gw }} />}
      <Splitter
        orientation="vertical"
        value={gw}
        min={GUIDE_MIN}
        max={max}
        onChange={setGuideW}
        onReset={() => setGuideW(null)}
        label={tr('ui.guide.resize')}
      />
      <Field scene={scene} questShown={false} className="flex-1" />
    </div>
  )
}

/** 畑の面の外 (body の直下) に重なるもの: 窓, 帯, 浮かぶ文字, マスの情報, 接続待ち */
export function Overlays() {
  return (
    <>
      <Modals />
      <Banner />
      <TipBox />
      <Floats />
      <Connect />
    </>
  )
}

export function App({ scene = true }: { scene?: boolean }) {
  return (
    <TooltipProvider>
      <ToastRegion>
        <Screen scene={scene} />
        <Overlays />
      </ToastRegion>
    </TooltipProvider>
  )
}

// 農場の画面の全体. 3D の畑 (SceneView) の上に HUD を重ねる.
import { Modals } from './hud/Modals'
import { Banner, Buttons, Connect, Floats, Log, Mini, RosCard, Status, TipBox, Toasts } from './hud/Panels'
import { Quest } from './hud/Quest'
import { SceneView } from './SceneView'

/** 3D を除いた HUD (Storybook では 3D を描かずにこれだけを置く) */
export function Hud() {
  return (
    <>
      <Status />
      <RosCard />
      <Quest />
      <Log />
      <Mini />
      <Buttons />
      <Modals />
      <Toasts />
      <Banner />
      <TipBox />
      <Floats />
      <Connect />
    </>
  )
}

export function App() {
  return (
    <>
      <SceneView />
      <Hud />
    </>
  )
}

// 農場の画面. rosbridge (ws://<host>:9090) で /farm/state を読み, /farm/ui に操作を送る.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { connectFarm } from '@pop/ros'
import { Modals } from './hud/Modals'
import { Banner, Buttons, Connect, Floats, Log, Mini, RosCard, Status, TipBox, Toasts } from './hud/Panels'
import { Quest } from './hud/Quest'
import { SceneView } from './SceneView'
import './farm.css'

function App() {
  return <>
    <SceneView />
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
}

connectFarm()
createRoot(document.getElementById('root') as HTMLElement).render(<StrictMode><App /></StrictMode>)

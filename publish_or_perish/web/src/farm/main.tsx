// 農場の画面. rosbridge (同じ口の /rosbridge) で /farm/state を読み, /farm/ui に操作を送る.
// ?fixture=farm-mistakes を付けると, 農場につながずに記録した状態で動く (packages/ros/src/fixtures/).

import { initI18n } from '@pop/i18n'
import { connectFarm, loadFixture, pickFixture } from '@pop/ros'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './farm.css'

// 訳の表を読んでから描く (表は小さいので待っても目立たない)
void initI18n().then(lng => {
  document.documentElement.lang = lng.language
  const fixture = pickFixture()
  if (fixture) void loadFixture(fixture)
  else connectFarm()
  createRoot(document.getElementById('root') as HTMLElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})

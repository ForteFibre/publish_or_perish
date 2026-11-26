// 画面の中だけの状態 (農場には送らない). 開いている窓, 説明の面, 帯, マスの情報, 浮かぶ文字.
// 通知は @pop/ui の notify() が持つ.

import { devtoolsEnabled, type Msg } from '@pop/ros'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type Modal = 'shop' | 'wires' | 'achs' | null

/** マウスの下のマス. 画面上の位置 (px) と, マスの座標 */
export type Tip = { px: number; py: number; x: number; y: number }

/** 3D の位置から画面に浮かべる文字 (1.4 秒で消える) */
export type Float = { id: number; text: string; px: number; py: number; color?: string }

type Ui = {
  modal: Modal
  /** 開いている説明の課題の id. null なら説明の面を閉じている */
  guideId: string | null
  /** 小さい窓で説明を開いているとき, 説明の代わりに畑を見ているか */
  peekField: boolean
  banner: { title: Msg; body: Msg } | null
  tip: Tip | null
  floats: Float[]
  /** キーで動かすロボット (Tab で替える) */
  keyBot: string
  open: (m: Modal) => void
  close: () => void
}

export const useUi = create<Ui>()(
  devtools(
    set => ({
      modal: null,
      guideId: null,
      peekField: false,
      banner: null,
      tip: null,
      floats: [],
      keyBot: 'bot1',
      open: modal => set({ modal }),
      close: () => set({ modal: null }),
    }),
    { name: 'ui', enabled: devtoolsEnabled() },
  ),
)

let seq = 0
// 帯が出ているあいだに次の帯が来たら, 順に出す
const banners: { title: Msg; body: Msg }[] = []

function nextBanner() {
  const b = banners.shift()
  if (!b) return
  useUi.setState({ banner: b })
  setTimeout(() => {
    useUi.setState({ banner: null })
    nextBanner()
  }, 2600)
}

export function showBanner(title: Msg, body: Msg) {
  banners.push({ title, body })
  if (!useUi.getState().banner && banners.length === 1) nextBanner()
}

export function pushFloat(text: string, px: number, py: number, color?: string) {
  const id = ++seq
  useUi.setState(s => ({ floats: [...s.floats, { id, text, px, py, color }] }))
  setTimeout(() => useUi.setState(s => ({ floats: s.floats.filter(f => f.id !== id) })), 1400)
}

/** VSCode 拡張の中 (iframe) で開いているか */
export const inVSCode = window.parent !== window

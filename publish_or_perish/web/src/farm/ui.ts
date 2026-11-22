// 画面の中だけの状態 (農場には送らない). 開いている窓, 通知, マスの情報, 浮かぶ文字.
import { create } from 'zustand'
import type { Msg, Notice } from '@pop/ros'

export type Modal = 'shop' | 'wires' | 'achs' | 'guide' | null

/** マウスの下のマス. 画面上の位置 (px) と, マスの座標 */
export type Tip = { px: number; py: number; x: number; y: number }

/** 3D の位置から画面に浮かべる文字 (1.4 秒で消える) */
export type Float = { id: number; text: string; px: number; py: number; color?: string }

export type Toast = Notice & { key: number }

type Ui = {
  modal: Modal
  guideId: string | null
  toasts: Toast[]
  banner: { title: Msg; body: Msg } | null
  tip: Tip | null
  floats: Float[]
  open: (m: Modal) => void
  close: () => void
}

export const useUi = create<Ui>(set => ({
  modal: null,
  guideId: null,
  toasts: [],
  banner: null,
  tip: null,
  floats: [],
  open: modal => set({ modal }),
  close: () => set({ modal: null }),
}))

let seq = 0

export function pushToast(n: Notice) {
  const key = ++seq
  useUi.setState(s => ({ toasts: [...s.toasts, { ...n, key }] }))
  setTimeout(() => useUi.setState(s => ({ toasts: s.toasts.filter(t => t.key !== key) })), 4200)
}

export function showBanner(title: Msg, body: Msg) {
  useUi.setState({ banner: { title, body } })
  setTimeout(() => useUi.setState({ banner: null }), 2600)
}

export function pushFloat(text: string, px: number, py: number, color?: string) {
  const id = ++seq
  useUi.setState(s => ({ floats: [...s.floats, { id, text, px, py, color }] }))
  setTimeout(() => useUi.setState(s => ({ floats: s.floats.filter(f => f.id !== id) })), 1400)
}

/** VSCode 拡張の中 (iframe) で開いているか */
export const inVSCode = window.parent !== window

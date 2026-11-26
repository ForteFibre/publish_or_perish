// キーで動かす. W 前 / S 後 / A 左 / D 右 / Q E 回る (Shift で速く), Z 種をまく / X 水をやる / C 収穫する,
// Tab で操作するロボットを替える. 押している間 20 Hz で /farm/ui に "drive <bot> vx vy wz" を送る.
// 農場はキーの操作として数える (CLI・自分のノードと分ける. ステージ 0 と半自動の課題で使う).
import { useFarm } from '@pop/ros'
import { useEffect } from 'react'
import { useUi } from './ui'

type Vec3 = [number, number, number]
const DRIVE: Record<string, Vec3> = {
  KeyW: [1, 0, 0],
  KeyS: [-1, 0, 0],
  KeyA: [0, 1, 0],
  KeyD: [0, -1, 0],
  KeyQ: [0, 0, 1],
  KeyE: [0, 0, -1],
  ArrowUp: [1, 0, 0],
  ArrowDown: [-1, 0, 0],
  ArrowLeft: [0, 0, 1],
  ArrowRight: [0, 0, -1],
}
const ACT: Record<string, 'plant' | 'water' | 'harvest'> = { KeyZ: 'plant', KeyX: 'water', KeyC: 'harvest' }

/** 文字を打っているところか, 窓 (お店など) を開いているか. そのときはキーでロボットを動かさない */
function busy(): boolean {
  const a = document.activeElement as HTMLElement | null
  return useUi.getState().modal !== null || !!a?.closest('input, textarea, select, [contenteditable="true"]')
}

export function useFarmKeys() {
  useEffect(() => {
    const held = new Set<string>()
    let fast = false,
      sending = false
    const send = () => useFarm.getState().send
    const down = (e: KeyboardEvent) => {
      if (busy() || e.ctrlKey || e.metaKey || e.altKey) return
      fast = e.shiftKey
      if (DRIVE[e.code]) {
        held.add(e.code)
        e.preventDefault()
      }
      const what = ACT[e.code]
      if (what && !e.repeat) send()({ kind: 'act', bot: useUi.getState().keyBot, what })
      // Tab はボタンを押して選んでいないときだけ (ボタンの間をキーで移る操作を邪魔しない)
      const bots = useFarm.getState().state?.bots.map(b => b.name) ?? []
      if (e.code === 'Tab' && bots.length > 1 && (document.activeElement === document.body || !document.activeElement)) {
        e.preventDefault()
        const cur = useUi.getState().keyBot
        useUi.setState({ keyBot: bots[(bots.indexOf(cur) + 1) % bots.length] ?? 'bot1' })
      }
    }
    const up = (e: KeyboardEvent) => {
      fast = e.shiftKey
      held.delete(e.code)
    }
    const blur = () => held.clear()
    const timer = setInterval(() => {
      if (busy()) held.clear()
      const v: Vec3 = [0, 0, 0]
      for (const k of held) {
        const d = DRIVE[k] as Vec3
        v[0] += d[0]
        v[1] += d[1]
        v[2] += d[2]
      }
      if (!held.size && !sending) return
      sending = held.size > 0 // 離したら 1 回だけ 0 を送って止める
      const lin = fast ? 1.0 : 0.5,
        ang = fast ? 2.0 : 1.2
      send()({ kind: 'drive', bot: useUi.getState().keyBot, vx: v[0] * lin, vy: v[1] * lin, wz: v[2] * ang })
    }, 50)
    addEventListener('keydown', down)
    addEventListener('keyup', up)
    addEventListener('blur', blur)
    return () => {
      clearInterval(timer)
      removeEventListener('keydown', down)
      removeEventListener('keyup', up)
      removeEventListener('blur', blur)
    }
  }, [])
}

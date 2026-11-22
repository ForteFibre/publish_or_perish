// HUD の複数の場所で使う文言と, 状態から作る表示.
import type { FarmState } from '@pop/ros'

export const CROP_NAME: Record<string, string> = { wheat: '小麦', tomato: 'トマト', pumpkin: 'カボチャ' }

export type Mode = { cls: 'auto' | 'cli' | 'off'; text: string; short: string }

/** 運転の様子 (無人運転中 / CLI で操作中 / 動作中 / 停止中) */
export function mode(s: FarmState): Mode {
  if (s.graph.auto) return { cls: 'auto', text: '無人運転中', short: '無人' }
  if (s.graph.cli > 0) return { cls: 'cli', text: `CLI で操作中 (${s.graph.cli})`, short: 'CLI' }
  if (s.bots.some(b => b.moving)) return { cls: 'cli', text: '動作中', short: '動作中' }
  return { cls: 'off', text: '停止中', short: '停止' }
}

export const fmtBytes = (b: number) => b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(1)} kB` : `${b} B`

export const pct = (value: number, goal: number) => `${Math.min(100, value / goal * 100)}%`

// HUD の複数の場所で使う, 状態から作る表示.
import { substitute } from '@pop/guide'
import { tr } from '@pop/i18n'
import type { FarmState, Mission } from '@pop/ros'

export type Mode = { cls: 'auto' | 'cli' | 'off'; text: string; short: string }

/** 運転の様子 (無人運転中 / CLI で操作中 / 動作中 / 停止中) */
export function mode(s: FarmState): Mode {
  if (s.graph.auto) return { cls: 'auto', text: tr('ui.mode.auto'), short: tr('ui.mode.auto_short') }
  if (s.graph.cli > 0) return { cls: 'cli', text: tr('ui.mode.cli', { n: String(s.graph.cli) }), short: tr('ui.mode.cli_short') }
  // 動いているが, 送り手が分からない (CLI でも自分のノードでもない) ので, どちらの色も使わない
  if (s.bots.some(b => b.moving)) return { cls: 'off', text: tr('ui.mode.moving'), short: tr('ui.mode.moving_short') }
  return { cls: 'off', text: tr('ui.mode.off'), short: tr('ui.mode.off_short') }
}

export const fmtBytes = (b: number) => b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(1)} kB` : `${b} B`

export const pct = (value: number, goal: number) => `${Math.min(100, value / goal * 100)}%`

export const cropName = (id: string) => tr(`crop.${id}`)

export const stageTitle = (id: string) => tr(`stage.${id}.title`)

/** 課題の題・説明・ヒント. 説明とヒントの ~/src26_ws と tutorial_nodes は起動引数の値にする (ガイドと同じ規則) */
export function missionText(m: Mission, s: FarmState) {
  const sub = (t: string) => substitute(t, s.workspace, s.package)
  return {
    title: tr(`mission.${m.id}.title`),
    desc: sub(tr(`mission.${m.id}.desc`)),
    hint: sub(tr(`mission.${m.id}.hint`)),
    unit: m.unit ? tr(`unit.${m.unit}`) : '',
  }
}

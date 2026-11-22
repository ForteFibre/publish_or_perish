// 課題の行. チェックの箱, 題, 報酬, 目標が 2 以上ならメーター. 開いた行 (今の課題) には children を出す.
import type { ReactNode } from 'react'
import { Coin } from './Coin'
import { Check } from './icons'
import { Meter } from './Meter'

export type MissionRowProps = {
  title: string
  reward: number
  done: boolean
  /** メーター. 目標が 1 で単位もない課題には出さない */
  progress?: { value: number; goal: number; caption: string }
  /** 開いた行に出す説明, ヒント, ボタン */
  children?: ReactNode
}

export function MissionRow({ title, reward, done, progress, children }: MissionRowProps) {
  return (
    <div className="border-t border-dashed border-line py-3 first:border-t-0">
      <div className="flex items-start gap-2">
        <span
          role="img"
          aria-label={done ? '✓' : undefined}
          className={`grid size-5 shrink-0 place-items-center rounded-sm border-2 ${done ? 'border-success bg-success text-ink' : 'border-control'}`}
        >
          {done && <Check size={14} strokeWidth={3} aria-hidden />}
        </span>
        <span className={`min-w-0 flex-1 text-base font-bold ${done ? 'text-ink-sub' : ''}`}>{title}</span>
        <span className="inline-flex shrink-0 items-center gap-1 font-display text-base font-bold text-gold-ink nums">
          <Coin size={14} />+{reward} G
        </span>
      </div>
      {progress && <Meter value={progress.value} max={progress.goal} label={title} caption={progress.caption} className="mt-1.5 ml-7" />}
      {children && <div className="mt-2 ml-7 flex flex-col gap-2">{children}</div>}
    </div>
  )
}

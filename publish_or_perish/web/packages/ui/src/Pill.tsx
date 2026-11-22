// Pill. 状態を一語で示す, 角の丸い札. 押せない (押せるものはボタンの小にする).
import type { ComponentProps } from 'react'
import { tv, type VariantProps } from './cn'

export const pill = tv({
  // 高さ, 左右の内側, 大きさは badge かどうかで 1 つだけ付ける (tailwind-merge を使わないので重ねない)
  base: 'inline-flex shrink-0 items-center gap-1.5 rounded-full font-display font-bold whitespace-nowrap',
  variants: {
    tone: {
      player: 'bg-success-soft text-success-ink',
      cli: 'bg-cli-soft text-cli-ink',
      warning: 'bg-warning-soft text-warning-ink',
      farm: 'bg-info-soft text-info-ink',
      danger: 'bg-danger-soft text-danger-ink',
      neutral: 'bg-neutral-soft text-ink-sub',
      gold: 'bg-gold text-on-gold',
      alert: 'bg-danger-strong text-white',
    },
    /** 左の丸い点 */
    dot: { true: 'before:size-1.5 before:rounded-full before:bg-current' },
    /** 外側に緑の輪が広がる. 「無人運転中」にだけ使う (光り続ける部品は画面に 1 つまで) */
    live: { true: 'animate-live' },
    /** 数のバッジ (ボタンの右上). 高さを詰める */
    badge: { true: 'h-4.5 min-w-4.5 justify-center px-1.5 text-2xs', false: 'h-5 px-2.5 text-xs' },
  },
  defaultVariants: { tone: 'neutral', badge: false },
})

export type PillProps = ComponentProps<'span'> & VariantProps<typeof pill>

export function Pill({ tone, dot, live, badge, className, ...rest }: PillProps) {
  return <span className={pill({ tone, dot, live, badge, className })} {...rest} />
}

// 札. 2px の枠と下の厚みと角丸で「紙の板」に見せる.
// hud: 畑の上に常に出ている札 (半透明). solid: 窓, 通知, メニューの土台 (不透明).
// sunken: 札の中の札 (厚みも影もない). danger: 小さい窓の 1 行で, 点検のエラーがあるとき.
import type { ComponentProps } from 'react'
import { tv, type VariantProps } from './cn'

export const card = tv({
  base: 'border-2 text-ink',
  variants: {
    variant: {
      hud: 'rounded-lg border-edge bg-surface-hud shadow-card',
      solid: 'rounded-lg border-edge bg-surface shadow-pop',
      sunken: 'rounded-md border-line bg-surface-sunken',
      danger: 'rounded-lg border-danger bg-surface-hud shadow-card',
    },
    pad: { none: '', sm: 'p-3', md: 'p-4' },
  },
  defaultVariants: { variant: 'hud', pad: 'md' },
})

export type CardProps = ComponentProps<'div'> & VariantProps<typeof card>

export function Card({ variant, pad, className, ...rest }: CardProps) {
  return <div className={card({ variant, pad, className })} {...rest} />
}

/** 札と窓の題. 18px の丸い書体 */
export function CardTitle({ className, ...rest }: ComponentProps<'h2'>) {
  return <h2 className={`font-display text-xl font-bold ${className ?? ''}`} {...rest} />
}

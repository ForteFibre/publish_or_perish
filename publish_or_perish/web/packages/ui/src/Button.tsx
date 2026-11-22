// ボタン. 下に厚みがあり, 押すと 2px 沈む (面と厚みの合計は変わらないので, まわりは動かない).
// 押せないボタンも Tab で届くよう, disabled ではなく aria-disabled にする (理由を読み上げられるように).
import { Toggle as BaseToggle } from '@base-ui/react/toggle'
import { ToggleGroup as BaseToggleGroup } from '@base-ui/react/toggle-group'
import type { ComponentProps, MouseEvent, ReactNode } from 'react'
import { tv, type VariantProps } from './cn'
import { LoaderCircle } from './icons'
import { Tooltip } from './Tooltip'

// 厚みと押し込み. 紙のボタン (主と副) だけに付ける
const RAISED = [
  'shadow-[0_var(--lip-h)_0_var(--lip)] [--lip-h:var(--lip-rest)]',
  'active:translate-y-0.5 active:[--lip-h:calc(var(--lip-rest)-2px)]',
  // 切り替えが入 (押し込んだまま). Base UI の Toggle は data-pressed も付ける
  'aria-pressed:translate-y-0.5 aria-pressed:[--lip-h:calc(var(--lip-rest)-2px)] aria-pressed:border-gold-ink aria-pressed:bg-gold-soft',
  'data-pressed:translate-y-0.5 data-pressed:[--lip-h:calc(var(--lip-rest)-2px)] data-pressed:border-gold-ink data-pressed:bg-gold-soft',
  // 押せない: 沈んだ位置で平らにする. 不透明度は下げない (文字は ink-faint で比 4.72)
  'aria-disabled:translate-y-0.5 aria-disabled:border-line aria-disabled:bg-surface-sunken aria-disabled:text-ink-faint aria-disabled:[--lip-h:0px]',
]

// tailwind-merge を使わないので, 同じ性質 (高さ, 左右の内側, 影) のクラスが 2 つの変種から付かないように書く.
// 高さと左右の内側は, 変種の組み合わせ (compoundVariants) で 1 つだけ付ける.
export const button = tv({
  base: [
    'relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 border-2 font-display font-bold whitespace-nowrap select-none',
    'transition-[translate,box-shadow,background-color] duration-(--duration-press) ease-out motion-reduce:transition-none',
    'aria-disabled:cursor-not-allowed',
  ],
  variants: {
    intent: {
      primary: [...RAISED, 'border-gold-ink bg-gold text-on-gold [--lip:var(--color-gold-ink)] hover:not-aria-disabled:bg-gold-bright'],
      secondary: [...RAISED, 'border-edge bg-surface text-ink [--lip:var(--color-lip)] hover:not-aria-disabled:not-aria-pressed:bg-white'],
      onTerm: 'on-term border-transparent bg-term-raised text-white hover:brightness-110',
      link: 'border-transparent text-info-ink underline underline-offset-2',
    },
    size: {
      md: 'rounded-md text-base [--lip-rest:4px]',
      sm: 'rounded-sm text-xs [--lip-rest:2px]',
    },
    iconOnly: { true: 'aspect-square', false: '' },
  },
  compoundVariants: [
    { intent: ['primary', 'secondary', 'onTerm'], size: 'md', class: 'h-9' },
    { intent: ['primary', 'secondary', 'onTerm'], size: 'sm', class: 'h-7' },
    { intent: ['primary', 'secondary', 'onTerm'], size: 'md', iconOnly: false, class: 'px-4' },
    { intent: ['primary', 'secondary', 'onTerm'], size: 'sm', iconOnly: false, class: 'px-3' },
  ],
  defaultVariants: { intent: 'secondary', size: 'md', iconOnly: false },
})

export type ButtonVariants = VariantProps<typeof button>

export type ButtonProps = Omit<ComponentProps<'button'>, 'disabled'> &
  ButtonVariants & {
    /** 押せない. aria-disabled にして Tab では届くようにする */
    disabled?: boolean
    /** 処理中. 左に回る印を出し, 二度押しだけを無視する (押せない見た目にはしない) */
    loading?: boolean
    /** 文字の左に置くアイコン */
    icon?: ReactNode
  }

export function Button({
  intent,
  size,
  iconOnly,
  disabled,
  loading,
  icon,
  className,
  children,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-disabled={disabled || undefined}
      aria-busy={loading || undefined}
      className={button({ intent, size, iconOnly, className })}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (disabled || loading) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      {...rest}
    >
      {loading ? <LoaderCircle size={size === 'sm' ? 16 : 20} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

export type IconButtonProps = Omit<ButtonProps, 'iconOnly' | 'icon' | 'children'> & {
  /** 読み上げとツールチップに出す名前 */
  label: string
  icon: ReactNode
  /** 右上に重ねる数や印 (実績の数, 配線の「!」) */
  badge?: ReactNode
  /** ツールチップを出す向き */
  side?: 'top' | 'bottom' | 'left' | 'right'
}

/** アイコンだけのボタン. aria-label とツールチップを必ず付ける */
export function IconButton({ label, icon, badge, side, ...rest }: IconButtonProps) {
  return (
    <Tooltip label={label} side={side}>
      <Button iconOnly aria-label={label} icon={icon} {...rest}>
        {badge && <span className="absolute -top-2 -right-2">{badge}</span>}
      </Button>
    </Tooltip>
  )
}

export type ToggleButtonProps = Omit<ComponentProps<typeof BaseToggle>, 'className' | 'render'> &
  ButtonVariants & { className?: string; icon?: ReactNode }

/** 入と切を持つボタン (音). 入のあいだは押し込んだままになる */
export function ToggleButton({ intent, size, iconOnly, className, icon, children, ...rest }: ToggleButtonProps) {
  return (
    <BaseToggle className={button({ intent, size, iconOnly, className })} {...rest}>
      {icon}
      {children}
    </BaseToggle>
  )
}

export type ToggleGroupProps<V extends string> = {
  value: V
  onChange: (v: V) => void
  options: readonly { value: V; label: ReactNode; title?: string }[]
  label: string
  size?: ButtonVariants['size']
  className?: string
}

/** 一つだけを選ぶボタンの組 (早送りの ×1 ×2 ×4). 選んだ一つが押し込んだままになる */
export function ToggleGroup<V extends string>({ value, onChange, options, label, size, className }: ToggleGroupProps<V>) {
  return (
    <BaseToggleGroup
      aria-label={label}
      value={[value]}
      onValueChange={v => {
        // 選んであるものをもう一度押しても, 何も選んでいない状態にはしない
        const next = v[0] as V | undefined
        if (next) onChange(next)
      }}
      className={`inline-flex gap-1 ${className ?? ''}`}
    >
      {options.map(o => (
        <BaseToggle key={o.value} value={o.value} aria-label={o.title} className={button({ size, iconOnly: true })}>
          {o.label}
        </BaseToggle>
      ))}
    </BaseToggleGroup>
  )
}

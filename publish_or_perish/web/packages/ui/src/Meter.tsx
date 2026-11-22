// メーター. 量を横の棒で示し, 数を必ず添える (塗りと溝の比は 3 に届かないので, 棒だけで量を伝えない).
// 進み具合は Base UI の Progress で作る (aria-valuenow と aria-valuemax が付く).
import { Progress } from '@base-ui/react/progress'
import type { ReactNode } from 'react'
import { tv, type VariantProps } from './cn'

const meter = tv({
  slots: {
    track: 'w-full overflow-hidden rounded-xs border border-control bg-track',
    fill: 'h-full transition-[width] ease-out motion-reduce:transition-none',
    caption: 'mt-0.5 text-xs text-ink-sub nums',
  },
  variants: {
    tone: {
      /** 課題の進み具合. 満ちたら success に替える */
      gold: { fill: 'bg-gold duration-(--duration-meter) data-complete:bg-success' },
      /** XP */
      xp: { fill: 'bg-linear-to-r from-success-bright to-success-deep duration-(--duration-xp)' },
      /** タンクのような残りの量 */
      water: { fill: 'bg-info duration-(--duration-meter)' },
    },
    size: {
      task: { track: 'h-2.5' },
      xp: { track: 'h-3.5 border-2' },
      mini: { track: 'h-1.5' },
    },
  },
  defaultVariants: { tone: 'gold', size: 'task' },
})

export type MeterProps = VariantProps<typeof meter> & {
  value: number
  max: number
  /** 読み上げの名前 */
  label: string
  /** 棒の下に出す数 (3 / 10 マス) */
  caption?: ReactNode
  className?: string
}

export function Meter({ value, max, label, caption, tone, size, className }: MeterProps) {
  const s = meter({ tone, size })
  return (
    <Progress.Root value={Math.min(value, max)} max={max} aria-label={label} className={className}>
      <Progress.Track className={s.track()}>
        <Progress.Indicator className={s.fill()} />
      </Progress.Track>
      {caption != null && <div className={s.caption()}>{caption}</div>}
    </Progress.Root>
  )
}

/** ステージの帯. 済んだ節は success, 今の節は gold, まだの節は track */
export function StageBar({ index, total, label, className }: { index: number; total: number; label: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ''}`}>
      <div role="img" aria-label={label} className="flex flex-1 gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            // 節の並びは変わらないので, 位置をキーにしてよい
            // biome-ignore lint/suspicious/noArrayIndexKey: 上のとおり
            key={i}
            className={`h-2 flex-1 rounded-xs border border-control ${i < index ? 'bg-success' : i === index ? 'bg-gold' : 'bg-track'}`}
          />
        ))}
      </div>
      <span className="text-2xs text-ink-sub nums">
        {Math.min(index + 1, total)} / {total}
      </span>
    </div>
  )
}

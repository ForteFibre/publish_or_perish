// 分割の持ち手. 画面を二つの面に分け, その境を動かす (説明の面と畑の面のあいだ).
// つかんで動かす. フォーカスがあれば矢印で 16px, Shift と矢印で 64px. ダブルクリックか Enter で最初の幅に戻る.
// Base UI に当たる部品がないので自前で作る.
import { type KeyboardEvent, type PointerEvent, useRef } from 'react'

export type SplitterProps = {
  /** vertical: 左右に分ける (持ち手は縦の帯). horizontal: 上下に分ける (横の帯) */
  orientation: 'vertical' | 'horizontal'
  /** 先の面 (左か上) の大きさ [px] */
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  /** 最初の大きさに戻す */
  onReset: () => void
  label: string
}

export function Splitter({ orientation, value, min, max, onChange, onReset, label }: SplitterProps) {
  const drag = useRef<{ start: number; from: number } | null>(null)
  const vertical = orientation === 'vertical'
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)))
  const pos = (e: PointerEvent) => (vertical ? e.clientX : e.clientY)

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 64 : 16
    const back = vertical ? 'ArrowLeft' : 'ArrowUp'
    const fwd = vertical ? 'ArrowRight' : 'ArrowDown'
    if (e.key === back) onChange(clamp(value - step))
    else if (e.key === fwd) onChange(clamp(value + step))
    else if (e.key === 'Enter') onReset()
    else if (e.key === 'Home') onChange(min)
    else if (e.key === 'End') onChange(max)
    else return
    e.preventDefault()
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: 動かせる境は hr ではなく, フォーカスを受ける separator にする (WAI-ARIA の Window Splitter)
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation={orientation}
      aria-valuenow={max > min ? Math.round(((value - min) / (max - min)) * 100) : 0}
      aria-valuemin={0}
      aria-valuemax={100}
      onKeyDown={onKey}
      onDoubleClick={onReset}
      onPointerDown={e => {
        e.currentTarget.setPointerCapture(e.pointerId)
        drag.current = { start: pos(e), from: value }
      }}
      onPointerMove={e => {
        if (drag.current) onChange(clamp(drag.current.from + pos(e) - drag.current.start))
      }}
      onPointerUp={() => {
        drag.current = null
      }}
      className={`group relative grid shrink-0 touch-none place-items-center bg-track hover:bg-gold-soft active:bg-gold-soft ${
        vertical ? 'w-(--splitter) cursor-col-resize' : 'h-(--splitter) cursor-row-resize'
      }`}
    >
      <span
        className={`rounded-full bg-control group-hover:bg-gold-ink group-active:bg-gold-ink ${vertical ? 'h-8 w-0.5' : 'h-0.5 w-8'}`}
      />
    </div>
  )
}

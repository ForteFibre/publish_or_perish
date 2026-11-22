// マウスの位置に出す札 (マスの情報). マウスの右下 (右へ 16px, 下へ 12px) に遅れなしで出し,
// 画面の端で切れるときは反対側に出す. 中に操作する部品を入れない.
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'

export function FloatingCard({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x + 16, top: y + 12 })
  useLayoutEffect(() => {
    const r = el.current?.getBoundingClientRect()
    if (!r) return
    const left = x + 16 + r.width > innerWidth - 8 ? x - 16 - r.width : x + 16
    const top = y + 12 + r.height > innerHeight - 8 ? y - 12 - r.height : y + 12
    setPos({ left: Math.max(8, left), top: Math.max(8, top) })
  }, [x, y])
  return (
    <div
      ref={el}
      className="pointer-events-none fixed z-(--z-popup) max-w-[280px] rounded-md border-2 border-edge bg-surface px-3 py-2 text-xs shadow-pop"
      style={pos}
    >
      {children}
    </div>
  )
}

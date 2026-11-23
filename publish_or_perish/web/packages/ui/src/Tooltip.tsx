// ツールチップ. アイコンだけのボタンに, ホバーかフォーカスから 400 ms で名前を出す.
// 中に操作する部品を入れない. マスの情報 (3D のマウスの位置に出す) は FloatingCard を使う.
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import type { ReactElement, ReactNode } from 'react'

export const popupClass =
  'max-w-[280px] rounded-md border-2 border-edge bg-surface px-3 py-2 text-xs text-ink shadow-pop ' +
  'origin-(--transform-origin) transition-[opacity,scale] duration-(--duration-fast) ease-out ' +
  'data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:opacity-0'

/** 画面に 1 つ置く. ボタンの列の上を動いたとき, 2 つ目からは待たずに出す */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <BaseTooltip.Provider delay={400}>{children}</BaseTooltip.Provider>
}

export function Tooltip({
  label,
  children,
  side = 'top',
}: {
  label: ReactNode
  children: ReactElement
  side?: 'top' | 'bottom' | 'left' | 'right'
}) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger delay={400} render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={8} collisionPadding={8} className="z-(--z-popup)">
          <BaseTooltip.Popup className={popupClass}>{label}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  )
}

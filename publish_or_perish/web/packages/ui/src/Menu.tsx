// メニュー. 小さい窓の 1 行の「…」や, 言語の切り替えから開く. 上下の矢印で移り, Enter で選び, Esc で閉じる.
import { Menu as BaseMenu } from '@base-ui/react/menu'
import type { ReactElement, ReactNode } from 'react'
import { Check } from './icons'

export type MenuItem = { label: ReactNode; icon?: ReactNode; onSelect: () => void; checked?: boolean; disabled?: boolean }

export function Menu({ trigger, items }: { trigger: ReactElement; items: MenuItem[] }) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={8} align="end" collisionPadding={8} className="z-(--z-popup)">
          <BaseMenu.Popup className="min-w-48 origin-(--transform-origin) rounded-md border-2 border-edge bg-surface p-1 text-ink shadow-pop transition-[opacity,scale] duration-(--duration-base) ease-out data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            {items.map((it, i) => (
              <BaseMenu.Item
                // 項目は毎回同じ並びで作るので, 位置をキーにしてよい
                // biome-ignore lint/suspicious/noArrayIndexKey: 上のとおり
                key={i}
                disabled={it.disabled}
                onClick={it.onSelect}
                className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-3 text-sm outline-none select-none data-disabled:cursor-default data-disabled:text-ink-faint data-highlighted:bg-gold-soft"
              >
                <span className="flex w-4 justify-center">{it.checked ? <Check size={16} aria-hidden /> : it.icon}</span>
                {it.label}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  )
}

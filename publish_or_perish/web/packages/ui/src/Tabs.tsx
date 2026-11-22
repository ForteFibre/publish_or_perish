// タブ. 同じ場所で中身を切り替える (将来のエディタのファイルの切り替えで使う).
// 選んだタブは下の面と同じ地になり, 面とつながる. 左右の矢印で隣のタブへ, Tab で中身へ入る.
import { Tabs as BaseTabs } from '@base-ui/react/tabs'
import type { ReactNode } from 'react'

export type TabItem = { value: string; label: ReactNode; content: ReactNode }

export function Tabs({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem[]
  value?: string
  onChange?: (v: string) => void
  label: string
}) {
  return (
    <BaseTabs.Root value={value} defaultValue={items[0]?.value} onValueChange={v => onChange?.(String(v))}>
      <BaseTabs.List aria-label={label} className="flex gap-1 border-b-2 border-edge">
        {items.map(t => (
          <BaseTabs.Tab
            key={t.value}
            value={t.value}
            className="-mb-0.5 h-9 cursor-pointer rounded-t-md border-2 border-b-0 border-transparent bg-track px-4 font-display text-base font-bold text-ink hover:bg-surface-sunken data-active:border-edge data-active:bg-surface"
          >
            {t.label}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
      {items.map(t => (
        <BaseTabs.Panel key={t.value} value={t.value} className="rounded-b-md border-2 border-t-0 border-edge bg-surface p-4">
          {t.content}
        </BaseTabs.Panel>
      ))}
    </BaseTabs.Root>
  )
}

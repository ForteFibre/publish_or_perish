// 畑の上に重なるもの: 窓, 通知, 帯, メニュー, ツールチップ, マスの情報.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { Banner } from './Banner'
import { Button, IconButton } from './Button'
import { Dialog } from './Dialog'
import { FloatingCard } from './FloatingCard'
import { Ellipsis, Languages, Store, Workflow } from './icons'
import { Menu } from './Menu'
import { notify, ToastRegion } from './Toasts'

const meta = { title: '部品/重なるもの', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const Shop = () => (
  <div className="flex flex-col">
    {['水やりの速さ 2 倍', 'タンクを大きくする', 'Extremely long item name that must wrap onto the next line in English'].map((n, i) => (
      <div key={n} className="flex items-center gap-3 border-t border-dashed border-line py-3 first:border-t-0">
        <div className="min-w-0 flex-1">
          <div className="font-bold">{n}</div>
          <div className="text-xs text-ink-sub">ロボットが 1 マスに水をやる時間が半分になる。</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button intent="primary" size="sm" disabled={i === 2}>
            {120 + i * 100} G
          </Button>
          {i === 2 && <span className="text-xs text-ink-sub">あと 50 G</span>}
        </div>
      </div>
    ))}
  </div>
)

/** 窓. 幕は 0.55, 窓の地は不透明. Esc, 幕, 閉じるボタンで閉じる */
export const DialogStory: Story = {
  name: '窓',
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <div className="p-8">
        <Button icon={<Store size={20} aria-hidden />} onClick={() => setOpen(true)}>
          お店
        </Button>
        <Dialog open={open} onOpenChange={setOpen} title="お店">
          <Shop />
        </Dialog>
      </div>
    )
  },
}

/** 通知の三種類. 枠の色とアイコンで分ける */
export const Toasts: Story = {
  name: '通知',
  render: () => (
    <ToastRegion>
      <div className="flex gap-2 p-8 pt-48">
        <Button onClick={() => notify({ kind: 'mission', title: '課題クリア: 水をやる', body: '+50 G ・ +30 XP' })}>課題</Button>
        <Button onClick={() => notify({ kind: 'stage', title: 'ステージ 1 クリア', body: '次のステージが開いた' })}>ステージ</Button>
        <Button onClick={() => notify({ kind: 'achievement', title: '実績: はじめての収穫', body: '小麦を 1 つ収穫した' })}>実績</Button>
      </div>
      <AutoToasts />
    </ToastRegion>
  ),
}

function AutoToasts() {
  // 通知の場所が用意できてから出す (子の useEffect は親より先に走るので, 次の回に回す)
  useEffect(() => {
    const t = setTimeout(() => {
      notify({ kind: 'mission', title: '課題クリア: 水をやる', body: '+50 G ・ +30 XP' })
      notify({ kind: 'stage', title: 'ステージ 1 クリア', body: '次のステージが開いた' })
      notify({ kind: 'achievement', title: 'Achievement: First harvest of the very long season', body: 'You harvested one wheat.' })
    }, 50)
    return () => clearTimeout(t)
  }, [])
  return null
}

export const BannerStory: Story = { name: '帯', render: () => <Banner body="レベルアップ" title="Lv 3 見習い農家" /> }

/** 小さい窓の「…」から開くメニュー */
export const MenuStory: Story = {
  name: 'メニュー',
  render: () => (
    <div className="flex justify-end p-8">
      <Menu
        trigger={<Button size="sm" iconOnly aria-label="そのほかの操作" icon={<Ellipsis size={16} aria-hidden />} />}
        items={[
          { label: 'お店', icon: <Store size={16} aria-hidden />, onSelect: () => {} },
          { label: '配線図', icon: <Workflow size={16} aria-hidden />, onSelect: () => {} },
          { label: '音', checked: true, onSelect: () => {} },
          { label: '言語', icon: <Languages size={16} aria-hidden />, onSelect: () => {}, disabled: true },
        ]}
      />
    </div>
  ),
}

export const TooltipStory: Story = {
  name: 'ツールチップ',
  render: () => (
    <div className="p-16">
      <IconButton label="配線図 (送り手と受け手のつながり)" icon={<Workflow size={20} aria-hidden />} />
    </div>
  ),
}

/** マスの情報. 画面の端では反対側に出る */
export const Tile: Story = {
  name: 'マスの情報',
  render: () => (
    <div className="h-[400px]">
      <FloatingCard x={120} y={80}>
        <b>マス (3, 2)</b>
        <br />
        水分 40 ・ 作物 小麦 60%
        <br />
        <span className="font-mono text-info-ink">data[2 * 8 + 3] = data[19]</span>
      </FloatingCard>
      <FloatingCard x={window.innerWidth - 20} y={200}>
        <b>右の端</b>
        <br />
        左に出る
      </FloatingCard>
    </div>
  ),
}

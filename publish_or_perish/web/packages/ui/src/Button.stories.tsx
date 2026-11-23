import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button, IconButton, ToggleButton, ToggleGroup } from './Button'
import { BookOpen, FastForward, Store, Trophy, Volume2, VolumeX, Workflow } from './icons'
import { Pill } from './Pill'

const meta = { title: '部品/ボタン', component: Button, args: { children: '説明を読む' } } satisfies Meta<typeof Button>
export default meta
type Story = StoryObj<typeof meta>

/** 変種と大きさ. 主のボタンは一つの札か窓に 1 個まで */
export const Variants: Story = {
  name: '変種と大きさ',
  render: () => (
    <div className="grid grid-cols-[auto_auto_auto] items-center gap-4">
      <Button intent="primary">買う 120 G</Button>
      <Button intent="secondary" icon={<BookOpen size={20} aria-hidden />}>
        説明を読む
      </Button>
      <Button intent="link">開く</Button>
      <Button intent="primary" size="sm">
        買う
      </Button>
      <Button size="sm" icon={<BookOpen size={16} aria-hidden />}>
        説明を読む
      </Button>
      <div className="rounded-sm bg-term p-2">
        <Button intent="onTerm" size="sm">
          コピー
        </Button>
      </div>
    </div>
  ),
}

/** 状態. 押せないボタンも Tab で届き, 理由を添える. 処理中は二度押しだけを無視する */
export const States: Story = {
  name: '状態',
  render: () => (
    <div className="flex flex-wrap items-start gap-4">
      <Button>通常</Button>
      <Button aria-pressed>押し込んだまま</Button>
      <div className="flex flex-col items-center gap-1">
        <Button intent="primary" disabled>
          250 G
        </Button>
        <span className="text-xs text-ink-sub">あと 50 G</span>
      </div>
      <Button loading>処理中</Button>
      <Button intent="primary" loading>
        買う
      </Button>
    </div>
  ),
}

/** 右下のボタン列. 狭い画面ではアイコンだけにし, 名前はツールチップで出す */
export const IconOnly: Story = {
  name: 'アイコンだけ',
  render: () => {
    const [sound, setSound] = useState(true)
    return (
      <div className="flex gap-2">
        <IconButton label="早送り" icon={<FastForward size={20} aria-hidden />} />
        <IconButton
          label="配線図"
          icon={<Workflow size={20} aria-hidden />}
          badge={
            <Pill tone="alert" badge>
              !
            </Pill>
          }
        />
        <IconButton label="お店" icon={<Store size={20} aria-hidden />} />
        <IconButton
          label="実績"
          icon={<Trophy size={20} aria-hidden />}
          badge={
            <Pill tone="gold" badge>
              3/12
            </Pill>
          }
        />
        <ToggleButton
          iconOnly
          aria-label="音"
          pressed={sound}
          onPressedChange={setSound}
          icon={sound ? <Volume2 size={20} aria-hidden /> : <VolumeX size={20} aria-hidden />}
        />
      </div>
    )
  },
}

/** 早送りは ×1, ×2, ×4 の組で, 選んだ一つが押し込んだままになる */
export const Speed: Story = {
  name: '早送りの組',
  render: () => {
    const [v, setV] = useState<'1' | '2' | '4'>('1')
    return (
      <ToggleGroup
        label="時間の速さ"
        value={v}
        onChange={setV}
        options={[
          { value: '1', label: '×1' },
          { value: '2', label: '×2' },
          { value: '4', label: '×4' },
        ]}
      />
    )
  },
}

/** 英語の画面. ボタンの文は折り返さない (入らない訳は, 訳を短くする) */
export const English: Story = {
  name: '長い英語の文',
  render: () => (
    <div className="flex w-[288px] flex-wrap gap-2">
      <Button size="sm" icon={<BookOpen size={16} aria-hidden />}>
        Read the guide
      </Button>
      <Button intent="primary">Buy 120 G</Button>
      <Button>Achievements</Button>
    </div>
  ),
}

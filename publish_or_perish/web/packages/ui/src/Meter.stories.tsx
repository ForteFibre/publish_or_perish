import type { Meta, StoryObj } from '@storybook/react-vite'
import { Meter, StageBar } from './Meter'

const meta = { title: '部品/メーター', component: Meter, args: { value: 3, max: 10, label: '水をやる' } } satisfies Meta<typeof Meter>
export default meta
type Story = StoryObj<typeof meta>

/** 課題, XP, タンク, 小さい窓. 数を必ず添える */
export const Kinds: Story = {
  name: '種類',
  render: () => (
    <div className="flex w-[288px] flex-col gap-4">
      <Meter value={3} max={10} label="水をやる" caption="3 / 10 マス" />
      <Meter value={10} max={10} label="水をやる" caption="10 / 10 マス (満ちたら緑)" />
      <Meter tone="xp" size="xp" value={180} max={250} label="XP" caption="180 / 250 XP" />
      <Meter tone="water" value={4} max={10} label="タンク" caption="4 / 10" />
      <Meter size="mini" value={6} max={10} label="小さい窓" />
    </div>
  ),
}

export const Stages: Story = {
  name: 'ステージの帯',
  render: () => (
    <div className="w-[288px]">
      <StageBar index={2} total={12} label="ステージ 3 / 12" />
    </div>
  ),
}

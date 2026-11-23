import type { Meta, StoryObj } from '@storybook/react-vite'
import { Pill } from './Pill'

const meta = { title: '部品/Pill', component: Pill } satisfies Meta<typeof Pill>
export default meta
type Story = StoryObj<typeof meta>

/** 色調. 光る (live) のは「無人運転中」だけ */
export const Tones: Story = {
  name: '色調',
  globals: { backgrounds: { value: 'surface' } },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Pill tone="player" live>
        無人運転中
      </Pill>
      <Pill tone="player">接続中</Pill>
      <Pill tone="cli">CLI で操作中 (1)</Pill>
      <Pill tone="warning">注意 1</Pill>
      <Pill tone="farm">farm</Pill>
      <Pill tone="danger">切断</Pill>
      <Pill tone="neutral">停止中</Pill>
      <Pill tone="neutral" dot>
        動作中
      </Pill>
      <Pill tone="gold" badge>
        3/12
      </Pill>
      <Pill tone="alert" badge>
        !
      </Pill>
    </div>
  ),
}

export const English: Story = {
  name: '長い英語の文',
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Pill tone="player" live>
        Driving by your node
      </Pill>
      <Pill tone="cli">Driven from the CLI (2)</Pill>
      <Pill tone="danger">Disconnected</Pill>
    </div>
  ),
}

// 画面の全体 (3D を除く) に, 記録した /farm/state を流し込んだ見本.
// 上の帯の「画面の大きさ」で 1366×820, 1000×700, 500×380 を選んで確かめる.
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite'
import { App } from './App'
import { useUi } from './ui'

/** 説明の面を開いた (または閉じた) 状態にしてから描く */
const guide =
  (id: string | null): Decorator =>
  Story => {
    useUi.setState({ guideId: id, peekField: false, modal: null })
    return <Story />
  }

const meta = {
  title: '画面/全体',
  component: App,
  args: { scene: false },
  parameters: { layout: 'fullscreen' },
  decorators: [guide(null)],
} satisfies Meta<typeof App>
export default meta

type Story = StoryObj<typeof meta>

/** 始めたばかり */
export const Fresh: Story = { name: '始めたばかり', parameters: { fixture: 'farm-fresh' } }

/** 課題を進めている途中 (ログに原文と訳が並ぶ) */
export const Playing: Story = { name: '進めている途中', parameters: { fixture: 'farm-playing' } }

/** 点検が 4 件ある */
export const Mistakes: Story = { name: '点検が 4 件', parameters: { fixture: 'farm-mistakes' } }

/** 説明を開いた. 左に説明の面, 右に畑の面 (課題の札は説明の面の頭に移る) */
export const GuideOpen: Story = { name: '説明を開いた', parameters: { fixture: 'farm-playing' }, decorators: [guide('s1_harvest')] }

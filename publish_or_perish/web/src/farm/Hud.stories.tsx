// 画面の全体 (3D を除いた HUD) に, 記録した /farm/state を流し込んだ見本.
// 上の帯の「画面の大きさ」で, 狭い画面と小さい窓も確かめる.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Hud } from './App'
import './farm.css'

const meta = {
  title: '画面/全体',
  component: Hud,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Hud>
export default meta

type Story = StoryObj<typeof meta>

/** 始めたばかり */
export const Fresh: Story = { name: '始めたばかり', parameters: { fixture: 'farm-fresh' } }

/** 課題を進めている途中 (ログに原文と訳が並ぶ) */
export const Playing: Story = { name: '進めている途中', parameters: { fixture: 'farm-playing' } }

/** 点検が 4 件ある */
export const Mistakes: Story = { name: '点検が 4 件', parameters: { fixture: 'farm-mistakes' } }

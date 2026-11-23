import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card, CardTitle } from './Card'

const meta = { title: '部品/札', component: Card } satisfies Meta<typeof Card>
export default meta
type Story = StoryObj<typeof meta>

/** 札の変種. 背景を草にすると, 枠と厚みで札の輪郭が見えることを確かめられる */
export const Variants: Story = {
  name: '変種',
  globals: { backgrounds: { value: 'grass' } },
  render: () => (
    <div className="grid w-[640px] grid-cols-2 gap-6">
      <Card>
        <CardTitle>hud</CardTitle>
        <p className="text-sm">畑の上に常に出ている札。地は 0.94 の半透明。</p>
      </Card>
      <Card variant="solid">
        <CardTitle>solid</CardTitle>
        <p className="text-sm">窓、通知、メニューの土台。下が透けない。</p>
      </Card>
      <Card>
        <CardTitle>中に sunken</CardTitle>
        <Card variant="sunken" pad="sm" className="mt-2 text-sm">
          札の中の札。厚みも影もない。
        </Card>
      </Card>
      <Card variant="danger" pad="sm" className="text-sm">
        danger: 小さい窓の 1 行で、点検のエラーがあるとき
      </Card>
    </div>
  ),
}

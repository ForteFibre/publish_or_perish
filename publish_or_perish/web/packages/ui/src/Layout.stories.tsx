// 説明の面と分割の持ち手, タブ.
import { expandMessages, render } from '@pop/guide'
import { tr } from '@pop/i18n'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Button } from './Button'
import { Coin } from './Coin'
import { GuideHeader, GuidePane } from './GuidePane'
import { ExternalLink, X } from './icons'
import { Meter } from './Meter'
import { Pill } from './Pill'
import { Splitter } from './Splitter'
import { Tabs } from './Tabs'

const meta = { title: '部品/説明の面と分割', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const html = (md: string) =>
  render(
    expandMessages(md, {
      original: (k, a) => tr(k, a, 'en'),
      translated: (k, a) => tr(k, a, 'ja'),
      label: tr('guide.translation'),
    }),
    { copy: tr('ui.copy'), translation: tr('guide.translation') },
  )

function Pane({ md, id }: { md: string; id: string }) {
  return (
    <GuidePane
      memoryKey={`story-${id}`}
      html={html(md)}
      className="h-full"
      header={
        <GuideHeader
          title="鐘を鳴らす"
          aside={
            <span className="inline-flex items-center gap-1 font-display font-bold text-gold-ink">
              <Coin size={14} />
              +50 G
            </span>
          }
          actions={
            <>
              <Button size="sm" iconOnly aria-label="別のタブで開く" icon={<ExternalLink size={16} aria-hidden />} />
              <Button size="sm" iconOnly aria-label="閉じる" icon={<X size={16} aria-hidden />} />
            </>
          }
        >
          <div className="flex items-center gap-3">
            <Meter value={1} max={3} label="鐘を鳴らす" className="flex-1" />
            <span className="text-xs text-ink-sub nums">1 / 3 回</span>
            <Pill tone="danger">エラー 1</Pill>
          </div>
        </GuideHeader>
      }
    />
  )
}

const loadGuide = async (id: string) => ({ md: await fetch(`guide/ja/${id}.md`).then(r => r.text()) })

/** いちばん長い説明 (board_pub). 見出しの帯で節を行き来する */
export const Long: StoryObj<{ md: string }> = {
  name: '長い説明 (720px)',
  loaders: [() => loadGuide('board_pub')],
  render: (_, { loaded }) => (
    <div className="flex h-screen">
      <div className="w-[720px]">
        <Pane md={(loaded as { md: string }).md} id="long" />
      </div>
      <div className="flex-1 bg-grass" />
    </div>
  ),
}

/** 最も狭い幅 (480px) と, ターミナルの出力と訳を含む説明 */
export const Narrow: StoryObj<{ md: string }> = {
  name: '狭い幅 (480px)',
  loaders: [() => loadGuide('board_bell')],
  render: (_, { loaded }) => (
    <div className="flex h-screen">
      <div className="w-[480px]">
        <Pane md={(loaded as { md: string }).md} id="narrow" />
      </div>
      <div className="flex-1 bg-grass" />
    </div>
  ),
}

/** 短い説明. 見出しが 2 個以下なら帯を出さない */
export const Short: StoryObj = {
  name: '短い説明',
  render: () => (
    <div className="h-screen w-[720px]">
      <Pane
        md={'# 植える\n\n## やること\n\n`/bot1/plant` を呼ぶ。\n\n```bash\nros2 service call /bot1/plant std_srvs/srv/Trigger\n```'}
        id="short"
      />
    </div>
  ),
}

/** 分割の持ち手. つかむか, フォーカスして矢印で動かす. Enter かダブルクリックで戻る */
export const Split: Story = {
  name: '分割の持ち手',
  render: () => {
    const [w, setW] = useState(720)
    return (
      <div className="flex h-screen">
        <div className="grid place-items-center bg-surface font-display" style={{ width: w }}>
          説明の面 {w}px
        </div>
        <Splitter
          orientation="vertical"
          value={w}
          min={480}
          max={1366 - 320 - 8}
          onChange={setW}
          onReset={() => setW(720)}
          label="説明の面の幅"
        />
        <div className="grid flex-1 place-items-center bg-grass font-display">畑の面</div>
      </div>
    )
  },
}

export const TabsStory: Story = {
  name: 'タブ',
  render: () => (
    <div className="w-[560px] p-8">
      <Tabs
        label="開いているファイル"
        items={[
          { value: 'a', label: 'patrol.cpp', content: <p className="text-sm">将来のエディタのファイルの切り替えで使う。</p> },
          { value: 'b', label: 'CMakeLists.txt', content: <p className="text-sm">2 つ目</p> },
        ]}
      />
    </div>
  ),
}

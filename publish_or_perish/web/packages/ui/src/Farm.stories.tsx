// 農場の画面に固有の部品: ログ, 点検の札, 課題の行, 配線図.
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './Button'
import { Card, CardTitle } from './Card'
import { CodeBlock } from './CodeBlock'
import { type DoctorItem, DoctorList } from './DoctorList'
import { BookOpen } from './icons'
import { type LogEntry, LogPanel } from './LogPanel'
import { StageBar } from './Meter'
import { MissionRow } from './MissionRow'
import { NodeTag, TopicPill, WireLine } from './Wire'

const meta = { title: '部品/農場', globals: { backgrounds: { value: 'grass' } } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>

const log: LogEntry[] = [
  { id: 1, ok: true, kind: 'notice', text: '作物の時間を 2 倍速にした' },
  { id: 2, ok: true, kind: 'notice', text: '作物の時間を 2 倍速にした' },
  { id: 3, ok: true, kind: 'notice', text: '作物の時間を 2 倍速にした' },
  {
    id: 4,
    ok: true,
    kind: 'cli',
    tag: 'service /bot1/water',
    original: 'watered tile (3, 2): moisture 100',
    text: 'マス (3, 2) に水をやった: 水分 100',
  },
  {
    id: 5,
    ok: false,
    kind: 'cli',
    tag: 'service /bot1/plant',
    original: 'cannot plant at (9, 9): outside the field (8 x 5). Move the robot inside the fence with /bot1/cmd_vel first.',
    text: '(9, 9) には植えられない: 畑 (8 × 5) の外。先に /bot1/cmd_vel でロボットを柵の中に動かす。',
  },
  { id: 6, ok: false, kind: 'doctor', text: 'package.xml に ament_cmake_auto がない' },
]

/** ログ. 同じ行は「×3」にまとめ, 失敗の行は 3 行まで折り返す */
export const Log: Story = {
  name: 'ログ',
  render: () => (
    <div className="w-[560px]">
      <LogPanel entries={log} />
    </div>
  ),
}

/** 英語の画面では訳を出さない */
export const LogEnglish: Story = {
  name: 'ログ (英語の画面)',
  render: () => (
    <div className="w-[560px]">
      <LogPanel entries={log} translate={false} />
    </div>
  ),
}

/** 狭い畑の面では 3 行にする */
export const LogNarrow: Story = {
  name: 'ログ (狭い画面)',
  parameters: { field: { width: 1000, height: 300 } },
  render: () => (
    <div className="absolute bottom-3 left-3 w-[560px]">
      <LogPanel entries={log} />
    </div>
  ),
}

const findings: DoctorItem[] = [
  {
    key: 'w',
    level: 'warn',
    title: 'src/patrol.cpp がビルドされない',
    file: '/home/u/src26_ws/src/tutorial_nodes/src/patrol.cpp:1',
    detail: 'CMakeLists.txt に書いていないので, colcon build しても実行ファイルができない (エラーも出ない)。',
    fix: 'ament_auto_add_executable(patrol src/patrol.cpp)',
  },
  {
    key: 'e1',
    level: 'error',
    title: 'package.xml に ament_cmake_auto がない',
    file: '/home/u/src26_ws/src/tutorial_nodes/package.xml:8',
    detail: 'CMakeLists.txt は ament_auto_... を使っているが, package.xml の <buildtool_depend> が ament_cmake のまま。',
    fix: '<buildtool_depend>ament_cmake_auto</buildtool_depend>',
  },
  {
    key: 'e2',
    level: 'error',
    title: 'ビルドに失敗した: セミコロンがない',
    file: '/home/u/src26_ws/src/tutorial_nodes/src/patrol.cpp:3',
    detail: "最初のエラー: expected ';' before '}' token\nエラーの行か, その 1 つ前の行の末尾に ; を足す。",
  },
  { key: 'i', level: 'info', title: 'ビルドしてから 10 分たった', detail: 'ソースを変えたら colcon build し直す。' },
]

/** 点検の札. 1 件だけを開き, 残りは題の 1 行に畳む (288px と 368px) */
export const Doctor: Story = {
  name: '点検の札',
  render: () => (
    <div className="flex items-start gap-6">
      {[368, 288].map(w => (
        <Card key={w} style={{ width: w }}>
          <DoctorList items={findings} onOpen={() => {}} />
        </Card>
      ))}
    </div>
  ),
}

/** 課題の札の中身. 開いているのは今の課題だけ */
export const Quest: Story = {
  name: '課題の札',
  render: () => (
    <Card className="flex w-[368px] flex-col gap-2">
      <StageBar index={1} total={12} label="ステージ 2 / 12" />
      <CardTitle>ステージ 2: ノードを書く</CardTitle>
      <div className="text-xs text-ink-sub">対応する講習: 入門 第10回 (ノード)</div>
      <div>
        <MissionRow title="ワークスペースを作る" reward={30} done />
        <MissionRow title="水をやる" reward={50} done={false} progress={{ value: 3, goal: 10, caption: '3 / 10 マス' }}>
          <p className="text-sm">自分のノードから /bot1/water を呼び、10 マスに水をやる。</p>
          <CodeBlock code="ros2 run tutorial_nodes patrol" />
          <Button size="sm" className="self-start" icon={<BookOpen size={16} aria-hidden />}>
            説明を読む
          </Button>
        </MissionRow>
        <MissionRow title="Water ten tiles from your own node with a very long English title" reward={120} done={false} />
      </div>
    </Card>
  ),
}

/** 配線図の 1 行. 送り手がいない側は赤い破線 */
export const Wires: Story = {
  name: '配線図',
  globals: { backgrounds: { value: 'surface' } },
  render: () => (
    <div className="flex w-[820px] flex-col">
      {[
        {
          l: <NodeTag kind="player">/my_patrol</NodeTag>,
          t: '/bot1/cmd_vel',
          s: 'Twist ・ 10.0 Hz ・ 520 B/s',
          r: <NodeTag kind="farm">farm</NodeTag>,
          hz: 10,
        },
        {
          l: <NodeTag kind="cli">CLI (ros2 topic pub)</NodeTag>,
          t: '/board/text',
          s: 'String ・ 1.0 Hz ・ 40 B/s',
          r: <NodeTag kind="farm">farm</NodeTag>,
          hz: 1,
        },
        {
          l: <NodeTag kind="none">送り手なし</NodeTag>,
          t: '/bot1/cmd_vell',
          s: 'Twist ・ 流れていない',
          r: <NodeTag kind="player">/my_patrol</NodeTag>,
          hz: 0,
        },
        {
          l: <NodeTag kind="farm">farm</NodeTag>,
          t: '/farm/field',
          s: 'Int32MultiArray ・ 2.0 Hz ・ 1.2 kB/s',
          r: <NodeTag kind="idle">まだ誰も見ていない</NodeTag>,
          hz: 2,
        },
      ].map(w => (
        <div key={w.t} className="grid grid-cols-[1fr_260px_1fr] items-center border-t border-dashed border-line py-2">
          <div className="flex justify-end">{w.l}</div>
          <div className="relative text-center">
            <WireLine hz={w.hz} dead={w.hz === 0} />
            <TopicPill topic={w.t} sub={w.s} />
          </div>
          <div>{w.r}</div>
        </div>
      ))}
    </div>
  ),
}

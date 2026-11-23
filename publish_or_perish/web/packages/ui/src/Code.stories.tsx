import type { Meta, StoryObj } from '@storybook/react-vite'
import { CodeBlock, InlineCode, TermOutput } from './CodeBlock'
import { KeyCap } from './KeyCap'
import { TextField } from './TextField'

const meta = { title: '部品/コードと入力', component: CodeBlock, args: { code: 'ros2 topic list' } } satisfies Meta<typeof CodeBlock>
export default meta
type Story = StoryObj<typeof meta>

const LONG = '<buildtool_depend>ament_cmake_auto</buildtool_depend>'
const CPP = `client_->async_send_request(std::make_shared<Trigger::Request>(), [this](rclcpp::Client<Trigger>::SharedFuture f) { RCLCPP_INFO(get_logger(), "%s", f.get()->message.c_str()); });`

/** 畑の上の札の中 (288px). どこででも折り返して, 全体を見せる */
export const InCard: Story = {
  name: '札の中 (折り返す)',
  render: () => (
    <div className="flex w-[288px] flex-col gap-2">
      <CodeBlock code="ros2 service call /bot1/water std_srvs/srv/Trigger" />
      <CodeBlock code={LONG} />
    </div>
  ),
}

/** 説明の面の中. 折り返さず横に送る (字下げと改行が意味を持つ) */
export const InPane: Story = {
  name: '説明の中 (横に送る)',
  render: () => (
    <div className="w-[480px]">
      <CodeBlock wrap="scroll" code={CPP} />
    </div>
  ),
}

/** ターミナルの出力. 原文のすぐ下に訳をつなげる. 英語の画面では訳を出さない */
export const Output: Story = {
  name: 'ターミナルの出力',
  render: () => (
    <div className="flex w-[480px] flex-col gap-4">
      <TermOutput
        original={"response:\nstd_srvs.srv.Trigger_Response(success=True, message='rang the bell (1)')"}
        translation="鐘を鳴らした (1 回目)"
      />
      <TermOutput original="success=False, message='bot1 cannot water here: the tile is not soil'" />
    </div>
  ),
}

export const Inline: Story = {
  name: '文中のコードとキー',
  render: () => (
    <p className="w-[480px] text-base">
      <InlineCode>package.xml</InlineCode> に <InlineCode>{'<depend>std_srvs</depend>'}</InlineCode> を足す。前へ進むのは <KeyCap>W</KeyCap>
      、速くするのは <KeyCap>Shift</KeyCap>。
    </p>
  ),
}

export const Field: Story = {
  name: '入力欄',
  render: () => (
    <div className="flex w-[288px] flex-col gap-4">
      <TextField label="ログを絞り込む" placeholder="bot1" />
      <TextField label="topic の名前" mono defaultValue="/bot1/cmd_vell" error="この topic は無い" />
      <TextField label="押せない" disabled defaultValue="farm_node" />
    </div>
  ),
}

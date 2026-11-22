// 誰が動かしているかの色 (3D). 値は docs/design/ui-tokens.md の「3D の粒の色」と同じ.
// HUD の同じ意味の色 (Pill, 配線図の枠) とは色相をそろえ, 3D は自分で光る材質なので明るい値にしてある.
// packages/ui を作ったら, そこの定数に移す.

/** 送り手 (誰が動かしているか) の種類 */
export type Src = 'player' | 'cli' | 'farm' | 'mixed' | 'tool'

/** 発光する物 (ロボットの LED, メッセージの粒) の色 */
export const SRC_GLOW: Record<Src, string> = {
  player: '#5bf06a',
  cli: '#b78cff',
  farm: '#5ab8ff',
  mixed: '#ff5a4a',
  tool: '#999999',
}

/** ノードの小屋の屋根と壁, 名札の地 */
export const HUT = {
  player: { roof: '#4caf50', wall: '#e8efe0', tag: 'rgba(35, 122, 42, 0.9)' },
  cli: { roof: '#8e63d9', wall: '#e6dcf5', tag: 'rgba(91, 52, 168, 0.9)' },
} as const

/** 配線図の端の種類 (farm / player / cli / tool など) を, 送り手の種類にする */
export const srcOf = (kind: string): Src => (kind === 'player' || kind === 'cli' || kind === 'farm' || kind === 'mixed' ? kind : 'tool')

// 3D (three.js) が使う色. 3D は CSS の変数を読まないので, styles.css と同じ値をここにも持つ.
// 値は docs/design/ui-tokens.md の「意味の色」「3D の粒の色」「3D の中の文字」と同じ. tokens.test.ts が styles.css と比べる.
// HUD の同じ意味の色 (Pill, 配線図の枠) とは色相をそろえ, 3D は自分で光る材質なので明るい値にしてある.

/** styles.css の色のうち, 3D とテストが使うもの */
export const COLOR = {
  sky: '#9fd8f5',
  grass: '#6cbf45',
  ink: '#1f2a1f',
  success: '#4caf50',
  cli: '#8e63d9',
  info: '#3b82c4',
  danger: '#e05244',
  gold: '#e8a923',
  edge: '#c9bc98',
} as const

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

/** ノードの小屋の屋根と壁, 名札の地. 屋根は HUD の意味の色 (success, cli) と同じ */
export const HUT = {
  player: { roof: COLOR.success, wall: '#e8efe0', tag: 'rgba(35, 122, 42, 0.9)' },
  cli: { roof: COLOR.cli, wall: '#e6dcf5', tag: 'rgba(91, 52, 168, 0.9)' },
} as const

/** 3D の中に描く文字 */
export const SCENE_TEXT = {
  /** マスの座標 (x=0, y=0). 草との比 5.23 */
  coord: '#2f3a26',
  /** ロボットの名札の地 (ink の 0.75) */
  botTag: 'rgba(31, 42, 31, 0.75)',
  boardBg: '#2f4a3a',
  boardText: '#ffffff',
  /** 看板の補足と, まだ届いていない文字 (比 5.19) */
  boardSub: '#a9c4b0',
  boardNumber: '#ffe9a0',
  boardOk: '#7be07b',
  boardNg: '#ff8a7a',
} as const

/** 紙吹雪. 意味を持たない飾りなので, 意味の色とは別に今の 5 色を残す */
export const CONFETTI = ['#e05244', '#f0a020', '#4caf50', '#3b82c4', '#9b6bd6'] as const

/** 配線図の端の種類 (farm / player / cli / tool など) を, 送り手の種類にする */
export const srcOf = (kind: string): Src => (kind === 'player' || kind === 'cli' || kind === 'farm' || kind === 'mixed' ? kind : 'tool')

/** 3D の文字を描く書体 (styles.css の --font-display と同じ). canvas は読み込みが済んだ書体でしか描けない */
export const DISPLAY_FONT = '"M PLUS Rounded 1c", "Hiragino Sans", "Yu Gothic UI", "Meiryo", "Noto Sans CJK JP", sans-serif'

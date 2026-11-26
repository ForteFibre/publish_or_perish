// 農場の状態 (/farm/state の JSON) の形. farm_node.cpp の publish_state() と合わせる.
// 0 / 1 で送ってくる真偽値は, そのまま数で受ける (画面の側で真偽に読む).

import type { Msg as MsgT } from '@pop/i18n'
import { z } from 'zod'

const flag = z.union([z.literal(0), z.literal(1)])

/** 文言 (キーと値). 文は訳の表にあり, 画面が訳す. 値は文字列か, それ自体を訳す文 */
export const Msg: z.ZodType<MsgT> = z.lazy(() =>
  z.object({
    key: z.string(),
    args: z.record(z.string(), z.union([z.string(), Msg])),
  }),
)

/** [水分 0〜100, 作物の種類 (なければ null), 生育 0〜1, 枯れた, 井戸] */
export const Tile = z.tuple([z.number(), z.string().nullable(), z.number(), flag, flag])

export const Bot = z.object({
  name: z.string(),
  x: z.number(),
  y: z.number(),
  th: z.number(),
  tank: z.number(),
  tank_max: z.number(),
  seed: z.string(),
  moving: flag,
  /** 最後に cmd_vel を送ってきたのが誰か. key は画面のキー (/farm/ui) */
  src: z.enum(['', 'cli', 'player', 'mixed', 'key']),
})

/** 題・説明・ヒントは訳の表の mission.<id>. unit は単位の種類 (unit.<unit>. 空なら単位なし) */
export const Mission = z.object({
  id: z.string(),
  unit: z.string(),
  goal: z.number(),
  value: z.number(),
  done: flag,
  reward: z.number(),
})

/** 題と講習は訳の表の stage.<id> */
export const Stage = z.object({
  id: z.string(),
  missions: z.array(Mission),
})

/** 名前と説明は訳の表の achievement.<id>. まだ取っていない隠し実績の id は hidden */
export const Achievement = z.object({ id: z.string(), done: flag })

/** 名前と説明は訳の表の shop.<id> */
export const ShopItem = z.object({ id: z.string(), price: z.number() })

export const Board = z.object({
  text: z.string(),
  text_src: z.string(),
  number: z.number(),
  answer: z.number(),
  /** -1: まだ答えがない, 0: ちがう, 1: 正解 */
  ok: z.number(),
  bells: z.number(),
})

/** [ノード名, 種類 (farm / player / cli / tool など)] */
export const WireEnd = z.tuple([z.string(), z.string()])

export const Wire = z.object({
  topic: z.string(),
  type: z.string(),
  hz: z.number(),
  bps: z.number(),
  /** なければ null */
  warn: Msg.nullable(),
  /** 打ち間違いのとき, つもりだったらしい topic (なければ空) */
  hint: z.string(),
  pubs: z.array(WireEnd),
  subs: z.array(WireEnd),
})

export const Finding = z.object({
  id: z.string(),
  level: z.enum(['error', 'warn', 'info']),
  title: Msg,
  detail: Msg,
  /** コピーして使うコマンド (訳さない) */
  fix: z.string(),
  file: z.string(),
  line: z.number(),
})

/**
 * 画面のログの 1 行. ターミナルにも出た結果 (service の返事など) は, tag (何への返事か) と
 * text (ターミナルに出た英語の文) を持つ. それ以外は tag と text が空で, msg を訳して出す
 */
export const LogLine = z.object({ id: z.number(), msg: Msg, tag: z.string(), text: z.string(), ok: flag })

export const Fx = z.object({
  id: z.number(),
  kind: z.string(),
  x: z.number(),
  y: z.number(),
  bot: z.string(),
  crop: z.string(),
  value: z.number(),
})

export const Notice = z.object({
  id: z.number(),
  kind: z.string(),
  title: Msg,
  body: Msg,
})

export const FarmState = z.object({
  t: z.number(),
  money: z.number(),
  xp: z.number(),
  /** 1 始まり. 称号は訳の表の title.<level> */
  level: z.number(),
  lv_xp: z.number(),
  next_xp: z.number(),
  w: z.number().int(),
  h: z.number().int(),
  tiles: z.array(Tile),
  bots: z.array(Bot),
  stage_index: z.number(),
  stage_count: z.number(),
  workspace: z.string(),
  package: z.string(),
  /** すべてのステージを終えると無い */
  stage: Stage.optional(),
  /** 準備中のステージ. 名前は訳の表の upcoming.<id> */
  upcoming: z.array(z.string()),
  achievements: z.array(Achievement),
  shop: z.array(ShopItem),
  speed: z.number(),
  board: Board,
  wires: z.array(Wire),
  graph: z.object({ auto: flag, cli: z.number(), players: z.array(z.string()) }),
  /** 点検のない古い農場のノードでも動くように, 無ければ空にする */
  doctor: z.array(Finding).default([]),
  log: z.array(LogLine),
  fx: z.array(Fx),
  notices: z.array(Notice),
})

export type Msg = MsgT
export type Tile = z.infer<typeof Tile>
export type Bot = z.infer<typeof Bot>
export type Mission = z.infer<typeof Mission>
export type Stage = z.infer<typeof Stage>
export type Achievement = z.infer<typeof Achievement>
export type ShopItem = z.infer<typeof ShopItem>
export type Board = z.infer<typeof Board>
export type WireEnd = z.infer<typeof WireEnd>
export type Wire = z.infer<typeof Wire>
export type Finding = z.infer<typeof Finding>
export type LogLine = z.infer<typeof LogLine>
export type Fx = z.infer<typeof Fx>
export type Notice = z.infer<typeof Notice>
export type FarmState = z.infer<typeof FarmState>

/**
 * 受け取った JSON を状態にする.
 * 開発中のビルド (check = true) はスキーマで確かめ, 合わなければコンソールに出す (画面は止めない).
 * 本番のビルドは確かめずに, 足りない doctor だけを補う.
 */
export function parseFarmState(json: string, check: boolean): FarmState {
  const raw: unknown = JSON.parse(json)
  if (check) {
    const r = FarmState.safeParse(raw)
    if (r.success) return r.data
    console.warn('/farm/state の形がスキーマと合わない', z.prettifyError(r.error))
  }
  const s = raw as FarmState
  s.doctor ??= []
  return s
}

/** /farm/ui に送る操作 */
export type UiCommand =
  | { kind: 'buy'; id: string }
  | { kind: 'speed'; value: number }
  | { kind: 'diag'; text: string }
  /** キーで動かす (押している間 20 Hz で送る). 速度は機体の向き (x 前 / y 左 [m/s], z まわり [rad/s]) */
  | { kind: 'drive'; bot: string; vx: number; vy: number; wz: number }
  /** キーで足元のマスを操作する */
  | { kind: 'act'; bot: string; what: 'plant' | 'water' | 'harvest' }

export function encodeUi(c: UiCommand): string {
  switch (c.kind) {
    case 'buy':
      return `buy ${c.id}`
    case 'speed':
      return `speed ${c.value}`
    case 'diag':
      return `diag ${c.text}`
    case 'drive':
      return `drive ${c.bot} ${c.vx.toFixed(2)} ${c.vy.toFixed(2)} ${c.wz.toFixed(2)}`
    case 'act':
      return `act ${c.bot} ${c.what}`
  }
}

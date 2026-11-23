// 配線図の部品. ノードの札 (枠は意味の色), topic の札 (ターミナルと同じ暗い地), 頻度に合わせて流れる線.
import { tv } from './cn'

export type NodeKind = 'player' | 'cli' | 'farm' | 'tool' | 'none' | 'idle'

const node = tv({
  base: 'inline-block max-w-full truncate rounded-sm border-2 bg-surface px-2 py-0.5 font-mono text-xs',
  variants: {
    kind: {
      player: 'border-src-player',
      cli: 'border-src-cli',
      farm: 'border-src-farm',
      tool: 'border-edge',
      none: 'border-dashed border-danger text-danger-ink',
      idle: 'border-edge text-ink-faint',
    },
  },
})

/** ノードの札. 名前は折り返さず, 入らなければ末尾を … にして全体を title に入れる */
export function NodeTag({ kind, children }: { kind: NodeKind; children: string }) {
  return (
    <span className={node({ kind })} title={children}>
      {children}
    </span>
  )
}

/** topic の札. 1 行目に名前, 2 行目に型と頻度 */
export function TopicPill({ topic, sub }: { topic: string; sub: string }) {
  return (
    <span className="relative inline-block max-w-full rounded-full bg-term px-3 py-1 text-center font-mono on-term">
      <span className="block truncate text-xs text-term-text">{topic}</span>
      <span className="block truncate text-2xs text-term-sub">{sub}</span>
    </span>
  )
}

/** 送り手と受け手をつなぐ線. hz が 0.05 未満か dead なら赤くして流さない */
export function WireLine({ hz, dead }: { hz: number; dead: boolean }) {
  const dur = hz > 0.05 ? Math.max(0.15, 2 / hz) : 0
  return (
    <svg className="absolute top-1/2 left-0 h-1 w-full -translate-y-1/2 overflow-visible" aria-hidden>
      <line
        x1="0"
        y1="2"
        x2="100%"
        y2="2"
        strokeWidth="2.5"
        strokeDasharray="6 6"
        className={dead ? 'stroke-danger' : 'animate-wire stroke-control'}
        style={dead ? undefined : { animationDuration: `${dur}s` }}
      />
    </svg>
  )
}

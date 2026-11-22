// 窓: お店, 配線図, 実績. 畑を見なくてよい用事だけを窓にする (説明は説明の面に出す).
import { useTr } from '@pop/i18n'
import { useFarm, type Wire, type WireEnd } from '@pop/ros'
import { Button, Dialog, Icon, type NodeKind, NodeTag, TopicPill, WireLine } from '@pop/ui'
import type { ReactNode } from 'react'
import { type Modal, useUi } from '../ui'
import { fmtBytes } from './text'

// 状態がまだないときに返す空の配列. 毎回新しい [] を返すとストアが変わったと見なされ, 描き直しが止まらない
const NONE: never[] = []

function Frame({ id, title, size, children }: { id: Exclude<Modal, null>; title: string; size?: 'md' | 'lg'; children: ReactNode }) {
  const open = useUi(u => u.modal === id)
  const close = useUi(u => u.close)
  return (
    <Dialog open={open} onOpenChange={o => !o && close()} title={title} size={size}>
      {children}
    </Dialog>
  )
}

export function Modals() {
  const { tr } = useTr()
  return (
    <>
      <Frame id="shop" title={tr('ui.modal.shop')}>
        <Shop />
      </Frame>
      <Frame id="wires" title={tr('ui.modal.wires')} size="lg">
        <p className="mb-2 text-xs text-ink-sub">{tr('ui.modal.wires_legend')}</p>
        <Wires />
      </Frame>
      <Frame id="achs" title={tr('ui.modal.achievements')}>
        <Achievements />
      </Frame>
    </>
  )
}

function Shop() {
  const { tr } = useTr()
  const shop = useFarm(s => s.state?.shop ?? NONE)
  const money = useFarm(s => s.state?.money ?? 0)
  const send = useFarm(s => s.send)
  if (!shop.length) return <p className="text-base text-ink-sub">{tr('ui.modal.sold_out')}</p>
  return (
    <div className="flex flex-col">
      {shop.map(it => {
        const short = it.price - money
        return (
          <div key={it.id} className="flex items-center gap-3 border-t border-dashed border-line py-3 first:border-t-0">
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold">{tr(`shop.${it.id}.name`)}</div>
              <div className="text-xs text-ink-sub">{tr(`shop.${it.id}.desc`)}</div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Button
                intent="primary"
                size="sm"
                disabled={short > 0}
                aria-describedby={short > 0 ? `short-${it.id}` : undefined}
                icon={short > 0 ? <Icon.Lock size={16} aria-hidden /> : undefined}
                onClick={() => send({ kind: 'buy', id: it.id })}
              >
                {it.price} G
              </Button>
              {/* 買えない理由を添える */}
              {short > 0 && (
                <span id={`short-${it.id}`} className="text-xs text-ink-sub">
                  {tr('ui.modal.short', { n: String(short) })}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Achievements() {
  const { tr } = useTr()
  const achs = useFarm(s => s.state?.achievements ?? NONE)
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5">
      {achs.map((a, i) => (
        <div
          // 隠れた実績は id が同じ (hidden) なので, 位置で区別する
          // biome-ignore lint/suspicious/noArrayIndexKey: 上のとおり
          key={i}
          className={`flex flex-col gap-1 rounded-md border-2 p-2.5 text-xs ${a.done ? 'border-gold bg-gold-soft text-ink' : 'border-line bg-surface-sunken text-ink-sub'}`}
        >
          <b className={`flex items-start gap-1 text-base ${a.done ? 'text-gold-ink' : 'text-ink-faint'}`}>
            {a.done ? (
              <Icon.Medal size={16} className="mt-1 shrink-0" aria-hidden />
            ) : (
              <Icon.Lock size={16} className="mt-1 shrink-0" aria-hidden />
            )}
            {tr(`achievement.${a.id}.name`)}
          </b>
          <span>{tr(`achievement.${a.id}.desc`)}</span>
        </div>
      ))}
    </div>
  )
}

const KIND: Record<string, NodeKind> = { player: 'player', cli: 'cli', farm: 'farm' }

function Node({ end: [n, k] }: { end: WireEnd }) {
  return <NodeTag kind={KIND[k] ?? 'tool'}>{k === 'cli' ? `CLI (${n})` : n}</NodeTag>
}

function WireRow({ w }: { w: Wire }) {
  const { tr, tm } = useTr()
  // 農場が出しているのを誰も見ていないだけなら, 間違いではないので灰色にする
  const idle = !w.subs.length && w.pubs.every(([, k]) => k === 'farm')
  const dead = !idle && (!w.pubs.length || !w.subs.length || w.hz < 0.05)
  const rate = w.hz >= 0.05 ? tr('ui.wires.rate', { hz: w.hz.toFixed(w.hz < 10 ? 1 : 0), bytes: fmtBytes(w.bps) }) : tr('ui.wires.stopped')
  return (
    <div className="grid grid-cols-[1fr_260px_1fr] items-center border-t border-dashed border-line py-2 first:border-t-0 vp-mini:grid-cols-[1fr_160px_1fr]">
      <div className="flex min-w-0 flex-col items-end gap-1">
        {w.pubs.length ? w.pubs.map(e => <Node key={e.join()} end={e} />) : <NodeTag kind="none">{tr('ui.wires.no_pub')}</NodeTag>}
      </div>
      <div className="relative min-w-0 text-center">
        <WireLine hz={w.hz} dead={dead} />
        <TopicPill topic={w.topic} sub={`${w.type.split('/').pop()} ・ ${rate}`} />
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1">
        {w.subs.length ? (
          w.subs.map(e => <Node key={e.join()} end={e} />)
        ) : idle ? (
          <NodeTag kind="idle">{tr('ui.wires.idle')}</NodeTag>
        ) : (
          <NodeTag kind="none">{tr('ui.wires.no_sub')}</NodeTag>
        )}
      </div>
      {w.warn && (
        <div className="col-span-3 mt-1 flex items-start gap-1.5 rounded-sm bg-danger-soft px-2.5 py-1.5 text-sm text-danger-ink">
          <Icon.TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            {tm(w.warn)}
            {w.hint && (
              <>
                {' → '}
                <b className="text-ink">{tr('wire.hint', { topic: w.hint })}</b>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

function Wires() {
  const { tr } = useTr()
  const wires = useFarm(s => s.state?.wires ?? NONE)
  if (!wires.length) return <p className="text-sm text-ink-sub">{tr('ui.wires.none')}</p>
  return (
    <div>
      {wires.map(w => (
        <WireRow key={w.topic} w={w} />
      ))}
    </div>
  )
}

// お店, 配線図, 実績, 課題の説明の窓. 背景か × を押すと閉じる.

import { expandMessages, render, substitute } from '@pop/guide'
import { tr as trNow, useTr } from '@pop/i18n'
import { useFarm, type Wire, type WireEnd } from '@pop/ros'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { type Modal, useUi } from '../ui'
import { loadGuide } from './guide'
import { fmtBytes } from './text'

// 状態がまだないときに返す空の配列. 毎回新しい [] を返すとストアが変わったと見なされ, 描き直しが止まらない
const NONE: never[] = []

function Frame({ id, title, wide, children }: { id: Exclude<Modal, null>; title: string; wide?: boolean; children: ReactNode }) {
  const open = useUi(u => u.modal === id)
  const close = useUi(u => u.close)
  if (!open) return null
  return (
    <div
      className="modal open"
      id={id}
      onClick={e => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className={`card${wide ? ' wide' : ''}`}>
        <h2>
          {title}{' '}
          <button onClick={close} aria-label={trNow('ui.close')}>
            ×
          </button>
        </h2>
        {children}
      </div>
    </div>
  )
}

export function Modals() {
  const { tr } = useTr()
  return (
    <>
      <Frame id="shop" title={tr('ui.modal.shop')}>
        <Shop />
      </Frame>
      <Frame id="wires" title={tr('ui.modal.wires')} wide>
        <div className="legend">{tr('ui.modal.wires_legend')}</div>
        <Wires />
      </Frame>
      <Frame id="guide" title={tr('ui.modal.guide')} wide>
        <Guide />
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
  if (!shop.length) return <div className="item">{tr('ui.modal.sold_out')}</div>
  return (
    <>
      {shop.map(it => (
        <div className="item" key={it.id}>
          <div>
            <div className="name">{tr(`shop.${it.id}.name`)}</div>
            <div className="d">{tr(`shop.${it.id}.desc`)}</div>
          </div>
          <button className="btn" disabled={money < it.price} onClick={() => send({ kind: 'buy', id: it.id })}>
            {it.price} G
          </button>
        </div>
      ))}
    </>
  )
}

function Achievements() {
  const { tr } = useTr()
  const achs = useFarm(s => s.state?.achievements ?? NONE)
  return (
    <div className="ach">
      {achs.map((a, i) => (
        <div key={i} className={a.done ? 'got' : ''}>
          <b>{tr(`achievement.${a.id}.name`)}</b>
          <span>{tr(`achievement.${a.id}.desc`)}</span>
        </div>
      ))}
    </div>
  )
}

function Node({ end: [n, k] }: { end: WireEnd }) {
  return <span className={`node ${k}`}>{k === 'cli' ? `CLI (${n})` : n}</span>
}

function WireRow({ w }: { w: Wire }) {
  const { tr, tm } = useTr()
  const dur = w.hz > 0.05 ? Math.max(0.15, 2 / w.hz) : 0
  // 農場が出しているのを誰も見ていないだけなら, 間違いではないので灰色にする
  const idle = !w.subs.length && w.pubs.every(([, k]) => k === 'farm')
  const dead = !idle && (!w.pubs.length || !w.subs.length || w.hz < 0.05)
  const rate = w.hz >= 0.05 ? tr('ui.wires.rate', { hz: w.hz.toFixed(w.hz < 10 ? 1 : 0), bytes: fmtBytes(w.bps) }) : tr('ui.wires.stopped')
  return (
    <div className="wire">
      <div className="ends l">
        {w.pubs.length ? w.pubs.map(e => <Node key={e.join()} end={e} />) : <span className="node none">{tr('ui.wires.no_pub')}</span>}
      </div>
      <div className={`mid${dead ? ' dead' : ''}`}>
        <svg>
          <line x1="0" y1="2" x2="100%" y2="2" style={{ animationDuration: `${dur}s` }} />
        </svg>
        <span className="pill2">
          {w.topic}
          <small>
            {w.type.split('/').pop()} ・ {rate}
          </small>
        </span>
      </div>
      <div className="ends r">
        {w.subs.length ? (
          w.subs.map(e => <Node key={e.join()} end={e} />)
        ) : idle ? (
          <span className="node tool">{tr('ui.wires.idle')}</span>
        ) : (
          <span className="node none">{tr('ui.wires.no_sub')}</span>
        )}
      </div>
      {w.warn && (
        <div className="warnline">
          {tm(w.warn)}
          {w.hint && (
            <>
              {' '}
              → <b>{tr('wire.hint', { topic: w.hint })}</b>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Wires() {
  const { tr } = useTr()
  const wires = useFarm(s => s.state?.wires ?? NONE)
  if (!wires.length) return <div className="legend">{tr('ui.wires.none')}</div>
  return (
    <div>
      {wires.map(w => (
        <WireRow key={w.topic} w={w} />
      ))}
    </div>
  )
}

function Guide() {
  const { tr, lang } = useTr()
  const id = useUi(u => u.guideId)
  const ws = useFarm(s => s.state?.workspace)
  const pkg = useFarm(s => s.state?.package)
  const [text, setText] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let live = true
    setText(null)
    if (id)
      void loadGuide(id).then(t => {
        if (live) setText(t)
      })
    return () => {
      live = false
    }
  }, [id])
  useEffect(() => {
    if (box.current) box.current.scrollTop = 0
  }, [text])
  // ターミナルに出る文 ({{msg:...}}) を英語の原文と訳にしてから描く. render() は文字を逃がしてから HTML を組むので, そのまま差し込んでよい
  const html = text
    ? render(
        expandMessages(substitute(text, ws, pkg), {
          original: (key, args) => trNow(key, args, 'en'),
          translated: lang === 'en' ? null : (key, args) => trNow(key, args, lang),
          label: tr('guide.translation'),
        }),
        { copy: tr('ui.copy') },
      )
    : ''
  return (
    <div
      id="guidebody"
      ref={box}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={e => {
        // コードブロックの「コピー」
        const b = e.target as HTMLElement
        if (b.tagName !== 'BUTTON' || !b.parentElement?.classList.contains('code')) return
        void navigator.clipboard?.writeText(b.nextElementSibling?.textContent ?? '')
        b.textContent = tr('ui.copied')
      }}
    />
  )
}

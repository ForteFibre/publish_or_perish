// お店, 配線図, 実績, 課題の説明の窓. 背景か × を押すと閉じる.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { render, substitute } from '@pop/guide'
import { useFarm, type Wire, type WireEnd } from '@pop/ros'
import { useUi, type Modal } from '../ui'
import { loadGuide } from './guide'
import { fmtBytes } from './text'

// 状態がまだないときに返す空の配列. 毎回新しい [] を返すとストアが変わったと見なされ, 描き直しが止まらない
const NONE: never[] = []

function Frame({ id, title, wide, children }: { id: Exclude<Modal, null>; title: string; wide?: boolean; children: ReactNode }) {
  const open = useUi(u => u.modal === id)
  const close = useUi(u => u.close)
  if (!open) return null
  return (
    <div className="modal open" id={id} onClick={e => { if (e.target === e.currentTarget) close() }}>
      <div className={`card${wide ? ' wide' : ''}`}>
        <h2>{title} <button onClick={close}>×</button></h2>
        {children}
      </div>
    </div>
  )
}

export function Modals() {
  return <>
    <Frame id="shop" title="お店"><Shop /></Frame>
    <Frame id="wires" title="配線図" wide>
      <div className="legend">送り手 → topic (頻度 ・ 1 秒あたりのデータ量) → 受け手。点線が流れる速さは頻度に比例する。</div>
      <Wires />
    </Frame>
    <Frame id="guide" title="説明" wide><Guide /></Frame>
    <Frame id="achs" title="実績"><Achievements /></Frame>
  </>
}

function Shop() {
  const shop = useFarm(s => s.state?.shop ?? NONE)
  const money = useFarm(s => s.state?.money ?? 0)
  const send = useFarm(s => s.send)
  if (!shop.length) return <div className="item">売り切れ</div>
  return <>{shop.map(it => (
    <div className="item" key={it.id}>
      <div><div className="name">{it.name}</div><div className="d">{it.desc}</div></div>
      <button className="btn" disabled={money < it.price} onClick={() => send({ kind: 'buy', id: it.id })}>{it.price} G</button>
    </div>
  ))}</>
}

function Achievements() {
  const achs = useFarm(s => s.state?.achievements ?? NONE)
  return <div className="ach">{achs.map((a, i) =>
    <div key={i} className={a.done ? 'got' : ''}><b>{a.name}</b><span>{a.desc}</span></div>)}</div>
}

function Node({ end: [n, k] }: { end: WireEnd }) {
  return <span className={`node ${k}`}>{k === 'cli' ? `CLI (${n})` : n}</span>
}

function WireRow({ w }: { w: Wire }) {
  const dur = w.hz > 0.05 ? Math.max(0.15, 2 / w.hz) : 0
  // 農場が出しているのを誰も見ていないだけなら, 間違いではないので灰色にする
  const idle = !w.subs.length && w.pubs.every(([, k]) => k === 'farm')
  const dead = !idle && (!w.pubs.length || !w.subs.length || w.hz < 0.05)
  const rate = w.hz >= 0.05 ? `${w.hz.toFixed(w.hz < 10 ? 1 : 0)} Hz ・ ${fmtBytes(w.bps)}/s` : '流れていない'
  return (
    <div className="wire">
      <div className="ends l">
        {w.pubs.length ? w.pubs.map(e => <Node key={e.join()} end={e} />) : <span className="node none">送り手なし</span>}
      </div>
      <div className={`mid${dead ? ' dead' : ''}`}>
        <svg><line x1="0" y1="2" x2="100%" y2="2" style={{ animationDuration: `${dur}s` }} /></svg>
        <span className="pill2">{w.topic}<small>{w.type.split('/').pop()} ・ {rate}</small></span>
      </div>
      <div className="ends r">
        {w.subs.length ? w.subs.map(e => <Node key={e.join()} end={e} />)
          : idle ? <span className="node tool">まだ誰も見ていない</span> : <span className="node none">受け手なし</span>}
      </div>
      {w.warn && <div className="warnline">{w.warn}{w.hint && <> → <b>{w.hint}</b></>}</div>}
    </div>
  )
}

function Wires() {
  const wires = useFarm(s => s.state?.wires ?? NONE)
  if (!wires.length) return <div className="legend">つながっている topic はまだない</div>
  return <div>{wires.map(w => <WireRow key={w.topic} w={w} />)}</div>
}

function Guide() {
  const id = useUi(u => u.guideId)
  const ws = useFarm(s => s.state?.workspace)
  const pkg = useFarm(s => s.state?.package)
  const [text, setText] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let live = true
    setText(null)
    if (id) void loadGuide(id).then(t => { if (live) setText(t) })
    return () => { live = false }
  }, [id])
  useEffect(() => { if (box.current) box.current.scrollTop = 0 }, [text])
  // render() は文字を逃がしてから HTML を組むので, そのまま差し込んでよい
  const html = text ? render(substitute(text, ws, pkg)) : ''
  return (
    <div id="guidebody" ref={box} dangerouslySetInnerHTML={{ __html: html }} onClick={e => {
      // コードブロックの「コピー」
      const b = e.target as HTMLElement
      if (b.tagName !== 'BUTTON' || !b.parentElement?.classList.contains('code')) return
      void navigator.clipboard?.writeText(b.nextElementSibling?.textContent ?? '')
      b.textContent = '済'
    }} />
  )
}

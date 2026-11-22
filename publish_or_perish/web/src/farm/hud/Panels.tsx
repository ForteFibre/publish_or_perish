// 画面の端の札 (レベルとお金, ROS の状態, ログ, 小窓の 1 行, ボタン) と, その上に重なるもの (通知, マスの情報, 接続待ち).
import { useEffect, useRef, useState } from 'react'
import { useFarm } from '@pop/ros'
import { soundOn, toggleSound } from '../sfx'
import { useUi } from '../ui'
import { CROP_NAME, mode, pct } from './text'

export function Status() {
  const s = useFarm(st => st.state)
  const money = s?.money ?? 0
  // お金が変わったら跳ねる (最初に届いたときは跳ねない)
  const [bump, setBump] = useState(0)
  const prev = useRef<number | null>(null)
  useEffect(() => {
    if (prev.current !== null && prev.current !== money) setBump(b => b + 1)
    prev.current = s ? money : null
  }, [money, s])
  const span = s ? Math.max(1, s.next_xp - s.lv_xp) : 1
  return (
    <div id="status" className="card">
      <div id="lv">Lv<b>{s?.level ?? 1}</b></div>
      <div>
        <div id="title">{s?.title ?? '見習い農家'}</div>
        <div id="xpbar"><div id="xpfill" style={{ width: s ? `${Math.min(100, (s.xp - s.lv_xp) / span * 100)}%` : 0 }} /></div>
        <div id="xptext">{!s ? '0 / 100 XP' : s.next_xp > s.lv_xp ? `${s.xp} / ${s.next_xp} XP` : `${s.xp} XP`}</div>
      </div>
      {/* key を変えて作り直し, CSS のアニメーションを最初から流す */}
      <div id="money" key={bump} className={bump ? 'bump' : ''}>
        <svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#f5c542" stroke="#c48a10" strokeWidth="2" /><text x="13" y="18" textAnchor="middle" fontSize="13" fontWeight="800" fill="#9a6400">G</text></svg>
        <span id="moneyv">{money.toLocaleString()}</span>
      </div>
    </div>
  )
}

export function RosCard() {
  const s = useFarm(st => st.state)
  const connected = useFarm(st => st.connected)
  const m = s ? mode(s) : null
  return (
    <div id="ros" className="card">
      <div className="row"><span className="k">接続</span><span className={`pill ${connected ? 'auto' : connected === null ? 'off' : 'bad'}`}>{connected ? '接続中' : connected === null ? '未接続' : '切断'}</span></div>
      <div className="row"><span className="k">運転</span><span className={`pill ${m?.cls ?? 'off'}`}>{m?.text ?? '停止中'}</span></div>
      <div className="row"><span className="k">あなたのノード</span><span className="mono">{s?.graph.players.length ? s.graph.players.join(', ') : 'なし'}</span></div>
      <div className="row"><span className="k">ロボット</span><span>{s ? s.bots.map(b => `${b.name} タンク ${b.tank}/${b.tank_max} ・ ${CROP_NAME[b.seed] ?? b.seed}`).join(' / ') : '-'}</span></div>
    </div>
  )
}

export function Log() {
  const log = useFarm(st => st.state?.log)
  if (!log?.length) return null
  return <div id="log">{log.slice(-8).map(l => <div key={l.id} className={l.ok ? '' : 'ng'}>{l.text}</div>)}</div>
}

/** 小窓の 1 行: まだ終わっていない最初の課題と, その進み具合. 点検でエラーがあればそれを先に出す */
export function Mini() {
  const s = useFarm(st => st.state)
  if (!s) return <div id="mini" className="card"><div className="mt"><div>-</div></div></div>
  const cur = s.stage?.missions.find(m => !m.done)
  const bad = s.doctor.find(f => f.level === 'error')
  const m = mode(s)
  const text = bad ? `点検: ${bad.title}` : cur && s.stage ? `${s.stage.title.split(':')[0]} ・ ${cur.title}` : s.stage ? s.stage.title : 'すべてクリア'
  return (
    <div id="mini" className={`card${bad ? ' bad' : ''}`}>
      <div className="mt"><div id="minitext">{text}</div><div className="bar"><i style={{ width: cur ? pct(cur.value, cur.goal) : '100%' }} /></div></div>
      <span className="gold">{s.money.toLocaleString()} G</span>
      <span className={`pill ${m.cls}`}>{m.short}</span>
      {s.wires.some(w => w.warn) && <span className="pill bad">配線 !</span>}
    </div>
  )
}

export function Buttons() {
  const speed = useFarm(st => st.state?.speed ?? 1)
  const warn = useFarm(st => st.state?.wires.some(w => w.warn) ?? false)
  const achs = useFarm(st => st.state?.achievements)
  const send = useFarm(st => st.send)
  const open = useUi(u => u.open)
  const [sound, setSound] = useState(soundOn())
  const next: Record<number, number> = { 1: 2, 2: 4, 4: 1 }
  return (
    <div id="buttons">
      <button className="btn" onClick={() => send({ kind: 'speed', value: next[speed] ?? 1 })}>時間 ×{speed}</button>
      <button className="btn" onClick={() => open('wires')}>配線 {warn && <span className="badge" style={{ background: '#e05244' }}>!</span>}</button>
      <button className="btn" onClick={() => open('shop')}>お店</button>
      <button className="btn" onClick={() => open('achs')}>実績 <span className="badge">{achs ? `${achs.filter(a => a.done).length}/${achs.length}` : 0}</span></button>
      <button className="btn" onClick={() => setSound(toggleSound())}>音: {sound ? '入' : '切'}</button>
    </div>
  )
}

export function Toasts() {
  const toasts = useUi(u => u.toasts)
  return <div id="toasts">{toasts.map(t => <div key={t.key} className={`toast ${t.kind}`}><b>{t.title}</b><span>{t.body}</span></div>)}</div>
}

export function Banner() {
  const b = useUi(u => u.banner)
  if (!b) return null
  return <div id="banner" className="show"><div><span>{b.body}</span><b>{b.title}</b></div></div>
}

export function Floats() {
  const floats = useUi(u => u.floats)
  return <>{floats.map(f => <div key={f.id} className="float" style={{ left: f.px, top: f.py, color: f.color }}>{f.text}</div>)}</>
}

/** マウスの下のマスの情報 */
export function TipBox() {
  const tip = useUi(u => u.tip)
  const s = useFarm(st => st.state)
  if (!tip || !s) return null
  const i = tip.y * s.w + tip.x
  const t = s.tiles[i]
  if (!t) return null
  const [moist, kind, growth, dead] = t
  const crop = kind ? `${CROP_NAME[kind] ?? kind} ${dead ? '(枯れた)' : growth >= 1 ? '(実った)' : `${Math.floor(growth * 100)}%`}` : 'なし'
  return (
    <div id="tip" className="card" style={{ display: 'block', left: tip.px + 16, top: tip.py + 12 }}>
      <b>マス ({tip.x}, {tip.y})</b><br />水分 {moist} ・ 作物 {crop}<br />
      <span className="mono">data[{tip.y} * {s.w} + {tip.x}] = data[{i}]</span>
    </div>
  )
}

export function Connect() {
  const connected = useFarm(st => st.connected)
  return (
    <div id="connect" className={connected ? 'hide' : ''}><div className="card">
      <b>農場に接続しています…</b><br />
      ターミナルで次を起動してください。<br />
      <code>ros2 launch publish_or_perish farm.launch.xml</code><br />
      <span style={{ fontSize: 12, color: '#5d6b5a' }}>rosbridge (ポート 9090) につながると自動で始まります。</span>
    </div></div>
  )
}

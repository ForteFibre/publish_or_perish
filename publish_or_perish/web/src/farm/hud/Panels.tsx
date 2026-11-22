// 画面の端の札 (レベルとお金, ROS の状態, ログ, 小窓の 1 行, ボタン) と, その上に重なるもの (通知, マスの情報, 接続待ち).
import { useEffect, useRef, useState } from 'react'
import { useTr } from '@pop/i18n'
import { useFarm, type LogLine } from '@pop/ros'
import { soundOn, toggleSound } from '../sfx'
import { useUi } from '../ui'
import { cropName, missionText, mode, pct, stageTitle } from './text'

export function Status() {
  const { tr } = useTr()
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
      <div id="lv">{tr('ui.status.lv')}<b>{s?.level ?? 1}</b></div>
      <div>
        <div id="title">{tr(`title.${s?.level ?? 1}`)}</div>
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
  const { tr } = useTr()
  const s = useFarm(st => st.state)
  const connected = useFarm(st => st.connected)
  const m = s ? mode(s) : null
  const conn = connected ? ['auto', 'ui.ros.connected'] : connected === null ? ['off', 'ui.ros.never'] : ['bad', 'ui.ros.disconnected']
  return (
    <div id="ros" className="card">
      <div className="row"><span className="k">{tr('ui.ros.conn')}</span><span className={`pill ${conn[0]}`}>{tr(conn[1] as string)}</span></div>
      <div className="row"><span className="k">{tr('ui.ros.mode')}</span><span className={`pill ${m?.cls ?? 'off'}`}>{m?.text ?? tr('ui.mode.off')}</span></div>
      <div className="row"><span className="k">{tr('ui.ros.players')}</span><span className="mono">{s?.graph.players.length ? s.graph.players.join(', ') : tr('ui.ros.none')}</span></div>
      <div className="row"><span className="k">{tr('ui.ros.robots')}</span><span>{s ? s.bots.map(b =>
        tr('ui.ros.bot', { name: b.name, tank: String(b.tank), max: String(b.tank_max), seed: cropName(b.seed) })).join(' / ') : '-'}</span></div>
    </div>
  )
}

/** ログの 1 行. ターミナルにも出た結果は, 英語の原文 (ターミナルと同じ見た目) とその訳を並べる */
function LogRow({ l }: { l: LogLine }) {
  const { tm, lang } = useTr()
  if (!l.text) return <div className={l.ok ? '' : 'ng'}>{tm(l.msg)}</div>
  return (
    <div className={`cli${l.ok ? '' : ' ng'}`}>
      <span className="mono">{l.tag} → {l.text}</span>
      {lang !== 'en' && <span className="tr">{tm(l.msg)}</span>}
    </div>
  )
}

export function Log() {
  const log = useFarm(st => st.state?.log)
  if (!log?.length) return null
  return <div id="log">{log.slice(-8).map(l => <LogRow key={l.id} l={l} />)}</div>
}

/** 小窓の 1 行: まだ終わっていない最初の課題と, その進み具合. 点検でエラーがあればそれを先に出す */
export function Mini() {
  const { tr, tm } = useTr()
  const s = useFarm(st => st.state)
  if (!s) return <div id="mini" className="card"><div className="mt"><div>-</div></div></div>
  const cur = s.stage?.missions.find(m => !m.done)
  const bad = s.doctor.find(f => f.level === 'error')
  const m = mode(s)
  const stage = s.stage ? stageTitle(s.stage.id) : ''
  const text = bad ? tr('ui.doctor.mini', { title: tm(bad.title) })
    : cur ? `${stage.split(':')[0]} ・ ${missionText(cur, s).title}` : s.stage ? stage : tr('ui.mini.all_clear')
  return (
    <div id="mini" className={`card${bad ? ' bad' : ''}`}>
      <div className="mt"><div id="minitext">{text}</div><div className="bar"><i style={{ width: cur ? pct(cur.value, cur.goal) : '100%' }} /></div></div>
      <span className="gold">{s.money.toLocaleString()} G</span>
      <span className={`pill ${m.cls}`}>{m.short}</span>
      {s.wires.some(w => w.warn) && <span className="pill bad">{tr('ui.mini.wires')}</span>}
    </div>
  )
}

export function Buttons() {
  const { tr } = useTr()
  const speed = useFarm(st => st.state?.speed ?? 1)
  const warn = useFarm(st => st.state?.wires.some(w => w.warn) ?? false)
  const achs = useFarm(st => st.state?.achievements)
  const send = useFarm(st => st.send)
  const open = useUi(u => u.open)
  const [sound, setSound] = useState(soundOn())
  const next: Record<number, number> = { 1: 2, 2: 4, 4: 1 }
  return (
    <div id="buttons">
      <button className="btn" onClick={() => send({ kind: 'speed', value: next[speed] ?? 1 })}>{tr('ui.buttons.speed', { n: String(speed) })}</button>
      <button className="btn" onClick={() => open('wires')}>{tr('ui.buttons.wires')} {warn && <span className="badge" style={{ background: '#e05244' }}>!</span>}</button>
      <button className="btn" onClick={() => open('shop')}>{tr('ui.buttons.shop')}</button>
      <button className="btn" onClick={() => open('achs')}>{tr('ui.buttons.achievements')} <span className="badge">{achs ? `${achs.filter(a => a.done).length}/${achs.length}` : 0}</span></button>
      <button className="btn" onClick={() => setSound(toggleSound())}>{tr(sound ? 'ui.buttons.sound_on' : 'ui.buttons.sound_off')}</button>
    </div>
  )
}

export function Toasts() {
  const { tm } = useTr()
  const toasts = useUi(u => u.toasts)
  return <div id="toasts">{toasts.map(t => <div key={t.key} className={`toast ${t.kind}`}><b>{tm(t.title)}</b><span>{tm(t.body)}</span></div>)}</div>
}

export function Banner() {
  const { tm } = useTr()
  const b = useUi(u => u.banner)
  if (!b) return null
  return <div id="banner" className="show"><div><span>{tm(b.body)}</span><b>{tm(b.title)}</b></div></div>
}

export function Floats() {
  const floats = useUi(u => u.floats)
  return <>{floats.map(f => <div key={f.id} className="float" style={{ left: f.px, top: f.py, color: f.color }}>{f.text}</div>)}</>
}

/** マウスの下のマスの情報 */
export function TipBox() {
  const { tr } = useTr()
  const tip = useUi(u => u.tip)
  const s = useFarm(st => st.state)
  if (!tip || !s) return null
  const i = tip.y * s.w + tip.x
  const t = s.tiles[i]
  if (!t) return null
  const [moist, kind, growth, dead] = t
  const crop = !kind ? tr('ui.tip.no_crop') : dead ? tr('ui.tip.dead', { crop: cropName(kind) })
    : growth >= 1 ? tr('ui.tip.ripe', { crop: cropName(kind) }) : tr('ui.tip.growing', { crop: cropName(kind), pct: String(Math.floor(growth * 100)) })
  return (
    <div id="tip" className="card" style={{ display: 'block', left: tip.px + 16, top: tip.py + 12 }}>
      <b>{tr('ui.tip.tile', { x: String(tip.x), y: String(tip.y) })}</b><br />{tr('ui.tip.info', { moist: String(moist), crop })}<br />
      <span className="mono">data[{tip.y} * {s.w} + {tip.x}] = data[{i}]</span>
    </div>
  )
}

export function Connect() {
  const { tr } = useTr()
  const connected = useFarm(st => st.connected)
  return (
    <div id="connect" className={connected ? 'hide' : ''}><div className="card">
      <b>{tr('ui.connect.title')}</b><br />
      {tr('ui.connect.run')}<br />
      <code>ros2 launch publish_or_perish farm.launch.xml</code><br />
      <span style={{ fontSize: 12, color: '#5d6b5a' }}>{tr('ui.connect.note')}</span>
    </div></div>
  )
}

// 右: 課題のパネル (ステージの進み具合, 点検, 課題の一覧, 準備中のステージ).
import { useState } from 'react'
import { useFarm, type Finding, type Mission } from '@pop/ros'
import { inVSCode } from '../ui'
import { CopyButton } from './CopyButton'
import { openGuide, useHasGuide } from './guide'
import { pct } from './text'

export function Quest() {
  const s = useFarm(st => st.state)
  const [collapsed, setCollapsed] = useState(false)
  if (!s) return <div id="quest" className="card"><h2 id="stagetitle">-</h2></div>
  const total = s.stage_count + s.upcoming.length
  // 最初のまだ終わっていない課題だけを開いて, 説明とヒントを出す
  const openId = s.stage?.missions.find(m => !m.done)?.id
  return (
    <div id="quest" className={`card${collapsed ? ' collapsed' : ''}`}>
      <div id="stagebar">
        {Array.from({ length: total }, (_, i) =>
          <span key={i} className={i < s.stage_index ? 'done' : i === s.stage_index ? 'now' : ''} />)}
      </div>
      <h2 id="stagetitle" onClick={() => setCollapsed(c => !c)}>{s.stage?.title ?? '今あるステージをすべてクリアした'}</h2>
      <div className="lesson">{s.stage ? `対応する講習: ${s.stage.lesson}` : '次のステージを準備中'}</div>
      <Doctor findings={s.doctor} />
      <div id="missions">
        {s.stage?.missions.map(m => <MissionRow key={m.id} m={m} open={m.id === openId} />)}
      </div>
      <div id="upcoming">{s.upcoming.map(u => <div key={u}>準備中: {u}</div>)}</div>
    </div>
  )
}

function MissionRow({ m, open }: { m: Mission; open: boolean }) {
  const val = m.unit === 'm' ? m.value.toFixed(1) : Math.floor(m.value)
  return (
    <div className={`m${m.done ? ' done' : ''}${open ? ' open' : ''}`}>
      <div className="head">
        <span className="check">{m.done ? '✓' : ''}</span>
        <span className="t">{m.title}</span>
        <span className="reward">+{m.reward} G</span>
      </div>
      {(m.goal > 1 || m.unit) && <>
        <div className="bar"><i style={{ width: pct(m.value, m.goal) }} /></div>
        <div className="num">{val} / {m.goal} {m.unit}</div>
      </>}
      {open && <MissionDetail m={m} />}
    </div>
  )
}

function MissionDetail({ m }: { m: Mission }) {
  const hasGuide = useHasGuide(m.id)
  return <>
    <div className="desc">{m.desc}</div>
    <div className="hint mono"><span>{m.hint}</span><CopyButton text={m.hint} /></div>
    {hasGuide && <button className="gbtn" onClick={() => openGuide(m.id)}>説明を読む (書くものと, うまくいかないときの直し方)</button>}
  </>
}

const LEVEL_PREFIX: Record<Finding['level'], string> = { error: 'エラー: ', warn: '注意: ', info: '' }

/** 点検の結果. VSCode の拡張の中 (iframe) なら, ファイルを開くリンクを出す (親の画面に頼んで開いてもらう) */
function Doctor({ findings }: { findings: Finding[] }) {
  const home = findings.map(f => /^(\/home\/[^/]+)\//.exec(f.file)?.[1]).find(Boolean)
  return (
    <div id="doctor">
      {findings.map(f => (
        <div key={f.id + f.file + f.line} className={`dr ${f.level}`}>
          <b>{LEVEL_PREFIX[f.level] + f.title}</b>
          {f.file && <div className="where">
            {(home ? f.file.replace(home, '~') : f.file) + (f.line ? `:${f.line}` : '')}
            {inVSCode && <a onClick={() => window.parent.postMessage({ type: 'open', file: f.file, line: f.line }, '*')}>開く</a>}
          </div>}
          <div className="d">{f.detail}</div>
          {f.fix && <div className="hint mono"><span>{f.fix}</span><CopyButton text={f.fix} /></div>}
        </div>
      ))}
    </div>
  )
}

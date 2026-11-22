// 右: 課題の札 (ステージの帯, 点検, 課題の一覧, 準備中のステージ).
// 開いているのは, まだ終わっていない最初の課題だけ (説明, ヒント, 説明を読むボタンを出す).
import { useTr } from '@pop/i18n'
import { type FarmState, type Finding, type Mission, useFarm } from '@pop/ros'
import { Button, Card, CardTitle, CodeBlock, type DoctorItem, DoctorList, Icon, MissionRow, StageBar } from '@pop/ui'
import { useState } from 'react'
import { inVSCode } from '../ui'
import { openGuide, useHasGuide } from './guide'
import { useBump } from './Panels'
import { missionText, stageTitle } from './text'

/** 点検の結果を部品の形にする */
export function useDoctorItems(): DoctorItem[] {
  const { tm } = useTr()
  const doctor = useFarm(st => st.state?.doctor)
  return (doctor ?? []).map((f: Finding) => ({
    key: f.id + f.file + f.line,
    level: f.level === 'error' || f.level === 'warn' ? f.level : 'info',
    title: tm(f.title),
    file: f.file ? f.file + (f.line ? `:${f.line}` : '') : undefined,
    detail: tm(f.detail),
    fix: f.fix || undefined,
  }))
}

/** VSCode の拡張の中 (iframe) なら, 親の画面に頼んでファイルを開いてもらう */
const openFile = inVSCode
  ? (it: DoctorItem) => {
      const m = /^(.*?)(?::(\d+))?$/.exec(it.file ?? '')
      window.parent.postMessage({ type: 'open', file: m?.[1], line: m?.[2] ? Number(m[2]) : 0 }, '*')
    }
  : undefined

/** 点検 (エラーと注意の件数が増えたら, まとめの行の数字を跳ねさせる) */
export function Doctor({ className }: { className?: string }) {
  const items = useDoctorItems()
  const bump = useBump(items.filter(i => i.level !== 'info').length, true)
  return <DoctorList items={items} onOpen={openFile} bump={bump} className={className} />
}

/** 課題の進み具合. 目標が 1 で単位もない課題は出さない */
export function missionProgress(m: Mission, s: FarmState) {
  if (!(m.goal > 1 || m.unit)) return undefined
  const val = m.unit === 'm' ? m.value.toFixed(1) : String(Math.floor(m.value))
  return { value: m.value, goal: m.goal, caption: `${val} / ${m.goal} ${missionText(m, s).unit}` }
}

export function Quest() {
  const { tr } = useTr()
  const s = useFarm(st => st.state)
  const [collapsed, setCollapsed] = useState(false)
  const box =
    'absolute top-[128px] right-4 bottom-[68px] flex w-[368px] flex-col narrow:top-[104px] narrow:right-3 narrow:bottom-[60px] narrow:w-[288px] mini:hidden'
  if (!s)
    return (
      <Card className={`${box} bottom-auto`}>
        <CardTitle>-</CardTitle>
      </Card>
    )
  const total = s.stage_count + s.upcoming.length
  const openId = s.stage?.missions.find(m => !m.done)?.id
  return (
    // 中身が少なければ札は縮む (下の端は, ボタンの列の上 8px まで)
    <div className={`${box} pointer-events-none`}>
      <Card className="pointer-events-auto flex max-h-full min-h-0 flex-col gap-2 narrow:p-3">
        <StageBar
          index={s.stage_index}
          total={total}
          label={tr('ui.quest.stage_of', { n: String(s.stage_index + 1), total: String(total) })}
        />
        <button
          type="button"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(c => !c)}
          className="flex cursor-pointer items-start gap-1 text-left"
        >
          <CardTitle className="min-w-0 flex-1 narrow:text-lg">{s.stage ? stageTitle(s.stage.id) : tr('ui.quest.all_clear')}</CardTitle>
          {collapsed ? (
            <Icon.ChevronRight size={20} className="mt-0.5 shrink-0 text-ink-sub" aria-hidden />
          ) : (
            <Icon.ChevronDown size={20} className="mt-0.5 shrink-0 text-ink-sub" aria-hidden />
          )}
        </button>
        {!collapsed && (
          <div className="text-xs text-ink-sub">
            {s.stage ? tr('ui.quest.lesson', { lesson: tr(`stage.${s.stage.id}.lesson`) }) : tr('ui.quest.preparing')}
          </div>
        )}
        {/* 点検は課題の札の高さの半分まで. 越える分は点検の中で送る */}
        <Doctor className="max-h-[50%] shrink-0" />
        <div className="min-h-0 overflow-y-auto">
          {s.stage?.missions
            .filter(m => !collapsed || m.id === openId)
            .map(m => (
              <MissionRow key={m.id} title={missionText(m, s).title} reward={m.reward} done={!!m.done} progress={missionProgress(m, s)}>
                {m.id === openId && !collapsed && <MissionDetail m={m} s={s} />}
              </MissionRow>
            ))}
          {!collapsed && s.upcoming.length > 0 && (
            <div className="mt-2 flex flex-col gap-1 text-xs text-ink-faint">
              {s.upcoming.map(u => (
                <div key={u}>{tr('ui.quest.upcoming', { name: tr(`upcoming.${u}`) })}</div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function MissionDetail({ m, s }: { m: Mission; s: FarmState }) {
  const { tr } = useTr()
  const text = missionText(m, s)
  const hasGuide = useHasGuide(m.id)
  return (
    <>
      <p className="text-sm whitespace-pre-wrap">{text.desc}</p>
      <CodeBlock code={text.hint} />
      {hasGuide && (
        <Button size="sm" className="self-start" icon={<Icon.BookOpen size={16} aria-hidden />} onClick={() => openGuide(m.id)}>
          {tr('ui.quest.read_guide')}
        </Button>
      )}
    </>
  )
}

// 説明の面の中身. 課題の題と進み具合を頭に出し, 説明の Markdown を本文に描く.
// 説明を開いているあいだ, 課題の札は出さない (同じものを二か所に出さない). 点検は頭の Pill から開く.
// 課題を達成しても, 説明は勝手に次の課題へ切り替えない (読んでいる途中の説明が消えないように).
import { expandMessages, render, substitute } from '@pop/guide'
import { tr as trNow, useTr } from '@pop/i18n'
import { useFarm } from '@pop/ros'
import { Button, Coin, GuideHeader, GuidePane, Icon, Meter, Pill } from '@pop/ui'
import { type CSSProperties, useEffect, useState } from 'react'
import { closeGuide, loadGuide, openGuide, useHasGuide } from './guide'
import { Doctor, missionProgress, useDoctorItems } from './Quest'

export function GuideView({
  id,
  compact = false,
  className,
  style,
}: {
  id: string
  compact?: boolean
  className?: string
  style?: CSSProperties
}) {
  const { tr, lang } = useTr()
  const s = useFarm(st => st.state)
  const [text, setText] = useState<string | null>(null)
  const [doctorOpen, setDoctorOpen] = useState(false)
  useEffect(() => {
    let live = true
    setText(null)
    void loadGuide(id).then(t => {
      if (live) setText(t)
    })
    return () => {
      live = false
    }
  }, [id])

  // ターミナルに出る文 ({{msg:...}}) を英語の原文と訳にしてから描く
  const label = tr('guide.translation')
  const html = text
    ? render(
        expandMessages(substitute(text, s?.workspace, s?.package), {
          original: (key, args) => trNow(key, args, 'en'),
          translated: lang === 'en' ? null : (key, args) => trNow(key, args, lang),
          label,
        }),
        { copy: tr('ui.copy'), translation: label },
      )
    : ''

  const missions = s?.stage?.missions ?? []
  const m = missions.find(x => x.id === id)
  const next = missions.find(x => !x.done && x.id !== id)
  const hasNext = useHasGuide(next?.id ?? '')
  const doctor = useDoctorItems()
  const errors = doctor.filter(d => d.level === 'error').length
  const warns = doctor.filter(d => d.level === 'warn').length
  const progress = m && s ? missionProgress(m, s) : undefined

  return (
    <GuidePane
      className={className}
      style={style}
      memoryKey={id}
      html={html}
      header={
        <GuideHeader
          title={tr(`mission.${id}.title`)}
          aside={
            m && (
              <span className="inline-flex shrink-0 items-center gap-1 pt-0.5 font-display text-base font-bold text-gold-ink nums">
                <Coin size={14} />+{m.reward} G
              </span>
            )
          }
          actions={
            <Button size="sm" iconOnly aria-label={tr('ui.guide.close')} icon={<Icon.X size={16} aria-hidden />} onClick={closeGuide} />
          }
        >
          {!compact &&
            m &&
            (m.done ? (
              <div className="flex items-center gap-2">
                <Pill tone="player">
                  <Icon.Check size={12} aria-hidden />
                  {tr('ui.guide.cleared')}
                </Pill>
                {next && hasNext && (
                  <Button intent="primary" size="sm" icon={<Icon.ArrowRight size={16} aria-hidden />} onClick={() => openGuide(next.id)}>
                    {tr('ui.guide.next')}
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {progress && (
                  <>
                    <Meter value={progress.value} max={progress.goal} label={tr(`mission.${id}.title`)} className="flex-1" />
                    <span className="shrink-0 text-xs text-ink-sub nums">{progress.caption}</span>
                  </>
                )}
                {(errors > 0 || warns > 0) && (
                  <button
                    type="button"
                    aria-expanded={doctorOpen}
                    onClick={() => setDoctorOpen(o => !o)}
                    className="ml-auto flex cursor-pointer gap-1 rounded-full"
                  >
                    {errors > 0 && <Pill tone="danger">{tr('ui.doctor.errors', { n: String(errors) })}</Pill>}
                    {warns > 0 && <Pill tone="warning">{tr('ui.doctor.warns', { n: String(warns) })}</Pill>}
                  </button>
                )}
              </div>
            ))}
        </GuideHeader>
      }
      below={doctorOpen && doctor.length > 0 && <Doctor className="max-h-[40%] shrink-0 border-b-2 border-line px-5 py-3" />}
    />
  )
}

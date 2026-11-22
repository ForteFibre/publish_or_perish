// ログ. 畑の上に開いたターミナルとして見せる (紙の札ではないので, 枠と厚みを付けない).
// ターミナルにも出た結果は, 英語の原文 (等幅) とその下の訳 (ゴシック) の組で出す.
// 続けて同じ文が出たら 1 行にまとめて「×6」を添える. 失敗の行は 3 行まで折り返す (助言は文の後ろに来やすい).
import { useTr } from '@pop/i18n'
import { collapseRepeats } from './format'
import { X } from './icons'
import { Pill } from './Pill'

export type LogEntry = {
  id: number
  ok: boolean
  /** cli: ターミナルにも出た結果. notice: 画面にだけ出る知らせ. doctor: 点検の知らせ */
  kind: 'cli' | 'notice' | 'doctor'
  /** cli のとき, 何への返事か (service /bot1/water) */
  tag?: string
  /** cli のとき, 英語の原文 */
  original?: string
  /** 訳, または知らせの文 */
  text: string
}

const same = (a: LogEntry, b: LogEntry) =>
  a.kind === b.kind && a.ok === b.ok && a.tag === b.tag && a.original === b.original && a.text === b.text

export type LogPanelProps = {
  entries: readonly LogEntry[]
  /** 訳を出すか (英語の画面では出さない) */
  translate?: boolean
  /** 出す行の数 (広い画面で 8). 狭い画面では 3 行にする */
  max?: number
  className?: string
}

export function LogPanel({ entries, translate = true, max = 8, className }: LogPanelProps) {
  const { tr } = useTr()
  const rows = collapseRepeats(entries, same).slice(-max)
  if (!rows.length) return null
  return (
    <div
      role="log"
      className={`flex flex-col gap-1 rounded-md bg-term-hud px-3 py-2 text-term-text on-term narrow:[&>*:nth-last-child(n+4)]:hidden ${className ?? ''}`}
    >
      {rows.map(({ item: l, count }) => {
        const times = count > 1 && <span className="ml-2 font-mono text-2xs text-term-sub nums">×{count}</span>
        if (l.kind === 'cli') {
          const clamp = l.ok ? 'truncate' : 'line-clamp-3'
          return (
            <div key={l.id}>
              <div lang="en" className={`flex gap-1 font-mono text-xs ${l.ok ? '' : 'text-term-danger'}`}>
                {!l.ok && <X size={16} className="mt-px shrink-0" aria-label={tr('ui.log.failed')} />}
                <span className={`min-w-0 ${clamp}`}>
                  <span className="text-term-sub">{l.tag}</span> → <span className={l.ok ? 'text-term-text' : ''}>{l.original}</span>
                </span>
                {times}
              </div>
              {translate && (
                <div className={`pl-4 text-xs ${l.ok ? 'truncate text-term-sub' : 'line-clamp-3 text-term-danger-sub'}`}>{l.text}</div>
              )}
            </div>
          )
        }
        if (l.kind === 'doctor')
          return (
            <div key={l.id} className="flex items-center gap-2 text-sm text-term-danger">
              <Pill tone="danger">{tr('ui.doctor.label')}</Pill>
              <span className="min-w-0 truncate">{l.text}</span>
              {times}
            </div>
          )
        return (
          <div key={l.id} className={`flex text-sm ${l.ok ? '' : 'text-term-danger'}`}>
            <span className={`min-w-0 ${l.ok ? 'truncate' : 'line-clamp-3'}`}>{l.text}</span>
            {times}
          </div>
        )
      })}
    </div>
  )
}

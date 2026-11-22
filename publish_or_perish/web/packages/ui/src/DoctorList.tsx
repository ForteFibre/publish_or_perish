// 点検の札. 受講生のワークスペースの間違いを, 課題の札のいちばん上に出す.
// まとめの行 (見出しと件数) を出し, エラー, 注意, 情報の順に並べて 1 件だけを開く (残りは題の 1 行に畳む).
// 開いているのは常に 1 件にする. 新しい点検が出ても札は揺らさない.
import { Accordion } from '@base-ui/react/accordion'
import { useTr } from '@pop/i18n'
import { type ReactNode, useState } from 'react'
import { Button } from './Button'
import { CodeBlock } from './CodeBlock'
import { tv } from './cn'
import { shortPath } from './format'
import { ChevronRight, CircleX, FileCode, Info, Stethoscope, TriangleAlert } from './icons'
import { Pill } from './Pill'

export type DoctorLevel = 'error' | 'warn' | 'info'

export type DoctorItem = {
  /** 並びの中で変わらない名前 */
  key: string
  level: DoctorLevel
  title: string
  /** ファイルの場所 (行の番号を含めてよい). 長ければ末尾の 3 階層だけを出す */
  file?: string
  detail: string
  /** 直し方 (そのまま貼って動くもの) */
  fix?: string
}

const ORDER: Record<DoctorLevel, number> = { error: 0, warn: 1, info: 2 }

const item = tv({
  slots: {
    root: 'rounded-md border-l-4',
    icon: 'mt-0.5 shrink-0',
  },
  variants: {
    level: {
      error: { root: 'border-danger bg-danger-soft', icon: 'text-danger-ink' },
      warn: { root: 'border-warning bg-warning-soft', icon: 'text-warning-ink' },
      info: { root: 'border-info bg-info-soft', icon: 'text-info-ink' },
    },
  },
})

const ICON: Record<DoctorLevel, typeof CircleX> = { error: CircleX, warn: TriangleAlert, info: Info }

export type DoctorListProps = {
  items: readonly DoctorItem[]
  /** VSCode の中なら, ファイルを開くリンクを出す */
  onOpen?: (it: DoctorItem) => void
  /** まとめの行の Pill の数字だけを跳ねさせるための値 (件数が増えたら変える) */
  bump?: number
  className?: string
}

export function DoctorList({ items, onOpen, bump = 0, className }: DoctorListProps) {
  const { tr } = useTr()
  const sorted = [...items].sort((a, b) => ORDER[a.level] - ORDER[b.level])
  const [open, setOpen] = useState<string | null>(null)
  // 開いていたものが消えたら, いちばん上を開く
  const value = sorted.some(i => i.key === open) ? open : (sorted[0]?.key ?? null)
  if (!sorted.length) return null
  const errors = items.filter(i => i.level === 'error').length
  const warns = items.filter(i => i.level === 'warn').length
  return (
    <section className={`flex min-h-0 flex-col gap-2 ${className ?? ''}`}>
      <div className="flex items-center gap-2" aria-live="polite">
        <Stethoscope size={16} aria-hidden className="text-ink-sub" />
        <span className="font-display text-sm font-bold">{tr('ui.doctor.label')}</span>
        <span key={bump} className={`flex gap-1 ${bump ? 'animate-bump' : ''}`}>
          {errors > 0 && <Pill tone="danger">{tr('ui.doctor.errors', { n: String(errors) })}</Pill>}
          {warns > 0 && <Pill tone="warning">{tr('ui.doctor.warns', { n: String(warns) })}</Pill>}
        </span>
      </div>
      <Accordion.Root
        value={value ? [value] : []}
        onValueChange={v => {
          // 開いているものを押しても閉じない (常に 1 件は開いている)
          const next = v[0] as string | undefined
          if (next) setOpen(next)
        }}
        className="flex min-h-0 flex-col gap-1.5 overflow-y-auto"
      >
        {sorted.map(it => (
          <DoctorRow key={it.key} it={it} onOpen={onOpen} />
        ))}
      </Accordion.Root>
    </section>
  )
}

function DoctorRow({ it, onOpen }: { it: DoctorItem; onOpen?: (it: DoctorItem) => void }) {
  const { tr } = useTr()
  const s = item({ level: it.level })
  const Icon = ICON[it.level]
  const title = it.level === 'info' ? it.title : tr(`ui.doctor.${it.level}`, { title: it.title })
  return (
    <Accordion.Item value={it.key} className={s.root()}>
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left text-sm font-bold">
          <Icon size={16} className={s.icon()} aria-hidden />
          <span className="min-w-0 flex-1">{title}</span>
          <ChevronRight
            size={16}
            aria-hidden
            className="mt-0.5 shrink-0 text-ink-sub transition-transform duration-(--duration-base) group-data-panel-open:rotate-90"
          />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel className="flex flex-col gap-1.5 px-3 pb-2.5 pl-9">
        {it.file && <FileLine file={it.file} onOpen={onOpen && (() => onOpen(it))} />}
        <p className="text-sm whitespace-pre-wrap">{it.detail}</p>
        {it.fix && <CodeBlock code={it.fix} />}
      </Accordion.Panel>
    </Accordion.Item>
  )
}

function FileLine({ file, onOpen }: { file: string; onOpen?: () => void }): ReactNode {
  const { tr } = useTr()
  return (
    <div className="flex items-start gap-2">
      {/* 入らなければ / の後ろで折る (ファイルの名前と行の番号を切らない) */}
      <span className="min-w-0 font-mono text-xs text-ink-sub" title={file}>
        {shortPath(file)
          .split('/')
          .map((part, i, all) => (
            // 区切りの位置は変わらないので, 位置をキーにしてよい
            // biome-ignore lint/suspicious/noArrayIndexKey: 上のとおり
            <span key={i}>
              {part}
              {i < all.length - 1 && (
                <>
                  /<wbr />
                </>
              )}
            </span>
          ))}
      </span>
      {onOpen && (
        <Button intent="link" size="sm" icon={<FileCode size={16} aria-hidden />} onClick={onOpen}>
          {tr('ui.doctor.open')}
        </Button>
      )}
    </div>
  )
}

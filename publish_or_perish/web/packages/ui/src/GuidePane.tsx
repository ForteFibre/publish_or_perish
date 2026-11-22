// 説明の面. 「説明を読む」を押すと画面を左右に分け, 左に出す (畑は右に縮むが隠れない).
// 頭 (課題の題, 進み具合, 閉じる) は送っても上に残る. 頭の下の見出しの帯で, 読んでいる節が分かり, 押すとその節へ飛ぶ.
// 読んでいた場所と, 開いたヒントは説明ごとに覚える (ブラウザを閉じるまで).
// 本文は @pop/guide の render() が作った HTML (# が h2, ## が h3).
import { useTr } from '@pop/i18n'
import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export type Section = { id: string; label: string }

const store = {
  get(k: string): string | null {
    try {
      return sessionStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string) {
    try {
      sessionStorage.setItem(k, v)
    } catch {
      // 覚えられなくても読むのには困らない
    }
  },
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** 見出しの帯. 見出しが 2 個以下の短い説明では出さない */
export function SectionNav({
  sections,
  current,
  onSelect,
}: {
  sections: Section[]
  current: string | null
  onSelect: (id: string) => void
}) {
  const { tr } = useTr()
  const box = useRef<HTMLElement>(null)
  // 今の節の札が帯の外にあれば, 帯を横に送って見せる
  useEffect(() => {
    if (current) box.current?.querySelector<HTMLElement>(`[data-id="${current}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [current])
  if (sections.length <= 2) return null
  return (
    <nav
      ref={box}
      aria-label={tr('ui.guide.sections')}
      className="flex h-10 shrink-0 items-center gap-1.5 overflow-x-auto border-b-2 border-line px-5"
    >
      {sections.map(s => (
        <button
          key={s.id}
          data-id={s.id}
          type="button"
          aria-current={s.id === current ? 'location' : undefined}
          onClick={() => onSelect(s.id)}
          className="h-6 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-surface-sunken px-3 font-display text-xs font-bold whitespace-nowrap text-ink-sub aria-[current]:border-gold aria-[current]:bg-gold-soft aria-[current]:text-gold-ink"
        >
          {s.label}
        </button>
      ))}
    </nav>
  )
}

export type GuidePaneProps = {
  /** 頭 (GuideHeader). 送っても上に残る */
  header: ReactNode
  /** 頭の下, 見出しの帯の上に開くもの (点検の札) */
  below?: ReactNode
  /** render() が作った HTML */
  html: string
  /** 読んでいた場所を覚える名前 (課題の id) */
  memoryKey: string
  className?: string
}

export function GuidePane({ header, below, html, memoryKey, className }: GuidePaneProps) {
  const { tr } = useTr()
  const scroller = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [sections, setSections] = useState<Section[]>([])
  const [current, setCurrent] = useState<string | null>(null)

  const spy = useCallback(() => {
    const sc = scroller.current
    if (!sc) return
    const top = sc.getBoundingClientRect().top + 24
    const hs = [...sc.querySelectorAll<HTMLElement>('h3[id]')]
    let cur = hs[0]?.id ?? null
    for (const h of hs) if (h.getBoundingClientRect().top <= top) cur = h.id
    // 送り切ったときは, 最後の節を今の節にする
    if (sc.scrollHeight > sc.clientHeight && sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2) cur = hs.at(-1)?.id ?? cur
    setCurrent(cur)
  }, [])

  // 本文が替わったら, 見出しに名前を付け, 読んでいた場所と開いたヒントを戻す
  // biome-ignore lint/correctness/useExhaustiveDependencies: html は中で読まないが, 替わると DOM の中身が替わる
  useLayoutEffect(() => {
    const sc = scroller.current
    const b = body.current
    if (!sc || !b) return
    const hs = [...b.querySelectorAll<HTMLElement>('h3')]
    hs.forEach((h, i) => {
      h.id = `guide-sec-${i}`
    })
    setSections(hs.map(h => ({ id: h.id, label: h.textContent ?? '' })))
    const open = (store.get(`guide-details:${memoryKey}`) ?? '').split(',').filter(Boolean).map(Number)
    b.querySelectorAll('details').forEach((d, i) => {
      d.open = open.includes(i)
    })
    sc.scrollTop = Number(store.get(`guide-scroll:${memoryKey}`) ?? 0)
    spy()
  }, [html, memoryKey, spy])

  // 開いたヒントを覚える. toggle は親へ伝わらないので, 捕まえる側 (capture) で聞く
  useEffect(() => {
    const b = body.current
    if (!b) return
    const onToggle = () => {
      const open: number[] = []
      b.querySelectorAll('details').forEach((d, i) => {
        if (d.open) open.push(i)
      })
      store.set(`guide-details:${memoryKey}`, open.join(','))
    }
    // コードブロックの「コピー」(本文の中のボタン). 押すと「済」にし, 1.5 秒で戻す
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest('button')
      if (!btn?.parentElement?.classList.contains('code')) return
      void navigator.clipboard?.writeText(btn.nextElementSibling?.textContent ?? '')
      btn.textContent = tr('ui.copied')
      setTimeout(() => {
        btn.textContent = tr('ui.copy')
      }, 1500)
    }
    b.addEventListener('toggle', onToggle, true)
    b.addEventListener('click', onClick)
    return () => {
      b.removeEventListener('toggle', onToggle, true)
      b.removeEventListener('click', onClick)
    }
  }, [memoryKey, tr])

  const onScroll = () => {
    store.set(`guide-scroll:${memoryKey}`, String(Math.round(scroller.current?.scrollTop ?? 0)))
    spy()
  }

  const select = (id: string) => {
    const sc = scroller.current
    const h = sc?.querySelector<HTMLElement>(`#${id}`)
    if (!sc || !h) return
    sc.scrollTo({ top: h.offsetTop - 8, behavior: reduced() ? 'auto' : 'smooth' })
  }

  return (
    <section aria-label={tr('ui.guide.label')} className={`flex min-h-0 min-w-0 flex-col bg-surface ${className ?? ''}`}>
      {header}
      {below}
      <SectionNav sections={sections} current={current} onSelect={select} />
      <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div
          ref={body}
          className="guide-prose"
          // render() は文字を逃がしてから HTML を組むので, そのまま差し込んでよい
          // biome-ignore lint/security/noDangerouslySetInnerHtml: 上のとおり
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </section>
  )
}

export type GuideHeaderProps = {
  title: string
  /** 題の右 (報酬) */
  aside?: ReactNode
  /** 右の端のボタン (別のタブで開く, 閉じる) */
  actions: ReactNode
  /** 2 段目 (課題のメーター, 点検の件数, 達成したときの「次の課題の説明へ」). 小さい窓では出さない */
  children?: ReactNode
}

/** 説明の面の頭. 1 段目に題とボタン, 2 段目に進み具合 */
export function GuideHeader({ title, aside, actions, children }: GuideHeaderProps) {
  return (
    <header className="flex shrink-0 flex-col gap-2 border-b-2 border-line px-5 pt-4 pb-3">
      <div className="flex items-start gap-3">
        <h2 className="min-w-0 flex-1 font-display text-xl font-bold">{title}</h2>
        {aside}
        <div className="flex shrink-0 gap-1.5">{actions}</div>
      </div>
      {children}
    </header>
  )
}

// コードブロック (受講生がターミナルに打つコマンドか, ファイルに書くコード) と, 文中のコード.
// 畑の上の札の中 (wrap) では, どこででも折り返して全体を見せる. 説明の面の中 (scroll) では折り返さず横に送る.
import { useTr } from '@pop/i18n'
import { type ComponentProps, useEffect, useState } from 'react'
import { Button } from './Button'
import { Check, Copy } from './icons'

/** 押すとクリップボードに写して「済」にし, 1.5 秒で戻す */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const { tr } = useTr()
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 1500)
    return () => clearTimeout(t)
  }, [done])
  return (
    <Button
      intent="onTerm"
      size="sm"
      className={className}
      icon={done ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setDone(true)
      }}
    >
      {done ? tr('ui.copied') : tr('ui.copy')}
    </Button>
  )
}

export function CodeBlock({ code, wrap = 'wrap', className }: { code: string; wrap?: 'wrap' | 'scroll'; className?: string }) {
  return (
    <div className={`relative on-term ${className ?? ''}`}>
      <pre
        className={`rounded-sm bg-term py-2 pr-24 pl-3 font-mono leading-[1.5] text-term-text ${
          wrap === 'wrap' ? 'text-xs break-words whitespace-pre-wrap [overflow-wrap:anywhere]' : 'overflow-x-auto text-sm'
        }`}
      >
        <code>{code}</code>
      </pre>
      {/* ボタン自体は relative なので, 置き場所は外の箱で決める */}
      <span className="absolute top-1.5 right-1.5">
        <CopyButton text={code} />
      </span>
    </div>
  )
}

export function InlineCode({ className, ...rest }: ComponentProps<'code'>) {
  return <code className={`rounded-xs bg-surface-sunken px-1 text-[0.9em] ${className ?? ''}`} {...rest} />
}

/** ターミナルの出力. 英語の原文 (暗い地) のすぐ下に訳をつなげ, 一つの部品に見せる. コピーのボタンは付けない */
export function TermOutput({ original, translation }: { original: string; translation?: string | null }) {
  const { tr } = useTr()
  return (
    <div>
      <pre
        lang="en"
        className={`overflow-x-auto bg-term px-3 py-2 font-mono text-sm leading-[1.5] text-term-text ${translation ? 'rounded-t-sm' : 'rounded-sm'}`}
      >
        {original}
      </pre>
      {translation && (
        <div className="rounded-b-sm bg-surface-sunken px-3 py-1.5 text-xs text-ink-sub">
          <span className="mr-2 inline-block rounded-full bg-neutral-soft px-2 font-display font-bold">{tr('guide.translation')}</span>
          {translation}
        </div>
      )}
    </div>
  )
}

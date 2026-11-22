import { useState } from 'react'
import { useTr } from '@pop/i18n'

/** 押すとクリップボードに写して「済」にする */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const { tr } = useTr()
  const [done, setDone] = useState(false)
  return (
    <button className={className} onClick={() => { void navigator.clipboard?.writeText(text); setDone(true) }}>
      {done ? tr('ui.copied') : tr('ui.copy')}
    </button>
  )
}

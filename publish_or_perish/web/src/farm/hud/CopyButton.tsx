import { useTr } from '@pop/i18n'
import { useState } from 'react'

/** 押すとクリップボードに写して「済」にする */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const { tr } = useTr()
  const [done, setDone] = useState(false)
  return (
    <button
      className={className}
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setDone(true)
      }}
    >
      {done ? tr('ui.copied') : tr('ui.copy')}
    </button>
  )
}

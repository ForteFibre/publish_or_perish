import { useState } from 'react'

/** 押すとクリップボードに写して「済」にする */
export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button className={className} onClick={() => { void navigator.clipboard?.writeText(text); setDone(true) }}>
      {done ? '済' : 'コピー'}
    </button>
  )
}

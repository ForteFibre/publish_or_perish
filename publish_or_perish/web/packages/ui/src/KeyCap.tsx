// キーの札. 大会モードの操作の表で, キーボードのキーを指すときだけに使う (コードには InlineCode を使う).
import type { ReactNode } from 'react'

export function KeyCap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-6 min-w-6 place-items-center rounded-xs border-2 border-edge bg-white px-1 font-mono text-xs font-bold shadow-lip-sm">
      {children}
    </kbd>
  )
}

// 通知. 画面の上の中央に, 8px のあいだで縦に積む (同時に 3 件まで). 4.2 秒で消え, ホバーかフォーカスのあいだは消さない.
// 種類 (課題, ステージ, 実績) は枠の色とアイコンの両方で分ける.
// どこからでも notify() で出せる (Base UI の Toast の manager を 1 つだけ作る).
import { Toast } from '@base-ui/react/toast'
import type { ReactNode } from 'react'
import { Coin } from './Coin'
import { tv } from './cn'
import { Flag, Medal } from './icons'

export type ToastKind = 'mission' | 'stage' | 'achievement' | 'level'

const manager = Toast.createToastManager()

/** 通知を出す */
export function notify(t: { kind: ToastKind; title: string; body: string }) {
  manager.add({ title: t.title, description: t.body, type: t.kind, timeout: 4200 })
}

const toast = tv({
  base: [
    'flex w-max max-w-[min(480px,92vw)] items-center gap-3 rounded-lg border-2 bg-surface px-6 py-3 text-ink shadow-pop',
    'animate-toast-in transition-opacity duration-(--duration-fast) data-ending-style:opacity-0 data-limited:hidden',
    'vp-mini:px-3 vp-mini:py-1.5',
  ],
  variants: {
    kind: {
      mission: 'border-gold',
      level: 'border-gold',
      stage: 'border-success',
      achievement: 'border-special',
    },
  },
})

const ICON: Record<ToastKind, ReactNode> = {
  mission: <Coin size={24} />,
  level: <Coin size={24} />,
  stage: <Flag size={24} className="shrink-0 text-success-ink" aria-hidden />,
  achievement: <Medal size={24} className="shrink-0 text-special-ink" aria-hidden />,
}

function List() {
  const { toasts } = Toast.useToastManager()
  return toasts.map(t => {
    const kind = (t.type ?? 'mission') as ToastKind
    return (
      <Toast.Root key={t.id} toast={t} swipeDirection="up" className={toast({ kind })}>
        {ICON[kind]}
        <Toast.Content className="min-w-0">
          <Toast.Title className="font-display text-lg font-bold vp-mini:text-sm" />
          <Toast.Description className="text-sm text-ink-sub vp-mini:text-xs" />
        </Toast.Content>
      </Toast.Root>
    )
  })
}

/** 通知を出す場所. 画面に 1 つ置く */
export function ToastRegion({ children }: { children?: ReactNode }) {
  return (
    <Toast.Provider toastManager={manager} limit={3} timeout={4200}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="pointer-events-none fixed top-4 left-1/2 z-(--z-toast) flex -translate-x-1/2 flex-col items-center gap-2 *:pointer-events-auto vp-mini:top-12">
          <List />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  )
}

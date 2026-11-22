// 窓. 幕を引いて画面の中央に出す (お店, 実績, 配線図). 説明には使わない (説明の面を使う).
// Esc, 幕のクリック, 閉じるボタンで閉じる. 開いているあいだフォーカスは窓の中を回り, 閉じたら開いたボタンに戻る.
import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { useTr } from '@pop/i18n'
import type { ReactNode } from 'react'
import { Button } from './Button'
import { tv } from './cn'
import { X } from './icons'

const dialog = tv({
  slots: {
    backdrop:
      'fixed inset-0 z-(--z-modal) bg-scrim transition-opacity duration-(--duration-base) ease-out data-ending-style:opacity-0 data-ending-style:duration-(--duration-fast) data-starting-style:opacity-0',
    popup: [
      'fixed top-1/2 left-1/2 z-(--z-modal) flex max-h-[80vh] max-w-[92vw] -translate-1/2 flex-col',
      'rounded-lg border-2 border-edge bg-surface text-ink shadow-overlay',
      'transition-[opacity,scale] duration-(--duration-base) ease-out data-starting-style:scale-96 data-starting-style:opacity-0',
      'data-ending-style:opacity-0 data-ending-style:duration-(--duration-fast) motion-reduce:data-starting-style:scale-100',
      'vp-mini:max-h-[calc(100vh-16px)] vp-mini:w-[calc(100vw-16px)] vp-mini:max-w-none',
    ],
    head: 'flex shrink-0 items-start justify-between gap-3 px-5 pt-4 pb-3 vp-mini:px-3 vp-mini:pt-2',
    title: 'font-display text-xl font-bold',
    body: 'min-h-0 overflow-y-auto px-5 pb-5 vp-mini:px-3 vp-mini:pb-3',
  },
  variants: {
    size: { md: { popup: 'w-[560px]' }, lg: { popup: 'w-[860px]' } },
  },
  defaultVariants: { size: 'md' },
})

export type DialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  /** md: 560px (お店, 実績), lg: 860px (配線図) */
  size?: 'md' | 'lg'
  children: ReactNode
}

export function Dialog({ open, onOpenChange, title, size, children }: DialogProps) {
  const { tr } = useTr()
  const s = dialog({ size })
  return (
    <BaseDialog.Root open={open} onOpenChange={o => onOpenChange(o)}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={s.backdrop()} />
        <BaseDialog.Popup className={s.popup()}>
          <div className={s.head()}>
            <BaseDialog.Title className={s.title()}>{title}</BaseDialog.Title>
            <BaseDialog.Close render={<Button size="sm" iconOnly aria-label={tr('ui.close')} icon={<X size={16} aria-hidden />} />} />
          </div>
          <div className={s.body()}>{children}</div>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}

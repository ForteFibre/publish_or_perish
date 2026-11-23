// 入力欄. 見出しを欄の上に置き, プレースホルダーを見出しの代わりにしない.
// 誤りがあれば枠を danger にし, 欄の下に理由を出す. コマンドや topic の名前を入れる欄は等幅 (mono).
import { Field } from '@base-ui/react/field'
import { Input } from '@base-ui/react/input'
import type { ComponentProps } from 'react'

export type TextFieldProps = Omit<ComponentProps<typeof Input>, 'className'> & { label: string; error?: string; mono?: boolean }

export function TextField({ label, error, mono, disabled, ...rest }: TextFieldProps) {
  return (
    <Field.Root invalid={!!error} disabled={disabled} className="flex flex-col gap-1">
      <Field.Label className="text-xs text-ink-sub">{label}</Field.Label>
      <Input
        className={`h-9 rounded-sm border-2 border-control bg-white px-3 text-base text-ink data-disabled:bg-surface-sunken data-invalid:border-danger ${mono ? 'font-mono' : ''}`}
        {...rest}
      />
      <Field.Error match={!!error} className="text-xs text-danger-ink">
        {error}
      </Field.Error>
    </Field.Root>
  )
}

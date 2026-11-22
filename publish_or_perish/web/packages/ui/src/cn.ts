// 変種 (tailwind-variants) とクラスのつなぎ.
// tailwind-merge は使わない (lite 版). このガイドの名前 (text-2xs と text-ink など) を tailwind-merge が
// 同じ種類と見なして片方を消すことがあるため. 変種は, 同じ性質のクラスが重ならないように書く.
export { cx, tv, type VariantProps } from 'tailwind-variants/lite'

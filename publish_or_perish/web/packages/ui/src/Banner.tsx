// 帯. レベルアップとステージの達成を, 画面の中央で知らせる (2.6 秒で消える).
// マウスもキーも受けない (畑の操作を止めない).
export function Banner({ title, body }: { title: string; body: string }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-(--z-banner) grid place-items-center" aria-live="polite">
      <div className="animate-banner-in rounded-xl border-2 border-gold-ink bg-linear-160 from-gold-bright to-gold px-16 py-6 text-center text-on-gold shadow-overlay vp-mini:px-8 vp-mini:py-3">
        <div className="text-lg">{body}</div>
        <div className="font-display text-4xl font-bold vp-mini:text-3xl">{title}</div>
      </div>
    </div>
  )
}

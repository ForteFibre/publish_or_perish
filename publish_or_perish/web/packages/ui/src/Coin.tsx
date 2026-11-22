// コインとレベルのメダル. 画面の顔なので, lucide の線の絵ではなく自前の絵にする.

/** 金の丸に G */
export function Coin({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" className={`shrink-0 ${className ?? ''}`} aria-hidden>
      <circle cx="13" cy="13" r="11" fill="#f5c542" stroke="#c48a10" strokeWidth="2" />
      <text x="13" y="17.5" textAnchor="middle" fontSize="13" fontWeight="700" fill="#8a5600" fontFamily="var(--font-display)">
        G
      </text>
    </svg>
  )
}

/** レベルのメダル. 広い画面で 58px, 狭い画面で 44px */
export function LevelMedal({ level, label = 'Lv', className }: { level: number; label?: string; className?: string }) {
  return (
    <div
      className={`grid size-14.5 shrink-0 place-items-center rounded-full bg-linear-160 from-gold-bright to-gold text-center font-display leading-none font-bold text-on-gold inset-shadow-medal narrow:size-11 ${className ?? ''}`}
    >
      <div>
        <div className="text-xs narrow:text-2xs">{label}</div>
        <div className="text-3xl nums narrow:text-xl">{level}</div>
      </div>
    </div>
  )
}

/** お金. コインと太い数字. 増えたら跳ねる (bump を変えるたびに 1 回) */
export function Money({ value, bump = 0, size = 'lg' }: { value: number; bump?: number; size?: 'lg' | 'sm' }) {
  return (
    <span
      key={bump}
      className={`inline-flex items-center gap-2 font-display font-bold nums ${bump ? 'animate-bump' : ''} ${
        size === 'lg' ? 'text-3xl narrow:text-2xl' : 'text-sm text-gold-ink'
      }`}
    >
      <Coin size={size === 'lg' ? 26 : 14} />
      {value.toLocaleString()}
      {size === 'sm' && ' G'}
    </span>
  )
}

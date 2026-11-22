// 畑の面の札 (レベルとお金, ROS の状態, ログ, 小さい窓の 1 行, ボタンの列) と, 畑の上に重なるもの
// (帯, 浮かぶ文字, マスの情報, 接続待ち). 札は畑の面の大きさで畳む (narrow: と mini:).
import { type Msg, tm, useTr } from '@pop/i18n'
import { type FarmState, type LogLine, useFarm } from '@pop/ros'
import {
  Banner as BannerView,
  Button,
  Card,
  CodeBlock,
  FloatingCard,
  Icon,
  LevelMedal,
  type LogEntry,
  LogPanel,
  Menu,
  Meter,
  Money,
  Pill,
  ToggleButton,
  ToggleGroup,
  Tooltip,
} from '@pop/ui'
import { useEffect, useRef, useState } from 'react'
import { soundOn, toggleSound } from '../sfx'
import { useUi } from '../ui'
import { closeGuide, openGuide, useHasGuide } from './guide'
import { cropName, missionText, mode, stageTitle } from './text'

/** 値が変わるたびに増える数 (最初に届いたときは増やさない). key に使って, 跳ねる動きを最初から流す */
export function useBump(value: unknown, ready: boolean): number {
  const [bump, setBump] = useState(0)
  const prev = useRef<unknown>(null)
  useEffect(() => {
    if (prev.current !== null && prev.current !== value) setBump(b => b + 1)
    prev.current = ready ? value : null
  }, [value, ready])
  return bump
}

/** 左上: レベル, 称号, XP, お金 */
export function Status() {
  const { tr } = useTr()
  const s = useFarm(st => st.state)
  const money = s?.money ?? 0
  const bump = useBump(money, !!s)
  const level = s?.level ?? 1
  const span = s ? Math.max(1, s.next_xp - s.lv_xp) : 1
  const xp = s ? s.xp - s.lv_xp : 0
  return (
    <Card className="absolute top-4 left-4 flex items-center gap-4 px-4 py-3 narrow:top-3 narrow:left-3 narrow:gap-3 narrow:px-3 narrow:py-2 mini:hidden">
      <LevelMedal level={level} label={tr('ui.status.lv')} />
      <div className="w-45 narrow:w-28">
        <div className="font-display text-lg font-bold narrow:text-sm">{tr(`title.${level}`)}</div>
        <Meter
          tone="xp"
          size="xp"
          value={Math.min(xp, span)}
          max={span}
          label="XP"
          className="mt-1"
          caption={<span className="text-2xs">{!s ? '0 / 100 XP' : s.next_xp > s.lv_xp ? `${s.xp} / ${s.next_xp} XP` : `${s.xp} XP`}</span>}
        />
      </div>
      <div className="border-l-2 border-line pl-3">
        <Money value={money} bump={bump} />
      </div>
    </Card>
  )
}

/** 右上: ROS の状態. 課題の札のすぐ上に置き,「なぜ進まないか」を上から順に読めるようにする */
export function RosCard() {
  const { tr } = useTr()
  const s = useFarm(st => st.state)
  const connected = useFarm(st => st.connected)
  const m = s ? mode(s) : null
  const conn = connected
    ? { tone: 'player' as const, icon: <Icon.Plug size={12} aria-hidden />, text: tr('ui.ros.connected') }
    : connected === null
      ? { tone: 'neutral' as const, icon: <Icon.Unplug size={12} aria-hidden />, text: tr('ui.ros.never') }
      : { tone: 'danger' as const, icon: <Icon.Unplug size={12} aria-hidden />, text: tr('ui.ros.disconnected') }
  const row = 'flex items-center justify-between gap-3 py-0.5'
  return (
    <Card className="absolute top-4 right-4 min-w-[250px] px-4 py-2.5 text-sm narrow:top-3 narrow:right-3 narrow:min-w-0 narrow:px-3 narrow:py-2 narrow:text-xs mini:hidden">
      <div className={row}>
        <span className="text-ink-sub">{tr('ui.ros.conn')}</span>
        <Pill tone={conn.tone}>
          {conn.icon}
          {conn.text}
        </Pill>
      </div>
      <div className={row}>
        <span className="text-ink-sub">{tr('ui.ros.mode')}</span>
        <Pill tone={m?.tone ?? 'neutral'} live={m?.live}>
          {m?.tone === 'cli' && <Icon.SquareTerminal size={12} aria-hidden />}
          {m?.text ?? tr('ui.mode.off')}
        </Pill>
      </div>
      <div className={row}>
        <span className="text-ink-sub">{tr('ui.ros.players')}</span>
        <span className="truncate font-mono text-xs">{s?.graph.players.length ? s.graph.players.join(', ') : tr('ui.ros.none')}</span>
      </div>
      <div className={`${row} narrow:hidden`}>
        <span className="flex items-center gap-1 text-ink-sub">
          <Icon.Bot size={16} aria-hidden />
          {tr('ui.ros.robots')}
        </span>
        <span>
          {s
            ? s.bots
                .map(b => tr('ui.ros.bot', { name: b.name, tank: String(b.tank), max: String(b.tank_max), seed: cropName(b.seed) }))
                .join(' / ')
            : '-'}
        </span>
      </div>
    </Card>
  )
}

/** ログの 1 行を, 部品の形 (原文と訳, 知らせ, 点検) にする */
function toEntry(l: LogLine): LogEntry {
  if (l.text) return { id: l.id, ok: !!l.ok, kind: 'cli', tag: l.tag, original: l.text, text: tm(l.msg) }
  if (l.msg.key === 'log.doctor') {
    const title = l.msg.args.title
    return { id: l.id, ok: false, kind: 'doctor', text: typeof title === 'string' ? title : tm(title as Msg) }
  }
  return { id: l.id, ok: !!l.ok, kind: 'notice', text: tm(l.msg) }
}

/** 左下: ログ. 右の端は課題の札の左の端から 16px 手前まで */
export function Log({ questShown }: { questShown: boolean }) {
  const { lang } = useTr()
  const log = useFarm(st => st.state?.log)
  if (!log?.length) return null
  return (
    <LogPanel
      entries={log.map(toEntry)}
      translate={lang !== 'en'}
      className={`absolute bottom-4 left-4 narrow:left-3 narrow:bottom-3 mini:hidden ${
        questShown
          ? 'w-[min(560px,calc(100%-416px))] narrow:w-[calc(100%-288px-36px)]'
          : 'w-[min(560px,calc(100%-300px))] narrow:w-[calc(100%-260px)]'
      }`}
    />
  )
}

/** 小さい窓の 1 行: 今の課題とメーター, お金, 運転, 配線の警告, 「…」. 点検でエラーがあればそれを先に出す */
export function Mini({ inGuide = false }: { inGuide?: boolean }) {
  const { tr, tm: t } = useTr()
  const s = useFarm(st => st.state)
  const peek = useUi(u => u.peekField)
  const guideId = useUi(u => u.guideId)
  const bad = s?.doctor.find(f => f.level === 'error')
  const cur = s?.stage?.missions.find(m => !m.done)
  const stage = s?.stage ? stageTitle(s.stage.id) : ''
  const text = !s
    ? '-'
    : bad
      ? tr('ui.doctor.mini', { title: t(bad.title) })
      : cur
        ? `${stage.split(':')[0]} ・ ${missionText(cur, s).title}`
        : s.stage
          ? stage
          : tr('ui.mini.all_clear')
  const m = s ? mode(s) : null
  return (
    <Card
      variant={bad ? 'danger' : 'hud'}
      pad="none"
      className={`${inGuide ? 'relative m-2' : 'absolute top-2 right-2 left-2 hidden mini:flex'} flex h-10 items-center gap-2 px-2.5 text-xs`}
    >
      <div className="min-w-0 flex-1">
        <div className={`truncate font-bold ${bad ? 'text-danger-ink' : ''}`}>{text}</div>
        {cur && <Meter size="mini" value={cur.value} max={cur.goal} label={missionText(cur, s as FarmState).title} />}
      </div>
      <Money value={s?.money ?? 0} size="sm" />
      {m && (
        <Pill tone={m.tone} live={m.live}>
          {m.short}
        </Pill>
      )}
      {s?.wires.some(w => w.warn) && <Pill tone="danger">{tr('ui.mini.wires')}</Pill>}
      {/* 小さい窓で説明を開いているときだけ: 説明と畑を入れ替える */}
      {guideId && (inGuide || peek) && (
        <Button
          size="sm"
          aria-pressed={peek}
          icon={<Icon.Sprout size={16} aria-hidden />}
          onClick={() => useUi.setState({ peekField: !peek })}
        >
          {tr('ui.guide.peek')}
        </Button>
      )}
      <MoreMenu />
    </Card>
  )
}

/** 小さい窓の「…」. 今の課題の説明, お店, 配線図, 実績, 音, 早送りへ行ける */
function MoreMenu() {
  const { tr } = useTr()
  const s = useFarm(st => st.state)
  const send = useFarm(st => st.send)
  const open = useUi(u => u.open)
  const guideId = useUi(u => u.guideId)
  const cur = s?.stage?.missions.find(m => !m.done)
  const hasGuide = useHasGuide(cur?.id ?? '')
  const [sound, setSound] = useState(soundOn())
  const speed = s?.speed ?? 1
  return (
    <Menu
      trigger={<Button size="sm" iconOnly aria-label={tr('ui.mini.more')} icon={<Icon.Ellipsis size={16} aria-hidden />} />}
      items={[
        ...(cur && hasGuide && !guideId
          ? [{ label: tr('ui.quest.read_guide'), icon: <Icon.BookOpen size={16} aria-hidden />, onSelect: () => openGuide(cur.id) }]
          : []),
        ...(guideId ? [{ label: tr('ui.guide.close'), icon: <Icon.X size={16} aria-hidden />, onSelect: closeGuide }] : []),
        { label: tr('ui.buttons.shop'), icon: <Icon.Store size={16} aria-hidden />, onSelect: () => open('shop') },
        { label: tr('ui.buttons.wires'), icon: <Icon.Workflow size={16} aria-hidden />, onSelect: () => open('wires') },
        { label: tr('ui.buttons.achievements'), icon: <Icon.Trophy size={16} aria-hidden />, onSelect: () => open('achs') },
        { label: tr('ui.buttons.sound'), checked: sound, onSelect: () => setSound(toggleSound()) },
        ...[1, 2, 4].map(n => ({ label: `×${n}`, checked: speed === n, onSelect: () => send({ kind: 'speed', value: n }) })),
      ]}
    />
  )
}

/** 右下: ボタンの列. 狭い畑の面ではアイコンだけにし, 名前はツールチップで出す */
export function Buttons() {
  const { tr } = useTr()
  const speed = useFarm(st => st.state?.speed ?? 1)
  const warn = useFarm(st => st.state?.wires.some(w => w.warn) ?? false)
  const achs = useFarm(st => st.state?.achievements)
  const send = useFarm(st => st.send)
  const open = useUi(u => u.open)
  const [sound, setSound] = useState(soundOn())
  const label = 'narrow:hidden'
  // 文字を隠したときにアイコンだけの正方形にする (左右の内側を消す)
  const squash = 'narrow:aspect-square narrow:px-0'
  return (
    <div className="absolute right-4 bottom-4 flex items-center gap-2 narrow:right-3 narrow:bottom-3 narrow:gap-1.5 mini:hidden">
      <Tooltip label={tr('ui.buttons.speed_label')}>
        <span className="inline-flex items-center gap-1">
          <Icon.FastForward size={20} aria-hidden className="text-ink-sub narrow:hidden" />
          <ToggleGroup
            label={tr('ui.buttons.speed_label')}
            value={String(speed) as '1' | '2' | '4'}
            onChange={v => send({ kind: 'speed', value: Number(v) })}
            options={[
              { value: '1', label: '×1' },
              { value: '2', label: '×2' },
              { value: '4', label: '×4' },
            ]}
          />
        </span>
      </Tooltip>
      <Tooltip label={tr('ui.buttons.wires')}>
        <Button
          aria-label={tr('ui.buttons.wires')}
          className={squash}
          icon={<Icon.Workflow size={20} aria-hidden />}
          onClick={() => open('wires')}
        >
          <span className={label}>{tr('ui.buttons.wires')}</span>
          {warn && (
            <Pill tone="alert" badge className="absolute -top-2 -right-2">
              !
            </Pill>
          )}
        </Button>
      </Tooltip>
      <Tooltip label={tr('ui.buttons.shop')}>
        <Button
          aria-label={tr('ui.buttons.shop')}
          className={squash}
          icon={<Icon.Store size={20} aria-hidden />}
          onClick={() => open('shop')}
        >
          <span className={label}>{tr('ui.buttons.shop')}</span>
        </Button>
      </Tooltip>
      <Tooltip label={tr('ui.buttons.achievements')}>
        <Button
          aria-label={tr('ui.buttons.achievements')}
          className={squash}
          icon={<Icon.Trophy size={20} aria-hidden />}
          onClick={() => open('achs')}
        >
          <span className={label}>{tr('ui.buttons.achievements')}</span>
          <Pill tone="gold" badge className="absolute -top-2 -right-2">
            {achs ? `${achs.filter(a => a.done).length}/${achs.length}` : 0}
          </Pill>
        </Button>
      </Tooltip>
      <Tooltip label={tr('ui.buttons.sound')}>
        <ToggleButton
          iconOnly
          aria-label={tr('ui.buttons.sound')}
          pressed={sound}
          onPressedChange={() => setSound(toggleSound())}
          icon={sound ? <Icon.Volume2 size={20} aria-hidden /> : <Icon.VolumeX size={20} aria-hidden />}
        />
      </Tooltip>
    </div>
  )
}

export function Banner() {
  const { tm: t } = useTr()
  const b = useUi(u => u.banner)
  if (!b) return null
  return <BannerView body={t(b.body)} title={t(b.title)} />
}

export function Floats() {
  const floats = useUi(u => u.floats)
  return (
    <>
      {floats.map(f => (
        <div
          key={f.id}
          className="pointer-events-none fixed z-(--z-float) animate-float font-display text-2xl font-bold text-white text-shadow-float"
          style={{ left: f.px, top: f.py, color: f.color }}
        >
          {f.text}
        </div>
      ))}
    </>
  )
}

/** マウスの下のマスの情報. 添字の式で, 課題で要る計算を畑の上で見せる */
export function TipBox() {
  const { tr } = useTr()
  const tip = useUi(u => u.tip)
  const s = useFarm(st => st.state)
  if (!tip || !s) return null
  const i = tip.y * s.w + tip.x
  const t = s.tiles[i]
  if (!t) return null
  const [moist, kind, growth, dead] = t
  const crop = !kind
    ? tr('ui.tip.no_crop')
    : dead
      ? tr('ui.tip.dead', { crop: cropName(kind) })
      : growth >= 1
        ? tr('ui.tip.ripe', { crop: cropName(kind) })
        : tr('ui.tip.growing', { crop: cropName(kind), pct: String(Math.floor(growth * 100)) })
  return (
    <FloatingCard x={tip.px} y={tip.py}>
      <b>{tr('ui.tip.tile', { x: String(tip.x), y: String(tip.y) })}</b>
      <br />
      {tr('ui.tip.info', { moist: String(moist), crop })}
      <br />
      <span className="font-mono text-info-ink">
        data[{tip.y} * {s.w} + {tip.x}] = data[{i}]
      </span>
    </FloatingCard>
  )
}

/** 接続待ちの幕 */
export function Connect() {
  const { tr } = useTr()
  const connected = useFarm(st => st.connected)
  if (connected) return null
  return (
    <div className="fixed inset-0 z-(--z-connect) grid place-items-center bg-scrim-sky p-4">
      <Card variant="solid" className="flex max-w-[520px] flex-col gap-2 px-7 py-5 vp-mini:px-4 vp-mini:py-3">
        <b className="font-display text-lg">{tr('ui.connect.title')}</b>
        <span className="text-base">{tr('ui.connect.run')}</span>
        <CodeBlock code="ros2 launch publish_or_perish farm.launch.xml" />
        <span className="text-xs text-ink-sub">{tr('ui.connect.note')}</span>
      </Card>
    </div>
  )
}

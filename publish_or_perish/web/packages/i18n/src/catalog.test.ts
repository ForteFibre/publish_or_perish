// 訳の表と, 表を使う側 (C++, match_sim.py, 画面) が食い違っていないかを確かめる.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { type Catalog, flatten, placeholders, setupI18n, tm, tr } from './index'

const pkg = join(import.meta.dirname, '../../../..') // publish_or_perish/
const read = (p: string) => readFileSync(join(pkg, p), 'utf8')
const ja = flatten(JSON.parse(read('web/public/i18n/ja.json')) as Catalog)
const en = flatten(JSON.parse(read('web/public/i18n/en.json')) as Catalog)
const cpp = ['world', 'progress', 'doctor', 'farm_node'].map(f => read(`src/${f}.cpp`)).join('\n')
const py = read('scripts/match_sim.py')
const all = (re: RegExp, text: string) => [...text.matchAll(re)].map(m => m[1] as string)

// ターミナルに出す文 (英語の表が要る) の名前空間
const CLI = ['srv', 'param', 'console', 'crop', 'match']

describe('訳の表', () => {
  it('英語の表のキーは, すべて日本語の表にもある', () => {
    expect(Object.keys(en).filter(k => !(k in ja))).toEqual([])
  })

  it('同じキーの文は, 埋め込みの名前が同じ', () => {
    const bad = Object.keys(en).filter(k => k in ja && placeholders(en[k] as string).join() !== placeholders(ja[k] as string).join())
    expect(bad).toEqual([])
  })

  it('ターミナルに出す文は, すべて英語の表にある', () => {
    expect(Object.keys(ja).filter(k => CLI.includes(k.split('.')[0] as string) && !(k in en))).toEqual([])
  })
})

describe('C++ と match_sim.py が使うキー', () => {
  it('文字列で書いたキーが日本語の表にある', () => {
    const ns = 'srv|param|console|log|notice|title|unit|stage|upcoming|mission|achievement|shop|wire|doctor|build_why|crop|match'
    const keys = [...all(new RegExp(`"((?:${ns})\\.[\\w.]+)"`, 'g'), cpp), ...all(/msg\('([\w.]+)'/g, py)]
    expect(keys.length).toBeGreaterThan(50)
    // "doctor.stale.title" のようなキーと, "mission." + id + ".title" の前半 ("mission.") を分ける
    const full = keys.filter(k => !k.endsWith('.'))
    expect(full.filter(k => !(k in ja))).toEqual([])
  })

  it('C++ で渡す値の名前が, 表の文の埋め込みと同じ', () => {
    // {"キー", {{"名前", 値}, ...}} の形を探し, 括弧の対応を数えて一番外の名前だけを取る
    const found: { key: string; names: string }[] = []
    for (const m of cpp.matchAll(/\{"([a-z_]+\.[\w.]+)", \{/g)) {
      let depth = 1,
        i = (m.index as number) + m[0].length
      const start = i
      while (depth > 0 && i < cpp.length) {
        const c = cpp[i]
        if (c === '"') {
          i = cpp.indexOf('"', i + 1)
        } else if (c === '{') depth++
        else if (c === '}') depth--
        i++
      }
      const body = cpp.slice(start, i - 1)
      const names: string[] = []
      let d = 0
      for (let k = 0; k < body.length; k++) {
        const c = body[k]
        if (c === '"') {
          const e = body.indexOf('"', k + 1)
          if (d === 1 && body[k - 1] === '{') names.push(body.slice(k + 1, e))
          k = e
        } else if (c === '{') d++
        else if (c === '}') d--
      }
      found.push({ key: m[1] as string, names: names.sort().join() })
    }
    expect(found.length).toBeGreaterThan(30)
    const bad = found.filter(f => f.key in ja && placeholders(ja[f.key] as string).join() !== f.names)
    expect(bad).toEqual([])
  })

  it('match_sim.py で渡す値の名前が, 表の文の埋め込みと同じ', () => {
    // msg('キー', 名前=値, ...) の括弧の対応を数え, 一番外のカンマで分けて 名前= を取る
    const found: { key: string; names: string }[] = []
    for (const m of py.matchAll(/msg\('([\w.]+)'/g)) {
      let depth = 1,
        i = (m.index as number) + m[0].length,
        cur = ''
      const parts: string[] = []
      for (; depth > 0 && i < py.length; i++) {
        const c = py[i] as string
        if (c === "'" || c === '"') {
          const e = py.indexOf(c, i + 1)
          cur += py.slice(i, e + 1)
          i = e
          continue
        }
        if ('([{'.includes(c)) depth++
        if (')]}'.includes(c)) depth--
        if (depth === 1 && c === ',') {
          parts.push(cur)
          cur = ''
        } else if (depth > 0) cur += c
      }
      parts.push(cur)
      const names = parts
        .map(p => /^\s*(\w+)=/.exec(p)?.[1])
        .filter(Boolean)
        .sort()
        .join()
      found.push({ key: m[1] as string, names })
    }
    expect(found.length).toBeGreaterThan(15)
    expect(found.filter(f => placeholders(en[f.key] as string).join() !== f.names)).toEqual([])
  })

  it('課題・ステージ・実績・お店・準備中のステージの id に, 表の文がある', () => {
    const progress = read('src/progress.cpp'),
      farm = read('src/farm_node.cpp')
    const want = [
      ...all(/mission\("(\w+)"/g, progress).flatMap(id => ['title', 'desc', 'hint'].map(f => `mission.${id}.${f}`)),
      ...all(/Stage \w+\{"(\w+)"/g, progress).flatMap(id => [`stage.${id}.title`, `stage.${id}.lesson`]),
      ...all(/ach\("(\w+)"/g, progress).flatMap(id => [`achievement.${id}.name`, `achievement.${id}.desc`]),
      ...all(/s\.push_back\(\{"(\w+)", /g, farm).flatMap(id => [`shop.${id}.name`, `shop.${id}.desc`]),
      ...all(/"(\w+)"/g, (progress.match(/upcoming = \{(.*?)\};/s) as RegExpMatchArray)[1] as string).map(id => `upcoming.${id}`),
      ...all(/mission\("\w+", [\d.]+, "(\w+)"/g, progress).map(u => `unit.${u}`),
      'achievement.hidden.name',
      'achievement.hidden.desc',
    ]
    expect(want.length).toBeGreaterThan(100)
    expect(want.filter(k => !(k in ja))).toEqual([])
  })

  it('ビルドの失敗の原因の種類に, 表の文がある', () => {
    const body = (read('src/doctor.cpp').match(/std::string explain_build_error[\s\S]*?\n}\n/) as RegExpMatchArray)[0]
    const kinds = new Set([...all(/return "(\w+)"/g, body), ...all(/\? "(\w+)" : "(\w+)"/g, body), 'no_depend'])
    expect(kinds.size).toBeGreaterThan(5)
    expect([...kinds].flatMap(k => [`build_why.${k}.title`, `build_why.${k}.full`]).filter(k => !(k in ja))).toEqual([])
  })

  it('レベルの数だけ称号がある', () => {
    const levels = ((read('src/progress.cpp').match(/kLevelXp = \{([^}]*)\}/) as RegExpMatchArray)[1] as string).split(',').length
    expect(Array.from({ length: levels }, (_, i) => `title.${i + 1}`).filter(k => !(k in ja))).toEqual([])
  })
})

describe('画面が使うキー', () => {
  it("tr('...') で書いたキーが日本語の表にある", () => {
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(p)
      }
    }
    walk(join(pkg, 'web/src'))
    walk(join(pkg, 'web/packages/ui/src'))
    const keys = files.flatMap(f => all(/\btr\('([\w.]+)'/g, readFileSync(f, 'utf8')))
    expect(keys.length).toBeGreaterThan(30)
    expect(keys.filter(k => !(k in ja))).toEqual([])
  })
})

describe('ガイドが使うキー', () => {
  it('{{msg:キー|値}} のキーが英語と日本語の表にあり, 埋め込みの値が揃っている', () => {
    const dir = join(pkg, 'web/public/guide/ja')
    const refs = readdirSync(dir).flatMap(f =>
      [...readFileSync(join(dir, f), 'utf8').matchAll(/\{\{msg:([\w.]+)(?:\|([^}]*))?\}\}/g)].map(m => ({
        f,
        key: m[1] as string,
        args: (m[2] ?? '')
          .split(',')
          .filter(Boolean)
          .map(kv => kv.split('=')[0]?.trim())
          .sort()
          .join(),
      })),
    )
    expect(refs.length).toBeGreaterThan(0)
    const bad = refs.filter(r => !(r.key in en) || !(r.key in ja) || placeholders(en[r.key] as string).join() !== r.args)
    expect(bad).toEqual([])
  })

  it('{{msg:...|名前=$キー}} の $キー が英語と日本語の表にある', () => {
    const dir = join(pkg, 'web/public/guide/ja')
    const keys = readdirSync(dir).flatMap(f =>
      [...readFileSync(join(dir, f), 'utf8').matchAll(/\{\{msg:[\w.]+\|([^}]*)\}\}/g)].flatMap(m => all(/=\$([\w.]+)/g, m[1] as string)),
    )
    expect(keys.filter(k => !(k in en) || !(k in ja))).toEqual([])
  })
})

describe('tr と tm', () => {
  beforeAll(async () => {
    await setupI18n('ja', {
      ja: JSON.parse(read('web/public/i18n/ja.json')) as Catalog,
      en: JSON.parse(read('web/public/i18n/en.json')) as Catalog,
    })
  })

  it('値の中の文も訳す', () => {
    const m = { key: 'srv.plant.done', args: { x: '2', y: '0', crop: { key: 'crop.wheat', args: {} }, cost: '5' } }
    expect(tm(m)).toBe('(2, 0) に小麦を植えた (-5 G)')
    expect(tm(m, 'en')).toBe('Planted wheat at (2, 0) (-5 G).')
  })

  it('英語の表にない文は日本語で出す', () => {
    expect(tr('ui.copy', {}, 'en')).toBe('コピー')
  })

  it('画面の文に値を埋め込む', () => {
    expect(tr('ui.modal.short', { n: '50' })).toBe('あと 50 G')
  })
})

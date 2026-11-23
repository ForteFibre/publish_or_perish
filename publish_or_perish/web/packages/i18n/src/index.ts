// 画面の訳. 訳の表は public/i18n/<言語>.json (C++ と match_sim.py も同じ表を使う).
// ターミナルに出る文 (service の返事など) の元は en.json, 画面にだけ出る文の元は ja.json.
// 英語の画面はまだ作っていないので, en.json にない文は日本語で出す (fallbackLng).
// 設計: docs/design/web-architecture.md の「メッセージと i18n」
import i18next, { type i18n } from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'

export const LANGS = ['ja', 'en'] as const
export type Lang = (typeof LANGS)[number]

/** サーバーから届く文言. 値は文字列か, それ自体を訳す文 (例: 作物の名前) */
export type Msg = { key: string; args: Record<string, MsgArg> }
export type MsgArg = string | Msg

export type Catalog = { [key: string]: string | Catalog }

/** 表示する言語. ?lang=en で変えられる (英語の画面を試すとき用). 普段は日本語 */
export function pickLang(search = location.search): Lang {
  const q = new URLSearchParams(search).get('lang')
  return (LANGS as readonly string[]).includes(q ?? '') ? (q as Lang) : 'ja'
}

/** 訳の表を読み, i18next を用意する. 画面を描く前に 1 回だけ呼ぶ */
export async function initI18n(lang: Lang = pickLang(), base = ''): Promise<i18n> {
  const load = (l: Lang) => fetch(`${base}i18n/${l}.json`, { cache: 'no-cache' }).then(r => r.json() as Promise<Catalog>)
  const [ja, en] = await Promise.all([load('ja'), load('en')])
  return setupI18n(lang, { ja, en })
}

/** 表をもらって i18next を用意する (テストからも使う) */
export async function setupI18n(lang: Lang, catalogs: Record<Lang, Catalog>): Promise<i18n> {
  await i18next.use(initReactI18next).init({
    lng: lang,
    fallbackLng: 'ja',
    resources: { ja: { translation: catalogs.ja }, en: { translation: catalogs.en } },
    // React が文字を逃がすので, i18next では逃がさない
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  return i18next
}

/** 値のうち, 訳す文になっているものを先に訳す */
function resolveArgs(args: Record<string, MsgArg>, lng?: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(args)) out[k] = typeof v === 'string' ? v : tm(v, lng)
  return out
}

/**
 * キーと値で文にする. lng を渡すとその言語で, 渡さなければ今の言語で訳す.
 * 値は replace に入れる (count や lng のような i18next の決まった名前とぶつからないように)
 */
export function tr(key: string, args: Record<string, MsgArg> = {}, lng?: string): string {
  return i18next.t(key, { replace: resolveArgs(args, lng), lng }) as string
}

/** サーバーから届いた文言を訳す */
export function tm(m: Msg, lng?: string): string {
  return tr(m.key, m.args, lng)
}

/** 言語を替える (Storybook の言語の切り替え用. 画面は ?lang= で開き直す) */
export async function changeLang(lang: Lang): Promise<void> {
  if (i18next.language !== lang) await i18next.changeLanguage(lang)
}

/** 今の言語 */
export const currentLang = (): Lang => (i18next.language as Lang) ?? 'ja'

/** コンポーネントの中で使う. 言語が変わると描き直す */
export function useTr() {
  const { i18n: inst } = useTranslation()
  return { tr, tm, lang: inst.language as Lang }
}

/** 入れ子の表を, . でつないだキー → 文 にする (テストと, 表を比べるとき用) */
export function flatten(c: Catalog, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(c)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out[key] = v
    else Object.assign(out, flatten(v, key))
  }
  return out
}

/** 文の中の埋め込みの名前 ({{x}} の x) */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1] as string))].sort()
}

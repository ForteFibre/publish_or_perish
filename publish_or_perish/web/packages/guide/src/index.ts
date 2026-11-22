// 課題の説明 (guide/<言語>/<課題の id>.md) を読んで HTML にする.
// 使う Markdown は 見出し・段落・箇条書き (- と 1.)・表・コードブロック・`code`・**太字**・引用 (> ) と,
// 畳んでおくヒント (<details><summary>題</summary> の 1 行で始め, </details> の 1 行で閉じる) だけ.
// 文中の ~/src26_ws と tutorial_nodes は, 農場の起動引数 (workspace:= / package:=) の値に置き換える.
// ターミナルに出る文は {{msg:キー}} と書き, expandMessages() で英語の原文と訳にする.
// VSCode 拡張 (vscode/extension.js) にも同じ規則がある. 変えるときは両方を直す.

export const esc = (s: string): string =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

function inline(s: string): string {
  // `code` を先に取り出してから **太字** を探す (太字の中に `code` があっても崩れないように)
  const codes: string[] = []
  const t = esc(s.replace(/`([^`]+)`/g, (_, c: string) => `\u0000${codes.push(c) - 1}\u0000`))
  return t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\u0000(\d+)\u0000/g, (_, k: string) => `<code>${esc(codes[+k] ?? '')}</code>`)
}

export function substitute(text: string, ws?: string, pkg?: string): string {
  if (!ws) return text
  const name = ws.split('/').pop() ?? ws
  return text.replaceAll('~/src26_ws', ws).replaceAll('src26_ws', name).replaceAll('tutorial_nodes', pkg || 'tutorial_nodes')
}

/**
 * ターミナルに出る文を, 訳の表から引いて展開する.
 * - ```output のコードブロックの中の {{msg:キー|名前=値,...}} は英語の原文にし, ブロックのあとに訳を引用 (> ) で添える
 * - それ以外の場所の {{msg:...}} は `英語の原文` (訳: ...) にする
 * translated が null (画面が英語) なら訳は添えない. 展開したあとはただの Markdown なので, VSCode のプレビューでも読める
 */
export type MessageLookup = {
  original: (key: string, args: Record<string, string>) => string
  translated: ((key: string, args: Record<string, string>) => string) | null
  label: string
}

const MSG_RE = /\{\{msg:([\w.]+)(?:\|([^}]*))?\}\}/g

function parseArgs(s: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const kv of (s ?? '').split(',')) {
    const eq = kv.indexOf('=')
    if (eq > 0) out[kv.slice(0, eq).trim()] = kv.slice(eq + 1).trim()
  }
  return out
}

export function expandMessages(md: string, look: MessageLookup): string {
  const out: string[] = []
  const lines = md.replace(/\r/g, '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? ''
    if (l.trim() === '```output') {
      const notes: string[] = []
      out.push('```text')
      for (i++; i < lines.length && !(lines[i] ?? '').startsWith('```'); i++) {
        out.push((lines[i] ?? '').replace(MSG_RE, (_, key: string, a?: string) => {
          const args = parseArgs(a)
          if (look.translated) notes.push(look.translated(key, args))
          return look.original(key, args)
        }))
      }
      out.push('```')
      for (const n of notes) out.push(`> ${look.label}: ${n}`)
    } else if (l.startsWith('```')) {
      // ほかのコードブロックの中はそのまま
      out.push(l)
      for (i++; i < lines.length && !(lines[i] ?? '').startsWith('```'); i++) out.push(lines[i] ?? '')
      if (i < lines.length) out.push(lines[i] ?? '')
    } else {
      out.push(l.replace(MSG_RE, (_, key: string, a?: string) => {
        const args = parseArgs(a)
        const tr = look.translated ? ` (${look.label}: ${look.translated(key, args)})` : ''
        return `\`${look.original(key, args)}\`${tr}`
      }))
    }
  }
  return out.join('\n')
}

export function render(md: string, opts: { copy?: string } = {}): string {
  const copy = esc(opts.copy ?? 'コピー')
  const lines = md.replace(/\r/g, '').split('\n')
  const out: string[] = []
  let i = 0
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
  const at = (k: number) => lines[k] ?? ''
  while (i < lines.length) {
    const l = at(i)
    if (l.startsWith('```')) {
      const lang = l.slice(3).trim()
      const code: string[] = []
      for (i++; i < lines.length && !at(i).startsWith('```'); i++) code.push(at(i))
      i++
      out.push(`<div class="code"><button>${copy}</button><pre data-lang="${esc(lang)}">${esc(code.join('\n'))}</pre></div>`)
    } else if (/^<details><summary>.*<\/summary>$/.test(l)) {
      out.push(`<details><summary>${inline(l.replace(/^<details><summary>|<\/summary>$/g, ''))}</summary>`)
      i++
    } else if (l.trim() === '</details>') {
      out.push('</details>')
      i++
    } else if (/^#{1,3} /.test(l)) {
      const n = (l.match(/^#+/) as RegExpMatchArray)[0].length
      out.push(`<h${n + 1}>${inline(l.slice(n + 1))}</h${n + 1}>`)
      i++
    } else if (l.startsWith('|')) {
      const rows: string[] = []
      for (; i < lines.length && at(i).startsWith('|'); i++) rows.push(at(i))
      const head = cells(rows[0] ?? ''), body = rows.slice(2).map(cells)
      out.push(`<table><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr>${
        body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table>`)
    } else if (/^\d+\. /.test(l)) {
      // 番号付き. 間にコードブロックなどを挟んで続けるときのため, 最初の番号から始める
      const items: string[] = []
      const start = parseInt(l, 10)
      for (; i < lines.length && /^\d+\. /.test(at(i)); i++) items.push(at(i).replace(/^\d+\. /, ''))
      out.push(`<ol start="${start}">${items.map(t => `<li>${inline(t)}</li>`).join('')}</ol>`)
    } else if (/^- /.test(l)) {
      const items: string[] = []
      for (; i < lines.length && /^- /.test(at(i)); i++) items.push(at(i).slice(2))
      out.push(`<ul>${items.map(t => `<li>${inline(t)}</li>`).join('')}</ul>`)
    } else if (l.startsWith('> ')) {
      const quote: string[] = []
      for (; i < lines.length && at(i).startsWith('> '); i++) quote.push(inline(at(i).slice(2)))
      out.push(`<blockquote>${quote.join('<br>')}</blockquote>`)
    } else if (l.trim() === '') {
      i++
    } else {
      const para: string[] = []
      for (; i < lines.length && at(i).trim() && !/^(#|```|\||- |\d+\. |> |<\/?details)/.test(at(i)); i++) para.push(at(i))
      out.push(`<p>${inline(para.join(''))}</p>`)
    }
  }
  return out.join('\n')
}

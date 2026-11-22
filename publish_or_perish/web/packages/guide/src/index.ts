// 課題の説明 (guide/<言語>/<課題の id>.md) を読んで HTML にする.
// 使う Markdown は 見出し・段落・箇条書き (- と 1.)・表・コードブロック・`code`・**太字** と,
// 畳んでおくヒント (<details><summary>題</summary> の 1 行で始め, </details> の 1 行で閉じる) だけ.
// 文中の ~/src26_ws と tutorial_nodes は, 農場の起動引数 (workspace:= / package:=) の値に置き換える.
// VSCode 拡張 (vscode/extension.js) にも同じ置き換えの規則がある. 変えるときは両方を直す.

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

export function render(md: string): string {
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
      out.push(`<div class="code"><button>コピー</button><pre data-lang="${esc(lang)}">${esc(code.join('\n'))}</pre></div>`)
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
    } else if (l.trim() === '') {
      i++
    } else {
      const para: string[] = []
      for (; i < lines.length && at(i).trim() && !/^(#|```|\||- |\d+\. |<\/?details)/.test(at(i)); i++) para.push(at(i))
      out.push(`<p>${inline(para.join(''))}</p>`)
    }
  }
  return out.join('\n')
}

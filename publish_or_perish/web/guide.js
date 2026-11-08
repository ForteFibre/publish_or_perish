// 課題の説明 (guide/<課題の id>.md) を読んで HTML にする.
// 使う Markdown は 見出し・段落・箇条書き・表・コードブロック・`code`・**太字** だけ.
// 文中の ~/src26_ws と tutorial_nodes は, 農場の起動引数 (workspace:= / package:=) の値に置き換える.

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function inline(s) {
  const parts = s.split(/(`[^`]+`)/)
  return parts.map(p => p.startsWith('`') && p.endsWith('`') && p.length > 1
    ? `<code>${esc(p.slice(1, -1))}</code>`
    : esc(p).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')).join('')
}

export function substitute(text, ws, pkg) {
  if (!ws) return text
  const name = ws.split('/').pop()
  return text.replaceAll('~/src26_ws', ws).replaceAll('src26_ws', name).replaceAll('tutorial_nodes', pkg || 'tutorial_nodes')
}

export function render(md) {
  const lines = md.replace(/\r/g, '').split('\n')
  const out = []
  let i = 0
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
  while (i < lines.length) {
    const l = lines[i]
    if (l.startsWith('```')) {
      const lang = l.slice(3).trim()
      const code = []
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i])
      i++
      out.push(`<div class="code"><button>コピー</button><pre data-lang="${esc(lang)}">${esc(code.join('\n'))}</pre></div>`)
    } else if (/^#{1,3} /.test(l)) {
      const n = l.match(/^#+/)[0].length
      out.push(`<h${n + 1}>${inline(l.slice(n + 1))}</h${n + 1}>`)
      i++
    } else if (l.startsWith('|')) {
      const rows = []
      for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i])
      const head = cells(rows[0]), body = rows.slice(2).map(cells)
      out.push(`<table><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr>${
        body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table>`)
    } else if (/^- /.test(l)) {
      const items = []
      for (; i < lines.length && /^- /.test(lines[i]); i++) items.push(lines[i].slice(2))
      out.push(`<ul>${items.map(t => `<li>${inline(t)}</li>`).join('')}</ul>`)
    } else if (l.trim() === '') {
      i++
    } else {
      const para = []
      for (; i < lines.length && lines[i].trim() && !/^(#|```|\||- )/.test(lines[i]); i++) para.push(lines[i])
      out.push(`<p>${inline(para.join(''))}</p>`)
    }
  }
  return out.join('\n')
}

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expandMessages, render, substitute, type MessageLookup } from './index'

describe('render', () => {
  it('見出しを 1 段下げる', () => {
    expect(render('# 題\n## 小見出し')).toBe('<h2>題</h2>\n<h3>小見出し</h3>')
  })

  it('code の中の ** を太字にしない', () => {
    expect(render('**太字 `a**b`**')).toBe('<p><b>太字 <code>a**b</code></b></p>')
  })

  it('HTML を逃がす', () => {
    expect(render('<script>')).toBe('<p>&lt;script&gt;</p>')
    expect(render('```\n<b>\n```')).toContain('<pre data-lang="">&lt;b&gt;</pre>')
  })

  it('番号付きの箇条書きは最初の番号から始める', () => {
    expect(render('3. a\n4. b')).toBe('<ol start="3"><li>a</li><li>b</li></ol>')
  })

  it('表の 2 行目 (区切り) を飛ばす', () => {
    expect(render('| a | b |\n|---|---|\n| `x` | y |')).toBe(
      '<table><tr><th>a</th><th>b</th></tr><tr><td><code>x</code></td><td>y</td></tr></table>')
  })

  it('畳んだヒントを details にする', () => {
    expect(render('<details><summary>**ヒント**</summary>\n本文\n</details>')).toBe(
      '<details><summary><b>ヒント</b></summary>\n<p>本文</p>\n</details>')
  })

  it('段落の行をつなぐ', () => {
    expect(render('一行目\n二行目\n\n次')).toBe('<p>一行目二行目</p>\n<p>次</p>')
  })

  it('今あるガイドをすべて描ける', () => {
    const dir = join(import.meta.dirname, '../../../public/guide/ja')
    const files = readdirSync(dir).filter(f => f.endsWith('.md'))
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      const html = render(readFileSync(join(dir, f), 'utf8'))
      expect(html.length, f).toBeGreaterThan(0)
      // 開いた details はすべて閉じている
      expect(html.split('<details>').length, f).toBe(html.split('</details>').length)
    }
  })
})

describe('substitute', () => {
  it('ワークスペースとパッケージの名前を置き換える', () => {
    expect(substitute('cd ~/src26_ws && ls src26_ws/src/tutorial_nodes', '/home/a/my_ws', 'try_nodes'))
      .toBe('cd /home/a/my_ws && ls my_ws/src/try_nodes')
  })

  it('ワークスペースが分からないときは置き換えない', () => {
    expect(substitute('~/src26_ws', undefined, 'x')).toBe('~/src26_ws')
  })
})

describe('expandMessages', () => {
  const EN: Record<string, string> = { 'srv.bell': 'Ding! (ring {{n}})', 'srv.water.tank_empty': 'Tank is empty.' }
  const JA: Record<string, string> = { 'srv.bell': 'カーン ({{n}} 回目)', 'srv.water.tank_empty': 'タンクが空' }
  const fill = (t: string, a: Record<string, string>) => t.replace(/\{\{(\w+)\}\}/g, (_, k: string) => a[k] ?? '')
  const look: MessageLookup = {
    original: (k, a) => fill(EN[k] as string, a),
    translated: (k, a) => fill(JA[k] as string, a),
    label: '訳',
  }

  it('output のブロックは英語の原文にし, 訳を引用で添える', () => {
    const md = '```output\n$ ros2 service call /board/bell std_srvs/srv/Trigger\n{{msg:srv.bell|n=3}}\n```'
    expect(expandMessages(md, look)).toBe(
      '```text\n$ ros2 service call /board/bell std_srvs/srv/Trigger\nDing! (ring 3)\n```\n> 訳: カーン (3 回目)')
  })

  it('文の中では `原文` (訳: ...) にする', () => {
    expect(expandMessages('- **{{msg:srv.water.tank_empty}} と出る:** 井戸へ', look))
      .toBe('- **`Tank is empty.` (訳: タンクが空) と出る:** 井戸へ')
  })

  it('画面が英語なら訳を添えない', () => {
    expect(expandMessages('{{msg:srv.water.tank_empty}}', { ...look, translated: null })).toBe('`Tank is empty.`')
  })

  it('$ で始まる値は, それ自体を訳す', () => {
    const look2: MessageLookup = {
      original: (k, a) => fill(({ ...EN, 'crop.wheat': 'wheat', p: 'Planted {{crop}}' } as Record<string, string>)[k] as string, a),
      translated: (k, a) => fill(({ ...JA, 'crop.wheat': '小麦', p: '{{crop}}を植えた' } as Record<string, string>)[k] as string, a),
      label: '訳',
    }
    expect(expandMessages('{{msg:p|crop=$crop.wheat}}', look2)).toBe('`Planted wheat` (訳: 小麦を植えた)')
  })

  it('ほかのコードブロックの中は展開しない', () => {
    const md = '```cpp\n// {{msg:srv.bell}}\n```'
    expect(expandMessages(md, look)).toBe(md)
  })

  it('展開したものを描くと, 原文はコード, 訳は引用になる', () => {
    const html = render(expandMessages('```output\n{{msg:srv.bell|n=1}}\n```', look), { copy: 'Copy' })
    expect(html).toBe('<div class="code"><button>Copy</button><pre data-lang="text">Ding! (ring 1)</pre></div>\n<blockquote>訳: カーン (1 回目)</blockquote>')
  })
})

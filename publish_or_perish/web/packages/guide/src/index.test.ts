import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, substitute } from './index'

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

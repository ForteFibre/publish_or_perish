import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLOR, DISPLAY_FONT, HUT } from './tokens'

const css = readFileSync(join(import.meta.dirname, 'styles.css'), 'utf8')
const cssVar = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.replace(/\s+/g, ' ').trim()

describe('3D の色の写し', () => {
  it.each(Object.entries(COLOR))('%s が styles.css と同じ', (name, value) => {
    expect(cssVar(`color-${name}`)).toBe(value)
  })

  it('小屋の屋根が, HUD の意味の色と同じ', () => {
    expect(HUT.player.roof).toBe(cssVar('color-success'))
    expect(HUT.cli.roof).toBe(cssVar('color-cli'))
  })

  it('3D の文字の書体が, 見出しの書体と同じ並びで始まる', () => {
    expect(cssVar('font-display')?.startsWith(DISPLAY_FONT.split(', "Noto Sans CJK JP"')[0] as string)).toBe(true)
  })
})

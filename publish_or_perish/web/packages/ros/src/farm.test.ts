import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { encodeUi, FarmState, parseFarmState } from './farm'

// fixtures/ は動いている農場から ros2 topic echo --field data /farm/state で取った JSON
const dir = join(import.meta.dirname, 'fixtures')
const fixtures = readdirSync(dir).filter(f => f.endsWith('.json'))

describe('FarmState', () => {
  it.each(fixtures)('記録した状態 %s がスキーマに合う', f => {
    const r = FarmState.safeParse(JSON.parse(readFileSync(join(dir, f), 'utf8')))
    expect(r.error?.issues ?? []).toEqual([])
  })

  it('マスの数は w * h', () => {
    for (const f of fixtures) {
      const s = FarmState.parse(JSON.parse(readFileSync(join(dir, f), 'utf8')))
      expect(s.tiles.length).toBe(s.w * s.h)
    }
  })

  it('点検の無い古い状態でも doctor を空で補う', () => {
    const raw = JSON.parse(readFileSync(join(dir, fixtures[0] as string), 'utf8'))
    delete raw.doctor
    expect(parseFarmState(JSON.stringify(raw), true).doctor).toEqual([])
    expect(parseFarmState(JSON.stringify(raw), false).doctor).toEqual([])
  })
})

describe('encodeUi', () => {
  it('farm_node の on_ui が読む形にする', () => {
    expect(encodeUi({ kind: 'buy', id: 'col' })).toBe('buy col')
    expect(encodeUi({ kind: 'speed', value: 4 })).toBe('speed 4')
    expect(encodeUi({ kind: 'diag', text: 'browser fps:60' })).toBe('diag browser fps:60')
    expect(encodeUi({ kind: 'drive', bot: 'bot1', vx: 0.5, vy: -0.5, wz: 1.2 })).toBe('drive bot1 0.50 -0.50 1.20')
    expect(encodeUi({ kind: 'act', bot: 'bot2', what: 'water' })).toBe('act bot2 water')
    expect(encodeUi({ kind: 'trial', stage: 6 })).toBe('trial 6')
    expect(encodeUi({ kind: 'trial', stage: 'off' })).toBe('trial off')
    expect(encodeUi({ kind: 'skip', id: 's3_dry' })).toBe('skip s3_dry')
    expect(encodeUi({ kind: 'demo', id: 's3_auto' })).toBe('demo s3_auto')
    expect(encodeUi({ kind: 'demo', id: null })).toBe('demo stop')
  })
})

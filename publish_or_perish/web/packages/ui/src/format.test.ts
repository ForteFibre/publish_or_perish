import { describe, expect, it } from 'vitest'
import { collapseRepeats, shortPath } from './format'

describe('shortPath', () => {
  it('末尾の 3 階層だけを残す', () => {
    expect(shortPath('/home/u/src26_ws/src/tutorial_nodes/src/patrol.cpp')).toBe('…/tutorial_nodes/src/patrol.cpp')
  })
  it('短いものはホームを ~ にするだけ', () => {
    expect(shortPath('/home/u/a/b')).toBe('~/a/b')
    expect(shortPath('pkg/CMakeLists.txt')).toBe('pkg/CMakeLists.txt')
  })
})

describe('collapseRepeats', () => {
  it('続けて同じものだけをまとめ, 最後のものを残す', () => {
    const rows = [
      { id: 1, t: 'a' },
      { id: 2, t: 'a' },
      { id: 3, t: 'b' },
      { id: 4, t: 'a' },
    ]
    expect(collapseRepeats(rows, (x, y) => x.t === y.t)).toEqual([
      { item: { id: 2, t: 'a' }, count: 2 },
      { item: { id: 3, t: 'b' }, count: 1 },
      { item: { id: 4, t: 'a' }, count: 1 },
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { fixtureNames, loadFixture, pickFixture } from './fixture'
import { useFarm } from './store'

describe('記録した状態で動かす', () => {
  it('fixtures/ の名前を並べる', () => {
    expect(fixtureNames).toEqual(['farm-fresh', 'farm-mistakes', 'farm-playing'])
  })

  it('?fixture= の値を読む', () => {
    expect(pickFixture('?fixture=farm-mistakes&lang=en')).toBe('farm-mistakes')
    expect(pickFixture('?lang=en')).toBeNull()
  })

  it('読んだ記録をストアに入れ, つながっていることにする', async () => {
    const s = await loadFixture('farm-mistakes')
    expect(useFarm.getState().state).toBe(s)
    expect(useFarm.getState().connected).toBe(true)
    expect(s.doctor.length).toBeGreaterThan(0)
  })

  it('ない名前は, 使える名前を添えて失敗する', async () => {
    await expect(loadFixture('nope')).rejects.toThrow(/farm-fresh/)
  })
})

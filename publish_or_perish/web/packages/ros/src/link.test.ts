import { describe, expect, it } from 'vitest'
import { defaultUrl } from './link'

describe('defaultUrl', () => {
  const http = { host: 'localhost:8765', hostname: 'localhost', protocol: 'http:' }
  it('普段は画面と同じ口の /rosbridge (画面を配るサーバーが中継する)', () => {
    expect(defaultUrl('', http)).toBe('ws://localhost:8765/rosbridge')
  })
  it('HTTPS で開いた画面は wss でつなぐ', () => {
    expect(defaultUrl('', { host: 'farm.example.com', hostname: 'farm.example.com', protocol: 'https:' }))
      .toBe('wss://farm.example.com/rosbridge')
  })
  it('?rosbridge=<ポート> で同じホストのそのポートに直接つなぐ', () => {
    expect(defaultUrl('?rosbridge=9191', http)).toBe('ws://localhost:9191')
  })
  it('?rosbridge=<URL> はそのまま使う', () => {
    expect(defaultUrl('?rosbridge=wss://bridge.example.com/', http)).toBe('wss://bridge.example.com/')
  })
})

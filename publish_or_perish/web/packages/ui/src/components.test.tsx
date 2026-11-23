// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { CopyButton } from './CodeBlock'
import { DoctorList } from './DoctorList'
import { LogPanel } from './LogPanel'
import { Splitter } from './Splitter'
import { setupTestI18n } from './test-i18n'

beforeAll(async () => {
  await setupTestI18n()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Button', () => {
  it('押せないときは押しても何も起きないが, Tab では届く', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        買う
      </Button>,
    )
    const b = screen.getByRole('button', { name: '買う' })
    fireEvent.click(b)
    expect(onClick).not.toHaveBeenCalled()
    expect(b.getAttribute('aria-disabled')).toBe('true')
    expect(b.hasAttribute('disabled')).toBe(false)
  })

  it('処理中は二度押しを無視する', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        買う
      </Button>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('CopyButton', () => {
  it('押すと写して「済」にし, 1.5 秒で「コピー」に戻す', () => {
    vi.useFakeTimers()
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<CopyButton text="ros2 topic list" />)
    fireEvent.click(screen.getByRole('button'))
    expect(writeText).toHaveBeenCalledWith('ros2 topic list')
    expect(screen.getByRole('button').textContent).toBe('済')
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(screen.getByRole('button').textContent).toBe('コピー')
  })
})

describe('LogPanel', () => {
  it('続けて同じ文が出たら 1 行にまとめ, 数を添える', () => {
    const e = (id: number, text: string) => ({ id, ok: true, kind: 'notice' as const, text })
    render(<LogPanel entries={[e(1, 'a'), e(2, 'a'), e(3, 'a'), e(4, 'b')]} />)
    const log = screen.getByRole('log')
    expect(log.children.length).toBe(2)
    expect(log.textContent).toContain('×3')
  })

  it('英語の画面では訳を出さない', () => {
    const l = { id: 1, ok: true, kind: 'cli' as const, tag: 'service /bot1/water', original: 'watered', text: '水をやった' }
    render(<LogPanel entries={[l]} translate={false} />)
    expect(screen.getByRole('log').textContent).not.toContain('水をやった')
  })
})

describe('DoctorList', () => {
  const items = [
    { key: 'w', level: 'warn' as const, title: '注意の題', detail: '注意の説明' },
    { key: 'e', level: 'error' as const, title: 'エラーの題', detail: 'エラーの説明' },
  ]

  it('エラーを先に並べ, 最初はすべて畳む', () => {
    render(<DoctorList items={items} />)
    const triggers = screen.getAllByRole('button')
    expect(triggers.map(t => t.textContent)).toEqual(['エラー: エラーの題', '注意: 注意の題'])
    expect(triggers.map(t => t.getAttribute('aria-expanded'))).toEqual(['false', 'false'])
  })

  it('押した 1 件ずつを開閉し, いくつ開いてもよい', () => {
    render(<DoctorList items={items} />)
    const [err, warn] = screen.getAllByRole('button') as [HTMLElement, HTMLElement]
    fireEvent.click(warn)
    fireEvent.click(err)
    expect([err, warn].map(t => t.getAttribute('aria-expanded'))).toEqual(['true', 'true'])
    fireEvent.click(warn)
    expect([err, warn].map(t => t.getAttribute('aria-expanded'))).toEqual(['true', 'false'])
  })

  it('まとめの行に件数を出す', () => {
    render(<DoctorList items={items} />)
    expect(screen.getByText('エラー 1')).toBeTruthy()
    expect(screen.getByText('注意 1')).toBeTruthy()
  })
})

function SplitHarness() {
  const [w, setW] = useState(720)
  return <Splitter orientation="vertical" value={w} min={480} max={1000} onChange={setW} onReset={() => setW(720)} label="幅" />
}

describe('Splitter', () => {
  it('矢印で 16px, Shift と矢印で 64px 動き, 限度を越えず, Enter で戻る', () => {
    render(<SplitHarness />)
    const s = screen.getByRole('separator', { name: '幅' })
    const now = () => Number(s.getAttribute('aria-valuenow'))
    const at = (px: number) => Math.round(((px - 480) / 520) * 100)
    fireEvent.keyDown(s, { key: 'ArrowRight' })
    expect(now()).toBe(at(736))
    fireEvent.keyDown(s, { key: 'ArrowLeft', shiftKey: true })
    expect(now()).toBe(at(672))
    fireEvent.keyDown(s, { key: 'Home' })
    fireEvent.keyDown(s, { key: 'ArrowLeft' })
    expect(now()).toBe(0)
    fireEvent.keyDown(s, { key: 'Enter' })
    expect(now()).toBe(at(720))
  })
})

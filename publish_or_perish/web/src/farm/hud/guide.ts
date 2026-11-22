// 課題の説明 (guide/<言語>/<課題の id>.md) を読む. 一度読んだものは覚えておく.
import { useEffect, useState } from 'react'
import { inVSCode, useUi } from '../ui'

const LANG = 'ja'
const cache = new Map<string, Promise<string | null>>()

export function loadGuide(id: string): Promise<string | null> {
  let p = cache.get(id)
  if (!p) {
    p = fetch(`guide/${LANG}/${id}.md`, { cache: 'no-cache' }).then(r => r.ok ? r.text() : null).catch(() => null)
    cache.set(id, p)
  }
  return p
}

/** その課題に説明があるか (読み終わるまでは false) */
export function useHasGuide(id: string): boolean {
  const [has, setHas] = useState(false)
  useEffect(() => {
    let live = true
    void loadGuide(id).then(t => { if (live) setHas(!!t) })
    return () => { live = false }
  }, [id])
  return has
}

/** 説明を開く. VSCode の中ではエディタの横にプレビューで開く (コードを書くタブと並べて読める) */
export function openGuide(id: string) {
  if (inVSCode) {
    window.parent.postMessage({ type: 'guide', id }, '*')
    return
  }
  useUi.setState({ guideId: id, modal: 'guide' })
}

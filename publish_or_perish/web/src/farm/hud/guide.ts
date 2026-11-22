// 課題の説明 (guide/<言語>/<課題の id>.md) を読む. その言語の版がなければ日本語の版を読む. 一度読んだものは覚えておく.

import { currentLang } from '@pop/i18n'
import { useEffect, useState } from 'react'
import { inVSCode, useUi } from '../ui'

const cache = new Map<string, Promise<string | null>>()

const fetchText = (path: string) =>
  fetch(path, { cache: 'no-cache' })
    .then(r => (r.ok ? r.text() : null))
    .catch(() => null)

export function loadGuide(id: string): Promise<string | null> {
  const lang = currentLang()
  const key = `${lang}/${id}`
  let p = cache.get(key)
  if (!p) {
    p = fetchText(`guide/${lang}/${id}.md`).then(t => t ?? (lang === 'ja' ? null : fetchText(`guide/ja/${id}.md`)))
    cache.set(key, p)
  }
  return p
}

/** その課題に説明があるか (読み終わるまでは false) */
export function useHasGuide(id: string): boolean {
  const [has, setHas] = useState(false)
  useEffect(() => {
    let live = true
    void loadGuide(id).then(t => {
      if (live) setHas(!!t)
    })
    return () => {
      live = false
    }
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

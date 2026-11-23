// 3D (FarmScene) を畑の面に置き, 状態が届くたびに渡す. 通知 (レベルアップ, 課題クリア, 実績) もここで出す.
// 3D の文字は丸い書体で描くので, 書体を読み終えてから作る (canvas は読み込みの済んでいない書体では描けない).

import { tm } from '@pop/i18n'
import { type FarmState, useFarm } from '@pop/ros'
import { notify, type ToastKind } from '@pop/ui'
import { useEffect, useRef } from 'react'
import { FarmScene } from './scene/FarmScene'
import { sfx } from './sfx'
import { showBanner, useUi } from './ui'

const KINDS: readonly string[] = ['mission', 'stage', 'achievement', 'level'] satisfies ToastKind[]

/** 3D の文字の書体を読む. 読めなくても 1.5 秒で先へ進む (OS の書体で描く) */
const fontsReady = () =>
  Promise.race([document.fonts.load('700 48px "M PLUS Rounded 1c"', 'あ0'), new Promise(r => setTimeout(r, 1500))]).catch(() => {})

export function SceneView() {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let scene: FarmScene | null = null
    let unsub = () => {}
    let live = true
    void fontsReady().then(() => {
      if (!live) return
      const s3 = new FarmScene(el.current as HTMLDivElement, text => useFarm.getState().send({ kind: 'diag', text }))
      scene = s3
      let lastNotice: number | null = null
      const onState = (s: FarmState | null) => {
        if (!s) return
        s3.apply(s)
        // 開いた時点より前の通知は出さない
        if (lastNotice === null) lastNotice = s.notices.at(-1)?.id ?? -1
        for (const n of s.notices) {
          if (n.id <= lastNotice) continue
          lastNotice = n.id
          notify({ kind: (KINDS.includes(n.kind) ? n.kind : 'mission') as ToastKind, title: tm(n.title), body: tm(n.body) })
          if (n.kind === 'level') {
            showBanner(n.title, n.body)
            s3.celebrate()
            sfx.level()
          } else if (n.kind === 'achievement') sfx.achievement()
          else sfx.mission()
          if (n.kind === 'stage') s3.celebrate()
        }
      }
      onState(useFarm.getState().state)
      s3.setQuestShown(!useUi.getState().guideId)
      const u1 = useFarm.subscribe((st, prev) => {
        if (st.state !== prev.state) onState(st.state)
      })
      const u2 = useUi.subscribe((st, prev) => {
        if (st.guideId !== prev.guideId) s3.setQuestShown(!st.guideId)
      })
      unsub = () => {
        u1()
        u2()
      }
    })
    return () => {
      live = false
      unsub()
      scene?.dispose()
    }
  }, [])
  return <div ref={el} className="absolute inset-0" />
}

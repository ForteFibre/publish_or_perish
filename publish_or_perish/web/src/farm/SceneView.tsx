// 3D (FarmScene) を置き, 状態が届くたびに渡す. 通知 (レベルアップ, 課題クリア, 実績) もここで出す.
import { useEffect, useRef } from 'react'
import { useFarm, type FarmState } from '@pop/ros'
import { FarmScene } from './scene/FarmScene'
import { sfx } from './sfx'
import { pushToast, showBanner } from './ui'

export function SceneView() {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const scene = new FarmScene(el.current as HTMLDivElement, text => useFarm.getState().send({ kind: 'diag', text }))
    let lastNotice: number | null = null
    const onState = (s: FarmState | null) => {
      if (!s) return
      scene.apply(s)
      // 開いた時点より前の通知は出さない
      if (lastNotice === null) lastNotice = s.notices.at(-1)?.id ?? -1
      for (const n of s.notices) {
        if (n.id <= lastNotice) continue
        lastNotice = n.id
        pushToast(n)
        if (n.kind === 'level') {
          showBanner(n.title, n.body)
          scene.celebrate()
          sfx.level()
        } else if (n.kind === 'achievement') sfx.achievement()
        else sfx.mission()
        if (n.kind === 'stage') scene.celebrate()
      }
    }
    onState(useFarm.getState().state)
    const unsub = useFarm.subscribe((st, prev) => { if (st.state !== prev.state) onState(st.state) })
    return () => {
      unsub()
      scene.dispose()
    }
  }, [])
  return <div id="scene" ref={el} />
}

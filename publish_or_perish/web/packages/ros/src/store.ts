// 農場の状態のストア. rosbridge から /farm/state を受けて入れ, /farm/ui へ操作を送る.
// HUD はセレクターで必要な部分だけを読む. 3D は useFarm.getState() で毎フレーム読む (React を再描画しない).
import { create } from 'zustand'
import { encodeUi, parseFarmState, type FarmState, type UiCommand } from './farm'
import { defaultUrl, RosLink } from './link'

export type FarmStore = {
  /** null: まだ一度もつながっていない */
  connected: boolean | null
  state: FarmState | null
  send: (cmd: UiCommand) => void
}

export const useFarm = create<FarmStore>(() => ({
  connected: null,
  state: null,
  send: () => {},
}))

/** 農場につなぐ. 返す関数で切る */
export function connectFarm(url = defaultUrl(), check = import.meta.env.DEV): () => void {
  const link = new RosLink(url, ok => useFarm.setState({ connected: ok }))
  const unsub = link.subscribe<{ data: string }>('/farm/state', 'std_msgs/msg/String',
    m => useFarm.setState({ state: parseFarmState(m.data, check) }), 50)
  const pub = link.publisher<{ data: string }>('/farm/ui', 'std_msgs/msg/String')
  useFarm.setState({ send: c => pub({ data: encodeUi(c) }) })
  return () => {
    unsub()
    link.close()
    useFarm.setState({ connected: false, send: () => {} })
  }
}

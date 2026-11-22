// rosbridge との接続. 切れたら 1.5 秒ごとにつなぎ直す.
// topic の購読と advertise は, つなぎ直したときに roslib がやり直す (reconnect_on_close).
import { Ros, Service, Topic } from 'roslib'

/**
 * rosbridge の URL. 普段は画面と同じ口の /rosbridge (画面を配るサーバーが rosbridge (9090) に中継する).
 * ?rosbridge=<ポート> で同じホストのそのポートに直接, ?rosbridge=<URL> (wss://... など) でその URL につなぐ
 */
export function defaultUrl(search = location.search, loc: { host: string; hostname: string; protocol: string } = location): string {
  const q = new URLSearchParams(search).get('rosbridge')
  if (q?.includes('://')) return q
  const scheme = loc.protocol === 'https:' ? 'wss' : 'ws'
  if (q) return `${scheme}://${loc.hostname || 'localhost'}:${q}`
  return `${scheme}://${loc.host || 'localhost:8765'}/rosbridge`
}

export class RosLink {
  readonly ros = new Ros()
  #closed = false
  #timer: ReturnType<typeof setTimeout> | undefined

  constructor(readonly url: string, onConnected: (ok: boolean) => void) {
    this.ros.on('connection', () => onConnected(true))
    this.ros.on('close', () => {
      onConnected(false)
      this.#retry()
    })
    // つながらなかったときは close も来るので, ここでは何もしない
    this.ros.on('error', () => {})
    this.#connect()
  }

  #connect() {
    this.ros.connect(this.url).catch(() => this.#retry())
  }

  #retry() {
    if (this.#closed || this.#timer) return
    this.#timer = setTimeout(() => {
      this.#timer = undefined
      this.#connect()
    }, 1500)
  }

  subscribe<T>(name: string, messageType: string, cb: (msg: T) => void, throttle_rate = 0): () => void {
    const t = new Topic<T>({ ros: this.ros, name, messageType, throttle_rate })
    t.subscribe(cb)
    return () => t.unsubscribe(cb)
  }

  /** 送る関数を返す. 最初に呼んだときに advertise する */
  publisher<T>(name: string, messageType: string): (msg: T) => void {
    const t = new Topic<T>({ ros: this.ros, name, messageType })
    return msg => {
      if (this.ros.isConnected) t.publish(msg)
    }
  }

  /** service を呼ぶ. 失敗 (service がない, つながっていない) は reject する */
  call<TReq, TRes>(name: string, serviceType: string, req: TReq): Promise<TRes> {
    return new Promise((resolve, reject) =>
      new Service<TReq, TRes>({ ros: this.ros, name, serviceType }).callService(req, resolve, reject))
  }

  close() {
    this.#closed = true
    clearTimeout(this.#timer)
    this.ros.close()
  }
}

// rosbridge (ws://<host>:9090) との接続. 切れたら 1.5 秒ごとにつなぎ直す.
// topic の購読と advertise は, つなぎ直したときに roslib がやり直す (reconnect_on_close).
import { Ros, Service, Topic } from 'roslib'

/** ?rosbridge=<ポート> で別の農場につなぐ (試験用. 普段は 9090) */
export function defaultUrl(): string {
  const port = new URLSearchParams(location.search).get('rosbridge') ?? '9090'
  return `ws://${location.hostname || 'localhost'}:${port}`
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

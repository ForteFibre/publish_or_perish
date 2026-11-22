// ストアを Redux DevTools (ブラウザの拡張) で見られるようにする. 開発用のサーバーで, 拡張が入っているときだけ.
// 拡張がないときに zustand が毎回出す警告を避けるため, 拡張の有無を先に見る.
export const devtoolsEnabled = (): boolean =>
  import.meta.env.DEV && typeof window !== 'undefined' && '__REDUX_DEVTOOLS_EXTENSION__' in window

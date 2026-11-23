// 部品に渡す前の文字の整え方.

/**
 * ファイルの場所を短くする. ホームを ~ にし, 末尾の 3 階層だけを残して頭を …/ で省く.
 * /home/u/src26_ws/src/tutorial_nodes/src/patrol.cpp → …/tutorial_nodes/src/patrol.cpp
 */
export function shortPath(path: string, keep = 3): string {
  const home = path.replace(/^\/home\/[^/]+(?=\/|$)/, '~')
  const parts = home.split('/')
  return parts.length > keep + 1 ? `…/${parts.slice(-keep).join('/')}` : home
}

/** 続けて同じ値が並んだら 1 つにまとめ, 数を添える (ログの「×6」) */
export function collapseRepeats<T>(items: readonly T[], same: (a: T, b: T) => boolean): { item: T; count: number }[] {
  const out: { item: T; count: number }[] = []
  for (const item of items) {
    const last = out.at(-1)
    if (last && same(last.item, item)) {
      last.count++
      last.item = item
    } else out.push({ item, count: 1 })
  }
  return out
}

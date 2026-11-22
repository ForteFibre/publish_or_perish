// 記録した /farm/state で画面を動かす (農場も rosbridge も要らない).
// ?fixture=farm-mistakes のように, fixtures/ の JSON の名前を渡す. 操作 (/farm/ui) は送らず, コンソールに出す.
// HUD の見た目を確かめるときと, Storybook で使う.
import { type FarmState, parseFarmState } from './farm'
import { useFarm } from './store'

const files = import.meta.glob<FarmState>('./fixtures/*.json', { import: 'default' })

/** 使える記録の名前 (farm-fresh, farm-playing, farm-mistakes) */
export const fixtureNames = Object.keys(files)
  .map(p => p.replace(/^.*\/|\.json$/g, ''))
  .sort()

/** URL の ?fixture= の値. なければ null */
export function pickFixture(search = location.search): string | null {
  return new URLSearchParams(search).get('fixture')
}

/** 記録を読んでストアに入れる. 名前が違えば使える名前を添えて失敗する */
export async function loadFixture(name: string): Promise<FarmState> {
  const load = files[`./fixtures/${name}.json`]
  if (!load) throw new Error(`記録 ${name} はない. 使えるのは ${fixtureNames.join(', ')}`)
  const state = parseFarmState(JSON.stringify(await load()), true)
  useFarm.setState({ connected: true, state, send: cmd => console.info('[fixture] /farm/ui に送るはずだった操作', cmd) })
  return state
}

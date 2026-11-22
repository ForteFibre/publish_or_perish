// すべての見本に共通の設定.
// - 上の帯で言語 (日本語 / 英語) を替えられる. 英語にすると, 部品が長い文で崩れないかを見られる
// - 背景は 空, 草, 札の地 から選ぶ (HUD の札は畑の上に置くので, 空と草の上で確かめる)
// - 画面の大きさは 広い画面 1366×820, 狭い画面 1000×700, 小さい窓 500×380
// - parameters.fixture に記録の名前 (farm-mistakes など) を書くと, その /farm/state をストアに入れてから描く
import { changeLang, initI18n, type Lang } from '@pop/i18n'
import { loadFixture } from '@pop/ros'
import type { Preview } from '@storybook/react-vite'

let ready: Promise<unknown> | null = null

const preview: Preview = {
  globalTypes: {
    lang: {
      description: '画面の言語',
      toolbar: {
        title: '言語',
        icon: 'globe',
        items: [
          { value: 'ja', title: '日本語' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { lang: 'ja', backgrounds: { value: 'sky' } },
  parameters: {
    layout: 'centered',
    backgrounds: {
      options: {
        sky: { name: '空', value: '#9fd8f5' },
        grass: { name: '草', value: '#6cbf45' },
        surface: { name: '札の地', value: '#fffcf3' },
      },
    },
    viewport: {
      options: {
        wide: { name: '広い画面 1366×820', styles: { width: '1366px', height: '820px' }, type: 'desktop' },
        narrow: { name: '狭い画面 1000×700', styles: { width: '1000px', height: '700px' }, type: 'desktop' },
        mini: { name: '小さい窓 500×380', styles: { width: '500px', height: '380px' }, type: 'other' },
      },
    },
  },
  loaders: [
    async ({ globals, parameters }) => {
      const lang = (globals.lang ?? 'ja') as Lang
      ready ??= initI18n(lang)
      await ready
      await changeLang(lang)
      document.documentElement.lang = lang
      if (typeof parameters.fixture === 'string') await loadFixture(parameters.fixture)
      return {}
    },
  ],
}
export default preview

// Storybook: packages/ui の部品のカタログと, 記録した /farm/state を流し込んだ HUD の見本.
//   pnpm storybook        開発用 (http://localhost:6006)
//   pnpm build-storybook  storybook-static/ に書き出す
import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx', '../packages/*/src/**/*.stories.tsx'],
  // 訳の表 (i18n/) と説明 (guide/) を画面と同じ場所から読む
  staticDirs: ['../public'],
  core: { disableTelemetry: true },
  viteFinal: config => {
    // 画面のビルドの設定 (入口を index.html と match.html にする, 名前にハッシュを付けない) は Storybook には要らない
    if (config.build) delete config.build.rolldownOptions
    config.base = undefined
    return config
  },
}
export default config

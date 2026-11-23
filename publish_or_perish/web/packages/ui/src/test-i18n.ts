// 部品のテスト用: 訳の表 (public/i18n) を読んで i18next を用意する
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Catalog, setupI18n } from '@pop/i18n'

const dir = join(import.meta.dirname, '../../../public/i18n')
const load = (l: string) => JSON.parse(readFileSync(join(dir, `${l}.json`), 'utf8')) as Catalog

export const setupTestI18n = () => setupI18n('ja', { ja: load('ja'), en: load('en') })

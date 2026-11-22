// 同梱する書体 (どちらも SIL Open Font License 1.1). CDN からは読まない.
// 見出しと数字: M PLUS Rounded 1c Bold. 字の範囲ごとに分かれたファイルで, 画面に出る字の分だけをブラウザが読む.
// コード: JetBrains Mono Regular と Bold.
// woff (古い形式) の写しは vite.config.ts の fontsWoff2Only() が CSS から外す.
import '@fontsource/m-plus-rounded-1c/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'

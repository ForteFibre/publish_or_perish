import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * 同梱する書体 (@fontsource) の CSS から, woff (古い形式) の写しを外す.
 * 今のブラウザはどれも woff2 を読めるので, 写しを配ると dist/ が倍の大きさになるだけになる.
 */
function fontsWoff2Only(): Plugin {
  return {
    name: 'fonts-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!/@fontsource[\\/].*\.css$/.test(id)) return null
      return code.replace(/,\s*url\([^)]+\.woff\) format\('woff'\)/g, '')
    },
  }
}

// 出力 (dist/) のファイル名に中身のハッシュを付けない.
// colcon の --symlink-install は dist/ のファイルへのリンクを張るので, 名前が変わらなければ
// vite build し直すだけで (colcon build し直さずに) 画面に反映される. 古い .js は web_server.py の no-cache で防ぐ.
export default defineConfig({
  plugins: [fontsWoff2Only(), tailwindcss(), react()],
  base: './',
  // 開発用のサーバーでも, 本番の web_server.py と同じく /rosbridge を rosbridge (9090) に中継する
  server: { proxy: { '/rosbridge': { target: 'ws://localhost:9090', ws: true, rewrite: () => '/' } } },
  build: {
    outDir: 'dist',
    // localhost から配るので, three.js を含む vendor.js が大きくても困らない
    chunkSizeWarningLimit: 1500,
    emptyOutDir: true,
    rolldownOptions: {
      input: { index: resolve(import.meta.dirname, 'index.html'), match: resolve(import.meta.dirname, 'match.html') },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
        // 農場と大会モードで共有するライブラリ (three.js, roslib) を 1 つにまとめる
        advancedChunks: { groups: [{ name: 'vendor', test: /node_modules/ }] },
      },
    },
  },
})

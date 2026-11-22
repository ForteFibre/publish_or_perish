import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// 出力 (dist/) のファイル名に中身のハッシュを付けない.
// colcon の --symlink-install は dist/ のファイルへのリンクを張るので, 名前が変わらなければ
// vite build し直すだけで (colcon build し直さずに) 画面に反映される. 古い .js は web_server.py の no-cache で防ぐ.
export default defineConfig({
  plugins: [react()],
  base: './',
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

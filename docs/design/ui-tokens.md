# 画面のトークンの表

[画面のデザインガイド](ui-guide.md) が決めた見た目の値を、名前、値、使いどころの表にまとめる。
値の出どころは、今の `web/src/farm/farm.css` と、3D の `scene/models.ts`、`scene/FarmScene.ts` である (2026-11-22 時点)。
最後に、Tailwind CSS 4 の `@theme` へ写せる CSS の例を置く。

表の「扱い」の列は、今の値との関係を次の四つで示す。

- **残す**：今の値をそのまま使う
- **まとめる**：今は近い値がいくつかあり、その一つに寄せる
- **変える**：今の値を別の値にする
- **足す**：今は無い

コントラスト比は WCAG 2.2 の相対輝度の式で計算した。
半透明の地は、下に来る色と合成してから計算している。
合成の相手には、3D の草 (`#6cbf45`) と空 (`#9fd8f5`) を使った。

## 色

### 地

| トークン | 値 | 今の値 | 扱い | 使いどころ |
|---|---|---|---|---|
| `sky` | `#9fd8f5` | `body` の背景 `#9fd8f5` | 残す | 3D が描かれる前の背景、接続待ちの幕の色 |
| `surface` | `#fffcf3` | `--card` の不透明な分 | 足す | 窓、説明の面、メニュー、通知。下が透けない札の地 |
| `surface-hud` | `rgb(255 252 243 / 0.94)` | `--card` | 残す | 畑の上に常に出ている札の地 |
| `surface-sunken` | `#f3ecd9` | `#f3ecd9` `#fbf7ea` `#fbf7ec` `#efe7d2` | まとめる | 表の見出し、文中のコード、折りたたみの地、まだ取っていない実績 |
| `track` | `#eadfc4` | `#eadfc4` | 残す | メーターの溝、ステージの帯のまだの分、選んでいないタブ |
| `neutral-soft` | `#ece6d6` | `#eee` | 変える | 「停止中」など、意味を持たない Pill の地。灰色を札の色味に寄せた |
| `scrim` | `rgb(30 40 30 / 0.55)` | `rgba(30, 40, 30, .35)` | 変える | 窓の後ろの幕。0.35 では後ろの札の文字が読めてしまう |
| `scrim-sky` | `rgb(159 216 245 / 0.7)` | `rgba(159, 216, 245, .7)` | 残す | 接続待ちの幕 |

### 文字

| トークン | 値 | 今の値 | 扱い | 使いどころ | `surface` との比 |
|---|---|---|---|---|---|
| `ink` | `#1f2a1f` | `--ink` | 残す | 本文、見出し、数字 | 14.53 |
| `ink-sub` | `#5d6b5a` | `--sub` | 残す | 補足、ラベル、パス | 5.51 |
| `ink-faint` | `#6f6850` | `#a39a80` `#b5ab90` `#888` | 変える | 準備中のステージ、まだ取っていない実績、誰も見ていない topic | 5.43 |

`ink-faint` にまとめた三つの値は、`surface` との比が 2.73、2.13 (`#fbf7ea` の上)、3.54 (白の上) で、どれも 4.5 に届いていなかった。

### 枠

| トークン | 値 | 今の値 | 扱い | 使いどころ |
|---|---|---|---|---|
| `line` | `#e3d9bf` | `--line` | 残す | 札の中の区切り (破線、表の罫) |
| `edge` | `#c9bc98` | `.check` の枠 `#c9bc98` | 変える | 札とボタンの外枠。今は `--line` で、草の上で枠が見えにくい |
| `lip` | `#b9a876` | ボタンの影 `#d8caa3` | 変える | 札とボタンの下の厚み (影ではなく、紙の側面として描く) |
| `control` | `#8a7848` | なし | 足す | 入力欄、チェックの箱、メーターの外枠。`surface` との比 4.21、`track` との比 3.26 |

`edge` と `lip` は飾りの枠で、情報を運ばない。
操作する部品の境界には `control` を使い、隣の地との比を 3 以上にする。

### 役割の色

色ごとに、塗り (`*`)、淡い地 (`*-soft`)、文字 (`*-ink`) の三つを持つ。
塗りは面と枠に使い、文字には使わない。
文字にするときは `*-ink` を使う。

| トークン | 値 | 今の値 | 扱い | 使いどころ |
|---|---|---|---|---|
| `gold` | `#e8a923` | `--gold` | 残す | お金、報酬、進み具合の塗り |
| `gold-bright` | `#ffd45a` | `#lv` のグラデーションの上 `#ffd45a` | 残す | メダルと帯のグラデーションの明るい側、暗い地でのフォーカスの輪 |
| `gold-soft` | `#fff6d8` | 取った実績の地 `#fff6d8` | 残す | 取った実績、報酬の強調の地 |
| `gold-ink` | `#8a5600` | `#9a6b00` `#9a6400` `#8a5600` `#5a3a00` | まとめる | 報酬の「+50 G」、取った実績の題。`surface` との比 6.00 |
| `on-gold` | `#4a2c00` | 帯の文字 `#4a2c00`、バッジの文字 `#fff` | まとめる | 金の塗りの上の文字。`gold` との比 6.13 (白は 2.07) |
| `success` | `#4caf50` | `--green` | 残す | 済んだ課題のチェック、ステージの帯の済んだ分、自分のノード |
| `success-bright` | `#7bc96f` | XP のグラデーション | 残す | XP のメーターの明るい側 |
| `success-deep` | `#3fa34d` | XP のグラデーション | 残す | XP のメーターの暗い側 |
| `success-soft` | `#d9f5d3` | `.pill.auto` の地 | 残す | 「接続中」「無人運転中」の Pill の地 |
| `success-ink` | `#237a2a` | `.pill.auto` の文字 | 残す | 上の地の文字。`success-soft` との比 4.62 |
| `warning` | `#d9640f` | `--amber` (`#f0a020`) | 変える | 注意の札の左の帯。CLI と同じ琥珀色をやめ、金から離した橙にした。`surface` との比 3.54 |
| `warning-soft` | `#ffedd6` | `.dr.warn` の地 `#fff3d6` | 変える | 注意の札の地、「注意」の Pill の地 |
| `warning-ink` | `#8f3f00` | なし | 足す | 上の地の文字、注意のアイコン。`warning-soft` との比 6.37 |
| `cli` | `#8e63d9` | CLI の枠 `#f0a020` | 変える | 配線図の CLI のノードの枠。琥珀色をやめ、紫にした。`surface` との比 4.15 |
| `cli-soft` | `#ece3fb` | `.pill.cli` の地 `#ffe9c2` | 変える | 「CLI で操作中」の Pill の地 |
| `cli-ink` | `#5b34a8` | `.pill.cli` の文字 `#8a5600` | 変える | 上の地の文字。`cli-soft` との比 6.77 |
| `danger` | `#e05244` | `--red` | 残す | エラーの札の左の帯、送り手なしの破線 |
| `danger-strong` | `#c43a2c` | バッジの地 `#e05244` | 足す | 白い文字を載せる赤 (「!」のバッジ)。白との比 5.26 (`danger` は 3.85) |
| `danger-soft` | `#ffe9e6` | `#ffe9e6` `#ffd9d4` `#fbe3df` | まとめる | エラーの札の地、「切断」の Pill の地 |
| `danger-ink` | `#a3271a` | `#a3271a` `#9a2a1d` | まとめる | 上の地の文字。`danger-soft` との比 6.31 |
| `info` | `#3b82c4` | `--blue` | 残す | 情報の札の左の帯、農場のノードの枠 |
| `info-soft` | `#e6f1fb` | `.dr.info` の地 | 残す | 情報の札の地 |
| `info-ink` | `#1d4f80` | `#1d4f80`。リンクとツールチップの式は `#3b82c4` | まとめる | リンク、ツールチップの式、フォーカスの輪。`surface` との比 8.25 (`#3b82c4` は 3.95) |
| `special` | `#d6529a` | 実績の通知の枠 `#9b6bd6` | 変える | 実績の通知の枠。紫を CLI に渡したので、桃色にした。`surface` との比 3.70 |
| `special-soft` | `#fbe6f1` | なし | 足す | 実績の通知の地の強調 |
| `special-ink` | `#a12a6c` | なし | 足す | 上の地の文字。`special-soft` との比 5.78 |

色相は、金が 41 度、注意が 25 度、エラーが 5 度、CLI が 262 度、実績が 327 度である。
今の画面では、金 (41 度)、CLI と注意 (どちらも 37 度) の三つが見分けられなかった。
注意とエラーは色相が近いが、どちらも「直すところがある」という同じ向きの意味で、言葉とアイコンでも分けている。
### ターミナルの暗い地

| トークン | 値 | 今の値 | 扱い | 使いどころ | `term` との比 |
|---|---|---|---|---|---|
| `term` | `#263238` | `#263238` | 残す | コードブロック、topic の名前の Pill、将来のエディタの面 | |
| `term-hud` | `rgb(38 50 56 / 0.92)` | ログの地 `rgba(24, 32, 30, 0.86)` | 変える | 畑の上のログの地。色を `term` に合わせ、下の 3D の文字が透けにくい濃さにした | |
| `term-raised` | `#445a63` | コピーのボタン `#445a63` | 残す | 暗い地の上のボタン、選んだ範囲、状態の行 | |
| `term-text` | `#d7f5c9` | `#d7f5c9`、ログは `#cfe8cf` | まとめる | 暗い地の本文 | 11.15 |
| `term-sub` | `#9fc49a` | `#9fc49a` `#9db99d` `#7b9a7b` | まとめる | 訳、型と頻度、時刻 | 6.79 |
| `term-danger` | `#ffb4a8` | ログの失敗 `#ffb4a8` | 残す | 失敗した行の原文 | 7.74 |
| `term-danger-sub` | `#e0a49a` | 失敗の訳 `#e0a49a` | 残す | 失敗した行の訳 | 6.23 |
| `term-focus` | `#ffd45a` | なし | 足す | 暗い地の上のフォーカスの輪 | 9.29 |

`term-hud` を空の上に置いたとき (いちばん明るくなる場合) の比は、`term-text` が 9.23、`term-sub` が 5.62、`term-danger-sub` が 5.16 である。
今の `#7b9a7b` は、同じ条件で 3.50 から 4.14 だった。

### 意味の色

「誰が動かしているか」を表す色は、役割の色の別名として持つ。
決まりの中身はガイドの「意味の色」に書いた。

| トークン | HUD の値 | 3D の発光 (LED、粒) | 3D の面 (小屋の屋根) | 3D の名札の地 |
|---|---|---|---|---|
| `src-player` (自分のノード) | `success` の三つ | `#5bf06a` | `#4caf50` | `rgb(35 122 42 / 0.9)` |
| `src-cli` (CLI) | `cli`、`cli-soft`、`cli-ink` | `#b78cff` | 屋根 `#8e63d9`、壁 `#e6dcf5` | `rgb(91 52 168 / 0.9)` |
| `src-farm` (農場) | `info` の三つ | `#5ab8ff` | なし | なし |
| `src-mixed` (自分のノードと CLI がぶつかっている) | `danger` の三つ | `#ff5a4a` | なし | なし |
| `src-tool` (rqt などの道具、誰も見ていない) | `edge`、`surface`、`ink-faint` | `#999999` | なし | なし |

今の値から変えるのは CLI の行である。
CLI の LED は `#ffb43a` から `#b78cff` に、小屋の屋根は `#f0a020` から `#8e63d9` に、壁は `#f3d9a6` から `#e6dcf5` に、名札の地は `rgba(160, 100, 0, 0.8)` から `rgb(91 52 168 / 0.9)` に変える。
自分のノードの名札の地は、`rgba(40, 110, 50, 0.8)` を `success-ink` の 0.9 (`rgb(35 122 42 / 0.9)`) に変える。
草の上に置いたときの白い文字との比は、自分のノードが 5.01 から 4.91 でほぼ変わらず、CLI が 4.29 から 7.67 に上がる。
そのほかの発光の値は今のまま残す。

### 3D の粒の色

topic の粒は、topic の種類ではなく、送り手の色で塗る。
`FarmScene.ts` の `FLOW_COLOR` (topic の名前から色を引く表) をやめ、次の表を使う。

| 粒 | 値 | 今の値 |
|---|---|---|
| 自分のノードが出した粒 (小屋から相手へ) | `#5bf06a` | topic ごとの色 (`cmd_vel` は `#ffb43a`、`board` は `#ff8fd0` など) |
| CLI が出した粒 (CLI の小屋から相手へ) | `#b78cff` | 同じく topic ごとの色 |
| 農場が出した粒 (相手から小屋へ) | `#5ab8ff` | topic ごとの色 (`pose` と `tank` は `#5ab8ff`、`field` は `#7be07b`、`money` は `#f5c542`) |
| 受け手がいなくて小屋の前に落ちる粒 | 送り手の色のまま | topic ごとの色 |

粒の値は、ロボットの LED と同じにしてある。
TypeScript では、次の形で `packages/ui` の定数に置く。

```ts
/** 誰が動かしているかの色 (3D の発光: LED と粒) */
export const SRC_GLOW = { player: '#5bf06a', cli: '#b78cff', farm: '#5ab8ff', mixed: '#ff5a4a', tool: '#999999' } as const
/** 小屋の屋根と壁, 名札の地 */
export const HUT = {
  player: { roof: '#4caf50', wall: '#e8efe0', tag: 'rgba(35, 122, 42, 0.9)' },
  cli: { roof: '#8e63d9', wall: '#e6dcf5', tag: 'rgba(91, 52, 168, 0.9)' },
} as const
```

紙吹雪の 5 色 (`#e05244`、`#f0a020`、`#4caf50`、`#3b82c4`、`#9b6bd6`) は、意味を持たない飾りなので今のまま残す。

### 3D の中の文字

| 使いどころ | 値 | 今の値 | 扱い |
|---|---|---|---|
| マスの座標 (`x=0`、`y=0`) | `#2f3a26` | `#4d5a3c` | 変える。草との比が 3.23 から 5.23 になる |
| ロボットの名札 | 白の文字、地は `rgb(31 42 31 / 0.75)` | 地は `rgba(40, 50, 40, 0.75)` | まとめる (`ink` の 0.75) |
| 看板の地 | `#2f4a3a` | `#2f4a3a` | 残す |
| 看板の文字 | `#ffffff`、補足 `#a9c4b0`、数字 `#ffe9a0` | 同じ | 残す (比は 9.72、5.19、8.06) |
| 看板のまだ届いていない文字 | `#a9c4b0` | `#7f9a86` | 変える (比 3.18 を 5.19 に) |

## 書体

| トークン | 値 | 今の値 | 扱い | 使いどころ |
|---|---|---|---|---|
| `font-sans` | `"Hiragino Sans", "Yu Gothic UI", "Meiryo", "Noto Sans CJK JP", "Noto Sans JP", sans-serif` | `"Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif` | 変える | 本文。OS の書体を使い、同梱しない |
| `font-display` | `"M PLUS Rounded 1c", ` に `font-sans` を続ける | なし | 足す | 見出し、ボタン、Pill、数字、帯。Bold (700) を 1 本だけ同梱する |
| `font-mono` | `"JetBrains Mono", "Cascadia Code", "DejaVu Sans Mono", "Noto Sans Mono CJK JP", "Noto Sans Mono", Consolas, monospace` | `"Cascadia Code", "DejaVu Sans Mono", Consolas, monospace` と `"Noto Sans Mono", monospace` の二通り | まとめる | コード、コマンド、topic の名前、英語の原文。Regular (400) と Bold (700) を同梱する |

`font-sans` に `"Noto Sans CJK JP"` を足したのは、Ubuntu に入っている書体の名前がこれだからである。
今の `"Noto Sans JP"` は Ubuntu では当たらず、`sans-serif` に落ちている。

### 文字の大きさ

今の `farm.css` には 10.5 px から 40 px まで 15 通りの大きさがある。
これを 9 段にする。

| トークン | 大きさ / 行の高さ | 今の値 | 使いどころ |
|---|---|---|---|
| `text-2xs` | 11 / 16 px | 10.5、11 | 英数字だけの補足 (XP の数、Hz、バッジ)。日本語には使わない |
| `text-xs` | 12 / 18 px | 11、11.5、12 | 補足、Pill、訳の行、HUD の中のコード |
| `text-sm` | 13 / 20 px | 12.5、13 | HUD の本文 (課題の説明、点検、ログ)、窓の中のコード |
| `text-base` | 14 / 24 px | 14 | 窓の本文、ボタン、課題の題 |
| `text-lg` | 16 / 24 px | 15、16 | 称号、通知の題、窓の中の小見出し |
| `text-xl` | 18 / 26 px | 17、19 | 札と窓の題 |
| `text-2xl` | 22 / 30 px | 20 | 説明の題 |
| `text-3xl` | 28 / 32 px | 24、26 | お金、レベルの数字 |
| `text-4xl` | 40 / 48 px | 40 | レベルアップの帯 |

太さは 400 と 700 の二つにする。
今の 800 (お金、レベル、浮かぶ文字) は、`font-display` の 700 に置き換える。

## 形

### 角丸

| トークン | 値 | 今の値 | 使いどころ |
|---|---|---|---|
| `radius-xs` | 4 px | 3、4、5 | 文中のコード、メーター、キーの札 |
| `radius-sm` | 8 px | 6、8 | コードブロック、チェックの箱、ノードの札、札の中のボタン |
| `radius-md` | 12 px | 10、11、12 | ボタン、点検の札、実績の札、ログ |
| `radius-lg` | 16 px | 14、16 | 札、窓、通知 |
| `radius-xl` | 24 px | 22 | 帯 |
| `radius-full` | 9999 px | 99、50% | Pill、メダル、バッジ |

### 影と厚み

| トークン | 値 | 今の値 | 扱い | 使いどころ |
|---|---|---|---|---|
| `shadow-lip` | `0 4px 0 lip` | `0 4px 0 #d8caa3` | 色を変える | ボタンの厚み |
| `shadow-lip-sm` | `0 2px 0 lip` | `0 2px 0 #d8caa3` | 色を変える | 押し込んだボタン、小さいボタン |
| `shadow-card` | `0 3px 0 lip, 0 8px 18px rgb(40 50 30 / 0.18)` | `0 6px 18px rgba(40, 50, 30, 0.18)` | 変える | 畑の上の札。厚みを足し、ぼかした影は残す |
| `shadow-pop` | `0 3px 0 lip, 0 8px 22px rgb(0 0 0 / 0.2)` | `0 8px 22px rgba(0, 0, 0, .2)` | 変える | 通知、ツールチップ、メニュー |
| `shadow-overlay` | `0 4px 0 lip, 0 16px 40px rgb(0 0 0 / 0.25)` | 窓は札と同じ、帯は `0 16px 40px rgba(0, 0, 0, .25)` | まとめる | 窓、帯 |
| `inset-shadow-medal` | `inset 0 -3px 0 rgb(0 0 0 / 0.15)` | 同じ | 残す | レベルのメダル、コイン |
| `text-shadow-float` | `0 2px 0 #7a5200, 0 0 6px rgb(0 0 0 / 0.4)` | 同じ | 残す | 畑から浮かぶ文字 |

枠の太さは 2 px に固定する。
札の中の区切りは 1 px の破線である。

### 余白

4 px を 1 単位にする。
今の値にある 5、7、9、10、14、22 px は、隣の段に寄せる。

| 段 | 値 | 使いどころ |
|---|---|---|
| 0.5 | 2 px | Pill の上下 |
| 1 | 4 px | アイコンと文字のあいだ、帯の節のあいだ |
| 2 | 8 px | ボタン同士、行と行、小さい札の内側 |
| 3 | 12 px | 札の内側 (狭い画面)、課題の行の上下 |
| 4 | 16 px | 札の内側、画面の端からの距離 |
| 5 | 20 px | 窓の内側 |
| 6 | 24 px | 窓の中の節のあいだ |
| 8 | 32 px | 帯の内側 |

画面の端から札までの距離は、広い画面で 16 px、狭い画面で 12 px (今は 10 px)、小さい窓で 8 px (今は 6 px) にする。

## 重なりの順番

| トークン | 値 | 今の値 | 載るもの |
|---|---|---|---|
| `z-scene` | 0 | 0 | 3D の畑 |
| `z-hud` | 10 | 指定なし | 四隅の札、小さい窓の 1 行 |
| `z-float` | 20 | 9 | 畑から浮かぶ文字 |
| `z-modal` | 40 | 20 | 幕と窓 |
| `z-popup` | 50 | 10 (マスの情報) | ツールチップ、メニュー。窓の中からも開くので窓より上 |
| `z-banner` | 60 | 25 | レベルアップの帯 |
| `z-toast` | 70 | 30 | 通知 |
| `z-connect` | 80 | 40 | 接続待ち |

## 動き

| トークン | 値 | 今の値 | 使いどころ |
|---|---|---|---|
| `duration-press` | 80 ms | なし (瞬時) | ボタンの押し込み |
| `duration-fast` | 160 ms | なし | ホバー、フォーカス、ツールチップ、動きを減らす設定のときのフェード |
| `duration-base` | 240 ms | なし | 窓、説明の面の出入り、メニュー、折りたたみ |
| `duration-meter` | 400 ms | `.4s` | メーター、お金の跳ね |
| `duration-xp` | 600 ms | `.6s` | XP のメーター |
| `duration-toast` | 450 ms | `.45s` | 通知が落ちてくる |
| `duration-banner` | 700 ms | `.7s` | 帯が飛び出す |
| `ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | なし | 出入りと状態の変化 |
| `ease-bounce` | `cubic-bezier(0.2, 1.4, 0.4, 1)` | 通知の `drop` | 通知、お金の跳ね |
| `ease-pop` | `cubic-bezier(0.2, 1.6, 0.4, 1)` | 帯の `pop` | 帯 |

出ている長さは、通知が 4200 ms、帯が 2600 ms、浮かぶ文字が 1400 ms で、今のまま残す。
この三つは CSS ではなく `ui.ts` のタイマーが持っている。

## 画面の幅の区切り

| 名前 | 条件 | 今の値 |
|---|---|---|
| 広い画面 | 幅 1100 px 以上 | 同じ |
| 狭い画面 (`narrow`) | 幅 1100 px 未満 | `@media (max-width: 1100px)` |
| 小さい窓 (`mini`) | 幅 560 px 未満か、高さ 420 px 未満 | `isMini()` が `body.mini` を付ける |

## 説明の面の寸法

説明を開いたときの、画面の分け方の値である。
決まりはガイドの「説明の面」に書いた。

| トークン | 値 | 使いどころ |
|---|---|---|
| `guide-width` | 720 px (画面の幅の 62% まで) | 説明の面の、最初の幅 |
| `guide-min` | 480 px | 説明の面を狭められる限度 |
| `field-min` | 320 px | 畑の面を狭められる限度 |
| `guide-measure` | 680 px | 説明の本文の 1 行の長さの上限 |
| `splitter` | 8 px | 分割の持ち手の幅 |
| `guide-stack` | 幅 860 px 未満 | 左右ではなく上下に分ける区切り |

## `@theme` に写す例

次の CSS は、上の表を Tailwind CSS 4 の書き方にしたものである。
この例はビルドして確かめていない (今の `web/` には Tailwind が入っていない)。
`@custom-variant` の書き方と、`--text-shadow-*` の名前空間 (4.1 から) は、入れる版の文書で確かめてから使う。

```css
@import "tailwindcss";

/* 同梱する書体. public/fonts/ に置き, CDN からは読まない */
@font-face {
  font-family: "M PLUS Rounded 1c";
  src: url("/fonts/MPLUSRounded1c-Bold.subset.woff2") format("woff2");
  font-weight: 700;
  font-display: swap;
}
@font-face {
  font-family: "JetBrains Mono";
  src: url("/fonts/JetBrainsMono-Regular.woff2") format("woff2");
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: "JetBrains Mono";
  src: url("/fonts/JetBrainsMono-Bold.woff2") format("woff2");
  font-weight: 700;
  font-display: swap;
}

@theme {
  /* Tailwind の既定の色, 影, 角丸, 幅の区切りを消し, このガイドの名前だけを使えるようにする */
  --color-*: initial;
  --shadow-*: initial;
  --radius-*: initial;
  --breakpoint-*: initial;
  --text-*: initial;

  /* 地 */
  --color-sky: #9fd8f5;
  --color-surface: #fffcf3;
  --color-surface-hud: rgb(255 252 243 / 0.94);
  --color-surface-sunken: #f3ecd9;
  --color-track: #eadfc4;
  --color-neutral-soft: #ece6d6;
  --color-scrim: rgb(30 40 30 / 0.55);
  --color-scrim-sky: rgb(159 216 245 / 0.7);
  --color-white: #ffffff;
  --color-transparent: transparent;

  /* 文字 */
  --color-ink: #1f2a1f;
  --color-ink-sub: #5d6b5a;
  --color-ink-faint: #6f6850;

  /* 枠 */
  --color-line: #e3d9bf;
  --color-edge: #c9bc98;
  --color-lip: #b9a876;
  --color-control: #8a7848;

  /* 役割の色 */
  --color-gold: #e8a923;
  --color-gold-bright: #ffd45a;
  --color-gold-soft: #fff6d8;
  --color-gold-ink: #8a5600;
  --color-on-gold: #4a2c00;
  --color-success: #4caf50;
  --color-success-bright: #7bc96f;
  --color-success-deep: #3fa34d;
  --color-success-soft: #d9f5d3;
  --color-success-ink: #237a2a;
  --color-warning: #d9640f;
  --color-warning-soft: #ffedd6;
  --color-warning-ink: #8f3f00;
  --color-cli: #8e63d9;
  --color-cli-soft: #ece3fb;
  --color-cli-ink: #5b34a8;
  --color-danger: #e05244;
  --color-danger-strong: #c43a2c;
  --color-danger-soft: #ffe9e6;
  --color-danger-ink: #a3271a;
  --color-info: #3b82c4;
  --color-info-soft: #e6f1fb;
  --color-info-ink: #1d4f80;
  --color-special: #d6529a;
  --color-special-soft: #fbe6f1;
  --color-special-ink: #a12a6c;

  /* ターミナルの暗い地 */
  --color-term: #263238;
  --color-term-hud: rgb(38 50 56 / 0.92);
  --color-term-raised: #445a63;
  --color-term-text: #d7f5c9;
  --color-term-sub: #9fc49a;
  --color-term-danger: #ffb4a8;
  --color-term-danger-sub: #e0a49a;
  --color-term-focus: #ffd45a;

  /* 意味の色 (誰が動かしているか). 役割の色の別名 */
  --color-src-player: var(--color-success);
  --color-src-player-soft: var(--color-success-soft);
  --color-src-player-ink: var(--color-success-ink);
  --color-src-cli: var(--color-cli);
  --color-src-cli-soft: var(--color-cli-soft);
  --color-src-cli-ink: var(--color-cli-ink);
  --color-src-farm: var(--color-info);
  --color-src-farm-soft: var(--color-info-soft);
  --color-src-farm-ink: var(--color-info-ink);
  --color-src-mixed: var(--color-danger);
  --color-src-tool: var(--color-edge);

  /* 書体 */
  --font-sans: "Hiragino Sans", "Yu Gothic UI", "Meiryo", "Noto Sans CJK JP", "Noto Sans JP", sans-serif;
  --font-display: "M PLUS Rounded 1c", "Hiragino Sans", "Yu Gothic UI", "Meiryo", "Noto Sans CJK JP", "Noto Sans JP", sans-serif;
  --font-mono: "JetBrains Mono", "Cascadia Code", "DejaVu Sans Mono", "Noto Sans Mono CJK JP", "Noto Sans Mono", Consolas, monospace;

  /* 文字の大きさと行の高さ */
  --text-2xs: 11px;
  --text-2xs--line-height: 16px;
  --text-xs: 12px;
  --text-xs--line-height: 18px;
  --text-sm: 13px;
  --text-sm--line-height: 20px;
  --text-base: 14px;
  --text-base--line-height: 24px;
  --text-lg: 16px;
  --text-lg--line-height: 24px;
  --text-xl: 18px;
  --text-xl--line-height: 26px;
  --text-2xl: 22px;
  --text-2xl--line-height: 30px;
  --text-3xl: 28px;
  --text-3xl--line-height: 32px;
  --text-4xl: 40px;
  --text-4xl--line-height: 48px;

  /* 余白の 1 単位. p-4 が 16px になる */
  --spacing: 4px;

  /* 角丸 */
  --radius-xs: 4px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-full: 9999px;

  /* 影と厚み */
  --shadow-lip: 0 4px 0 var(--color-lip);
  --shadow-lip-sm: 0 2px 0 var(--color-lip);
  --shadow-card: 0 3px 0 var(--color-lip), 0 8px 18px rgb(40 50 30 / 0.18);
  --shadow-pop: 0 3px 0 var(--color-lip), 0 8px 22px rgb(0 0 0 / 0.2);
  --shadow-overlay: 0 4px 0 var(--color-lip), 0 16px 40px rgb(0 0 0 / 0.25);
  --inset-shadow-medal: inset 0 -3px 0 rgb(0 0 0 / 0.15);
  --text-shadow-float: 0 2px 0 #7a5200, 0 0 6px rgb(0 0 0 / 0.4);

  /* 動き */
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-bounce: cubic-bezier(0.2, 1.4, 0.4, 1);
  --ease-pop: cubic-bezier(0.2, 1.6, 0.4, 1);

  --animate-toast-in: toast-in 450ms var(--ease-bounce);
  --animate-banner-in: banner-in 700ms var(--ease-pop);
  --animate-bump: bump 400ms var(--ease-bounce);
  --animate-float: float-up 1400ms ease-out forwards;
  --animate-live: live 1600ms ease-in-out infinite;
  --animate-fade-in: fade-in 160ms var(--ease-out);

  @keyframes toast-in { from { transform: translateY(-30px) scale(0.9); opacity: 0; } }
  @keyframes banner-in { from { transform: scale(0.3) rotate(-8deg); opacity: 0; } }
  @keyframes bump { 40% { transform: scale(1.18); } }
  @keyframes float-up { to { transform: translateY(-60px); opacity: 0; } }
  @keyframes live { 50% { box-shadow: 0 0 0 4px rgb(76 175 80 / 0.25); } }
  @keyframes fade-in { from { opacity: 0; } }
}

/* @theme に名前空間が無い値. 任意の値として使う (例: z-(--z-modal), duration-(--duration-base)) */
:root {
  --z-scene: 0;
  --z-hud: 10;
  --z-float: 20;
  --z-modal: 40;
  --z-popup: 50;
  --z-banner: 60;
  --z-toast: 70;
  --z-connect: 80;

  --duration-press: 80ms;
  --duration-fast: 160ms;
  --duration-base: 240ms;
  --duration-meter: 400ms;
  --duration-xp: 600ms;

  /* 説明の面 */
  --guide-width: min(720px, 62%);
  --guide-min: 480px;
  --field-min: 320px;
  --guide-measure: 680px;
  --splitter: 8px;

  /* フォーカスの輪. 太さ 3px, 部品から 2px 離す. 暗い地の中では色を term-focus に替える */
  --focus-width: 3px;
  --focus-offset: 2px;
  --focus-color: var(--color-info-ink);
}

/* 幅の区切り. 既定の sm, md, lg は使わない */
@custom-variant narrow {
  @media (max-width: 1099.98px) { @slot; }
}
@custom-variant mini {
  @media (max-width: 559.98px), (max-height: 419.98px) { @slot; }
}

/* 動きを減らす設定. 動かす演出を止め, 出入りは短いフェードにする */
@media (prefers-reduced-motion: reduce) {
  :root {
    --animate-toast-in: fade-in 160ms linear;
    --animate-banner-in: fade-in 160ms linear;
    --animate-bump: none;
    --animate-float: fade-in 160ms linear;
    --animate-live: none;
  }
}

@layer base {
  html { font-family: var(--font-sans); color: var(--color-ink); background: var(--color-sky); }
  code, kbd, pre, samp { font-family: var(--font-mono); font-variant-ligatures: none; }
  :focus-visible { outline: var(--focus-width) solid var(--focus-color); outline-offset: var(--focus-offset); }
  .on-term { --focus-color: var(--color-term-focus); }
}
```

3D の側 (`models.ts`、`FarmScene.ts`) は CSS の変数を読まないので、同じ値を TypeScript の定数としても持つ。
定数は `web/packages/ui` の 1 ファイルに置き、CSS と値が食い違わないかを Vitest で比べる。

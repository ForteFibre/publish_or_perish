# 画面の作り直しの設計

農場と大会モードの画面 (`publish_or_perish/web/`) を、React と React Three Fiber の上に作り直すための設計。
あわせて、画面とサーバーのあいだで文言を受け渡す方法を変え、i18n に備える。
採らなかった選択肢とその理由は [採らなかった選択肢](rejected-alternatives.md) にまとめた。

版の番号は 2026-11-22 に npm registry で確かめた `latest` である。

## 目的

今の画面は、three.js を importmap で読み、手書きの JavaScript で 3D と HUD の両方を作っている。
農場の画面は 1 ファイルで約 1150 行あり、HUD の多くを `innerHTML` のテンプレートで組み、XSS を避けるために `textContent` を手で差し込んでいる。
前回の状態との差分も、`missionKey` のような値を手で比べて検出している。
画面を足すたびにこの書き方が増え、変更の影響が読みにくくなっている。

作り直しで達したいことは次の四つである。

- 受け取った状態から UI を宣言的に作り、差分の検出と XSS への対処をライブラリに任せる
- サーバーと画面のあいだの状態の形を型で固め、片方だけを変えたときの食い違いを開発中に見つける
- 3D の物を、コードで作ったローポリから Blender で作った glTF へ、使う側を変えずに差し替えられるようにする
- 画面の文言を訳せるようにし、ターミナルに出る文は英語にそろえる

## 変えない前提

作り直しの範囲は画面と、画面へ渡す文言の形に限る。
次のものは変えない。

- 農場の規則と課題の判定は C++ の `farm_node` が持つ。画面は状態を映し、お店と早送りの操作を送るだけである
- 大会モードの物理は Python の `match_sim.py` (MuJoCo) が計算する。画面には物理を置かない
- 画面と ROS のあいだは rosbridge (WebSocket, 9090) でつなぐ。状態は `std_msgs/msg/String` の JSON で受ける
- 画面はオフラインで動く。実行時に CDN からは何も読まない
- `farm_node` はホストで動かす。点検は受講生の `~/.bashrc`、ワークスペース、`/proc/<pid>` をホストから読むので、コンテナに入れると働かない
- VSCode 拡張は画面の URL を iframe で開くだけである。拡張そのものを React にはしない

受講生への配り方は、この設計では決めない。

## 全体の構成

```
 ┌──────────── ホスト ─────────────────────────────────────────────┐
 │ farm_node (C++)        match_sim.py (Python, MuJoCo)            │
 │   │ /farm/state (JSON)     │ /match/state (JSON)                │
 │   │ service の response は英語                                  │
 │   └──────────┬─────────────┘                                    │
 │          rosbridge (9090)                                       │
 │              │ WebSocket                                        │
 │   ┌──────────┴──────────────────────────────┐                   │
 │   │ ブラウザ / VSCode の iframe              │                   │
 │   │  packages/ros   接続と状態のストア      │                   │
 │   │  apps/farm      HUD (React) + 3D (R3F)  │                   │
 │   │  apps/match     3D (R3F)                │                   │
 │   │  packages/i18n  英語を元にした訳の表    │                   │
 │   └─────────────────────────────────────────┘                   │
 │ web_server.py が web/dist を配る (8765)                         │
 └─────────────────────────────────────────────────────────────────┘
   web/dist は Docker の中の Node で作る (ビルドのときだけ)
```

## 使うライブラリ

| 役割 | ライブラリ | 版 | 選んだ理由 |
|---|---|---|---|
| UI | React | 19.3 | 状態から UI を作る今の設計にそのまま合う。React Three Fiber を使えるのは React だけである |
| 3D | three.js | 0.187 (r187) | 今の r180 から上げる。描画は WebGLRenderer のまま使う |
| 3D を宣言的に書く | @react-three/fiber | 9.8 | three.js の上に乗るだけなので、今のコードを `<primitive>` で包んで少しずつ移せる |
| 3D の部品 | @react-three/drei | 10.7 | `OrbitControls`、`useGLTF`、`Html`、`Instances` を使う |
| 状態のストア | zustand | 5.1 | `useFrame` の中から `getState()` で読めば、React を再描画せずに 3D が状態を使える |
| 状態の検証 | zod | 4 系 | `/farm/state` の形を一度だけ定義し、TS の型と開発中の検証の両方に使う |
| rosbridge | roslib | 2.1 | ESM 専用になった。subscribe、advertise、service の呼び出しを任せる |
| i18n | i18next + react-i18next | 27 / 18 | 訳の表がただの JSON なので、C++ も同じ表から文を作れる |
| ビルド | Vite | 8.3 | 開発中はすぐに画面へ反映され、本番は `web/dist` に書き出す |
| 言語 | TypeScript | | 状態の形とメッセージのキーに型を付ける |
| パッケージ管理 | pnpm | 12 | 農場と大会モードを一つのワークスペースで扱う |
| アセットの変換 | @gltf-transform/cli | 4.5 | Blender から書き出した glb を圧縮する |
| テスト | Vitest, Playwright | 5.1 / 1.65 | ロジックの単体テストと、HUD のスクリーンショットの比較 |

zod の版は、作り始めるときに確かめて固定する。
React Three Fiber の v10 は alpha であり、`Canvas` の置き場所が変わる予定がある。
安定版が出るまでは v9 に留める。

## ディレクトリ

```
publish_or_perish/
  web/
    package.json, pnpm-workspace.yaml, Dockerfile
    apps/
      farm/                農場の画面 (index.html, src/)
      match/               大会モードの画面
    packages/
      ros/                 rosbridge の接続、ストア、状態の型
      scene/               光、材質、共通の 3D コンポーネント、モデルの読み込み
      i18n/                訳の表 (en.json が元、ja.json が訳) と、文を組み立てる関数
      guide/               ガイドの Markdown を HTML にする処理と置き換えの規則
    public/
      models/              圧縮済みの glb
      guide/<言語>/<id>.md  課題の説明
    dist/                  ビルドの出力 (git に入れない)
  assets/
    blender/               Blender の元ファイル
```

CMake は、今の `install(DIRECTORY ... web ...)` を `web/dist` に向け直す。
`web_server.py` は配るディレクトリが変わるだけで、中身は変えない。
VSCode 拡張は `packages/guide` の置き換えの規則を使えるよう、拡張のビルドのときに同じモジュールを取り込む (下の「ガイド」を参照)。

## 状態の受け渡し

### 状態の型

`/farm/state` の形は `packages/ros` に zod のスキーマで定義する。
TS の型はスキーマから導く。
開発中のビルドでは受け取るたびに検証し、合わなければコンソールに出す。
本番のビルドでは検証を飛ばす。

今の状態には、マスごとの値を `[水分, 作物, 生育, 枯れ, 井戸]` のような配列で詰めた項目がある。
配列のままでも型は付けられるので、通信量を変える理由がない限り形は変えない。
変えるのは、文言を含む項目だけである (下の「メッセージと i18n」を参照)。

C++ 側の JSON は今と同じく手で組み立てる。
スキーマとの食い違いは、記録した状態を使うテスト (下の「テスト」を参照) で見つける。

### ストア

`packages/ros` は、接続と状態をまとめて一つの zustand のストアにする。

```ts
type FarmStore = {
  connected: boolean
  state: FarmState | null
  send: (cmd: UiCommand) => void   // /farm/ui へ送る
}
```

HUD はセレクターで必要な部分だけを読み、その部分が変わったときだけ描き直す。
3D は毎フレームの補間を `useFrame` の中で行い、状態は `useFarm.getState()` で読む。
3D の物を React の state で動かすと、毎フレーム React の再描画が走って遅くなるので、この使い分けを守る。

大会モードも同じ作りで、`/match/state` を受けるストアを持つ。
キーで `/robot/cmd_vel` を送る処理は `apps/match` に置く。

## 3D

### 物ごとのコンポーネント

作物、ロボット、井戸、看板、小屋を、それぞれ一つのコンポーネントにする。

```tsx
<Crop kind="tomato" stage={3} dead={false} />
<Bot name="bot1" />
```

コンポーネントの中で、形をどこから持ってくるかを決める。
使う側は形の出どころを知らない。

```tsx
function Crop(props: CropProps) {
  const model = useModel('crops')          // glb がなければ null
  return model
    ? <CropFromGltf model={model} {...props} />
    : <CropFromCode {...props} />          // 今の makeCrop() を移したもの
}
```

最初はすべての物を、今のコードで作ったローポリのまま移す。
glb ができた物から順に、`useModel` が glb を返すようにして差し替える。
glb を読み込んでいるあいだは、`Suspense` の代わりの表示にコードの形を出す。

### Blender で作るときの決まり

glb にするのは物の形だけである。
物をどこに置くかは、これまでどおり状態からコードで決める。

- 1 マスを 1 m とする。物の原点は、足元の中心に置く
- Blender は Z が上だが、glTF に書き出すと Y が上に変換される。three.js 側では回さない
- 作物の成長の段階は、一つの glb の中のノードで分ける (`wheat_0` から `wheat_4`、枯れたものは `wheat_dead`)
- 画面が動かす部分には、決めた名前を付ける

| 物 | ノードまたは材質の名前 | 画面がすること |
|---|---|---|
| ロボット | `water` | タンクの残りに合わせて高さを変える |
| ロボット | `led` (材質) | 誰が操作しているかで色を変える |
| マス | `soil` (材質) | 水分に合わせて色を混ぜる |
| 看板 | `screen` (材質) | 文字を描いた canvas をテクスチャにする |

名前の一覧は `packages/scene` に定数として置き、コードで作った形も同じ名前を使う。
こうしておけば、glb に替えても動かす側のコードは変わらない。

Blender で作り始めるときの下敷きとして、コードで作った形を three.js の `GLTFExporter` で glb に書き出せるようにする。
書き出した glb を Blender で開けば、今の見た目と寸法から作り直せる。

書き出した glb は `@gltf-transform/cli` で圧縮してから `public/models/` に置く。
Blender の元ファイルは `assets/blender/` に置く。

### 描画の方針

- 描画は WebGLRenderer を使う。WebGPURenderer は、メッシュが多い場面で CPU 時間と最初のフレームが WebGL より遅いという報告があり、受講生の PC や WSL の GPU も考えて見送る
- 畑が広がって作物の数が増えたら、drei の `Instances` か `Merged` でまとめて描く。コードの形でも glb でも同じように使える
- 3D の中の文字は、今と同じく canvas に描いてテクスチャにするか、drei の `Html` で DOM として重ねる。drei の `Text` は日本語の字形が足りないと補うフォントを CDN から取りに行くので、オフラインでは使わない

大会モードは、`mjcf_export.py` が書き出す `scene.json` を今のまま読む。
将来 glTF に書き出すようにすれば、農場と同じ読み込みにそろえられる。

## HUD

HUD は React のコンポーネントにする。
次のものが対象になる。

- レベルとお金
- ROS の状態 (無人運転中か、動いているノード)
- 課題 (ステージの進み具合、課題の一覧、ヒントのコピー、説明を開くボタン)
- 点検
- 配線図
- お店、時間の早送り、実績
- ログ
- 課題の説明 (ガイド)
- 通知

ヒントのコピー、点検の「開く」、説明を開くボタンは、VSCode の中では親のウィンドウへ `postMessage` を送る。
この処理は今と同じ形 (`{ type: 'open' }`、`{ type: 'guide' }`) で残す。

小窓 (幅 560 px 未満か高さ 420 px 未満) のときの表示も、今の規則のまま移す。

## メッセージと i18n

### 方針

ターミナルに出る文は英語にする。
画面とガイドは、英語の原文に訳を添えて出す。

この形は、今のガイドと点検がすでに取っている形の延長である。
ガイドの「うまくいかないとき」の表は、英語で出たエラーに日本語で原因と直し方を添えている。
点検も、colcon の英語のエラーを取り出して日本語で意味を出している。
農場も rclcpp や colcon と同じく英語で答える部品の一つになり、訳すのは画面とガイドの役目になる。

英語にする文は次のものである。

- 農場の service の response の `message` (種まき、水やり、収穫、看板の鐘)
- 大会モードの service の response の `message` (つかむ、置く、投げる、サイコロ、合図、リセット)
- `farm_node` と `match_sim.py` がターミナルに出すログ

課題、点検、お店、実績、通知など、画面にだけ出る文は、キーで送って画面が訳す。

### サーバーが返す形

C++ の `Result` を、文ではなくキーと値で返す形に変える。

```cpp
struct Result
{
  bool ok;
  std::string key;                         // 例: "water.tank_empty"
  std::map<std::string, Arg> args;         // 例: {"x": 3, "y": 2}
};
```

service の response の `message` には、このキーと値から組み立てた英語の文を入れる。
`/farm/state` のログの項目には、キーと値と組み立てた英語の文の三つを入れる。

```json
{ "ok": false, "key": "water.tank_empty", "args": {}, "text": "Tank is empty. Refill at the well (bottom-left tile)." }
```

`text` はターミナルに出た文そのものなので、画面は英語の原文として `text` をそのまま出し、訳は `key` と `args` から作る。
課題や点検のように画面にだけ出る項目は `key` と `args` だけを送り、`text` を付けない。

作物の名前のように、文の中に入る名前もキーで送る (`crop.tomato`)。
`CropInfo` が持つ日本語の名前は、訳の表へ移す。

### 訳の表

訳の表は `packages/i18n` に置く。
英語の `en.json` を元にし、日本語の `ja.json` を訳とする。
形式は i18next の JSON に合わせ、埋め込みは `{{x}}`、複数形は `_one` と `_other` の接尾辞で書く。

```json
{
  "water": {
    "tank_empty": "Tank is empty. Refill at the well (bottom-left tile).",
    "done": "Watered ({{x}}, {{y}}): moisture {{before}} -> {{after}}, tank {{tank}}/{{max}}"
  }
}
```

C++ は JSON を読む仕組みを持っていない。
そこで、ビルドのときに `en.json` から C++ のヘッダーを作る (CMake からスクリプトを呼ぶ)。
`match_sim.py` は `en.json` を起動時に読む。
こうすると英語の文の元は `en.json` だけになり、C++、Python、画面が同じ表を使う。

英語の文は、次の規則で書く。

- 平易な英語 (目安は CEFR の B1) にする
- 失敗の文には、次に何をすればよいかを含める
- 一文を短くし、ROS の用語 (topic、service、node) は訳さない

### 画面での出し方

ログの欄では、英語の原文を等幅のフォントでターミナルと同じ見た目に出し、その下に訳を小さく添える。
画面の言語が英語のときは、訳を出さない。

画面の言語は、ブラウザの言語から決め、画面の設定で切り替えられるようにする。
VSCode の中では、拡張が VSCode の表示言語を URL の引数で渡す。

### ガイド

ガイドは言語ごとに `public/guide/<言語>/<id>.md` に置く。
その言語の訳がなければ日本語を出す。

ターミナルに出る文を例として示すときは、文を直接書かず、メッセージのキーで参照する。
出力を示すブロックの記法を一つ足す。

````md
```output
$ ros2 service call /bot1/water std_srvs/srv/Trigger
{{msg:water.tank_empty}}
```
````

画面はこのブロックを、英語の原文と、その下に添えた訳に展開する。
文を `en.json` から引くので、プログラムの出力とガイドの例が食い違わない。

今は文中の `~/src26_ws` と `tutorial_nodes` を置き換える規則が、画面 (`guide.js`) と VSCode 拡張 (`extension.js`) の二か所に書かれている。
この規則と `{{msg:...}}` の展開を `packages/guide` の一つのモジュールにまとめ、拡張もこれを使う。
拡張は今と同じく、置き換えたあとの Markdown をファイルに書いて VSCode の Markdown プレビューで開く。
展開したあとはただの Markdown なので、プレビューでもそのまま読める。

### VSCode 拡張

拡張の文言 (コマンドの名前、ステータスバー、ツールチップ) は、VSCode の標準の仕組みで訳す。
`package.json` の文言は `package.nls.json` と `package.nls.ja.json` に、コードの文言は `vscode.l10n` に移す。

## ビルドと開発

### ビルド

`web/dist` は Docker の中の Node で作る。
ROS の環境に Node を入れる必要はない。

```dockerfile
FROM node:24 AS build
WORKDIR /web
RUN corepack enable
COPY . .
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile && pnpm build

FROM scratch
COPY --from=build /web/dist /
```

```bash
docker build --output type=local,dest=web/dist web
```

`--output` でファイルとして取り出すので、出力の持ち主は手元の利用者になる。
`web/.dockerignore` に `node_modules` と `dist` を書き、手元のものをコンテナへ持ち込まないようにする。
`colcon build` は、できた `web/dist` をこれまでどおり share へ入れる。

### 開発

開発中は、農場を `ros2 launch` で起動したうえで、Vite の dev server (5173) を別に起動する。
画面は rosbridge へ WebSocket で直接つなぐので、dev server に proxy は要らない。
VSCode 拡張の URL の設定を dev server に向ければ、拡張の中でもすぐに反映される。

## テスト

| 対象 | 方法 |
|---|---|
| 状態のスキーマ | 動いている農場から `/farm/state` を MCAP に記録し、そこから取り出した JSON を固定のデータにしてスキーマで検証する |
| ガイドの描画と置き換え | Vitest で、Markdown から HTML への変換と `{{msg:...}}` の展開を確かめる |
| 訳の表 | `en.json` のキーがすべて `ja.json` にあるか、埋め込みの名前が一致するかを Vitest で確かめる |
| C++ のメッセージ | GTest で、`World` が返すキーが `en.json` にあり、引数の名前が合っているかを確かめる |
| HUD | 固定の状態を流し込み、Playwright でスクリーンショットを比べる (通常の大きさと小窓の両方) |

## 移行の順序

1. 土台を作る。pnpm のワークスペース、Vite、TypeScript、Docker のビルド、`packages/ros` のストアと状態のスキーマを用意する。今の 3D のコードは `useEffect` の中でそのまま動かす
2. HUD を React に移す。課題、点検、お店、配線図、実績、ログ、ガイドの順に移す
3. メッセージをキーで返す形に変える。`Result` と `/farm/state` の文言の項目を変え、`en.json` と `ja.json` を作り、ターミナルの文を英語にする。ガイドに `output` のブロックを足す
4. 大会モードを R3F で作り直す。小さく、作っている途中なので、R3F の書き方を固める場所にする
5. 農場の 3D を R3F に移す。`<primitive>` で包むところから始め、作物、ロボット、小屋の順にコンポーネントにする
6. Blender で作った物から glb に差し替える

3 は 2 と並行して進められる。
3 を終えるまでは、画面の言語は日本語だけにする。

## 決まっていないこと

- 英語のメッセージを誰が書き、誰が見直すか
- ガイドの英語版を作るか。作るなら誰が訳すか
- 受講生への配り方
- React Three Fiber の v10 に上げる時期

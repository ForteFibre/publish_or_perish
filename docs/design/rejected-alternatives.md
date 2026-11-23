# 採らなかった選択肢

[画面の作り直しの設計](web-architecture.md) を決めるときに比べ、採らなかった選択肢をまとめる。
中心はゲームエンジンと 3D の道具で、UI フレームワーク、i18n、ビルドの選択肢も短く残す。
それぞれに、採らなかった理由と、どうなったら考え直すかを書いた。

版の番号は 2026-11-22 に npm registry で確かめた `latest` である。
出典は最後にまとめた。

## 判断の基準

比べるときに使った条件は、この画面の性質から決まる。
条件が変われば判断も変わるので、先に書いておく。

- **物理と規則は画面の外にある**：農場の規則は C++ の `farm_node`、大会モードの物理は Python の MuJoCo が持つ。画面は状態を受けて映すだけなので、エンジンが持つ物理、当たり判定、ゲームループの仕組みはほとんど使わない
- **画面の半分は文書の UI である**：課題、ガイドの Markdown、コピーのボタン、点検、配線図、お店がある。日本語の文が多く、DOM で書くのがいちばん楽な部分が大きい
- **オフラインで動く**：実行時に CDN やクラウドのサービスへつながない
- **VSCode の中で開く**：VSCode 拡張は画面の URL を iframe で開く。小窓の大きさでも使える必要がある
- **3D の物は、コードで作ったローポリから始めて、Blender で作った glb に差し替えていく**：物を置く場所は状態からコードで決め、glb にするのは物の形だけである
- **アセットを作る人と画面のコードを書く人が同じとは限らない**：Blender の作業がコードの作業を止めないようにしたい

## ゲームエンジン

### Babylon.js

Babylon.js (9.37) は、描画に加えて物理、GUI、Inspector、glTF の読み込みを一つにまとめたエンジンである。
9.0 (2026-03) でクラスタ化したライティングやフレームグラフが入り、WebGPU への対応も three.js より先を行くという評価がある。
glTF の読み込みも強く、Blender から持ち込む流れに困ることはない。

採らなかったのは、強みの多くをこの画面で使わないからである。
物理は MuJoCo が持っているので、Babylon.js の物理を使えば正しい位置が二か所に分かれてしまう。
GUI は 3D の中に描く UI で、文書の UI は DOM で書くほうが楽である。
残る利点は描画と Inspector だが、そのために今の three.js のコードを全部書き直すことになる。
React と組み合わせる部品 (react-babylonjs) もあるが、React Three Fiber とその周りの部品 (drei など) に比べて利用者と例が少ない。

考え直す条件：画面の側で物理を計算する必要が出たとき (たとえば ROS なしで動くデモを作るとき) や、3D の中の UI が主になったとき。

### PlayCanvas

PlayCanvas は、エンジン (2.24) と、ブラウザで動くエディタを持つ。
エディタで物を置き、スクリプトを付けるワークフローが強みで、Blender から持ち込んだアセットを目で見ながら並べられる。
エンジンだけを使うこともでき、描画の速さも評価が高い。

採らなかった理由は二つある。
一つは、エディタがクラウドに依存することである。
エディタのフロントエンドは 2025 年に MIT で公開されたが、バックエンドのサービスは PlayCanvas が運営したままで、手元だけでは動かせない。
プロジェクトとアセットも PlayCanvas のクラウドに置くことになる。
もう一つは、この画面では物を置く場所を状態から決めるので、エディタで配置する利点が小さいことである。
エディタを使わずエンジンだけを使うなら、three.js から乗り換える理由が残らない。

考え直す条件：畑やフィールドの配置を固定のシーンとして作り込む必要が出て、エディタでの配置の作業が大きくなったとき。
その場合でも、オフラインで作業できるかを先に確かめる。

### Godot (Web に書き出す)

Godot (4.6) は本物のゲームエンジンで、Blender のファイルの読み込み、訳の仕組み (TranslationServer)、WebSocket がそろっている。
4.3 からは、スレッドを使わない Web 書き出しが既定になり、COOP と COEP のヘッダーなしで配れる。
ROS とも、rosbridge へ WebSocket でつなげば話せる。

採らなかったのは、この画面の半分を占める文書の UI が Godot の UI では書きにくいからである。
ガイドの Markdown の表示、コードのコピー、点検の一覧、配線図の表を、Godot の UI の部品で作り直すことになる。
クリップボードや VSCode への `postMessage` も、JavaScript との橋渡しを通すことになる。
さらに、エンジン本体の wasm を読み込む分だけ起動が重くなり、日本語のフォントも自分で埋め込む必要がある。
書き出しの大きさは今回確かめていないが、エンジン本体を丸ごと配る以上、今の数百 kB の three.js より大きくなる。
VSCode の小窓の中で開いたときの動作も確かめていない。
画面のコードを書く人が GDScript とエディタの操作も覚える必要が出る。

考え直す条件：画面の主役が文書の UI から 3D のゲームそのものに移り、HUD が小さくなったとき。

### Needle Engine

Needle Engine は、Blender や Unity で作ったシーンを three.js の上で動かす仕組みである。
Blender の中で物に動きを付け、そのまま Web に書き出せる。
three.js の上に乗るので、今の知識も使える。

採らなかった理由は、ライセンスと成熟度である。
商用利用には有料のライセンスが要り、ビルドのたびにライセンスサーバーへつなぐ必要がある (CI ではトークンを渡す)。
教育向けのライセンスもあるが、講師がまとめて申し込む形で、Blender の利用者に同じ条件が当てはまるかは確かめていない。
最新版は 6.0 の alpha である。
この設計では Blender で作るのは物の形だけで、シーンや動きは作らないので、Needle Engine の強みを使う場面も少ない。

考え直す条件：Blender の中で動きや仕掛けまで作り込みたくなったとき。
その場合は、ライセンスの条件と、オフラインでビルドできるかを先に確かめる。

## 3D の周りの道具

### three.js の WebGPURenderer

three.js の WebGPURenderer は、WebGL2 への切り替えを内蔵し、TSL でシェーダーを書ける。
主要なブラウザが WebGPU に対応したので、使える環境は広がっている。

採らなかったのは、この画面の描き方では速くならないおそれがあるからである。
メッシュが多い場面で、CPU 時間が WebGLRenderer の約 2 倍、最初のフレームが 5 倍から 10 倍遅いという報告がある (r183)。
この画面は小さなメッシュ (作物、粒子、小屋) を多く描く。
受講生の PC や WSL の GPU で WebGPU がどれだけ使えるかも分からない。

考え直す条件：three.js の更新でこの差が縮んだと確かめられたとき、または WebGPU でしか書けない表現 (計算シェーダーを使う粒子など) が欲しくなったとき。

### 画面の側の物理 (@react-three/rapier)

React Three Fiber で物理を使う定番の部品である。
採らないのは、正しい位置をサーバーの MuJoCo が持っているからである。
画面に別の物理を置くと、二つの物理の結果が食い違い、どちらを信じるかを決める処理が要る。

考え直す条件：ROS なしで動くデモを作るとき。
その場合も、まず下の MuJoCo の WebAssembly 版を考える。

### MuJoCo の WebAssembly 版 (@mujoco/mujoco)

Google DeepMind が公式に出している MuJoCo の JavaScript 版 (4.0) で、ブラウザの中で同じモデルを動かせる。
大会モードのフィールドとロボットを、Python の環境なしで動かせるようになる。

採らないのは、教材の目的から外れるからである。
大会モードは、ROS の topic と service でロボットを動かす練習の場で、シミュレーターは ROS のノードである必要がある。
README でも、この版はまだ作っている途中とされている。

考え直す条件：ROS を入れていない人に見せるデモや、大会の説明用のページを作るとき。

### Triplex (React Three Fiber のビジュアルエディタ)

Triplex は、React Three Fiber のコンポーネントを目で見ながら編集し、変更をコードに書き戻すエディタである。
コードを正とするので、エディタとコードが食い違わない。
VSCode の拡張としても動く。

採らないのは、React Three Fiber v9 と React 19 への対応を確かめられなかったからである。
確かめた範囲では、npm の版が React Three Fiber v8 と React 18 を前提にしていた。
また、この設計では物を置く場所を状態から決めるので、エディタで配置する場面が少ない。

考え直す条件：v9 への対応を確かめられ、固定の飾り (木、柵、看板の位置) を目で見ながら並べたくなったとき。

### gltfjsx

gltfjsx は、glb のノードから型の付いた React Three Fiber のコンポーネントを自動で作る道具である。
採らないのは、最後のリリースが 2024-11 で止まっており、なくても困らないからである。
この設計では、動かす部分のノード名を決めておき、`useGLTF` で名前を引いて使う。

考え直す条件：glb の数が増え、ノード名を手で書くのが負担になったとき。

### drei の Text (troika-three-text)

3D の中に SDF で文字を描く部品で、拡大しても文字がにじまない。
採らないのは、日本語の字形がフォントに足りないと、補うフォントを CDN から自動で取りに行くからである。
オフラインでは文字が欠けるおそれがある。
3D の中の文字は、今と同じ canvas のテクスチャか、drei の `Html` で描く。

考え直す条件：日本語を含むフォント (Noto Sans JP など) を画面に同梱し、そのフォントだけで描くと決めたとき。

### ECS (koota など)

ECS (Entity Component System) は、多数のゲームの物を効率よく扱う仕組みである。
採らないのは、物の状態をサーバーが持ち、画面は受け取った状態を映すだけだからである。
画面の側で物の状態を管理する場面がない。

## UI フレームワーク

| 選択肢 | 版 | 採らなかった理由 | 考え直す条件 |
|---|---|---|---|
| Preact + htm (ビルドなし) | 11.2 / 3.1 | ビルドを避ける理由がなくなった。React Three Fiber が Preact で動く保証もない | なし |
| Svelte + Threlte | 5.59 / 8.7 | Threlte 8 は Svelte 5 に対応し、更新が細かく軽い。しかしビルドが必要な点は React と同じで、周りの部品の厚みで React Three Fiber に劣る | React Three Fiber の開発が止まったとき |
| Vue + TresJS | 3.5 | Svelte と同じ理由 | 同上 |
| Solid | 2.0 | 3D の部品が少ない | 同上 |

## i18n

| 選択肢 | 版 | 採らなかった理由 |
|---|---|---|
| Paraglide JS | 3.2 | コンパイルするので型が付き、使わない訳を捨てられる。しかし画面は localhost から配るので、小さくなる利点が効かない。訳の表を C++ と共有するには、i18next の JSON より手間がかかる |
| Lingui | 6.12 | ソースに書いた文から訳す文を抜き出す方式である。訳す文の多くがサーバーから来るこの画面には合わない |
| react-intl (ICU) | 12.2 | ICU の MessageFormat は C++ で扱うのが重い。日本語と英語が中心なら、そこまでの表現力は要らない |
| サーバーで訳す (`lang:=en`) | | ターミナルの文を英語にそろえ、訳は画面とガイドで添えることにした。サーバーに言語の設定を持たせる必要がなくなった |

キーのうち、画面のメッセージは i18next の JSON から型を付けて打ち間違いを防ぐ。
Paraglide JS の型の利点は、この方法でほぼ得られる。

## ビルドと実行

| 選択肢 | 採らなかった理由 |
|---|---|
| ビルドしない (importmap のまま) | JSX と TypeScript を使うためにビルドが要る。ビルドは Docker の中で行うので、ROS の環境に Node は要らない |
| ビルドの出力 (`web/dist`) を git に入れる | ビルドを Docker でできるので、生成物の差分を履歴に入れる理由がない |
| `colcon build` から npm を呼ぶ | ROS の環境に Node が要る |
| `farm_node` を Docker の中で動かす | 点検は受講生の `~/.bashrc`、ワークスペース、`/proc/<pid>` をホストから読む。コンテナで動かすには `--pid=host`、`--network=host`、ホームの mount が要り、隔離する意味がほとんど残らない |

## 出典

- three.js: [releases](https://www.github.com/mrdoob/three.js/releases)、[WebGPURenderer の説明](https://threejs.org/manual/en/webgpurenderer)、[WebGPURenderer の速さの報告](https://discourse.threejs.org/tag/webgpu-renderer/1686)
- 比較記事 (各社の記事で、自社の製品を含むものがある): [Three.js vs Babylon.js vs PlayCanvas (2026)](https://www.utsubo.com/ja/blog/threejs-vs-babylonjs-vs-playcanvas-comparison)、[Web game engines in 2026](https://app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison)
- PlayCanvas: [エディタのフロントエンドの公開](https://blog.playcanvas.com/playcanvas-editor-frontend-is-now-open-source)、[エディタを手元で動かすことについて](https://forum.playcanvas.com/t/how-could-i-host-the-game-editor/25631)
- Godot: [Web への書き出し (4.6)](https://docs.godotengine.org/en/4.6/tutorials/export/exporting_for_web.html)、[WebSocket (4.6)](https://docs.godotengine.org/en/4.6/tutorials/networking/websocket.html)
- Needle Engine: [FAQ (ライセンス)](https://engine.needle.tools/docs/reference/faq)
- MuJoCo: [JavaScript 版の README](https://raw.githubusercontent.com/google-deepmind/mujoco/main/wasm/README.md)
- React Three Fiber: [v9 への移行](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide)、[10.0.0-alpha](https://newreleases.io/project/npm/@react-three/fiber/release/10.0.0-alpha.6)
- Triplex: [リポジトリ](https://gitee.com/mirrors_pmndrs/triplex)、[@triplex/editor 0.46.2](https://packages.ecosyste.ms/registries/npmjs.org/packages/@triplex%2Feditor/versions/0.46.2)
- Threlte: [作者による React Three Fiber との比較](https://hn.svelte.dev/item/40205509)
- troika-three-text: [README](https://cdn.jsdelivr.net/npm/troika-three-text@0.52.4/README.md)
- i18n: [Lingui と i18next の比較](https://lingui.js.org/misc/i18next)、[Paraglide JS の README](https://unpkg.com/@inlang/paraglide-js@2.21.0/README.md)、[React の i18n ライブラリの比較 (Tolgee)](https://tolgee.io/blog/react-i18n-libraries-comparison)
- roslib: [roslibjs](https://github.com/robotwebtools/roslibjs)

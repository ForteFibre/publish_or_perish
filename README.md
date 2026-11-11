# Publish or Perish

ROS 2 を学ぶための農場ゲーム。農場のロボットを topic と service で動かし、種まき・水やり・収穫で農場を大きくする。
課題は講習の回に対応していて、CLI で手で動かすところから、自分の C++ ノードで 2 台のロボットを無人で回すところまで進む。

![農場](docs/images/farm.png)

| パッケージ | 中身 |
|---|---|
| `publish_or_perish` | 農場のノード (C++) と、ブラウザで見る 3D 画面 (`web/`) |
| `publish_or_perish_answers` | 課題の解答例 (講師用) |

## 遊び方

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select publish_or_perish
ros2 launch publish_or_perish farm.launch.xml
```

ブラウザで http://localhost:8765 を開く (WSL の場合も Windows 側のブラウザで開ける見込み。未確認)。
進み具合は `~/.publish_or_perish/save.txt` に保存される。最初からにするときは `reset:=true`、別の保存先は `save_path:=<path>` を付ける。

途中のステージから試すときは `start_stage:=<番号>` を付ける (前のステージは済みになる)。今の記録を残すため、保存先も分ける。
ステージ 3 を、もう遊んだワークスペースで試し直す例 (別の名前のパッケージを使うので、遊んだ `tutorial_nodes` は変わらない):

```bash
cd ~/src26_ws/src && ros2 pkg create try_nodes
ros2 launch publish_or_perish farm.launch.xml start_stage:=3 package:=try_nodes save_path:=$HOME/.publish_or_perish/try.txt
```

rosbridge が入っていなければ `sudo apt install ros-jazzy-rosbridge-server` で入れる。

### VSCode の中で遊ぶ

`vscode/` に VSCode 拡張がある。VSCode の拡張機能のフォルダにリンクを張って入れ、VSCode のコマンドパレットで「Developer: Reload Window」(ウィンドウの再読み込み) をする。リンクなので、`vscode/` を直すと再読み込みだけで反映される。

```bash
ln -s ~/src26_ws/src/publish_or_perish/vscode ~/.vscode/extensions/fortefibre.publish-or-perish-0.1.0
```

ほかの PC に配るときは `python3 vscode/pack.py` で `vscode/publish-or-perish.vsix` を作り、`code --install-extension publish-or-perish.vsix` で入れる。

- **畑を小窓で開く** (Ctrl+Alt+H、またはステータスバーの課題をクリック): 畑を VSCode の浮動ウィンドウに出し、常に手前に置く。窓を小さくする (幅 560 px 未満か高さ 420 px 未満) と、上に今の課題を 1 行で出し、畑全体が収まる表示になる。最初は 1024×768 で開くので、角をつまんで縮める
- **畑を開く** (コマンドパレットの「Publish or Perish: 畑を開く」): エディタのタブとして開く
- **ステータスバー**: 今のステージ、課題、進み具合、配線の警告を出す。カーソルを乗せると課題の説明とヒントが出る
- **今の課題の説明を開く** (Ctrl+Alt+G、ステータスバーのツールチップ、または畑の「説明を読む」): 課題の説明をエディタの横に Markdown のプレビューで開く

## ステージ

| ステージ | 内容 | 講習 |
|---|---|---|
| 1 手で動かしてみよう | `ros2 topic pub` / `ros2 topic echo` / `ros2 service call` | 入門 第8・9回 |
| 2 ワークスペースを作ろう | `mkdir -p ~/src26_ws/src`、`ros2 pkg create`、`colcon build`、`~/.bashrc` | 実践 第1回 |
| 3 最初のノードを動かそう | `hello_node` を書き、package.xml と CMakeLists.txt を ament_cmake_auto にし、ビルドして `ros2 run` | 実践 第2・3・4回 |
| 4 自分のノードで動かそう | タイマーと Publisher | 実践 第2・5・6回 |
| 5 畑を見て判断しよう | Subscriber と service の client で無人農場 | 実践 第7回 |
| 6 パラメータで作物を選ぼう | `ros2 param set /farm bot1.seed tomato` | 入門 第10回・実践 第12回 |
| 7 ロボットを 2 台にしよう | namespace と launch で同じノードを 2 つ動かす | 実践 第11回 |

ステージ 2・3 は農場がファイルを見て判定する。調べるのは `~/src26_ws` の `tutorial_nodes` (変えるときは `workspace:=<path>` と `package:=<名前>`。課題文のパスとコマンドもその値になる)。

## 画面の機能

- **説明** (課題の「説明を読む」): その課題でやること、使う関数やコマンドの意味、うまくいかないときの見方を出す。ステージ 4〜7 は完成したコードを載せず、考え方と要の数行を畳んだヒント (`<details><summary>題</summary>` 〜 `</details>`) にしている (解答例は講師用の `publish_or_perish_answers`)。ステージ 3 は決まった形なので全文を載せる。講習の資料を開かなくても進められるようにするためのもの。中身は `publish_or_perish/web/guide/<課題の id>.md` で、文中の `~/src26_ws` と `tutorial_nodes` は起動引数の `workspace:=` と `package:=` の値に置き換えて出す。今あるのはステージ 3〜7 (ステージ 1・2 は課題の欄のコマンドだけで進められるので付けていない)
- **点検** (課題パネルの上、VSCode では「問題」パネル): ターミナルにはエラーが出ないか、出ても原因が分かりにくい間違いを、ファイル・`~/.bashrc`・動いているプロセスを外から見て見つける。ファイルは読むだけで書き換えない

  | 見つける間違い | 調べ方 |
  |---|---|
  | `src` やホームで `colcon build` した | その場の `build/COLCON_IGNORE`、`install/setup.bash` |
  | 最初のビルドで `--merge-install` を付け忘れた | `install/.colcon_install_layout` が `isolated` |
  | `--symlink-install` を付け忘れた | `install/share/<pkg>/package.xml` がリンクでない |
  | パッケージを `src` の外・パッケージの中に作った | `package.xml` の場所 |
  | ワークスペースの名前の打ち間違い | ホームにある、`src` を持つ似た名前 (編集距離 2 以内) のディレクトリ |
  | `~/.bashrc` の source の重複・打ち間違い・相対パス | `~/.bashrc` の各行と、source 先があるか |
  | .cpp を `CMakeLists.txt` に書いていない | `src/*.cpp` と `add_executable` の突き合わせ |
  | `CMakeLists.txt` に書いたファイルがない | 同上 |
  | `ament_auto_...` を使うのに package.xml が `ament_cmake` のまま | `<buildtool_depend>` |
  | include したパッケージが package.xml にない | `#include <pkg/...>` と `<depend>` の突き合わせ |
  | ビルドに失敗した | `log/latest_build` の最初のエラーを取り出し、よくあるものは日本語で意味を出す |
  | 直したあとビルドしていない | ソースと実行ファイルの更新時刻 |
  | ビルドし直したのに古いプロセスが動いている | `/proc/<pid>/exe` が `(deleted)`、または起動時刻より実行ファイルが新しい |
  | `ROS_DOMAIN_ID` が農場と違う | 動いているプロセスの環境変数 (`/proc/<pid>/environ`) |

- **配線図** (右下の「配線」): topic ごとに送り手・受け手・頻度・データ量を出す。受け手のいない topic、似た名前の打ち間違い、型や QoS の食い違いを警告する
- **ノードの小屋**: 自分のノードと CLI ごとに畑の奥へ小屋が建ち、メッセージ 1 つが光の粒 1 つになって飛ぶ。届かない粒は小屋の前に落ちる
- **時間の早送り** (右下の「時間」): 作物と水分の時間だけを 2 倍・4 倍にする。ロボットの動きは実時間のまま
- **お店**: 畑の拡張、新しい作物、タンク、2 台目のロボット

## 解答例 (講師用)

```bash
ros2 run publish_or_perish_answers stage4_patrol                          # ステージ 4
ros2 run publish_or_perish_answers stage5_farmer --ros-args -r __ns:=/bot1  # ステージ 5・6
ros2 launch publish_or_perish_answers stage7_two_bots.launch.xml           # ステージ 7
```

## ロボットとのやりとり

| 名前 | 型 | 向き | 内容 |
|---|---|---|---|
| `/bot1/cmd_vel` | `geometry_msgs/msg/Twist` | 送る | 速度 (機体座標, x 前 / y 左)。0.5 秒途切れると止まる |
| `/bot1/pose` | `geometry_msgs/msg/Pose2D` | 受ける | 位置 [m] と向き [rad]。1 マス = 1 m |
| `/bot1/tank` | `std_msgs/msg/Int32` | 受ける | 水タンクの残り。井戸 (マス (0, 0)) に立つと満タン |
| `/bot1/plant` `/bot1/water` `/bot1/harvest` | `std_srvs/srv/Trigger` | 呼ぶ | 足元のマスに種まき / 水やり / 収穫 |
| `/bot2/...` | 同上 | | 2 台目を買うと増える |
| `/field/moisture` | `nav_msgs/msg/OccupancyGrid` | 受ける | マスの水分 0〜100。`data[y * width + x]` |
| `/field/crops` | `nav_msgs/msg/OccupancyGrid` | 受ける | -1: なし, 0〜99: 生育中, 100: 実った, -2: 枯れた |
| `/money` | `std_msgs/msg/Int64` | 受ける | 所持金 |
| パラメータ `/farm` の `bot1.seed` | string | 設定 | 植える作物 (wheat / tomato / pumpkin, お店で解禁) |

## 課題の判定

農場は ROS のグラフを見て、誰が操作したかを判定する。

- `ros2 topic pub` などの CLI のノード (`_ros2cli_*`) と、自分で書いたノードを区別する
- CLI のノードがなく、自分のノードだけが動いているときは「無人運転中」になる
- `ros2 topic echo` や rqt_graph、RViz、`ros2 bag record` を使うと解ける隠し実績がある

## 構成

- `publish_or_perish/src/world.cpp`: 農場の規則 (ROS に依存しない)
- `publish_or_perish/src/progress.cpp`: 課題・実績・レベル
- `publish_or_perish/src/farm_node.cpp`: ROS の topic / service、グラフの読み取り、保存、画面用の状態 (`/farm/state`)
- `publish_or_perish/web/`: three.js の画面。rosbridge (9090) で `/farm/state` を読み、`/farm/ui` にお店と早送りの操作を送る
- `vscode/`: VSCode 拡張 (畑を小窓で開く、ステータスバーに課題を出す)。colcon は読まない (`COLCON_IGNORE`)
- `publish_or_perish/web/match.html`: 大会モードの見た目の試作 (動きはまだない)
- `tools/mjcf_export.py`: MuJoCo のモデル (MJCF) から大会モードの画面用の形を書き出す。出力先 `web/scenes/` は git に入れない

```bash
python3 tools/mjcf_export.py ~/src26_ws/src/src_ros2/src_ros2_simulation/models/src.xml publish_or_perish/web/scenes/src2026
```

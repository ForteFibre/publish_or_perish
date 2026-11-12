# C++ のノードから動かす

## やること

ステージ 1 では `ros2 topic pub` で `/bot1/cmd_vel` に速度を送った。同じことを、自分で書くノード `move_node` からする。bot1 が 3 m 進めばクリア。

書き方は、ステージ 4 の看板に文字を出したノード (`board_node`) と同じ。クラス・タイマー・Publisher の説明は、ステージ 4 の「看板に文字を出す」の説明にある。違うのは次の 3 つだけ。

| | 看板 (`board_node`) | この課題 (`move_node`) |
|---|---|---|
| 送る topic | `/board/text` | `/bot1/cmd_vel` |
| メッセージの型 | `std_msgs/msg/String` | `geometry_msgs/msg/Twist` |
| 送る間隔 | いくつでもよい | 0.5 秒より短く (下の「送り続ける」) |

## 説明

### Twist の書き方

型の名前とファイル名は、コマンドで書く型名から決まる。

| コマンドでの型名 | C++ の型名 | include するファイル |
|---|---|---|
| `geometry_msgs/msg/Twist` | `geometry_msgs::msg::Twist` | `geometry_msgs/msg/twist.hpp` |

| 書き方 | 意味 |
|---|---|
| `geometry_msgs::msg::Twist cmd;` `cmd.linear.x = 0.5;` | 前へ 0.5 m/s。何も入れなかった値は 0 |
| `cmd.linear.y` | 左へ [m/s] |
| `cmd.angular.z` | 左回り [rad/s] |

向きはロボットから見た向き。

### 送り続ける

速度は 1 回送るだけでは足りない。農場のロボットは、最後に速度を受け取ってから 0.5 秒たつと止まる (実機と同じ安全のしくみ)。そのため、0.5 秒より短い間隔で送り続ける。

## この課題で書くもの

- `ros2 topic pub` を動かしているターミナルがあれば Ctrl+C で止める (農場は、誰が送った速度かを見ている)。
- 書くのは `~/src26_ws/src/tutorial_nodes/src/move_node.cpp`。
- `geometry_msgs` を使うので、package.xml の `<depend>rclcpp</depend>` の下に 1 行足す。

```xml
  <depend>geometry_msgs</depend>
```

- CMakeLists.txt の `ament_auto_add_executable(board_node ...)` の下に 1 行足す。

```cmake
ament_auto_add_executable(move_node src/move_node.cpp)
```

- ビルドして起動する。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes move_node
```

## ヒント

<details><summary>ヒント 1: どこから書き始めるか</summary>

`board_node.cpp` を写して始める。変えるところは、クラス名とノード名、メッセージの型 (include も)、topic 名、メッセージの中身、タイマーの間隔。

</details>

<details><summary>ヒント 2: タイマーの間隔</summary>

`1s` のままだと、送ってから 0.5 秒で止まり、次に送るまでの 0.5 秒は止まったままになる。`100ms` にすると止まらずに進む。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **進まない:** `ros2 topic pub` がまだ動いていると、どちらの速度が使われるか決まらない。右上の「運転」が「CLI で操作中」なら止める。
- **エラーは出ないのに進まない:** `pub_` や `timer_` をコンストラクタの中の変数 (`auto timer = ...`) にすると、コンストラクタが終わったところで消えて、何も送られない。メンバ変数にする。
- **途中で止まった:** 畑の端の柵に当たっている。`linear.x` をマイナスにして逆へ進ませる (ビルドし直して起動し直す)。
- **ビルドで `geometry_msgs/msg/twist.hpp` が見つからない:** package.xml に `<depend>geometry_msgs</depend>` がない。
- **`ros2 run` で `No executable found`:** CMakeLists.txt に `move_node` の行を足したあとビルドしていない。

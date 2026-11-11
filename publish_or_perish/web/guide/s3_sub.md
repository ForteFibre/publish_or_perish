# 畑の水分を読む

## やること

これまでのノードは送るだけだった。この課題では、農場が出している topic を自分のノードで受け取る (subscribe する)。

`~/src26_ws/src/tutorial_nodes/src/watch_node.cpp` を作る。ロボットの位置 (`/bot1/pose`) と畑の水分 (`/field/moisture`) を受け取り、1 秒に 1 回、今いるマスの水分を `RCLCPP_INFO` で出すノード。起動すると、subscribe したことを農場が見つけてクリアになる。

package.xml に `nav_msgs` を足し (`geometry_msgs` はステージ 4 で足してある)、CMakeLists.txt に 1 行足す。

```xml
  <depend>nav_msgs</depend>
```

```cmake
ament_auto_add_executable(watch_node src/watch_node.cpp)
```

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes watch_node
```

## 使うもの

| 書き方 | 意味 |
|---|---|
| `create_subscription<型>("topic 名", 10, 関数)` | その topic を受け取る Subscriber を作る。メッセージが届くたびに 3 つ目の関数が呼ばれる (呼ばれるのは `rclcpp::spin` の中) |
| `[this](const geometry_msgs::msg::Pose2D & msg) {...}` | 届いたメッセージを `msg` で受け取る関数の書き方 |
| `rclcpp::Subscription<型>::SharedPtr` | Subscriber をしまっておく変数の型。メンバ変数にする |
| `#include <geometry_msgs/msg/pose2_d.hpp>` `#include <nav_msgs/msg/occupancy_grid.hpp>` | 2 つの型を使うための include |
| `geometry_msgs/msg/Pose2D` | `x` `y` [m] と `theta` [rad]。1 マス = 1 m なので、`std::floor(x)` がマスの番号 (`#include <cmath>`) |
| `nav_msgs/msg/OccupancyGrid` | マス目の値を 1 列に並べたもの。マス (x, y) の値は `data[y * info.width + x]` |

農場が出している topic:

| topic | 型 | 中身 |
|---|---|---|
| `/bot1/pose` | `geometry_msgs/msg/Pose2D` | ロボットの位置と向き (20 回/秒) |
| `/bot1/tank` | `std_msgs/msg/Int32` | 水タンクの残り |
| `/field/moisture` | `nav_msgs/msg/OccupancyGrid` | マスの水分 0〜100 (5 回/秒) |
| `/field/crops` | `nav_msgs/msg/OccupancyGrid` | 作物の育ち具合。-1: なし、0〜99: 育っている途中、100: 実った、-2: 枯れた |

## ヒント

<details><summary>ヒント 1: 受け取ったものをどこで使うか</summary>

届いたメッセージは、受け取る関数の中でメンバ変数にしまうだけにする。水分を出すのは、1 秒ごとのタイマーの関数の中。最初のメッセージが届くまでは `OccupancyGrid` の `data` が空なので、空なら何もしない。

</details>

<details><summary>ヒント 2: 今いるマスの水分を出す</summary>

```cpp
const int x = static_cast<int>(std::floor(pose_.x));
const int y = static_cast<int>(std::floor(pose_.y));
const int m = moisture_.data[y * moisture_.info.width + x];
```

`pose_` と `moisture_` は、受け取ったメッセージをしまったメンバ変数。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **何も出ない:** 最初のメッセージが届くまでは `data` が空。数秒待っても出なければ、topic 名の打ち間違い (`/field/moisture`) を見る。右下の「配線」で、自分のノードが受け手に出ているか確かめられる。
- **落ちる (Segmentation fault):** マスの番号が畑の外になると `data` の外を読む。`x` は 0〜`info.width - 1`、`y` は 0〜`info.height - 1`。

# ボタン 1 で、自分のノードがリフトを上げる

## やること

自分のノード `semi_node` を書く。画面で数字キーの **1** を押したら、`semi_node` がリフトを 0.12 m に上げる。

## 半自動とは

ここからは、台車は今までどおりキーで走らせ、機構 (アーム・リフト・つかむ・置く) は自分のノードに任せる。人は「今つかんで」「今置いて」の合図だけを出す。本物のロボコンの半自動の機体も、同じ分け方をよく使う。

```
人 (キー)                          自分のノード semi_node
  1 を押す ── /operator/button ──▶ 受け取って
                                   /robot/arm/lift に 0.12 を送る ──▶ シミュレーター (リフトが上がる)
```

画面の数字キー 1〜4 を押すと、シミュレーターが `/operator/button` にその数を送る。

## シミュレーターの topic と service

半自動と自動で使うものを全部並べる。この課題で使うのは太字の 2 つ。

| 名前 | 型 | 向き | 中身 |
|---|---|---|---|
| **`/operator/button`** | `std_msgs/msg/Int32` | 受ける | 画面で押した数字キー (1〜4) |
| **`/robot/arm/lift`** | `std_msgs/msg/Float64` | 送る | リフトの高さの目標 [m] (0〜0.35)。0.3 m/s で動く |
| `/robot/arm/extend` | `std_msgs/msg/Float64` | 送る | アームの伸びの目標 [m] (0〜0.42)。0.4 m/s で動く |
| `/robot/arm/lift_now` `/robot/arm/extend_now` | `std_msgs/msg/Float64` | 受ける | 今の高さ・伸び [m] |
| `/robot/grab` `/robot/place` `/robot/dice` `/robot/signal` | `std_srvs/srv/Trigger` (service) | 呼ぶ | つかむ・置く・サイコロ・合図。キーの G P X Z と同じ |
| `/robot/cmd_vel` | `geometry_msgs/msg/Twist` | 送る | 台車の速度 (自動で使う) |
| `/robot/pose` | `geometry_msgs/msg/Pose` | 受ける | 台車の位置と向き (自動で使う) |
| `/robot/dice_top` `/robot/carrying` | `std_msgs/msg/Int32` | 受ける | サイコロの上の目・持っている本数 |

`ros2 topic list` と `ros2 topic echo /operator/button` で、キーを押すと数が出ることを先に確かめておく。

## 説明

### Float64

`std_msgs/msg/Float64` は小数 1 つを入れるメッセージ。中身は `data` だけ。農場で使った `Int32` と同じ形で、型だけが `double` になる。

| コマンドでの型名 | C++ の型名 | include するファイル |
|---|---|---|
| `std_msgs/msg/Int32` | `std_msgs::msg::Int32` | `std_msgs/msg/int32.hpp` |
| `std_msgs/msg/Float64` | `std_msgs::msg::Float64` | `std_msgs/msg/float64.hpp` |

### 受け取ったら送る

ステージ 4 の「受けて送る」と同じ形。Subscriber の関数の中で、受け取った値を見て Publisher で送る。次の例は、`/number` で 3 を受け取ったら `/half` に 1.5 を送る (課題とは別の例)。

```cpp
sub_ = create_subscription<std_msgs::msg::Int32>(
  "/number", 10, [this](const std_msgs::msg::Int32 & m) {on_number(m);});
pub_ = create_publisher<std_msgs::msg::Float64>("/half", 10);
```

```cpp
void on_number(const std_msgs::msg::Int32 & m)
{
  if (m.data == 3) {
    std_msgs::msg::Float64 out;
    out.data = 1.5;
    pub_->publish(out);
  }
}
```

## 手順

1. `~/src26_ws/src/tutorial_nodes/src/semi_node.cpp` を作る。ステージ 4 の `board_node` などをコピーして始めるとよい。クラス名とノード名を `SemiNode` / `semi_node` にする。
2. Subscriber を作る: `/operator/button` を `std_msgs::msg::Int32` で受け取る。
3. Publisher を作る: `/robot/arm/lift` に `std_msgs::msg::Float64` を送る。
4. 受け取った関数の中で、`data` が 1 なら 0.12 を送る。
5. CMakeLists.txt に 1 行足す (package.xml の `std_msgs` は農場で足してある)。

```cmake
ament_auto_add_executable(semi_node src/semi_node.cpp)
```

6. ビルドして起動する。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes semi_node
```

7. 画面をクリックしてから 1 を押す。左上の「リフト」が 0.12 m になれば済み。

## ヒント

<details><summary>ヒント 1: include</summary>

```cpp
#include <rclcpp/rclcpp.hpp>
#include <std_msgs/msg/float64.hpp>
#include <std_msgs/msg/int32.hpp>
```

</details>

<details><summary>ヒント 2: メンバ変数</summary>

```cpp
rclcpp::Subscription<std_msgs::msg::Int32>::SharedPtr button_sub_;
rclcpp::Publisher<std_msgs::msg::Float64>::SharedPtr lift_pub_;
```

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **1 を押してもリフトが上がらない:** 別のターミナルで `ros2 topic echo /operator/button` を見る。何も出なければ、画面がキーを受け取っていない (画面をクリックする)。数が出るなら、`ros2 topic echo /robot/arm/lift` で自分のノードが送っているかを見る。
- **リフトは上がったのに済まない:** U キーで上げると数えない (右のパネルに「キーか CLI で動かした」と出る)。R で戻してから、1 で上げる。
- **`ros2 topic pub /robot/arm/lift ...` で試した:** CLI も数えない。試すのはよいが、課題は自分のノードで済ませる。

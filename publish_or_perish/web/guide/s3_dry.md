# 乾いたマスに水をやる

## やること

水分が 30 未満のマスに、自分のノードから 10 回水をやる。水やりは service `/bot1/water` で、ステージ 1 では `ros2 service call` で呼んだ。これをノードの中から呼ぶ。

動かすのと水をやるのを 2 つのノードに分ける。動かすのはステージ 4 の `patrol_node` をそのまま使い、水をやる `water_node` (`~/src26_ws/src/tutorial_nodes/src/water_node.cpp`) を新しく作る。

package.xml に `std_srvs` を足し、CMakeLists.txt に 1 行足す。

```xml
  <depend>std_srvs</depend>
```

```cmake
ament_auto_add_executable(water_node src/water_node.cpp)
```

ビルドしたら、ターミナルを 2 つ使って両方を起動する。`patrol_node` を先に起動し、数秒たってから `water_node` を起動する (農場が自分のノードを見つけるまで約 1 秒かかり、その前の水やりは数えない。同時に起動すると最初の 1 回が数えられないことがある)。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes patrol_node      # 1 つ目のターミナル
ros2 run tutorial_nodes water_node       # 2 つ目のターミナル
```

タンクは 10 回分なので、満タンから始めれば 10 回やれる。

## 使うもの

| 書き方 | 意味 |
|---|---|
| `#include <std_srvs/srv/trigger.hpp>` `using Trigger = std_srvs::srv::Trigger;` | service の型 `Trigger` を使う。空の要求を送ると `success` (bool) と `message` (文字列) が返る |
| `create_client<Trigger>("/bot1/water")` | service `/bot1/water` を呼ぶ Client を作る |
| `rclcpp::Client<Trigger>::SharedPtr` | Client をしまっておく変数の型 |
| `async_send_request(要求, 関数)` | 要求を送り、返事が来たら 2 つ目の関数を呼ぶ。返事を待たずにすぐ戻る |
| `std::make_shared<Trigger::Request>()` | 空の要求 |
| `[this](rclcpp::Client<Trigger>::SharedFuture future) {...}` | 返事を受け取る関数の書き方。返事は `future.get()->message` |

topic は送りっぱなし・受けっぱなしで、相手からの返事はない。service は呼ぶと返事が返る。「水をやった結果どうなったか」を知りたいので、水やりは service になっている。

## ヒント

<details><summary>ヒント 1: いつ水をやるか</summary>

`watch_node` と同じように、位置と水分を受け取って、タイマーの中で今いるマスの水分を見る。30 未満なら service を呼ぶ。次の 2 つを守らないと、同じマスに何回も水をやってタンクが減る。

- 返事を待っている間は、次を呼ばない。
- さっき水をやったマスには、もう 1 回やらない。水をやってから `/field/moisture` に反映されるまで最大 0.2 秒かかる。

</details>

<details><summary>ヒント 2: service を呼ぶ部分</summary>

```cpp
busy_ = true;
water_->async_send_request(
  std::make_shared<Trigger::Request>(),
  [this](rclcpp::Client<Trigger>::SharedFuture future) {
    RCLCPP_INFO(get_logger(), "%s", future.get()->message.c_str());
    busy_ = false;
  });
```

`busy_` が `true` の間は、タイマーの関数の頭で何もせずに戻る。水をやったマスの番号もメンバ変数に覚えておく。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **数が増えない:** 数えるのは「自分のノードだけが動いている」とき (右上の「運転」が「無人運転中」) だけ。`ros2 topic pub` や `ros2 service call` は止める。
- **`タンクが空` と出る:** 井戸 (左下のマス (0, 0)) に立つと満タンになる。`patrol_node` は畑を往復するうちに井戸を通るので、そのまま待てば補給される (試したときは起動から 80 秒ほどで通った)。タンクの残りは `ros2 topic echo /bot1/tank` で見られる。
- **ずっと同じマスで水をやり続ける:** 返事待ちの間に次を呼んでいるか、水をやったマスを覚えていない。
- **`async_send_request` のところでビルドエラー:** 2 つ目の引数の関数は `rclcpp::Client<Trigger>::SharedFuture` を受け取る形にする。

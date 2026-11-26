# 乾いたマスに水をやる

## やること

水分が 30 未満のマスに、自分のノードから 10 回水をやる。水やりは service `/bot1/water` で、ステージ 1 では `ros2 service call` で呼んだ。これをノードの中から呼ぶ。

このステージは **半自動** から始める。ロボットを動かすのはキー (W A S D)、水をやるのは自分のノード `water_node`。人が畑を走らせ、乾いたマスに乗ったところで `water_node` が水をやる。動かすのも自動にするのは、この後の課題「無人農場」。

- 書くのは `water_node` (`~/src26_ws/src/tutorial_nodes/src/water_node.cpp`)。動かす部分は書かない。
- キーの代わりに、ステージ 5 の `patrol_node` で動かしてもよい。

package.xml に `std_srvs` を足し、CMakeLists.txt に 1 行足す。

```xml
  <depend>std_srvs</depend>
```

```cmake
ament_auto_add_executable(water_node src/water_node.cpp)
```

ビルドして起動したら、畑の画面をクリックし、キーで畑の上を走らせる。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes water_node
```

タンクは 10 回分なので、満タンから始めれば 10 回やれる。空になったら、キーで井戸 (左下のマス (0, 0)) に乗る。

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

返事の `message` は英語で返る。ターミナルには次のように出る (ノードの名前と数は例)。

```output
[INFO] [1730000000.123456789] [dry_waterer]: {{msg:srv.water.done|x=3,y=1,before=12,after=72,tank=7,max=10}}
```

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **数が増えない:** 数えるのは自分のノードが呼んだ水やりだけ。キーの X や `ros2 service call` で水をやっても数えない。
- **{{msg:srv.water.tank_empty}} と出る:** 井戸 (左下のマス (0, 0)) にキーで乗ると満タンになる。タンクの残りは `ros2 topic echo /bot1/tank` で見られる。
- **ずっと同じマスで水をやり続ける:** 返事待ちの間に次を呼んでいるか、水をやったマスを覚えていない。
- **`async_send_request` のところでビルドエラー:** 2 つ目の引数の関数は `rclcpp::Client<Trigger>::SharedFuture` を受け取る形にする。

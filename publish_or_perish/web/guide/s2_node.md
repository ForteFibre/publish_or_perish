# C++ のノードから動かす

## やること

ステージ 1 では `ros2 topic pub` で `/bot1/cmd_vel` に速度を送った。同じことを、自分で書くノード `move_node` からする。bot1 が 3 m 進めばクリア。

- `ros2 topic pub` を動かしているターミナルがあれば Ctrl+C で止める (農場は、誰が送った速度かを見ている)。
- 書くのは `~/src26_ws/src/tutorial_nodes/src/move_node.cpp`。
- `geometry_msgs` を使うので、package.xml の `<depend>rclcpp</depend>` の下に 1 行足す。

```xml
  <depend>geometry_msgs</depend>
```

- CMakeLists.txt の `ament_auto_add_executable(hello_node ...)` の下に 1 行足す。

```cmake
ament_auto_add_executable(move_node src/move_node.cpp)
```

- ビルドして起動する。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes move_node
```

## 使うもの

| 書き方 | 意味 |
|---|---|
| `#include <geometry_msgs/msg/twist.hpp>` | 速度の型 `Twist` を使うための include |
| `create_publisher<geometry_msgs::msg::Twist>("/bot1/cmd_vel", 10)` | `/bot1/cmd_vel` に `Twist` を送る Publisher を作る。`10` は送りきれないときに溜めておく数 |
| `create_wall_timer(100ms, [this] {on_timer();})` | 100 ms ごとに `on_timer()` を呼ぶタイマーを作る。呼ばれるのは `rclcpp::spin` の中。`100ms` と書くには `#include <chrono>` と `using namespace std::chrono_literals;` が要る |
| `geometry_msgs::msg::Twist cmd;` `cmd.linear.x = 0.5;` | 前へ 0.5 m/s の速度。`linear.y` は左へ、`angular.z` は左回り [rad/s]。向きはロボットから見た向き |
| `pub_->publish(cmd)` | メッセージを送る |
| `rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr` | Publisher をしまっておく変数の型 |
| `rclcpp::TimerBase::SharedPtr` | タイマーをしまっておく変数の型 |

速度は 1 回送るだけでは足りない。農場のロボットは、最後に速度を受け取ってから 0.5 秒たつと止まる (実機と同じ安全のしくみ)。そのため、0.5 秒より短い間隔で送り続ける。

## ヒント

<details><summary>ヒント 1: どこから書き始めるか</summary>

`hello_node.cpp` をコピーして始める。クラス名とノード名を変え、コンストラクタで Publisher とタイマーを作る。速度を送るのは、タイマーが呼ぶ関数の中。Publisher とタイマーはメンバ変数にしまう。

</details>

<details><summary>ヒント 2: クラスの形</summary>

```cpp
class MoveNode : public rclcpp::Node
{
public:
  MoveNode() : Node("move_node")
  {
    // ここで pub_ と timer_ を作る
  }

private:
  void on_timer()
  {
    // ここで Twist を作って publish する
  }

  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};
```

`main` は `hello_node.cpp` と同じで、`HelloNode` を `MoveNode` に変える。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **進まない:** `ros2 topic pub` がまだ動いていると、どちらの速度が使われるか決まらない。右上の「運転」が「CLI で操作中」なら止める。
- **エラーは出ないのに進まない:** `pub_` や `timer_` をコンストラクタの中の変数 (`auto timer = ...`) にすると、コンストラクタが終わったところで消えて、何も送られない。メンバ変数にする。
- **途中で止まった:** 畑の端の柵に当たっている。`linear.x` をマイナスにして逆へ進ませる (ビルドし直して起動し直す)。
- **ビルドで `geometry_msgs/msg/twist.hpp` が見つからない:** package.xml に `<depend>geometry_msgs</depend>` がない。
- **`ros2 run` で `No executable found`:** CMakeLists.txt に `move_node` の行を足したあとビルドしていない。

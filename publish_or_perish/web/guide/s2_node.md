# C++ のノードから動かす

## やること

ステージ 1 では `ros2 topic pub` で `/bot1/cmd_vel` に速度を送った。同じことを自分のノードからする。

1. `ros2 topic pub` を動かしているターミナルがあれば Ctrl+C で止める (農場は、誰が送った速度かを見ている)。
2. `~/src26_ws/src/tutorial_nodes/src/move_node.cpp` を作り、次のコードを書く。

```cpp
#include <chrono>

#include <geometry_msgs/msg/twist.hpp>
#include <rclcpp/rclcpp.hpp>

using namespace std::chrono_literals;

class MoveNode : public rclcpp::Node
{
public:
  MoveNode() : Node("move_node")
  {
    pub_ = create_publisher<geometry_msgs::msg::Twist>("/bot1/cmd_vel", 10);
    timer_ = create_wall_timer(100ms, [this] {on_timer();});
  }

private:
  void on_timer()
  {
    geometry_msgs::msg::Twist cmd;
    cmd.linear.x = 0.5;   // 前へ 0.5 m/s
    pub_->publish(cmd);
  }

  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char * argv[])
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<MoveNode>());
  rclcpp::shutdown();
  return 0;
}
```

3. `geometry_msgs` を使うので、package.xml の `<depend>rclcpp</depend>` の下に 1 行足す。

```xml
  <depend>geometry_msgs</depend>
```

4. CMakeLists.txt の `ament_auto_add_executable(hello_node ...)` の下に 1 行足す。

```cmake
ament_auto_add_executable(move_node src/move_node.cpp)
```

5. ビルドして起動する。bot1 が前へ進み、3 m 進めばクリア。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes move_node
```

## コードの中身

| 部分 | 意味 |
|---|---|
| `create_publisher<geometry_msgs::msg::Twist>("/bot1/cmd_vel", 10)` | `/bot1/cmd_vel` に `Twist` 型のメッセージを送る Publisher を作る。`10` は送りきれないときに溜めておく数 |
| `create_wall_timer(100ms, ...)` | 100 ms ごとに `on_timer()` を呼ぶタイマーを作る。呼ばれるのは `rclcpp::spin` の中 |
| `cmd.linear.x = 0.5` | 前へ 0.5 m/s。`linear.y` は左へ、`angular.z` は左回り [rad/s]。向きはロボットから見た向き |
| `pub_->publish(cmd)` | メッセージを送る |
| `pub_` `timer_` をメンバにする | コンストラクタの中の変数にすると、コンストラクタが終わったときに消えて、送るのもタイマーも止まる |

速度は 1 回送るだけでは足りない。農場のロボットは、最後に速度を受け取ってから 0.5 秒たつと止まる (実機と同じ安全のしくみ)。そのため、0.5 秒より短い間隔 (ここでは 100 ms) で送り続ける。

## うまくいかないとき

- **進まない:** `ros2 topic pub` がまだ動いていると、どちらの速度が使われるか決まらない。右上の「運転」が「CLI で操作中」なら止める。
- **途中で止まった:** 畑の端の柵に当たっている。`cmd.linear.x = -0.5;` にして逆へ進ませる (ビルドし直して起動し直す)。
- **ビルドで `geometry_msgs/msg/twist.hpp` が見つからない:** package.xml に `<depend>geometry_msgs</depend>` がない。
- **`ros2 run` で `No executable found`:** CMakeLists.txt に `move_node` の行を足したあとビルドしていない。

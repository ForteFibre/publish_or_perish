# 畑を巡回する

## やること

自分のノードで bot1 を動かし、畑の 20 マスを通る。前の課題の `move_node` は前へ進むだけなので、時間で動きを切り替えるノードを作る。

`~/src26_ws/src/tutorial_nodes/src/patrol_node.cpp`:

```cpp
#include <chrono>

#include <geometry_msgs/msg/twist.hpp>
#include <rclcpp/rclcpp.hpp>

using namespace std::chrono_literals;

class PatrolNode : public rclcpp::Node
{
public:
  PatrolNode() : Node("patrol_node")
  {
    pub_ = create_publisher<geometry_msgs::msg::Twist>("/bot1/cmd_vel", 10);
    start_ = now();
    timer_ = create_wall_timer(100ms, [this] {on_timer();});
  }

private:
  void on_timer()
  {
    // 1 周 8 秒: 7 秒 横 (x) に進む → 1 秒 縦 (y) に 1 マスずれる. 周ごとに横の向きを逆にする
    const double t = (now() - start_).seconds();
    const int lap = static_cast<int>(t / 8.0);
    const double in_lap = t - lap * 8.0;
    geometry_msgs::msg::Twist cmd;
    if (in_lap < 7.0) {
      cmd.linear.x = (lap % 2 == 0) ? 1.0 : -1.0;
    } else {
      cmd.linear.y = (lap / 5 % 2 == 0) ? 1.0 : -1.0;   // 5 段ずれたら逆の向きにずれる
    }
    pub_->publish(cmd);
  }

  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
  rclcpp::Time start_;
};

int main(int argc, char * argv[])
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<PatrolNode>());
  rclcpp::shutdown();
  return 0;
}
```

CMakeLists.txt に 1 行足し、ビルドして起動する。`move_node` が動いていたら Ctrl+C で止めておく (2 つのノードが同じ topic に送ると、動きが混ざる)。

```cmake
ament_auto_add_executable(patrol_node src/patrol_node.cpp)
```

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes patrol_node
```

畑は横 8 マス × 縦 5 マス (1 マス = 1 m) なので、1 周で 1 行を端から端まで通る。3 周 (約 24 秒) で 20 マスを超える。ロボットが畑の途中から始めたときは、もう少しかかる。

## コードの中身

| 部分 | 意味 |
|---|---|
| `start_ = now()` | 起動した時刻を覚えておく |
| `(now() - start_).seconds()` | 起動してからの秒数。この値で、今どの動きをするかを決める |
| `lap` | 何周目か (0, 1, 2, ...)。偶数なら +x、奇数なら -x へ進む |
| `in_lap` | 周の中で何秒目か。7 秒までは横、残りの 1 秒は縦に動く |

ロボットは柵より外へは出ない。柵に当たっている間は止まったまま時間だけ進むので、端で少し待ってから次の動きに移る。

## うまくいかないとき

- **マスの数が増えない:** 数えるのは自分のノードが動かしている間だけ。`ros2 topic pub` や `move_node` が動いていたら止める。
- **右上の「あなたのノード」に `patrol_node` が出ない:** 農場と `ROS_DOMAIN_ID` が違うか、ノードが起動直後に終わっている。ターミナルにエラーが出ていないか見る。
- **斜めに進む:** ステージ 1 で `angular.z` を送ると、ロボットの向きが変わったまま残る。`linear.x` はロボットから見た前なので、向きが変わっていると斜めに進む。向きは `ros2 topic echo /bot1/pose` の `theta` [rad] で見られる (0 なら畑の x の向き)。斜めでもマスは通るので、課題はクリアできる。

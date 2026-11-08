# 乾いたマスに水をやる

## やること

水分が 30 未満のマスに、自分のノードから 10 回水をやる。水やりは service `/bot1/water` で、ステージ 1 では `ros2 service call` で呼んだ。これをノードの中から呼ぶ。

動かすのと水をやるのを 2 つのノードに分ける。動かすのはステージ 4 の `patrol_node` をそのまま使い、水をやる `water_node` を新しく作る。

`~/src26_ws/src/tutorial_nodes/src/water_node.cpp`:

```cpp
#include <chrono>
#include <cmath>

#include <geometry_msgs/msg/pose2_d.hpp>
#include <nav_msgs/msg/occupancy_grid.hpp>
#include <rclcpp/rclcpp.hpp>
#include <std_srvs/srv/trigger.hpp>

using namespace std::chrono_literals;
using Trigger = std_srvs::srv::Trigger;

class WaterNode : public rclcpp::Node
{
public:
  WaterNode() : Node("water_node")
  {
    pose_sub_ = create_subscription<geometry_msgs::msg::Pose2D>(
      "/bot1/pose", 10, [this](const geometry_msgs::msg::Pose2D & msg) {pose_ = msg;});
    moist_sub_ = create_subscription<nav_msgs::msg::OccupancyGrid>(
      "/field/moisture", 10, [this](const nav_msgs::msg::OccupancyGrid & msg) {moisture_ = msg;});
    water_ = create_client<Trigger>("/bot1/water");
    timer_ = create_wall_timer(200ms, [this] {on_timer();});
  }

private:
  void on_timer()
  {
    if (moisture_.data.empty() || busy_) {
      return;   // まだ畑を受け取っていない / 前に呼んだ service の返事を待っている
    }
    const int x = static_cast<int>(std::floor(pose_.x));
    const int y = static_cast<int>(std::floor(pose_.y));
    const int m = moisture_.data[y * moisture_.info.width + x];
    if (m >= 30 || (x == last_x_ && y == last_y_)) {
      return;   // 乾いていない / さっき水をやったマス (畑の水分に反映されるまで少しかかる)
    }
    busy_ = true;
    last_x_ = x;
    last_y_ = y;
    water_->async_send_request(
      std::make_shared<Trigger::Request>(),
      [this](rclcpp::Client<Trigger>::SharedFuture future) {
        RCLCPP_INFO(get_logger(), "%s", future.get()->message.c_str());
        busy_ = false;
      });
  }

  geometry_msgs::msg::Pose2D pose_;
  nav_msgs::msg::OccupancyGrid moisture_;
  bool busy_ = false;
  int last_x_ = -1, last_y_ = -1;
  rclcpp::Subscription<geometry_msgs::msg::Pose2D>::SharedPtr pose_sub_;
  rclcpp::Subscription<nav_msgs::msg::OccupancyGrid>::SharedPtr moist_sub_;
  rclcpp::Client<Trigger>::SharedPtr water_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char * argv[])
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<WaterNode>());
  rclcpp::shutdown();
  return 0;
}
```

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

`patrol_node` が畑を回り、`water_node` が乾いたマスに来るたびに水をやる。タンクは 10 回分なので、満タンから始めれば 10 回やれる。

## コードの中身

| 部分 | 意味 |
|---|---|
| `create_client<Trigger>("/bot1/water")` | service `/bot1/water` を呼ぶ Client を作る。型 `std_srvs/srv/Trigger` は、空の要求を送ると `success` (bool) と `message` (文字列) が返る |
| `async_send_request(要求, 関数)` | 要求を送り、返事が来たら 2 つ目の関数を呼ぶ。返事を待たずにすぐ戻る |
| `busy_` | 返事を待っている間は次を送らない。送り続けると、同じマスに何回も水をやってタンクが減る |
| `last_x_` `last_y_` | 最後に水をやったマス。水をやってから `/field/moisture` に反映されるまで最大 0.2 秒かかるので、その間に同じマスへもう 1 回やらないようにする |

topic は送りっぱなし・受けっぱなしで、相手からの返事はない。service は呼ぶと返事が返る。「水をやった結果どうなったか」を知りたいので、水やりは service になっている。

## うまくいかないとき

- **数が増えない:** 数えるのは「自分のノードだけが動いている」とき (右上の「運転」が「無人運転中」) だけ。`ros2 topic pub` や `ros2 service call` は止める。
- **`タンクが空` と出る:** 井戸 (左下のマス (0, 0)) に立つと満タンになる。`patrol_node` は畑を往復するうちに井戸を通るので、そのまま待てば補給される (試したときは起動から 80 秒ほどで通った)。タンクの残りは `ros2 topic echo /bot1/tank` で見られる。
- **ずっと同じマスで水をやり続ける:** `busy_` か `last_x_` / `last_y_` の書き忘れ。
- **`async_send_request` のところでビルドエラー:** 2 つ目の引数の関数は `rclcpp::Client<Trigger>::SharedFuture` を受け取る形にする。

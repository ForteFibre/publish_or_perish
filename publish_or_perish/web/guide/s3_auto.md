# 無人農場

## やること

CLI を使わず、自分のノードだけで 60 秒の間に 100 G 稼ぐ。小麦は 5 G で植えて 25 G で売れるので、60 秒の間に 4 個以上収穫する。

小麦が実るまでの決まり:

| 決まり | 値 |
|---|---|
| 実るまで | 水分が 20 以上の時間が合計 30 秒 |
| 水分 | 1 回の水やりで +60。何もしないと 1 秒に 2.2 ずつ減る (45 秒で 100 → 0) |
| 実ってから | 40 秒で枯れる。枯れたものも収穫 (片付け) できるが 0 G |
| タンク | 10 回分。井戸 (マス (0, 0)) に立つと満タン |

1 つずつ植えて待つと 1 個に 30 秒以上かかるので、いくつかを同時に育てる。ここまでに作った「動かす」「受け取る」「service を呼ぶ」を 1 つのノードにまとめ、次の順で判断させる。

1. タンクが空なら、井戸へ行く
2. 実ったマス (または枯れたマス) があれば、そこへ行って収穫する
3. 育っている途中で水分が 35 未満のマスがあれば、そこへ行って水をやる
4. 育てている数が 10 未満なら、空いているマスへ行って種をまく

同じ優先度のマスが複数あれば、近いものから選ぶ。

`~/src26_ws/src/tutorial_nodes/src/farmer_node.cpp`:

```cpp
#include <algorithm>
#include <chrono>
#include <cmath>
#include <limits>

#include <geometry_msgs/msg/pose2_d.hpp>
#include <geometry_msgs/msg/twist.hpp>
#include <nav_msgs/msg/occupancy_grid.hpp>
#include <rclcpp/rclcpp.hpp>
#include <std_msgs/msg/int32.hpp>
#include <std_srvs/srv/trigger.hpp>

using namespace std::chrono_literals;
using Trigger = std_srvs::srv::Trigger;

class FarmerNode : public rclcpp::Node
{
public:
  FarmerNode() : Node("farmer")
  {
    max_crops_ = declare_parameter("max_crops", 10);   // 同時に育てる数
    x_min_ = declare_parameter("x_min", 0);            // 受け持つ列 (x_min <= x < x_max). ステージ 7 で使う
    x_max_ = declare_parameter("x_max", 100);
    pose_sub_ = create_subscription<geometry_msgs::msg::Pose2D>(
      "/bot1/pose", 10, [this](const geometry_msgs::msg::Pose2D & msg) {pose_ = msg; has_pose_ = true;});
    tank_sub_ = create_subscription<std_msgs::msg::Int32>(
      "/bot1/tank", 10, [this](const std_msgs::msg::Int32 & msg) {tank_ = msg.data;});
    moist_sub_ = create_subscription<nav_msgs::msg::OccupancyGrid>(
      "/field/moisture", 10, [this](const nav_msgs::msg::OccupancyGrid & msg) {moisture_ = msg; stale_ = false;});
    crops_sub_ = create_subscription<nav_msgs::msg::OccupancyGrid>(
      "/field/crops", 10, [this](const nav_msgs::msg::OccupancyGrid & msg) {crops_ = msg;});
    cmd_pub_ = create_publisher<geometry_msgs::msg::Twist>("/bot1/cmd_vel", 10);
    plant_ = create_client<Trigger>("/bot1/plant");
    water_ = create_client<Trigger>("/bot1/water");
    harvest_ = create_client<Trigger>("/bot1/harvest");
    timer_ = create_wall_timer(100ms, [this] {on_timer();});
  }

private:
  enum class Job { None, Refill, Harvest, Water, Plant };

  int at(const nav_msgs::msg::OccupancyGrid & g, int x, int y) const
  {
    return g.data[y * g.info.width + x];
  }

  // 次に行くマス (tx_, ty_) とやること (job_) を決める
  void choose()
  {
    job_ = Job::None;
    if (tank_ == 0) {
      job_ = Job::Refill;
      tx_ = 0;
      ty_ = 0;
      return;
    }
    const int w = crops_.info.width, h = crops_.info.height;
    const int x0 = std::max(0, x_min_), x1 = std::min(w, x_max_);
    int growing = 0;
    for (int y = 0; y < h; ++y) {
      for (int x = x0; x < x1; ++x) {
        if (at(crops_, x, y) >= 0) {growing++;}
      }
    }
    // 優先度は「距離 + 罰点」で比べる. 罰点が大きいほど後回し
    double best = std::numeric_limits<double>::max();
    auto consider = [&](Job job, int x, int y, double penalty) {
        const double d = std::hypot(x + 0.5 - pose_.x, y + 0.5 - pose_.y) + penalty;
        if (d < best) {best = d; job_ = job; tx_ = x; ty_ = y;}
      };
    for (int y = 0; y < h; ++y) {
      for (int x = x0; x < x1; ++x) {
        if (x == 0 && y == 0) {continue;}   // 井戸には植えられない
        const int c = at(crops_, x, y), m = at(moisture_, x, y);
        if (c == 100 || c == -2) {
          consider(Job::Harvest, x, y, 0.0);
        } else if (c >= 0 && m < 35) {
          consider(Job::Water, x, y, 0.5);
        } else if (c == -1 && growing < max_crops_) {
          consider(Job::Plant, x, y, 3.0);
        }
      }
    }
  }

  void on_timer()
  {
    // 畑をまだ受け取っていない / service の返事待ち / 返事のあとの畑がまだ届いていない
    if (!has_pose_ || crops_.data.empty() || moisture_.data.empty() || busy_ || stale_) {
      return;
    }
    if (job_ == Job::None) {choose();}
    if (job_ == Job::None) {return;}
    // マスの中心へ近づく. 畑の座標の差を, ロボットから見た向きに回してから速度にする
    const double ex = tx_ + 0.5 - pose_.x, ey = ty_ + 0.5 - pose_.y;
    geometry_msgs::msg::Twist cmd;
    if (std::hypot(ex, ey) > 0.12) {
      const double c = std::cos(pose_.theta), s = std::sin(pose_.theta);
      cmd.linear.x = std::clamp(2.0 * (c * ex + s * ey), -1.2, 1.2);
      cmd.linear.y = std::clamp(2.0 * (-s * ex + c * ey), -1.2, 1.2);
      cmd.angular.z = -2.0 * pose_.theta;   // 向きを 0 に戻していく
      cmd_pub_->publish(cmd);
      return;
    }
    cmd_pub_->publish(cmd);   // 着いたので止まる (全部 0)
    if (job_ == Job::Refill) {
      job_ = Job::None;   // 井戸に立った時点で満タンになっている
      return;
    }
    auto client = (job_ == Job::Harvest) ? harvest_ : (job_ == Job::Water) ? water_ : plant_;
    busy_ = true;
    client->async_send_request(
      std::make_shared<Trigger::Request>(),
      [this](rclcpp::Client<Trigger>::SharedFuture future) {
        RCLCPP_INFO(get_logger(), "%s", future.get()->message.c_str());
        busy_ = false;
        stale_ = true;   // 次の /field/moisture が届くまで次を決めない
        job_ = Job::None;
      });
  }

  int max_crops_, x_min_, x_max_;
  geometry_msgs::msg::Pose2D pose_;
  bool has_pose_ = false, busy_ = false, stale_ = false;
  int tank_ = 10;
  nav_msgs::msg::OccupancyGrid moisture_, crops_;
  Job job_ = Job::None;
  int tx_ = 0, ty_ = 0;
  rclcpp::Subscription<geometry_msgs::msg::Pose2D>::SharedPtr pose_sub_;
  rclcpp::Subscription<std_msgs::msg::Int32>::SharedPtr tank_sub_;
  rclcpp::Subscription<nav_msgs::msg::OccupancyGrid>::SharedPtr moist_sub_, crops_sub_;
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr cmd_pub_;
  rclcpp::Client<Trigger>::SharedPtr plant_, water_, harvest_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char * argv[])
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<FarmerNode>());
  rclcpp::shutdown();
  return 0;
}
```

package.xml に `std_msgs` を足し、CMakeLists.txt に 1 行足す。

```xml
  <depend>std_msgs</depend>
```

```cmake
ament_auto_add_executable(farmer_node src/farmer_node.cpp)
```

ほかのノード (`patrol_node` `water_node` など) を Ctrl+C で止めてから起動する。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes farmer_node
```

最初の 1 個が実るまでに 30 秒以上かかるので、100 G に届くのは起動して 1〜2 分後。課題の欄の数字は「直近 60 秒に稼いだ額」の最大値。

## コードの中身

| 部分 | 意味 |
|---|---|
| `choose()` | 上の 1〜4 の順で、次に行くマスとやることを決める。`consider` に渡す罰点 (0 / 0.5 / 3.0) で優先度を付けている。罰点 3.0 は「3 m 遠い」のと同じ扱い |
| `on_timer()` の前半 | 決めたマスの中心へ向かう速度を送る。中心まで 0.12 m 以内なら着いたとする |
| 座標を回す 2 行 | `cmd_vel` はロボットから見た向き (x 前・y 左)、`pose` は畑の向き。ロボットが `theta` 回っていると両者がずれるので、`-theta` 回して合わせる |
| `busy_` `stale_` | service の返事を待つ間と、返事のあとの畑がまだ届いていない間は、次を決めない。古い畑を見て同じマスに 2 回水をやるのを防ぐ |
| `declare_parameter` | 起動するときに値を変えられる設定 (パラメータ)。ステージ 6・7 で使う |

## うまくいかないとき

- **数字が 0 のまま:** 数えるのは「無人運転中」(CLI のノードがなく、自分のノードだけ) の間の収穫だけ。CLI を全部止める。途中で CLI を使うと、そこから 60 秒を数え直す。
- **枯れるものが多い:** 同時に育てる数が多すぎて水やりが追いつかない。`ros2 run tutorial_nodes farmer_node --ros-args -p max_crops:=6` のように減らす。
- **ロボットが同じところで震える:** `cmd.linear` の `2.0` (近づく速さ) が大きすぎる。1.0 くらいに下げる。

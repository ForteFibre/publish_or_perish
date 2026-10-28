// ステージ 3・5 の解答例: 畑を見て, 収穫 → 水やり → 種まき を自動で回す.
//   subscribe: pose (Pose2D), tank (Int32), /field/moisture, /field/crops (OccupancyGrid)
//   publish  : cmd_vel
//   service  : plant, water, harvest (std_srvs/Trigger)
// ロボットの topic は / なしの名前なので, namespace でどのロボットにつなぐかが決まる.
//   ros2 run publish_or_perish_answers stage3_farmer --ros-args -r __ns:=/bot1
// 担当する列は x_min <= x < x_max (パラメータ). 2 台で畑を分けるときに使う (stage5_two_bots.launch.xml)
#include <algorithm>
#include <chrono>
#include <cmath>
#include <limits>

#include "geometry_msgs/msg/pose2_d.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "nav_msgs/msg/occupancy_grid.hpp"
#include "rclcpp/rclcpp.hpp"
#include "std_msgs/msg/int32.hpp"
#include "std_srvs/srv/trigger.hpp"

using namespace std::chrono_literals;
using Trigger = std_srvs::srv::Trigger;

class Farmer : public rclcpp::Node
{
public:
  Farmer()
  : Node("farmer")
  {
    max_crops_ = declare_parameter("max_crops", 10);  // 同時に育てる数. 多すぎると水やりが追いつかない
    x_min_ = declare_parameter("x_min", 0);
    x_max_ = declare_parameter("x_max", 100);
    pose_sub_ = create_subscription<geometry_msgs::msg::Pose2D>(
      "pose", 10, [this](const geometry_msgs::msg::Pose2D & m) {pose_ = m; has_pose_ = true;});
    tank_sub_ = create_subscription<std_msgs::msg::Int32>(
      "tank", 10, [this](const std_msgs::msg::Int32 & m) {tank_ = m.data;});
    auto qos = rclcpp::QoS(1).transient_local();
    moist_sub_ = create_subscription<nav_msgs::msg::OccupancyGrid>(
      "/field/moisture", qos, [this](const nav_msgs::msg::OccupancyGrid & m) {moisture_ = m; stale_ = false;});
    crops_sub_ = create_subscription<nav_msgs::msg::OccupancyGrid>(
      "/field/crops", qos, [this](const nav_msgs::msg::OccupancyGrid & m) {crops_ = m;});
    cmd_pub_ = create_publisher<geometry_msgs::msg::Twist>("cmd_vel", 10);
    plant_ = create_client<Trigger>("plant");
    water_ = create_client<Trigger>("water");
    harvest_ = create_client<Trigger>("harvest");
    timer_ = create_wall_timer(100ms, [this] {on_timer();});
  }

private:
  enum class Job { None, Harvest, Water, Plant, Refill };

  // マス (x, y) の値. data[y * width + x]
  int at(const nav_msgs::msg::OccupancyGrid & g, int x, int y) const
  {
    return g.data[y * g.info.width + x];
  }

  // 次に行くマスとやることを決める. 近いマスを優先する
  void choose()
  {
    const int w = crops_.info.width, h = crops_.info.height;
    int growing = 0;
    for (int y = 0; y < h; ++y) {
      for (int x = std::max(0, x_min_); x < std::min(w, x_max_); ++x) {growing += (at(crops_, x, y) >= 0) ? 1 : 0;}
    }
    double best = std::numeric_limits<double>::max();
    job_ = Job::None;
    auto consider = [&](Job j, int x, int y, double penalty) {
        const double d = std::hypot(x + 0.5 - pose_.x, y + 0.5 - pose_.y) + penalty;
        if (d < best) {best = d; job_ = j; tx_ = x; ty_ = y;}
      };
    if (tank_ == 0) {
      job_ = Job::Refill;
      tx_ = ty_ = 0;  // 井戸は (0, 0)
      return;
    }
    for (int y = 0; y < h; ++y) {
      for (int x = std::max(0, x_min_); x < std::min(w, x_max_); ++x) {
        if (x == 0 && y == 0) {continue;}
        const int c = at(crops_, x, y), m = at(moisture_, x, y);
        if (c == 100 || c == -2) {consider(Job::Harvest, x, y, 0.0);}
        else if (c >= 0 && m < 35) {consider(Job::Water, x, y, 0.5);}
        else if (c == -1 && growing < max_crops_) {consider(Job::Plant, x, y, 3.0);}
      }
    }
  }

  void on_timer()
  {
    // service の結果が畑の topic に反映されるまで次を決めない (古い水分で同じマスに水をやり続けないため)
    if (!has_pose_ || crops_.data.empty() || moisture_.data.empty() || busy_ || stale_) {return;}
    if (job_ == Job::None) {choose();}
    if (job_ == Job::None) {return;}
    // マスの中心へ P 制御で近づく (field 座標の誤差を機体座標に回す)
    const double ex = tx_ + 0.5 - pose_.x, ey = ty_ + 0.5 - pose_.y;
    geometry_msgs::msg::Twist cmd;
    if (std::hypot(ex, ey) > 0.12) {
      const double c = std::cos(pose_.theta), s = std::sin(pose_.theta);
      cmd.linear.x = std::clamp(2.0 * (c * ex + s * ey), -1.2, 1.2);
      cmd.linear.y = std::clamp(2.0 * (-s * ex + c * ey), -1.2, 1.2);
      cmd.angular.z = -2.0 * pose_.theta;
      cmd_pub_->publish(cmd);
      return;
    }
    cmd_pub_->publish(cmd);  // 止まる
    if (job_ == Job::Refill) {
      job_ = Job::None;  // 井戸に立つと満タンになる
      return;
    }
    auto client = job_ == Job::Harvest ? harvest_ : job_ == Job::Water ? water_ : plant_;
    busy_ = true;
    client->async_send_request(
      std::make_shared<Trigger::Request>(), [this](rclcpp::Client<Trigger>::SharedFuture f) {
        RCLCPP_INFO(get_logger(), "%s", f.get()->message.c_str());
        busy_ = false;
        stale_ = true;
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

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<Farmer>());
  rclcpp::shutdown();
  return 0;
}

// ステージ 6「半自動の農場」の解答例: 移動はキー (人), 乗っているマスで 種まき・水やり・収穫 を決めて呼ぶ.
//   subscribe: /bot1/pose (Pose), /field/crops, /field/moisture (OccupancyGrid)
//   service  : /bot1/plant, /bot1/water, /bot1/harvest (std_srvs/Trigger)
#include <chrono>
#include <cmath>

#include "geometry_msgs/msg/pose.hpp"
#include "nav_msgs/msg/occupancy_grid.hpp"
#include "rclcpp/rclcpp.hpp"
#include "std_srvs/srv/trigger.hpp"

using namespace std::chrono_literals;
using Trigger = std_srvs::srv::Trigger;
using Grid = nav_msgs::msg::OccupancyGrid;

class SemiFarmer : public rclcpp::Node
{
public:
  SemiFarmer()
  : Node("semi_farmer")
  {
    pose_sub_ = create_subscription<geometry_msgs::msg::Pose>(
      "/bot1/pose", 10, [this](const geometry_msgs::msg::Pose & m) {pose_ = m.position; has_pose_ = true;});
    auto qos = rclcpp::QoS(1).transient_local();
    crops_sub_ = create_subscription<Grid>("/field/crops", qos, [this](const Grid & m) {crops_ = m; stale_ = false;});
    moist_sub_ = create_subscription<Grid>("/field/moisture", qos, [this](const Grid & m) {moisture_ = m;});
    plant_ = create_client<Trigger>("/bot1/plant");
    water_ = create_client<Trigger>("/bot1/water");
    harvest_ = create_client<Trigger>("/bot1/harvest");
    timer_ = create_wall_timer(100ms, [this] {on_timer();});
  }

private:
  void on_timer()
  {
    if (!has_pose_ || busy_ || stale_ || crops_.data.empty() || moisture_.data.empty()) {return;}
    const int w = crops_.info.width, h = crops_.info.height;
    const int x = static_cast<int>(std::floor(pose_.x)), y = static_cast<int>(std::floor(pose_.y));
    if (x < 0 || x >= w || y < 0 || y >= h) {return;}
    const int crop = crops_.data[y * w + x], moist = moisture_.data[y * w + x];
    if (crop == 100 || crop == -2) {
      call(harvest_);
    } else if (crop == -1 && !(x == 0 && y == 0)) {
      call(plant_);
    } else if (crop >= 0 && crop < 100 && moist < 35) {
      call(water_);
    }
  }

  void call(rclcpp::Client<Trigger>::SharedPtr client)
  {
    busy_ = true;
    client->async_send_request(
      std::make_shared<Trigger::Request>(),
      [this](rclcpp::Client<Trigger>::SharedFuture f) {
        RCLCPP_INFO(get_logger(), "%s", f.get()->message.c_str());
        busy_ = false;
        stale_ = true;   // 次の /field/crops が届くまで, 畑は古いまま
      });
  }

  rclcpp::Subscription<geometry_msgs::msg::Pose>::SharedPtr pose_sub_;
  rclcpp::Subscription<Grid>::SharedPtr crops_sub_, moist_sub_;
  rclcpp::Client<Trigger>::SharedPtr plant_, water_, harvest_;
  rclcpp::TimerBase::SharedPtr timer_;
  geometry_msgs::msg::Point pose_;   // 足元のマスだけ使うので, 位置だけ覚える
  Grid crops_, moisture_;
  bool has_pose_ = false, busy_ = false, stale_ = false;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<SemiFarmer>());
  rclcpp::shutdown();
  return 0;
}

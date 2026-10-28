// ステージ 2 の解答例: タイマーで /bot1/cmd_vel を publish し, 畝に沿って往復する.
// 位置は見ない. 経過時間だけで「横に進む → 1 マス上へ → 逆向きに進む」を繰り返す.
#include <chrono>

#include "geometry_msgs/msg/twist.hpp"
#include "rclcpp/rclcpp.hpp"

using namespace std::chrono_literals;

class Patrol : public rclcpp::Node
{
public:
  Patrol()
  : Node("patrol")
  {
    pub_ = create_publisher<geometry_msgs::msg::Twist>("/bot1/cmd_vel", 10);
    start_ = now();
    timer_ = create_wall_timer(100ms, [this] {on_timer();});
  }

private:
  void on_timer()
  {
    // 1 周期 = 横に 7 秒 + 上に 1 秒
    const double t = (now() - start_).seconds();
    const int lap = static_cast<int>(t / 8.0);
    const double in_lap = t - lap * 8.0;
    geometry_msgs::msg::Twist cmd;
    if (in_lap < 7.0) {
      cmd.linear.x = (lap % 2 == 0) ? 1.0 : -1.0;
    } else {
      cmd.linear.y = (lap / 5 % 2 == 0) ? 1.0 : -1.0;  // 5 段上ったら下りに変える
    }
    pub_->publish(cmd);
  }

  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
  rclcpp::Time start_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<Patrol>());
  rclcpp::shutdown();
  return 0;
}

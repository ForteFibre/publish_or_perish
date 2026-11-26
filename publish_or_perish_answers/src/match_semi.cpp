// 大会モード 練習「半自動」の解答例: 走るのは人 (キー), 機構は自分のノード.
//   画面の数字キー → /operator/button (Int32) を受けて, 決まった動きを順にする.
//     1: つかむ   (アームを縮め, リフトを下ろす → /robot/grab → リフトを 0.12 m に上げる)
//     2: 置く     (リフトを 0.12 m, アームを伸ばす → リフトを下ろす → /robot/place → リフトを上げる)
//     3: サイコロ (/robot/dice)
//     4: 合図     (/robot/signal)
//   publish  : /robot/arm/extend, /robot/arm/lift (Float64)
//   subscribe: /operator/button (Int32), /robot/arm/extend_now, /robot/arm/lift_now (Float64)
//   service  : /robot/grab, /robot/place, /robot/dice, /robot/signal (std_srvs/Trigger)
#include <chrono>
#include <cmath>
#include <map>
#include <string>
#include <vector>

#include "rclcpp/rclcpp.hpp"
#include "std_msgs/msg/float64.hpp"
#include "std_msgs/msg/int32.hpp"
#include "std_srvs/srv/trigger.hpp"

using namespace std::chrono_literals;
using Float64 = std_msgs::msg::Float64;
using Trigger = std_srvs::srv::Trigger;

class SemiNode : public rclcpp::Node
{
public:
  SemiNode()
  : Node("semi_node")
  {
    extend_pub_ = create_publisher<Float64>("/robot/arm/extend", 10);
    lift_pub_ = create_publisher<Float64>("/robot/arm/lift", 10);
    extend_sub_ = create_subscription<Float64>(
      "/robot/arm/extend_now", 10, [this](const Float64 & m) {extend_now_ = m.data;});
    lift_sub_ = create_subscription<Float64>(
      "/robot/arm/lift_now", 10, [this](const Float64 & m) {lift_now_ = m.data;});
    button_sub_ = create_subscription<std_msgs::msg::Int32>(
      "/operator/button", 10, [this](const std_msgs::msg::Int32 & m) {on_button(m.data);});
    for (const auto * name : {"grab", "place", "dice", "signal"}) {
      clients_[name] = create_client<Trigger>(std::string("/robot/") + name);
    }
    timer_ = create_wall_timer(50ms, [this] {on_timer();});
  }

private:
  // 動きの 1 段. Arm: アームとリフトの目標を出して, 着くまで待つ. Call: service を呼んで, 返事が来るまで待つ
  struct Step
  {
    enum Kind { Arm, Call } kind;
    double extend, lift;   // Arm のときの目標 [m]. 負なら変えない
    std::string service;   // Call のときの名前
  };

  void on_button(int n)
  {
    if (!steps_.empty()) {
      RCLCPP_WARN(get_logger(), "前の動きの途中なので, ボタン %d は受け付けない", n);
      return;
    }
    if (n == 1) {
      steps_ = {{Step::Arm, 0.0, 0.0, ""}, {Step::Call, -1, -1, "grab"}, {Step::Arm, -1, 0.12, ""}};
    } else if (n == 2) {
      steps_ = {{Step::Arm, -1, 0.12, ""}, {Step::Arm, 0.42, -1, ""}, {Step::Arm, -1, 0.0, ""},
        {Step::Call, -1, -1, "place"}, {Step::Arm, -1, 0.12, ""}};
    } else if (n == 3) {
      steps_ = {{Step::Call, -1, -1, "dice"}};
    } else if (n == 4) {
      steps_ = {{Step::Call, -1, -1, "signal"}};
    }
    started_ = false;
    RCLCPP_INFO(get_logger(), "ボタン %d: %zu 段の動きを始める", n, steps_.size());
  }

  void on_timer()
  {
    if (steps_.empty()) {return;}
    Step & s = steps_.front();
    if (s.kind == Step::Arm) {
      if (!started_) {
        if (s.extend >= 0) {extend_target_ = s.extend;}
        if (s.lift >= 0) {lift_target_ = s.lift;}
        Float64 e, l;
        e.data = extend_target_;
        l.data = lift_target_;
        extend_pub_->publish(e);
        lift_pub_->publish(l);
        started_ = true;
        start_time_ = now();
      }
      // 目標との差が 5 mm 以内になったら次へ. 3 秒たっても着かなければあきらめて次へ
      const bool there = std::abs(extend_now_ - extend_target_) < 0.005 && std::abs(lift_now_ - lift_target_) < 0.005;
      if (there || (now() - start_time_).seconds() > 3.0) {next();}
    } else {
      if (!started_) {
        started_ = true;
        waiting_ = true;
        clients_[s.service]->async_send_request(
          std::make_shared<Trigger::Request>(),
          [this](rclcpp::Client<Trigger>::SharedFuture f) {
            RCLCPP_INFO(get_logger(), "%s", f.get()->message.c_str());
            waiting_ = false;
          });
      }
      if (!waiting_) {next();}
    }
  }

  void next()
  {
    steps_.erase(steps_.begin());
    started_ = false;
  }

  rclcpp::Publisher<Float64>::SharedPtr extend_pub_, lift_pub_;
  rclcpp::Subscription<Float64>::SharedPtr extend_sub_, lift_sub_;
  rclcpp::Subscription<std_msgs::msg::Int32>::SharedPtr button_sub_;
  std::map<std::string, rclcpp::Client<Trigger>::SharedPtr> clients_;
  rclcpp::TimerBase::SharedPtr timer_;
  std::vector<Step> steps_;
  bool started_ = false, waiting_ = false;
  rclcpp::Time start_time_;
  double extend_now_ = 0, lift_now_ = 0, extend_target_ = 0, lift_target_ = 0;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<SemiNode>());
  rclcpp::shutdown();
  return 0;
}

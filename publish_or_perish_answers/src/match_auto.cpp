// 大会モード 練習「自動」の解答例: 人は何もせず, 自分のノードだけで満開宣言まで.
//   スタートゾーン → サイコロを 6 に → 桜ゾーンで 6 本つかむ → 共通ゾーン 1〜6 に置く
//   → もう 6 本つかむ → 7〜12 に置く → 合図 (満開宣言)
//   publish  : /robot/cmd_vel (Twist), /robot/arm/extend, /robot/arm/lift (Float64)
//   subscribe: /robot/pose (Pose), /robot/arm/extend_now, /robot/arm/lift_now (Float64), /robot/dice_top (Int32)
//   service  : /robot/grab, /robot/place, /robot/dice, /robot/signal (std_srvs/Trigger)
// 位置は /robot/pose の座標 (原点はフィールドの中心, x 右, y 奥, 向き 0 = +x).
#include <algorithm>
#include <chrono>
#include <cmath>
#include <map>
#include <string>
#include <vector>

#include "geometry_msgs/msg/pose.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "rclcpp/rclcpp.hpp"
#include "std_msgs/msg/float64.hpp"
#include "std_msgs/msg/int32.hpp"
#include "std_srvs/srv/trigger.hpp"

using namespace std::chrono_literals;
using Float64 = std_msgs::msg::Float64;
using Trigger = std_srvs::srv::Trigger;

class AutoNode : public rclcpp::Node
{
public:
  AutoNode()
  : Node("auto_node")
  {
    cmd_pub_ = create_publisher<geometry_msgs::msg::Twist>("/robot/cmd_vel", 10);
    extend_pub_ = create_publisher<Float64>("/robot/arm/extend", 10);
    lift_pub_ = create_publisher<Float64>("/robot/arm/lift", 10);
    pose_sub_ = create_subscription<geometry_msgs::msg::Pose>(
      "/robot/pose", 10, [this](const geometry_msgs::msg::Pose & m) {
        // 向きはクォータニオン. 床の上で回るだけなので, z と w から角度 [rad] が求まる
        x_ = m.position.x;
        y_ = m.position.y;
        th_ = 2.0 * std::atan2(m.orientation.z, m.orientation.w);
        has_pose_ = true;
      });
    extend_sub_ = create_subscription<Float64>(
      "/robot/arm/extend_now", 10, [this](const Float64 & m) {extend_now_ = m.data;});
    lift_sub_ = create_subscription<Float64>(
      "/robot/arm/lift_now", 10, [this](const Float64 & m) {lift_now_ = m.data;});
    dice_sub_ = create_subscription<std_msgs::msg::Int32>(
      "/robot/dice_top", 10, [this](const std_msgs::msg::Int32 & m) {dice_top_ = m.data;});
    for (const auto * name : {"grab", "place", "dice", "signal"}) {
      clients_[name] = create_client<Trigger>(std::string("/robot/") + name);
    }
    plan();
    timer_ = create_wall_timer(50ms, [this] {on_timer();});
  }

private:
  struct Step
  {
    enum Kind { Goto, Arm, Call, Dice6 } kind;
    double a = 0, b = 0, c = 0;   // Goto: x, y, 向き / Arm: 伸び, 高さ (負なら変えない)
    std::string service;
  };
  static Step go(double x, double y, double yaw) {return {Step::Goto, x, y, yaw, ""};}
  static Step arm(double extend, double lift) {return {Step::Arm, extend, lift, 0, ""};}
  static Step call(const std::string & s) {return {Step::Call, 0, 0, 0, s};}

  // やることの順番. 数字は試して決めた位置 [m]
  void plan()
  {
    // サイコロ: スタートゾーンで右 (+x) を向き, サイコロの手前へ. 6 になるまで転がす
    steps_ = {go(-3.112, -3.112, 0), go(-0.82, -3.118, 0), {Step::Dice6, 0, 0, 0, ""}};
    // 1 回目: 桜ゾーンの手前の 3 段 (y 1.40〜1.55) を, 右の 2 列ぶんつかむ
    fetch(1.475);
    deliver({1, 2, 3, 4, 5, 6});
    // 2 回目: 奥の 2 段 (y 2.04, 2.115) を 3 列ぶん
    fetch(2.0775, true);
    deliver({7, 8, 9, 10, 11, 12});
    steps_.push_back(call("signal"));
  }

  // 桜ゾーン (x -3.462〜-3.012) の段 y を, 右から順につかむ. ハンドの中心は機体の中心から 0.31 m 前
  void fetch(double y, bool three_columns = false)
  {
    const double PI = M_PI;
    for (auto s : {arm(0.0, 0.12), go(-1.3, -2.3, 0), go(-2.65, -2.1, PI), go(-2.65, y, PI), arm(-1, 0.0)}) {
      steps_.push_back(s);
    }
    std::vector<double> columns = {-3.087, -3.237};
    if (three_columns) {columns.push_back(-3.387);}
    for (double cx : columns) {
      steps_.push_back(go(cx + 0.31, y, PI));
      steps_.push_back(call("grab"));
    }
    // 桜ゾーンの上の木の枠 (y 2.324) の近くでは回らない (台車の角が当たる). 下がってから右を向く
    for (auto s : {arm(-1, 0.12), go(-2.65, 1.6, PI), go(-2.65, -2.1, 0)}) {steps_.push_back(s);}
  }

  // 白線の外 (x = -0.72) からアームを伸ばして, 共通ゾーンに 1 本ずつ置く
  void deliver(const std::vector<int> & zones)
  {
    steps_.push_back(go(-0.72, -2.288, 0));
    steps_.push_back(arm(0.42, -1));
    for (int z : zones) {
      // 共通ゾーン z の中心の y. 1 番は -2.288, 2 番から 12 番は 0.5 m ずつ奥 (-1.769 + 0.5 (z - 2))
      const double y = z == 1 ? -2.288 : -1.769 + 0.5 * (z - 2);
      for (auto s : {arm(-1, 0.12), go(-0.72, y, 0), arm(-1, 0.0), call("place"), arm(-1, 0.12)}) {
        steps_.push_back(s);
      }
    }
    steps_.push_back(arm(0.0, 0.12));
  }

  void on_timer()
  {
    if (!has_pose_ || steps_.empty()) {
      if (steps_.empty() && !said_done_) {
        RCLCPP_INFO(get_logger(), "全部終わった");
        said_done_ = true;
      }
      return;
    }
    Step & s = steps_.front();
    if (!started_) {
      started_ = true;
      start_time_ = now();
    }
    const double elapsed = (now() - start_time_).seconds();
    bool done = false;
    if (s.kind == Step::Goto) {
      done = drive_to(s.a, s.b, s.c) || elapsed > 15.0;
    } else if (s.kind == Step::Arm) {
      if (elapsed < 0.06) {
        if (s.a >= 0) {extend_target_ = s.a;}
        if (s.b >= 0) {lift_target_ = s.b;}
        Float64 e, l;
        e.data = extend_target_;
        l.data = lift_target_;
        extend_pub_->publish(e);
        lift_pub_->publish(l);
      }
      done = (std::abs(extend_now_ - extend_target_) < 0.005 && std::abs(lift_now_ - lift_target_) < 0.005) || elapsed > 3.0;
    } else if (s.kind == Step::Call || s.kind == Step::Dice6) {
      if (s.kind == Step::Dice6 && dice_top_ == 6 && !waiting_) {
        done = true;
      } else if (!waiting_ && !called_) {
        waiting_ = called_ = true;
        clients_[s.kind == Step::Dice6 ? "dice" : s.service]->async_send_request(
          std::make_shared<Trigger::Request>(),
          [this](rclcpp::Client<Trigger>::SharedFuture f) {
            RCLCPP_INFO(get_logger(), "%s", f.get()->message.c_str());
            waiting_ = false;
          });
      } else if (!waiting_) {
        if (s.kind == Step::Call) {
          done = true;
        } else if (elapsed > 0.3) {
          called_ = false;     // サイコロ: /robot/dice_top が変わるのを待ってから, まだ 6 でなければもう 1 回
          start_time_ = now();
        }
      }
    }
    if (done) {
      steps_.erase(steps_.begin());
      started_ = called_ = false;
    }
  }

  // (x, y, 向き) へ近づく速度を出す. 着いたら true. 速度はずれに比例させ, 1.2 m/s と 2 rad/s で頭打ちにする
  bool drive_to(double x, double y, double yaw)
  {
    const double ex = x - x_, ey = y - y_;
    const double eyaw = std::atan2(std::sin(yaw - th_), std::cos(yaw - th_));
    geometry_msgs::msg::Twist cmd;
    if (std::hypot(ex, ey) < 0.01 && std::abs(eyaw) < 0.02) {
      cmd_pub_->publish(cmd);   // 0 を送って止める
      return true;
    }
    // ずれはフィールドの向きなので, 機体の向き (前 x, 左 y) に直す
    const double c = std::cos(th_), s = std::sin(th_);
    double vx = 2.5 * (c * ex + s * ey), vy = 2.5 * (-s * ex + c * ey);
    const double v = std::hypot(vx, vy);
    if (v > 1.2) {
      vx *= 1.2 / v;
      vy *= 1.2 / v;
    }
    cmd.linear.x = vx;
    cmd.linear.y = vy;
    cmd.angular.z = std::clamp(3.0 * eyaw, -2.0, 2.0);
    cmd_pub_->publish(cmd);
    return false;
  }

  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr cmd_pub_;
  rclcpp::Publisher<Float64>::SharedPtr extend_pub_, lift_pub_;
  rclcpp::Subscription<geometry_msgs::msg::Pose>::SharedPtr pose_sub_;
  rclcpp::Subscription<Float64>::SharedPtr extend_sub_, lift_sub_;
  rclcpp::Subscription<std_msgs::msg::Int32>::SharedPtr dice_sub_;
  std::map<std::string, rclcpp::Client<Trigger>::SharedPtr> clients_;
  rclcpp::TimerBase::SharedPtr timer_;
  std::vector<Step> steps_;
  double x_ = 0, y_ = 0, th_ = 0;   // /robot/pose の位置 [m] と向き [rad]
  bool has_pose_ = false, started_ = false, waiting_ = false, called_ = false, said_done_ = false;
  rclcpp::Time start_time_;
  double extend_now_ = 0, lift_now_ = 0, extend_target_ = 0, lift_target_ = 0;
  int dice_top_ = 0;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<AutoNode>());
  rclcpp::shutdown();
  return 0;
}

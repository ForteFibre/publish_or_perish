// 課題・実績・レベル.
// 課題はステージごとに並び, 前のステージを全部終えると次が開く.
// 進み具合はゲーム内のイベントと ROS のグラフ (誰が publish / subscribe しているか) から判定する.
#pragma once

#include <deque>
#include <functional>
#include <map>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include "publish_or_perish/world.hpp"

namespace publish_or_perish
{

// ROS のグラフから読んだ情報. ノード名は先頭の / なし (例: "my_farmer", "_ros2cli_1234")
struct Graph
{
  std::set<std::string> nodes;
  std::set<std::string> cli;      // ros2 topic pub / ros2 service call などの CLI
  std::set<std::string> players;  // 農場・CLI・道具 (rviz など) 以外 = プレイヤーが書いたノード
  std::set<std::string> player_full;  // 同じく namespace 込みの名前 (例: "/bot1/farmer"). 同名のノードを区別する
  std::map<std::string, std::vector<std::string>> subs;  // topic -> subscribe しているノード
  // topic -> publish しているノードの (名前, namespace). namespace は "/bot1" のように先頭の / あり
  std::map<std::string, std::vector<std::pair<std::string, std::string>>> pubs;
  bool automated = false;         // CLI がなく, プレイヤーのノードが動いている
  double now = 0.0;
};

struct Mission
{
  std::string id, title, desc, hint, unit;
  double goal = 1.0;
  int reward = 50, xp = 40;
  double value = 0.0;
  bool done = false;
  std::function<void(Mission &, const Event &, const Graph &, const World &)> on_event;
  std::function<void(Mission &, const Graph &, const World &)> on_tick;
  std::set<std::pair<int, int>> seen;              // 通ったマス
  std::deque<std::pair<double, double>> window;    // (時刻, 金額)
};

struct Stage
{
  std::string title, lesson;
  std::vector<Mission> missions;
};

struct Achievement
{
  std::string id, name, desc;
  int xp = 30;
  bool hidden = false;
  bool done = false;
  std::function<bool(const World &, const Graph &)> check;
};

// 画面に出す通知. kind は mission / stage / achievement / level
struct Notice
{
  std::string kind, title, body;
};

class Progress
{
public:
  Progress();

  void update(const std::vector<Event> & events, const Graph & g, World & w);
  std::vector<Notice> take_notices();

  size_t stage_index() const;
  int level() const;
  const std::string & title() const;
  long level_xp(int lv) const;

  std::vector<Stage> stages;
  std::vector<std::string> upcoming;
  std::vector<Achievement> achievements;
  long xp = 0;

private:
  void gain(long amount);
  std::vector<Notice> notices_;
};

}  // namespace publish_or_perish

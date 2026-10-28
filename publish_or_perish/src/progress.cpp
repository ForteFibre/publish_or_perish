#include "publish_or_perish/progress.hpp"

#include <algorithm>

namespace publish_or_perish
{

namespace
{

const std::vector<long> kLevelXp = {0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200};
const std::vector<std::string> kTitles = {
  "見習い農家", "新米オペレーター", "topic 使い", "service 使い", "ノード職人",
  "自動化の芽", "農場エンジニア", "ロボット農場主", "ROS 2 の達人", "伝説の農場主"};

bool has(const std::set<std::string> & s, const std::string & v) {return s.count(v) > 0;}

// kind のイベントで pred が真なら amount だけ進める
auto count(
  std::string kind,
  std::function<bool(const Event &, const Graph &, const World &)> pred = nullptr,
  bool use_value = false)
{
  return [kind, pred, use_value](Mission & m, const Event & e, const Graph & g, const World & w) {
           if (e.kind != kind || (pred && !pred(e, g, w))) {return;}
           m.value += use_value ? e.value : 1.0;
         };
}

// そのロボットの最後の cmd_vel を出したのが src か
auto moved_by(Source src)
{
  return [src](const Event & e, const Graph &, const World & w) {
           return w.bots.at(e.bot).cmd_src == src;
         };
}

// topic を subscribe しているノードのうち, set に入っているものがあるか
bool subscribed_by(const Graph & g, const std::string & topic, const std::set<std::string> & who)
{
  auto it = g.subs.find(topic);
  if (it == g.subs.end()) {return false;}
  return std::any_of(it->second.begin(), it->second.end(), [&](const auto & n) {return has(who, n);});
}

Mission mission(
  std::string id, std::string title, std::string desc, std::string hint,
  double goal = 1, std::string unit = "", int reward = 50, int xp = 40)
{
  Mission m;
  m.id = id;
  m.title = title;
  m.desc = desc;
  m.hint = hint;
  m.goal = goal;
  m.unit = unit;
  m.reward = reward;
  m.xp = xp;
  return m;
}

}  // namespace

Progress::Progress()
{
  // ---- ステージ 1: CLI で操作する ----
  Stage s1{"ステージ 1: 手で動かしてみよう", "入門 第8回 (topic) ・第9回 (service)", {}};
  {
    auto m = mission(
      "s1_move", "ロボットを動かす",
      "ターミナルから /bot1/cmd_vel に速度を publish して, bot1 を 2 m 動かす。\n"
      "cmd_vel は 0.5 秒途切れると止まる (実機と同じ安全のしくみ)。-r 10 で出し続ける。",
      "ros2 topic pub -r 10 /bot1/cmd_vel geometry_msgs/msg/Twist \"{linear: {x: 0.5}}\"", 2, "m");
    m.on_event = count("move", moved_by(Source::Cli), true);
    s1.missions.push_back(m);
  }
  {
    auto m = mission(
      "s1_echo", "位置を見る",
      "/bot1/pose を subscribe して, ロボットの位置 (x, y, theta) を表示する。",
      "ros2 topic echo /bot1/pose");
    m.on_tick = [](Mission & m, const Graph & g, const World &) {
        if (subscribed_by(g, "/bot1/pose", g.cli)) {m.value = m.goal;}
      };
    s1.missions.push_back(m);
  }
  {
    auto m = mission(
      "s1_plant", "種をまく",
      "service /bot1/plant を呼ぶと, ロボットの足元のマスに種をまく (小麦は 5 G)。",
      "ros2 service call /bot1/plant std_srvs/srv/Trigger");
    m.on_event = count("plant");
    s1.missions.push_back(m);
  }
  {
    auto m = mission(
      "s1_water", "水をやる",
      "service /bot1/water で足元のマスに水をやる。水分が 20 以上ないと育たない。\n"
      "タンクが空になったら, 左下の井戸のマスに行くと満タンになる。",
      "ros2 service call /bot1/water std_srvs/srv/Trigger");
    m.on_event = count("water");
    s1.missions.push_back(m);
  }
  {
    auto m = mission(
      "s1_harvest", "初収穫",
      "水を切らさずに 30 秒待つと実る。実ったら service /bot1/harvest で収穫する。\n"
      "実ってから 40 秒放っておくと枯れる。",
      "ros2 service call /bot1/harvest std_srvs/srv/Trigger", 1, "", 80, 60);
    m.on_event = count("harvest");
    s1.missions.push_back(m);
  }
  stages.push_back(s1);

  // ---- ステージ 2: 自分のノードから publish する ----
  Stage s2{"ステージ 2: 自分のノードで動かそう",
    "実践 第2回 (ノード) ・第5回 (タイマー) ・第6回 (Publisher)", {}};
  {
    auto m = mission(
      "s2_node", "C++ のノードから動かす",
      "tutorial_nodes に新しいノードを作り, タイマーで /bot1/cmd_vel を publish して 3 m 動かす。\n"
      "ros2 topic pub は止めておく (どのノードが出したかを農場が見ている)。",
      "create_publisher<geometry_msgs::msg::Twist>(\"/bot1/cmd_vel\", 10) と create_wall_timer",
      3, "m", 100, 80);
    m.on_event = count("move", moved_by(Source::Player), true);
    s2.missions.push_back(m);
  }
  {
    auto m = mission(
      "s2_patrol", "畑を巡回する",
      "自分のノードで bot1 を動かし, 20 マスを通る。畝に沿って往復すると早い。\n"
      "例: 4 秒進んだら 1 秒横へずれて, 向きを逆にする (経過時間で速度を切り替える)。",
      "経過時間 (now() - start_) で vx と vy を切り替える", 20, "マス", 120, 100);
    m.on_event = [](Mission & m, const Event & e, const Graph &, const World & w) {
        if (e.kind != "enter" || w.bots.at(e.bot).cmd_src != Source::Player) {return;}
        m.seen.insert({e.x, e.y});
        m.value = m.seen.size();
      };
    s2.missions.push_back(m);
  }
  stages.push_back(s2);

  // ---- ステージ 3: subscribe して判断する ----
  Stage s3{"ステージ 3: 畑を見て判断しよう", "実践 第7回 (Subscriber) ・入門 第9回 (service)", {}};
  {
    auto m = mission(
      "s3_sub", "畑の水分を読む",
      "自分のノードで /field/moisture (nav_msgs/msg/OccupancyGrid) を subscribe する。\n"
      "data[y * width + x] がマス (x, y) の水分 (0〜100)。",
      "create_subscription<nav_msgs::msg::OccupancyGrid>(\"/field/moisture\", 10, ...)",
      1, "", 60, 60);
    m.on_tick = [](Mission & m, const Graph & g, const World &) {
        if (subscribed_by(g, "/field/moisture", g.players) || subscribed_by(g, "/field/crops", g.players)) {
          m.value = m.goal;
        }
      };
    s3.missions.push_back(m);
  }
  {
    auto m = mission(
      "s3_dry", "乾いたマスに水をやる",
      "水分が 30 未満のマスに, 自分のノードから 10 回水をやる (CLI は止めておく)。\n"
      "/bot1/pose で自分のいるマスを, /field/moisture でそのマスの水分を調べる。",
      "rclcpp::Client<std_srvs::srv::Trigger> の async_send_request", 10, "回", 150, 120);
    m.on_event = count("water", [](const Event & e, const Graph & g, const World &) {
          return g.automated && e.value < 30.0;
        });
    s3.missions.push_back(m);
  }
  {
    auto m = mission(
      "s3_auto", "無人農場",
      "CLI を使わず, 自分のノードだけで 60 秒間に 100 G 稼ぐ。\n"
      "/field/crops は作物の育ち具合 (-1: なし, 0〜99: 生育中, 100: 実った, -2: 枯れた)。",
      "種まき → 水やり → 収穫 を 1 つのノードで回す", 100, "G", 300, 200);
    m.on_event = [](Mission & m, const Event & e, const Graph & g, const World &) {
        if (e.kind == "harvest" && g.automated) {m.window.emplace_back(e.t, e.value);}
      };
    m.on_tick = [](Mission & m, const Graph & g, const World & w) {
        if (!g.automated) {m.window.clear();}
        while (!m.window.empty() && m.window.front().first < w.time - 60.0) {m.window.pop_front();}
        double sum = 0;
        for (const auto & [t, v] : m.window) {sum += v;}
        m.value = std::max(m.value, sum);
      };
    s3.missions.push_back(m);
  }
  stages.push_back(s3);

  // ---- ステージ 4: パラメータ ----
  Stage s4{"ステージ 4: パラメータで作物を選ぼう", "入門 第10回 ・実践 第12回 (パラメータ)", {}};
  {
    auto m = mission(
      "s4_tomato", "トマトを植える",
      "お店でトマトの種を解禁し, 農場のパラメータ bot1.seed を tomato にしてから植える。\n"
      "トマトは 15 G で植えて 70 G で売れる (育つのに 50 秒)。",
      "ros2 param set /farm bot1.seed tomato", 1, "", 100, 80);
    m.on_event = count("plant", [](const Event & e, const Graph &, const World &) {return e.crop == "tomato";});
    s4.missions.push_back(m);
  }
  {
    auto m = mission(
      "s4_harvest", "トマトを 5 個収穫",
      "自分のノードの中から作物を切り替えてもよい (rclcpp::AsyncParametersClient で /farm の bot1.seed を変える)。",
      "ros2 param get /farm bot1.seed で今の作物を確かめる", 5, "個", 250, 150);
    m.on_event = count("harvest", [](const Event & e, const Graph &, const World &) {return e.crop == "tomato";});
    s4.missions.push_back(m);
  }
  stages.push_back(s4);

  // ---- ステージ 5: namespace と launch で 2 台 ----
  Stage s5{"ステージ 5: ロボットを 2 台にしよう", "実践 第11回 (launch) ・namespace", {}};
  {
    auto m = mission(
      "s5_buy", "2 台目を買う",
      "お店で 2 台目のロボット (bot2) を買う。bot2 は /bot2/cmd_vel, /bot2/pose ... で動く。",
      "お店 → 2 台目のロボット", 1, "", 100, 60);
    m.on_event = count("buy", [](const Event & e, const Graph &, const World &) {return e.crop == "bot2";});
    s5.missions.push_back(m);
  }
  {
    auto m = mission(
      "s5_ns", "namespace で 2 台を動かす",
      "同じノードを namespace だけ変えて 2 つ起動し, bot1 と bot2 を動かす。\n"
      "ノードの中の topic 名を \"cmd_vel\" のように / なしで書くと, namespace の下につながる。",
      "ros2 run <pkg> <node> --ros-args -r __ns:=/bot2  (launch なら <node namespace=\"bot2\" .../>)",
      1, "", 200, 150);
    m.on_tick = [](Mission & m, const Graph & g, const World & w) {
        if (!w.bots.count("bot2")) {return;}
        auto ok = [&](const std::string & bot) {
            auto it = g.pubs.find("/" + bot + "/cmd_vel");
            if (it == g.pubs.end()) {return false;}
            for (const auto & [node, ns] : it->second) {
              if (ns == "/" + bot && g.players.count(node)) {return true;}
            }
            return false;
          };
        if (ok("bot1") && ok("bot2")) {m.value = m.goal;}
      };
    s5.missions.push_back(m);
  }
  {
    auto m = mission(
      "s5_auto", "2 台の無人農場",
      "CLI を使わず, 2 台で 60 秒間に 300 G 稼ぐ。2 台が同じマスを取り合わないように分担を決める (例: パラメータで担当の列を渡す)。",
      "launch ファイルで 2 つのノードに別々のパラメータを渡す", 300, "G", 500, 300);
    // 2 台目がいて, 2 台とも自分のノードで動いているときだけ数える
    auto both = [](const World & w) {
        return w.bots.count("bot2") && std::all_of(w.bots.begin(), w.bots.end(),
                 [](const auto & kv) {return kv.second.cmd_src == Source::Player;});
      };
    m.on_event = [both](Mission & m, const Event & e, const Graph & g, const World & w) {
        if (e.kind == "harvest" && g.automated && both(w)) {m.window.emplace_back(e.t, e.value);}
      };
    m.on_tick = [both](Mission & m, const Graph & g, const World & w) {
        if (!g.automated || !both(w)) {m.window.clear();}
        while (!m.window.empty() && m.window.front().first < w.time - 60.0) {m.window.pop_front();}
        double sum = 0;
        for (const auto & [t, v] : m.window) {sum += v;}
        m.value = std::max(m.value, sum);
      };
    s5.missions.push_back(m);
  }
  stages.push_back(s5);

  upcoming = {
    "ステージ 6: action で「ここへ行け」",
    "ステージ 7: 収穫ロボと運搬ロボの連携",
    "ステージ 8: Behavior Tree で農場を回す",
    "卒業: 自分のノードで MuJoCo の部のロボットを動かす",
  };

  // ---- 実績 ----
  auto ach = [this](std::string id, std::string name, std::string desc, int xp, bool hidden,
      std::function<bool(const World &, const Graph &)> check) {
      achievements.push_back({id, name, desc, xp, hidden, false, check});
    };
  ach("first_step", "はじめの一歩", "ロボットを初めて動かした", 20, false,
    [](const World & w, const Graph &) {return w.stat("moved") > 0;});
  ach("first_harvest", "実りの秋", "初めて収穫した", 20, false,
    [](const World & w, const Graph &) {return w.stat("harvest") > 0;});
  ach("rqt", "つながりが見える", "rqt_graph でノードのつながりを見た", 40, true,
    [](const World &, const Graph & g) {
      return std::any_of(g.nodes.begin(), g.nodes.end(), [](const auto & n) {return n.find("rqt_gui") != std::string::npos;});
    });
  ach("rviz", "RViz 農家", "RViz で /field/moisture か /field/crops を表示した", 40, true,
    [](const World &, const Graph & g) {
      for (const char * t : {"/field/moisture", "/field/crops"}) {
        auto it = g.subs.find(t);
        if (it == g.subs.end()) {continue;}
        for (const auto & n : it->second) {if (n.rfind("rviz", 0) == 0) {return true;}}
      }
      return false;
    });
  ach("bag", "記録係", "ros2 bag record で農場を記録した", 40, true,
    [](const World &, const Graph & g) {
      return std::any_of(g.nodes.begin(), g.nodes.end(), [](const auto & n) {return n.find("rosbag2_recorder") != std::string::npos;});
    });
  ach("twin", "二刀流", "自分のノードを 2 つ同時に動かした", 40, false,
    [](const World &, const Graph & g) {return g.player_full.size() >= 2;});
  ach("water100", "水やり名人", "水やり 100 回", 50, false,
    [](const World & w, const Graph &) {return w.stat("water") >= 100;});
  ach("streak10", "枯らさない人", "枯らさずに 10 回続けて収穫", 50, false,
    [](const World & w, const Graph &) {return w.stat("streak") >= 10;});
  ach("rich", "小金持ち", "所持金 1000 G", 50, false,
    [](const World & w, const Graph &) {return w.money >= 1000;});
  ach("green", "一面の緑", "井戸以外の全マスに作物がある", 60, false,
    [](const World & w, const Graph &) {
      for (const auto & row : w.tiles) {
        for (const auto & t : row) {
          if (!t.well && (!t.crop || t.crop->dead)) {return false;}
        }
      }
      return true;
    });
  ach("wall", "壁と友達", "壁に 30 回ぶつかった", 20, true,
    [](const World & w, const Graph &) {return w.stat("wall") >= 30;});
  ach("pumpkin", "大物", "カボチャを収穫した", 60, true,
    [](const World & w, const Graph &) {return w.stat("harvest_pumpkin") > 0;});
}

size_t Progress::stage_index() const
{
  for (size_t i = 0; i < stages.size(); ++i) {
    for (const auto & m : stages[i].missions) {
      if (!m.done) {return i;}
    }
  }
  return stages.size();
}

int Progress::level() const
{
  int lv = 0;
  for (size_t i = 0; i < kLevelXp.size(); ++i) {
    if (xp >= kLevelXp[i]) {lv = i;}
  }
  return lv;
}

const std::string & Progress::title() const {return kTitles[level()];}

long Progress::level_xp(int lv) const
{
  return lv < static_cast<int>(kLevelXp.size()) ? kLevelXp[lv] : kLevelXp.back();
}

void Progress::gain(long amount)
{
  const int before = level();
  xp += amount;
  if (level() > before) {
    notices_.push_back({"level", "レベル " + std::to_string(level() + 1), "称号「" + title() + "」"});
  }
}

std::vector<Notice> Progress::take_notices()
{
  std::vector<Notice> out;
  out.swap(notices_);
  return out;
}

void Progress::update(const std::vector<Event> & events, const Graph & g, World & w)
{
  for (const auto & e : events) {
    if (e.kind == "move") {w.stats["moved"]++;}
  }
  const size_t si = stage_index();
  if (si < stages.size()) {
    auto & active = stages[si].missions;
    for (const auto & e : events) {
      for (auto & m : active) {
        if (!m.done && m.on_event) {m.on_event(m, e, g, w);}
      }
    }
    for (auto & m : active) {
      if (!m.done && m.on_tick) {m.on_tick(m, g, w);}
      if (!m.done && m.value >= m.goal) {
        m.done = true;
        m.value = m.goal;
        w.money += m.reward;
        notices_.push_back({"mission", "課題クリア: " + m.title,
            "+" + std::to_string(m.reward) + " G  +" + std::to_string(m.xp) + " XP"});
        gain(m.xp);
      }
    }
    if (stage_index() > si) {
      const std::string next = stage_index() < stages.size() ? stages[stage_index()].title : "全ステージクリア";
      notices_.push_back({"stage", stages[si].title + " 完了", "次: " + next});
    }
  }
  for (auto & a : achievements) {
    if (!a.done && a.check(w, g)) {
      a.done = true;
      notices_.push_back({"achievement", "実績: " + a.name, a.desc});
      gain(a.xp);
    }
  }
}

}  // namespace publish_or_perish

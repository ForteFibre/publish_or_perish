#include "publish_or_perish/progress.hpp"

#include <algorithm>

namespace publish_or_perish
{

namespace
{

const std::vector<long> kLevelXp = {0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200};
// 称号は訳の表の title.<レベル> (1 始まり)

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

// 操作 (plant / water / harvest) をしたのが src か
auto done_by(Source src)
{
  return [src](const Event & e, const Graph &, const World &) {return e.src == src;};
}

// キー以外 (CLI か自分のノード) の操作か
bool not_key(const Event & e, const Graph &, const World &) {return e.src != Source::Key;}

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

// 課題の題・説明・ヒントは訳の表の mission.<id>. unit は単位の種類 (訳の表の unit.<unit>)
Mission mission(std::string id, double goal = 1, std::string unit = "", int reward = 50, int xp = 40)
{
  Mission m;
  m.id = id;
  m.goal = goal;
  m.unit = unit;
  m.reward = reward;
  m.xp = xp;
  return m;
}

}  // namespace

Progress::Progress()
{
  // ---- ステージ 0: 画面のキーで操作する ----
  Stage s0{"keys", {}};
  {
    auto m = mission("k_move", 2, "m", 30, 30);
    m.on_event = count("move", moved_by(Source::Key), true);
    s0.missions.push_back(m);
  }
  {
    auto m = mission("k_plant", 1, "", 30, 30);
    m.on_event = count("plant", done_by(Source::Key));
    s0.missions.push_back(m);
  }
  {
    auto m = mission("k_water", 1, "", 30, 30);
    m.on_event = count("water", done_by(Source::Key));
    s0.missions.push_back(m);
  }
  {
    auto m = mission("k_harvest", 1, "", 50, 40);
    m.on_event = count("harvest", done_by(Source::Key));
    s0.missions.push_back(m);
  }
  stages.push_back(s0);

  // ---- ステージ 1: CLI で操作する ----
  Stage s1{"s1", {}};
  {
    auto m = mission("s1_move", 2, "m");
    m.on_event = count("move", moved_by(Source::Cli), true);
    s1.missions.push_back(m);
  }
  {
    auto m = mission("s1_echo");
    m.on_tick = [](Mission & m, const Graph & g, const World &) {
        if (subscribed_by(g, "/bot1/pose", g.cli)) {m.value = m.goal;}
      };
    s1.missions.push_back(m);
  }
  {
    auto m = mission("s1_plant");
    m.on_event = count("plant", not_key);  // ステージ 1 は CLI を覚える段なので, キーの操作は数えない
    s1.missions.push_back(m);
  }
  {
    auto m = mission("s1_water");
    m.on_event = count("water", not_key);
    s1.missions.push_back(m);
  }
  {
    auto m = mission("s1_harvest", 1, "", 80, 60);
    m.on_event = count("harvest", not_key);
    s1.missions.push_back(m);
  }
  stages.push_back(s1);

  // ---- ステージ 2: ワークスペースを作る ----
  // 判定は点検 (Doctor) がファイルを見て決めた事実 (g.ws) を使う. 間違えたときの理由は点検の欄に出る
  auto ws_fact = [](std::string fact) {
      return [fact](Mission & m, const Graph & g, const World &) {if (g.ws.count(fact)) {m.value = m.goal;}};
    };
  Stage s_ws{"ws", {}};
  {
    auto m = mission("ws_src", 1, "", 30, 30);
    m.on_tick = ws_fact("src");
    s_ws.missions.push_back(m);
  }
  {
    auto m = mission("ws_pkg", 1, "", 40, 40);
    m.on_tick = ws_fact("pkg");
    s_ws.missions.push_back(m);
  }
  {
    auto m = mission("ws_build", 1, "", 50, 50);
    m.on_tick = [](Mission & m, const Graph & g, const World &) {
        if (g.ws.count("built") && g.ws.count("merged") && g.ws.count("symlink")) {m.value = m.goal;}
      };
    s_ws.missions.push_back(m);
  }
  {
    auto m = mission("ws_bashrc", 1, "", 50, 50);
    m.on_tick = ws_fact("bashrc");
    s_ws.missions.push_back(m);
  }
  stages.push_back(s_ws);

  // ---- ステージ 3: 最初のノード ----
  Stage s_node{"node", {}};
  {
    auto m = mission("node_cpp", 1, "", 40, 40);
    m.on_tick = ws_fact("main:hello_node");
    s_node.missions.push_back(m);
  }
  {
    auto m = mission("node_xml", 1, "", 30, 30);
    m.on_tick = [](Mission & m, const Graph & g, const World &) {
        // 判定は package.xml だけを見る (点検の "auto" は CMakeLists.txt も見るので使わない)
        if (g.ws.count("xml:ament_cmake_auto") && g.ws.count("xml:rclcpp")) {m.value = m.goal;}
      };
    s_node.missions.push_back(m);
  }
  {
    auto m = mission("node_cmake", 1, "", 40, 40);
    m.on_tick = [](Mission & m, const Graph & g, const World &) {
        if (g.ws.count("exe:hello_node") && g.ws.count("auto")) {m.value = m.goal;}
      };
    s_node.missions.push_back(m);
  }
  {
    auto m = mission("node_build", 1, "", 60, 60);
    m.on_tick = ws_fact("bin:hello_node");
    s_node.missions.push_back(m);
  }
  {
    auto m = mission("node_run", 1, "", 80, 80);
    m.on_tick = [](Mission & m, const Graph & g, const World &) {
        if (g.ws.count("run:hello_node") && !g.players.empty()) {m.value = m.goal;}
      };
    s_node.missions.push_back(m);
  }
  stages.push_back(s_node);

  // ---- ステージ 4: 看板を相手に, 自分のノードで topic と service を使う ----
  // 農場の決まり (マス, 水, 作物) を知らなくても進められるように, 畑の横の看板だけを相手にする.
  // イベントの bot には送り手 ("player" / "cli") が入る (farm_node.cpp)
  auto by_player = [](const Event & e, const Graph &, const World &) {return e.bot == "player";};
  Stage s_board{"board", {}};
  {
    auto m = mission("board_pub", 5, "times", 60, 60);
    m.on_event = count("board_text", by_player);
    s_board.missions.push_back(m);
  }
  {
    auto m = mission("board_sub", 1, "", 60, 60);
    m.on_tick = [](Mission & m, const Graph & g, const World &) {
        if (subscribed_by(g, "/board/number", g.players)) {m.value = m.goal;}
      };
    s_board.missions.push_back(m);
  }
  {
    auto m = mission("board_reply", 5, "times", 100, 80);
    m.on_event = count("board_answer", [](const Event & e, const Graph &, const World &) {
          return e.bot == "player" && e.value > 0.5;
        });
    s_board.missions.push_back(m);
  }
  {
    auto m = mission("board_bell", 3, "times", 100, 80);
    m.on_event = count("board_bell", by_player);
    s_board.missions.push_back(m);
  }
  stages.push_back(s_board);

  // ---- ステージ 5: 自分のノードから publish してロボットを動かす ----
  Stage s2{"s2", {}};
  {
    auto m = mission("s2_node", 3, "m", 100, 80);
    m.on_event = count("move", moved_by(Source::Player), true);
    s2.missions.push_back(m);
  }
  {
    auto m = mission("s2_patrol", 20, "tiles", 120, 100);
    m.on_event = [](Mission & m, const Event & e, const Graph &, const World & w) {
        if (e.kind != "enter" || w.bots.at(e.bot).cmd_src != Source::Player) {return;}
        m.seen.insert({e.x, e.y});
        m.value = m.seen.size();
      };
    s2.missions.push_back(m);
  }
  stages.push_back(s2);

  // ---- ステージ 6: subscribe して判断する ----
  Stage s3{"s3", {}};
  {
    auto m = mission("s3_sub", 1, "", 60, 60);
    m.on_tick = [](Mission & m, const Graph & g, const World &) {
        if (subscribed_by(g, "/field/moisture", g.players) || subscribed_by(g, "/field/crops", g.players)) {
          m.value = m.goal;
        }
      };
    s3.missions.push_back(m);
  }
  {
    // 半自動: 移動はキーで, 水やりは自分のノード
    auto m = mission("s3_dry", 10, "times", 150, 120);
    m.on_event = count("water", [](const Event & e, const Graph &, const World &) {
          return e.src == Source::Player && e.value < 30.0;
        });
    s3.missions.push_back(m);
  }
  {
    auto m = mission("s3_semi", 5, "crops", 200, 150);
    m.on_event = count("harvest", done_by(Source::Player));
    s3.missions.push_back(m);
  }
  {
    auto m = mission("s3_auto", 100, "G", 300, 200);
    m.on_event = [](Mission & m, const Event & e, const Graph & g, const World & w) {
        // キーで動かしたら, それまでの分は数えない
        if (e.kind == "move" && w.bots.at(e.bot).cmd_src == Source::Key) {m.window.clear();}
        if (e.kind == "harvest" && g.automated && e.src == Source::Player &&
          w.bots.at(e.bot).cmd_src == Source::Player)
        {
          m.window.emplace_back(e.t, e.value);
        }
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

  // ---- ステージ 7: パラメータ ----
  Stage s4{"s4", {}};
  {
    auto m = mission("s4_tomato", 1, "", 100, 80);
    m.on_event = count("plant", [](const Event & e, const Graph &, const World &) {return e.crop == "tomato";});
    s4.missions.push_back(m);
  }
  {
    auto m = mission("s4_harvest", 5, "crops", 250, 150);
    m.on_event = count("harvest", [](const Event & e, const Graph &, const World &) {return e.crop == "tomato";});
    s4.missions.push_back(m);
  }
  stages.push_back(s4);

  // ---- ステージ 8: namespace と launch で 2 台 ----
  Stage s5{"s5", {}};
  {
    auto m = mission("s5_buy", 1, "", 100, 60);
    m.on_event = count("buy", [](const Event & e, const Graph &, const World &) {return e.crop == "bot2";});
    s5.missions.push_back(m);
  }
  {
    auto m = mission("s5_ns", 1, "", 200, 150);
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
    auto m = mission("s5_auto", 300, "G", 500, 300);
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

  upcoming = {"s9", "s10", "s11", "graduate"};

  // ---- 実績 ----
  auto ach = [this](std::string id, int xp, bool hidden, std::function<bool(const World &, const Graph &)> check) {
      achievements.push_back({id, xp, hidden, false, check});
    };
  ach("first_step", 20, false,
    [](const World & w, const Graph &) {return w.stat("moved") > 0;});
  ach("first_harvest", 20, false,
    [](const World & w, const Graph &) {return w.stat("harvest") > 0;});
  ach("rqt", 40, true,
    [](const World &, const Graph & g) {
      return std::any_of(g.nodes.begin(), g.nodes.end(), [](const auto & n) {return n.find("rqt_gui") != std::string::npos;});
    });
  ach("rviz", 40, true,
    [](const World &, const Graph & g) {
      for (const char * t : {"/field/moisture", "/field/crops"}) {
        auto it = g.subs.find(t);
        if (it == g.subs.end()) {continue;}
        for (const auto & n : it->second) {if (n.rfind("rviz", 0) == 0) {return true;}}
      }
      return false;
    });
  ach("bag", 40, true,
    [](const World &, const Graph & g) {
      return std::any_of(g.nodes.begin(), g.nodes.end(), [](const auto & n) {return n.find("rosbag2_recorder") != std::string::npos;});
    });
  ach("twin", 40, false,
    [](const World &, const Graph & g) {return g.player_full.size() >= 2;});
  ach("water100", 50, false,
    [](const World & w, const Graph &) {return w.stat("water") >= 100;});
  ach("streak10", 50, false,
    [](const World & w, const Graph &) {return w.stat("streak") >= 10;});
  ach("rich", 50, false,
    [](const World & w, const Graph &) {return w.money >= 1000;});
  ach("green", 60, false,
    [](const World & w, const Graph &) {
      for (const auto & row : w.tiles) {
        for (const auto & t : row) {
          if (!t.well && (!t.crop || t.crop->dead)) {return false;}
        }
      }
      return true;
    });
  ach("wall", 20, true,
    [](const World & w, const Graph &) {return w.stat("wall") >= 30;});
  ach("pumpkin", 60, true,
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

long Progress::level_xp(int lv) const
{
  return lv < static_cast<int>(kLevelXp.size()) ? kLevelXp[lv] : kLevelXp.back();
}

void Progress::gain(long amount)
{
  const int before = level();
  xp += amount;
  if (level() > before) {
    const int lv = level() + 1;
    notices_.push_back({"level", {"notice.level.title", {{"level", lv}}},
        {"notice.level.body", {{"title", Msg{"title." + std::to_string(lv)}}}}});
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
        notices_.push_back({"mission", {"notice.mission.title", {{"mission", Msg{"mission." + m.id + ".title"}}}},
            {"notice.mission.body", {{"reward", m.reward}, {"xp", m.xp}}}});
        gain(m.xp);
      }
    }
    if (stage_index() > si) {
      const Msg next = stage_index() < stages.size() ?
        Msg{"stage." + stages[stage_index()].id + ".title"} : Msg{"notice.all_clear"};
      notices_.push_back({"stage", {"notice.stage.title", {{"stage", Msg{"stage." + stages[si].id + ".title"}}}},
          {"notice.stage.body", {{"next", next}}}});
    }
  }
  for (auto & a : achievements) {
    if (!a.done && a.check(w, g)) {
      a.done = true;
      notices_.push_back({"achievement", {"notice.achievement.title", {{"name", Msg{"achievement." + a.id + ".name"}}}},
          {"notice.achievement.body", {{"desc", Msg{"achievement." + a.id + ".desc"}}}}});
      gain(a.xp);
    }
  }
}

}  // namespace publish_or_perish

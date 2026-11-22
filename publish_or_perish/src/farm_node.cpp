// 農場のノード. ゲームの規則 (World), 課題 (Progress), ROS の topic / service, 保存を受け持つ.
// 画面はブラウザ (web/) で, rosbridge 経由で /farm/state を読み, /farm/ui に操作を送る.
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <deque>
#include <filesystem>
#include <fstream>
#include <memory>
#include <random>
#include <set>
#include <sstream>

#include "publish_or_perish/doctor.hpp"
#include "publish_or_perish/progress.hpp"
#include "publish_or_perish/world.hpp"
#include "geometry_msgs/msg/pose2_d.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "nav_msgs/msg/occupancy_grid.hpp"
#include "rclcpp/rclcpp.hpp"
#include "std_msgs/msg/int32.hpp"
#include "std_msgs/msg/int64.hpp"
#include "std_msgs/msg/string.hpp"
#include "std_srvs/srv/trigger.hpp"

using namespace std::chrono_literals;
using publish_or_perish::Msg;
using publish_or_perish::render_en;
using publish_or_perish::Source;
using publish_or_perish::to_json;

namespace
{

// JSON の文字列にする
std::string q(const std::string & s)
{
  std::string o = "\"";
  for (char c : s) {
    if (c == '"' || c == '\\') {o += '\\'; o += c;} else if (c == '\n') {o += "\\n";} else {o += c;}
  }
  return o + "\"";
}

// 看板に出す文字: 先頭の n 文字 (UTF-8 の文字単位) だけにし, 改行などの制御文字は空白にする
std::string clip(const std::string & s, size_t n)
{
  std::string o;
  size_t chars = 0;
  for (unsigned char c : s) {
    if ((c & 0xC0) != 0x80 && chars++ == n) {break;}
    o += c < 0x20 ? ' ' : static_cast<char>(c);
  }
  return o;
}

std::string num(double v)
{
  std::ostringstream os;
  os.precision(4);
  os << v;
  return os.str();
}

// ノード名の分類. CLI でもプレイヤーでもないもの
bool is_tool(const std::string & n)
{
  if (n == "farm") {return true;}
  for (const char * p : {"rosbridge", "rosapi", "rviz", "rqt", "rosbag2", "launch_ros_",
      "transform_listener_impl", "_ros2cli_daemon"})
  {
    if (n.rfind(p, 0) == 0) {return true;}
  }
  return false;
}

// 編集距離 (topic 名の打ち間違いを見つける)
size_t distance(const std::string & a, const std::string & b)
{
  std::vector<size_t> d(b.size() + 1);
  for (size_t j = 0; j <= b.size(); ++j) {d[j] = j;}
  for (size_t i = 1; i <= a.size(); ++i) {
    size_t prev = d[0];
    d[0] = i;
    for (size_t j = 1; j <= b.size(); ++j) {
      const size_t cur = d[j];
      d[j] = std::min({d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] == b[j - 1] ? 0 : 1)});
      prev = cur;
    }
  }
  return d[b.size()];
}

std::string kind_of(const std::string & n)
{
  if (n == "farm") {return "farm";}
  if (n.rfind("_ros2cli_", 0) == 0) {return n.rfind("_ros2cli_daemon", 0) == 0 ? "tool" : "cli";}
  return is_tool(n) ? "tool" : "player";
}

const char * reliability(rclcpp::ReliabilityPolicy r)
{
  return r == rclcpp::ReliabilityPolicy::BestEffort ? "best_effort" : "reliable";
}

// お店の品. 名前と説明は訳の表の shop.<id>
struct ShopItem
{
  std::string id;
  long price;
};

}  // namespace

class FarmNode : public rclcpp::Node
{
public:
  FarmNode()
  : Node("farm")
  {
    const char * home = std::getenv("HOME");
    save_path_ = declare_parameter("save_path", std::string(""));
    if (save_path_.empty()) {save_path_ = std::string(home ? home : ".") + "/.publish_or_perish/save.txt";}
    if (!declare_parameter("reset", false)) {load();}
    // 試すとき用: このステージより前の課題を済みにして, ここから始める (遊んだ記録とは別の save_path と一緒に使う)
    const long start = declare_parameter("start_stage", 0L);
    for (long i = 0; i + 1 < start && i < static_cast<long>(progress_.stages.size()); ++i) {
      for (auto & m : progress_.stages[i].missions) {m.done = true; m.value = m.goal;}
    }
    port_ = declare_parameter("web_port", 8765);
    // 点検するワークスペースとパッケージ (講習と同じ ~/src26_ws と tutorial_nodes)
    std::string ws = declare_parameter("workspace", std::string("~/src26_ws"));
    if (ws.rfind("~/", 0) == 0) {ws = std::string(home ? home : ".") + ws.substr(1);}
    while (ws.size() > 1 && ws.back() == '/') {ws.pop_back();}
    const char * dom = std::getenv("ROS_DOMAIN_ID");
    std::vector<std::string> prefixes;
    {
      std::istringstream ps(std::getenv("AMENT_PREFIX_PATH") ? std::getenv("AMENT_PREFIX_PATH") : "");
      for (std::string p; std::getline(ps, p, ':'); ) {if (!p.empty()) {prefixes.push_back(p);}}
    }
    const std::string pkg = declare_parameter("package", std::string("tutorial_nodes"));
    doctor_ = std::make_unique<publish_or_perish::Doctor>(ws, pkg, home ? home : ".", dom && *dom ? dom : "0", prefixes);
    {
      const std::string h = home ? home : "";
      const bool under_home = !h.empty() && ws.rfind(h + "/", 0) == 0;
      ws_shown_ = under_home ? "~" + ws.substr(h.size()) : ws;
      pkg_ = pkg;
    }
    for (auto & [name, b] : world_.bots) {declare_parameter(name + ".seed", b.seed);}
    param_cb_ = add_on_set_parameters_callback(
      [this](const std::vector<rclcpp::Parameter> & ps) {return on_param(ps);});

    for (auto & [name, b] : world_.bots) {setup_bot(name);}
    auto latched = rclcpp::QoS(1).transient_local();
    moisture_pub_ = create_publisher<nav_msgs::msg::OccupancyGrid>("/field/moisture", latched);
    crops_pub_ = create_publisher<nav_msgs::msg::OccupancyGrid>("/field/crops", latched);
    money_pub_ = create_publisher<std_msgs::msg::Int64>("/money", 10);
    state_pub_ = create_publisher<std_msgs::msg::String>("/farm/state", 10);
    ui_sub_ = create_subscription<std_msgs::msg::String>(
      "/farm/ui", 10, [this](const std_msgs::msg::String & m) {on_ui(m.data);});
    setup_board();

    last_ = std::chrono::steady_clock::now();
    step_timer_ = create_wall_timer(33ms, [this] {step();});
    pose_timer_ = create_wall_timer(50ms, [this] {publish_poses();});
    field_timer_ = create_wall_timer(200ms, [this] {publish_field();});
    state_timer_ = create_wall_timer(66ms, [this] {publish_state();});
    graph_timer_ = create_wall_timer(1s, [this] {scan_graph();});
    save_timer_ = create_wall_timer(20s, [this] {save();});
    RCLCPP_INFO(get_logger(), "%s", render_en({"console.opened", {{"port", port_}}}).c_str());
  }

  ~FarmNode() override {save();}

private:
  // ---- ロボットごとの topic / service ----
  void setup_bot(const std::string & name)
  {
    const std::string p = "/" + name + "/";
    cmd_subs_.push_back(create_subscription<geometry_msgs::msg::Twist>(
        p + "cmd_vel", 10, [this, name](const geometry_msgs::msg::Twist & m) {
          world_.command(name, m.linear.x, m.linear.y, m.angular.z, cmd_source(name));
        }));
    pose_pubs_[name] = create_publisher<geometry_msgs::msg::Pose2D>(p + "pose", 10);
    tank_pubs_[name] = create_publisher<std_msgs::msg::Int32>(p + "tank", 10);
    using Trigger = std_srvs::srv::Trigger;
    auto serve = [this, name, p](const std::string & srv, auto op) {
        services_.push_back(create_service<Trigger>(
            p + srv, [this, name, p, srv, op](const Trigger::Request::SharedPtr, Trigger::Response::SharedPtr res) {
              auto r = (world_.*op)(name);
              res->success = r.ok;
              res->message = render_en(r.msg);
              log_cli("service " + p + srv, r.msg, res->message, r.ok);
            }));
      };
    serve("plant", &publish_or_perish::World::plant);
    serve("water", &publish_or_perish::World::water);
    serve("harvest", &publish_or_perish::World::harvest);
  }

  // /<bot>/cmd_vel を publish しているノードから, 指令を出したのが CLI かプレイヤーかを決める
  Source cmd_source(const std::string & bot) {return topic_source("/" + bot + "/cmd_vel");}

  // topic を publish しているノードが CLI かプレイヤーか (受け取ったときに呼ぶ)
  Source topic_source(const std::string & topic)
  {
    bool cli = false, player = false;
    for (const auto & e : get_publishers_info_by_topic(topic)) {
      const auto & n = e.node_name();
      if (n.rfind("_ros2cli_", 0) == 0) {cli = true;} else if (!is_tool(n)) {player = true;}
    }
    if (cli && player) {return Source::Mixed;}
    return cli ? Source::Cli : player ? Source::Player : Source::None;
  }

  // service の client を持っているノードが CLI かプレイヤーか (呼ばれたときに呼ぶ).
  // service の server は呼んだノードを知らないので, グラフから client を探す
  Source service_client_source(const std::string & service)
  {
    bool cli = false, player = false;
    auto graph = get_node_graph_interface();
    for (const auto & [name, ns] : graph->get_node_names_and_namespaces()) {
      if (name == "farm" || (is_tool(name) && name.rfind("_ros2cli_", 0) != 0)) {continue;}
      try {
        if (!graph->get_client_names_and_types_by_node(name, ns).count(service)) {continue;}
      } catch (const std::exception &) {
        continue;  // 調べている間にノードが終わった
      }
      if (name.rfind("_ros2cli_", 0) == 0) {cli = true;} else {player = true;}
    }
    if (cli && player) {return Source::Mixed;}
    return cli ? Source::Cli : player ? Source::Player : Source::None;
  }

  // ---- 看板 (ステージ 4) ----
  // 農場の決まり (マス, 水, 作物) を使わずに, 自分のノードで topic と service を試す相手.
  // イベントの bot には送り手 ("player" / "cli" / "mixed" / "none") を入れる
  void setup_board()
  {
    board_text_sub_ = create_subscription<std_msgs::msg::String>(
      "/board/text", 10, [this](const std_msgs::msg::String & m) {
        board_.text = clip(m.data, 40);
        board_.text_src = publish_or_perish::to_string(topic_source("/board/text"));
        world_.emit(publish_or_perish::Event{"board_text", board_.text_src});
      });
    board_number_pub_ = create_publisher<std_msgs::msg::Int32>("/board/number", 10);
    board_answer_sub_ = create_subscription<std_msgs::msg::Int32>(
      "/board/answer", 10, [this](const std_msgs::msg::Int32 & m) {on_board_answer(m.data);});
    using Trigger = std_srvs::srv::Trigger;
    board_bell_srv_ = create_service<Trigger>(
      "/board/bell", [this](const Trigger::Request::SharedPtr, Trigger::Response::SharedPtr res) {
        const std::string src = publish_or_perish::to_string(service_client_source("/board/bell"));
        board_.bells++;
        res->success = true;
        const Msg msg{"srv.bell", {{"n", board_.bells}}};
        res->message = render_en(msg);
        world_.emit(publish_or_perish::Event{"board_bell", src});
        log_cli("service /board/bell", msg, res->message, true);
      });
    board_timer_ = create_wall_timer(2s, [this] {next_board_number();});
    next_board_number();
  }

  // 2 秒ごとに 1〜50 の数を出す. 前と同じ数は出さない (変わったことが見えるように)
  void next_board_number()
  {
    std::uniform_int_distribution<int> pick(1, 50);
    int v = pick(rng_);
    while (v == board_.cur.value) {v = pick(rng_);}
    board_.prev = board_.cur;
    board_.cur = {v, false};
    std_msgs::msg::Int32 m;
    m.data = v;
    board_number_pub_->publish(m);
  }

  // 今の数か 1 つ前の数 (答えを送った直後に数が変わったとき) の 2 倍なら正解.
  // 1 つの数への正解は 1 回だけ数える. 同じ答えを送り続けても, 画面の表示は増やさない
  void on_board_answer(int v)
  {
    const std::string src = publish_or_perish::to_string(topic_source("/board/answer"));
    bool ok = false, first = false;
    for (auto * n : {&board_.cur, &board_.prev}) {
      if (n->value > 0 && v == 2 * n->value) {
        ok = true;
        if (!n->answered) {n->answered = true; first = true;}
      }
    }
    const bool changed = v != board_.answer || ok != (board_.ok == 1);
    board_.answer = v;
    board_.ok = ok ? 1 : 0;
    if (first || (!ok && changed)) {
      publish_or_perish::Event e{"board_answer", src};
      e.value = first ? 1.0 : 0.0;
      world_.emit(e);
    }
  }

  rcl_interfaces::msg::SetParametersResult on_param(const std::vector<rclcpp::Parameter> & ps)
  {
    rcl_interfaces::msg::SetParametersResult r;
    r.successful = true;
    for (const auto & p : ps) {
      const auto dot = p.get_name().find(".seed");
      if (dot == std::string::npos) {continue;}
      const std::string bot = p.get_name().substr(0, dot), seed = p.as_string();
      // 断った理由は ros2 param set の出力に出るので英語にする
      Msg why;
      if (!publish_or_perish::find_crop(seed)) {
        why = {"param.bad_seed"};
      } else if (!world_.unlocked.count(seed)) {
        why = {"param.locked", {{"seed", seed}}};
      } else if (world_.bots.count(bot)) {
        world_.bots[bot].seed = seed;
        log({"log.param_set", {{"name", p.get_name()}, {"value", seed}}}, true);
      }
      if (!why.empty()) {
        r.successful = false;
        r.reason = render_en(why);
        log_cli("param " + p.get_name(), why, r.reason, false);
      }
    }
    return r;
  }

  // ---- 1 フレーム進める ----
  void step()
  {
    const auto now = std::chrono::steady_clock::now();
    const double dt = std::min(0.1, std::chrono::duration<double>(now - last_).count());
    last_ = now;
    world_.step(dt);
    auto events = world_.take_events();
    graph_.now = world_.time;
    progress_.update(events, graph_, world_);
    for (const auto & e : events) {
      if (e.kind == "move" || e.kind == "enter" || e.kind == "board_text") {continue;}
      fx_.push_back({++fx_id_, e});
      if (e.kind == "ripe") {log({"log.ripe", {{"x", e.x}, {"y", e.y}}}, true);}
      if (e.kind == "wither") {log({"log.wither", {{"x", e.x}, {"y", e.y}}}, false);}
    }
    while (fx_.size() > 40) {fx_.pop_front();}
    for (auto & n : progress_.take_notices()) {
      notices_.push_back({++notice_id_, n});
      log({"log.notice", {{"title", n.title}, {"body", n.body}}}, true);
    }
    while (notices_.size() > 20) {notices_.pop_front();}
  }

  // 画面のログ (画面が訳す)
  void log(const Msg & msg, bool ok) {log_cli("", msg, "", ok);}

  // ターミナルにも出た結果 (service の返事, パラメータを断った理由). 画面は英語の text とその訳を並べて出す.
  // tag は何への返事か (例: "service /bot1/water")
  void log_cli(const std::string & tag, const Msg & msg, const std::string & text, bool ok)
  {
    logs_.push_back({++log_id_, msg, tag, text, ok});
    while (logs_.size() > 40) {logs_.pop_front();}
  }

  // ---- ROS のグラフを読む (課題の判定に使う) ----
  void scan_graph()
  {
    publish_or_perish::Graph g;
    for (const auto & full : get_node_names()) {
      const std::string n = full.substr(full.rfind('/') + 1);
      g.nodes.insert(n);
      if (n.rfind("_ros2cli_", 0) == 0 && n.rfind("_ros2cli_daemon", 0) != 0) {
        g.cli.insert(n);
      } else if (!is_tool(n)) {
        g.players.insert(n);
        g.player_full.insert(full);
      }
    }
    for (const char * t : {"/bot1/pose", "/field/moisture", "/field/crops", "/board/number"}) {
      for (const auto & e : get_subscriptions_info_by_topic(t)) {g.subs[t].push_back(e.node_name());}
    }
    for (const auto & [name, b] : world_.bots) {
      const std::string t = "/" + name + "/cmd_vel";
      for (const auto & e : get_publishers_info_by_topic(t)) {g.pubs[t].emplace_back(e.node_name(), e.node_namespace());}
    }
    g.automated = g.cli.empty() && !g.players.empty();
    g.now = world_.time;
    report_ = doctor_->scan();
    g.ws = report_.facts;
    // 新しく見つかった間違いはログにも 1 行出す
    std::set<std::string> now;
    for (const auto & f : report_.findings) {
      const std::string key = f.id + f.file + std::to_string(f.line) + to_json(f.title);
      now.insert(key);
      if (f.level != "info" && !shown_findings_.count(key)) {log({"log.doctor", {{"title", f.title}}}, false);}
    }
    shown_findings_ = now;
    graph_ = g;
    scan_wires();
  }

  // ---- 配線の見える化: topic ごとのつながり, 流量, 警告 ----
  bool farm_consumes(const std::string & t) const
  {
    if (t == "/board/text" || t == "/board/answer") {return true;}
    for (const auto & [n, b] : world_.bots) {if (t == "/" + n + "/cmd_vel") {return true;}}
    return false;
  }

  std::vector<std::string> farm_publishes() const
  {
    std::vector<std::string> v{"/field/moisture", "/field/crops", "/money", "/board/number"};
    for (const auto & [n, b] : world_.bots) {
      v.push_back("/" + n + "/pose");
      v.push_back("/" + n + "/tank");
    }
    return v;
  }

  // a に一番近い候補 (編集距離 3 以内). なければ空
  static std::string nearest(const std::string & a, const std::vector<std::string> & cands)
  {
    std::string best;
    size_t bd = 4;
    for (const auto & c : cands) {
      const size_t d = distance(a, c);
      if (d > 0 && d < bd) {bd = d; best = c;}
    }
    return best;
  }

  void scan_wires()
  {
    const auto now = std::chrono::steady_clock::now();
    const double el = std::max(0.2, std::chrono::duration<double>(now - wire_t_).count());
    wire_t_ = now;
    for (auto & [t, w] : wires_) {
      w.hz = w.count / el;
      w.bps = w.bytes / el;
      w.count = w.bytes = 0;
      w.alive = false;
    }
    std::vector<std::string> consumed{"/board/text", "/board/answer"};
    for (const auto & [n, b] : world_.bots) {consumed.push_back("/" + n + "/cmd_vel");}
    const auto published = farm_publishes();
    for (const auto & [topic, types] : get_topic_names_and_types()) {
      if (topic == "/rosout" || topic == "/parameter_events" || topic.rfind("/farm/", 0) == 0 ||
        topic == "/client_count" || topic == "/connected_clients" || topic.rfind("/_", 0) == 0)
      {
        continue;
      }
      const auto pubs = get_publishers_info_by_topic(topic);
      const auto subs = get_subscriptions_info_by_topic(topic);
      bool ours = topic.rfind("/bot", 0) == 0 || topic.rfind("/field/", 0) == 0 || topic == "/money" ||
        topic.rfind("/board/", 0) == 0;
      for (const auto & e : pubs) {ours |= kind_of(e.node_name()) == "player" || kind_of(e.node_name()) == "cli";}
      for (const auto & e : subs) {ours |= kind_of(e.node_name()) == "player" || kind_of(e.node_name()) == "cli";}
      if (!ours) {continue;}
      auto & w = wires_[topic];
      w.alive = true;
      w.types = types;
      if (!w.sub) {
        // 流量を測るためだけの購読. best_effort は reliable / best_effort どちらの送り手とも合う
        w.sub = create_generic_subscription(
          topic, types.front(), rclcpp::QoS(10).best_effort(),
          [this, topic](std::shared_ptr<const rclcpp::SerializedMessage> m) {
            auto & x = wires_[topic];
            x.count++;
            x.bytes += m->size();
          });
      }
      w.pubs.clear();
      w.subs.clear();
      // 表示名は namespace 込み (/bot1/farmer). 同じノードが 2 回出ないようにする (農場の計測用の購読など)
      auto add = [](std::vector<Endpoint> & v, const rclcpp::TopicEndpointInfo & e) {
          const std::string ns = e.node_namespace();
          const std::string shown = ns == "/" ? e.node_name() : ns + "/" + e.node_name();
          for (const auto & x : v) {if (x.node == shown) {return;}}
          v.push_back({shown, kind_of(e.node_name()), reliability(e.qos_profile().reliability())});
        };
      for (const auto & e : pubs) {add(w.pubs, e);}
      for (const auto & e : subs) {
        // 農場の購読は, 計測用でなく本当に使っているもの (cmd_vel) だけを数える
        if (e.node_name() == "farm" && !farm_consumes(topic)) {continue;}
        add(w.subs, e);
      }
      w.warn = {};
      w.hint.clear();
      bool sender = false, receiver = false;
      for (const auto & e : w.pubs) {sender |= e.kind == "player" || e.kind == "cli";}
      for (const auto & e : w.subs) {receiver |= e.kind == "player" || e.kind == "cli";}
      if (types.size() > 1) {
        w.warn = {"wire.type_mismatch", {{"a", types[0]}, {"b", types[1]}}};
      } else if (sender && w.subs.empty()) {
        w.warn = {"wire.no_sub"};
        w.hint = nearest(topic, consumed);
      } else if (receiver && w.pubs.empty()) {
        w.warn = {"wire.no_pub"};
        w.hint = nearest(topic, published);
      } else {
        for (const auto & p : w.pubs) {
          for (const auto & q : w.subs) {
            if (p.rel == std::string("best_effort") && q.rel == std::string("reliable")) {
              w.warn = {"wire.qos", {{"pub", p.node}, {"sub", q.node}}};
            }
          }
        }
      }
    }
    for (auto it = wires_.begin(); it != wires_.end(); ) {
      it = it->second.alive ? std::next(it) : wires_.erase(it);
    }
  }

  // ---- 出力 ----
  void publish_poses()
  {
    for (const auto & [name, b] : world_.bots) {
      geometry_msgs::msg::Pose2D p;
      p.x = b.x;
      p.y = b.y;
      p.theta = b.th;
      pose_pubs_[name]->publish(p);
      std_msgs::msg::Int32 t;
      t.data = b.tank;
      tank_pubs_[name]->publish(t);
    }
  }

  void publish_field()
  {
    nav_msgs::msg::OccupancyGrid m, c;
    m.header.stamp = now();
    m.header.frame_id = "field";
    m.info.resolution = 1.0;
    m.info.width = world_.width;
    m.info.height = world_.height;
    m.info.origin.orientation.w = 1.0;
    c.header = m.header;
    c.info = m.info;
    for (const auto & row : world_.tiles) {
      for (const auto & t : row) {
        m.data.push_back(static_cast<int8_t>(std::lround(t.moisture)));
        // -1: なし, 0〜99: 生育中, 100: 実った, -2: 枯れた
        c.data.push_back(!t.crop ? -1 : t.crop->dead ? -2 :
          static_cast<int8_t>(std::min(100L, std::lround(t.crop->growth * 100))));
      }
    }
    moisture_pub_->publish(m);
    crops_pub_->publish(c);
    std_msgs::msg::Int64 money;
    money.data = world_.money;
    money_pub_->publish(money);
  }

  // その課題があるステージの番号
  size_t stage_of(const std::string & mission_id) const
  {
    for (size_t i = 0; i < progress_.stages.size(); ++i) {
      for (const auto & m : progress_.stages[i].missions) {if (m.id == mission_id) {return i;}}
    }
    return progress_.stages.size();
  }

  std::vector<ShopItem> shop() const
  {
    std::vector<ShopItem> s;
    // 名前と説明は訳の表の shop.<id>
    if (world_.width < 14) {s.push_back({"col", 150 + 50L * (world_.width - 8)});}
    if (world_.height < 9) {s.push_back({"row", 200 + 80L * (world_.height - 5)});}
    if (!world_.unlocked.count("tomato")) {s.push_back({"tomato", 120});}
    if (!world_.unlocked.count("pumpkin")) {s.push_back({"pumpkin", 400});}
    const auto & b = world_.bots.at("bot1");
    if (b.tank_max < 30) {s.push_back({"tank", 100 + 20L * (b.tank_max - 10)});}
    if (!world_.bots.count("bot2") && progress_.stage_index() >= stage_of("s5_buy")) {
      s.push_back({"bot2", 500});
    }
    return s;
  }

  void on_ui(const std::string & cmd)
  {
    if (cmd.rfind("diag ", 0) == 0) {
      RCLCPP_INFO(get_logger(), "%s", render_en({"console.diag", {{"text", cmd.substr(5)}}}).c_str());
      return;
    }
    if (cmd.rfind("speed ", 0) == 0) {
      const double v = std::atof(cmd.c_str() + 6);
      if (v == 1 || v == 2 || v == 4) {
        world_.farm_speed = v;
        log({"log.speed", {{"n", static_cast<int>(v)}}}, true);
      }
      return;
    }
    if (cmd.rfind("buy ", 0) != 0) {return;}
    const std::string id = cmd.substr(4);
    for (const auto & it : shop()) {
      if (it.id != id) {continue;}
      if (world_.money < it.price) {
        log({"log.no_money", {{"item", Msg{"shop." + id + ".name"}}}}, false);
        return;
      }
      world_.money -= it.price;
      if (id == "col") {world_.add_column();}
      if (id == "row") {world_.add_row();}
      if (id == "tomato" || id == "pumpkin") {world_.unlocked.insert(id);}
      if (id == "tank") {
        for (auto & [n, b] : world_.bots) {b.tank_max += 5;}
      }
      if (id == "bot2") {
        world_.add_bot("bot2", 1.5, 2.5);
        declare_parameter("bot2.seed", world_.bots["bot2"].seed);
        setup_bot("bot2");
      }
      log({"log.bought", {{"item", Msg{"shop." + id + ".name"}}, {"price", it.price}}}, true);
      world_.emit(publish_or_perish::Event{"buy", "", -1, -1, id});
      save();
      return;
    }
  }

  // 画面用の状態 (JSON)
  void publish_state()
  {
    std::ostringstream o;
    const int lv = progress_.level();
    o << "{\"t\":" << num(world_.time) << ",\"money\":" << world_.money << ",\"xp\":" << progress_.xp
      << ",\"level\":" << lv + 1
      << ",\"lv_xp\":" << progress_.level_xp(lv) << ",\"next_xp\":" << progress_.level_xp(lv + 1)
      << ",\"w\":" << world_.width << ",\"h\":" << world_.height << ",\"tiles\":[";
    bool first = true;
    for (const auto & row : world_.tiles) {
      for (const auto & t : row) {
        o << (first ? "" : ",") << "[" << std::lround(t.moisture) << ","
          << (t.crop ? q(t.crop->kind) : "null") << "," << (t.crop ? num(t.crop->growth) : "0") << ","
          << (t.crop && t.crop->dead ? 1 : 0) << "," << (t.well ? 1 : 0) << "]";
        first = false;
      }
    }
    o << "],\"bots\":[";
    first = true;
    for (const auto & [name, b] : world_.bots) {
      o << (first ? "" : ",") << "{\"name\":" << q(name) << ",\"x\":" << num(b.x) << ",\"y\":" << num(b.y)
        << ",\"th\":" << num(b.th) << ",\"tank\":" << b.tank << ",\"tank_max\":" << b.tank_max
        << ",\"seed\":" << q(b.seed) << ",\"moving\":" << (b.cmd_age < publish_or_perish::kCmdTimeout ? 1 : 0)
        << ",\"src\":" << q(publish_or_perish::to_string(b.cmd_src)) << "}";
      first = false;
    }
    const size_t si = progress_.stage_index();
    o << "],\"stage_index\":" << si << ",\"stage_count\":" << progress_.stages.size()
      << ",\"workspace\":" << q(ws_shown_) << ",\"package\":" << q(pkg_);
    if (si < progress_.stages.size()) {
      const auto & s = progress_.stages[si];
      o << ",\"stage\":{\"id\":" << q(s.id) << ",\"missions\":[";
      first = true;
      for (const auto & m : s.missions) {
        o << (first ? "" : ",") << "{\"id\":" << q(m.id) << ",\"unit\":" << q(m.unit) << ",\"goal\":" << num(m.goal)
          << ",\"value\":" << num(m.value) << ",\"done\":" << (m.done ? 1 : 0)
          << ",\"reward\":" << m.reward << "}";
        first = false;
      }
      o << "]}";
    }
    o << ",\"upcoming\":[";
    first = true;
    for (const auto & u : progress_.upcoming) {o << (first ? "" : ",") << q(u); first = false;}
    o << "],\"achievements\":[";
    first = true;
    for (const auto & a : progress_.achievements) {
      // 隠し実績は, 取るまで id を見せない (画面は achievement.hidden を出す)
      const bool show = a.done || !a.hidden;
      o << (first ? "" : ",") << "{\"id\":" << q(show ? a.id : "hidden") << ",\"done\":" << (a.done ? 1 : 0) << "}";
      first = false;
    }
    o << "],\"shop\":[";
    first = true;
    for (const auto & it : shop()) {
      o << (first ? "" : ",") << "{\"id\":" << q(it.id) << ",\"price\":" << it.price << "}";
      first = false;
    }
    o << "],\"speed\":" << world_.farm_speed << ",\"board\":{\"text\":" << q(board_.text)
      << ",\"text_src\":" << q(board_.text_src) << ",\"number\":" << board_.cur.value
      << ",\"answer\":" << board_.answer << ",\"ok\":" << board_.ok << ",\"bells\":" << board_.bells
      << "},\"wires\":[";
    first = true;
    for (const auto & [t, w] : wires_) {
      o << (first ? "" : ",") << "{\"topic\":" << q(t) << ",\"type\":" << q(w.types.empty() ? "" : w.types.front())
        << ",\"hz\":" << num(w.hz) << ",\"bps\":" << std::lround(w.bps)
        << ",\"warn\":" << (w.warn.empty() ? "null" : to_json(w.warn))
        << ",\"hint\":" << q(w.hint) << ",\"pubs\":[";
      bool f2 = true;
      for (const auto & e : w.pubs) {o << (f2 ? "" : ",") << "[" << q(e.node) << "," << q(e.kind) << "]"; f2 = false;}
      o << "],\"subs\":[";
      f2 = true;
      for (const auto & e : w.subs) {o << (f2 ? "" : ",") << "[" << q(e.node) << "," << q(e.kind) << "]"; f2 = false;}
      o << "]}";
      first = false;
    }
    o << "],\"graph\":{\"auto\":" << (graph_.automated ? 1 : 0) << ",\"cli\":" << graph_.cli.size()
      << ",\"players\":[";
    first = true;
    for (const auto & n : graph_.player_full) {o << (first ? "" : ",") << q(n); first = false;}
    o << "]},\"doctor\":[";
    first = true;
    for (const char * level : {"error", "warn", "info"}) {
      for (const auto & f : report_.findings) {
        if (f.level != level) {continue;}
        o << (first ? "" : ",") << "{\"id\":" << q(f.id) << ",\"level\":" << q(f.level) << ",\"title\":" << to_json(f.title)
          << ",\"detail\":" << to_json(f.detail) << ",\"fix\":" << q(f.fix) << ",\"file\":" << q(f.file)
          << ",\"line\":" << f.line << "}";
        first = false;
      }
    }
    o << "],\"log\":[";
    first = true;
    for (const auto & l : logs_) {
      o << (first ? "" : ",") << "{\"id\":" << l.id << ",\"msg\":" << to_json(l.msg) << ",\"tag\":" << q(l.tag)
        << ",\"text\":" << q(l.text) << ",\"ok\":" << (l.ok ? 1 : 0) << "}";
      first = false;
    }
    o << "],\"fx\":[";
    first = true;
    for (const auto & f : fx_) {
      o << (first ? "" : ",") << "{\"id\":" << f.id << ",\"kind\":" << q(f.e.kind) << ",\"x\":" << f.e.x
        << ",\"y\":" << f.e.y << ",\"bot\":" << q(f.e.bot) << ",\"crop\":" << q(f.e.crop)
        << ",\"value\":" << num(f.e.value) << "}";
      first = false;
    }
    o << "],\"notices\":[";
    first = true;
    for (const auto & n : notices_) {
      o << (first ? "" : ",") << "{\"id\":" << n.id << ",\"kind\":" << q(n.n.kind) << ",\"title\":"
        << to_json(n.n.title) << ",\"body\":" << to_json(n.n.body) << "}";
      first = false;
    }
    o << "]}";
    std_msgs::msg::String msg;
    msg.data = o.str();
    state_pub_->publish(msg);
  }

  // ---- 保存 (1 行 1 項目のテキスト) ----
  void save()
  {
    std::filesystem::create_directories(std::filesystem::path(save_path_).parent_path());
    std::ofstream f(save_path_);
    f << "version 1\nmoney " << world_.money << "\nxp " << progress_.xp << "\nsize " << world_.width << " "
      << world_.height << "\nunlocked";
    for (const auto & u : world_.unlocked) {f << " " << u;}
    f << "\n";
    for (const auto & [n, b] : world_.bots) {
      f << "bot " << n << " " << b.x << " " << b.y << " " << b.th << " " << b.tank << " " << b.tank_max << " "
        << b.seed << "\n";
    }
    for (const auto & [k, v] : world_.stats) {f << "stat " << k << " " << v << "\n";}
    for (int y = 0; y < world_.height; ++y) {
      for (int x = 0; x < world_.width; ++x) {
        const auto & t = world_.tiles[y][x];
        f << "tile " << x << " " << y << " " << t.moisture;
        if (t.crop) {f << " " << t.crop->kind << " " << t.crop->growth << " " << t.crop->ripe_for << " " << t.crop->dead;}
        f << "\n";
      }
    }
    for (const auto & s : progress_.stages) {
      for (const auto & m : s.missions) {f << "mission " << m.id << " " << m.done << " " << m.value << "\n";}
    }
    for (const auto & a : progress_.achievements) {
      if (a.done) {f << "achievement " << a.id << "\n";}
    }
  }

  void load()
  {
    std::ifstream f(save_path_);
    if (!f) {return;}
    std::string line;
    while (std::getline(f, line)) {
      std::istringstream s(line);
      std::string key;
      s >> key;
      if (key == "money") {s >> world_.money;}
      if (key == "xp") {s >> progress_.xp;}
      if (key == "size") {
        int w, h;
        s >> w >> h;
        while (world_.width < w) {world_.add_column();}
        while (world_.height < h) {world_.add_row();}
      }
      if (key == "unlocked") {
        std::string u;
        while (s >> u) {world_.unlocked.insert(u);}
      }
      if (key == "bot") {
        std::string n;
        s >> n;
        auto & b = world_.bots[n];
        b.name = n;
        s >> b.x >> b.y >> b.th >> b.tank >> b.tank_max >> b.seed;
      }
      if (key == "stat") {
        std::string k;
        s >> k >> world_.stats[k];
      }
      if (key == "tile") {
        int x, y;
        s >> x >> y;
        if (x >= world_.width || y >= world_.height) {continue;}
        auto & t = world_.tiles[y][x];
        s >> t.moisture;
        publish_or_perish::Crop c;
        if (s >> c.kind >> c.growth >> c.ripe_for >> c.dead) {t.crop = c;}
      }
      if (key == "mission") {
        std::string id;
        bool done;
        double v;
        s >> id >> done >> v;
        for (auto & st : progress_.stages) {
          for (auto & m : st.missions) {
            // 時間窓や通ったマスを使う課題は途中から再開しない
            const bool restart = id == "s2_patrol" || id == "s3_auto" || id == "s5_auto";
            if (m.id == id) {m.done = done; m.value = (done || restart) ? (done ? m.goal : 0) : v;}
          }
        }
      }
      if (key == "achievement") {
        std::string id;
        s >> id;
        for (auto & a : progress_.achievements) {if (a.id == id) {a.done = true;}}
      }
    }
    RCLCPP_INFO(get_logger(), "%s", render_en({"console.resumed", {{"path", save_path_}}}).c_str());
  }

  struct Endpoint { std::string node, kind, rel; };
  struct Wire
  {
    std::vector<std::string> types;
    long count = 0, bytes = 0;
    double hz = 0.0, bps = 0.0;
    bool alive = false;
    std::vector<Endpoint> pubs, subs;
    Msg warn;          // 空なら警告なし
    std::string hint;  // 打ち間違いのとき, つもりだったらしい topic
    rclcpp::GenericSubscription::SharedPtr sub;
  };
  std::map<std::string, Wire> wires_;
  std::chrono::steady_clock::time_point wire_t_ = std::chrono::steady_clock::now();

  struct BoardNumber { int value = 0; bool answered = false; };
  struct Board
  {
    std::string text, text_src;   // 最後に /board/text に届いた文字と送り手
    BoardNumber cur, prev;        // 今出している数と 1 つ前の数
    int answer = 0;               // 最後に /board/answer に届いた数
    int ok = -1;                  // その答えが正解か (-1: まだ届いていない)
    long bells = 0;               // /board/bell が呼ばれた回数
  };
  Board board_;
  std::mt19937 rng_{std::random_device{}()};

  struct Log { long id; Msg msg; std::string tag, text; bool ok; };
  struct Fx { long id; publish_or_perish::Event e; };
  struct NoticeItem { long id; publish_or_perish::Notice n; };

  publish_or_perish::World world_;
  publish_or_perish::Progress progress_;
  publish_or_perish::Graph graph_;
  std::unique_ptr<publish_or_perish::Doctor> doctor_;
  publish_or_perish::DoctorReport report_;
  std::set<std::string> shown_findings_;
  std::string save_path_;
  std::string ws_shown_, pkg_;   // 画面に出すワークスペース (~ 始まり) とパッケージの名前
  long port_;
  std::deque<Log> logs_;
  std::deque<Fx> fx_;
  std::deque<NoticeItem> notices_;
  long log_id_ = 0, fx_id_ = 0, notice_id_ = 0;
  std::chrono::steady_clock::time_point last_;

  std::vector<rclcpp::Subscription<geometry_msgs::msg::Twist>::SharedPtr> cmd_subs_;
  std::map<std::string, rclcpp::Publisher<geometry_msgs::msg::Pose2D>::SharedPtr> pose_pubs_;
  std::map<std::string, rclcpp::Publisher<std_msgs::msg::Int32>::SharedPtr> tank_pubs_;
  std::vector<rclcpp::Service<std_srvs::srv::Trigger>::SharedPtr> services_;
  rclcpp::Publisher<nav_msgs::msg::OccupancyGrid>::SharedPtr moisture_pub_, crops_pub_;
  rclcpp::Publisher<std_msgs::msg::Int64>::SharedPtr money_pub_;
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr state_pub_;
  rclcpp::Subscription<std_msgs::msg::String>::SharedPtr ui_sub_, board_text_sub_;
  rclcpp::Publisher<std_msgs::msg::Int32>::SharedPtr board_number_pub_;
  rclcpp::Subscription<std_msgs::msg::Int32>::SharedPtr board_answer_sub_;
  rclcpp::Service<std_srvs::srv::Trigger>::SharedPtr board_bell_srv_;
  rclcpp::TimerBase::SharedPtr step_timer_, pose_timer_, field_timer_, state_timer_, graph_timer_, save_timer_,
    board_timer_;
  rclcpp::node_interfaces::OnSetParametersCallbackHandle::SharedPtr param_cb_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<FarmNode>();
  rclcpp::spin(node);
  node.reset();
  rclcpp::shutdown();
  return 0;
}

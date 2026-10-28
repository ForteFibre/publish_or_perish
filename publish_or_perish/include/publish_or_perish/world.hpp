// 農場の状態と規則. ROS に依存しない.
#pragma once

#include <deque>
#include <map>
#include <optional>
#include <set>
#include <string>
#include <utility>
#include <vector>

namespace publish_or_perish
{

struct CropInfo
{
  std::string id;
  std::string name;
  int cost;      // 種の値段 [G]
  int price;     // 売値 [G]
  double grow;   // 水が足りているときに実るまでの秒数
};

const std::vector<CropInfo> & crop_list();
const CropInfo * find_crop(const std::string & id);

constexpr double kMoistureDecay = 100.0 / 45.0;  // 1 秒あたりに減る水分 (45 秒で 100 -> 0)
constexpr double kGrowMinMoisture = 20.0;        // これ未満だと育たない
constexpr double kWaterAmount = 60.0;            // 1 回の水やりで増える水分
constexpr double kRipeKeep = 40.0;               // 実ってから枯れるまでの秒数
constexpr double kCmdTimeout = 0.5;              // cmd_vel が途切れてから止まるまでの秒数
constexpr double kMaxLinear = 1.5;               // [m/s]
constexpr double kMaxAngular = 3.0;              // [rad/s]
constexpr double kBotRadius = 0.3;               // [m]

struct Crop
{
  std::string kind;
  double growth = 0.0;    // 0..1
  double ripe_for = 0.0;  // 実ってからの秒数
  bool dead = false;
  bool ripe() const {return growth >= 1.0 && !dead;}
};

struct Tile
{
  double moisture = 0.0;  // 0..100
  std::optional<Crop> crop;
  bool well = false;
};

// 最後の cmd_vel を誰が出したか
enum class Source { None, Cli, Player, Mixed };
const char * to_string(Source s);

struct Bot
{
  std::string name;
  double x = 0.0, y = 0.0, th = 0.0;
  double vx = 0.0, vy = 0.0, wz = 0.0;  // 機体座標の速度指令
  double cmd_age = 1e9;
  int tank = 10, tank_max = 10;
  std::string seed = "wheat";
  int cell_x = -1, cell_y = -1;
  bool at_wall = false;
  Source cmd_src = Source::None;
  std::deque<std::pair<double, double>> trail;
};

// 画面と課題が読むイベント. kind は move / enter / plant / water / harvest / clear / ripe / wither / wall / refill
struct Event
{
  explicit Event(std::string k, std::string b = "", int x_ = -1, int y_ = -1, std::string c = "")
  : kind(std::move(k)), bot(std::move(b)), x(x_), y(y_), crop(std::move(c)) {}

  std::string kind;
  std::string bot;
  int x = -1, y = -1;
  std::string crop;
  double value = 0.0;  // move: 距離, water: 水やり前の水分, harvest: 売値
  double t = 0.0;
};

struct Result
{
  bool ok;
  std::string message;
};

class World
{
public:
  World(int width = 8, int height = 5);

  void step(double dt);
  void command(const std::string & bot, double vx, double vy, double wz, Source src);

  // ロボットの足元のマスへの操作
  Result plant(const std::string & bot);
  Result water(const std::string & bot);
  Result harvest(const std::string & bot);

  bool add_column();
  bool add_row();
  void add_bot(const std::string & name, double x, double y);
  void emit(Event e);

  // (x, y) [m] のマス. 畑の外なら nullptr
  Tile * tile_at(double x, double y, int & ix, int & iy);
  std::vector<Event> take_events();
  long stat(const std::string & key) const;

  int width, height;
  std::vector<std::vector<Tile>> tiles;  // tiles[y][x]
  std::map<std::string, Bot> bots;
  long money = 100;
  double time = 0.0;
  std::set<std::string> unlocked{"wheat"};
  std::map<std::string, long> stats;
  double farm_speed = 1.0;  // 作物と水分の時間だけを速める (ロボットの動きは実時間のまま)

private:
  void move(Bot & b, double dt);
  std::vector<Event> events_;
};

}  // namespace publish_or_perish

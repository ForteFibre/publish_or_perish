#include "publish_or_perish/world.hpp"

#include <algorithm>
#include <cmath>
#include <cstdarg>
#include <cstdio>

namespace publish_or_perish
{

const std::vector<CropInfo> & crop_list()
{
  static const std::vector<CropInfo> list = {
    {"wheat", "小麦", 5, 25, 30.0},
    {"tomato", "トマト", 15, 70, 50.0},
    {"pumpkin", "カボチャ", 40, 200, 90.0},
  };
  return list;
}

const CropInfo * find_crop(const std::string & id)
{
  for (const auto & c : crop_list()) {
    if (c.id == id) {return &c;}
  }
  return nullptr;
}

const char * to_string(Source s)
{
  switch (s) {
    case Source::Cli: return "cli";
    case Source::Player: return "player";
    case Source::Mixed: return "mixed";
    default: return "";
  }
}

namespace
{
std::string fmt(const char * f, ...)
{
  char buf[256];
  va_list ap;
  va_start(ap, f);
  std::vsnprintf(buf, sizeof(buf), f, ap);
  va_end(ap);
  return buf;
}
}  // namespace

World::World(int w, int h)
: width(w), height(h), tiles(h, std::vector<Tile>(w))
{
  tiles[0][0].well = true;
  Bot b;
  b.name = "bot1";
  b.x = 1.5;
  b.y = 0.5;
  bots[b.name] = b;
}

long World::stat(const std::string & key) const
{
  auto it = stats.find(key);
  return it == stats.end() ? 0 : it->second;
}

void World::emit(Event e)
{
  e.t = time;
  events_.push_back(std::move(e));
}

std::vector<Event> World::take_events()
{
  std::vector<Event> out;
  out.swap(events_);
  return out;
}

Tile * World::tile_at(double x, double y, int & ix, int & iy)
{
  ix = static_cast<int>(std::floor(x));
  iy = static_cast<int>(std::floor(y));
  if (ix < 0 || iy < 0 || ix >= width || iy >= height) {return nullptr;}
  return &tiles[iy][ix];
}

void World::step(double dt)
{
  time += dt;
  const double ft = dt * farm_speed;  // 作物と水分の時間
  for (int y = 0; y < height; ++y) {
    for (int x = 0; x < width; ++x) {
      Tile & t = tiles[y][x];
      if (t.well) {
        t.moisture = 100.0;
        continue;
      }
      t.moisture = std::max(0.0, t.moisture - kMoistureDecay * ft);
      if (!t.crop || t.crop->dead) {continue;}
      Crop & c = *t.crop;
      if (c.growth < 1.0) {
        if (t.moisture >= kGrowMinMoisture) {
          c.growth = std::min(1.0, c.growth + ft / find_crop(c.kind)->grow);
          if (c.growth >= 1.0) {emit(Event{"ripe", "", x, y, c.kind});}
        }
      } else {
        c.ripe_for += ft;
        if (c.ripe_for > kRipeKeep) {
          c.dead = true;
          stats["wither"]++;
          stats["streak"] = 0;
          emit(Event{"wither", "", x, y, c.kind});
        }
      }
    }
  }
  for (auto & [name, b] : bots) {move(b, dt);}
}

void World::command(const std::string & bot, double vx, double vy, double wz, Source src)
{
  auto it = bots.find(bot);
  if (it == bots.end()) {return;}
  Bot & b = it->second;
  b.vx = std::clamp(vx, -kMaxLinear, kMaxLinear);
  b.vy = std::clamp(vy, -kMaxLinear, kMaxLinear);
  b.wz = std::clamp(wz, -kMaxAngular, kMaxAngular);
  b.cmd_age = 0.0;
  b.cmd_src = src;
}

void World::move(Bot & b, double dt)
{
  b.cmd_age += dt;
  if (b.cmd_age > kCmdTimeout) {return;}
  const double c = std::cos(b.th), s = std::sin(b.th);
  const double nx = b.x + (b.vx * c - b.vy * s) * dt;
  const double ny = b.y + (b.vx * s + b.vy * c) * dt;
  b.th = std::remainder(b.th + b.wz * dt, 2 * M_PI);
  const double cx = std::clamp(nx, kBotRadius, width - kBotRadius);
  const double cy = std::clamp(ny, kBotRadius, height - kBotRadius);
  // 壁に当たった瞬間だけ数える (押し続けている間は数えない)
  const bool hit = (cx != nx || cy != ny) && std::hypot(b.vx, b.vy) > 0.05;
  if (hit && !b.at_wall) {
    stats["wall"]++;
    emit(Event{"wall", b.name});
  }
  b.at_wall = hit;
  const double moved = std::hypot(cx - b.x, cy - b.y);
  b.x = cx;
  b.y = cy;
  if (moved > 0) {
    Event e{"move", b.name};
    e.value = moved;
    emit(e);
  }
  int ix, iy;
  Tile * t = tile_at(b.x, b.y, ix, iy);
  if (ix != b.cell_x || iy != b.cell_y) {
    b.cell_x = ix;
    b.cell_y = iy;
    emit(Event{"enter", b.name, ix, iy});
  }
  if (t && t->well && b.tank < b.tank_max) {
    b.tank = b.tank_max;
    emit(Event{"refill", b.name, ix, iy});
  }
  if (b.trail.empty() || std::hypot(b.trail.back().first - b.x, b.trail.back().second - b.y) > 0.15) {
    b.trail.emplace_back(b.x, b.y);
    while (b.trail.size() > 40) {b.trail.pop_front();}
  }
}

Result World::plant(const std::string & bot)
{
  Bot & b = bots.at(bot);
  int ix, iy;
  Tile * t = tile_at(b.x, b.y, ix, iy);
  if (!t || t->well) {return {false, "ここには植えられない (井戸)"};}
  if (t->crop) {return {false, fmt("(%d, %d) にはもう作物がある", ix, iy)};}
  const CropInfo * info = find_crop(b.seed);
  if (money < info->cost) {
    return {false, fmt("お金が足りない (%sの種は %d G)", info->name.c_str(), info->cost)};
  }
  money -= info->cost;
  t->crop = Crop{b.seed};
  stats["plant"]++;
  Event e{"plant", bot, ix, iy, b.seed};
  e.value = info->cost;
  emit(e);
  return {true, fmt("(%d, %d) に%sを植えた (-%d G)", ix, iy, info->name.c_str(), info->cost)};
}

Result World::water(const std::string & bot)
{
  Bot & b = bots.at(bot);
  int ix, iy;
  Tile * t = tile_at(b.x, b.y, ix, iy);
  if (!t || t->well) {return {false, "ここは井戸. 立つとタンクが満タンになる"};}
  if (b.tank <= 0) {return {false, "タンクが空. 井戸 (左下のマス) で補給する"};}
  const double before = t->moisture;
  b.tank--;
  t->moisture = std::min(100.0, t->moisture + kWaterAmount);
  stats["water"]++;
  Event e{"water", bot, ix, iy};
  e.value = before;
  emit(e);
  return {true, fmt("(%d, %d) に水をやった (水分 %.0f -> %.0f, タンク %d/%d)",
      ix, iy, before, t->moisture, b.tank, b.tank_max)};
}

Result World::harvest(const std::string & bot)
{
  Bot & b = bots.at(bot);
  int ix, iy;
  Tile * t = tile_at(b.x, b.y, ix, iy);
  if (!t || !t->crop) {return {false, fmt("(%d, %d) には作物がない", ix, iy)};}
  Crop c = *t->crop;
  if (c.dead) {
    t->crop.reset();
    emit(Event{"clear", bot, ix, iy, c.kind});
    return {true, fmt("(%d, %d) の枯れた作物を片付けた", ix, iy)};
  }
  if (!c.ripe()) {return {false, fmt("(%d, %d) はまだ実っていない (%.0f%%)", ix, iy, c.growth * 100)};}
  const CropInfo * info = find_crop(c.kind);
  t->crop.reset();
  money += info->price;
  stats["harvest"]++;
  stats["harvest_" + c.kind]++;
  stats["earned"] += info->price;
  stats["streak"]++;
  Event e{"harvest", bot, ix, iy, c.kind};
  e.value = info->price;
  emit(e);
  return {true, fmt("(%d, %d) の%sを収穫した (+%d G)", ix, iy, info->name.c_str(), info->price)};
}

bool World::add_column()
{
  if (width >= 14) {return false;}
  for (auto & row : tiles) {row.emplace_back();}
  width++;
  return true;
}

void World::add_bot(const std::string & name, double x, double y)
{
  Bot b;
  b.name = name;
  b.x = x;
  b.y = y;
  bots[name] = b;
}

bool World::add_row()
{
  if (height >= 9) {return false;}
  tiles.emplace_back(width);
  height++;
  return true;
}

}  // namespace publish_or_perish

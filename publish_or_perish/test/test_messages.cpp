// ターミナルに出す文 (英語) が訳の表から作れるかを確かめる.
// 画面にだけ出す文 (ja.json) のキーは web/packages/i18n の Vitest で確かめる.
#include <gtest/gtest.h>

#include <string>

#include "publish_or_perish/messages.hpp"
#include "publish_or_perish/world.hpp"

using publish_or_perish::Msg;
using publish_or_perish::World;

namespace
{

// 英語の表にキーがあり, 埋め込みがすべて値に置き換わっている
void expect_rendered(const Msg & m)
{
  EXPECT_TRUE(publish_or_perish::has_en(m.key)) << m.key;
  const std::string text = publish_or_perish::render_en(m);
  EXPECT_EQ(text.find("{{"), std::string::npos) << m.key << ": " << text;
}

}  // namespace

TEST(Messages, RenderReplacesArgsAndNestedMessages)
{
  const Msg m{"srv.plant.done", {{"x", 2}, {"y", 0}, {"crop", Msg{"crop.wheat"}}, {"cost", 5}}};
  EXPECT_EQ(publish_or_perish::render_en(m), "Planted wheat at (2, 0) (-5 G).");
}

TEST(Messages, UnknownKeyIsReturnedAsIs)
{
  EXPECT_FALSE(publish_or_perish::has_en("no.such.key"));
  EXPECT_EQ(publish_or_perish::render_en(Msg{"no.such.key"}), "no.such.key");
}

TEST(Messages, MissingArgIsLeftVisible)
{
  EXPECT_EQ(publish_or_perish::render_en(Msg{"srv.bell"}), "Ding! (ring {{n}})");
}

TEST(Messages, JsonHasKeyAndNestedArgs)
{
  const Msg m{"srv.plant.no_money", {{"crop", Msg{"crop.tomato"}}, {"cost", 15}}};
  EXPECT_EQ(publish_or_perish::to_json(m),
    R"({"key":"srv.plant.no_money","args":{"crop":{"key":"crop.tomato","args":{}},"cost":"15"}})");
  EXPECT_EQ(publish_or_perish::json_string("a\"b\\\n"), R"("a\"b\\\n")");
}

TEST(Messages, NumFormatsDigits)
{
  EXPECT_EQ(publish_or_perish::num(59.6), "60");
  EXPECT_EQ(publish_or_perish::num(0.4567, 2), "0.46");
}

// World の操作が返す文を, 起きうる場合ごとに作ってみる
TEST(Messages, WorldResultsRenderInEnglish)
{
  World w;
  auto & b = w.bots.at("bot1");
  // 井戸の上
  b.x = 0.5;
  b.y = 0.5;
  for (auto r : {w.plant("bot1"), w.water("bot1")}) {
    EXPECT_FALSE(r.ok);
    expect_rendered(r.msg);
  }
  // 畑のマス (1, 0)
  b.x = 1.5;
  auto r = w.harvest("bot1");  // 作物がない
  EXPECT_FALSE(r.ok);
  expect_rendered(r.msg);
  w.money = 0;
  r = w.plant("bot1");  // お金が足りない
  EXPECT_EQ(r.msg.key, "srv.plant.no_money");
  expect_rendered(r.msg);
  w.money = 100;
  r = w.plant("bot1");
  EXPECT_TRUE(r.ok);
  expect_rendered(r.msg);
  r = w.plant("bot1");  // もう作物がある
  EXPECT_EQ(r.msg.key, "srv.plant.occupied");
  expect_rendered(r.msg);
  r = w.harvest("bot1");  // まだ実っていない
  EXPECT_EQ(r.msg.key, "srv.harvest.not_ripe");
  expect_rendered(r.msg);
  r = w.water("bot1");
  EXPECT_TRUE(r.ok);
  expect_rendered(r.msg);
  b.tank = 0;
  r = w.water("bot1");  // タンクが空
  EXPECT_EQ(r.msg.key, "srv.water.tank_empty");
  expect_rendered(r.msg);
  // 実った作物と枯れた作物
  auto & t = w.tiles[0][1];
  t.crop->growth = 1.0;
  r = w.harvest("bot1");
  EXPECT_EQ(r.msg.key, "srv.harvest.done");
  expect_rendered(r.msg);
  t.crop = publish_or_perish::Crop{"tomato"};
  t.crop->dead = true;
  r = w.harvest("bot1");
  EXPECT_EQ(r.msg.key, "srv.harvest.cleared");
  expect_rendered(r.msg);
}

// farm_node.cpp がターミナルに出す, そのほかの文
TEST(Messages, NodeMessagesRenderInEnglish)
{
  for (const Msg & m : {
      Msg{"srv.bell", {{"n", 3}}},
      Msg{"param.bad_seed"},
      Msg{"param.locked", {{"seed", "tomato"}}},
      Msg{"console.opened", {{"port", 8765L}}},
      Msg{"console.resumed", {{"path", "/tmp/save.txt"}}},
      Msg{"console.diag", {{"text", "browser fps:60"}}},
    })
  {
    expect_rendered(m);
  }
  for (const char * crop : {"crop.wheat", "crop.tomato", "crop.pumpkin"}) {
    EXPECT_TRUE(publish_or_perish::has_en(crop)) << crop;
  }
}

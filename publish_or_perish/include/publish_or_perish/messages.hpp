// 文言をキーと値で表す. 文そのものは訳の表 (web/public/i18n/<言語>.json) にある.
// ターミナルに出す文 (service の返事, ログ) は英語の表から作る. 画面にはキーと値を送り, 画面が訳す.
// 設計: docs/design/web-architecture.md の「メッセージと i18n」
#pragma once

#include <initializer_list>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace publish_or_perish
{

struct Msg;

// 文に埋め込む値. 文字列か, それ自体を訳す文 (例: 作物の名前 crop.wheat)
struct Arg
{
  Arg(std::string s);  // NOLINT(runtime/explicit) 文字列はそのまま値にする
  Arg(const char * s);  // NOLINT(runtime/explicit)
  Arg(int v);  // NOLINT(runtime/explicit)
  Arg(long v);  // NOLINT(runtime/explicit)
  Arg(const Msg & m);  // NOLINT(runtime/explicit)

  std::string text;
  std::shared_ptr<const Msg> msg;  // 訳す文のとき
};

struct Msg
{
  Msg() = default;
  Msg(std::string k, std::initializer_list<std::pair<std::string, Arg>> a = {});  // NOLINT(runtime/explicit)

  std::string key;
  std::vector<std::pair<std::string, Arg>> args;

  bool empty() const {return key.empty();}
};

// 小数を桁数を決めて文字列にする (例: num(0.4567, 2) → "0.46")
std::string num(double v, int digits = 0);

// 英語の表にキーがあるか
bool has_en(const std::string & key);

// 英語の文にする. 表にないキーはキーのまま返す
std::string render_en(const Msg & m);

// 画面に送る形 {"key": ..., "args": {...}}. 訳す文の値は入れ子の {"key", "args"} になる
std::string to_json(const Msg & m);

// JSON の文字列として書く ("..." と, 中のエスケープ)
std::string json_string(const std::string & s);

}  // namespace publish_or_perish

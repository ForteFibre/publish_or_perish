#include "publish_or_perish/messages.hpp"

#include <algorithm>
#include <cstdio>
#include <cstring>
#include <iterator>
#include <sstream>

#include "publish_or_perish/messages_en.hpp"

namespace publish_or_perish
{

Arg::Arg(std::string s) : text(std::move(s)) {}
Arg::Arg(const char * s) : text(s) {}
Arg::Arg(int v) : text(std::to_string(v)) {}
Arg::Arg(long v) : text(std::to_string(v)) {}
Arg::Arg(const Msg & m) : msg(std::make_shared<const Msg>(m)) {}

Msg::Msg(std::string k, std::initializer_list<std::pair<std::string, Arg>> a)
: key(std::move(k)), args(a) {}

std::string num(double v, int digits)
{
  char buf[64];
  std::snprintf(buf, sizeof(buf), "%.*f", digits, v);
  return buf;
}

namespace
{
const char * find_en(const std::string & key)
{
  const auto & t = generated::kEn;
  auto it = std::lower_bound(std::begin(t), std::end(t), key,
      [](const generated::Entry & e, const std::string & k) {return std::strcmp(e.key, k.c_str()) < 0;});
  return it != std::end(t) && key == it->key ? it->text : nullptr;
}
}  // namespace

bool has_en(const std::string & key) {return find_en(key) != nullptr;}

std::string render_en(const Msg & m)
{
  const char * tmpl = find_en(m.key);
  if (!tmpl) {return m.key;}
  // {{名前}} を値で置き換える (i18next と同じ書き方)
  std::string out;
  const std::string t = tmpl;
  for (size_t i = 0; i < t.size(); ) {
    const size_t open = t.find("{{", i);
    if (open == std::string::npos) {out += t.substr(i); break;}
    const size_t close = t.find("}}", open + 2);
    if (close == std::string::npos) {out += t.substr(i); break;}
    out += t.substr(i, open - i);
    const std::string name = t.substr(open + 2, close - open - 2);
    auto a = std::find_if(m.args.begin(), m.args.end(), [&](const auto & kv) {return kv.first == name;});
    if (a == m.args.end()) {
      out += t.substr(open, close + 2 - open);  // 値がなければそのまま残す (テストで見つける)
    } else {
      out += a->second.msg ? render_en(*a->second.msg) : a->second.text;
    }
    i = close + 2;
  }
  return out;
}

std::string json_string(const std::string & s)
{
  std::string o = "\"";
  for (char c : s) {
    switch (c) {
      case '"': o += "\\\""; break;
      case '\\': o += "\\\\"; break;
      case '\n': o += "\\n"; break;
      case '\t': o += "\\t"; break;
      case '\r': o += "\\r"; break;
      default:
        if (static_cast<unsigned char>(c) < 0x20) {
          char buf[8];
          std::snprintf(buf, sizeof(buf), "\\u%04x", c);
          o += buf;
        } else {
          o += c;
        }
    }
  }
  return o + "\"";
}

std::string to_json(const Msg & m)
{
  std::ostringstream o;
  o << "{\"key\":" << json_string(m.key) << ",\"args\":{";
  bool first = true;
  for (const auto & [k, v] : m.args) {
    o << (first ? "" : ",") << json_string(k) << ":" << (v.msg ? to_json(*v.msg) : json_string(v.text));
    first = false;
  }
  o << "}}";
  return o.str();
}

}  // namespace publish_or_perish

// 点検. プレイヤーのワークスペース・パッケージ・.bashrc・動いているプロセスを外から調べ,
// ターミナルにはエラーが出ない (か, 出ても原因が読み取りにくい) 間違いを見つける.
// ROS に依存しない. ファイルは読むだけで, 何も書き換えない.
#pragma once

#include <set>
#include <string>
#include <vector>

namespace publish_or_perish
{

// 見つけた間違い 1 つ. level は error (このままでは動かない) / warn (動くが意図と違う) / info
struct Finding
{
  std::string id, level, title, detail, fix;
  std::string file;  // 絶対パス. 行がないときは line = 0
  int line = 0;
};

struct DoctorReport
{
  // 課題の判定に使う事実. 例: "src", "pkg", "built", "merged", "symlink", "bashrc", "auto",
  // "exe:<名前>" (CMakeLists.txt に登録), "bin:<名前>" (ビルド済み), "run:<名前>" (同じ ROS_DOMAIN_ID で動いている)
  std::set<std::string> facts;
  std::vector<Finding> findings;
};

class Doctor
{
public:
  // ws: ワークスペース (例: ~/src26_ws), pkg: 調べるパッケージ (例: tutorial_nodes)
  // home: ホームディレクトリ, domain_id: 農場の ROS_DOMAIN_ID
  // prefixes: AMENT_PREFIX_PATH (include したヘッダーが ROS のパッケージのものかを調べる)
  Doctor(std::string ws, std::string pkg, std::string home, std::string domain_id, std::vector<std::string> prefixes);

  DoctorReport scan() const;

private:
  void check_places(DoctorReport & r) const;
  void check_install(DoctorReport & r) const;
  void check_bashrc(DoctorReport & r) const;
  void check_package(DoctorReport & r) const;
  void check_build_log(DoctorReport & r) const;
  void check_processes(DoctorReport & r) const;
  bool is_ros_package(const std::string & name) const;

  std::string ws_, pkg_, home_, domain_id_;
  std::vector<std::string> prefixes_;
};

// コンパイラと CMake のエラー 1 行を日本語で説明する (分からないものは空)
std::string explain_build_error(const std::string & message, const std::set<std::string> & depends);

}  // namespace publish_or_perish

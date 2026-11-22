#include "publish_or_perish/doctor.hpp"

#include <sys/stat.h>
#include <unistd.h>

#include <algorithm>
#include <filesystem>
#include <fstream>
#include <map>
#include <regex>
#include <sstream>

namespace fs = std::filesystem;

namespace publish_or_perish
{

namespace
{

std::string read_file(const fs::path & p)
{
  std::ifstream f(p);
  std::stringstream s;
  s << f.rdbuf();
  return s.str();
}

std::vector<std::string> lines_of(const std::string & text)
{
  std::vector<std::string> out;
  std::istringstream s(text);
  std::string l;
  while (std::getline(s, l)) {out.push_back(l);}
  return out;
}

bool has_file(const fs::path & p)
{
  std::error_code ec;
  return fs::exists(p, ec);
}

// 更新時刻 [ns]. リンクは辿った先. ないときは 0
long long mtime(const fs::path & p)
{
  struct stat st {};
  if (::stat(p.c_str(), &st) != 0) {return 0;}
  return st.st_mtim.tv_sec * 1000000000LL + st.st_mtim.tv_nsec;
}

// テキストの先頭から pos までの行番号 (1 始まり)
int line_at(const std::string & text, size_t pos)
{
  return 1 + static_cast<int>(std::count(text.begin(), text.begin() + static_cast<long>(pos), '\n'));
}

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

// CMakeLists.txt に登録された実行ファイル
struct Executable
{
  std::string name;
  std::vector<std::string> sources;  // パッケージから見た相対パス
  int line = 0;
};

std::vector<Executable> executables(const std::string & cmake)
{
  // コメントを空白に置き換えてから探す (行番号がずれないように長さは保つ)
  std::string text = cmake;
  for (size_t i = 0; i < text.size(); ++i) {
    if (text[i] == '#') {
      while (i < text.size() && text[i] != '\n') {text[i++] = ' ';}
    }
  }
  std::vector<Executable> out;
  static const std::regex re(R"((ament_auto_add_executable|add_executable)\s*\(([^)]*)\))");
  for (auto it = std::sregex_iterator(text.begin(), text.end(), re); it != std::sregex_iterator(); ++it) {
    std::istringstream args((*it)[2].str());
    Executable e;
    e.line = line_at(text, it->position(0));
    args >> e.name;
    std::string a;
    while (args >> a) {
      if (a.find('.') != std::string::npos && a.find('$') == std::string::npos) {e.sources.push_back(a);}
    }
    out.push_back(e);
  }
  return out;
}

std::string tilde(const std::string & path, const std::string & home)
{
  return path.rfind(home + "/", 0) == 0 ? "~" + path.substr(home.size()) : path;
}

}  // namespace

Doctor::Doctor(std::string ws, std::string pkg, std::string home, std::string domain_id, std::vector<std::string> prefixes)
: ws_(std::move(ws)), pkg_(std::move(pkg)), home_(std::move(home)), domain_id_(std::move(domain_id)),
  prefixes_(std::move(prefixes))
{
}

DoctorReport Doctor::scan() const
{
  DoctorReport r;
  check_places(r);
  check_install(r);
  check_bashrc(r);
  check_package(r);
  check_build_log(r);
  check_processes(r);
  // 直したあとビルドしていない実行ファイルが動いているなら, 動いているのは前のコード
  for (auto & f : r.findings) {
    if (f.id != "stale") {continue;}
    const std::string name = f.title.args.front().second.text;  // doctor.stale.title の exe
    if (r.facts.count("run:" + name)) {
      f.level = "warn";
      f.title = {"doctor.stale_running.title", {{"exe", name}}};
      f.detail = {"doctor.stale_running.detail", {{"file", f.file.substr(f.file.rfind('/') + 1)}}};
    }
  }
  return r;
}

bool Doctor::is_ros_package(const std::string & name) const
{
  for (const auto & p : prefixes_) {
    if (has_file(fs::path(p) / "share" / name / "package.xml")) {return true;}
  }
  return false;
}

// ---- 作る場所の間違い ----
void Doctor::check_places(DoctorReport & r) const
{
  const fs::path ws(ws_), src = ws / "src", pkg = src / pkg_;
  const std::string ws_t = tilde(ws_, home_);
  if (has_file(src)) {r.facts.insert("src");}
  if (has_file(pkg / "package.xml")) {r.facts.insert("pkg");}

  // ワークスペースの名前の打ち間違い (src を持つ似た名前のディレクトリがある)
  if (!has_file(src)) {
    std::error_code ec;
    for (const auto & d : fs::directory_iterator(ws.parent_path(), ec)) {
      const std::string n = d.path().filename().string();
      if (d.is_directory() && n != ws.filename().string() && distance(n, ws.filename().string()) <= 2 && has_file(d.path() / "src")) {
        r.findings.push_back({"ws_typo", "warn", {"doctor.ws_typo.title"},
            {"doctor.ws_typo.detail", {{"found", tilde(d.path().string(), home_)}, {"ws", ws_t}}},
            "mv " + tilde(d.path().string(), home_) + " " + ws_t, "", 0});
      }
    }
  }
  // colcon build をワークスペースの直下以外で実行した (その場に build/ install/ log/ ができる)
  for (const fs::path & place : {src, pkg, fs::path(home_)}) {
    if (has_file(place / "build" / "COLCON_IGNORE") || has_file(place / "install" / "setup.bash")) {
      const std::string p = tilde(place.string(), home_);
      r.findings.push_back({"build_place", "error", {"doctor.build_place.title"},
          {"doctor.build_place.detail", {{"place", p}, {"ws", ws_t}}},
          "rm -rf " + p + "/build " + p + "/install " + p + "/log && cd " + ws_t, "", 0});
    }
  }
  // ros2 pkg create を src の外で実行した. colcon は実行した場所の下を探すので, 置いた場所で結果が変わる
  for (const fs::path & place : {ws, fs::path(home_), pkg}) {
    if (!has_file(place / pkg_ / "package.xml")) {continue;}
    const std::string p = tilde((place / pkg_).string(), home_);
    Finding f{"pkg_place", "error", {"doctor.pkg_place_home.title"},
      {"doctor.pkg_place_home.detail", {{"path", p}, {"ws", ws_t}}}, "mv " + p + " " + ws_t + "/src/",
      (place / pkg_ / "package.xml").string(), 0};
    if (place == ws) {
      f.level = "warn";
      f.title = {"doctor.pkg_place_ws.title"};
      f.detail = {"doctor.pkg_place_ws.detail", {{"path", p}}};
    } else if (place == pkg) {
      f.title = {"doctor.pkg_place_nested.title"};
      f.detail = {"doctor.pkg_place_nested.detail", {{"path", p}, {"pkg", pkg_}}};
      f.fix = "rm -r " + p;
    }
    r.findings.push_back(f);
  }
}

// ---- colcon build のオプション ----
void Doctor::check_install(DoctorReport & r) const
{
  const fs::path ws(ws_), share_xml = ws / "install" / "share" / pkg_ / "package.xml";
  const std::string ws_t = tilde(ws_, home_);
  const std::string layout = read_file(ws / "install" / ".colcon_install_layout");
  if (layout.rfind("isolated", 0) == 0) {
    r.findings.push_back({"isolated", "error", {"doctor.isolated.title"}, {"doctor.isolated.detail"},
        "cd " + ws_t + " && rm -rf build install log && colcon build --symlink-install --merge-install --packages-select " + pkg_,
        "", 0});
  }
  if (has_file(share_xml)) {
    r.facts.insert("built");
    if (layout.rfind("merged", 0) == 0) {r.facts.insert("merged");}
    std::error_code ec;
    if (fs::is_symlink(share_xml, ec)) {
      r.facts.insert("symlink");
    } else {
      r.findings.push_back({"no_symlink", "warn", {"doctor.no_symlink.title"}, {"doctor.no_symlink.detail"},
          "cd " + ws_t + " && colcon build --symlink-install --merge-install --packages-select " + pkg_, "", 0});
    }
  }
}

// ---- ~/.bashrc の source ----
void Doctor::check_bashrc(DoctorReport & r) const
{
  const fs::path rc = fs::path(home_) / ".bashrc";
  const auto lines = lines_of(read_file(rc));
  const std::string want = (fs::path(ws_) / "install" / "setup.bash").string();
  static const std::regex src_re(R"(^\s*(source|\.)\s+(\S+setup\.(bash|sh)))");
  int found = 0;
  for (size_t i = 0; i < lines.size(); ++i) {
    std::smatch m;
    if (!std::regex_search(lines[i], m, src_re)) {continue;}
    std::string p = m[2];
    if (p.rfind("~/", 0) == 0) {p = home_ + p.substr(1);}
    if (p.rfind("$HOME/", 0) == 0) {p = home_ + p.substr(5);}
    if (p.rfind("${HOME}/", 0) == 0) {p = home_ + p.substr(7);}
    const int line = static_cast<int>(i + 1);
    if (p.front() != '/') {
      r.findings.push_back({"bashrc_relative", "warn", {"doctor.bashrc_relative.title"},
          {"doctor.bashrc_relative.detail", {{"path", m[2].str()}}},
          "source " + tilde(want, home_), rc.string(), line});
      continue;
    }
    if (p == want) {
      if (++found == 2) {
        r.findings.push_back({"bashrc_dup", "warn", {"doctor.bashrc_dup.title"}, {"doctor.bashrc_dup.detail"}, "",
            rc.string(), line});
      }
      if (!has_file(p)) {
        r.findings.push_back({"bashrc_unbuilt", "info", {"doctor.bashrc_unbuilt.title"},
            {"doctor.bashrc_unbuilt.detail", {{"path", tilde(p, home_)}}}, "", rc.string(), line});
      }
    } else if (!has_file(p)) {
      r.findings.push_back({"bashrc_missing", "error", {"doctor.bashrc_missing.title"},
          {"doctor.bashrc_missing.detail", {{"path", tilde(p, home_)}}},
          "source " + tilde(want, home_), rc.string(), line});
    }
  }
  if (found > 0 && has_file(want)) {r.facts.insert("bashrc");}
}

// ---- package.xml と CMakeLists.txt ----
void Doctor::check_package(DoctorReport & r) const
{
  const fs::path pkg = fs::path(ws_) / "src" / pkg_;
  if (!has_file(pkg / "package.xml")) {return;}
  const std::string xml = read_file(pkg / "package.xml"), cmake = read_file(pkg / "CMakeLists.txt");
  // package.xml の依存 (build に効くもの)
  std::set<std::string> depends;
  static const std::regex dep_re(R"(<(depend|build_depend|buildtool_depend)>\s*([\w]+)\s*</)");
  for (auto it = std::sregex_iterator(xml.begin(), xml.end(), dep_re); it != std::sregex_iterator(); ++it) {
    depends.insert((*it)[2]);
  }
  for (const auto & d : depends) {r.facts.insert("xml:" + d);}
  const bool uses_auto = cmake.find("ament_auto_") != std::string::npos;
  if (uses_auto && !depends.count("ament_cmake_auto")) {
    const size_t at = xml.find("<buildtool_depend>");
    r.findings.push_back({"auto_xml", "error", {"doctor.auto_xml.title"}, {"doctor.auto_xml.detail"},
        "<buildtool_depend>ament_cmake_auto</buildtool_depend>", (pkg / "package.xml").string(),
        at == std::string::npos ? 0 : line_at(xml, at)});
  }
  if (uses_auto && depends.count("ament_cmake_auto") && depends.count("rclcpp")) {r.facts.insert("auto");}

  // CMakeLists.txt に書いたファイルがあるか
  const auto exes = executables(cmake);
  std::set<std::string> listed;
  for (const auto & e : exes) {
    r.facts.insert("exe:" + e.name);
    for (const auto & s : e.sources) {
      listed.insert(fs::path(s).lexically_normal().string());
      if (!has_file(pkg / s)) {
        r.findings.push_back({"cmake_file", "error", {"doctor.cmake_file.title"},
            {"doctor.cmake_file.detail", {{"exe", e.name}, {"src", s}}}, "",
            (pkg / "CMakeLists.txt").string(), e.line});
      }
    }
  }
  // src/ にある .cpp のうち, CMakeLists.txt に書いていないもの (ビルドされない)
  std::error_code ec;
  std::vector<fs::path> sources;
  if (has_file(pkg / "src")) {
    for (const auto & f : fs::recursive_directory_iterator(pkg / "src", ec)) {
      if (f.path().extension() == ".cpp") {sources.push_back(f.path());}
    }
  }
  for (const auto & f : sources) {
    const std::string rel = fs::relative(f, pkg).lexically_normal().string();
    const std::string body = read_file(f);
    r.facts.insert("cpp:" + f.stem().string());
    if (body.find("rclcpp::init") != std::string::npos && body.find("rclcpp::spin") != std::string::npos) {
      r.facts.insert("main:" + f.stem().string());
    }
    if (!listed.count(rel)) {
      const std::string name = f.stem().string();
      r.findings.push_back({"not_built", "warn", {"doctor.not_built.title", {{"file", rel}}}, {"doctor.not_built.detail"},
          "ament_auto_add_executable(" + name + " " + rel + ")", f.string(), 1});
    }
  }
  // include したパッケージが package.xml にあるか
  static const std::regex inc_re(R"(^\s*#\s*include\s*[<"]([a-z][a-z0-9_]*)/)");
  for (const auto & f : sources) {
    const auto lines = lines_of(read_file(f));
    std::set<std::string> reported;
    for (size_t i = 0; i < lines.size(); ++i) {
      std::smatch m;
      if (!std::regex_search(lines[i], m, inc_re)) {continue;}
      const std::string dep = m[1];
      if (dep == pkg_ || depends.count(dep) || reported.count(dep) || !is_ros_package(dep)) {continue;}
      reported.insert(dep);
      r.findings.push_back({"no_depend", "error", {"doctor.no_depend.title", {{"dep", dep}}},
          {"doctor.no_depend.detail", {{"dep", dep}}},
          "<depend>" + dep + "</depend>", f.string(), static_cast<int>(i + 1)});
    }
  }
  // ソースを直したあとビルドしていない実行ファイル
  for (const auto & e : exes) {
    const fs::path bin = fs::path(ws_) / "install" / "lib" / pkg_ / e.name;
    const long long built = mtime(bin);
    if (!built) {continue;}
    r.facts.insert("bin:" + e.name);
    for (const auto & s : e.sources) {
      if (mtime(pkg / s) > built) {
        r.facts.insert("stale:" + e.name);
        r.findings.push_back({"stale", "info", {"doctor.stale.title", {{"exe", e.name}}},
            {"doctor.stale.detail", {{"src", s}}},
            "cd " + tilde(ws_, home_) + " && colcon build --symlink-install --merge-install --packages-select " + pkg_,
            (pkg / s).string(), 0});
        break;
      }
    }
  }
}

// ---- 最後のビルドの失敗 ----
void Doctor::check_build_log(DoctorReport & r) const
{
  const fs::path log = fs::path(ws_) / "log" / "latest_build";
  const std::string events = read_file(log / "events.log");
  std::smatch m;
  const std::regex rc_re("JobEnded: \\{'identifier': '" + pkg_ + "', 'rc': (\\d+)\\}");
  if (!std::regex_search(events, m, rc_re) || m[1] == "0") {return;}
  const std::string pkg_dir = (fs::path(ws_) / "src" / pkg_).string();
  std::set<std::string> depends;
  {
    const std::string xml = read_file(fs::path(pkg_dir) / "package.xml");
    static const std::regex dep_re(R"(<(depend|build_depend)>\s*([\w]+)\s*</)");
    for (auto it = std::sregex_iterator(xml.begin(), xml.end(), dep_re); it != std::sregex_iterator(); ++it) {
      depends.insert((*it)[2]);
    }
  }
  // コンパイラ (file:line:col: error: ...) か CMake (CMake Error at file:line) の最初のエラー
  static const std::regex gcc_re(R"(^(/[^:]+):(\d+):\d+: (?:fatal )?error: (.*)$)");
  static const std::regex cmake_re(R"(^CMake Error at (\S+):(\d+))");
  static const std::regex link_re(R"(undefined reference to [`'](.*)')");
  const auto lines = lines_of(read_file(log / pkg_ / "stderr.log"));
  for (size_t i = 0; i < lines.size(); ++i) {
    std::smatch g;
    Finding f{"build_error", "error", {}, {}, "", "", 0};
    std::string first;  // 最初のエラーの文 (コンパイラや CMake が出したまま)
    if (std::regex_search(lines[i], g, gcc_re)) {
      f.file = g[1];
      f.line = std::stoi(g[2]);
      first = g[3].str();
    } else if (std::regex_search(lines[i], g, cmake_re)) {
      f.file = (fs::path(pkg_dir) / g[1].str()).string();
      f.line = std::stoi(g[2]);
      first = i + 1 < lines.size() ? lines[i + 1] : "";
      for (size_t k = i + 1; k < std::min(lines.size(), i + 4); ++k) {
        if (lines[k].find("Cannot find source file") != std::string::npos ||
          lines[k].find("Could not find a package") != std::string::npos)
        {
          first = lines[k] + (k + 1 < lines.size() ? " " + lines[k + 1] : "");
        }
      }
    } else if (std::regex_search(lines[i], g, link_re)) {
      first = lines[i];
    } else {
      continue;
    }
    std::string dep;
    const std::string why = explain_build_error(first, depends, dep);
    if (why.empty()) {
      f.title = {"doctor.build_error.title"};
      f.detail = {"doctor.build_error.detail", {{"first", first}}};
    } else {
      f.title = {"doctor.build_error_why.title", {{"why", Msg{"build_why." + why + ".title", {{"dep", dep}}}}}};
      f.detail = {"doctor.build_error_why.detail",
        {{"first", first}, {"full", Msg{"build_why." + why + ".full", {{"dep", dep}}}}}};
    }
    r.findings.push_back(f);
    return;
  }
  r.findings.push_back({"build_error", "error", {"doctor.build_error_noline.title"},
      {"doctor.build_error_noline.detail", {{"log", tilde((log / pkg_ / "stderr.log").string(), home_)}}}, "", "", 0});
}

std::string explain_build_error(const std::string & msg, const std::set<std::string> & depends, std::string & dep)
{
  // gcc の文は英語のまま (gcc の訳は標準で入っていない). OS が出す部分だけ日本語になり, 引用符は ' か ‘’ になる.
  // 返すのは原因の種類 (訳の表の build_why.<種類>). 分からなければ空
  auto has = [&](const char * a) {return msg.find(a) != std::string::npos;};
  std::smatch m;
  static const std::regex nofile(
    R"(([a-z][a-z0-9_]*)/[^:]*: (No such file or directory|そのようなファイルやディレクトリはありません))");
  if (std::regex_search(msg, m, nofile)) {
    dep = m[1];
    return depends.count(dep) ? "header_name" : "no_depend";
  }
  static const std::regex semicolon(R"(expected (';'|‘;’))");
  if (std::regex_search(msg, semicolon)) {return "semicolon";}
  if (has("was not declared in this scope")) {return "undeclared";}
  if (has("has no member named")) {return "no_member";}
  if (has("no matching function for call")) {return "no_match";}
  if (has("undefined reference")) {return "undefined_ref";}
  if (has("Cannot find source file")) {return "no_source";}
  if (has("Could not find a package configuration file")) {return "no_package";}
  return "";
}

// ---- 動いているプロセス ----
void Doctor::check_processes(DoctorReport & r) const
{
  const std::string build = (fs::path(ws_) / "build" / pkg_).string() + "/";
  const std::string install = (fs::path(ws_) / "install" / "lib" / pkg_).string() + "/";
  // 起動時刻を求めるための値 (/proc/stat の btime と 1 秒あたりの tick 数)
  long long btime = 0;
  for (const auto & l : lines_of(read_file("/proc/stat"))) {
    if (l.rfind("btime ", 0) == 0) {btime = std::stoll(l.substr(6));}
  }
  const long ticks = sysconf(_SC_CLK_TCK);
  std::error_code ec;
  for (const auto & d : fs::directory_iterator("/proc", ec)) {
    const std::string pid = d.path().filename().string();
    if (pid.empty() || !std::all_of(pid.begin(), pid.end(), ::isdigit)) {continue;}
    std::error_code e2;
    std::string exe = fs::read_symlink(d.path() / "exe", e2).string();
    if (e2) {continue;}
    // ビルドし直すとリンカーが実行ファイルを作り直すので, 前から動いているプロセスの exe は "... (deleted)" になる
    const std::string deleted_mark = " (deleted)";
    const bool deleted = exe.size() > deleted_mark.size() &&
      exe.compare(exe.size() - deleted_mark.size(), deleted_mark.size(), deleted_mark) == 0;
    if (deleted) {exe.resize(exe.size() - deleted_mark.size());}
    std::string name;
    if (exe.rfind(build, 0) == 0) {name = exe.substr(build.size());} else if (exe.rfind(install, 0) == 0) {
      name = exe.substr(install.size());
    } else {
      continue;
    }
    // 環境変数 (NUL 区切り)
    std::map<std::string, std::string> env;
    const std::string raw = read_file(d.path() / "environ");
    for (size_t p = 0; p < raw.size(); ) {
      const size_t end = raw.find('\0', p);
      const std::string kv = raw.substr(p, end - p);
      const size_t eq = kv.find('=');
      if (eq != std::string::npos) {env[kv.substr(0, eq)] = kv.substr(eq + 1);}
      p = end == std::string::npos ? raw.size() : end + 1;
    }
    const std::string dom = env.count("ROS_DOMAIN_ID") && !env["ROS_DOMAIN_ID"].empty() ? env["ROS_DOMAIN_ID"] : "0";
    if (dom != domain_id_) {
      r.findings.push_back({"domain", "error", {"doctor.domain.title", {{"exe", name}}},
          {"doctor.domain.detail", {{"exe", name}, {"pid", pid}, {"dom", dom}, {"farm", domain_id_}}},
          "export ROS_DOMAIN_ID=" + domain_id_, "", 0});
      continue;
    }
    r.facts.insert("run:" + name);
    // ビルドし直したのに, 前に起動したプロセスが動いたまま (exe が消えたか, 起動より実行ファイルが新しい)
    std::string stat = read_file(d.path() / "stat");
    const size_t rp = stat.rfind(')');
    if (rp == std::string::npos || !btime || ticks <= 0) {continue;}
    std::istringstream rest(stat.substr(rp + 2));
    std::string tok;
    long long start_ticks = 0;
    for (int i = 3; i <= 22 && rest >> tok; ++i) {
      if (i == 22) {start_ticks = std::stoll(tok);}
    }
    const long long started_ns = (btime * 1000000000LL) + start_ticks * (1000000000LL / ticks);
    if (deleted || mtime(install + name) > started_ns + 1000000000LL) {
      r.findings.push_back({"old_process", "warn", {"doctor.old_process.title", {{"exe", name}}},
          {"doctor.old_process.detail", {{"exe", name}, {"pid", pid}}}, "ros2 run " + pkg_ + " " + name, "", 0});
    }
  }
}

}  // namespace publish_or_perish

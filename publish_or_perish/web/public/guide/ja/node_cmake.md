# CMakeLists.txt に登録する

## やること

`~/src26_ws/src/tutorial_nodes/CMakeLists.txt` の中身を**すべて消して**、次の内容にして保存する。

```cmake
cmake_minimum_required(VERSION 3.8)
project(tutorial_nodes)

find_package(ament_cmake_auto REQUIRED)
ament_auto_find_build_dependencies()

ament_auto_add_executable(hello_node src/hello_node.cpp)

ament_auto_package()
```

## CMakeLists.txt とは

どのファイルをどうビルドするかを書くファイル。`.cpp` を置いただけでは、colcon はそれをビルドしない。ここに書いたものだけが実行ファイルになる。

| 行 | 意味 |
|---|---|
| `project(tutorial_nodes)` | パッケージの名前。package.xml の `<name>` と同じにする |
| `find_package(ament_cmake_auto REQUIRED)` | ament_cmake_auto を使う準備 |
| `ament_auto_find_build_dependencies()` | package.xml の `<depend>` に書いたパッケージ (今は rclcpp) を全部読み込む |
| `ament_auto_add_executable(hello_node src/hello_node.cpp)` | `src/hello_node.cpp` から `hello_node` という実行ファイルを作る。この名前を `ros2 run` で使う |
| `ament_auto_package()` | ビルドしたものを install/ に置く設定をまとめてする |

ノードを増やすときは `ament_auto_add_executable` の行を 1 行ずつ足す。

```cmake
ament_auto_add_executable(hello_node src/hello_node.cpp)
ament_auto_add_executable(patrol_node src/patrol_node.cpp)
```

## うまくいかないとき

- **ファイル名の打ち間違い:** `src/hello_node.cpp` が実際のファイル名と違うと、点検の欄に「CMakeLists.txt に書いたファイルがない」と出る。
- **package.xml がまだ ament_cmake:** 前の課題の書き換えを忘れていると、点検の欄に「package.xml に ament_cmake_auto がない」と出る。
- **古い行が残っている:** `ros2 pkg create` が書いた `find_package(ament_cmake REQUIRED)` や `ament_package()` が残っていると、`ament_auto_package()` と二重になり、ビルドが `ament_environment_hooks.cmake` の `CMake Error` で止まる。中身はすべて消してから書く。

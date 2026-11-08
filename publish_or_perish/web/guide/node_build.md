# hello_node をビルドする

## やること

ワークスペースの直下に移動してビルドする。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
```

最後に `Summary: 1 package finished` と出て、`~/src26_ws/install/lib/tutorial_nodes/hello_node` ができればクリア。

## コマンドの意味

| 部分 | 意味 |
|---|---|
| `cd ~/src26_ws` | ワークスペースの直下 (`src` と同じ階層) で実行する。ここに `build/` `install/` `log/` ができる |
| `--symlink-install` | launch ファイルなどをコピーせずリンクで置く。書き換えたときにビルドし直さなくてよい |
| `--merge-install` | 全パッケージを 1 つの `install/` にまとめる。毎回付ける (付けたり付けなかったりすると install/ が壊れる) |
| `--packages-select tutorial_nodes` | このパッケージだけをビルドする |

`.cpp` を書き換えたら、そのたびにビルドし直す。ビルドしないと、実行されるのは前のコードのまま。

## うまくいかないとき

ビルドに失敗すると、点検の欄にエラーの最初の 1 つと、その意味が出る。よくあるもの:

| エラーの一部 | 原因 |
|---|---|
| `fatal error: rclcpp/rclcpp.hpp` (そのようなファイルはない) | package.xml に `<depend>rclcpp</depend>` がない |
| `expected ';' before '}' token` | `;` の書き忘れ。エラーに出ている行番号 (`hello_node.cpp:18:11` なら 18 行目) の 1 行前を見る |
| `Cannot find source file: src/hello_node.cpp` | CMakeLists.txt のファイル名とファイルの場所が違う |
| `Unknown CMake command "ament_auto_find_build_dependencies"` | `find_package(ament_cmake_auto REQUIRED)` がない |
| `ament_environment_hooks.cmake` の `CMake Error` | CMakeLists.txt に `ros2 pkg create` が書いた `ament_package()` が残っている |
| エラーは出ないが `Summary: 0 packages finished` | package.xml の `<build_type>` を変えてしまった。`ament_cmake` に戻す |

ターミナルの出力が長いときは、`log/latest_build/tutorial_nodes/stderr.log` に同じエラーが残っている。

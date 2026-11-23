# package.xml を書き換える

## やること

`~/src26_ws/src/tutorial_nodes/package.xml` を開き、`<buildtool_depend>` の行を次の 3 行に置き換えて保存する。

変える前:

```xml
  <buildtool_depend>ament_cmake</buildtool_depend>
```

変えた後:

```xml
  <buildtool_depend>ament_cmake_auto</buildtool_depend>

  <depend>rclcpp</depend>
```

ファイル全体は次の形になる (`<maintainer>` と `<license>` は人によって違う)。

```xml
<?xml version="1.0"?>
<?xml-model href="http://download.ros.org/schema/package_format3.xsd" schematypens="http://www.w3.org/2001/XMLSchema"?>
<package format="3">
  <name>tutorial_nodes</name>
  <version>0.0.0</version>
  <description>TODO: Package description</description>
  <maintainer email="you@example.com">you</maintainer>
  <license>TODO: License declaration</license>

  <buildtool_depend>ament_cmake_auto</buildtool_depend>

  <depend>rclcpp</depend>

  <test_depend>ament_lint_auto</test_depend>
  <test_depend>ament_lint_common</test_depend>

  <export>
    <build_type>ament_cmake</build_type>
  </export>
</package>
```

## package.xml とは

パッケージの名前と、ビルドや実行に要るものの一覧を書くファイル。colcon と rosdep がこれを読む。

| タグ | 意味 |
|---|---|
| `<buildtool_depend>` | ビルドに使う道具。`ament_cmake_auto` にすると、CMakeLists.txt を短く書ける (次の課題) |
| `<depend>` | このパッケージが使うパッケージ。hello_node は rclcpp を include しているので書く |
| `<build_type>` | colcon がこのパッケージを何でビルドするか。**ここは `ament_cmake` のまま変えない** |

## うまくいかないとき

- `<build_type>` まで `ament_cmake_auto` に変えると、colcon はこのパッケージを見つけられなくなる。エラーは出ず、`Summary: 0 packages finished` で終わる (何もビルドされない)。
- タグの閉じ忘れ (`</depend>` の `/` 抜け) があると、ビルドの最初に `mismatched tag: line 20` のように、読めなかった行が出る。
- コードで `#include <std_msgs/...>` のように別のパッケージを使うときは、そのたびに `<depend>std_msgs</depend>` を足す。足し忘れは点検の欄に出る。

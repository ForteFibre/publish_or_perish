# hello_node.cpp を書く

## やること

次のファイルを作り、下のコードをそのまま書いて保存する。

`~/src26_ws/src/tutorial_nodes/src/hello_node.cpp`

```cpp
#include <rclcpp/rclcpp.hpp>

class HelloNode : public rclcpp::Node
{
public:
  HelloNode() : Node("hello_node")
  {
    RCLCPP_INFO(get_logger(), "Hello World!");
  }
};

int main(int argc, char * argv[])
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<HelloNode>();
  rclcpp::spin(node);
  rclcpp::shutdown();
  return 0;
}
```

保存すると農場がファイルを読み、`rclcpp::init` と `rclcpp::spin` があればクリアになる。ビルドはまだしない (次の 2 つの課題で設定を書いてからする)。

## ノードとは

ROS 2 で動くプログラムの単位をノードと呼ぶ。1 つの機能を 1 つのノードにする。ノード同士は topic と service でやりとりする。ステージ 1 で `ros2 topic pub` から送った `/bot1/cmd_vel` も topic で、農場 (`/farm` ノード) が受け取っている。

## コードの中身

| 部分 | 意味 |
|---|---|
| `#include <rclcpp/rclcpp.hpp>` | C++ で ROS 2 を使うためのライブラリ rclcpp を読み込む |
| `class HelloNode : public rclcpp::Node` | ノードは `rclcpp::Node` を継承したクラスとして書く |
| `Node("hello_node")` | ノードの名前。`ros2 node list` にこの名前で出る。小文字と `_` で書く (snake_case) |
| `RCLCPP_INFO(get_logger(), ...)` | ターミナルに `[INFO]` 付きで 1 行出す。`printf` と違い、時刻とノード名が付く |
| `rclcpp::init(argc, argv)` | ROS 2 を使い始める。コマンドラインの引数を ROS 2 に渡す |
| `std::make_shared<HelloNode>()` | ノードを作る。ここでコンストラクタが動き、Hello World! が出る |
| `rclcpp::spin(node)` | ノードを動かし続ける。topic の受信やタイマーはここで処理される。Ctrl+C を押すまで戻らない |
| `rclcpp::shutdown()` | ROS 2 を終わる |

## うまくいかないとき

- **置き場所:** `src26_ws/src/` の直下ではなく、パッケージの中の `src/` (`src26_ws/src/tutorial_nodes/src/`) に置く。`ros2 pkg create` がこのディレクトリを作っている。
- **拡張子:** `.cpp` にする。`hello_node.cpp.txt` のようになっていないか、`ls` で確かめる。
- **保存:** エディタのタブに ● が付いていたらまだ保存していない。

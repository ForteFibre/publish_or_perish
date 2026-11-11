# C++ のノードから動かす

## やること

ステージ 1 では `ros2 topic pub` で `/bot1/cmd_vel` に速度を送った。同じことを、自分で書くノード `move_node` からする。bot1 が 3 m 進めばクリア。

この課題で初めて使うものが 3 つある。下の「説明」を順に読んでから書く。

1. クラスのメンバ変数とメンバ関数
2. タイマー (決まった間隔で関数を呼ぶ)
3. Publisher (topic にメッセージを送る)

## 説明

### topic と Publisher・Subscriber

ノード同士は topic でメッセージをやりとりする。topic にメッセージを送る側を **Publisher**、受け取る側を **Subscriber** と呼ぶ。1 つの topic に、Publisher も Subscriber もいくつでもつなげられる。

ステージ 1 の `ros2 topic pub /bot1/cmd_vel ...` は、コマンドの中に Publisher を作って速度を送っていた。それを受け取っていたのは、農場のノード `/farm` の中の Subscriber。`ros2 topic echo` も Subscriber。

この課題では、自分のノードの中に Publisher を作る。

### クラスのメンバ

C++ のクラスは、C の構造体に関数も入れられるようにしたもの。次の `Counter` は、数を 1 つ持ち、呼ぶたびに 1 増やす。

```cpp
class Counter
{
public:
  Counter()      // コンストラクタ
  {
    count_ = 0;
  }

  void step()    // メンバ関数
  {
    count_ = count_ + 1;
  }

private:
  int count_;    // メンバ変数
};
```

| 部分 | 意味 |
|---|---|
| メンバ変数 `count_` | 構造体のメンバと同じ。`Counter` が消えるまで値が残る |
| メンバ関数 `step()` | クラスの中の関数。メンバ変数をそのまま使える |
| コンストラクタ `Counter()` | クラスと同じ名前の関数。`Counter` が作られたときに 1 回だけ呼ばれる。hello_node では `std::make_shared<HelloNode>()` のところで呼ばれていた |
| `public:` / `private:` | `public:` の下は外から使える。`private:` の下はクラスの中からしか使えない |

- 名前の最後の `_` は、メンバ変数をローカル変数と見分けるために付ける (付けなくても動く)。
- hello_node の `class HelloNode : public rclcpp::Node` は、`rclcpp::Node` が持っている関数を `HelloNode` の中でも使えるようにする書き方 (継承)。`get_logger()` も、このあと使う `create_wall_timer()` と `create_publisher()` も、`rclcpp::Node` の関数。

コンストラクタの中で作ったローカル変数は、C の関数のローカル変数と同じで、コンストラクタが終わると消える。タイマーと Publisher はノードが動いている間ずっと使うので、メンバ変数にしまう。

### タイマー

0.5 秒ごとに「1 回目」「2 回目」…と表示するノードの例。

```cpp
#include <chrono>
#include <rclcpp/rclcpp.hpp>

using namespace std::chrono_literals;

class TickNode : public rclcpp::Node
{
public:
  TickNode() : Node("tick_node")
  {
    timer_ = create_wall_timer(500ms, [this] {on_timer();});
  }

private:
  void on_timer()
  {
    count_ = count_ + 1;
    RCLCPP_INFO(get_logger(), "%d 回目", count_);
  }

  rclcpp::TimerBase::SharedPtr timer_;
  int count_ = 0;
};
```

| 部分 | 意味 |
|---|---|
| `#include <chrono>` と `using namespace std::chrono_literals;` | `500ms` や `1s` のように、単位を付けて時間を書けるようにする |
| `create_wall_timer(500ms, 関数)` | 500 ms ごとに関数を呼ぶタイマーを作る |
| `[this] {on_timer();}` | 「`on_timer()` を呼ぶ」という関数を、その場で書いたもの (ラムダ式)。`[this]` は、中でこのクラスのメンバを使うために書く |
| `rclcpp::TimerBase::SharedPtr` | タイマーを指すポインタの型。`SharedPtr` は、使う人がいなくなると指す先を自動で消すポインタ |

- タイマーの関数が呼ばれるのは `rclcpp::spin(node)` の中。spin がないと 1 回も呼ばれない。
- `timer_` をメンバ変数にせず `auto timer = create_wall_timer(...)` と書くと、コンストラクタが終わったところでタイマーが消え、1 回も呼ばれない。ビルドのエラーにはならない。
- マイコンで書く `while (1) { ...; delay(500); }` の形は使わない。待っている間は spin が回らず、メッセージの受信も他のタイマーも止まる。

`main` は hello_node と同じで、`HelloNode` を `TickNode` に変える。

### Publisher

1 秒ごとに `/chatter` へ文字列 `hello` を送るノードの例。

```cpp
#include <chrono>
#include <rclcpp/rclcpp.hpp>
#include <std_msgs/msg/string.hpp>

using namespace std::chrono_literals;

class TalkerNode : public rclcpp::Node
{
public:
  TalkerNode() : Node("talker_node")
  {
    pub_ = create_publisher<std_msgs::msg::String>("/chatter", 10);
    timer_ = create_wall_timer(1s, [this] {on_timer();});
  }

private:
  void on_timer()
  {
    std_msgs::msg::String msg;
    msg.data = "hello";
    pub_->publish(msg);
  }

  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};
```

| 部分 | 意味 |
|---|---|
| `#include <std_msgs/msg/string.hpp>` | 送るメッセージの型ごとに include する |
| `create_publisher<std_msgs::msg::String>("/chatter", 10)` | `/chatter` に `String` を送る Publisher を作る。`10` は、送りきれないときに溜めておく数 |
| `std_msgs::msg::String msg;` `msg.data = "hello";` | メッセージは構造体。変数を作ってから中身を入れる |
| `pub_->publish(msg)` | 送る。`->` は C と同じで、ポインタが指す先のメンバを使う書き方 |
| `rclcpp::Publisher<std_msgs::msg::String>::SharedPtr` | Publisher を指すポインタの型 |

型の名前とファイル名は、コマンドで書く型名から決まる。

| コマンドでの型名 | C++ の型名 | include するファイル |
|---|---|---|
| `std_msgs/msg/String` | `std_msgs::msg::String` | `std_msgs/msg/string.hpp` |
| `geometry_msgs/msg/Twist` | `geometry_msgs::msg::Twist` | `geometry_msgs/msg/twist.hpp` |

型のパッケージ (`std_msgs` や `geometry_msgs`) は、package.xml に `<depend>` で書く。

この例を動かすと、別のターミナルの `ros2 topic echo /chatter` に `data: hello` が 1 秒ごとに出る。

## この課題で書くもの

- `ros2 topic pub` を動かしているターミナルがあれば Ctrl+C で止める (農場は、誰が送った速度かを見ている)。
- 書くのは `~/src26_ws/src/tutorial_nodes/src/move_node.cpp`。
- `geometry_msgs` を使うので、package.xml の `<depend>rclcpp</depend>` の下に 1 行足す。

```xml
  <depend>geometry_msgs</depend>
```

- CMakeLists.txt の `ament_auto_add_executable(hello_node ...)` の下に 1 行足す。

```cmake
ament_auto_add_executable(move_node src/move_node.cpp)
```

- ビルドして起動する。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes move_node
```

送るのは、`/bot1/cmd_vel` に `geometry_msgs/msg/Twist`。

| 書き方 | 意味 |
|---|---|
| `geometry_msgs::msg::Twist cmd;` `cmd.linear.x = 0.5;` | 前へ 0.5 m/s。何も入れなかった値は 0 |
| `cmd.linear.y` | 左へ [m/s] |
| `cmd.angular.z` | 左回り [rad/s] |

向きはロボットから見た向き。

速度は 1 回送るだけでは足りない。農場のロボットは、最後に速度を受け取ってから 0.5 秒たつと止まる (実機と同じ安全のしくみ)。そのため、0.5 秒より短い間隔で送り続ける。

## ヒント

<details><summary>ヒント 1: どこから書き始めるか</summary>

上の `TalkerNode` を写して始める。変えるところは、クラス名とノード名、メッセージの型 (include も)、topic 名、メッセージの中身、タイマーの間隔。

</details>

<details><summary>ヒント 2: タイマーの間隔</summary>

`1s` のままだと、送ってから 0.5 秒で止まり、次に送るまでの 0.5 秒は止まったままになる。`100ms` にすると止まらずに進む。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **進まない:** `ros2 topic pub` がまだ動いていると、どちらの速度が使われるか決まらない。右上の「運転」が「CLI で操作中」なら止める。
- **エラーは出ないのに進まない:** `pub_` や `timer_` をコンストラクタの中の変数 (`auto timer = ...`) にすると、コンストラクタが終わったところで消えて、何も送られない。メンバ変数にする。
- **途中で止まった:** 畑の端の柵に当たっている。`linear.x` をマイナスにして逆へ進ませる (ビルドし直して起動し直す)。
- **ビルドで `geometry_msgs/msg/twist.hpp` が見つからない:** package.xml に `<depend>geometry_msgs</depend>` がない。
- **`ros2 run` で `No executable found`:** CMakeLists.txt に `move_node` の行を足したあとビルドしていない。

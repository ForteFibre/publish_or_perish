# 看板の数を受け取る

## やること

看板は 2 秒ごとに、`/board/number` に 1〜50 の数を送っている。自分のノードでこれを受け取り、受け取った数をログに出す。自分のノードが `/board/number` を受け取り始めればクリア。

前の課題で書いた `board_node` に足して書く。新しい実行ファイルは作らなくてよい。

## 説明

### Subscriber

topic からメッセージを受け取る側が **Subscriber**。前の課題の Publisher と対になる。

`/chatter` の文字列を受け取って表示するノードの例。前の課題の `TalkerNode` が送るものを受け取る。

```cpp
#include <rclcpp/rclcpp.hpp>
#include <std_msgs/msg/string.hpp>

class ListenerNode : public rclcpp::Node
{
public:
  ListenerNode() : Node("listener_node")
  {
    sub_ = create_subscription<std_msgs::msg::String>(
      "/chatter", 10, [this](const std_msgs::msg::String & msg) {on_chatter(msg);});
  }

private:
  void on_chatter(const std_msgs::msg::String & msg)
  {
    RCLCPP_INFO(get_logger(), "受け取った: %s", msg.data.c_str());
  }

  rclcpp::Subscription<std_msgs::msg::String>::SharedPtr sub_;
};
```

| 部分 | 意味 |
|---|---|
| `create_subscription<std_msgs::msg::String>("/chatter", 10, 関数)` | `/chatter` の `String` を受け取る Subscriber を作る。メッセージが届くたびに 3 つ目の関数が呼ばれる |
| `[this](const std_msgs::msg::String & msg) {...}` | 届いたメッセージを `msg` で受け取る関数 (ラムダ式)。`&` は、メッセージを写さずにそのまま渡す書き方 |
| `msg.data.c_str()` | `String` の中身 `data` (C++ の文字列) を、`%s` で出せる形にする |
| `rclcpp::Subscription<std_msgs::msg::String>::SharedPtr` | Subscriber を指すポインタの型。タイマーや Publisher と同じく、メンバ変数にしまう |

- 受け取る関数が呼ばれるのは、タイマーと同じく `rclcpp::spin(node)` の中。
- 1 つのノードに、Publisher と Subscriber とタイマーをいくつでも持たせられる。

### 数を受け取るとき

`/board/number` の型は `std_msgs/msg/Int32`。中身の数は `msg.data` (`int`) に入っている。

| コマンドでの型名 | C++ の型名 | include するファイル |
|---|---|---|
| `std_msgs/msg/Int32` | `std_msgs::msg::Int32` | `std_msgs/msg/int32.hpp` |

`int` をログに出すときは `%d` を使う。

先に `ros2 topic echo /board/number` で、どんな数が来ているかを見ておくとよい。

## ヒント

<details><summary>ヒント 1: どこに足すか</summary>

`board_node` のコンストラクタに `create_subscription` の行を足し、受け取る関数をメンバ関数として足す。`sub_` のメンバ変数も足す。

</details>

<details><summary>ヒント 2: 受け取る関数</summary>

```cpp
void on_number(const std_msgs::msg::Int32 & msg)
{
  RCLCPP_INFO(get_logger(), "数: %d", msg.data);
}
```

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **ログに何も出ない:** `sub_` をコンストラクタの中の変数 (`auto sub = ...`) にすると、コンストラクタが終わったところで消えて、何も受け取らない。メンバ変数にする。
- **ビルドで `std_msgs/msg/int32.hpp` が見つからない:** include のファイル名の打ち間違い。型名 `Int32` は、ファイル名では小文字の `int32`。
- **ログは出るのにクリアにならない:** topic の名前が違う (`/board/numbers` など)。画面右下の「配線」に警告が出る。
- **`ros2 topic echo` ではクリアにならない:** 数えるのは自分で書いたノードだけ。

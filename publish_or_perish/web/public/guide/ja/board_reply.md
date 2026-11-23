# 受け取った数を 2 倍して返す

## やること

`/board/number` で受け取った数を 2 倍して、自分のノードから `/board/answer` に送る。正しければ看板に「正解」と出る。5 つの数に正解すればクリア。

前の課題までの `board_node` に足して書く。

## 説明

### 受けて送る

受け取ったメッセージをもとに、別の topic へ送るノードはよくある。たとえば、センサーの値を受け取り、計算した指令を送るノード。

受け取る関数の中で、Publisher の `publish` を呼べばよい。Publisher は、受け取る関数より前 (コンストラクタ) で作っておく。

`/counter` の数を受け取り、1 足して `/counter_plus` に送るノードの例。

```cpp
#include <rclcpp/rclcpp.hpp>
#include <std_msgs/msg/int32.hpp>

class PlusOneNode : public rclcpp::Node
{
public:
  PlusOneNode() : Node("plus_one_node")
  {
    pub_ = create_publisher<std_msgs::msg::Int32>("/counter_plus", 10);
    sub_ = create_subscription<std_msgs::msg::Int32>(
      "/counter", 10, [this](const std_msgs::msg::Int32 & msg) {on_counter(msg);});
  }

private:
  void on_counter(const std_msgs::msg::Int32 & msg)
  {
    std_msgs::msg::Int32 out;
    out.data = msg.data + 1;
    pub_->publish(out);
  }

  rclcpp::Publisher<std_msgs::msg::Int32>::SharedPtr pub_;
  rclcpp::Subscription<std_msgs::msg::Int32>::SharedPtr sub_;
};
```

- 送るメッセージは、受け取ったもの (`msg`) とは別の変数 (`out`) に作る。受け取った `msg` は `const` なので、書き換えられない。
- 受け取るたびに 1 回送るので、送る間隔は受け取る間隔と同じになる。タイマーは要らない。

試すときは、2 つのターミナルで次を実行すると、送った数に 1 足した数が返ってくる。

```bash
ros2 topic echo /counter_plus
ros2 topic pub --once /counter std_msgs/msg/Int32 "{data: 5}"
```

## ヒント

<details><summary>ヒント 1: どこに足すか</summary>

`/board/answer` に送る Publisher をコンストラクタで作り、前の課題で書いた「数を受け取る関数」の中で送る。

</details>

<details><summary>ヒント 2: 送る値</summary>

```cpp
std_msgs::msg::Int32 answer;
answer.data = msg.data * 2;
```

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **看板に「ちがう」と出る:** 送った数が、看板が今出している数 (か 1 つ前の数) の 2 倍になっていない。看板の `/board/answer` の欄に、届いた数が出る。
- **「正解」と出るのに数が増えない:** 1 つの数に正解できるのは 1 回だけ。同じ答えを何度送っても 1 回と数える。数は 2 秒ごとに変わるので、5 つ正解するには 10 秒ほどかかる。
- **看板に何も届かない:** topic の名前か型が違う。画面右下の「配線」に警告が出る。
- **`ros2 topic pub` で送っても数が増えない:** 数えるのは自分で書いたノードから送ったものだけ。

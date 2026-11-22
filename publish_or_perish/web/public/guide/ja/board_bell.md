# 鐘を鳴らす

## やること

看板の鐘は service `/board/bell` (`std_srvs/srv/Trigger`)。自分のノードから 3 回呼ぶ。鳴ると看板の鐘が揺れ、返事 (response) の `message` に何回目に鳴ったかが入っている。

前の課題までの `board_node` に足して書く。

先に CLI で呼んで、どんな返事が来るかを見ておく (CLI で鳴らした分は数えない)。

```output
$ ros2 service call /board/bell std_srvs/srv/Trigger
requester: making request: std_srvs.srv.Trigger_Request()

response:
std_srvs.srv.Trigger_Response(success=True, message='{{msg:srv.bell|n=1}}')
```

返事の `message` は英語で返る。

## 説明

### service の client

service を呼ぶ側を **client**、返事をする側を **server** と呼ぶ。鐘の server は農場の中にあるので、自分のノードには client を作る。

例として、`/lamp/toggle` という `Trigger` の service を 2 秒ごとに呼び、返事をログに出すノードを示す (`/lamp/toggle` は説明のための名前で、農場にはない)。

```cpp
#include <chrono>
#include <rclcpp/rclcpp.hpp>
#include <std_srvs/srv/trigger.hpp>

using namespace std::chrono_literals;
using Trigger = std_srvs::srv::Trigger;

class LampNode : public rclcpp::Node
{
public:
  LampNode() : Node("lamp_node")
  {
    client_ = create_client<Trigger>("/lamp/toggle");
    timer_ = create_wall_timer(2s, [this] {on_timer();});
  }

private:
  void on_timer()
  {
    if (!client_->service_is_ready()) {
      RCLCPP_INFO(get_logger(), "service がまだない");
      return;
    }
    client_->async_send_request(
      std::make_shared<Trigger::Request>(),
      [this](rclcpp::Client<Trigger>::SharedFuture future) {
        RCLCPP_INFO(get_logger(), "返事: %s", future.get()->message.c_str());
      });
  }

  rclcpp::Client<Trigger>::SharedPtr client_;
  rclcpp::TimerBase::SharedPtr timer_;
};
```

| 部分 | 意味 |
|---|---|
| `#include <std_srvs/srv/trigger.hpp>` | service の型ごとに include する。型のパッケージ `std_srvs` は package.xml に `<depend>` で書く |
| `using Trigger = std_srvs::srv::Trigger;` | 長い型名に短い別名を付ける |
| `create_client<Trigger>("/lamp/toggle")` | `/lamp/toggle` を呼ぶ client を作る |
| `client_->service_is_ready()` | server が見つかっているか。見つかる前に呼んでも返事は来ない |
| `async_send_request(頼むもの, 関数)` | 頼んで、すぐに戻る。返事が届いたら 2 つ目の関数が呼ばれる。`Trigger` の頼むものは空なので、`std::make_shared<Trigger::Request>()` を渡す |
| `future.get()->message` | 届いた返事の `message` |

`async_send_request` は返事を待たずに戻る。返事を待って止まる書き方にすると、待っている間 `rclcpp::spin` が回らず、返事を受け取る処理も止まってしまう。

## この課題で書くもの

- `std_srvs` を使うので、package.xml に 1 行足す。

```xml
  <depend>std_srvs</depend>
```

- 自分のノードのログに、次のように出れば鳴っている。

```output
[INFO] [1730000000.123456789] [board_node]: 返事: {{msg:srv.bell|n=2}}
```

## ヒント

<details><summary>ヒント 1: どこに足すか</summary>

`board_node` のコンストラクタで `/board/bell` の client を作る。呼ぶのは、前の課題までで作ったタイマーの関数の中でよい。タイマーが 1 秒ごとなら、起動から数秒で 3 回鳴る。

</details>

<details><summary>ヒント 2: 呼ぶ回数</summary>

3 回を超えて呼び続けてもかまわない。止めたいときは、呼んだ回数をメンバ変数で数え、3 回呼んだら呼ばないようにする。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **「service がまだない」が出続ける:** service の名前の打ち間違いか、農場が動いていない。`ros2 service list` に `/board/bell` が出るか確かめる。
- **ビルドで `std_srvs/srv/trigger.hpp` が見つからない:** package.xml に `<depend>std_srvs</depend>` がない。
- **ビルドで `async_send_request` のところがエラーになる:** 2 つ目の関数は `rclcpp::Client<Trigger>::SharedFuture` を受け取る形にする。
- **鳴っているのに数が増えない:** CLI (`ros2 service call`) で鳴らした分は数えない。

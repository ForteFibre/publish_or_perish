# ボタン 1 で、自分のノードがボトルをつかむ

## やること

前の課題の `semi_node` を書き足す。ボタン 1 を押したら、`semi_node` が次の 3 つを **順に** する。

1. アームを縮め (0)、リフトを下ろす (0)。**下りきるまで待つ**
2. service `/robot/grab` を呼ぶ。**返事が来るまで待つ**
3. リフトを 0.12 m に上げる

台車はキーで桜ゾーンの前まで動かしておく (位置は手動の「桜ボトルをつかむ」と同じ)。G キーは使わない。

## 説明

### 1 つずつ順にやる: 段の番号とタイマー

「下ろす → 待つ → つかむ → 待つ → 上げる」のように順にやるとき、マイコンなら `delay()` で待つが、ROS のノードでは使わない (待っている間は spin が止まり、メッセージも受け取れない)。

代わりに、**今どの段にいるか** を整数のメンバ変数に入れておき、短い間隔 (50 ms) のタイマーで「今の段が終わったか」を見て、終わったら次の段へ進める。

課題とは別の例: ボタン 4 を押すと、アームを 0.2 m 伸ばし、伸びきったら縮める。

```cpp
// メンバ変数
int step_ = 0;          // 0: 何もしていない, 1: 伸ばしている, 2: 縮めている
double extend_now_ = 0; // /robot/arm/extend_now で受け取った今の伸び
```

```cpp
void on_button(const std_msgs::msg::Int32 & m)
{
  if (m.data == 4 && step_ == 0) {
    send_extend(0.2);
    step_ = 1;
  }
}

void on_timer()   // 50 ms ごと
{
  if (step_ == 1 && std::abs(extend_now_ - 0.2) < 0.005) {   // 伸びきった (目標との差が 5 mm 以内)
    send_extend(0.0);
    step_ = 2;
  } else if (step_ == 2 && extend_now_ < 0.005) {             // 縮みきった
    step_ = 0;
  }
}
```

| 部分 | 意味 |
|---|---|
| `step_` | 今の段。ボタンで 1 にして、タイマーの中で 1 → 2 → 0 と進める |
| `step_ == 0` の確認 | 動いている途中にもう一度押されても、最初からやり直さない |
| `std::abs(a - b) < 0.005` | a と b の差が 5 mm 以内。小数は `==` で比べるとほぼ一致しない (0.19999… になる) ので、差で比べる。`#include <cmath>` が要る |
| `extend_now_` | `/robot/arm/extend_now` (Float64) を受け取る Subscriber の中で入れておく |

`send_extend(x)` は、`/robot/arm/extend` に `x` を送る関数を自分で作ったもの。

### service を呼んで返事を待つ

service の呼び方は農場 (ステージ 6「乾いたマスに水をやる」) と同じ。`async_send_request` は返事を待たずにすぐ戻り、返事が来たら 2 つ目の関数が呼ばれる。なので「返事を待っている」をメンバ変数 (`bool`) で覚えておき、返事の関数の中で `false` に戻す。タイマーは、それが `false` になったら次の段へ進める。

## 手順

1. `semi_node` に Subscriber を足す: `/robot/arm/lift_now` と `/robot/arm/extend_now` (Float64) を受けてメンバ変数に入れる。
2. Publisher を足す: `/robot/arm/extend` (Float64)。
3. Client を足す: `/robot/grab` (`std_srvs::srv::Trigger`)。package.xml に `<depend>std_srvs</depend>` (農場で足してあれば不要)。
4. メンバ変数 `step_` と、50 ms のタイマーを足す。
5. ボタン 1 を受けたら: extend 0 と lift 0 を送り、`step_ = 1`。
6. タイマーの中:
   - `step_ == 1` で、lift_now と extend_now が 0 に着いたら: `/robot/grab` を呼び、`step_ = 2`
   - `step_ == 2` で、返事が来たら: lift 0.12 を送り、`step_ = 3`
   - `step_ == 3` で、lift_now が 0.12 に着いたら: `step_ = 0`
7. ビルドして起動し、キーで台車を桜ゾーンの前 (x -2.78, y 1.475, 向き 180°) に置いて、1 を押す。「3 本つかんだ [自分のノード]」と出れば済み。

## ヒント

<details><summary>ヒント 1: 返事を待つところ</summary>

```cpp
waiting_ = true;
grab_->async_send_request(
  std::make_shared<std_srvs::srv::Trigger::Request>(),
  [this](rclcpp::Client<std_srvs::srv::Trigger>::SharedFuture f) {
    RCLCPP_INFO(get_logger(), "%s", f.get()->message.c_str());
    waiting_ = false;
  });
step_ = 2;
```

タイマーの中は `if (step_ == 2 && !waiting_) { ... }`。

</details>

<details><summary>ヒント 2: いつまでも着かないとき</summary>

リフトが 0 まで下がらない (何かの理由で止まる) と、`step_ == 1` から進まなくなる。段に入った時刻を覚えておき、3 秒たったら次へ進める、と書いておくと止まらない。時刻は `now()` で取れる。`(now() - start_).seconds()` が経った秒数。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **{{msg:match.grab.none|front=-0.05,back=0.07,side=0.11}} と出る:** つかむ処理は動いている。台車の位置がずれている (手動の「桜ボトルをつかむ」の位置の表を見る)。
- **{{msg:match.grab.lift_high|lift=0.12,max=0.03}} と出る:** 下りきる前に grab を呼んでいる。`lift_now` が 0.03 より小さくなってから呼ぶ。
- **1 を押しても何も起きない:** `step_` が 0 に戻っていない (前の動きの途中のまま)。`RCLCPP_INFO` で `step_` を表示して、どこで止まっているかを見る。
- **済まない:** G キーで先につかむと、この回の機構に「キー」が入る。R で戻してやり直す。

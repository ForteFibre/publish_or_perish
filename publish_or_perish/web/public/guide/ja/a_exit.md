# 自分のノードだけでエリア 2 に入る

## やること

新しいノード `auto_node` を書く。キーに触らずに、`auto_node` が `/robot/cmd_vel` を送って、ロボットをスタートゾーンからエリア 2 まで動かす。

自動の課題は、この回 (R で最初の位置に戻してから) にキーや CLI で台車を動かしたり、ボタンを押したりすると数えない。始める前に R を押し、そのあとはキーに触らない。

## 説明

### 位置と向き

`/robot/pose` (`geometry_msgs/msg/Pose`) に、台車の位置 `position.x` `position.y` [m] と向き `orientation` が 30 回/秒で届く。

向きはクォータニオンという 4 つの数 (`x` `y` `z` `w`) で入っている。台車は床の上で回るだけなので、角度 θ [rad] は `z` と `w` から求まる。受け取った関数の中で、位置と角度をメンバ変数にしまっておく。

```cpp
x_ = m.position.x;
y_ = m.position.y;
th_ = 2.0 * std::atan2(m.orientation.z, m.orientation.w);   // 向きの角度 [rad]
```

- 原点はフィールドの真ん中。x は右、y は奥が正。
- 向きは、右 (x の正の方) を向いているとき 0、奥を向いているとき π/2 (1.57)、左は π (3.14)。
- スタートの位置は (-3.11, -3.11)、向き π/2。

### 速度は機体の向きで送る

`/robot/cmd_vel` (`geometry_msgs/msg/Twist`) の `linear.x` は **台車の前**、`linear.y` は **台車の左** の速さ [m/s]。`angular.z` は左回りの速さ [rad/s]。フィールドの向き (x 右・y 奥) ではない。

フィールドの向きで「x に ex、y に ey 進みたい」とき、台車の向きが θ なら、台車の前と左の成分は次になる。

```cpp
double fwd  =  std::cos(th_) * ex + std::sin(th_) * ey;   // 前
double left = -std::sin(th_) * ex + std::cos(th_) * ey;   // 左
```

例: 奥 (θ = π/2) を向いているときに右 (ex = 1, ey = 0) へ行きたいなら、fwd = 0、left = -1 (右へ横に動く)。

### 目標の点へ近づく

目標の点との差 (ex, ey) に比例した速度を出すと、遠いときは速く、近づくと遅くなり、目標で止まる (比例制御)。

```cpp
double ex = goal_x - x_, ey = goal_y - y_;
if (std::hypot(ex, ey) < 0.02) { /* 着いた: 0 を送って次の点へ */ }
double vx = 2.0 * fwd, vy = 2.0 * left;          // 2.0 は比例の係数 (大きいと速いが行き過ぎる)
// 速すぎないように 1 m/s で頭打ちにする
double v = std::hypot(vx, vy);
if (v > 1.0) { vx *= 1.0 / v; vy *= 1.0 / v; }
```

`std::hypot(a, b)` は √(a² + b²)。`#include <cmath>` が要る。

### 点を順にたどる

スタートゾーンから直接エリア 2 へは、木の枠があって行けない。通る点を順に並べ、1 つ着いたら次へ進める (半自動の「段」と同じ考え方)。

| 順 | 点 (x, y) | 理由 |
|---|---|---|
| 1 | (-1.5, -3.11) | 右へ出る。エリア 1 と 2 の境の木の枠は x = -1.86 まで |
| 2 | (-1.5, -2.3) | 奥へ。y が -2.72 を超えるとエリア 2 |

## 手順

1. `~/src26_ws/src/tutorial_nodes/src/auto_node.cpp` を作る。package.xml に `<depend>geometry_msgs</depend>` (農場で足してあれば不要)、CMakeLists.txt に 1 行足す。

```cmake
ament_auto_add_executable(auto_node src/auto_node.cpp)
```

2. `/robot/pose` を受ける Subscriber (受けたらメンバ変数 `pose_` に入れる)、`/robot/cmd_vel` に送る Publisher、50 ms のタイマーを作る。
3. 通る点を `std::vector` に入れ、今何番目かを `int` のメンバ変数で持つ。
4. タイマーの中で: 今の点との差から速度を出して送る。着いたら次の点へ。全部着いたら 0 を送って止まる。
5. 画面で R を押して最初の位置に戻し、ビルドしたノードを起動する。

```bash
ros2 run tutorial_nodes auto_node
```

6. エリア 2 に入って「課題クリア」と出れば済み。

## ヒント

<details><summary>ヒント 1: 点の持ち方</summary>

```cpp
struct Point { double x, y; };
std::vector<Point> points_ = {{-1.5, -3.11}, {-1.5, -2.3}};
size_t index_ = 0;
```

</details>

<details><summary>ヒント 2: pose がまだ届いていないとき</summary>

起動した直後は `/robot/pose` がまだ届いていない。`bool has_pose_ = false;` を用意し、受け取ったら `true` にする。タイマーの中は `if (!has_pose_) return;` から始める。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **斜めに動いてしまう / 逆へ行く:** 速度をフィールドの向きのまま送っている。上の式で台車の向きに直す。
- **木の枠に当たって止まる:** 点 1 の x が小さすぎる (木の枠の端 -1.86 に台車の幅の半分 0.23 を足した -1.63 より右にする)。
- **「この回は台車を キー でも動かした」:** 起動の前にキーで動かした。R で戻してから起動し直す。

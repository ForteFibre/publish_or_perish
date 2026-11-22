# 無人農場

## やること

CLI を使わず、自分のノード `farmer_node` だけで 60 秒の間に 100 G 稼ぐ。小麦は 5 G で植えて 25 G で売れるので、60 秒の間に 4 個以上収穫する。

小麦が実るまでの決まり:

| 決まり | 値 |
|---|---|
| 実るまで | 水分が 20 以上の時間が合計 30 秒 |
| 水分 | 1 回の水やりで +60。何もしないと 1 秒に 2.2 ずつ減る (45 秒で 100 → 0) |
| 実ってから | 40 秒で枯れる。枯れたものも収穫 (片付け) できるが 0 G |
| タンク | 10 回分。井戸 (マス (0, 0)) に立つと満タン。井戸には植えられない |

1 つずつ植えて待つと 1 個に 30 秒以上かかるので、いくつかを同時に育てる。ここまでに作った「動かす」「受け取る」「service を呼ぶ」を 1 つのノードにまとめ、次の順で判断させる。

1. タンクが空なら、井戸へ行く
2. 実ったマス (または枯れたマス) があれば、そこへ行って収穫する
3. 育っている途中で水分が 35 未満のマスがあれば、そこへ行って水をやる
4. 育てている数が 10 未満なら、空いているマスへ行って種をまく

同じ優先度のマスが複数あれば、近いものから選ぶ。

package.xml に `std_msgs` を足し、CMakeLists.txt に 1 行足す。ほかのノード (`patrol_node` `water_node` など) は Ctrl+C で止めてから起動する。

```xml
  <depend>std_msgs</depend>
```

```cmake
ament_auto_add_executable(farmer_node src/farmer_node.cpp)
```

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes farmer_node
```

最初の 1 個が実るまでに 30 秒以上かかるので、100 G に届くのは起動して 1〜2 分後。課題の欄の数字は「直近 60 秒に稼いだ額」の最大値。

## 使うもの

| 使うもの | 名前 | 型 |
|---|---|---|
| 受け取る | `/bot1/pose` | `geometry_msgs/msg/Pose2D` |
| 受け取る | `/bot1/tank` | `std_msgs/msg/Int32` (`#include <std_msgs/msg/int32.hpp>`、値は `msg.data`) |
| 受け取る | `/field/moisture` `/field/crops` | `nav_msgs/msg/OccupancyGrid`。crops は -1: なし、0〜99: 育っている途中、100: 実った、-2: 枯れた |
| 送る | `/bot1/cmd_vel` | `geometry_msgs/msg/Twist` |
| 呼ぶ | `/bot1/plant` `/bot1/water` `/bot1/harvest` | `std_srvs/srv/Trigger`。ロボットが今いるマスに植える・水をやる・収穫する |

| 書き方 | 意味 |
|---|---|
| `std::hypot(dx, dy)` | 距離 `sqrt(dx*dx + dy*dy)` (`#include <cmath>`) |
| `std::clamp(v, lo, hi)` | `v` を `lo`〜`hi` に収める (`#include <algorithm>`) |
| `max_crops_ = declare_parameter("max_crops", 10);` | 起動するときに `-p max_crops:=6` のように変えられる設定 (パラメータ) を作る。同時に育てる数にすると、試すたびにビルドし直さなくてよい |

## ヒント

<details><summary>ヒント 1: ノードの形</summary>

受け取ったメッセージは、全部メンバ変数にしまうだけにする。判断と動きは 100 ms ごとのタイマーの関数の中で、毎回この順に進める。

1. 行き先のマスとやることが決まっていなければ、決める (上の 1〜4)。
2. 行き先のマスの中心まで遠ければ、そちらへ向かう速度を送って戻る。
3. 着いたら止まり (全部 0 の `Twist` を送る)、やることに合う service を呼ぶ。井戸なら何も呼ばない (立った時点で満タン)。
4. 返事が来たら、行き先を決め直す。

</details>

<details><summary>ヒント 2: 行き先の選び方</summary>

全部のマスを調べ、1〜4 の条件に合うマスの中から 1 つ選ぶ。優先度と近さを一度に比べるには、距離に「罰点」を足した値がいちばん小さいマスを選ぶ。罰点は、収穫 0、水やり 0.5、種まき 3.0 のようにする (罰点 3.0 は「3 m 遠い」のと同じ扱い)。

```cpp
const double d = std::hypot(x + 0.5 - pose_.x, y + 0.5 - pose_.y) + penalty;
```

`x + 0.5` は、マス x の中心の座標。

</details>

<details><summary>ヒント 3: マスへ向かう速度</summary>

`/bot1/pose` は畑の向き、`cmd_vel` はロボットから見た向き (x 前・y 左)。ロボットが `theta` 回っていると両者がずれるので、差を `-theta` 回してから速度にする。

```cpp
const double ex = tx_ + 0.5 - pose_.x, ey = ty_ + 0.5 - pose_.y;   // 行き先までの差 (畑の向き)
const double c = std::cos(pose_.theta), s = std::sin(pose_.theta);
cmd.linear.x = std::clamp(2.0 * (c * ex + s * ey), -1.2, 1.2);      // ロボットから見た前
cmd.linear.y = std::clamp(2.0 * (-s * ex + c * ey), -1.2, 1.2);     // ロボットから見た左
cmd.angular.z = -2.0 * pose_.theta;                                  // 向きを 0 に戻していく
```

中心まで 0.12 m 以内 (`std::hypot(ex, ey) <= 0.12`) なら着いたとする。

</details>

<details><summary>ヒント 4: 同じマスに 2 回水をやらない</summary>

service の返事を待っている間は、次を決めない (`water_node` と同じ)。もう 1 つ、返事が来たあとでも、次の `/field/moisture` が届くまでは畑が古いままなので、次を決めない。返事の関数で「畑が古い」印を立て、`/field/moisture` を受け取る関数で下ろす。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **数字が 0 のまま:** 数えるのは「無人運転中」(CLI のノードがなく、自分のノードだけ) の間の収穫だけ。CLI を全部止める。途中で CLI を使うと、そこから 60 秒を数え直す。
- **枯れるものが多い:** 同時に育てる数が多すぎて水やりが追いつかない。数を 6 くらいに減らす。
- **ロボットが同じところで震える:** 近づく速さの係数 (ヒント 3 の `2.0`) が大きすぎる。1.0 くらいに下げる。
- **斜めにずれていく・行き過ぎる:** `cmd_vel` と `pose` の向きのずれを直していない (ヒント 3)。

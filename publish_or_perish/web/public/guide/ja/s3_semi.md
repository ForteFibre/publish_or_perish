# 半自動の農場

## やること

移動はキーのまま、**種まき・水やり・収穫** を自分のノード `farmer_node` に任せる。ロボットが乗ったマスを見て、`farmer_node` が何をするか決めて service を呼ぶ。自分のノードが収穫した数が 5 個になればクリア。

前の課題の `water_node` は「乾いていたら水をやる」だけだった。この課題では、マスの状態によって 3 つの service を使い分ける。次の課題「無人農場」では、ここに移動を足して全部自動にする。

## 説明

### 乗っているマスの番号

マスは 1 m 角。ロボットの位置 `pose_.position.x` `pose_.position.y` [m] の小数を切り捨てると、マスの番号になる。

```cpp
const int x = static_cast<int>(std::floor(pose_.position.x));
const int y = static_cast<int>(std::floor(pose_.position.y));
const int i = y * width + x;    // /field/crops と /field/moisture の data の何番目か
```

`width` は受け取った OccupancyGrid の `info.width`。

### マスの状態と、やること

| `/field/crops` の値 | 意味 | やること |
|---|---|---|
| 100 | 実った | `/bot1/harvest` (収穫) |
| -2 | 枯れた | `/bot1/harvest` (片付け。0 G) |
| -1 | 何もない | `/bot1/plant` (種まき)。ただし井戸のマス (0, 0) には植えられない |
| 0〜99 | 育っている途中 | 水分 (`/field/moisture`) が 35 未満なら `/bot1/water` (水やり) |

上から順に調べて、最初に当てはまったものを 1 つだけやる。

### 同じマスで続けてやらない

service を呼んでから、`/field/crops` と `/field/moisture` に結果が出るまで最大 0.2 秒かかる。その間に同じマスを見ると、まだ「何もない」「乾いている」ままなので、同じことを 2 回やってしまう。

- 返事を待っている間は何もしない (`water_node` と同じ)。
- 返事が来たら「畑が古い」印を立て、次の `/field/crops` を受け取ったら下ろす。印が立っている間は何もしない。

## 手順

1. `~/src26_ws/src/tutorial_nodes/src/farmer_node.cpp` を作る。`water_node` をコピーして始めるとよい。
2. Subscriber を 3 つ: `/bot1/pose` (Pose)、`/field/crops`、`/field/moisture` (どちらも OccupancyGrid)。受け取ったらメンバ変数にしまう。
3. Client を 3 つ: `/bot1/plant`、`/bot1/water`、`/bot1/harvest`。
4. 100 ms のタイマーの中で: 返事待ちか、畑が古ければ戻る。そうでなければ、乗っているマスの状態を上の表で調べて、1 つ呼ぶ。
5. CMakeLists.txt に `ament_auto_add_executable(farmer_node src/farmer_node.cpp)` を足し、ビルドして起動する (`water_node` は Ctrl+C で止める)。
6. 畑の画面をクリックし、キーで畑の上を走らせる。乗ったマスで種まき・水やりが始まる。実ったマスにもう一度乗ると収穫する。
7. 自分のノードの収穫が 5 個になればクリア。

## ヒント

<details><summary>ヒント 1: 畑の外にいるとき</summary>

`x` と `y` が `0 <= x < width`、`0 <= y < height` に入っていなければ、何もしない (畑の外の data を読むと、ノードが落ちる)。

</details>

<details><summary>ヒント 2: 回り方</summary>

小麦は 30 秒で実る。端から順に 6〜8 マスに植えて水をやり、井戸で補給してから、また同じマスを回る。乾いたマスに乗れば、ノードが水をやる。30 秒たったころに回れば、実ったマスで収穫する。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **数が増えない:** 数えるのは自分のノードが呼んだ収穫だけ。キーの C や `ros2 service call` で収穫しても数えない。
- **同じマスに何回も水をやる / タンクがすぐ空になる:** 「畑が古い」印を使っていない。
- **ノードが落ちる (`Segmentation fault` など):** 畑の外にいるときに data を読んでいる (ヒント 1)。`/field/crops` をまだ受け取っていないとき (`data` が空) も読まない。

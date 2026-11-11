# 畑を巡回する

## やること

自分のノード `patrol_node` で bot1 を動かし、畑の 20 マスを通る。前の課題の `move_node` は前へ進むだけなので、進む向きを時間で切り替えるノードにする。

- 畑は横 8 マス × 縦 5 マス (1 マス = 1 m)。ロボットは柵より外へは出ない。
- 数えるのは自分のノードが動かしている間だけ。`move_node` や `ros2 topic pub` が動いていたら Ctrl+C で止めておく (2 つのノードが同じ topic に送ると、動きが混ざる)。
- 書くのは `~/src26_ws/src/tutorial_nodes/src/patrol_node.cpp` と、CMakeLists.txt の `ament_auto_add_executable` の 1 行。ビルドと起動は `move_node` と同じ手順。

## 使うもの

`move_node` の Publisher とタイマーはそのまま使える。足すのは「起動してから何秒たったか」を知る方法。

| 書き方 | 意味 |
|---|---|
| `rclcpp::Time start_;` | 時刻を入れておく型。メンバ変数にする |
| `start_ = now();` | 今の時刻。コンストラクタで 1 回入れておく |
| `(now() - start_).seconds()` | `start_` から今までの秒数 (`double`) |
| `cmd.linear.x` / `cmd.linear.y` | ロボットから見て前 / 左への速度 [m/s]。マイナスなら後ろ / 右 |

## ヒント

<details><summary>ヒント 1: どう動けば全部のマスを通るか</summary>

横に端まで進む → 縦に 1 マスずれる → 逆向きに横へ進む、をくり返すと 1 行ずつ全部のマスを通る。1 m/s なら、横の 7 m に 7 秒、縦の 1 m に 1 秒かかる。

</details>

<details><summary>ヒント 2: 今どの動きをするかを、秒数から決める</summary>

横 7 秒 + 縦 1 秒 = 8 秒を 1 周とする。起動してからの秒数 `t` から、何周目か (`lap`) と、周の中で何秒目か (`in_lap`) を出す。

```cpp
const double t = (now() - start_).seconds();
const int lap = static_cast<int>(t / 8.0);
const double in_lap = t - lap * 8.0;
```

`in_lap` が 7 より小さければ横、そうでなければ縦に動かす。横の向きは `lap` が偶数か奇数かで変える。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **マスの数が増えない:** 数えるのは自分のノードが動かしている間だけ。`ros2 topic pub` や `move_node` が動いていたら止める。
- **右上の「あなたのノード」に `patrol_node` が出ない:** 農場と `ROS_DOMAIN_ID` が違うか、ノードが起動直後に終わっている。ターミナルにエラーが出ていないか見る。
- **端で止まったまま次に進まない:** 柵に当たっている間も時間は進む。横の秒数が長すぎると、端で待つ時間が長くなるだけで、次の動きには移る。待っても移らないなら、`in_lap` の計算を `RCLCPP_INFO` で出して確かめる。
- **斜めに進む:** ステージ 1 で `angular.z` を送ると、ロボットの向きが変わったまま残る。`linear.x` はロボットから見た前なので、向きが変わっていると斜めに進む。向きは `ros2 topic echo /bot1/pose` の `theta` [rad] で見られる (0 なら畑の x の向き)。斜めでもマスは通るので、課題はクリアできる。

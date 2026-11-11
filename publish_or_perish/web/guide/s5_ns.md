# namespace で 2 台を動かす

## やること

同じ `farmer_node` を 2 つ起動し、1 つで bot1、もう 1 つで bot2 を動かす。コードは 1 つのまま、起動するときの namespace だけを変える。2 台がそれぞれ動き出せばクリア。

namespace は起動するときに `--ros-args -r __ns:=/bot2` のように付ける。

## 名前のつながり方

ノードの中で書いた名前は、頭に `/` があるかどうかで扱いが変わる。

| ノードの中の名前 | namespace `/bot2` で起動したときの名前 |
|---|---|
| `"/field/moisture"` (`/` で始まる) | `/field/moisture` のまま |
| `"pose"` (`/` で始まらない) | `/bot2/pose` |
| ノード名 `"farmer"` | `/bot2/farmer` |

`/` で始まらない名前は namespace の下につながる。同じコードを namespace だけ変えて起動すれば、別のロボットにつながる。ノード名も `/bot1/farmer` と `/bot2/farmer` に分かれるので、同じ名前のノードが 2 つになることもない。

ノードの中で `get_namespace()` を呼ぶと、起動したときの namespace (`"/bot2"` など) が返る。

`ros2 node list` で `/bot1/farmer` と `/bot2/farmer` が出ることを確かめられる。

## ヒント

<details><summary>ヒント 1: コードのどこを変えるか</summary>

`farmer_node.cpp` の中で `/bot1/...` と書いた topic と service の名前から、頭の `/bot1/` を外す (`"/bot1/pose"` → `"pose"`)。畑全体の `/field/...` は、どのロボットからも同じものを見るので `/` 付きのまま。

ステージ 6 で `bot1.seed` を書き換えるようにした場合は、パラメータの名前も namespace から作る。

```cpp
const std::string name = std::string(get_namespace()).substr(1) + ".seed";   // "/bot2" -> "bot2.seed"
```

</details>

<details><summary>ヒント 2: 起動のしかた</summary>

ビルドし直してから、ターミナルを 2 つ使い、`ros2 run tutorial_nodes farmer_node` に `--ros-args -r __ns:=/bot1` と `--ros-args -r __ns:=/bot2` をそれぞれ付けて起動する。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **bot2 だけ動かない:** 名前に `/bot1/...` が残っている。2 つとも bot1 に速度を送るので、bot1 の動きが混ざる。右下の「配線」で `/bot1/cmd_vel` に送り手が 2 つ出ていたら、これ。
- **両方動かない:** `/field/moisture` の `/` まで外すと、`/bot1/field/moisture` を待ち続ける。`/field/...` は `/` 付きのまま。
- **namespace を付けずに起動した:** `pose` が `/pose` になり、どのロボットにもつながらない。

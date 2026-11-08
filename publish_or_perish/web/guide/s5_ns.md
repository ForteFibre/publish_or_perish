# namespace で 2 台を動かす

## やること

同じ `farmer_node` を 2 つ起動し、1 つで bot1、もう 1 つで bot2 を動かす。コードは 1 つのまま、起動するときの namespace だけを変える。

### 1. topic と service の名前から `/bot1` を外す

`farmer_node.cpp` の中で `/bot1/...` と書いたところを、頭の `/` ごと外す。`/field/...` はそのまま。

| 変える前 | 変えた後 |
|---|---|
| `"/bot1/pose"` | `"pose"` |
| `"/bot1/tank"` | `"tank"` |
| `"/bot1/cmd_vel"` | `"cmd_vel"` |
| `"/bot1/plant"` `"/bot1/water"` `"/bot1/harvest"` | `"plant"` `"water"` `"harvest"` |
| `"/field/moisture"` `"/field/crops"` | 変えない |

ステージ 6 で `bot1.seed` を書き換える行を足した場合は、パラメータの名前を namespace から作るようにする。`const std::string name = "bot1.seed";` の行を次に変える。

```cpp
    const std::string name = std::string(get_namespace()).substr(1) + ".seed";   // "/bot2" -> "bot2.seed"
```

### 2. ビルドして、namespace を変えて 2 つ起動する

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes farmer_node --ros-args -r __ns:=/bot1    # 1 つ目のターミナル
ros2 run tutorial_nodes farmer_node --ros-args -r __ns:=/bot2    # 2 つ目のターミナル
```

2 台がそれぞれ動き出せばクリア。

## 名前のつながり方

ノードの中で書いた名前は、頭に `/` があるかどうかで扱いが変わる。

| ノードの中の名前 | namespace `/bot2` で起動したときの名前 |
|---|---|
| `"/field/moisture"` (`/` で始まる) | `/field/moisture` のまま |
| `"pose"` (`/` で始まらない) | `/bot2/pose` |
| ノード名 `"farmer"` | `/bot2/farmer` |

`/` で始まらない名前は namespace の下につながる。同じコードを namespace だけ変えて起動すれば、別のロボットにつながる。ノード名も `/bot1/farmer` と `/bot2/farmer` に分かれるので、同じ名前のノードが 2 つになることもない。

`ros2 node list` で `/bot1/farmer` と `/bot2/farmer` が出ることを確かめられる。

## うまくいかないとき

- **bot2 だけ動かない:** 名前に `/bot1/...` が残っている。2 つとも bot1 に速度を送るので、bot1 の動きが混ざる。右下の「配線」で `/bot1/cmd_vel` に送り手が 2 つ出ていたら、これ。
- **両方動かない:** `/field/moisture` の `/` まで外すと、`/bot1/field/moisture` を待ち続ける。`/field/...` は `/` 付きのまま。
- **namespace を付けずに起動した:** `pose` が `/pose` になり、どのロボットにもつながらない。

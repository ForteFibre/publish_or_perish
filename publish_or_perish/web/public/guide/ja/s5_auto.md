# 2 台の無人農場

## やること

CLI を使わず、2 台で 60 秒の間に 300 G 稼ぐ。2 台が同じマスに行かないように、畑を左右に分けて受け持たせる。

1. `farmer_node` に、受け持つ列を決めるパラメータ `x_min` と `x_max` を足す (`x_min <= x < x_max` の列だけを見る)。
2. 2 つのノードに別の値を渡すため、launch ファイル `~/src26_ws/src/tutorial_nodes/launch/two_farmers.launch.xml` を書く (`launch` ディレクトリも作る)。
3. launch ファイルを install/ にコピーするように、CMakeLists.txt の最後の `ament_auto_package()` を次のように変える。

```cmake
ament_auto_package(INSTALL_TO_SHARE launch)
```

4. 前の課題の 2 つの `farmer_node` を Ctrl+C で止めてから、ビルドして起動する。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 launch tutorial_nodes two_farmers.launch.xml
```

1 つのコマンドで 2 つのノードが起動する。止めるときは Ctrl+C を 1 回押せば両方止まる。

## 使うもの

launch ファイルは XML で、`<launch>` の中に起動するノードを並べる。

| 書き方 | 意味 |
|---|---|
| `<node pkg="..." exec="...">` | `ros2 run <pkg> <exec>` と同じノードを起動する |
| `name="farmer"` | ノード名 (コードの中の名前を上書きする) |
| `namespace="bot1"` | `--ros-args -r __ns:=/bot1` と同じ |
| `<param name="x_min" value="0"/>` | `-p x_min:=0` と同じ。`<node>` の中に書く |
| `output="screen"` | ノードの出力をターミナルに出す |

畑が横 8 マスなら、bot1 が x = 0〜3、bot2 が x = 4〜7 を受け持つ。畑を広げたら境目を真ん中に動かす。

## ヒント

<details><summary>ヒント 1: 受け持つ列をパラメータにする</summary>

コンストラクタで `declare_parameter` を 2 つ作る (初期値は `x_min` が 0、`x_max` が 100 にすると、渡さないときは畑全体を見る)。行き先を探すループの x の範囲を、`x_min` から `x_max - 1` までに絞る。畑の幅を超えないように `std::min(畑の幅, x_max_)` で抑える。

</details>

<details><summary>ヒント 2: launch ファイルのノード 1 つ分</summary>

```xml
<node pkg="tutorial_nodes" exec="farmer_node" name="farmer" namespace="bot1" output="screen">
  <param name="x_min" value="0"/>
  <param name="x_max" value="4"/>
</node>
```

これを `<launch>` と `</launch>` の間に書き、bot2 の分をもう 1 つ並べる。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **`file 'two_farmers.launch.xml' was not found`:** `ament_auto_package(INSTALL_TO_SHARE launch)` に変えたあとビルドしていない。
- **ビルドで `ament_auto_package` のエラー:** `launch` ディレクトリがない、または名前が違う。
- **2 台が同じマスに集まる:** `x_min` `x_max` が行き先を探すループに効いていない。`ros2 param get /bot1/farmer x_max` で値が渡っているかも確かめる。
- **数字が増えない:** 2 台とも自分のノードで動いているときだけ数える。片方が止まっていないか、`ros2 node list` で `/bot1/farmer` と `/bot2/farmer` があるか確かめる。
- **300 G に届かない:** 小麦だと 60 秒に 12 個 (2 台で 6 個ずつ) 要る。launch の `<param>` で `seed` を `tomato` にしたり、同時に育てる数を増やしたりすると届きやすい。右下の「時間」を 2 倍にすると作物が早く育つ。

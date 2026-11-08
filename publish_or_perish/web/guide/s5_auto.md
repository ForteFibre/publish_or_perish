# 2 台の無人農場

## やること

CLI を使わず、2 台で 60 秒の間に 300 G 稼ぐ。2 台が同じマスに行かないように、畑を左右に分けて受け持たせる。

`farmer_node` には、受け持つ列を決めるパラメータ `x_min` `x_max` がある (ステージ 5 のコードに入っている。`x_min <= x < x_max` の列だけを見る)。2 つのノードに別の値を渡すため、launch ファイルで起動する。

### 1. launch ファイルを書く

`~/src26_ws/src/tutorial_nodes/launch/two_farmers.launch.xml` を作る (`launch` ディレクトリも作る)。

```xml
<launch>
  <node pkg="tutorial_nodes" exec="farmer_node" name="farmer" namespace="bot1" output="screen">
    <param name="x_min" value="0"/>
    <param name="x_max" value="4"/>
  </node>
  <node pkg="tutorial_nodes" exec="farmer_node" name="farmer" namespace="bot2" output="screen">
    <param name="x_min" value="4"/>
    <param name="x_max" value="100"/>
  </node>
</launch>
```

### 2. launch ファイルをインストールする

CMakeLists.txt の最後の `ament_auto_package()` を次のように変える。`launch` ディレクトリの中身が install/ にコピーされ、`ros2 launch` から見つけられるようになる。

```cmake
ament_auto_package(INSTALL_TO_SHARE launch)
```

### 3. ビルドして起動する

前の課題の 2 つの `farmer_node` は Ctrl+C で止めておく。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 launch tutorial_nodes two_farmers.launch.xml
```

1 つのコマンドで 2 つのノードが起動する。止めるときは Ctrl+C を 1 回押せば両方止まる。

## launch ファイルの中身

| 書き方 | 意味 |
|---|---|
| `<node pkg="..." exec="...">` | `ros2 run <pkg> <exec>` と同じノードを起動する |
| `name="farmer"` | ノード名 (コードの中の名前を上書きする) |
| `namespace="bot1"` | `--ros-args -r __ns:=/bot1` と同じ |
| `<param name="x_min" value="0"/>` | `-p x_min:=0` と同じ |
| `output="screen"` | ノードの出力をターミナルに出す |

畑が横 8 マスなら、bot1 が x = 0〜3、bot2 が x = 4〜7 を受け持つ。畑を広げたら `x_max` の境目を真ん中に動かす。

## うまくいかないとき

- **`file 'two_farmers.launch.xml' was not found`:** `ament_auto_package(INSTALL_TO_SHARE launch)` に変えたあとビルドしていない。
- **ビルドで `ament_auto_package` のエラー:** `launch` ディレクトリがない、または名前が違う。
- **数字が増えない:** 2 台とも自分のノードで動いているときだけ数える。片方が止まっていないか、`ros2 node list` で `/bot1/farmer` と `/bot2/farmer` があるか確かめる。
- **300 G に届かない:** 小麦だと 60 秒に 12 個 (2 台で 6 個ずつ) 要る。`-p` の代わりに launch の `<param>` で `seed` を `tomato` に、`max_crops` を増やすと届きやすい。右下の「時間」を 2 倍にすると作物が早く育つ。

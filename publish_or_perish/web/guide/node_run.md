# hello_node を起動する

## やること

ターミナルで次を実行する。

```bash
ros2 run tutorial_nodes hello_node
```

次のように出て、そのまま止まらなければよい。

```text
[INFO] [1730000000.123456789] [hello_node]: Hello World!
```

ノードが動いている間、画面右上の「あなたのノード」に `hello_node` が出て、クリアになる。止めるときは Ctrl+C を押す。

## コマンドの意味

`ros2 run <パッケージ名> <実行ファイル名>` で、install/ にある実行ファイルを起動する。実行ファイル名は CMakeLists.txt の `ament_auto_add_executable` の 1 つ目に書いた名前。

起動したあと止まらないのは、`rclcpp::spin` がノードを動かし続けているから。別のターミナルで `ros2 node list` を実行すると、農場の `/farm` と並んで `/hello_node` が出る。

## うまくいかないとき

| 出たもの | 原因と直し方 |
|---|---|
| `Package 'tutorial_nodes' not found` | このターミナルで `source ~/src26_ws/install/setup.bash` をしていない。ステージ 2 で .bashrc に書いた行は、**書いた後に開いたターミナル**にだけ効く。新しいターミナルを開くか、手で source する |
| `No executable found` | ビルドしていない、または CMakeLists.txt の実行ファイル名が違う |
| 何も出ずに終わる | `rclcpp::spin` を書き忘れている |
| 出たのに画面に出ない | 農場と `ROS_DOMAIN_ID` が違う。点検の欄に出る |

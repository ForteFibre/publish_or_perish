# トマトを 5 個収穫

## やること

トマトを 5 個収穫する。ステージ 5 の `farmer_node` を動かしたまま `bot1.seed` を `tomato` にしておけば、待つだけで 5 個とれる (トマトは実るまで 50 秒なので 2〜3 分)。

ここでは、作物の選び方も自分のノードに持たせる。`farmer_node` に `seed` パラメータを足し、起動したときに農場の `bot1.seed` をその値に書き換えるようにする。起動は次のようにする。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes farmer_node --ros-args -p seed:=tomato
```

書き換えられたことがターミナルに出て、そのあと植えるものがトマトになればよい。

## 使うもの

| 書き方 | 意味 |
|---|---|
| `declare_parameter("seed", std::string("tomato"))` | 自分のノードに `seed` パラメータを作り、その値を返す。起動時に `-p seed:=...` で渡せばその値、渡さなければ `tomato` |
| `#include <rclcpp/parameter_client.hpp>` | 別のノードのパラメータを扱う Client (`<rclcpp/rclcpp.hpp>` に含まれているので、なくても動く) |
| `std::make_shared<rclcpp::AsyncParametersClient>(this, "/farm")` | `/farm` ノードのパラメータを読み書きする Client を作る |
| `rclcpp::AsyncParametersClient::SharedPtr` | その Client をしまっておく変数の型。メンバ変数にする |
| `wait_for_service(2s)` | 相手のパラメータの service が見つかるまで最大 2 秒待つ |
| `set_parameters({rclcpp::Parameter(名前, 値)}, 関数)` | 書き換えを頼み、返事が来たら関数を呼ぶ |
| `rcl_interfaces::msg::SetParametersResult` | 返事 1 つ分。`successful` (bool) と、断られたときの理由 `reason` |

パラメータの書き換えも、中では service (`/farm/set_parameters`) で行われている。`ros2 service list | grep farm` で見られる。

## ヒント

<details><summary>ヒント 1: どこに何を足すか</summary>

コンストラクタの最後に、次の順で足す。

1. `seed` パラメータを作って、値を受け取る。
2. `/farm` の `AsyncParametersClient` を作り、メンバ変数にしまう (コンストラクタの中の変数にすると、返事が来る前に消える)。
3. `wait_for_service` で待ってから、`bot1.seed` を `set_parameters` で書き換える。返事の関数で、うまくいったかを `RCLCPP_INFO` で出す。

</details>

<details><summary>ヒント 2: 返事を受け取る関数の形</summary>

```cpp
[this](std::shared_future<std::vector<rcl_interfaces::msg::SetParametersResult>> f) {
  const auto & r = f.get().at(0);
  RCLCPP_INFO(get_logger(), "%s", r.successful ? "OK" : r.reason.c_str());
}
```

頼んだパラメータは 1 つなので、返事も 1 つ (`at(0)`)。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **`tomato はまだ解禁していない` と返ってくる:** お店でトマトの種を買う。
- **小麦のまま:** 起動したときに 1 回だけ書き換える。そのあと `ros2 param set` で `wheat` に戻すと小麦になる。
- **何も出ない:** `AsyncParametersClient` をコンストラクタの中の変数にしていると、返事の前に消える。メンバ変数にする。
- **お金が減っていく:** トマトの種は 15 G。植えたものが枯れると損になる。同時に育てる数を減らす。

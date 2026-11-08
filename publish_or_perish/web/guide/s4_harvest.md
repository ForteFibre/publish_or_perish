# トマトを 5 個収穫

## やること

トマトを 5 個収穫する。ステージ 5 の `farmer_node` を動かしたまま `bot1.seed` を `tomato` にしておけば、待つだけで 5 個とれる (トマトは実るまで 50 秒なので 2〜3 分)。

ここでは、作物の選び方も自分のノードに持たせる。`farmer_node` に `seed` パラメータを足し、起動したときに農場の `bot1.seed` をその値に書き換えるようにする。

`farmer_node.cpp` の `#include` に 1 行足す (`<rclcpp/rclcpp.hpp>` に含まれているので、なくても動く)。

```cpp
#include <rclcpp/parameter_client.hpp>
```

コンストラクタの最後 (`timer_ = ...` の下) に足す。

```cpp
    // 起動したとき, 農場の bot1.seed を自分の seed パラメータの値にする
    const std::string seed = declare_parameter("seed", std::string("tomato"));
    const std::string name = "bot1.seed";
    farm_params_ = std::make_shared<rclcpp::AsyncParametersClient>(this, "/farm");
    farm_params_->wait_for_service(2s);
    farm_params_->set_parameters({rclcpp::Parameter(name, seed)},
      [this, name, seed](std::shared_future<std::vector<rcl_interfaces::msg::SetParametersResult>> f) {
        const auto & r = f.get().at(0);
        RCLCPP_INFO(get_logger(), "%s = %s: %s", name.c_str(), seed.c_str(), r.successful ? "OK" : r.reason.c_str());
      });
```

メンバ変数に足す (`rclcpp::TimerBase::SharedPtr timer_;` の下)。

```cpp
  rclcpp::AsyncParametersClient::SharedPtr farm_params_;
```

ビルドして、起動するときに作物を選ぶ。

```bash
cd ~/src26_ws
colcon build --symlink-install --merge-install --packages-select tutorial_nodes
ros2 run tutorial_nodes farmer_node --ros-args -p seed:=tomato
```

ターミナルに `bot1.seed = tomato: OK` と出れば、そのあと植えるものはトマトになる。

## コードの中身

| 部分 | 意味 |
|---|---|
| `declare_parameter("seed", std::string("tomato"))` | 自分のノードに `seed` パラメータを作る。起動時に `-p seed:=...` で渡せばその値、渡さなければ `tomato` |
| `AsyncParametersClient(this, "/farm")` | 別のノード (`/farm`) のパラメータを読み書きする Client |
| `wait_for_service(2s)` | 農場のパラメータの service が見つかるまで最大 2 秒待つ |
| `set_parameters({...}, 関数)` | 書き換えを頼み、返事が来たら関数を呼ぶ。農場が断ったときは `successful` が false で、`reason` に理由が入る |

パラメータの書き換えも、中では service (`/farm/set_parameters`) で行われている。`ros2 service list | grep farm` で見られる。

## うまくいかないとき

- **`bot1.seed = tomato: tomato はまだ解禁していない`:** お店でトマトの種を買う。
- **小麦のまま:** 起動したときに 1 回だけ書き換える。そのあと `ros2 param set` で `wheat` に戻すと小麦になる。
- **お金が減っていく:** トマトの種は 15 G。植えたものが枯れると損になる。`-p max_crops:=6` で同時に育てる数を減らす。

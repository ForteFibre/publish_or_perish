# トマトを植える

## やること

1. 右下の「お店」で「トマトの種」(120 G) を買う。
2. 農場 (`/farm` ノード) のパラメータ `bot1.seed` を `tomato` にする。
3. トマトを 1 つ植える。ステージ 5 の `farmer_node` が動いていれば、次に植えるものからトマトになる。手で植えるなら `ros2 service call /bot1/plant std_srvs/srv/Trigger`。

トマトは 15 G で植えて 70 G で売れる。実るまで 50 秒 (小麦は 30 秒)。

## パラメータとは

ノードが持っている設定の値。topic と違い、送り続けるものではなく、ノードの中に置いてあって、外から読んだり書き換えたりできる。

| コマンド | すること |
|---|---|
| `ros2 param list <ノード名>` | そのノードのパラメータの一覧 |
| `ros2 param get <ノード名> <パラメータ名>` | 今の値を読む |
| `ros2 param set <ノード名> <パラメータ名> <値>` | 値を書き換える |
| `ros2 param dump <ノード名>` | 全部の値を YAML で出す |

`bot1.seed` に使える値は `wheat` (小麦)、`tomato` (トマト)、`pumpkin` (カボチャ) の 3 つ。お店でまだ買っていない作物にすると、農場が断って `Setting parameter failed` と出る。

自分のノードで `declare_parameter` したものも同じように見られる (`ros2 param list /farmer` など)。

## ヒント

<details><summary>ヒント: 書き換えるコマンド</summary>

まず `ros2 param get /farm bot1.seed` で今の値 (`wheat`) を確かめてから、`set` で `tomato` にする。

</details>

## うまくいかないとき

- **`Setting parameter failed: tomato はまだ解禁していない`:** お店でトマトの種を買っていない。
- **`Node not found`:** ノード名は `/farm`。農場が動いているターミナルと `ROS_DOMAIN_ID` が同じか確かめる。
- **お金が 120 G ない:** ステージ 5 の `farmer_node` で小麦を育てて稼ぐ。
- **トマトにならない:** すでに植えてある小麦はそのまま。次に植えるものからトマトになる。

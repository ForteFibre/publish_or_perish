# 2 台目を買う

## やること

右下の「お店」で「2 台目のロボット」(500 G) を買う。買うと畑のマス (1, 2) あたりに bot2 が来る。

bot2 は bot1 と同じ topic と service を、名前の頭を `/bot2` にして持っている。

| bot1 | bot2 |
|---|---|
| `/bot1/cmd_vel` | `/bot2/cmd_vel` |
| `/bot1/pose` | `/bot2/pose` |
| `/bot1/tank` | `/bot2/tank` |
| `/bot1/plant` `/bot1/water` `/bot1/harvest` | `/bot2/plant` `/bot2/water` `/bot2/harvest` |
| パラメータ `/farm` の `bot1.seed` | `bot2.seed` |

`ros2 topic list` で、買ったあとに `/bot2/...` が増えたことを確かめられる。

## 500 G を稼ぐには

`farmer_node` を動かしたままにする。目安は次のとおり。

| 作物 | 1 個のもうけ | 実るまで |
|---|---|---|
| 小麦 | 25 - 5 = 20 G | 30 秒 |
| トマト | 70 - 15 = 55 G | 50 秒 |

畑を広げる (お店の「畑を 1 列広げる」) と同時に育てられる数が増える。広げたら、`farmer_node` が同時に育てる数も増やす (パラメータにしてあれば `-p max_crops:=14` のように起動時に変えられる)。右下の「時間」で作物の時間を 2 倍・4 倍にすると早く貯まる。

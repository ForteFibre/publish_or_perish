# 種をまく

## やること

別のターミナルで次を実行する。

```bash
ros2 service call /bot1/plant std_srvs/srv/Trigger
```

ロボットの足元のマスに小麦の種がまかれ、次のように返事が出ればクリア。種は 1 つ 5 G で、所持金から引かれる。

```output
requester: making request: std_srvs.srv.Trigger_Request()

response:
std_srvs.srv.Trigger_Response(success=True, message='{{msg:srv.plant.done|x=1,y=0,crop=$crop.wheat,cost=5}}')
```

返事の `message` は英語で返る。日本語の訳は、画面の左下のログにも出る。

## コマンドの意味

`ros2 service call` は、service を呼んで返事を待つコマンド。

topic は送りっぱなしで、受け取った側からの返事はない。service は「頼む」と「返事」が 1 組になっている。種まきのように、うまくいったかどうかを知りたい操作は service になっている。

| 部分 | 意味 |
|---|---|
| `/bot1/plant` | 呼ぶ service の名前 |
| `std_srvs/srv/Trigger` | service の型。頼むときに渡すものはなく、返事に `success` (うまくいったか) と `message` (文) が入る |

農場の service は、どれもロボットの足元のマスに対して働く。別のマスに種をまくときは、ステージ 1 の最初の課題と同じように `/bot1/cmd_vel` でロボットを動かしてから呼ぶ。

## うまくいかないとき

- **{{msg:srv.plant.well}} と出る:** 左下のマス (0, 0) は井戸で、種はまけない。ロボットを右へ動かす。
- **{{msg:srv.plant.occupied|x=1,y=0}} と出る:** そのマスにはもう作物がある。ほかのマスへ動かす。
- **{{msg:srv.plant.no_money|crop=$crop.wheat,cost=5}} と出る:** 収穫して稼いでから植える。
- **`waiting for service to become available...` のまま止まる:** 農場が動いていないか、service の名前を打ち間違えている。`ros2 service list` で今ある service が分かる。

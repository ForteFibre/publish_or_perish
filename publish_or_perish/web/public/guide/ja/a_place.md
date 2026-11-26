# 自分のノードだけで共通ゾーン 1 に置く

## やること

`auto_node` を書き足し、サイコロを 6 にしたあと、桜ゾーンでボトルをつかみ、共通ゾーン 1 に置く。全部を自分のノードでやる。

## 説明

段の種類を 2 つ足す。半自動で書いた動きを、そのまま段にする。

| 種類 | 中身 | 次へ進む条件 |
|---|---|---|
| Goto | 点 (x, y, 向き) へ行く | 着いた |
| Arm | アームの伸びとリフトの高さの目標を送る (負の数なら変えない) | `*_now` が目標に着いた |
| Call | service (`grab` `place` `dice` `signal`) を呼ぶ | 返事が来た |
| Dice | 6 になるまで転がす | 目が 6 |

段を作る関数を用意すると、並べるところが短く書ける。

```cpp
static Step go(double x, double y, double th) { return {Step::Goto, x, y, th, ""}; }
static Step arm(double extend, double lift)   { return {Step::Arm, extend, lift, 0, ""}; }
static Step call(std::string name)            { return {Step::Call, 0, 0, 0, name}; }
```

## 位置と段

サイコロのあと:

| 順 | 段 | 理由 |
|---|---|---|
| 1 | arm(0, 0.12) | 縮めて、少し上げて走る |
| 2 | go(-1.3, -2.3, 0) | サイコロの前からエリア 2 へ |
| 3 | go(-2.65, -2.1, π) | 左へ。左を向く |
| 4 | go(-2.65, 1.475, π) | 奥へ。桜ゾーンの手前の 3 段の真ん中の高さまで |
| 5 | arm(-1, 0) | リフトを下ろす |
| 6 | go(-2.78, 1.475, π) | ハンドの真ん中が右の列の上 |
| 7 | call("grab") | 3 本つかむ |
| 8 | arm(-1, 0.12) | 上げる |
| 9 | go(-2.65, 1.475, 0) | 少し下がって右を向く |
| 10 | go(-2.65, -2.1, 0) | 手前へ |
| 11 | go(-0.72, -2.29, 0) | 共通ゾーン 1 の前 |
| 12 | arm(0.42, -1) | 伸ばす |
| 13 | arm(-1, 0) | 下ろす |
| 14 | call("place") | 置く |
| 15 | arm(-1, 0.12) | 上げる |

## 手順

1. `Step` に `Arm` と `Call` を足す (`std::string service` も持たせる)。
2. Arm の段: 入ったときに目標を送り、`/robot/arm/*_now` が目標から 5 mm 以内になったら次へ。
3. Call の段: 入ったときに呼び、返事が来たら次へ。Client は `grab` `place` `dice` `signal` の 4 つ。
4. 上の表の段を並べる。
5. R で戻して起動する。共通ゾーン 1 に置いて「課題クリア」と出れば済み。

## ヒント

<details><summary>ヒント: Client を名前で引く</summary>

```cpp
std::map<std::string, rclcpp::Client<std_srvs::srv::Trigger>::SharedPtr> clients_;
// コンストラクタで
for (std::string name : {"grab", "place", "dice", "signal"}) {
  clients_[name] = create_client<std_srvs::srv::Trigger>("/robot/" + name);
}
// 呼ぶとき
clients_[step.service]->async_send_request(...);
```

</details>

<details><summary>ヒント: 段がいつまでも終わらないとき</summary>

木の枠に引っかかって点に着かないと、そこで止まる。段に入った時刻を覚えておき、15 秒たったら次へ進めると止まらない (ログに出しておくと、どの段で止まったか分かる)。

</details>

ヒントを読んでも動かないときは、書いたコードを持って講師に聞く。

## うまくいかないとき

- **途中で止まる:** `RCLCPP_INFO` で今の段の番号と種類を表示して、どこで止まるかを見る。点に着かないなら、台車がどこかに当たっている (画面で見る)。
- **ボトルが途中で落ちる:** リフトを上げる段 (0.12) が抜けている。
- **「ハンドの前に立っているボトルがない」:** 段 6 の位置。向きが π からずれていると、ハンドの位置もずれる。

# source を .bashrc に書く

## やること

ターミナルで次を実行する。

```bash
echo 'source ~/src26_ws/install/setup.bash' >> ~/.bashrc
```

`~/.bashrc` に source の行が 1 つ増え、その先の `setup.bash` がある (前の課題でビルドしてある) とクリア。足したら、ターミナルをすべて閉じて開き直す。

## source とは

ビルドしたパッケージは `install/` に入るが、そのままでは `ros2` コマンドがそれを見つけられない。`source ~/src26_ws/install/setup.bash` を実行すると、そのターミナルの環境変数に `install/` の場所が足され、`ros2 run tutorial_nodes ...` が使えるようになる。

source の効き目は、実行したターミナルの中だけ。ターミナルを開くたびに実行するのは手間なので、ターミナルを開いたときに自動で実行される `~/.bashrc` に書いておく。

## コマンドの意味

| 部分 | 意味 |
|---|---|
| `echo '...'` | `'` で囲んだ文字をそのまま出す |
| `>> ~/.bashrc` | 出した文字を `~/.bashrc` の最後に足す |

`>>` を `>` と打ち間違えると、`~/.bashrc` の中身が消えて、その 1 行だけになる。ROS 2 そのものの source (`source /opt/ros/jazzy/setup.bash`) の行も消えるので、打つ前に確かめる。

`~/.bashrc` の中は、ROS 2 そのものの source の行が先、ワークスペースの source の行があとになるようにする。上のコマンドは最後に足すので、この順になる。

開き直したターミナルで次を実行し、`tutorial_nodes` が出れば効いている。

```bash
ros2 pkg list | grep tutorial_nodes
```

## うまくいかないとき

点検が、`~/.bashrc` の source の行を調べて欄に出す。

- **「.bashrc に同じ source が 2 回ある」:** 上のコマンドを 2 回実行した。動きは変わらないが、エディタで `~/.bashrc` を開いて片方を消す。
- **「.bashrc の source 先がない」:** パスを打ち間違えている。エディタで `~/.bashrc` を開いて直す。
- **「.bashrc の source が相対パス」:** `~/` を付け忘れている。直した行は、点検の欄に出る。
- **「まだ setup.bash がない」:** まだビルドしていない。前の課題のコマンドでビルドする。

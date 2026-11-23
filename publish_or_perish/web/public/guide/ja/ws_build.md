# ビルドする

## やること

ターミナルで次を実行する。

```bash
cd ~/src26_ws && colcon build --symlink-install --merge-install --packages-select tutorial_nodes
```

最後に次のように出て、ワークスペースに `build/` `install/` `log/` ができればクリア。

```text
Summary: 1 package finished [1.23s]
```

## コマンドの意味

**colcon** は、ワークスペースの中のパッケージをまとめてビルドする道具。必ずワークスペースの直下 (`src` と同じ階層) で実行する。

| 部分 | 意味 |
|---|---|
| `cd ~/src26_ws` | ワークスペースの直下に移る |
| `--symlink-install` | `install/` に、ファイルを写す代わりにリンクを置く。launch ファイルなどを直したとき、ビルドし直さなくても反映される |
| `--merge-install` | `install/` を、パッケージごとに分けずに 1 つにまとめる |
| `--packages-select tutorial_nodes` | `tutorial_nodes` だけをビルドする |

`--symlink-install` と `--merge-install` は、毎回付ける。特に `--merge-install` は、最初のビルドで付けたかどうかで `install/` の形が決まり、あとから付けたり外したりすると colcon がエラーで止まる。

今はまだソースがないので、ビルドしてもできる実行ファイルはない。ステージ 3 でノードを書いたら、同じコマンドでビルドする。

## うまくいかないとき

点検が、次の間違いを見つけて欄に出す。直し方のコマンドも出るので、コピーして実行する。

- **「ワークスペースの直下以外で colcon build した」:** `src` やホームで実行した。そこにできた `build/` などを消して、ワークスペースの直下で実行し直す。
- **「最初のビルドで --merge-install を付け忘れた」:** `build/` `install/` `log/` を消して、上のコマンドでビルドし直す。
- **「--symlink-install を付けずにビルドした」:** 上のコマンドでビルドし直す。
- **`colcon: command not found`:** colcon が入っていない。`sudo apt install python3-colcon-common-extensions` で入れる。

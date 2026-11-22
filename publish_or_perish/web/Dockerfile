# 画面 (web/dist) を作る. ROS の環境に Node を入れずに済むよう, ビルドだけをコンテナの中で行う.
# パッケージのディレクトリ (publish_or_perish/) で実行する. 訳の表のテストが C++ と match_sim.py のソースも読むため
#   docker build -f web/Dockerfile --output type=local,dest=web/dist .
# --output で dist/ の中身だけを手元に取り出すので, ファイルの持ち主は手元の利用者になる.
FROM node:24-slim AS build
WORKDIR /pkg/web
RUN corepack enable
# 依存だけを先に入れ, ソースを変えたときにキャッシュが効くようにする
COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
COPY web/packages/ros/package.json packages/ros/
COPY web/packages/guide/package.json packages/guide/
COPY web/packages/i18n/package.json packages/i18n/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY src ../src
COPY scripts ../scripts
COPY web .
RUN pnpm test && pnpm build

FROM scratch
COPY --from=build /pkg/web/dist /

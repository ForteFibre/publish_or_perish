# 画面 (web/dist) を作る. ROS の環境に Node を入れずに済むよう, ビルドだけをコンテナの中で行う.
#   docker build --output type=local,dest=dist .
# --output で dist/ の中身だけを手元に取り出すので, ファイルの持ち主は手元の利用者になる.
FROM node:24-slim AS build
WORKDIR /web
RUN corepack enable
# 依存だけを先に入れ, ソースを変えたときにキャッシュが効くようにする
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ros/package.json packages/ros/
COPY packages/guide/package.json packages/guide/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
RUN pnpm test && pnpm build

FROM scratch
COPY --from=build /web/dist /

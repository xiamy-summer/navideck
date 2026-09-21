#!/bin/sh
# 在无 Docker 构建能力的环境（如群晖 NAS）里直接运行源码：
# 首次启动自动安装编译依赖与 npm 包并构建，之后直接启动。
set -e
cd /app

if [ ! -d node_modules ]; then
  echo "[nas-nav] 首次启动：安装编译依赖（python3/make/g++）…"
  apt-get update
  apt-get install -y --no-install-recommends python3 make g++ ca-certificates
  rm -rf /var/lib/apt/lists/*
  echo "[nas-nav] 安装 npm 依赖（约 1-3 分钟）…"
  npm install --no-audit --no-fund
fi

if [ ! -d .next/standalone ]; then
  echo "[nas-nav] 构建前端（约 1-2 分钟）…"
  npm run build
fi

echo "[nas-nav] 启动服务…"
npm run start:prod

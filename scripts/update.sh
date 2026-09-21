#!/bin/sh
# 更新 NaviDeck：重新构建并重启（面板内容的增删改无需执行此脚本，直接在网页上编辑即可）
APP_DIR="/Users/summer/WorkBuddy/web导航栏"
NODE_DIR="/Users/summer/.workbuddy/binaries/node/versions/22.22.2-3/bin"

cd "$APP_DIR" || exit 1
export PATH="$NODE_DIR:$PATH"

echo "[1/3] 停止旧进程…"
sh "$APP_DIR/scripts/stop.sh"

echo "[2/3] 重新构建（约 30 秒）…"
DATA_DIR=/tmp/navideck-build npm run build || exit 1

echo "[3/3] 启动…"
sh "$APP_DIR/scripts/start.sh"

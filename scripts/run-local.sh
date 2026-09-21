#!/bin/sh
# NaviDeck 本地常驻启动脚本（供 launchd 调用，不建议手动执行）
set -e

NODE_DIR="/Users/summer/.workbuddy/binaries/node/versions/22.22.2-3/bin"
APP_DIR="/Users/summer/WorkBuddy/web导航栏"

export PATH="$NODE_DIR:$PATH"
cd "$APP_DIR"

# standalone 产物需要 public 与 static 就位（重建后同步一次）
mkdir -p .next/standalone/.next
rm -rf .next/standalone/public .next/standalone/.next/static
cp -R public .next/standalone/
cp -R .next/static .next/standalone/.next/

exec "$NODE_DIR/node" .next/standalone/server.js

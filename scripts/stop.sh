#!/bin/sh
# 停止 NaviDeck
APP_DIR="/Users/summer/WorkBuddy/web导航栏"

if [ -f "$APP_DIR/.navideck.pid" ]; then
  PID=$(cat "$APP_DIR/.navideck.pid")
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID" && echo "已停止 NaviDeck（PID $PID）"
  else
    echo "进程已不存在，清理 PID 文件"
  fi
  rm -f "$APP_DIR/.navideck.pid"
else
  pkill -f "navideck\|standalone/server.js" 2>/dev/null && echo "已停止" || echo "NaviDeck 未在运行"
fi

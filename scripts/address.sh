#!/bin/sh
# 输出当前访问地址
PORT="3100"
IP=$(ipconfig getifaddr en0 2>/dev/null)
[ -z "$IP" ] && IP=$(ipconfig getifaddr en1 2>/dev/null)
[ -z "$IP" ] && IP="127.0.0.1"

if curl -s -o /dev/null --max-time 3 "http://127.0.0.1:$PORT/"; then
  echo "NaviDeck 运行中"
  echo "  本机访问:   http://127.0.0.1:$PORT"
  echo "  局域网访问: http://$IP:$PORT"
else
  echo "NaviDeck 当前未运行，执行 sh scripts/start.sh 启动"
fi

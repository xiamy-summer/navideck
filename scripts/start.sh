#!/bin/sh
# NaviDeck 启动脚本：后台常驻运行，脱离终端，关闭命令行窗口也不受影响
APP_DIR="/Users/summer/WorkBuddy/web导航栏"
NODE_DIR="/Users/summer/.workbuddy/binaries/node/versions/22.22.2-3/bin"
PORT="3100"

cd "$APP_DIR" || exit 1

if [ -f "$APP_DIR/.navideck.pid" ] && kill -0 "$(cat "$APP_DIR/.navideck.pid")" 2>/dev/null; then
  echo "NaviDeck 已在运行，PID $(cat "$APP_DIR/.navideck.pid")"
  sh "$APP_DIR/scripts/address.sh"
  exit 0
fi

# standalone 产物需要 public 和 static 就位
mkdir -p "$APP_DIR/logs" "$APP_DIR/.next/standalone/.next"
rm -rf "$APP_DIR/.next/standalone/public" "$APP_DIR/.next/standalone/.next/static"
cp -R public .next/standalone/
cp -R .next/static .next/standalone/.next/

/usr/bin/python3 - "$APP_DIR" "$NODE_DIR" "$PORT" <<'PY'
import os, sys, subprocess
app, node_dir, port = sys.argv[1], sys.argv[2], sys.argv[3]
env = dict(os.environ)
env.update({
    'NODE_ENV': 'production',
    'DATA_DIR': app + '/.data',
    'PORT': port,
    'HOSTNAME': '0.0.0.0',
    'JWT_SECRET': 'a9150afe1e6d102cdaf7163dda197f412d4a5e347e068dd49417fb74f24a5546',
    'TZ': 'Asia/Shanghai',
    'PATH': node_dir + ':' + env.get('PATH', ''),
})
log = open(app + '/logs/navideck.log', 'a')
p = subprocess.Popen(
    [node_dir + '/node', '.next/standalone/server.js'],
    cwd=app, env=env, stdout=log, stderr=log, start_new_session=True,
)
open(app + '/.navideck.pid', 'w').write(str(p.pid))
print('PID', p.pid)
PY

sleep 3
sh "$APP_DIR/scripts/address.sh"

#!/usr/bin/env python3
"""
生成 NaviDeck 离线图标包 (public/icon-pack/collection.json)。

做法：
- 优先抓取本地 .data/nav.db 里用户真实用过的图标（高相关）。
- 再合并一份精选的种子清单（NAS / 自托管 / 常见品牌 + 常用 UI 图标）。
- 通过 Iconify API 的 `?icons=` 子集查询，按 prefix 分批抓取（2~3 个请求即可），
  把结果直接存成可被 @iconify/react 的 addCollection 消费的 IconifyJSON。

生成的文件是静态资源，构建时随 public/ 一起打进镜像，运行时同源加载，
断网也能渲染已打包的图标；未打包的图标仍走在线 API（CSS mask 兜底）。
"""
import json
import os
import sqlite3
import sys
import urllib.request
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "icon-pack")
OUT_FILE = os.path.join(OUT_DIR, "collection.json")
DB_PATH = os.path.join(ROOT, ".data", "nav.db")
API = "https://api.iconify.design"

# ---- 精选种子（prefix -> 图标名列表），可根据需要增删 ----
SEED = {
    "simple-icons": [
        # 用户真实用过
        "synology", "docker", "jellyfin", "gitea", "alibabadotcom",
        # NAS / 虚拟化 / 网络
        "qnap", "unraid", "truenas", "freenas", "proxmox", "pfsense", "opnsense",
        "openwrt", "kubernetes", "portainer", "podman", "rancher",
        "cloudflare", "nginx", "apache", "caddy", "traefik", "haproxy",
        "wireguard", "tailscale", "zerotier", "pihole", "adguard", "vault",
        # 家庭 / 媒体
        "homeassistant", "nodered", "esphome", "mqtt", "plex", "emby", "kodi",
        "sonarr", "radarr", "lidarr", "readarr", "bazarr", "prowlarr", "jackett",
        "tautulli", "overseerr", "ombi", "jellyseerr", "transmission", "qbittorrent",
        "deluge", "sabnzbd", "nzbget", "navidrome", "audiobookshelf", "immich",
        "photoprism", "organizr", "heimdall", "dashy", "homarr", "flame", "homepage",
        # 监控 / 工具
        "grafana", "prometheus", "influxdb", "loki", "netdata", "uptimekuma",
        "gotify", "ntfy", "freshrss", "miniflux", "mealie", "grocy", "paperless",
        "wiki", "bookstack", "forgejo", "jenkins", "sonarqube", "authentik",
        "authelia", "keycloak", "filebrowser", "speedtest", "n8n",
        # 通用品牌
        "github", "gitlab", "bitbucket", "google", "microsoft", "apple", "amazon",
        "mongodb", "postgresql", "redis", "mariadb", "mysql", "sqlite",
        "elasticsearch", "rabbitmq", "kafka", "discord", "telegram", "slack",
        "matrix", "mastodon", "protonmail", "signal", "tutanota", "spotify",
        "netflix", "youtube", "twitch", "steam", "oracle", "digitalocean",
        "linode", "vultr", "hetzner", "rss",
    ],
    "mdi": [
        # 用户真实用过
        "code-braces", "download-network-outline", "movie-open-outline",
        "router-wireless", "star-outline",
        # 常用 UI
        "home", "home-outline", "cog", "cog-outline", "settings", "search",
        "web", "globe", "server", "server-network", "server-network-outline",
        "database", "database-outline", "folder", "folder-network", "folder-open",
        "file", "file-document", "file-document-outline", "cloud", "cloud-outline",
        "wifi", "wifi-off", "network", "network-outline", "monitor", "monitor-dashboard",
        "monitor-multiple", "chart-line", "chart-areaspline", "chart-bar", "bell",
        "bell-outline", "plus", "plus-circle", "plus-circle-outline", "pencil",
        "pencil-outline", "trash-can", "trash-can-outline", "delete", "dots-vertical",
        "dots-horizontal", "menu", "eye", "eye-off", "refresh", "refresh-circle",
        "download", "upload", "share", "share-variant", "link", "link-variant",
        "film", "music", "music-note", "book", "book-open", "image", "image-outline",
        "camera", "camera-outline", "gamepad", "gamepad-variant", "cart", "cart-outline",
        "email", "email-outline", "phone", "phone-outline", "map-marker", "calendar",
        "clock", "clock-outline", "weather", "weather-partly-cloudy", "power",
        "power-standby", "tools", "tools-screwdriver", "information", "information-outline",
        "help-circle", "help-circle-outline", "check", "check-circle", "check-circle-outline",
        "close", "close-circle", "chevron-down", "chevron-right", "chevron-left",
        "shield", "shield-outline", "shield-lock", "shield-check", "key", "key-outline",
        "key-variant", "account", "account-outline", "account-group", "account-cog",
        "account-multiple", "lock", "lock-outline", "lock-open", "logout", "logout-variant",
        "login", "login-variant", "cpu", "memory", "harddisk", "harddisk-outline",
        "fan", "thermometer", "thermometer-outline", "swap-horizontal", "alert",
        "alert-outline", "alert-circle", "wrench", "wrench-outline", "compass",
        "earth", "bookmark", "bookmark-outline", "tag", "tag-outline", "tag-multiple",
        "archive", "backup-restore", "content-save", "content-save-outline",
        "content-copy", "cellphone", "cellphone-outline", "tablet", "laptop",
        "laptop-outline", "desktop-mac", "television", "printer", "volume-high",
        "volume-off", "play", "pause", "stop", "restart", "rocket-launch",
        "rocket-launch-outline", "bug", "bug-outline", "view-dashboard",
        "view-dashboard-outline", "console", "console-line", "console-network",
        "code-tags", "code-tags-check", "lan", "ip-network", "ip-network-outline",
        "source-branch", "source-commit", "source-pull", "magnify", "magnify-plus",
        "progress-download", "cloud-sync", "cloud-check", "bell-ring", "bell-ring-outline",
        "chart-line-variant", "server-security", "key-chain", "file-cog", "folder-cog",
        "cog-transfer", "plus-box", "minus-box", "star", "heart", "heart-outline",
        "thumb-up", "thumb-down",
    ],
    "lucide": [
        "home", "settings", "search", "server", "database", "folder", "file",
        "cloud", "wifi", "monitor", "bell", "plus", "pencil", "trash-2", "menu",
        "eye", "eye-off", "refresh-cw", "download", "upload", "share-2", "link",
        "film", "music", "book", "image", "camera", "gamepad-2", "shopping-cart",
        "mail", "phone", "map-pin", "calendar", "clock", "power", "wrench",
        "info", "help-circle", "check", "x", "chevron-down", "chevron-right",
        "shield", "shield-check", "key", "user", "users", "lock", "log-out",
        "log-in", "cpu", "memory-stick", "hard-drive", "fan", "thermometer",
        "alert-triangle", "rocket", "bug", "layout-dashboard", "code", "globe",
        "bookmark", "tag", "archive", "save", "copy", "smartphone", "tablet",
        "laptop", "monitor-speaker", "tv", "printer", "volume-2", "play",
        "pause", "square", "rotate-cw", "cloud-sync", "bell-ring", "activity",
        "server-cog", "folder-cog", "file-cog", "plus-circle", "minus-circle",
        "star", "heart", "thumbs-up",
    ],
}


def harvest_db_icons():
    if not os.path.exists(DB_PATH):
        return {}
    found = {}
    try:
        con = sqlite3.connect(DB_PATH)
        for tbl in ("groups", "items"):
            try:
                rows = con.execute(
                    f"SELECT icon FROM {tbl} WHERE icon IS NOT NULL AND icon != ''"
                ).fetchall()
            except sqlite3.OperationalError:
                continue
            for (val,) in rows:
                if ":" not in val:
                    continue
                prefix, name = val.split(":", 1)
                found.setdefault(prefix, set()).add(name)
    except Exception as e:
        print(f"[warn] 读取 nav.db 失败: {e}", file=sys.stderr)
    return found


def fetch_prefix(prefix, names):
    names = sorted(set(names))
    if not names:
        return None
    url = f"{API}/{prefix}.json?icons=" + urllib.parse.quote(",".join(names))
    req = urllib.request.Request(url, headers={"User-Agent": "navideck-icon-pack"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    # 只保留确有返回的图标
    got = list(data.get("icons", {}).keys())
    print(f"  {prefix}: 请求 {len(names)} 个，命中 {len(got)} 个")
    return data


def main():
    # 合并 DB 真实图标与种子
    merged = {p: set(v) for p, v in SEED.items()}
    db_icons = harvest_db_icons()
    for p, names in db_icons.items():
        merged.setdefault(p, set()).update(names)

    os.makedirs(OUT_DIR, exist_ok=True)
    collections = {}
    total = 0
    for prefix, names in merged.items():
        print(f"抓取集合 [{prefix}] ...")
        data = fetch_prefix(prefix, names)
        if data and data.get("icons"):
            collections[prefix] = data
            total += len(data["icons"])

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(collections, f, ensure_ascii=False, separators=(",", ":"))

    size = os.path.getsize(OUT_FILE)
    print(f"\n完成：{OUT_FILE}")
    print(f"  集合数: {len(collections)}，图标总数: {total}，文件大小: {size/1024:.1f} KB")


if __name__ == "__main__":
    main()

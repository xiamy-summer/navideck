# NaviDeck 轻航面板

轻量自托管导航首页，可作为 NAS / 服务器导航面板、浏览器起始页与简易 Docker 管理器。
单进程、SQLite 单文件存储，无需外部数据库，支持 amd64 / arm64 多架构部署。

## 已实现功能（第一批）

| 分类 | 能力 |
| --- | --- |
| 导航 | 分组 + 站点两级结构、卡片网格、拖拽排序（卡片组内/跨组、分组整体） |
| 图标 | Iconify 全量图标库（20 万+），搜索选择或直接填写 `mdi:server`；离线自动降级为首字占位 |
| 内外网 | 顶部一键切换内/外网模式，站点分别配置内网地址与外网地址，切换状态持久化 |
| 打开方式 | 新标签页 / 内置小窗口（iframe）/ 当前标签页，可逐站点配置 |
| 搜索 | 可开关，支持自定义搜索引擎（百度/Bing/Google/DuckDuckGo 可增删改），背景色、文字色、圆角、宽度可调，输入时联动本地站点快捷跳转 |
| 外观 | 亮/暗/跟随系统、主题色、背景图、每行卡片数、卡片圆角与不透明度、图标尺寸、是否显示描述 |
| 自定义 | 自定义 CSS、自定义 JS、自定义页脚（支持 HTML） |
| 账号 | 多账号数据隔离、管理员/普通用户/访客三种角色、访客只读浏览、管理员可代管任意账号配置 |
| 数据 | 配置导出/导入（合并或覆盖）、恢复默认设置 |
| 文件 | 上传文件池，按内容哈希去重，重复上传不占额外空间，可复制链接引用 |
| Docker | 容器列表与状态、启动/停止/重启、日志查看（需挂载 `docker.sock`，仅管理员可操作） |
| 小组件 | 首页系统概览与容器概览卡片，可开关、可放顶部或底部、刷新间隔可调；另含扩展小部件：时钟、天气（Open-Meteo 免 Key）、RSS 订阅、Markdown 便签 |
| 监控 | CPU / 内存 / 磁盘 / 网络速率实时图表，5 秒采样，保留最近 10 分钟 |
| 部署 | 多架构 Docker 镜像、docker-compose、standalone 运行，首屏 JS 约 130 KB |

## 规划中

- 容器创建 / 镜像管理 / 实时日志跟随
- 站点健康检查（探测链接可访问性并在卡片上标记）
- 自定义图标上传 / Emoji 图标、背景图与主题预设
- 监控历史持久化 + 告警、分组共享 / 公共分组、操作审计日志、2FA

## OIDC 单点登录（可选）

支持任意标准 OIDC 身份提供商（Authelia / Authentik / Keycloak / Zitadel / Google / Entra ID 等），
采用授权码 + PKCE 流程，ID Token 经 JWKS 验证。启用后登录页出现「单点登录」按钮，与账号密码登录并存；
首次通过 OIDC 登录会自动建档（默认角色 `user`，可由 `OIDC_DEFAULT_ROLE` 调整）。

### 推荐：在界面里配置

管理员进入「设置中心 → 单点登录」，把右上角目标切换为**全局**，然后填写 Issuer、Client ID、Client Secret 等，保存后立即生效。页面会直接给出需要填入 IdP 的回调地址；`Client Secret` 只保存、不回显。

### 也可以：用环境变量（界面留空时自动回落）

在 `docker-compose.yml` 或 `.env` 中配置：

| 变量 | 说明 |
| --- | --- |
| `OIDC_ENABLED` | 设为 `true` 启用 |
| `OIDC_ISSUER` | 签发方地址，自动拼接 `/.well-known/openid-configuration` |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | 在 IdP 注册的客户端凭据 |
| `OIDC_REDIRECT_URI` | 回调地址，默认按请求域名自动推断；建议显式填写为 `https://<你的域名>/api/auth/oidc/callback` |
| `OIDC_SCOPES` | 授权范围，默认 `openid email profile` |
| `OIDC_DEFAULT_ROLE` | 自动建档默认角色（`user` / `admin`） |
| `OIDC_ADMIN_CLAIM` / `OIDC_ADMIN_VALUE` | 可选：当某 claim 的值等于指定值时授予 `admin`（如 `groups` / `admin`） |
| `OIDC_BUTTON_LABEL` | 登录页按钮文案 |

> 在 IdP 侧登记客户端时，回调地址（Redirect URI）必须填 `https://<你的域名>/api/auth/oidc/callback`，且客户端类型需允许授权码流。

## 快速开始

### Docker Compose（推荐）

```bash
docker compose up -d
# 访问 http://<主机IP>:3000
```

首次启动会自动创建管理员账号，密码取自环境变量 `DEFAULT_ADMIN_PASSWORD`（默认 `admin123`），
并创建只读的 `guest` 访客账号。登录后请立即修改密码。

### 本地长期运行（macOS / Linux，最简单）

```bash
sh scripts/start.sh     # 后台常驻启动，关闭终端也不受影响
sh scripts/stop.sh      # 停止
sh scripts/update.sh    # 改了代码后：重新构建并重启
sh scripts/address.sh   # 查看当前访问地址
```

启动后终端会打印访问地址，形如 `http://192.168.3.81:3100`，同一局域网内的手机、平板、另一台电脑都能直接打开。
数据保存在项目目录的 `.data/`，面板里增删改的内容实时写库，**不需要重启**。

想开机自启，把 `scripts/com.navideck.plist` 复制到 `~/Library/LaunchAgents/` 后执行：

```bash
launchctl load -w ~/Library/LaunchAgents/com.navideck.plist
```

### 群晖 NAS 部署（本机没有 Docker 时）

群晖只能拉现成镜像，不能用 Dockerfile 构建，因此提供两条路线：

- **路线 A（推荐）**：代码推到 GitHub，Actions 自动构建 amd64/arm64 镜像推送到 GHCR，群晖直接拉取
- **路线 B**：不构建镜像，用 `node:22` 容器跑源码，首次启动自动安装依赖并构建

完整图文步骤见 [docs/synology.md](docs/synology.md)，配置文件：
`docker-compose.nas.yml`、`scripts/start-nas.sh`、`.github/workflows/docker-build.yml`。

### 手动构建镜像

```bash
# 单架构
docker build -t nas-nav:latest .

# 多架构（amd64 + arm64）
docker buildx build --platform linux/amd64,linux/arm64 -t yourname/nas-nav:latest --push .
```

### 本地开发

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm run start   # 非 standalone 预览用；生产请用 .next/standalone
```

> 注意：`output: standalone` 模式下 `next start` 不可用，生产运行请用
> `node .next/standalone/server.js`（Docker 镜像中即为此方式）。

### 生产直接运行（非 Docker）

```bash
npm run build
cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
DATA_DIR=/var/lib/nas-nav JWT_SECRET=随机字符串 node .next/standalone/server.js
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATA_DIR` | `.data` | SQLite 数据库与上传文件目录，Docker 中为 `/data` |
| `JWT_SECRET` | 内置开发密钥 | 登录会话签名密钥，**生产必须修改** |
| `DEFAULT_ADMIN_PASSWORD` | `admin123` | 首次启动创建 `admin` 的初始密码 |
| `NEXT_PUBLIC_ICONIFY_API` | `https://api.iconify.design` | 图标在线服务地址（离线包未覆盖的图标才走这里） |
| `PORT` | `3000` | 监听端口 |

## 目录结构

```
src/
├── app/
│   ├── page.tsx                 导航首页（服务端取数）
│   ├── login/                   登录页
│   ├── settings/                设置中心
│   └── api/                     REST 接口（auth/groups/items/settings/users/export/import/upload/files）
├── components/
│   ├── HomeView.tsx             首页状态与交互中枢
│   ├── NavBoard.tsx             拖拽排序核心（dnd-kit 多容器）
│   ├── SearchBar.tsx            搜索框与搜索引擎切换
│   ├── Icon.tsx / IconPicker.tsx Iconify 图标渲染（离线包优先）与选择器
│   ├── WebModal.tsx             内置小窗口
│   ├── Dialogs.tsx              站点/分组编辑与确认弹窗
│   └── SettingsPanel.tsx        设置中心（外观/搜索/自定义/数据/账号/关于）
└── lib/
    ├── db.ts                    SQLite 数据访问与表结构
    ├── auth.ts                  scrypt 密码哈希 + JWT Cookie 会话
    ├── api.ts                   接口鉴权与目标用户解析
    ├── bootstrap.ts             首次启动初始化
    └── types.ts                 类型与默认配置
```

## 数据结构

SQLite 表：`users`、`groups`、`items`、`settings`、`files`。
每组数据都带 `userId`，登录用户只能读写自己的数据；管理员可通过 `?as=<userId>` 代管其他账号
（包括访客账号）的内容，从而实现"管理员替访客配置导航页"。

## 常见问题

**图标不显示？**
图标默认优先使用**内置离线包**（`public/icon-pack/collection.json`，随镜像同源发布，包含常用 NAS / 自托管 / 品牌与 UI 图标约 365 个），断网也能渲染；
离线包未覆盖的图标才走 `NEXT_PUBLIC_ICONIFY_API` 在线加载；都失败则自动降级为文字首字占位，不影响使用。
如需扩充离线包，编辑 `scripts/build-icon-pack.py` 的种子清单后运行 `python3 scripts/build-icon-pack.py` 重新生成并提交即可。

**内置小窗口打不开某些站点？**
部分站点设置了 `X-Frame-Options` / CSP 拒绝被嵌入，此时弹窗会提示改用新标签页打开，
建议把这类站点配置为"新标签页"打开方式。

**数据如何备份？**
直接备份 `DATA_DIR` 目录（含 `nav.db` 与 `uploads/`），或在设置中心"数据与文件"中导出 JSON。

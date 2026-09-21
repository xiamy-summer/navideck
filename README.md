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
| 部署 | 多架构 Docker 镜像、docker-compose、standalone 运行，首屏 JS 约 127 KB |

## 规划中（第二批）

- Docker 容器管理：状态查看、启动/停止/重启、日志，以及类似 Homepage 的信息小组件
- 系统监控小组件：CPU、内存、磁盘、网络实时图表
- 多语言（i18n）界面
- 图标离线包与自定义上传图标

## 快速开始

### Docker Compose（推荐）

```bash
docker compose up -d
# 访问 http://<主机IP>:3000
```

首次启动会自动创建管理员账号，密码取自环境变量 `DEFAULT_ADMIN_PASSWORD`（默认 `admin123`），
并创建只读的 `guest` 访客账号。登录后请立即修改密码。

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
| `NEXT_PUBLIC_ICONIFY_API` | `https://api.iconify.design` | 图标服务地址，可替换为自建或镜像 |
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
│   ├── Icon.tsx / IconPicker.tsx Iconify 图标渲染与选择器
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
图标通过 Iconify 在线接口加载，若 NAS 无外网或访问缓慢，可将 `NEXT_PUBLIC_ICONIFY_API`
指向自建 Iconify API 服务；无网络时会自动降级为文字首字占位，不影响使用。

**内置小窗口打不开某些站点？**
部分站点设置了 `X-Frame-Options` / CSP 拒绝被嵌入，此时弹窗会提示改用新标签页打开，
建议把这类站点配置为"新标签页"打开方式。

**数据如何备份？**
直接备份 `DATA_DIR` 目录（含 `nav.db` 与 `uploads/`），或在设置中心"数据与文件"中导出 JSON。

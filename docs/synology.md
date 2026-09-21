# 群晖 NAS 部署指南

群晖的 Container Manager / Docker 套件**只能拉取现成镜像，不能用 Dockerfile 构建**。
所以本机没有 Docker 时，镜像来源有两条路，二选一即可。

---

## 路线 A：GitHub 自动构建多架构镜像（推荐，长期最省事）

原理：把代码推到 GitHub，GitHub Actions 自动构建 amd64 + arm64 镜像并推送到
`ghcr.io/<你的用户名>/<仓库名>:latest`，群晖直接拉取，之后更新只需 `git push`。

### 0. 补上自动构建工作流（一次性，30 秒）

仓库源码已就位，只差 `.github/workflows/docker-build.yml` 这个文件。
点下面的链接，GitHub 会打开"新建文件"页面，**路径和内容都已填好**，直接点右下角
**Commit changes** 即可触发构建：

[一键创建 workflow 文件](https://github.com/xiamy-summer/navideck/new/main?filename=.github/workflows/docker-build.yml&value=name%3A%20Build%20multi-arch%20image%0A%0Aon%3A%0A%20%20push%3A%0A%20%20%20%20branches%3A%20%5Bmain%5D%0A%20%20%20%20tags%3A%20%5B%22v%2A%22%5D%0A%20%20workflow_dispatch%3A%0A%0Ajobs%3A%0A%20%20build%3A%0A%20%20%20%20runs-on%3A%20ubuntu-latest%0A%20%20%20%20permissions%3A%0A%20%20%20%20%20%20contents%3A%20read%0A%20%20%20%20%20%20packages%3A%20write%0A%20%20%20%20steps%3A%0A%20%20%20%20%20%20-%20name%3A%20Checkout%0A%20%20%20%20%20%20%20%20uses%3A%20actions/checkout%40v4%0A%0A%20%20%20%20%20%20-%20name%3A%20Set%20up%20QEMU%0A%20%20%20%20%20%20%20%20uses%3A%20docker/setup-qemu-action%40v3%0A%0A%20%20%20%20%20%20-%20name%3A%20Set%20up%20Buildx%0A%20%20%20%20%20%20%20%20uses%3A%20docker/setup-buildx-action%40v3%0A%0A%20%20%20%20%20%20-%20name%3A%20Login%20to%20GHCR%0A%20%20%20%20%20%20%20%20uses%3A%20docker/login-action%40v3%0A%20%20%20%20%20%20%20%20with%3A%0A%20%20%20%20%20%20%20%20%20%20registry%3A%20ghcr.io%0A%20%20%20%20%20%20%20%20%20%20username%3A%20%24%7B%7B%20github.actor%20%7D%7D%0A%20%20%20%20%20%20%20%20%20%20password%3A%20%24%7B%7B%20secrets.GITHUB_TOKEN%20%7D%7D%0A%0A%20%20%20%20%20%20-%20name%3A%20Build%20and%20push%0A%20%20%20%20%20%20%20%20uses%3A%20docker/build-push-action%40v6%0A%20%20%20%20%20%20%20%20with%3A%0A%20%20%20%20%20%20%20%20%20%20context%3A%20.%0A%20%20%20%20%20%20%20%20%20%20platforms%3A%20linux/amd64%2Clinux/arm64%0A%20%20%20%20%20%20%20%20%20%20push%3A%20true%0A%20%20%20%20%20%20%20%20%20%20cache-from%3A%20type%3Dgha%0A%20%20%20%20%20%20%20%20%20%20cache-to%3A%20type%3Dgha%2Cmode%3Dmax%0A%20%20%20%20%20%20%20%20%20%20tags%3A%20%7C%0A%20%20%20%20%20%20%20%20%20%20%20%20ghcr.io/%24%7B%7B%20github.repository%20%7D%7D%3Alatest%0A%20%20%20%20%20%20%20%20%20%20%20%20ghcr.io/%24%7B%7B%20github.repository%20%7D%7D%3A%24%7B%7B%20github.sha%20%7D%7D%0A)

提交后打开仓库 **Actions** 页，`Build multi-arch image` 会自动运行，首次约 5-10 分钟。

### 1. 推送代码到 GitHub（链接失效时用这个）

```bash
cd /Users/summer/WorkBuddy/web导航栏
git init
git add .
git commit -m "NAS 导航面板"
git branch -M main
git remote add origin https://github.com/<你的用户名>/navideck.git
git push -u origin main
```

推送后打开仓库的 **Actions** 页，等待 `Build multi-arch image` 跑完（首次约 5-10 分钟）。

### 2. 设置镜像包为公开（否则群晖拉取要登录）

GitHub 仓库页面 → 右侧 **Packages** → 点 `nas-nav` → **Package settings** →
**Danger Zone** → **Change visibility** → Public。

### 3. 用 docker-compose 部署（推荐）

镜像就绪后，群晖上用 compose 最省事。仓库里已准备好 `docker-compose.ghcr.yml`：

```yaml
services:
  navideck:
    image: ghcr.io/xiamy-summer/navideck:latest
    container_name: navideck
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - /volume1/docker/navideck/data:/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      TZ: Asia/Shanghai
      DATA_DIR: /data
      PORT: "3000"
      JWT_SECRET: please-change-this-secret
      DEFAULT_ADMIN_PASSWORD: admin123
      NEXT_PUBLIC_ICONIFY_API: https://api.iconify.design
```

**DSM 7（Container Manager）**

Container Manager → **项目** → **新增** → 项目名 `navideck` → 路径选 `docker/navideck`
→ 选择"**使用现有的 docker-compose.yml**"，把上面内容粘贴进去 → 下一步 → 完成。
Container Manager 会自动拉取镜像并启动容器。

**DSM 6（Docker 套件，无"项目"功能）**

把文件通过 File Station 放到 `docker/navideck/docker-compose.yml`，然后 SSH 登录群晖执行：

```bash
cd /volume1/docker/navideck
sudo docker-compose up -d
```

> 镜像若是私有的，先在 Container Manager → **设置** → **添加注册表** 里填
> `ghcr.io` + 你的 GitHub 用户名 + Personal Access Token；按上一步设为公开则无需登录。

### 4. 手动创建容器（不用 compose 时）

DSM 7（Container Manager）：

1. 套件中心安装 **Container Manager**
2. Container Manager → **映像** → **新增** → **从 URL 添加**
   - 映像 URL 填：`ghcr.io/<你的用户名>/navideck:latest`
3. 下载完成后选中该映像 → **运行**
4. 网络：使用默认 bridge（或勾选"使用与 Docker Host 相同的网络"，此时不需要端口映射）
5. 端口设置：容器端口 `3000` → 本地端口 `3000`（host 网络模式跳过此步）
6. 存储空间 → 添加文件夹：
   - NAS 路径 `docker/nas-nav/data` → 装载路径 `/data`（数据库与上传文件）
   - 若要用内置 Docker 管理，再加一条：`/var/run/docker.sock` → `/var/run/docker.sock`（只读）
7. 环境 → 添加变量：
   - `DATA_DIR` = `/data`
   - `JWT_SECRET` = 一长串随机字符串
   - `DEFAULT_ADMIN_PASSWORD` = 你想用的管理员初始密码
   - `TZ` = `Asia/Shanghai`
8. 勾选"启用自动重新启动" → 完成

DSM 6（Docker 套件）：步骤相同，入口为 **Docker → 映像 → 添加 → 从 URL 添加**，
启动容器在 **映像 → 启动 → 高级设置** 里配置端口/卷/环境变量。

访问：`http://<群晖IP>:3000`

### 3b. 用 docker-compose 部署（推荐，以后升级最省事）

容器多了以后，用 compose 比手点界面好管理。仓库里的 `docker-compose.ghcr.yml` 就是给路线 A 准备的：

```yaml
services:
  navideck:
    image: ghcr.io/xiamy-summer/navideck:latest
    container_name: navideck
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - /volume1/docker/navideck/data:/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      TZ: Asia/Shanghai
      DATA_DIR: /data
      PORT: "3000"
      JWT_SECRET: please-change-this-secret
      DEFAULT_ADMIN_PASSWORD: admin123
      NEXT_PUBLIC_ICONIFY_API: https://api.iconify.design
```

群晖 DSM 7（Container Manager）：

1. **项目 → 新增**，项目名填 `navideck`，路径选一个共享文件夹（如 `docker/navideck`）
2. 来源选"**创建 docker-compose.yml**"，把上面内容粘贴进去；
   或者先用 File Station 把 `docker-compose.ghcr.yml` 传到 `docker/navideck/`，再选"**使用现有的 docker-compose.yml**"
3. 把卷路径 `/volume1/docker/navideck/data` 改成你 NAS 的实际路径（群晖的共享文件夹都在 `/volume1/` 下）
4. 下一步 → 完成，Container Manager 自动拉镜像并启动

> DSM 6 的 Docker 套件没有"项目"功能，只能按第 3-8 步手动创建容器。

**以后升级**：项目 → 停止 → 重新拉取镜像（`docker compose pull` 或删掉项目重建），
数据都在 `data` 目录里，不会丢。

---

## 路线 B：不构建镜像，直接用 node 容器跑源码（立即可用，不用 GitHub）

适合不想折腾 GitHub 的情况。原理：在群晖上跑 `node:22` 官方镜像，容器首次启动时
自动 `npm install && npm run build`，之后常驻运行。

### 1. 准备源码

把项目打成压缩包（已排除 `node_modules`、`.next`、`.data`）：

```bash
cd /Users/summer/WorkBuddy/web导航栏
zip -r navideck-src.zip . -x "node_modules/*" ".next/*" ".data/*" ".git/*" ".workbuddy/*"
```

> 如果直接用本项目里已经生成好的 `navideck-src.zip`，可跳过这步。

### 2. 上传到 NAS 并解压

File Station → 进入 `docker/nas-nav/`（没有就新建）→ 上传 `navideck-src.zip` →
右键 **解压到当前文件夹**。最终路径应为：

```
/volume1/docker/nas-nav/app/package.json
/volume1/docker/nas-nav/app/src/
/volume1/docker/nas-nav/app/scripts/start-nas.sh
...
```

### 3. 创建容器

**DSM 7 有 compose 的情况（推荐）**

Container Manager → **项目** → **新增** → 项目名 `navideck` → 路径选 `docker/nas-nav` →
选择"**使用现有的 docker-compose.yml**"，把 `docker-compose.nas.yml` 内容粘贴进去
（注意把 `/volume1/docker/nas-nav/app` 改成你的实际路径）→ 下一步 → 完成。

容器日志里会看到"首次启动：安装编译依赖…"，首次约 3-8 分钟，之后重启只需几秒。

**没有 compose 的情况（DSM 6 或手动创建）**

Container Manager → 映像 → 新增 → 从 URL 添加 → 填 `node:22-bookworm-slim` → 下载后运行，
配置与路线 A 第 4-8 步相同，但要多设两项：

- 存储空间额外加一条：NAS 路径 `docker/nas-nav/app` → 装载路径 `/app`
- **执行命令**（高级设置 → 命令）：`sh /app/scripts/start-nas.sh`

### 环境变量（两种方式都要配）

| 变量 | 值 |
| --- | --- |
| `DATA_DIR` | `/data` |
| `PORT` | `3000` |
| `JWT_SECRET` | 随机字符串，务必修改 |
| `DEFAULT_ADMIN_PASSWORD` | 管理员初始密码 |
| `TZ` | `Asia/Shanghai` |

---

## 访问与常见问题

**访问地址**：`http://<群晖IP>:3000`
默认管理员 `admin`，密码为 `DEFAULT_ADMIN_PASSWORD`（默认 `admin123`），登录后请立即改密码。

**打不开页面，按顺序排查**

1. 容器是否在运行：Container Manager → 容器，状态应为"运行中"；若反复重启，看**日志**里的报错。
2. 端口映射是否存在：容器详情 → 端口设置，本地端口 `3000` → 容器端口 `3000`。
3. 群晖防火墙：控制面板 → 安全性 → 防火墙，确认未拦截 3000（同一局域网一般不受影响）。
4. 用host网络模式时不需要映射端口，直接用 3000 访问；同时确认群晖上没有其他服务占用 3000
   （DSM 的 Web Station 占用 80/443，不冲突）。
5. 首次启动卡住不动：多半是 `npm install` 在编译 better-sqlite3，耐心等 5-10 分钟，
   或检查 NAS 能否访问外网（apt / npm 源）。

**确认 NAS 架构**（影响是否拉得到镜像）

SSH 登录群晖后执行 `uname -m`：

- `x86_64` → amd64，两条路线都支持
- `aarch64` → arm64，两条路线都支持
- `armv7l` → 老款 ARM 机型（如 DS120j / DS218j），路线 A 需要你在 workflow 的
  `platforms` 里加 `linux/arm/v7`，路线 B 需在容器里编译，内存较小的机型可能失败

**升级**

- 路线 A：`git push` 后 Actions 重新构建，群晖 Container Manager → 映像 → 重新下载 latest，重启容器。
- 路线 B：上传新代码覆盖 `/app/src` 等文件，删除 `.next` 目录后重启容器，会触发重新构建。

**备份**

只需备份数据目录（路线 A/B 都是 `docker/nas-nav/data`），里面有 `nav.db` 与 `uploads/`。
也可在面板"设置中心 → 数据与文件"里导出 JSON。

**想用域名访问 / HTTPS**

控制面板 → 登录门户 → 高级 → 反向代理服务器，新增规则：
来源 `https://nav.你的域名` → 目的地 `http://localhost:3000`，证书用群晖自带的 Let's Encrypt。

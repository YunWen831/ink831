# YunWen 网站维护与部署

## 固定入口

| 项目 | 地址或约定 |
| --- | --- |
| 正式网站 | <https://ink831.dpdns.org/> |
| 源码仓库 | <https://github.com/YunWen831/ink831> |
| 生产分支和发布目录 | `main`，仓库 `/` 根目录 |
| Pages 设置 | <https://github.com/YunWen831/ink831/settings/pages> |
| 发布记录 | <https://github.com/YunWen831/ink831/actions> |
| 默认 GitHub 地址 | <https://yunwen831.github.io/ink831/>，目前跳转到正式域名 |
| 本机维护副本 | `D:\playground\ink831`；其他工作区先核对远端、分支和未提交改动 |

静态站使用原生 HTML/CSS/JavaScript，无根目录 npm 构建步骤。Python 3.10+ 和 Git 即可运行维护脚本；子项目的依赖另读各自文档。

## 改哪里

| 想做的修改 | 主要位置 |
| --- | --- |
| 首页文字、布局、分类静态入口 | `index.html` |
| 首页分类数据 | `assets/catalog.js` |
| 软件/游戏卡片数据 | `assets/projects.js` |
| 共用样式与卡片渲染 | `assets/home.css`、`assets/portal.css`、`assets/home.js` |
| 软件/游戏/工具目录 | `software/index.html`、`games/index.html`、`tools/index.html` |
| Y课表下载页和发布包 | `software/y-timetable/`，包与校验在 `downloads/` |
| Y课表安卓源码与构建说明 | `app-source/y-timetable/`；先读其 `AGENTS.md` 和 `README.md` |
| 词间：英语与化学单词练习 | `tools/word-study/`；进度和自定义词表保存在浏览器本地，可导出备份 |
| 棱 PRISM：光色穿行 | `prism/`；规则、关卡、渲染和自测见 `prism/README.md` |
| 回声 ECHO：声呐潜行 | `echo/`；关卡、自测见 `echo/README.md` |
| 在学校乱逛 | `campus/` |
| 地牢来信前端与 Pages 入口 | `courtyard/`；配置见 `courtyard/config.json` |
| 地牢来信服务端与腾讯云部署 | `app-source/dungeon-mail/`；先读该目录 `README.md` 的存档与部署章节 |

新增软件/游戏：创建项目页，更新 `assets/projects.js`，并维护相应目录页的静态备用入口。新增工具：创建 `tools/<名称>/index.html`，更新 `tools/index.html`；工具列表目前未使用 `assets/projects.js`。新增顶级分类才需要改 `assets/catalog.js` 和首页静态入口。

`assets/home.js` 以自身脚本位置计算站点根目录，数据中的相对路径以此为基准。沿用现有路径写法并实际点开分类卡片，避免误加 `/ink831/` 前缀。保留旧链接和浏览器存储键，除非修改确实需要迁移。

## 本地修改和预览

先检查 `git status`、当前分支和远端；已有修改可能来自另一项任务，不能直接覆盖或混入提交。工作区干净时再同步远端，必要时用独立 worktree 隔离并行工作。

```powershell
python scripts/site.py status
git pull --ff-only
python scripts/site.py preview
```

预览默认地址为 <http://127.0.0.1:4173/>，只监听本机，按 Ctrl+C 关闭。端口占用时用 `preview --port 4174`。在另一个终端或 agent 执行会话中验证基本页面：

```powershell
python scripts/site.py verify --base-url http://127.0.0.1:4173
```

脚本验证 HTTP 状态、页面标题、静态资源和访问目标；具体功能仍需浏览器检查。按本次改动检查桌面/窄屏、导航与必要交互，不要为纯文字修改运行全部游戏回归。

涉及游戏逻辑时使用现有验证入口：PRISM 的 `?probe=check` 汇总关卡、模拟和 WebGL 检查；ECHO 的 `?probe=lint`、`?probe=gen&n=50`、`?probe=sim&level=1`、`?probe=sonar` 见各自 README。读实际页面的 probe 结果，HTTP 200 不代表通过。

## 发布静态网站

当本次用户请求要求上线时，将本次修改提交到 `main`。只要求方案或本地预览时不发布。辅助脚本不会自动暂存、提交或合并文件。

```powershell
git add -- <本次修改的具体文件>
git commit -m "描述本次网站修改"
python scripts/site.py deploy
```

`deploy` 会核对仓库、`main` 分支和干净工作区，拉取远端引用，拒绝落后或分歧的历史，再进行普通非强制推送。它等待该提交的 `pages build and deployment` 成功，最后检查正式网站、HTTPS 及跳转；不修改 DNS，不部署腾讯云，不构建 APK。不自动弹出凭据登录；没有推送权限时使用已连接的 GitHub 工具或由用户完成正式登录。

使用 GitHub 连接工具时，读取最新 `main` 与相关文件。少量文件可直接更新；多文件修改优先基于当前树创建一个原子提交，并使用非强制分支更新和预期 head SHA 保留并发修改。head 已变化时重新读取和合并本次变更，不强推旧树。连接工具发布后，本地干净副本用 `git pull --ff-only` 同步。

线上验收：

```powershell
python scripts/site.py verify --sha <已发布的完整提交SHA> --path /新增页面/
```

默认检查首页、三类目录、共享 CSS/JS，以及 HTTP、`www`、旧 GitHub 地址到 HTTPS 正式域名的跳转。`--path` 可重复添加本次修改页面；`--wait` 调整等待部署秒数，默认 300 秒。带 `--sha` 才会验证对应提交的部署；不带时仅检查网站当前访问。GitHub API 限流、发布失败、证书错误或等待超时都返回失败，不能宣称已经上线。需要回退时对本次提交做 `git revert` 并重新部署，保留其他人的提交历史。

## 两个独立发布流程

**地牢来信：** GitHub Pages 保留入口，实际游戏页和账号/联机接口由腾讯云同源 HTTPS/WSS 服务提供。生产入口当前见 `courtyard/config.json`；服务路径、运行时、systemd、备份和验证方法以 `app-source/dungeon-mail/README.md` 为准。修改实际 `courtyard/` 前端也可能需要同步到腾讯云，不能仅 push GitHub。部署要保留独立 `DATA_DIR` 和线上存档；不得把测试数据覆盖到生产。需要腾讯云访问而当前没有授权连接时，完成代码和可验证的准备，明确说明尚未部署的部分。

**Y课表：** 源码、规则测试和构建脚本在 `app-source/y-timetable/`；先读其 `AGENTS.md`。下载页与发布包在 `software/y-timetable/`。更新 APK 使用原签名，并同步包、版本清单、校验值和下载链接。版本号与构建要求以该子项目最新文档为准。

## 域名与 HTTPS

域名由 DigitalPlat 管理，DNS 由 Cloudflare 管理，网站托管在 GitHub Pages。普通页面修改无需进入域名后台。

- `CNAME` 内容为 `ink831.dpdns.org`；保留 `.nojekyll`。
- Cloudflare 的 `@`、`www` 为指向 `yunwen831.github.io` 的 CNAME，当前为 DNS only；根域名由 Cloudflare 自动展平。
- NS 为 `austin.ns.cloudflare.com`、`dina.ns.cloudflare.com`；现有工作配置不需要重复填写。
- GitHub Pages 的 DNS 检查已通过，强制 HTTPS 已开启；`www`、HTTP 和旧 GitHub 地址会跳转到正式 HTTPS 网站。
- 如需改域名设置，先重新读取实际状态；不要把此记录当作永久不变的配置。
- DigitalPlat 上次显示到期日为 2027-10-27，到期前 120 天内可免费续期；实际政策和日期以控制台为准。

证书问题排查参考 [GitHub 官方 HTTPS 说明](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)。没有实际故障时不要反复移除域名或重置证书。

私钥、令牌、签名密钥、玩家账号与存档、服务器 data 和备份不提交到这个公开仓库。目录结构、入口或部署方式改变后，更新本说明和根 `AGENTS.md`，让下一位 agent 能直接继续。

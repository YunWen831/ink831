---
name: yunwen-website
description: 维护 YunWen 的个人网站 ink831.dpdns.org 和 GitHub 仓库 YunWen831/ink831，定位页面与子项目，完成修改、预览、发布及线上验证。用户要修改此网站、增加工具或小游戏、修复或部署网站时使用；明确指定其他网站时不使用。
---

# YunWen 网站维护

## 定位项目

- 正式网站：`https://ink831.dpdns.org/`。
- 源码仓库：`https://github.com/YunWen831/ink831`，生产分支 `main`。
- 此技能可放在仓库内或个人技能目录内；技能目录不一定是网站根目录。
- 优先使用当前工作区中远端匹配此仓库的 checkout。没有时，把公开仓库克隆到用户允许的工作目录；不要求固定盘符、操作系统或原作者的电脑路径。
- 从实际仓库根目录读取 `AGENTS.md` 和 `docs/site-maintenance.md`，以最新内容为准。没有本地读取能力时，先读取 GitHub 上这两个文件；没有编辑/执行工具时给出具体补丁与验证步骤，不声称已经修改或部署。

GitHub 入口：

- https://github.com/YunWen831/ink831/blob/main/AGENTS.md
- https://github.com/YunWen831/ink831/blob/main/docs/site-maintenance.md

## 按本次需求工作

1. 检查工作区、分支和远端，保留其他任务的未提交改动。仓库内有 `scripts/site.py` 时运行 `python scripts/site.py status`；干净的 `main` 可以 `git pull --ff-only`。必要时使用隔离工作区，不自动搬运其他副本的内容。
2. 按维护说明定位页面、分类入口、共用资源或子项目。普通静态站没有根目录 npm 构建步骤，沿用已有 HTML/CSS/JavaScript 与相对路径。
3. 用 `python scripts/site.py preview` 预览，按修改范围检查页面和交互；视觉改动用可用浏览器检查桌面和窄屏。具体工具由当前 agent 的实际能力决定。
4. 仅当本次请求要求上线时发布。只要方案或本地预览时不发布。技能说明不授予仓库、服务器、账户或凭据访问权限。
5. 将本次文件提交到 `main`。本地 Git 有非交互推送权限时使用 `python scripts/site.py deploy`；否则使用当前 agent 已授权的 GitHub 连接或合规的仓库工作流。不要强推、覆盖并发更新或索取密码/令牌。无写入权限时提供分支/补丁和具体部署步骤，清楚说明尚未上线。
6. 运行 `python scripts/site.py verify --sha <完整发布提交SHA> --path /新增页面/`，核实对应提交的 Pages 部署、HTTPS、跳转和受影响页面。结合浏览器验收具体功能；不要把 push 成功或 HTTP 200 当作全部功能已验收。

## 项目中的关键区别

- 首页：`index.html`；分类：`assets/catalog.js`；软件/游戏卡片：`assets/projects.js`；共用布局：`assets/home.css`、`assets/portal.css`、`assets/home.js`。
- 新工具在 `tools/`，要更新 `tools/index.html`；新增软件/游戏还要维护对应目录页的静态入口。
- `courtyard/` 实际游戏前端和后端由腾讯云同源服务提供，GitHub Pages 保留跳转入口。先读 `app-source/dungeon-mail/README.md`；GitHub 推送不能代替腾讯云部署。
- Android 源码在 `app-source/y-timetable/`，APK 下载页在 `software/y-timetable/`；遵循子目录的 `AGENTS.md`，保留原签名。
- 保留 `CNAME`、`.nojekyll`、现有 URL 和浏览器存储键，除非本次任务需要兼容迁移。普通内容修改不重配域名、DNS、NS 或 HTTPS。
- 不提交运行时玩家/账号数据、服务器存档、令牌、SSH 私钥、证书私钥或 Android 签名密钥。

完成后说明实际修改、访问地址、验证结果、部署提交和仍未完成的部分。目录结构或部署方式改变时更新仓库维护说明，方便下一位 agent 接手。

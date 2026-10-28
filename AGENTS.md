# YunWen 网站维护入口

- 正式网站：<https://ink831.dpdns.org/>
- 唯一源码仓库：<https://github.com/YunWen831/ink831>；生产分支 `main`。
- GitHub Pages 从 `main` 的 `/` 根目录发布；普通静态页面无需构建。
- 开始前读 [维护与部署说明](docs/site-maintenance.md)，按目录表定位本次改动。

## 工作约定

先检查 `git status`、分支与远端，保留其他任务的未提交改动。需要更新干净的生产分支时使用 `git pull --ff-only`；不要强推或重置他人的改动。子目录有 `AGENTS.md` 时继续读取。

首页分类在 `assets/catalog.js`；软件/游戏卡片在 `assets/projects.js`。目录页还保留静态入口，新增项目时同时更新相关目录页；工具目录目前直接维护 `tools/index.html`。

优先沿用已有相对路径、共享样式与原生 HTML/CSS/JavaScript。保留既有页面 URL、浏览器存储键、`CNAME` 和 `.nojekyll`；普通内容修改无需更改 DNS 或重新注册域名。

常用入口：

```powershell
python scripts/site.py status
python scripts/site.py preview
python scripts/site.py verify --base-url http://127.0.0.1:4173
```

当本次请求要求上线时，提交本次文件并发布至 `main`。已提交且本地 Git 有推送权限时可用 `python scripts/site.py deploy`；也可用 GitHub 连接工具提交。以对应提交的 Pages 部署成功和线上验证为完成依据，不能仅凭 push 成功声称已上线。

`courtyard/` 实际游戏和后端由腾讯云同源服务部署，详见 `app-source/dungeon-mail/README.md`；GitHub Pages 的游戏入口会跳转。修改这些文件后不能仅完成 Pages 发布就宣称游戏已更新。

Android 源码和 APK 更新遵循 `app-source/y-timetable/AGENTS.md`。不要提交玩家/账号存档、运行时数据、私钥、证书或签名密钥。

修改目录结构或部署方式时同步维护文档。预览、部署和验证辅助脚本的用法见 [scripts/site.py](scripts/site.py)。

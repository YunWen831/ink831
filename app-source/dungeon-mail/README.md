# 地牢来信 · 公共大厅 0.2

测试页：https://yunwen831.github.io/ink831/courtyard/

输入用户名后自动进入唯一的公共大厅。大厅支持文字聊天、16×16 像素材料绘画、共享材料库、建筑放置/拆除及服务器存档。跑酷工坊、地牢邮局提供四人准备房间，可以组队、准备、邀请、房间聊天和返回大厅；完整游戏对局仍未开放。

## 游玩

- WASD / 方向键移动；手机使用左下摇杆。
- 靠近跑酷工坊、地牢邮局或画室时按 E（手机点互动按钮）。工坊与邮局打开对应的房间列表。
- Enter 聚焦聊天，输入时不移动角色；Escape 回到地图。公共大厅和各准备房间的聊天隔离，最多保留各自最近 50 条消息，单条 120 字。
- 点击“画方块”，使用调色板、画笔、橡皮、填色和撤销制作材料。绘画草稿保留在当前浏览器；保存后的材料进入公共材料栏，其他玩家也能使用。
- 沿广场向南过桥，在两侧虚线草地施工。选择“放置”或“拆除”，点击角色附近 112 世界像素内的位置；墙块会挡路，地砖可走。主路和设施不能建造；玩家所占位置不能新建墙块。
- “回到广场”可以离开被建筑围住的位置。所有建筑均为公共协作内容，当前没有账号归属或地块权限系统。

默认大厅和准备房间共用一个 Colyseus 连接，玩家以逻辑空间隔离，避免切换空间时重新握手。整个服务最多 50 个连接（包含准备房间和短暂断线保留的位置），准备房间最多 4 人、同时最多 12 间。默认大厅不会因最后一人离开而销毁，也不会在满员时另开一个大厅。

## 结构

- `../../courtyard/`：GitHub Pages 静态前端。`world.js` 共用移动、碰撞、建造范围规则；`materials.js` 共用纹理格式与调色板；`art.js` 提供绘画板和纹理渲染。
- `server.js`：HTTP / WebSocket 入口、来源限制和健康检查。
- `hall.js`：公共大厅、逻辑房间、玩家、聊天和施工校验。
- `world-store.js`：材料、建筑的串行原子写入，以及上一版本备份。
- `deploy/`：腾讯云后端、Caddy HTTPS 和每日存档备份配置。`tunnel.py` 与旧 test/tunnel service 仅保留为历史部署参考。
- `tests/`：真实 SDK 联机验证、存档、碰撞及远端移动显示回归。

Node.js 24；Colyseus core 0.18.18 / SDK 0.18.5。前端 SDK 随网页托管，保留 MIT 许可证。

## 本地运行

在本目录执行：

```sh
npm ci --ignore-scripts
npm test
npm start
```

后端默认监听 `127.0.0.1:2567`。本地前端使用 `127.0.0.1:4173` 静态服务器，临时将 `courtyard/config.json` 的 endpoint 配置为 `http://127.0.0.1:2567`；提交前恢复线上入口。浏览器验收也可用请求拦截覆盖配置，避免修改仓库中的正式 endpoint。

`ALLOWED_ORIGINS` 为逗号分隔的允许网页来源，默认包含 GitHub Pages 与本地 4173。来源校验覆盖匹配 HTTP 和 WebSocket 握手；每来源 IP 的匹配请求限制为每分钟 120 次，以容纳同一校园出口的玩家。来源限制不替代账号认证。

## 存档与部署

当前公网后端部署于腾讯云北京轻量应用服务器，Ubuntu 26.04 LTS、2 核 4GB、6Mbps。前端继续由 GitHub Pages 托管，后端入口为 `https://82.157.83.81`：

- `/home/ubuntu/dungeon-mail/app/`：只同步游戏源码。
- `/home/ubuntu/dungeon-mail/node-v24.22.0-linux-x64/`：已验证的 Node.js 运行时。
- `courtyard.service`：游戏后端，仅监听 `127.0.0.1:2567`。
- `caddy.service`：公网 HTTPS/WSS，配置为 `deploy/Caddyfile`。
- `DATA_DIR=/home/ubuntu/dungeon-mail/data`：独立于源码的持久目录。
- `courtyard-backup.timer`：每日 UTC 04:00 后随机延迟至多 15 分钟保存 gzip 快照，保留最近 14 个日期。
- `/home/ubuntu/dungeon-mail/backups/`：每日快照和迁移备份；机器外另保留一份迁移备份。每日同机快照不等同于异地灾备。

新机器先准备运行时、依赖和真实存档，再安装 service。`ProtectHome=read-only` 下，游戏后端只有 `ReadWritePaths` 指定的数据目录可写；备份任务只可写备份目录。

```sh
sudo install -d -o ubuntu -g ubuntu -m 700 /home/ubuntu/dungeon-mail/data /home/ubuntu/dungeon-mail/backups
# 在 app-source/dungeon-mail 目录执行
sudo install -m 644 deploy/courtyard*.service deploy/courtyard-backup.timer /etc/systemd/system/
sudo install -m 644 deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo systemctl enable --now courtyard courtyard-backup.timer caddy
# 后续源码更新
sudo systemctl restart courtyard
sudo systemctl reload caddy
```

不要将存档上传到 GitHub，也不要用候选环境的测试数据覆盖线上存档。更新源码只同步 `courtyard/` 和 `app-source/dungeon-mail/`，保留部署根目录中的 data。

`world.json` 保存自绘材料和公共建筑；成功通知在磁盘原子替换完成后发出。`world.json.bak` 保存上一次写入。服务器重启后加载这些内容；若存档损坏则拒绝启动，避免默默覆盖用户作品。材料库当前最多 128 件自绘材料，建筑区有 154 个可编辑格，默认 4 件材料不占自绘额度。

玩家位置、准备房间和聊天历史暂驻内存；服务器重启后重新进入大厅，材料与建筑仍在。掉线 60 秒内或刷新页面会尝试恢复当前身份、位置和空间。浏览器只保存昵称、绘画草稿、材料选择和当前标签页的重连令牌，诊断不包含令牌和聊天内容。

后端重启会结束当前内存房间，玩家需要重新进入；材料和建筑不丢失。切换主机时也不会迁移玩家连接、位置、准备房间或内存聊天历史。

## 公网与证书

云防火墙放行 TCP 80 和 TCP 443。80 用于 ACME HTTP 验证和 HTTPS 跳转，443 用于网页的 HTTPS/WSS；不要公开 2567 或 Caddy 管理端口 2019。

Caddy 使用 Let's Encrypt 的 `shortlived` profile 签发受信任的 IP 证书，并自动续期；无需另买证书或域名。IP 证书有效期较短，需保持 Caddy 运行和 TCP 80 可访问。`default_sni` 解决客户端通过 IP 连接不发送 SNI 的情况。Caddy 必须支持 ACME profile 和 IP 证书（本次使用官方稳定仓库 2.11.7）。

反向代理覆盖 `CF-Connecting-IP` 为实际连接来源，复用后端的每 IP 限流；不信任客户端自行提交的这个头。后端只能从本机访问。

部署检查：`curl https://82.157.83.81/health`、`systemctl status courtyard caddy courtyard-backup.timer`。证书私钥、SSH 私钥、真实存档、玩家内容和迁移归档不得上传 GitHub。

原学校虚拟机在最后核对时 SSH 和隧道同时不可达；用户确认备份后没有新编辑，因此采用已校验的完整迁移备份。旧游戏服务和隧道尚未确认停用，恢复 SSH 后应停止并禁用这两个旧服务，保留迁移前存档。学校原有 8080 服务独立运行。

## 验证范围

`npm test` 覆盖同一默认大厅、四人房间上限与聊天隔离、非法移动、跨空间输入拒绝、自动重连、页面会话恢复、绘画与施工同步、磁盘保存、墙块/地砖碰撞、通道保护、玩家防压、并发存档、原移动平滑及 50 个 SDK 连接的容量检查。

浏览器另验输入名字即入厅、聊天按纯文本显示、输入时不移动、绘画保存、跨玩家材料与建筑显示、放置/拆除、刷新恢复、设施互动、房间准备/邀请/返回、手机布局、摇杆和掉线重连。SDK 容量测试不是 6Mbps 公网下的 50 人实机验收；实际延迟和容量取决于玩家线路及同步流量。

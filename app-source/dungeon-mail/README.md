# 地牢来信 · 联机庭院 0.1

测试页：https://yunwen831.github.io/ink831/courtyard/

本阶段实现俯视庭院联机：昵称、创建房间、六位房间码、邀请链接、同房间移动和表情、连接状态、往返延迟、自动重连与页面刷新恢复。每间最多 8 人。建筑、绘画和跑酷关卡属于后续阶段，当前不包含。

## 结构

- `../../courtyard/`：GitHub Pages 静态网页。`world.js` 是前后端共用的移动与碰撞规则。
- `server.js`：Node.js 24 + Colyseus 0.18 后端；服务器校验移动方向、序号和时间预算，房间状态由 Schema 同步。
- `tunnel.py`：开发用 Cloudflare Quick Tunnel；将分配的公开地址写入部署目录 `run/endpoint.json`。
- `deploy/`：本次 Rocky Linux 虚拟机的独立 systemd 服务文件。
- `tests/`：实际 SDK 集成验证，包含房间隔离、非法输入、广播、自动重连、页面恢复、退出和来源限制。

前端 SDK 0.18.5 随页面托管于 `courtyard/vendor/`，不依赖脚本 CDN；保留 MIT 许可证。

## 本地运行

使用 Node.js 24 或更新的兼容版本，在本目录运行：

```sh
npm ci --ignore-scripts
npm test
npm start
```

后端默认只监听 `127.0.0.1:2567`。将 `courtyard/config.json` 中的 endpoint 改为 `http://127.0.0.1:2567`，然后在仓库根目录启动绑定 `127.0.0.1:4173` 的静态服务器。生产网页需要 HTTPS/WSS 入口。

允许的网页来源通过 `ALLOWED_ORIGINS`（逗号分隔）配置，默认包含 GitHub Pages 及本地 4173 端口。来源限制覆盖匹配 HTTP 接口和 WebSocket 握手；它不替代正式用户认证。测试房间依靠随机房间码邀请，不包含账号或私密内容。

## 当前部署

游戏独立部署在 `/home/rocky/dungeon-mail-test/`，后端和隧道分别由 `dungeon-mail-test.service`、`dungeon-mail-tunnel.service` 管理，不占用原有的 8080 服务。

```sh
systemctl status dungeon-mail-test dungeon-mail-tunnel
journalctl -u dungeon-mail-test -n 50 --no-pager
journalctl -u dungeon-mail-tunnel -n 50 --no-pager
```

服务在开机后启动、异常退出后自动重启。校园网网关的联网状态仍依赖学校网络。房间仅驻留内存，后端重启会结束现有测试房间；玩家短暂掉线会保留身份和位置 60 秒。

## 更新临时入口

Quick Tunnel 仅用于开发测试，无可用性保证。隧道进程重新启动后会分配新域名；不能把 systemd 自动重启当成固定域名承诺。

1. 读取 `/home/rocky/dungeon-mail-test/run/endpoint.json`。
2. 将其中的公开 endpoint、updatedAt、temporary 更新到 `courtyard/config.json`。
3. 提交并发布 GitHub Pages。前端会重新读取配置，已经结束的房间需要重新创建。

GitHub 密钥、校园网密码和隧道账号凭据均不存放于游戏源码，也不为自动更新配置而复制到服务器。后续可将此入口替换为固定域名的 Cloudflare Tunnel 或经过测试的固定中转节点。

## 验证

先运行 `npm test` 验证服务行为，再在真实浏览器中验证创建/加入、同步移动、刷新恢复、移动布局与摇杆、网络中断恢复。独立校外手机流量测试需要实际设备参与；桌面移动模拟不等于手机真机验收。

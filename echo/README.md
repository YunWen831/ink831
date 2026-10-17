# 回声 ECHO · 声呐潜行

在漆黑的迷宫里，你只能靠声呐看清世界。每一次回声都会点亮墙壁、核心和听者，也会把你的位置变成声音传出去。

- 收集全部「共鸣核心」，出口才会开启。
- 跑动会留下脚步声；`Shift` 潜行无声。
- 暗紫色墙隔音，可以当声学掩体。
- 「巡礼者」会周期扫描，扫描前会先亮起来。

## 操作

| 桌面 | 手机 |
|---|---|
| `WASD` / 方向键 移动 | 左半屏拖动 |
| `Shift` 潜行 | 轻推摇杆 |
| `空格` / 鼠标左键 声呐 | 右下角「声呐」 |
| `Esc` / `P` 暂停 | 右上角暂停 |
| `M` 静音 | 右上角 ♪ |

## 内容

- 9 个手工关卡：`levels.js`
- 无尽模式「深渊回响」：每层程序生成迷宫，敌人与隔音墙随深度增加
- 进度、最佳用时、无尽最高分和设置保存在 `localStorage`（键：`echo-save-v1`）

## 结构

```
echo/
├── index.html   页面、HUD、菜单
├── style.css    全部界面样式（响应式、移动端）
├── levels.js    9 个关卡（ASCII + 数字巡逻点）
└── game.js      引擎、渲染、声呐、AI、音频、存档、自测
```

- 经典 `<script>` 加载，**不使用 ES module**，所以直接双击 `index.html`（`file://`）也能玩。
- 没有图片、字体或音频资源；所有音效由 WebAudio 实时合成。
- 渲染只依赖 Canvas 2D。墙体按「可见地板 + 脉冲波前」点亮，并保留 7 秒记忆。

## 自测

本机没有全局 Node，但可以用 Edge 无头浏览器读取页面里的 `#probe`：

```bash
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
"$EDGE" --headless=new --disable-gpu --no-sandbox --dump-dom --virtual-time-budget=30000 \
  "file:///D:/github/ink831/echo/index.html?probe=lint"
```

- `probe=lint`：解析并检查全部关卡（连通性、核心/出口、巡逻点）。
- `probe=gen&n=50`：生成并校验 50 张无尽地图。
- `probe=sim&level=1`：无敌人状态下用 BFS 机器人实际走完一关，验证碰撞与拾取。
- `probe=sonar`：检查可见性计算。
- `probe=shot&level=6&demo=1&t=8`：跑一段机器人并渲染一帧，用于截图。
- `?play=6`：直接从第 6 关开始；`window.__ECHO__` 暴露当前状态，方便调试。

## 部署

仓库根目录就是 GitHub Pages 的发布目录。新增作品后更新：

- `assets/projects.js`：游戏列表数据
- `games/index.html`：无 JS 时的静态回退卡片

线上地址：<https://yunwen831.github.io/ink831/echo/>

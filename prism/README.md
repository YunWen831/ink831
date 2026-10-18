# 棱 PRISM · 光色穿行

一束光穿过暖白的玻璃长廊。收集红、绿、蓝，把身上的光调成门想要的颜色。

## 玩法

- 光点自动向前飞。拖动屏幕（桌面也可用 `WASD` / 方向键）在走廊截面内移动。
- 吃掉 **R / G / B** 色粒，颜色会叠加：R+G=黄，G+B=青，R+B=品红，三色齐备=白。
- **棱门**要的是指定颜色。身上包含门需要的全部通道就能穿过去；门会吸走这些通道。
  - 穿门时身上恰好只有门要的颜色 → **完美**，额外加分和视觉绽放。
  - 颜色不对 → 撞碎，失去一枚棱片（共 3 枚），连击清零。
  - 也可以从门的旁边绕过去：不受伤，但断连击。
- **白门**要三色齐备（R+G+B）。
- **吐息**会把最后吃下的颜色吐掉；按住可以连续吐。用来洗掉多余的色、重新配比。
- 每章 60–90 秒；5 章通关后解锁 **无尽棱廊**，速度会慢慢变快。

### 颜色符号

颜色之外还有符号，色盲也能读：

| 净 | 红 | 绿 | 蓝 | 黄 | 品红 | 青 | 白 |
|---|---|---|---|---|---|---|---|
| ○ | ▲ | ■ | ◆ | ▲■ | ▲◆ | ■◆ | ▲■◆ |

## 操作

| 桌面 | 手机 |
|---|---|
| 鼠标拖动 / `WASD` / 方向键 移动 | 屏幕拖动 |
| `空格` / `Shift` 吐息 | 右下角「吐息」按住 |
| `Esc` / `P` 暂停 | 右上角暂停 |
| `M` 静音 | 右上角声音 |

## 内容

- 5 个手工章节：`levels.js`（白 / 原色 / 间色 / 白光 / 棱心）
- 无尽棱廊：固定种子生成，速度递进，三门一档
- 进度、最佳分、无尽最佳、画质/动效/声音设置保存在 `localStorage`（键：`prism-save-v1`）

## 结构

```
prism/
├── index.html   页面、HUD、标题/章节/设置/暂停/结算
├── style.css    编辑式排版、响应式、移动端
├── levels.js    5 章 + 无尽生成器（window.PRISM_LEVELS）
├── audio.js     程序化 WebAudio（没有音频文件）
├── render.js    手写 WebGL1/GLSL 渲染管线
└── game.js      状态机、输入、碰撞、存档、自测
```

- 经典 `<script>` 加载，**不使用 ES module**，直接双击 `index.html`（`file://`）也能玩。
- 没有图片、字体或音频资源；门心徽章由 2D Canvas 现场画成图集，音效全部实时合成。
- 渲染：场景 FBO（屏幕空间玻璃长廊 + 加法光晕 + 实体精灵）→ 亮部提取 → 半分辨率模糊 → 合成（bloom、径向色散、纸纹、暗角）。
- 画质自动降级：默认按帧时在 0.55–1.0 的渲染比例之间调整；设置里也可以固定高/低。
- 没有 WebGL 时显示一张排版完整的说明页，不白屏。

## 自测

本机没有全局 Node，用 Edge 无头浏览器读 `#probe`：

```bash
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"

# 数据 + 自动驾驶模拟 + WebGL 渲染 + 无尽生成
"$EDGE" --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1280,720 --virtual-time-budget=45000 --dump-dom \
  "http://127.0.0.1:8766/prism/index.html?probe=check"

# 单章模拟
"$EDGE" ... "http://127.0.0.1:8766/prism/index.html?probe=sim&chapter=3"

# 截图用固定画面
"$EDGE" --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1440,900 --force-device-scale-factor=1 --virtual-time-budget=10000 \
  --screenshot="$TEMP/prism-title.png" \
  "http://127.0.0.1:8766/prism/index.html?probe=shot&demo=title"
```

- `probe=lint`：检查全部章节的门/色粒顺序、边界、可达性和自动驾驶通关。
- `probe=sim&chapter=N`：用最优策略跑一章，输出穿门/完美/用时/得分。
- `probe=gl`：创建 WebGL、渲染 3 帧、读回中心/角落像素，输出 renderer。
- `probe=check`：lint + 五章 sim + gl + 无尽生成。
- `probe=audio`：创建 AudioContext 并触发全部音效，检查不抛异常。
- `probe=ui`：依次点击开始/进入/暂停/继续/返回/章节/设置，检查界面状态。
- `probe=layout`：输出 HUD 各块的位置和尺寸，便于查移动端溢出。
- `probe=shot&demo=title|chapters|settings|intro|pause|summary|dead`：固定画面截图。
- `?unlock=1`：解锁全部章节（不写存档）；`?chapter=N`、`?quality=low|high`、`?mute=1` 方便调试。
- `window.__PRISM__` 暴露 `app`、`run()`、`simulate()`、`lint()`、`renderer()`。

## 部署

仓库根目录就是 GitHub Pages 的发布目录。新增作品后更新：

- `assets/projects.js`：游戏列表数据（本作已加入）
- `games/index.html`：无 JS 时的静态回退卡片（本作已加入）
- `assets/prism-cover.svg`：首页封面

线上地址：<https://yunwen831.github.io/ink831/prism/>

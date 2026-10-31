# YunWen

[网站](https://ink831.dpdns.org/) · [软件](https://ink831.dpdns.org/software/) · [游戏](https://ink831.dpdns.org/games/) · [工具](https://ink831.dpdns.org/tools/)

- [棱 PRISM](https://ink831.dpdns.org/prism/) · 光色穿行
- [回声](https://ink831.dpdns.org/echo/) · 声呐潜行
- [地牢来信](https://ink831.dpdns.org/courtyard/) · 建造 · 派对 · 混乱都市
- [Y课表](https://ink831.dpdns.org/software/y-timetable/) · 安卓课表
- [词间](https://ink831.dpdns.org/tools/word-study/) · 英文与化学词汇练习

## 修改与发布

Agent 从 [AGENTS.md](AGENTS.md) 开始；具体目录、域名和部署方法见 [项目维护](docs/site-maintenance.md)。

其他 agent 或其他电脑使用时，直接复制 [交接提示词](docs/agent-handoff.md)，或读取仓库内的 [便携技能](.agents/skills/yunwen-website/SKILL.md)。

```powershell
python scripts/site.py status
python scripts/site.py preview
```

静态网站提交到 `main` 后由 GitHub Pages 发布。`python scripts/site.py deploy` 可推送已提交的静态站修改、等待对应提交部署，并核实线上访问；腾讯云游戏服务和 Android APK 有单独的发布流程。

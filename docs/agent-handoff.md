# 让其他 agent 接手网站

网站是 <https://ink831.dpdns.org/>，源码在 <https://github.com/YunWen831/ink831>。

## 直接把这段话发给其他 agent

```text
请维护我的网站 https://ink831.dpdns.org/。
源码仓库：https://github.com/YunWen831/ink831
先阅读仓库根目录 AGENTS.md 和 docs/site-maintenance.md，
再阅读 .agents/skills/yunwen-website/SKILL.md，按这些说明定位、修改和验证。
具体需求：【在这里填写你想修改或新增的内容】。
本次完成后请部署上线，并检查对应提交的 GitHub Pages 部署和新页面。
如果当前没有仓库写入或服务器部署权限，请说明具体缺少什么；不要声称已上线。
```

若本次不想发布，把“部署上线”改为“只做本地预览，暂不发布”。

不会自动读取项目指令的 agent，也可以按这段提示显式打开这些文件。是否能编辑、运行程序、操作浏览器或推送代码，由那个 agent 的工具和已获授权决定。

## 使用技能文件

便携技能在 [.agents/skills/yunwen-website/SKILL.md](../.agents/skills/yunwen-website/SKILL.md)，随仓库一起保存，不依赖原电脑路径。

支持技能导入的工具可按其安装方式导入整个 `yunwen-website` 文件夹；具体技能目录和激活方式以该工具为准。不支持技能导入时，直接要求 agent 阅读 `SKILL.md` 和项目文档即可，不需要额外安装。

## 在其他电脑上使用

把仓库克隆到这台电脑允许的目录，然后让 agent 在该仓库中工作：

```sh
git clone https://github.com/YunWen831/ink831.git
cd ink831
python scripts/site.py status
python scripts/site.py preview
```

脚本使用 Python 3.10+ 和 Git；某些系统的 Python 命令名为 `python3`。站点目录按实际 checkout 定位，维护说明中的 Windows 本机目录只是原电脑的约定。

## 发布前要有相应权限

公开仓库可以读取和克隆，但技能不会携带 GitHub 写入权限、云服务器权限、密码或私钥。发布到 GitHub Pages 需要目标仓库的写入权限；更新腾讯云游戏服务需要该服务的独立授权连接。让新 agent 使用自己的正式连接或既有授权，不要把密码或密钥粘贴进提示词或技能文件。

完整目录、部署、回退和验收方法以 [维护说明](site-maintenance.md) 为准。只修改网站内容时，不需要再次申请域名或配置 Cloudflare。

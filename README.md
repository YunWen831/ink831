# YunWen · 软件与游戏

网站：https://yunwen831.github.io/ink831/

首页提供软件、游戏分类入口；原有游戏地址保持可用。

- `games/`：游戏目录，入口指向 `chain/`、`campus/`、`vocab/`、`spell/`。
- `software/`：软件目录。Y课表下载页位于 `software/y-timetable/`，最新版APK与校验信息位于其 `downloads/`。
- `app-source/y-timetable/`：Y课表安卓源码、规则测试及构建说明，详见该目录README。
- `assets/catalog.js`：首页分类；`assets/projects.js`：作品列表。添加作品时使用从网站根目录出发的路径。

Y课表当前版本0.7.0，要求Android 8.0及以上。现有用户可直接覆盖安装。
本机Android SDK、缓存和签名密钥不提交到仓库；更新APK必须使用原签名。

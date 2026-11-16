# 更新日志

本项目所有值得注意的改动都记录在这里。英文版见 [CHANGELOG.md](CHANGELOG.md)。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/spec/v2.0.0.html)。

## [Unreleased]

### 新增

- 桌面程序外壳：首页，以及显示版本号和运行方式（安装版或便携版）的关于页。
- 更新。启动时和之后每小时检查一次新版本（可以在关于页关掉）。安装版在后台下载好新版本，你选择重启时安装，不需要管理员权限；便携版提示新版本并打开下载页面。正式发布之前，更新功能保持关闭。
- 便携版：一个 zip 压缩包，所有设置和数据都保存在程序旁边的 `app-data` 文件夹里。缺少 Microsoft Edge WebView2 运行时时，会询问是否下载安装。
- 明亮模式、暗黑模式和跟随系统三种主题。
- 应用 logo 和图标。
- 界面动效：切换主题时新主题从主题按钮处以柔和的圆形扩散开；切换页面时旧页面像失焦一样退到后面，新页面的卡片一张接一张从模糊浮现到清晰；侧栏选中标记滑到新位置；背景光晕缓慢流动；关于页的 logo 打开时播放一段开场动画；检查更新时按钮上的箭头旋转。Windows 关闭动画效果时不播放任何动效。

[unreleased]: https://github.com/Capybara-sea/moongazer/commits/main

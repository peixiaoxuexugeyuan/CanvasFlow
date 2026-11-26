# 第三方组件声明

## 组件

- **OpenFilm 0.3.2** 提供 Studio、时间轴、渲染、剪辑技能和导出引擎。保留 [OpenFilm MIT 声明](tools/openfilm/licenses/OpenFilm-MIT.txt)、[桌面模块许可](tools/openfilm/desktop-runtime/LICENSE)及包内第三方声明。固定版本、来源和适配范围见 [OpenFilm 接入声明](tools/openfilm/UPSTREAM-NOTICE.md)。
- **Three.js** 用于显示 3D 场景，保留 [MIT 许可](vendor/three/LICENSE)。
- **Mediabunny** 用于封装预演视频，保留 [MPL-2.0 许可](vendor/mediabunny/LICENSE)。
- **Blender** 用于本地建模。Electron、Chromium、Python、FFmpeg 和 Git 等运行组件的版本、许可文件位置及分发说明见 [桌面组件声明](tools/desktop/THIRD-PARTY-NOTICES.md)。

- **MediaPipe Tasks Vision** 提供角色面部与姿态定位，随附运行库、模型和 Apache-2.0 许可。[来源与模型校验值](vendor/role-vision/NOTICE.txt)
- **U²-Net small、ONNX Runtime Web** 用于本地角色抠图。模型及转换版本、Apache-2.0、MIT 和第三方依赖声明随组件保留。[来源与许可](vendor/role-cutout/NOTICE.txt)

## 角色库及预设素材

角色库本次增加 48 个来自 LibTV 官方角色库的角色。配套四视图类素材位于 `role-library/web`，角色编辑器的预览、造型预设和音色示例位于 `assets/role-studio`。其中包含第三方提供或基于原素材处理的图像与录音，其权利归相应权利人。仓库的非商用源码许可仅覆盖 CanvasFlow 自有作品；第三方素材的独立再分发和商业使用授权尚未逐项核实。

## Skill 及演示素材来源

`assets/agent-skills/libtv` 保存 2026-11-14 获取的公开 Skill 快照（844 个包、2,460 个 Markdown 文件），作者、来源、版本及 SHA-256 见同目录 manifest.json。原始正文按数据读取；它们不是 CanvasFlow 原创代码，不适用本项目非商用源码许可。公开可访问不等同于取得再分发许可，当前未完成逐项许可核实。3D-BOX 展示素材参考来源为 LibTV。社区新增 Skill 的作者信息由社区目录提供。

图片和视频生成台中的两张横幅（assets/generation-studio）使用为 CanvasFlow 生成的香水静物与雪山列车示例图。

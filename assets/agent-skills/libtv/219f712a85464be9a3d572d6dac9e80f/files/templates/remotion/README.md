# 连续讲解 Remotion 模板

这是随 Skill 分发的可运行起点，包含同屏逐项揭示、持续存在的规则文档、文档收拢让位、四层展开/逐层强调/合拢、字幕、音频和真实嘴型片段映射。默认30秒**无声动效示例**，人物框与波形是明确的示意；不包含任何人的照片或声音，不是已经生成好的数字人成片。

制作前先填写[导演表](../director-table.md)，按[视觉选型规范](../../references/visual-direction.md)选择本期的2D、空间和真实素材段。本模板的四层是2D编排示例，未捆绑Three.js场景引擎；选择真实空间拆合时需要在自己的制作工程加入相应实现与试渲染。不要通过统一给所有卡片加透视来替代选型。

## 环境与运行

需要 Node.js 20+、npm、可用的Chrome/Chromium。默认系统中文字体必须覆盖汉字；Linux可安装Noto Sans CJK。FFmpeg/ffprobe用于最终媒体核对。Remotion和各生成服务有各自许可/账号条件，依使用者情况核对，本包不附送权益。

先把整个模板复制到自己的制作目录；不要在已安装的Skill内放个人素材或直接渲染。

```sh
npm install
npm run check
npm test
npm run studio
npm run render -- --draft
npm run render
```

`out/explainer.mp4`为本模板输出。可用环境变量`REMOTION_BROWSER_EXECUTABLE`指定已安装的Chrome完整路径；不设置时使用Remotion支持的浏览器查找/安装行为。首次需网络获取依赖与浏览器。这里固定Remotion 4.0.520与React 19.1.0，升级后重新验证。

`node scripts/render.mjs stills`输出关键帧，适合检查设计，但不能代替看真实导出。默认并发1避免某些机器同时解码多个视频时错帧；验证后可调整。`out/`和`.bundle/`是当前项目生成物，不应随Skill分发。

## 接入自己的视频

1. 先按Skill完成稿件、授权形象/声音和短段验证。把锁定旁白、数字人视频及资料放`public/`，不要放密钥。
2. 修改`src/project.json`：`duration/fps`对应实际主音轨，`narration`为public下文件名；`captions`填校正后的真实起止秒数，不按字数均分。
3. `rules.rows[].at`、收拢/输入时间和`layers`事件时间改成实际发声锚点。新主题在`Film.jsx`中重新编排场景，复用`Primitives.jsx`；不把所有题目套成“SKILL.md＋四层”。
4. `avatarSegments`填写每个实际出镜区间。示意配置如下，数值不是你的文件时码：

```json
{"file":"avatar.mp4","from":18,"to":21,"sourceFrom":3.2,"rate":1}
```

表示成片18–21秒展示avatar.mp4源3.2–6.2秒。高光前置和正文重复使用同一内容时分别写两段映射。影片无出镜区间时不显示嘴型，不循环假说话。模板默认把Avatar放在四层中的人物窗口；全屏或资料小窗使用相同Avatar组件置于PersistentPanel中，按导演表填位置关键帧。

`rate`只描述原来配套的声音与画面的共同编辑。更换TTS后不能通过给旧视频分段加减速来声称新嘴型已同步；需新音频驱动的新出镜片段，或使用原音原画。

5. `theme`统一控制全片颜色；`fontFamily`选择有权使用且实际安装的中文字体。更换字体后重新查看所有标题/字幕换行。
6. `sfx`可填`{"file":"confirm.wav","at":25.5,"volume":0.16}`。本包的`../../scripts/make_soft_cue.py`可以生成原创轻提示音，不需下载第三方音效库。替换素材需保留许可。
7. `check`只验证引用与时间范围。仍需用ffprobe确认源视频区间足够长，并实际核对嘴型、字幕、过渡、字号、真实声音和手机阅读。无声模板试渲染不能证明新账号已跑通MOSS/HeyGen。

## 应保持的行为

已知信息留在屏幕，下一步在它旁边展开；大的位移平滑完成后留读图停顿。四层标签清楚且正面可读。不要同时叠淡入淡出的文字，不要清空画面等待下页。用字幕区域实际背景决定字幕对比。更多条件见`../../references/continuous-motion.md`。

图标：Lucide 0.468.0，ISC许可证在`public/icons/LICENSE.txt`。本模板未捆绑Pixabay原音频、系统字体或私人数字人素材。

### 字幕分层

执行[字幕规范](../../references/subtitles.md)。`captions` 普通cue保留原有接口，重点cue可加`emphasis`的`lead/focus/key/at/ratio`；组件已支持先铺垫、到实际发声时再显示重点。`project.json`是无声版式示例，时间不能直接套进真实音轨。`display: "graphic"`仅在主画面实际承接原话时去重。

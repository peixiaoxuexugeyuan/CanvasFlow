# Wan 3.0 写法分册

适用LibTV `wanx3.0`；Prime需读取`wanx3.0-prime`当时schema。来源：[官方提示词指南](https://help.aliyun.com/zh/model-studio/wan3-video-generation-prompt-guide)、[API](https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference)。核实日期2026-10-30；未实测生成。

## 编译顺序
画面规格与总体事件→实际参考资产及职责→镜头序列→连续性约束→必要负向项。厂商指南含总体描述、参考、分镜、台词、音效/BGM、风格/情绪、负向清单；本Skill始终零BGM，不能把官方示例的配乐带进来。没有必要的部分不凑数。每镜含构图/机位、主体动作、表情、目标光线、实际声音、END；可标镜头时长，源账本保留更精确切点。

## 引用与对白
厂商图/视频/音频按类型分别编号；本Skill必须转换为LibTV真实`{{node_key}}`及节点字段双绑定，不让用户填写的“图1”替代真实连线。对白逐句注明谁说、语言、语气，重叠/画外声音按已批准D父事件处理；不因镜头未见嘴而删除对白。

## 整理者模板骨架
```text
[段号、实际画幅、时长、总体事件]
参考：角色A由{{实际角色节点key}}定义；场景由{{实际场景节点key}}定义。
镜头一（[必要的镜头时长]）：[景别/机位]；[动作/表情与节奏]；[实际光线]；角色A说：“[批准台词]”。[拟音/环境音]。[END]。
镜头二：[承接上一镜的状态并完整展开]。
保持[已批准的空间、身份、道具和动作连续性]。
无背景音乐，无字幕；[仅必要的其他排除项]。
```

## 平台优先的检查
当前LibTV混合参考总≤15，不使用厂商20项宣传上限；分类图≤10、视频≤5、音频≤5。ratio无21:9；resolution是480P/720P/1080P（大写P）；duration2–30整数秒。厂商底层输入视频总时长+输出时长≤30，视频总≤15秒、音频总≤15秒；first/last_frame与reference/file/link互斥。文档/网页输入必须开扩写；LibTV字段extendPrompt，不把原生prompt_extend直接写入节点。所有细节见[边界文件](MODEL_BOUNDARIES_AND_PLATFORM_PARAMS.md)。同seed不保证逐帧复现。

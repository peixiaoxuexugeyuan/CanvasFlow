# 三模型写法总纲

核实日期2026-10-30。先读本文件，再只读当前GEN_MODEL对应分册，以及[边界和平台参数](MODEL_BOUNDARIES_AND_PLATFORM_PARAMS.md)。不得以一套通用模板覆盖三个模型。

| 锁定模型 | 写法模式 | 分册 |
| --- | --- | --- |
| Seedance 2.5 | SEEDANCE_NO_TIMELINE | [Seedance](PROMPT_WRITING_SEEDANCE_2_5.md) |
| Wan 3.0 / Prime | WAN_SEGMENTED | [Wan](PROMPT_WRITING_WAN_3_0.md) |
| Kling 4.0 | KLING_ELEMENT | [Kling](PROMPT_WRITING_KLING_4_0.md) |

模型名称和实际modelKey都锁定。Prime使用自己的schema，不推断完全等同标准版。节点引用字段与prompt中的`{{node_key}}`双路径必须一一对应；外貌只由已批准目标资产控制，不把源演员外貌写进正文。厂商@Image1等只是示意，不能代替LibTV实际占位。

所有链路：当前原片始终ANALYSIS_ONLY，不绑定。只有已批准账本能进提示词；不得用未上传的“视频1”虚构参考。B/C/D对白仅写已确认有D父事件的SH；D链路逐字用转绘剧本，画面内容来自转绘锚点，影调只取目标profile。始终零配乐。Seedance内部禁分段时间轴必须保留，但不得宣称官方不支持时间戳。

每镜展开构图/动作/表演/唯一C/实际D-F-A/唯一END；没有对应声音事件时不补造。参数写入节点，不让长篇技术参数挤占画面指令。完成编译后先QA，再向用户完整展示，明确批准后冻结并做真实节点落地。

# 附MD 4 | CLI全自动出片执行

## #做什么

将最终生成的分镜与英文 Prompt，自动转化为 LibTV 的底层代码指令，批量渲染分支视频。

## #需要什么输入

- 已经确认的英文 Prompt、资产节点ID、互动分支树。

## #怎么做

### 一、 自动组装 CLI 命令

根据互动分支数量，生成并执行 LibTV CLI 命令：

- 自动建立多个分支分组：`libtv group create --name "Branch_A"`
- 自动批量创建视频节点：`libtv node create --type video --prompt "[英文Prompt]" --group "Branch_A"`
- 自动挂载角色资产：`--ref "{{i-角色图ID}}"`

### 二、 批量下发与监控

- 下发渲染指令：`libtv generate --group "Branch_A" --concurrency 2 --retry 3`
- 监控状态并输出报告：“【系统指令】：分支 A 已渲染完成，生成了 X 个视频节点，请前往画布审核成片。”
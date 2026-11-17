# Duration Validation Rules｜V4

## Hard Fail Conditions
以下任一出现时，Skill必须自动修正，而不是直接输出：

1. `Generation Duration < 4.0s`
2. `Previs Duration < 4.0s`
3. 动作参考截取 `< 4.0s`
4. Camera参考截取 `< 4.0s`
5. 视频Prompt最后一个时间点 `< 4.00s`

## Auto Repair
如果原始分镜最终剪辑时长只有：
- 0.5–1.0s → 默认生成4秒
- 1.0–2.0s → 默认生成4–5秒
- 2.0–3.0s → 默认生成5秒
- 3.0–4.0s → 默认生成5–6秒

修复方法：
1. 增加Head Handle
2. 保持核心动作节拍不变
3. 增加Tail Handle
4. 若动作过多，则拆为多个≥4秒生成单元

## Do Not Stretch Core Action
禁止为了凑4秒，把0.8秒快速动作硬拉成4秒慢动作。
正确做法是补动作前后上下文，而不是拉长核心速度。

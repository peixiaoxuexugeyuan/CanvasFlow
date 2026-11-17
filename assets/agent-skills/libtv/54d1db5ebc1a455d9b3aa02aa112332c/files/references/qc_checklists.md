# QC清单（扩展版）

## 资产QC
- [ ] 角色身份一致
- [ ] 服装装备结构清楚
- [ ] 三视图逻辑成立
- [ ] 机械结构清楚
- [ ] 场景结构清楚
- [ ] 可作为后续母资产复用

## 分镜图QC
- [ ] 已显式引用资产ID
- [ ] 景别明确
- [ ] 机位明确
- [ ] 焦段感明确
- [ ] 主体占比正确
- [ ] 前中后景清晰
- [ ] 光影逻辑成立
- [ ] S镜有首/高光/尾帧

## 视频Prompt QC
- [ ] 已显式引用资产ID
- [ ] 时间轴清楚
- [ ] Camera Path清楚
- [ ] 动作路径清楚
- [ ] 光影逻辑清楚
- [ ] 环境反馈存在
- [ ] 打击感7阶段齐全（动作镜头）
- [ ] Scale Reveal成立（世界观镜头）
- [ ] 禁止项明确

## Final判定
- PASS：可执行
- GOOD：质量高
- S：宣发级
- REWORK：可执行但需修正
- REJECT：结构错误，回到资产/Previs阶段


## 时长QC（V4强制）
- [ ] Generation Duration ≥ 4.0秒
- [ ] Previs视频 ≥ 4.0秒
- [ ] 动作参考视频截取窗口 ≥ 4.0秒
- [ ] Camera参考视频截取窗口 ≥ 4.0秒
- [ ] Prompt时间轴终点 ≥ 4.00秒
- [ ] 有Head Handle
- [ ] 有Core Action
- [ ] 有Tail Handle
- [ ] Edit Duration与Generation Duration未混淆

任一“生成/参考总时长<4秒”直接判定 REJECT，必须重新封装。

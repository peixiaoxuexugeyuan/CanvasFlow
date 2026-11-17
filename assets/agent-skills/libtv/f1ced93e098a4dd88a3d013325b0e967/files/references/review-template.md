# Generated Segment Review Template

Use after the complete generated segment with native audio is uploaded. Review Seedance 2.0 and Kling VIDEO 3.0 Omni results separately.

```text
【项目定位】[EPxx-Sxx | 当前阶段：成片验收中]

【模型验收对象】[Seedance 2.0 / Kling VIDEO 3.0 Omni]生成结果｜[EPxx-Sxx | 10s]
【验收结论】总分：xx/100｜结果：合格·待用户确认 / 需修改·待复检 / 不合格·待重做
【硬性失败项】无 / 有：简述硬性失败项。

【分项评分】
1. Seedance角色图/Kling主体参考保真与角色服装一致性：xx/15
2. 镜头完整性、构图、运镜、剪辑与提示词遵循：xx/20
3. 台词完整性、英语化、说话人、口型与音画同步：xx/20
4. 动作质量、物理合理性、表演与节奏：xx/10
5. 短剧白柔光、肤色、面部曝光与眼神光：xx/10
6. 衔接色卡、白平衡、黑位、高光、饱和度与跨段颜色连续性：xx/10
7. 相机意图、焦点、景深、机位与摄影质感一致性：xx/5
8. 场景资产图 / 站位图一致性（未使用可写不适用）：xx/5
9. BGM、环境声、拟音、声场与下一段衔接准备：xx/5

【镜头逐项核验】
- 镜头1｜00:00-00:xx：画面、表演、运镜、颜色、白柔光和音频符合项或偏差。
- 镜头2｜00:xx-00:xx：同上。
- 镜头N｜00:xx-00:10：同上。

【Kling主体参考专项检查】仅验收Kling时填写：
- 每个主要人物是否调用用户确认的准确主体元素。
- 主体在正面、侧面、背面、遮挡、运动与重新入画时是否稳定。
- 是否彻底移除被替换角色的旧身份、服装与旧主体元素。
- 已绑定声音的主体是否保留其声音身份且没有被冲突音色覆盖。
- 对白是否绑定到正确主体。

【台词逐句核验】
- 台词1｜角色｜时间：英语化、语义、情绪、声线、口型和声像是否正确。
- 台词2｜角色｜时间：同上。
- 无对白时省略本节。

【衔接与色卡专项检查】
- S02+是否直接继续而非重播旧内容。
- 是否确实以衔接视频最后稳定1-2秒为颜色和影调最高基准。
- 00:00是否出现白平衡、色温、曝光、面部亮度、肤色、阴影、黑位、对比度、饱和度、实景高光、Gamma/LUT、白柔光扩散、辉光、磨皮、微对比、颗粒或锐度跳变。
- 同场景切镜是否出现调色、美颜强度或皮肤质感重置。
- 若提供独立色卡，是否错误覆盖了衔接视频的实际影调。
- Kling结果是否出现通用滤镜替代衔接片段色彩的问题。

【场景一致性专项检查】仅在使用场景资产图或站位图时填写：
- 生成结果的空间边界、出入口位置、主要背景锚点是否与场景资产图一致。
- 主要人物的站位、朝向、关键移动路径是否与站位图一致。
- 背景是否出现与场景资产图矛盾的新增或消失结构。
- 是否出现人物相对位置无故跳变导致空间不统一。

【音画连续性专项检查】
- 镜头之间是否发生无计划的焦点、景深、机位、运动质感或摄影机观感变化。
- BGM、环境声、拟音、英语对白和动作是否同步。
- 是否存在静音、重拍、漏拍、声场或音量跳变。
- 最后约3-5秒是否保留完整原生音频和稳定画面，可供下一段使用。

【必须修正】仅列最影响合格的1-5项；合格时写“无硬性修正项”。

【定向修正提示词】仅在需要修改、重做或用户要求优化时填写：
仅输出当前验收模型的修正提示词。保持当前EPxx-Sxx、镜头数、台词数、角色映射、衔接视频、片段提取色卡、场景资产图、站位图与结尾状态不变，只修正明确缺陷。

【用户确认】合格时仅请求：确认通过 / 需要修改 / 人工放行。
```

## Scoring and hard-fail rules

Scores total 100.

Hard fail regardless of numeric score:
- audited shot missing, merged, reordered, or invented;
- any audited spoken line missing, untranslated, left in Chinese, doubled bilingually, assigned to the wrong speaker, or invented;
- wrong or missing Kling principal subject, use of a superseded subject, conflicting subject mapping, or major character/wardrobe drift;
- replayed S02+ continuation content;
- visible opening or inter-shot jump in exposure, white balance, color temperature, facial brightness, skin tone, black level, saturation, Gamma/LUT, diffusion, bloom, smoothing, microcontrast, grain, or sharpness;
- S02+ result ignores the continuation clip's color state or lets a conflicting separate color card override it;
- scene asset map or blocking map was supplied but the result contradicts space geometry, entrance/exit position, or principal-character standing logic in a material way;
- major camera-intent inconsistency;
- a bound subject voice is overwritten by a conflicting voice identity, or native audio is missing, restarted, duplicated, silent, volume-jumped, or unusably lip-synced;
- severe body, hand, face, or prop deformation.

Qualification:
- 85-100 and no hard fail: `合格·待用户确认`
- 70-84: `需修改·待复检`
- 0-69: `不合格·待重做`

Do not mark `已验收` until the user explicitly confirms.

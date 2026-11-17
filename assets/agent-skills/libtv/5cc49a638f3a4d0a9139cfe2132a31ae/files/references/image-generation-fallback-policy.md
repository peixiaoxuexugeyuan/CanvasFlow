# 图片安全审核失败回退策略

仅当 `building_complete_reference`、`building_exploded_reference`、`building_materials_reference` 或 `building_process_reference` 明确因安全审核失败时触发；网络错误、超时、模型繁忙或画质问题不适用。

1. 原模型审核失败：原始提示词完全不变，切换 Navo Pro。
2. Navo Pro 仍审核失败：同一原始提示词完全不变，切换 Navo2。
3. Navo2 仍审核失败：仅最小化调整可能触发审核的合规措辞后重试。
4. 仍失败：停止并提出不改变建筑建造动画核心目标的安全替代方向。

不得用谐音、错拼、编码、拆分或伪装受限内容绕过审核。允许的最小调整包括移除第三方商标/广告、人物或无关现代元素，澄清历史建筑与现代建筑的语境，并保留建筑身份、结构、材料和建造目标。

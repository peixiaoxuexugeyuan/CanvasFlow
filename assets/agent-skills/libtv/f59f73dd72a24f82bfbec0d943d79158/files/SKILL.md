---

## name: reference-frame-product-replacement-v2 description: 根据参考首帧与产品素材，在 LibTV 画布优化并确认首帧提示词，测试产品替换首帧，按用户要求裂变与验收。

# 参考视频首帧商品替换与镜头裂变

## Input

用户提供的参考首帧、产品原图、自然语言要求、授权；可选已确认素材、产品资料与历史镜头。历史快照 `previous-skill-backup.md` 仅供对照，不作为执行规则。

## Process

按 `references/executable-modules.md` 执行 M0–M7：M3 以原商品为基准，M1 反推可独立推进。M2 按用户选择明确产品外观的保留项和允许变化项；已说明的不重复提问，保留 M1 原文。用户确认首帧后决定是否裂变及变化方向。M5 基于当前确认的 M2 全文及本轮要求生成各组完整正文并供用户确认。M6 优先由 Agent 创建或配置各图片节点，分别忠实写入对应组的完整正文、绑定确认的产品图并回读；文本节点仅为可选方式。节点配置不等于生成授权，等待用户决定是否运行和本次批次。M7 对实际结果验收。M4 仅在用户提供资料并要求产品分析时执行。

真实画布节点、模型、引用、正文、任务状态分别回读；先探测当前执行入口的能力，不混淆 Agent、插件与画布。缺少能力则明确人工补位，不伪称完成。中间失败报告并与你核实，阻止依赖步骤；在能力、授权与用户约束允许时可继续独立步骤。不得使用 GVLM 3.1，不擅自更换模型，不自动重试，不自动生成视频。

M3 默认 Seedream 4.6、16:9、2K、1 张；正式首帧默认 Seedream 4.0、9:16、4K、1 张；M6 默认 Seedream 4.0、4K、每节点 1 张、比例由用户选择；M1/M5 默认 Qwen 3 VL Flash。用户当次明确要求优先。收费前读取并展示当前单价、数量和预计总价，用户决定按现设置生成或调整后重新报价；报价不可读时用中文说明“报价暂时读不到，请查看节点显示”。同一范围、配置和报价已获确认时不重复询问；实际变化时再说明。分别记录实际费用；不设自动预算拦截、不自动重试。

## Output

记录来源节点 ID、完整正文、用户确认、实际参数、报价、任务 ID、终态、图片、费用和验收证据，状态 PASS / FAIL / UNKNOWN / NEEDS_HUMAN。生成成功不等于画面验收通过。对用户以中文说明节点、参数和状态，技术标识留档。节点能力、价格和模型输入不能证实时标未验证。画面分析见 `references/visual-analysis.md`；首帧见 `references/first-frame-gate.md`；多视图见 `references/product-check.md`；场景词见 `references/scene-prompt.md`；裂变见 `references/action-variation.md`；参数和评估见 `references/execution-parameters.md`、`references/dynamic-visual-params.md` 和 `references/eval-cases.md`。清洁案例仅在用户选择时使用 `references/cleaning-ball-case.md`。
# 视频执行流程

## 单镜执行对象

每个镜号建立不可变记录：

```text
shot_id
duration
scene
characters
prompt_source
prompt_canonical
source_length
source_sha256
asset_bindings
tool_name
tool_payload
task_id
status
result
error
```

## 状态

- 待核对
- 缺失资产
- 待生成
- 已提交
- 生成中
- 成功
- 失败
- 阻断

## 工具参数构建

默认单镜单次调用。示意：

```json
{
  "prompt": "<prompt_canonical原文>",
  "duration": 11,
  "character_reference_ids": ["asset_character_xh", "asset_character_pp"],
  "scene_reference_id": "asset_scene_livingroom",
  "voice_reference_ids": {
    "XH": "asset_voice_xh",
    "PP": "asset_voice_pp"
  }
}
```

实际字段名以工具 schema 为准，但每个值只能机械映射，不能创作。

## 调用前检查

- 工具主提示词字段存在；
- 工具主提示词完整；
- 原文和载荷字符数一致；
- 原文和载荷SHA-256一致；
- 时长未被修改；
- 资产映射对应正确；
- 一个载荷只包含一个镜号；
- 工具没有已知的自动改写机制。

## 返回结果

按原镜号顺序返回状态表。错误字段保留工具原始错误信息，不改写成看似成功的描述。

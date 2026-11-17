# 模型与成本策略

## 先查当前列表

每次生成前运行：

```powershell
libtv model search --type image
libtv model lib-image-2
libtv model search --type video
libtv model star-video2-mini
```

模型和字段会变化，不把历史列表当作永久事实。

## 默认模型与参数

除非用户明确指定其他模型、画质或分辨率，否则使用以下默认值：

### 图片

- 模型：`lib-image-2`（Lib Image）
- 画质：`quality=medium`，对应 LibTV 界面中的“标准画质”
- 分辨率：`resolution=2K`
- 数量：`count=1`
- 比例：按参考图多数比例或成片比例决定；无法判断时使用 `ratio=9:16`

图片节点示例：

```powershell
libtv node create "图片节点名" -t image `
  --prompt "提示词" `
  -s model=lib-image-2 `
  -s quality=medium `
  -s resolution=2K `
  -s count=1 `
  -s ratio=9:16
```

### 视频

- 模型：`star-video2-mini`（Seedance 2.0 Mini）
- 分辨率：`resolution=720p`
- 数量：`count=1`
- 比例：继承静帧或成片比例
- 时长、声音和生成模式：根据具体镜头需要设置；用户没有指定时遵循模型当前 schema 的默认值

视频节点示例：

```powershell
libtv node create "视频节点名" -t video `
  --prompt "只描述一个清晰动作，并延续静帧风格" `
  -s model=star-video2-mini `
  -s resolution=720p `
  -s count=1 `
  -s ratio=9:16
```

运行节点前仍要查询当前模型 schema。若模型键或字段发生变化，先向用户说明，再选择同名后继模型或最接近的兼容配置；不要静默换成其他模型。

## 最低成本测试

CLI 的模型列表当前不提供明确的单张价格。不要声称掌握平台实时价格。

用户要求“最便宜”“最低成本测试”时：

1. 优先选择当前列表中支持 `1K`、`count=1`、预计生成时间最短的基础或 Turbo 模型；
2. 若 `z-image` / `Z-image Turbo` 仍存在，优先使用它；
3. 设置 `quality=1K`、`count=1`；
4. 说明这是根据模型定位、最低分辨率和速度做的成本优化，并非平台价格承诺。

## 正式素材

- 默认图片使用 `lib-image-2`、标准画质、2K、单张。
- 只有用户明确要求低成本探索时才降为 1K 或改用快速模型。
- 只有用户明确要求更高分辨率时才把最终节点升级为 4K。
- 纯背景、抽象装饰、简单图标：优先基础快速模型。
- 中文标题、复杂排版：优先选择模型描述明确强调文字或长文本能力的模型。
- 多参考图一致性：选择 schema 明确支持所需参考图数量的模型。
- 不因模型更贵就默认质量更适合当前任务。

## 参数和提示词

- 把画面比例写入 `ratio` 参数，不在提示词开头写“9:16”，避免模型把比例画成文字。
- 图片画质写入 `quality`，图片分辨率写入 `resolution`。
- 视频分辨率写入 `resolution`。
- 把数量写入 `count` 参数。
- 无字背景明确要求禁止文字、数字、字母、标签和界面元素。
- 生成后必须目视检查；低成本模型出现多余文字时允许定向重做一次。

## 节省额度

- 先生成每类一个代表样式，不立即批量。
- 只重做失败节点。
- 不在未确认风格前生成 4K。
- 不用多模型同时盲测，除非用户明确要求比较。
# 燕云十六州 风格配方

## 一、验证版触发公式（角色/封面卡，GPT-Image 2）

见 `SKILL.md` 中「验证版触发公式」代码块。使用时只替换 `{subject}`，其余原样保留。

`{subject}` 写法示例：
- `a young female swordswoman in flowing blue silk hanfu, holding a guqin, elegant, cold gaze`
- `a middle-aged male swordsman in dark armor with fur mantle, scar on brow, stern`

## 二、模型路由

| 模型 | 定位 | 说明 |
|---|---|---|
| GPT-Image 2 | 首选 | 已实测蓝裙侠女抚琴出图；对长英文风格块跟随好 |
| Midjourney V8.1 | 备选 | 游戏3D质感强，但需把上面公式重写为 MJ 语法（`--ar 9:16` 等）并重新验证，不可直接复制 |
| Nano Banana 2 / Seedream 5 | 谨慎 | 未验证；若迁移需新建模型分支并标“待验证” |
| Q版/chibi 类 | 不推荐 | 与写实3D武侠基因冲突 |

来源模型未知，不以画面外观断言原始生成模型。

## 三、场景净化模板（无人物，去角色脸型词）

```text
{scene_subject}, Where Winds Meet (燕云十六声) game style, AAA 3D game render environment, Oriental Guofeng Xianxia architecture, dramatic chiaroscuro volumetric lighting, hyper-detailed silk metal wood stone textures, atmospheric particles, warm-cold contrast, 8k, no characters, no people, no text no logo
```

`{scene_subject}` 示例：`a dark ancient Chinese palace corridor at night`、`a misty bamboo forest cliff at dawn`。

## 四、道具净化模板

```text
{prop_subject}, Where Winds Meet game style, AAA 3D game render prop, three-quarter front view, hyper-detailed metal jade silk textures, dramatic rim lighting, clean dark background, no character, no text no logo
```

## 五、I2I / 图片参考模板

当用户提供参考图时（img2img）：保持上面风格块，主体描述改为“preserve the pose and layout of the reference, restyle into Where Winds Meet AAA 3D game render …”，并把参考图作为结构约束，固定风格块封装不变。

## 六、负向约束

`smiling, exposed teeth, exaggerated expression, photorealistic pores, plastic skin, oversized head, short body proportions, modern clothing, oversaturated colors, embedded text, logo, watermark, frame, border, UI elements, extra characters, facial muscle structure`

## 七、封面卡版式规则

9:16；角色约占 70%；左上留 UI 徽标负空间；底部留标题条负空间；不嵌入任何文字/边框/界面。

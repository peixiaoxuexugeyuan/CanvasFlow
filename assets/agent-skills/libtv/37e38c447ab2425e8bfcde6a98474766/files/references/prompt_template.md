# 中式仙境提示词 · 完整写作指南

本文档是生成「中式仙境」图片提示词的核心参考。所有规则均经用户 Midjourney/Seedream 实测验证：**英文段必须使用纯关键词堆叠格式，删除逻辑矛盾与具体数字，参数只保留 `--v 6.0 --style raw`，不预设画幅比例**。生成时按本指南执行。

## 1. 总体结构

每条提示词 = 主题行 + 中文描述段 + 英文描述段（关键词堆叠）+ Midjourney 参数。

```
【主题名 / 诗句】

[中文描述段：构图 → 主体 → 人物 → 异象 → 光线 → 色彩 → 风格标签]

[英文描述段：纯关键词短语序列，逗号分隔]
--v 6.0 --style raw
```

**英文段三条红线（违反则生成失败或画面怪异）：**
1. **无逻辑矛盾**：删掉逆流、回环、折返等违反物理/因果的表述，超自然元素只以静态共存出现。
2. **无具体数字**：删掉百分比、数量词、精确尺寸，改用 `massive`/`tiny`/`vast`/`minimal`/`distant`/`colossal`。
3. **关键词堆叠**：不用完整主谓宾长句，每个短语是「形容词 + 名词」片段。

## 2. 构图模式库

| 构图 | 用法 | 示例场景 |
|---|---|---|
| 平远手卷式 | 横向铺展、画面留白大、纵深开阔 | 云海仙宫、大漠长河、湖山石林 |
| 低机位仰视 | 从下方仰望巨构，强化崇高感 | 仙宫天阶、万仞巨峰、诛仙台 |
| 深远纵深构图 | 前景建筑作框，层层退远 | 云梦泽水门、院落纵深 |
| 超广角建立镜头 | 空间广阔的宫殿内景，略偏轴 | 植物妖族王庭 |
| 框景窥望 | 透过漏孔/水门/桥洞向内看 | 太湖石、水月洞天入口 |
| 45度界画轴测 | 无灭点、几何秩序感、精巧 | 白玉盘建筑群 |

**镜头位置**示例：低机位广角贴近江面、从白玉长阶向上仰望、透过近景漏孔向内窥望、从桥洞望向远方。

> 注：英文段可用 `low angle` / `wide shot` / `from below` / `aerial view` 等短标签表达镜头，不展开描写。

## 3. 画面占比原则

- **中文段**：可用约数明确各元素占比（"云海约占画面一半""自然山水约占八成、建筑约一成""异象约占画面十五分之一"）。
- **英文段**：**禁止出现任何数字**。把"约八成"压缩为 `vast` / `dominating` / `filling most of the frame`；把"约十五分之一"压缩为 `subtle` / `faint` / `ethereal`。
- 人物占画面极小，强调"渺小如棋子"→ 英文用 `tiny figure` / `chess-piece scale` / `dwarfed by`。
- 建筑为主时：建筑集中在中景，前景留大片空旷月台/广场，后方霞光云海展开纵深。
- 山水为主时：建筑缩为远景一角剪影，不占画面中央。

## 4. 中式建筑词汇库

### 屋顶形制
| 中文 | 英文（短语化） |
|---|---|
| 重檐庑殿顶 | double-eaved wudian hip roof |
| 重檐歇山顶 / 歇山楼阁 | double-eaved xieshan roof / xieshan pavilion |
| 单檐攒尖顶 / 攒尖亭 | single-eaved cuanjian pyramidal roof / cuanjian kiosk |
| 悬山顶 | overhanging gable roof |
| 汉阙 / 阙楼 | Han-style que tower |

### 台基与结构
| 中文 | 英文（短语化） |
|---|---|
| 三层汉白玉须弥座 | triple white marble xumizuo terrace |
| 白玉台明 / 台基 | white marble base |
| 朱红楠木柱网 | vermilion nanmu columns |
| 斗栱（三踩/五踩/七踩/九踩） | dougong brackets (three/five/seven/nine tiers) |
| 出檐深远 | deep overhanging eaves |
| 冰裂纹隔扇 / 菱花隔扇 | ice-crack lattice doors / lozenge lattice doors |
| 斗八藻井 | octagonal zaojing caisson |
| 平坐朱栏 | vermilion railed galleries |
| 望柱 | balustrade posts |

### 装饰
| 中文 | 英文（短语化） |
|---|---|
| 金琉璃瓦 | gold glazed roof tiles |
| 鸱吻 / 脊兽 | chiwen ridge tails / guardian beast ridge ornaments |
| 金龙和玺彩画 | gold dragon hexi polychromy |
| 青绿叠晕（梁枋） | mineral blue-green beam painting |
| 旋子彩画 | xuanzi polychrome |
| 苏式彩画 | Suzhou polychrome |
| 檐下铜铎 / 璎珞垂链 | bronze bells / jade-beaded chains |
| 兽面瓦当 | beast-mask roof tiles |

### 景观构件
| 中文 | 英文（短语化） |
|---|---|
| 白玉天桥 / 廊桥 | white jade bridge / gallery bridge |
| 复道 / 空中复道 | elevated covered corridors |
| 汀步 | stepping stones |
| 雁翅廊 | wing corridors |
| 水车 / 分水闸 | waterwheel / sluice gates |

## 5. 人物描写模式

- **服装**：月白淡青衣袂、月白青绿仙裙、烟青广袖、墨色广袖、玉白嫩绿长袍 → 英文 `flowing pale hanfu` / `moon-white wide-sleeved robe` / `misty cyan dress`。
- **姿态**：背对镜头 → `back view` / `seen from behind`；渺小 → `tiny figure` / `chess-piece scale` / `dwarfed by`。
- **角色类型**：仙子女修、植物妖族女君、赛博妖黑客、魔族女子、月兔妖族等，随世界观切换（如 `plant-spirit queen` / `cyber spirit hacker` / `moon-rabbit mechanic`）。
- **纯景空镜**：无人物，改用石狮、宫灯、穿云仙鹤、孤帆、骆驼队等标示尺度 → `stone lion` / `palace lantern` / `cranes among clouds` / `solitary sailboat`。

## 6. 异象要素（约 15% 画面）

「中式仙境」提示词的标志性特征。**中文段可自由发挥，英文段必须按下表筛选**：

| 异象类型 | 中文示例 | 英文段允许？ | 英文写法 |
|---|---|---|---|
| 倒悬重影 | 云层中倒悬宫城海市蜃楼 | ✅ 允许 | `faint inverted palace mirage in the clouds` |
| 建筑与自然共生 | 宫殿从山体/神木中生长 | ✅ 允许 | `palace grown from the mountain` / `sacred tree growing through the hall` |
| 灵气/星光粒子 | 水雾中飞星四溅、灵气丝带 | ✅ 允许 | `sparkling starlight particles` / `golden spiritual ribbons` |
| 云雾异形 | 云凝成羽翼托举鸟群 | ✅ 允许 | `clouds condensing into a translucent wing` |
| 生物化元素 | 云中龙形、水中巨兽巨眼 | ✅ 允许 | `ethereal translucent silver dragons swirling in the mist` |
| 水流逆流升天 | 河水脱离地面升向落日 | ❌ 禁止 | 删除；或改为 `waterfall pouring from the sky` 这类正常形态 |
| 不可能几何 | 廊桥首尾闭合回环、阶梯折回天空 | ❌ 禁止 | 删除 |
| 反重力结构 | 石峰悬浮、倒悬亭阁 | ⚠️ 慎用 | 仅限单一定式静态表述：`floating peaks` / `inverted pavilion`，不解释成因 |

> 判断标准：**英文段只说"画面里有什么"，不说"它正在做什么违反物理的事"**。静态共存（swirling/mirroring/rising gracefully 这类柔和动词）可以，因果矛盾（逆流、回环、穿过同一孔洞闭合）禁止。

## 7. 光线与氛围

| 基调 | 中文写法 | 英文写法 |
|---|---|---|
| 仙气清润 | 高调玉白天光，微微过曝 | `high-key jade-white light` |
| 辉煌壮丽 | 暖金夕光集中照亮金殿 | `warm golden sunset light on the roofs` |
| 宁静辽阔 | 月银清辉铺满水面 | `silver moonlight over the water` |
| 湿润氤氲 | 湿润晨光、乳白蒸汽 | `moist morning light, milky mist` |
| 肃穆孤绝 | 高调玉白与苍银雷云 | `pale silver thunderclouds` |
| 压迫邪异 | 血月低垂、旋转黑云 | `low blood-red moon, swirling black clouds` |
| 苍凉寂寥 | 暮色橙红、粉金薄雾 | `dusk orange glow, pink-gold haze` |

## 8. 色彩板

- **仙境主色**：玉白、暖金、朱红、青绿。变体：粉金霞光、月白、淡青、鹅黄、苍苔墨绿。
- **洞天/幽静**：月银清辉、冷白水雾、暖金宫灯。
- **魔界**：猩红、漆黑、暗紫、腐金。
- **赛博妖族**：夜蓝、酸绿、钴蓝、旧铜、暖橙。
- **废土朋克**：锈红、沙白、钴蓝、警示橙。

英文段固定用 `color palette: 色1, 色2, 色3`（2-4 个主色）结尾，如 `color palette: jade white, misty cyan, emerald green, warm gold`。

## 9. 风格标签

英文段默认收尾标签（用户实测有效）：

- 通用：`cinematic digital matte painting, dreamlike surrealism`
- 仙侠山水：`epic xianxia landscape`（放开头作为主 tag）
- 仙宫建筑：`epic xianxia architecture`
- 魔界：`dark epic xianxia realm, ominous atmosphere`
- 赛博妖族：`eastern biopunk, monumental scale`
- 尺度对比：`majestic scale, contrasting vast [主体] against tiny [参照物]`（如 `contrasting vast waterfall against tiny pavilion`）

## 10. 英文段写作规范（核心：关键词堆叠）

**这是本技能最重要的规则。** 英文段不是翻译，而是重组为 Midjourney 最优的关键词序列。

### 10.1 句式结构

每个短语 = `[形容词/限定词] + [名词]`，可附加一个介词短语。禁止完整主谓宾长句。

| ❌ 长句直译（禁止） | ✅ 关键词堆叠（推荐） |
|---|---|
| The waterfall falls from the top of the clouds down to the pool, making lots of spray. | `massive jade-white waterfall plummeting from storm clouds into a misty plunge pool` |
| About fifteen percent of the river lifts from the ground and rises toward the sun. | `golden spiritual ribbons drifting upward` |
| A white jade staircase that separates from the terrace and folds back into the sky. | （删除，逻辑矛盾） |

### 10.2 短语顺序模板

```text
[主场景tag], [核心物体+状态], [环境细节], [建筑细节], [人物(背对/渺小)], [超自然元素(静态)], [光线], [风格标签], [尺度对比], [color palette: 色1, 色2, 色3]
```

用户实测成功范例（逐段对照）：

```text
epic xianxia landscape,                                  ← 主场景
massive jade-white waterfall plummeting from storm clouds into a misty plunge pool,  ← 核心物体+状态
surrounded by mossy cliffs and ancient diagonal pines,   ← 环境细节
traditional Chinese red pavilion with wooden brackets on right cliff edge,  ← 建筑细节
a tiny female figure in flowing pale hanfu standing at railing (back view),  ← 人物
ethereal translucent silver dragons swirling up through the mist,  ← 超自然（静态）
sparkling starlight particles scattering in the water spray,  ← 超自然（静态）
dramatic golden god rays breaking through clouds,        ← 光线
cinematic digital matte painting, dreamlike surrealism,  ← 风格标签
majestic scale, contrasting vast waterfall against tiny pavilion,  ← 尺度对比
color palette: jade white, misty cyan, emerald green, warm gold  ← 色彩板
```

### 10.3 中式建筑术语用法

用「术语 + 英文修饰」短语化呈现，不展开解释：

- ✅ `traditional Chinese red pavilion with wooden brackets`（通用可读）
- ✅ `double-eaved wudian hip roof, dougong brackets, vermilion columns`（形制精确）
- ❌ `The pavilion uses the traditional wudian roof structure which was commonly used in the Tang dynasty...`（长句，禁止）

### 10.4 数字与量词替代表

| 中文/旧写法 | 新写法（关键词） |
|---|---|
| 约 80% 画面 | `vast` / `dominating the frame` / `filling most of the frame` |
| 约 15% 异象 | `faint` / `subtle` / `ethereal` |
| 三千尺、百米高 | `mountain-scale` / `colossal` / `towering` |
| 十二层仙阁 | `towering twelve-storey...` → 直接 `towering celestial pavilion` |
| 面阔十一间 | `imposing` / `grand` / 删除 |
| 五到九踩斗栱 | `layered dougong brackets` |
| 渺小如棋子 | `tiny figure` / `chess-piece scale` / `dwarfed by` |

## 11. Midjourney 参数表

**默认参数（用户实测验证）：**

| 参数 | 值 | 说明 |
|---|---|---|
| `--v` | `6.0` | Midjourney 稳定生成版本 |
| `--style` | `raw` | 关闭过度风格化，保留写实质感 |

**`--ar` 不预设**：默认输出不带 `--ar`，使用 Midjourney 默认比例（1:1）。用户需要特定画幅时自行追加或明确要求：

- `--ar 16:9`：横版（宽屏壁纸/横版封面）。
- `--ar 2:3` / `--ar 9:16`：竖版（海报/短视频封面）。
- `--ar 21:9`：超宽横幅。

**不添加** `--chaos` / `--stylize`，参数最小化提升成功率。

**调整规则（仅当用户明确要求时）：**

- `--ar 16:9` / `9:16` / `2:3` / `21:9`：用户指定比例时追加。
- `--sref <编号>`：用户提供风格参考图时填入编号。
- `--v 7` 等：跟随 Midjourney 版本升级，需用户确认。

**其他平台适配**：

- **Seedream（即梦）**：去掉 `--v` / `--style` 语法，只保留英文关键词堆叠主体，画幅比例用平台原生设置（用户自行选择横版/竖版）。
- **Stable Diffusion**：同上，关键词主体 + 用户指定 `--ar`（或负向提示词写法）。
- **可灵/即梦视频**：关键词主体可直接复用，比例在平台界面自行选择。

## 12. 输入类型 → 处理策略

| 输入 | 处理策略 |
|---|---|
| 名词关键词（诛仙台、灵田、太湖石） | 直接构建场景，突出该物体的形制与氛围 |
| 成语/四字词（一骑绝尘、海市蜃楼） | 解字义（本义+引申义）→ 提取核心视觉元素 → 按情绪基调构建场景 |
| 诗句（大漠孤烟直…） | 解析意象 → 提取视觉元素 → 重组为画面，不逐字翻译 |
| 地名+概念（魔界什刹海） | 将真实地名魔改，注入世界观设定 |
| 主题词（仙魔一念之间） | 提炼冲突核心，用画面元素呈现对立（如血月与熄灭宫灯） |
| 风格词（赛博妖族、植物妖族） | 在传统中式形制上叠加朋克/生物改造细节 |

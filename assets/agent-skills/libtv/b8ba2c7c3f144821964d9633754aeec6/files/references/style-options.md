# 起始风格选择

这五组是根据本地图片的可见画法整理的工作选项，并非出版社或画师的官方分类。保持原图间的差别，不假定它们来自同一位画家。

## 给用户的简短选项

新任务尚未选风格时，展示如下编号，可附 [16图总览](../assets/reference-atlas.jpg)：

1. **经典明暗油画（默认）**：雕塑式色块、半写实体积与巴洛克明暗；施特拉德、Azalin、哈肯、拉迷亚。
2. **色块叙事厚涂**：宽笔色面、形状概括、表现性构图；伊凡、伊凡娜、查库娜、弗拉德斯卡、哈兹里克。
3. **绮丽线描平涂**：细线、平涂、有限阴影和装饰性轮廓；赛德拉、维克特拉。
4. **民俗粉彩怪诞**：柔和明色、干笔粉彩、花环与民俗仪式的反差；洛琳达完整场景。
5. **发光史诗暗奇幻**：强剪影、分组金属亮面、局部发光和戏剧性尺度；Ebonbane、安卡霍特普、Cthulhu。

只问一次：“这次用哪种画风？可回复编号或参考图名称；也可同时给 character／narrative、全身／半身／头像和比例。”用户只需编号即可；其他信息能从原需求推断则不用补问。不要把五个选项扩展成五轮采访。

已有选择、继续同一系列、直接点名画法/主图时跳过菜单。用户选择“默认／直接画／你决定”时使用1，除非他已明确要求另一种画法。不从“女性／巫妖／贵族／怪物”等题材直接推断必须使用某一画法。仅要求浏览资源或改Skill时不自动生成样图。

## 加载与参数

| 编号 / 参数 | 读取文档 | 默认主图 | 可指定辅图 |
| --- | --- | --- | --- |
| `1` / `classic-oil` | [经典明暗油画](styles/01-classic-oil.md) | R00 施特拉德 | R05 Azalin、R12 哈肯、R14 拉迷亚 |
| `2` / `color-mass` | [色块叙事厚涂](styles/02-color-mass.md) | R01 伊凡 | R03 伊凡娜、R10 查库娜、R11 弗拉德斯卡、R13 哈兹里克 |
| `3` / `line-flat` | [绮丽线描平涂](styles/03-line-flat.md) | R02 赛德拉 | R15 维克特拉 |
| `4` / `folk-pastel` | [民俗粉彩怪诞](styles/04-folk-pastel.md) | R06 洛琳达完整场景 | R04仅造型／轮廓辅助，不可作风格主图 |
| `5` / `luminous-epic` | [发光史诗暗奇幻](styles/05-luminous-epic.md) | R08 Ebonbane | R09 安卡霍特普、R07 Cthulhu |

用户指定同组某图时，它成为主图。用户指定跨组原图时，跟随该图对应画法并说明；不要保留冲突的旧选项。只有用户明确说“只借颜色”时，跨组图才只作配色辅助。

可用 `scripts/style_options.py` 解析目录与主图，脚本只读且不生成图片：

```text
python <skill-dir>/scripts/style_options.py
python <skill-dir>/scripts/style_options.py --style 3 --mode character
python <skill-dir>/scripts/style_options.py --reference viktra-mordenheim --mode narrative
```

参考名可用R编号、英文文件名（含或不含扩展名）、原始中文文件名。返回的 `prompt_core` 与对应风格文档来自同一处；再合并共享质量核心、主体和模式要求后调用内置imagegen。无参数仅列菜单，不暗中启动生成。选择元数据在 [style-profiles.json](style-profiles.json)，原图路径与来源在 [art-library.json](art-library.json)。来源的D盘绝对路径只用于溯源，不作为安装后的运行依赖。

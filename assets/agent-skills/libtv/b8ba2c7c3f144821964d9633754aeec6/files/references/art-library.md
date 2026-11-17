# 本地美术资源索引

共有16张原图：原有施特拉德与本次新增15张。原始文件按字节复制，无重绘、压缩或清理；英文安装名用于稳定引用，中文来源名、尺寸、通道、Alpha与SHA-256见 [数据清单](art-library.json)。实际查看 [参考总览](../assets/reference-atlas.jpg) 后，可按ID点名主图。

下列观察来自图像本身，不据文件名推断角色设定或原作官方画派。默认为style-only，不授权把其中人物与故事移植到新画。

| ID | 本地资源 | 所属选项 | 应提取的画法与注意点 |
| --- | --- | --- | --- |
| R00 | [施特拉德](../assets/style-reference-strahd.webp) | 1默认 | 深暗大面、雕塑式面部、方向性衣褶笔触、冷灵光与暖烛光；不复制王座与脸 |
| R01 | [伊凡](../assets/art-library/ivan-dilisnya.webp) | 2 | 红布与赭黄机械的大色面，形体夸张且主次清楚；不铺满机械零件 |
| R02 | [赛德拉](../assets/art-library/saidra-dhonaire.webp) | 3 | 连续细线、飘动轮廓、青绿/洋红平涂区与有限阴影 |
| R03 | [伊凡娜](../assets/art-library/ivana-boritsi.webp) | 2 | 毒绿色块、紫红轮廓与概括植物，明暗集中在人物大形 |
| R04 | [洛琳达抠图](../assets/art-library/mother-lorinda-transparent.webp) | 4辅助 | Alpha0–255；隐藏RGB横向色带在正常Alpha合成时不显示，不能丢弃Alpha；保留脚下地面，仅造型/轮廓辅助，不作纯人物Alpha范例 |
| R05 | [Azalin Rex](../assets/art-library/azalin-rex.webp) | 1 | 冷灰骨骼体积、安静青黑城堡和少量亮边；Alpha247–255，无全透明背景，不是透明立绘 |
| R06 | [洛琳达完整场景](../assets/art-library/mother-lorinda.webp) | 4主图 | 粉彩式干笔、粉黄灰绿与软亮背景，脸手焦点；Alpha225–255，不是纯不透明示范 |
| R07 | [Cthulhu](../assets/art-library/cthulhu.webp) | 5 | 有形体方向的弧笔、成组鳞纹与发光水线，巨大尺度；避免复刻密集水花颗粒 |
| R08 | [Ebonbane](../assets/art-library/ebonbane.webp) | 5默认 | 红剑与青色空间的强剪影、甲片色面、选择性亮边 |
| R09 | [安卡霍特普](../assets/art-library/ankhtepot.webp) | 5 | 金焰主光、冷绿暗面、骨与金属的绘画式高光；不改为PBR反射 |
| R10 | [查库娜](../assets/art-library/chakuna.webp) | 2 | 松动宽笔、黄绿背景与前景火色、人物可读动作；不随机加表面磨损 |
| R11 | [弗拉德斯卡](../assets/art-library/vladeska-drakov.webp) | 2 | 低视角、圆形强光、明确红金/紫暗图形分区；不自动移植刑场题材 |
| R12 | [哈肯](../assets/art-library/harkon-lukas.webp) | 1 | 低调暖灯、宽阔暗影、人物与巨大影子的叙事关系，木纹简化 |
| R13 | [哈兹里克](../assets/art-library/hazlik.webp) | 2 | 琥珀大面、青色光形、书写般弧线与简化服饰；原图颗粒需克制 |
| R14 | [拉迷亚](../assets/art-library/ramya-vasavadan.webp) | 1 | 紫幕、青蓝灵体与选择性金甲细节；原图1113×1440，远处微细节不猜补 |
| R15 | [维克特拉](../assets/art-library/viktra-mordenheim.webp) | 3 | 清楚细线、平涂皮肤与布料、有限阴影、图形式裂镜叙事；不照搬脸与镜子 |

style-only的Alpha不合格不等于不能学习其笔触，但不能把源Alpha性质视作新成图的交付标准。character仍须生成并实测真实透明PNG；narrative仍须完整不透明背景。

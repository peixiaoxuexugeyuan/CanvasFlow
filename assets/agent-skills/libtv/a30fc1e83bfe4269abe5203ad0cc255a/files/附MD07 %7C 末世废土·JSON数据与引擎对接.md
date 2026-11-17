# 附MD07 | 末世废土·JSON数据与引擎对接

**所属主SKILL：** 末世废土 · 生存 | 上架Steam的互动影游\
**版本：** V2.0 融合合规版

## #做什么

确保互动影游能落地运行、可直接交付工程。

## #需要什么输入

完整节点清单与变量字典、结局清单、视频文件。

## #怎么做

### 一、JSON数据结构

schemaVersion为1。projectId自定义。包含variables、nodes、endings数组。

### 二、变量字典

1. 物资储备：ID为v_supplies。
2. 人性值：ID为v_humanity。
3. 辐射感染度：ID为v_radiation。
4. 幸存者声望：ID为v_reputation。
5. 避难所防御力：ID为v_defense。

### 三、Twine/SugarCube 工程规范

引擎锁定为SugarCube 1.0.35。变量语法用 set 空格 美元符号变量名 等于号 值。

### 四、视频文件命名规范

N01.mp4（开场·废墟苏醒），N02A.mp4（独吞物资），N02B.mp4（分给难民）。

### 五、本地测试规范

VS Code配合Live Server。浏览器用Chrome或Edge。

### 六、避坑清单

变量名必须写在StoryInit节点。起始节点必须设为起始片段。

### 七、生成与合成

同前。
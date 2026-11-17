副07 | 擂台拳击导演\_Twine|SugarCube工程与JSON数据对接

```
**所属主SKILL：** 擂台拳击导演 | 用AIGC做12回合拳击互动影游  
**版本：** V2.0 融合合规版

## #做什么

本模块为“擂台拳击导演”互动影游的专属Twine/SugarCube工程规范与JSON数据对接标准。

解决互动影游“代码规范不统一、变量语法错误、引擎对接失败、视频文件无法播放”的痛点。通过统一的JSON数据结构、SugarCube 1.0.35锁定规范与Adventure Creator配置说明，确保互动影游DEMO可直接运行、可点击体验。

本模块只规定工程规范与JSON数据结构，不替代主SKILL的流程调度与底层逻辑。

## #需要什么输入

**最少提供：**
- 完整的节点清单与变量字典
- 每回合视频文件（MP4格式）
- 结局清单与触发条件

**可选提供：**
- 项目名称与项目ID
- 目标平台
- 是否需要输出视频文件、视频脚本、Prompt清单、视觉方案

## #怎么做

### 一、遵循主MD全局路由表与绝对工作流铁律
本模块执行时，必须严格遵循主MD的【全局 Skill 调用路由表】与【绝对工作流铁律】。本环节重点参考【顶级游戏开发大师】的节点设计与变量系统规则。

### 二、JSON数据结构（标准格式）
```json
{
  "schemaVersion": 1,
  "projectId": "用户自定义项目ID",
  "title": "用户自定义项目名称",
  "variables": [
    {"id":"$stamina","name":"体能","type":"counter","default":100,"min":0,"max":100},
    {"id":"$face_damage","name":"面部伤势","type":"counter","default":0,"min":0,"max":100},
    {"id":"$body_damage","name":"身体伤势","type":"counter","default":0,"min":0,"max":100},
    {"id":"$hits","name":"命中数","type":"counter","default":0,"min":0,"max":999},
    {"id":"$round","name":"回合","type":"counter","default":1,"min":1,"max":12},
    {"id":"$tactic","name":"战术","type":"string","default":null}
  ],
  "nodes": [
    {
      "id":"R01","type":"start","title":"第一回合·刺拳测距试探",
      "sceneDesc":"擂台中央对峙，双方拳套互触",
      "choices":[],"nextNode":"R01_END"
    },
    {
      "id":"R01_END","type":"branch","title":"回合间隙决策",
      "choices":[
        {"id":"R01_A","text":"全力进攻",
         "effects":[{"var":"$stamina","op":"sub","val":30},{"var":"$face_damage","op":"add","val":10}],
         "targetNodeId":"R02"},
        {"id":"R01_B","text":"稳固防守",
         "effects":[{"var":"$stamina","op":"add","val":10}],
         "targetNodeId":"R02"},
        {"id":"R01_C","text":"保留体力",
         "effects":[{"var":"$stamina","op":"add","val":15},{"var":"$body_damage","op":"add","val":5}],
         "targetNodeId":"R02"}
      ]
    }
  ],
  "endings": [
    {"id":"KO_WIN","type":"good","title":"KO胜利",
     "conditions":[{"var":"$stamina","op":"gte","val":20},{"var":"$hits","op":"gte","val":50}]},
    {"id":"KO_LOSE","type":"bad","title":"被KO落败",
     "conditions":[{"var":"$stamina","op":"lte","val":0}]}
  ]
}
```

### **三、Twine / SugarCube 代码规范**

**1. 引擎版本**

- **唯一可用版本**：SugarCube 1.0.35（Twine内置）

- **不可用**：Harlowe / Chapbook / SugarCube 2.x

**2. 变量语法规范**

**操作正确写法错误写法**初始化`<<set $stamina = 100>><<set $stamina to 100>>`增加`<<set $stamina = $stamina + 10>><<set $stamina += 10>>`减少`<<set $stamina = $stamina - 20>><<set $stamina -= 20>>`判断等于`<<if $round eq 12>><<if $round is 12>>`判断大于等于`<<if $stamina gte 20>><<if $stamina >= 20>>`判断小于`<<if $face_damage lt 50>><<if $face_damage < 50>>`跳转`<<goto "R02">><<display "R02">>`

**3. 节点配置规范**

**节点规定**变量初始化必须命名 StoryInit起始节点任意命名，右键设为起始片段结局判定ENDING_CHECK其他节点和视频文件名完全一致

**4. 视频节点代码模板**

text

```
<video src="R01.mp4" autoplay controls width="100%"></video>
第一回合·刺拳测距试探
[[继续->R01_END]]
```

**5. 结局判定节点代码模板**

text

```
<<if $stamina lte 0>>
  <<goto "KO_LOSE">>
<<elseif $round gte 12 and $hits gte 50>>
  <<goto "KO_WIN">>
<<elseif $round gte 12 and $hits lt 50>>
  <<goto "POINTS_LOSE">>
<<else>>
  <<goto "R12_END">>
<</if>>
```

### **四、Adventure Creator 配置说明**

**1. 引擎版本**

- Unity 2021.3 LTS 或以上

- Adventure Creator 1.79 或以上

- 场景模式：2D Screen

**2. 变量配置步骤**

在AC菜单 → Variables → Global Variables逐一创建：

**变量名AC类型默认值说明**体能Integer100范围0-100面部伤势Integer0范围0-100身体伤势Integer0范围0-100命中数Integer0用于点数判定回合Integer1范围1-12战术Stringnull值：攻击/防守/保留

**3. 节点配置步骤**

- 创建Cutscene资产，命名如「R01\_第一回合」

- 添加动作：Engine → PlayMovieClip → 视频文件

- 添加动作：Menu → Turn On Menu → 选择界面

- 等待玩家选择

- 根据选择，执行Variable变化 + Run Cutscene跳转

### **五、视频文件命名规范（强制锁定）**

**文件名内容**R01.mp4第一回合·刺拳测距试探R02.mp4第二回合·角落肝脏爆击R03.mp4第三回合·假动作迎击......R12.mp4第十二回合·最终决战R01_END.mp4第一回合间隙决策......KO_WIN.mp4KO胜利结局KO_LOSE.mp4被KO落败结局POINTS_WIN.mp4点数胜利结局POINTS_LOSE.mp4点数落败结局

**警告**：视频文件名不可更改，必须和代码里的 `src=""` 完全一致。大小写也不能错。

### **六、文件结构规范**

text

```
项目文件夹/
  ├── 项目主文件.html
  ├── R01.mp4
  ├── R02.mp4
  ├── ...所有视频文件
  ├── KO_WIN.mp4
  ├── KO_LOSE.mp4
  ├── POINTS_WIN.mp4
  └── POINTS_LOSE.mp4
```

HTML和所有视频必须在同一文件夹，缺一个视频就黑屏。

### **七、本地测试规范**

**测试方式说明**本地测试VS Code + Live Server插件，右键HTML → Open with Live Server不可用直接双击HTML（浏览器会拦截本地视频）推荐浏览器Chrome / Edge

### **八、避坑清单（最容易出错）**

**问题原因解决方案**变量显示在屏幕上变量写在普通节点里必须写在StoryInit节点黑屏起始节点没设为起始片段右键节点→设为起始片段视频无法播放直接双击HTML用Live Server打开所有结局都跳D01用了`<<display>>`而不是`<<goto>>`ENDING_CHECK全部用`<<goto>>`引擎报错用了SugarCube 2.x语法只用SugarCube 1.0.35

### **九、子级专属提示词模板（示例）**

text

```
节点ID：R02
JSON输出：
{
  "id":"R02","type":"normal","title":"第二回合·角落肝脏爆击",
  "sceneDesc":"主角A压迫对手至擂台角落，身体勾拳",
  "choices":[],"nextNode":"R02_END"
}
Twine代码：
<video src="R02.mp4" autoplay controls width="100%"></video>
[[继续->R02_END]]
```

（注：以上“富贵、安九”仅为示例，实际使用时由用户自定义替换）

## **#产出什么**

最终交付：

- **视频文件（MP4格式）**：包含完整互动逻辑的拳击互动影游DEMO。

- **视频脚本、Prompt清单、视觉方案**。

- **JSON数据包**：完整的变量、节点、结局数据结构。

- **Twine/SugarCube工程文件**（.twee + HTML）。

- **Adventure Creator配置说明**。

- **视频文件命名规范清单**。

- **本地测试与部署指南**。

## **#什么时候问你**

出现以下情况时，必须停下来问用户：

- 节点ID、变量ID或视频文件名存在冲突时。

- 用户要求使用非SugarCube 1.0.35的引擎版本时。

- 本地测试出现无法播放、黑屏或跳转错误时。

- 用户要求输出视频文件、视频脚本、Prompt清单、视觉方案，但缺少关键输入时。

- 本模块与上游主SKILL或其他附MD规则冲突时。
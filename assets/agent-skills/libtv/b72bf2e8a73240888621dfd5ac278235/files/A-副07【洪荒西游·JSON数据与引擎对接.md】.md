# A-副07【洪荒西游·[JSON数据与引擎对接.md](http://JSON数据与引擎对接.md)】\
洪荒西游·JSON数据与引擎对接

## 一、JSON数据结构（标准格式）

```json
{
  "schemaVersion": 1,
  "projectId": "用户自定义项目ID",
  "title": "用户自定义项目名称",
  "variables": [
    {"id":"v_karma","name":"【核心变量1】","type":"counter","default":0,"min":0,"max":100},
    {"id":"v_risk","name":"【核心变量2】","type":"risk","default":0,"min":0,"max":100},
    {"id":"v_heaven","name":"【核心变量3】","type":"relationship","default":0,"min":-50,"max":100},
    {"id":"v_west","name":"【核心变量4】","type":"faction","default":50,"min":0,"max":100},
    {"id":"v_edits","name":"【核心变量5】","type":"counter","default":0,"min":0,"max":3},
    {"id":"v_route","name":"【路线锁定】","type":"routeLock","default":null},
    {"id":"v_relic","name":"【解锁道具1】","type":"item","default":false},
    {"id":"v_seal","name":"【解锁道具2】","type":"item","default":false}
  ],
  "nodes": [
    {
      "id":"N01","type":"start","title":"斩仙台绝境",
      "sceneDesc":"斩仙台，万仙列阵，主角A跪地锁链，太白金星宣判",
      "choices":[],"nextNode":"N02"
    },
    {
      "id":"N02","type":"branch","title":"觉醒前的选择",
      "choices":[
        {"id":"N02A","text":"保持沉默，等待时机",
         "effects":[{"var":"v_karma","op":"add","val":5},{"var":"v_relic","op":"set","val":true}],
         "targetNodeId":"N03"},
        {"id":"N02B","text":"大声质问天道不公",
         "effects":[{"var":"v_risk","op":"add","val":10},{"var":"v_west","op":"add","val":10}],
         "targetNodeId":"N03"}
      ]
    },
    {
      "id":"N04","type":"branch","title":"第一次编辑",
      "choices":[
        {"id":"N04A","text":"编辑·路线A身份",
         "condition":{"var":"v_risk","op":"lt","val":90},
         "effects":[{"var":"v_karma","op":"add","val":40},{"var":"v_risk","op":"add","val":25},{"var":"v_route","op":"set","val":"A"}],
         "targetNodeId":"N05A",
         "failCondition":{"var":"v_risk","op":"gte","val":90},
         "failNode":"D01"},
        {"id":"N04B","text":"编辑·路线B身份",
         "condition":{"var":"v_heaven","op":"gte","val":0},
         "effects":[{"var":"v_karma","op":"add","val":30},{"var":"v_heaven","op":"add","val":30},{"var":"v_route","op":"set","val":"B"}],
         "targetNodeId":"N05B",
         "failCondition":{"var":"v_heaven","op":"lt","val":0},
         "failNode":"D03"},
        {"id":"N04C","text":"编辑·路线C身份",
         "condition":[{"var":"v_relic","op":"eq","val":true},{"var":"v_west","op":"gte","val":60}],
         "hidden":true,
         "effects":[{"var":"v_karma","op":"add","val":20},{"var":"v_west","op":"sub","val":40},{"var":"v_route","op":"set","val":"C"}],
         "targetNodeId":"N05C"}
      ]
    }
  ],
  "endings": [
    {"id":"E01","type":"good","title":"生死逆转",
     "conditions":[{"var":"v_route","op":"eq","val":"A"},{"var":"v_karma","op":"gte","val":60},{"var":"v_risk","op":"lt","val":70}]},
    {"id":"E04","type":"true_ending","title":"三界棋手",
     "conditions":[{"var":"v_seal","op":"eq","val":true},{"var":"v_karma","op":"gte","val":80},{"var":"v_risk","op":"lt","val":90}]},
    {"id":"D01","type":"bad","title":"谎言反噬",
     "conditions":[{"var":"v_risk","op":"gte","val":90}]}
  ]
}

二、Twine / SugarCube 代码规范
1. 引擎版本
唯一可用版本：SugarCube 1.0.35（Twine内置）

不可用：Harlowe / Chapbook / SugarCube 2.x

2. 变量语法规范
操作	正确写法	错误写法
初始化	<<set $karma = 0>>	<<set $karma to 0>>
增加	<<set $karma = $karma + 5>>	<<set $karma += 5>>
判断等于	<<if $route eq "A">>	<<if $route is "A">>
判断大于等于	<<if $karma gte 60>>	<<if $karma >= 60>>
判断小于	<<if $karma lt 30>>	<<if $karma < 30>>
跳转	<<goto "D01">>	<<display "D01">>
3. 节点配置规范
节点	规定
变量初始化	必须命名 StoryInit
起始节点	任意命名，右键设为起始片段
结局判定	ENDING_CHECK
其他节点	和视频文件名完全一致
4. 视频节点代码模板

<video src="N01.mp4" autoplay controls width="100%"></video>
文本内容
[[按钮文字->目标节点名]]

5. 结局判定节点代码模板

<<if $v_seal eq true and $v_karma gte 80 and $v_risk lt 90>>
  <<goto "E04">>
<<elseif $v_route eq "A" and $v_karma gte 60 and $v_risk lt 70>>
  <<goto "E01">>
<<elseif $v_risk gte 90>>
  <<goto "D01">>
<<else>>
  <<goto "E05">>
<</if>>

三、Adventure Creator 配置说明
1. 引擎版本
Unity 2021.3 LTS 或以上

Adventure Creator 1.79 或以上

场景模式：2D Screen

2. 变量配置步骤
在AC菜单 → Variables → Global Variables逐一创建：

变量名	AC类型	默认值	说明
【核心变量1】	Integer	0	范围0-100
【核心变量2】	Integer	0	≥90触发结局
【核心变量3】	Integer	0	范围-50到100
【核心变量4】	Integer	50	≥80触发结局
【核心变量5】	Integer	0	=3触发结局
【路线锁定】	String	null	值：A/B/C/null
【解锁道具1】	Boolean	False	解锁隐藏路线
【解锁道具2】	Boolean	False	解锁真结局
3. 节点配置步骤
创建Cutscene资产，命名如「N01_开场」

添加动作：Engine → PlayMovieClip → 视频文件

添加动作：Menu → Turn On Menu → 选择界面

等待玩家选择

根据选择，执行Variable变化 + Run Cutscene跳转

4. 选择界面菜单配置
菜单名：如「N02_选择界面」

类型：Appear In Screen Space

按钮1「选项文字」→ 点击动作列表：变量变化 + 跳转

按钮2「选项文字」→ 点击动作列表：变量变化 + 跳转

隐藏按钮需设置显示条件

5. 结局判定节点配置
在ENDING_CHECK节点中，按优先级从高到低设置条件判定

全部使用 <<goto>>，禁止使用 <<display>>

每个结局节点只包含：视频+一句话+重新开始

四、视频文件命名规范（强制锁）
文件名	内容
N01.mp4	开场·斩仙台绝境
N02.mp4	选择1·觉醒前态度
N03.mp4	核心引擎觉醒
N04.mp4	选择2·第一次编辑
N05A.mp4	A线·天道判定
N05B.mp4	B线·天道判定
N05C.mp4	C线·天道判定
N06A.mp4	A线·配角A质问
N06B.mp4	B线·配角B要求回报
N06C.mp4	C线·配角C试探
N07A.mp4	A线·阵营施压
N07B.mp4	B线·配角C阻挠
N07C.mp4	C线·三界博弈
N08.mp4	选择5·最终一编
E01-E05.mp4	正结局
D01-D10.mp4	坏结局
警告：视频文件名不可更改，必须和代码里的 src="" 完全一致。大小写也不能错。

五、文件结构规范

项目文件夹/
  ├── 项目主文件.html
  ├── N01.mp4
  ├── N02.mp4
  ├── ...所有视频文件
  ├── E01.mp4 ~ E05.mp4
  └── D01.mp4 ~ D10.mp4
HTML和所有视频必须在同一文件夹，缺一个视频就黑屏。

六、本地测试规范
测试方式	说明
本地测试	VS Code + Live Server插件，右键HTML → Open with Live Server
不可用	直接双击HTML（浏览器会拦截本地视频）
推荐浏览器	Chrome / Edge
七、避坑清单（最容易出错）
问题	原因	解决方案
变量显示在屏幕上	变量写在普通节点里	必须写在StoryInit节点
黑屏	起始节点没设为起始片段	右键节点→设为起始片段
视频无法播放	直接双击HTML	用Live Server打开
所有结局都跳D01	用了<<display>>而不是<<goto>>	ENDING_CHECK全部用<<goto>>
引擎报错	用了SugarCube 2.x语法	只用SugarCube 1.0.35

八、子级专属提示词模板（示例）
节点ID：N05A
JSON输出：
{
  "id":"N05A","type":"normal","title":"A线天道判定",
  "sceneDesc":"时间重启，天道金印从云端压下，配角A破云降临",
  "choices":[],"nextNode":"N06A"
}
Twine代码：
<video src="N05A.mp4" autoplay controls width="100%"></video>
[[继续->N06A]]
```

*（注：以上“富贵、安九、赤金御押”仅为示例，实际使用时由用户自定义替换）*
# 25 Seedance 控制与 Prompt 执行层

> 定位：24号是通用AI视频行为控制引擎，本库进一步把导演决策整理成适用于 Seedance 系列工作流的**执行层结构**。重点不是虚构某一版本的按钮或参数，而是建立稳定的Prompt、参考资产、镜头状态、生成批次与质检接口。
>
> 核心原则：**Seedance执行层不是重新发明导演语言，而是把导演语言组织成模型更容易继承和检查的输入结构。**

## 一、Seedance执行层六层结构

```text
01 项目固定母层
02 资产参考层
03 镜头状态层
04 动作与摄影过程层
05 时间轴层
06 结果质检与修复层
```

## 二、项目固定母层 PROJECT MASTER

整片只定义一次：

- 题材
- 世界观
- 现实度
- 画幅
- 基础帧率策略
- 整体色彩母系统
- 视觉质感
- 主摄影风格
- 角色视觉规则
- 场景视觉规则
- 禁用视觉元素

后续镜头不要重复改写。

## 三、资产参考层

建立：

```text
CHARACTER_MASTER
SCENE_MASTER
COSTUME_MASTER
PROP_MASTER
LOOK_MASTER
BLOCKING_MASTER
```

每个镜头只引用必要资产。

## 四、镜头状态层

```text
SHOT_ID:
LOCATION:
TIME:
CHARACTER_STATE:
BLOCKING_STATE:
CAMERA_STATE:
PERFORMANCE_STATE:
LIGHT_STATE:
COLOR_STATE:
PROP_STATE:
WORLD_STATE:
```

## 五、Seedance Prompt的推荐顺序

```text
主体/资产
→ 空间位置
→ 当前状态
→ 主动作
→ 摄影机
→ 环境
→ 光色
→ 时间过程
→ 结束状态
→ 连续性约束
```

这样可以避免把大量风格词放在最前面掩盖主体行为。

## 六、Prompt固定层+变量层

### 固定层

定义：

- 角色
- 世界
- 风格
- 场景
- 色彩
- 服装

### 变量层

每镜变化：

- 动作
- 摄影机运动
- 表情
- 位置
- 道具状态
- 环境变化

## 七、Reference策略

### 角色参考

优先锁定：脸型、发型、服装、体型、颜色。

### 场景参考

优先锁定：建筑结构、家具、道路、主要空间关系。

### 道具参考

优先锁定：形状、材质、颜色、标志性细节。

### Look参考

锁定：整体光色、质感、影调，而不是复制具体内容。

## 八、镜头生成粒度

### 单镜头

用于高精度控制。

### 镜头组

用于同一空间、同一角色状态连续生成。

### Sequence

用于有明确起承转合的连续动作。

建议：**先稳定单镜头，再组合镜头组。**

## 九、时间轴Prompt

推荐使用明确时间区间：

```text
0–1秒：建立初始状态
1–3秒：主动作发生
3–4秒：Reaction/状态变化
4–5秒：进入End State
```

时间不必机械固定，关键是：

> **让动作发生顺序可追踪。**

## 十、单镜头Prompt模板

```text
【主体与资产】
[角色/产品/场景]，继承项目母视觉与角色状态。

【空间与Blocking】
主体位于[位置]，朝向[方向]，与[对象]保持[距离]。

【Start State】
开始时[动作/表情/道具状态]。

【主动作】
主体执行[一个主动作]，方向为[方向]。

【Camera】
[景别]，[机位]，[焦段]；主运动为[运动]，摄影机与主体保持[关系]。

【环境】
前景[运动]，中景[运动]，背景[低强度动态]。

【光色】
主光源[来源]，整体主色[颜色]，强调色[颜色]。

【时间过程】
开始……中段……结尾……

【End State】
主体最终[位置/动作/表情]；摄影机最终[位置/构图]。

【稳定性】
人物身份、服装、空间、道具、光色保持连续；动作轨迹自然，主体结构稳定。
```

## 十一、镜头组Sequence模板

```text
SEQUENCE MASTER
统一场景：
统一时间：
统一光色：
统一角色状态：
统一服装：
统一Blocking：
统一Camera基线：

SHOT 01：Start → End
SHOT 02：继承01 End → 新End
SHOT 03：继承02 End → 新End
```

## 十二、导演变量控制

每镜尽量只改变：

```text
Primary Variable = 主动作/主摄影机/主情绪中的一个
Secondary Variables ≤ 2
```

如果主变量变化已经复杂，不再增加大型特效。

## 十三、商业产品镜头执行结构

```text
Hero Asset Lock
→ Material Detail
→ Camera Reveal
→ Usage Demonstration
→ Emotional Lifestyle
→ Product Pack
→ Logo/CTA
```

每镜只负责一个销售认知点。

## 十四、剧情镜头执行结构

```text
空间建立
→ 人物进入
→ 关系建立
→ 触发事件
→ 反应
→ 决策
→ 行动
→ 结果
```

## 十五、风格控制

不要大量重复：

> 电影感、史诗感、高级感、超真实、大片质感。

改为明确控制：

- 镜头
- 焦段
- 光线
- 色彩
- 材质
- 表演
- 运动
- 节奏

## 十六、生成批次管理

建立：

```text
SHOT_001_V01
SHOT_001_V02
SHOT_001_V03
```

每次只修改一个主要变量，以便判断“什么改动真正有效”。

## 十七、结果质检

### A Identity

脸/身体/服装/道具是否一致？

### B Spatial

人物位置/空间关系是否一致？

### C Motion

动作有没有跳帧/瞬移/反重力？

### D Camera

镜头轨迹是否连续？

### E Performance

眼神/表情/讲话是否连贯？

### F World

建筑/天气/光线是否乱变？

## 十八、修复策略

### 只改一件事

避免“一次改完所有东西”。

### 先修大错

Identity、Spatial、Main Action优先。

### 再修质感

Light、Color、Texture、Secondary Motion。

## 十九、Seedance执行层与其他知识库关系

需求主调用为什么这样拍18观众看哪里19摄影物理20怎么剪21场景拍哪些覆盖镜头22AI怎么稳定执行24Seedance如何组织输入25一致性11/15/17打斗16

## 二十、输出标准

生成Seedance Prompt时，优先输出：

1. 场景/资产继承说明
2. Start State
3. 主动作
4. Camera State
5. 环境与光色
6. 时间过程
7. End State
8. 连续性控制
9. 导演设计说明

## 二十一、版本差异原则

Seedance不同版本、不同界面和功能能力可能变化。Skill中只固定：

> **导演逻辑与Prompt结构。**

具体模型名称、参数范围、参考图数量、时长档位等执行细节，应在实际使用的官方能力确认后配置为可替换变量，而不是把可能过时的固定数值写死。

## 二十二、核心公式

> **Seedance执行Prompt = Project Master + Asset Reference + Start State + Action + Camera + Environment + Time Sequence + End State + Continuity Control。**
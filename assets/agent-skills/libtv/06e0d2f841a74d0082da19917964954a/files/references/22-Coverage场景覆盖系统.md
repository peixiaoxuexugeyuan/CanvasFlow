# 22 Coverage 场景覆盖系统

> 定位：Coverage是把一个“场景”拍完整的摄影导演方法。03号解决单镜头取景，15号解决Blocking，21号解决剪辑，本库解决**一场戏应该准备哪些镜头，以及这些镜头如何互相替代、补充、覆盖、保护剪辑自由度**。
>
> 核心原则：**先覆盖叙事，再追求风格；先建立空间，再深入情绪；先保证可剪，再增加高级镜头。**

## 一、Coverage三层

### A层：安全覆盖

保证场景“能剪出来”。

### B层：叙事覆盖

为关系、信息、道具、反应提供专门镜头。

### C层：风格覆盖

加入特殊机位、特殊运动、视觉隐喻、过场镜头。

## 二、标准Coverage组成

镜头主要功能Establishing Shot建立环境Master Shot一场戏的完整空间母镜头Two Shot双人关系OTS AA视角中的BOTS BB视角中的ASingle AA独立表演Single BB独立表演CU / ECU情绪峰值Reaction聆听/反应Insert关键道具/信息Cutaway节奏/遮盖

## 三、对话戏Coverage模板

### 标准结构

```text
Master
→ A/B Two Shot
→ A OTS
→ B OTS
→ A Single
→ B Single
→ Reaction
→ Insert
→ Detail / Cutaway
```

不要求全部生成，应根据戏剧需要裁剪。

## 四、Coverage选择依据

### 对话内容普通

以Master + OTS + Reaction为主。

### 情绪爆发

增加CU/ECU，减少不必要宽景。

### 权力博弈

增加低机位/高机位、前后关系、距离变化。

### 信息隐藏

增加Reaction First、Insert、遮挡镜头。

### 关系亲密

使用更近距离、更弱前景隔离、更稳定视线。

## 五、动作戏Coverage

```text
Wide / Master：确定战斗地理
Medium：动作执行
Close：接触/冲击
Reaction：受击/心理
Wide：重新确认双方空间
Insert：武器/关键物件
```

**16号武打库优先负责动作设计，本库负责拍摄覆盖。**

## 六、产品广告Coverage

```text
Hero Wide
→ Hero Medium
→ Detail
→ Macro / Texture
→ Interaction
→ Lifestyle
→ Pack / Logo
```

## 七、人物情绪戏Coverage

先建立空间，再逐渐减少空间信息：

> WS → MS → MCU → CU → ECU

不一定按完整阶梯推进，核心是：

> **景别缩小 = 环境信息减少 = 内心信息增加。**

## 八、Master Shot的功能

Master不是“必须最长的镜头”，而是：

> **能让剪辑重新找到空间逻辑的镜头。**

一个优秀Master至少明确：

- 谁在哪里
- 谁和谁是什么关系
- 主要出入口在哪里
- 主体朝向
- 空间方向
- 主要动作发生在哪里

## 九、Shot Redundancy镜头冗余

冗余不是坏事。

### 有价值冗余

- 同信息不同景别
- 同动作不同视角
- 主镜头+保护镜头

### 无价值冗余

- 三个镜头都提供同样信息
- 只是换焦段，没有叙事差异
- 大量近景导致空间丢失

## 十、Coverage与剪辑自由度

Coverage越完整，剪辑越有自由度；但镜头越多，AI生成成本和一致性风险越高。

因此建议建立：

### Minimum Coverage

最少镜头即可完成场景。

### Editorial Coverage

增加反应、插入镜头、Cutaway，提高剪辑自由度。

### Prestige Coverage

加入风格化镜头，提高视觉辨识度。

## 十一、Coverage Matrix

```text
                 空间   关系   情绪   信息   动作   剪辑保护
Master             ✓      ✓      △      △      ✓      ✓
Two Shot           ✓      ✓      ✓      △      △      ✓
OTS                △      ✓      ✓      △      △      ✓
Single             △      △      ✓      ✓      △      ✓
CU/ECU             ×      △      ✓✓     ✓      ×      ✓
Insert             ×      ×      △      ✓✓     △      ✓
Reaction           ×      ✓      ✓✓     ✓      ×      ✓✓
Cutaway            ✓      △      △      △      ×      ✓✓
```

## 十二、Coverage与180度规则

同一场景建立Axis后：

- OTS与Single保持相同视线逻辑。
- 角色屏幕方向保持稳定。
- 过轴必须有空间转向、镜头运动或明确视觉桥梁。

详见15号空间系统、05号连续性系统。

## 十三、Coverage与Blocking

每一个Coverage镜头必须读取同一个Blocking State：

```text
人物A位置
人物B位置
两人距离
身体朝向
头部朝向
眼神方向
道具位置
摄影机区
```

不能为了换角度而让人物“重新站一遍”。

## 十四、Coverage与AI生成策略

### T2V适合

快速测试Master、环境、简单关系。

### I2V适合

角色、服装、场景已经锁定的覆盖镜头。

### 首尾帧/参考图适合

要求人物和空间严格继承的复杂镜头。

## 十五、单场戏Coverage卡

```text
SCENE：
场景目的：
人物：
核心冲突：
空间Axis：
Master：
Safety Coverage：
Emotional Coverage：
Information Coverage：
Insert：
Cutaway：
风格镜头：
预计可剪路径：
```

## 十六、AI镜头组示例

### 双人对话

1. Master：两人坐在桌两侧。
2. Two Shot：关系建立。
3. A OTS：A讲话。
4. B Reaction：B没有回答，只握紧杯子。
5. Insert：杯口水面震动。
6. B CU：B终于抬眼。
7. A Reaction：A意识到B已经改变。

这一组的价值不是“镜头多”，而是每镜新增一个信息层。

## 十七、Coverage质量检查

1. 场景有没有一个可靠Master？
2. 人物关系有没有覆盖？
3. 关键情绪有没有Close-up保护？
4. 关键动作有没有Wide保护？
5. 重要道具有没有Insert？
6. 没有对话时有没有Reaction/Cutaway？
7. 每个镜头是否提供独立剪辑价值？
8. 镜头数量是否超过AI可控范围？

## 十八、核心公式

> **Coverage = 空间母镜 + 关系镜头 + 表演镜头 + 信息镜头 + 保护镜头 + 风格镜头。**
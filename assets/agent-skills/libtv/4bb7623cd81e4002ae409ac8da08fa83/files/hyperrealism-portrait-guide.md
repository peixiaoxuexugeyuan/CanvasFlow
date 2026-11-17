# 超写实人像生成指南（ANTI-PLASTIC/HYPER-REALISM协议）

## 目录

1. [核心原则](#核心原则)
2. [皮肤生物肌理规范](#皮肤生物肌理规范)
3. [眼球微观细节](#眼球微观细节)
4. [嘴唇自然纹理](#嘴唇自然纹理)
5. [人脸不对称规则](#人脸不对称规则)
6. [相机与画质参数](#相机与画质参数)
7. [布光方案](#布光方案)
8. [负面提示词体系](#负面提示词体系)
9. [完整提示词模板](#完整提示词模板)

---

## 核心原则

**ANTI-PLASTIC/HYPER-REALISM协议**：拒绝一切AI生成的塑料感、磨皮感、蜡质感和完美对称感。

### 绝对禁止

- 磨皮、美颜、光滑无瑕皮肤
- 蜡质油光、塑料假面
- 网红妆、假睫毛、美瞳
- 均匀肤色、无毛孔、无雀斑
- 光滑嘴唇（镜面油亮）
- 人脸对称完美
- 柔光滤镜
- 卡通、二次元、油画感

### 必须保留

- 全皮肤生物肌理
- 随机不规则毛孔
- 面部细软绒毛（毳毛）
- 肤色自然不均匀
- 天然瑕疵（雀斑、小痣、晒斑）
- 皮下血管可见
- 自然出油光泽
- 人脸天然不对称

---

## 皮肤生物肌理规范

### 毛孔与绒毛

- 全脸随机不规则毛孔，不重复、不网格化
- 脸颊、额头有细软白色毳毛（绒毛）
- 边缘硬光可以照出绒毛轮廓（轮廓光打亮绒毛）
- 绒毛根根分明，有自然毛躁感

### 肤色不均匀

- 轻微晒斑、肤色斑驳
- 太阳穴、眼下透出淡青皮下血管
- 鼻翼红血丝明显
- 面中可分布浅棕细碎天然雀斑（集中在鼻梁、苹果肌）

### 油脂分布

- T区（鼻子、额头）有淡淡的自然出油光泽
- 脸颊两侧偏哑光
- 明暗光影凸显皮肤凹凸地形

### 颈部与锁骨

- 脖颈、锁骨肌肤同样保留细微毛孔
- 可有零星小痣
- 锁骨骨骼线条柔和清晰

---

## 眼球微观细节

### 虹膜

- 虹膜内部纤维纹理杂乱清晰
- 纹理不规律、不对称
- 颜色有自然渐变和深浅层次

### 眼白

- 眼白布满清晰红血丝
- 血丝分布不规则、有粗细变化

### 泪膜与卧蚕

- 下眼睑有泪液反光
- 卧蚕饱满自然

### 睫毛

- 睫毛纤长自然
- 不是浓密假睫毛
- 根根分明、有深浅层次

---

## 嘴唇自然纹理

- 天然薄厚适中唇形
- 唇部带有自然竖唇纹
- 轻微干纹、细微起皮
- 高光斑驳不均（不是镜面油亮）
- 唇色自然（裸粉水润或低饱和）

---

## 人脸不对称规则

- 保留人脸天然不对称瑕疵
- 左右眉毛可有细微高低差
- 左右眼大小可略有不同
- 嘴角自然状态可不对称
- 雀斑、小痣分布左右不均
- 拒绝"完美对称"的AI默认倾向

---

## 相机与画质参数

### 推荐相机

- 索尼A7S3（或同级别电影机）
- RAW电影质感
- 8K超清
- 4K 60fps

### 关键设置

- override全部AI平滑降噪
- 关闭AI平滑
- 全画面皮肤微观纹理拉满
- 极致细节

### 画质关键词

```
8K超清，索尼A7S3相机拍摄，RAW电影质感，4K 60fps，override全部AI平滑降噪，极致细节，关闭AI平滑，全画面皮肤微观纹理拉满
```

---

## 布光方案

### 正午自然光方案

- **光源**：正午室外柔和顶侧自然光，非暴晒硬顶光，带通透漫射日光
- **轮廓光**：硬轮廓边缘光打在侧脸、发丝边缘，形成清晰金边轮廓光
- **正面补光**：均匀柔和的正午天光补光，明暗层次丰富
- **背景**：纯色哑光浅米白墙面，细微水泥墙颗粒质感，干净不抢主体

### 轮廓光效果

- 边缘硬光可以照出面部绒毛轮廓
- 发丝边缘形成金边
- 凸显皮肤凹凸地形

---

## 负面提示词体系

### 通用反塑料负面词（必加）

```
塑料脸，磨皮，美颜，光滑无瑕皮肤，蜡质油光，网红妆，假睫毛，美瞳，均匀肤色，无毛孔，无雀斑，光滑嘴唇，卡通，二次元，油画，模糊，低分辨率，畸形五官，多余手指，杂乱背景，假发质感，人脸对称完美，柔光滤镜
```

### 人像专用负面词

```
娃娃脸，婴儿肌，瓷肌，奶油肌，水光肌过度，镜面唇，玻璃唇过度，塑料感，CG感，游戏角色感，手办感，人偶感，过度锐化，过度HDR，过度饱和
```

---

## 完整提示词模板

### 单人肖像模板（中文）

```
正午自然光，8K超写实微距人像，[年龄][种族]少女/少年，[发型描述]，[眉毛描述]，[眼睛颜色]眼睛，[面部特征如雀斑]；[配饰描述]；[构图如胸肩特写竖构图]；ANTI-PLASTIC反塑料质感，拒绝磨皮蜡面，皮肤完整生物肌理，随机不规则毛孔，下颌额头细软绒毛被轮廓光打亮；肤色斑驳不均，轻微晒斑，眼下太阳穴可见青绿色皮下血管，鼻翼红血丝；T区轻微天然出油光泽，脸颊哑光；眼球虹膜布满纤维纹路，眼白红血丝清晰，眼下泪膜反光；嘴唇带有竖干纹、细微起皮，高光零散；[光线描述]，[背景描述]；索尼A7S3，电影RAW画质，极致细节，关闭AI平滑，全画面皮肤微观纹理拉满，人脸自然不对称，无美颜，无网红质感
```

### 单人肖像模板（英文）

```
Noon natural light, 8K hyper-realistic macro portrait, [age] [ethnicity] young woman/man, [hairstyle], [eyebrow description], [eye color] eyes, [facial features like freckles]; [accessories]; [composition like chest-shoulder close-up vertical]; ANTI-PLASTIC hyper-realism, reject skin smoothing and wax-like finish, complete skin biological texture, random irregular pores, fine vellus hair on jaw and forehead illuminated by rim light; uneven skin tone with slight sun spots, visible blue-green subcutaneous veins under eyes and temples, visible blood vessels on nose wings; slight natural oil sheen on T-zone, matte cheeks; iris filled with fiber patterns, clear bloodshot sclera, tear film reflection under eyes; lips with vertical dry cracks, slight peeling, patchy highlights; [lighting description], [background description]; Sony A7S3, cinematic RAW quality, extreme detail, AI smoothing disabled, full-frame skin micro-texture maximized, naturally asymmetric face, no beauty filter, no influencer aesthetic
```

### 负面提示词（必加）

```
plastic face, skin smoothing, beauty filter, flawless skin, waxy shine, influencer makeup, false eyelashes, colored contacts, uniform skin tone, no pores, no freckles, smooth lips, cartoon, anime, oil painting, blurry, low resolution, deformed features, extra fingers, messy background, wig texture, perfectly symmetric face, soft light filter, doll face, baby skin, porcelain skin, cream skin, excessive water glow, mirror lips, excessive glass lips, plastic look, CG look, game character, figurine look, puppet look, over-sharpened, over-HDR, over-saturated
```

---

## 使用时机

本指南在以下情况自动激活：

1. **人物表情检测触发时**：确保面部细节符合超写实标准
2. **角色资产卡生成时**：皮肤、眼球、嘴唇细节按本规范描述
3. **用户明确要求写实人像时**：直接应用ANTI-PLASTIC协议
4. **七段式镜头输出涉及人物特写时**：追加超写实画质关键词

## 与其他模块的协同

- **与情绪表情库协同**：情绪描述 + 超写实皮肤细节 = 真实可信的人物表演
- **与去AI感工程协同**：本协议是去AI感在人像领域的具体落地
- **与胶片质感基线协同**：相机参数可替换为胶片相机（如IMAX 65mm），保留超写实皮肤规范

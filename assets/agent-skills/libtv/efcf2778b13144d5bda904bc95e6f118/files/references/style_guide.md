# 纸艺风格动画核心风格指南

## 1. 核心风格定义

该 skill 的纸艺动画不是普通卡通，也不是写实 3D，而是：

**平整分层纸艺 + 手工剪纸 + 薄卡纸厚度 + 微缩剧场 + 微距视差 + 定格动画质感。**

视觉应像一个真实手工搭建的纸艺舞台或立体书场景，被微距镜头拍摄下来。

重要边界：**不要波楞纸，不要瓦楞纸，不要纸箱粗糙纹理，不要条纹波纹纸截面。**

## 2. 必须体现的视觉元素

### 材质

- 平整哑光卡纸质感。
- 轻微纸张纤维，但不要粗糙纸箱纹理。
- 手工裁剪边缘。
- 薄卡纸厚度清晰可见。
- 可出现轻微折痕、纸边毛边、拼贴痕迹。
- 不要出现瓦楞纸层、波纹横截面、纸箱边缘蜂窝结构。

### 层次

- 前景、中景、背景由多层平整纸片堆叠。
- 层与层之间有真实距离。
- 镜头移动时要产生视差。
- 画面像微缩舞台、纸艺透视盒、立体书 pop-up book。

### 光影

- 层与层之间有明显 drop shadow。
- 阴影帮助观众看见薄纸片厚度。
- 使用工作室柔光，不要过度电影化高反差光。
- 画面整体干净、可爱、手工感强。

### 动画

- 模拟 stop-motion 定格动画。
- 动作略有跳帧感，不要过分丝滑。
- 角色/物体像纸偶或可动纸片。
- 可有轻微机械感、摆动感、手工移动感。

### 镜头

- 微距摄影感。
- 轻微推近、横移、竖移或穿过前景纸片。
- 镜头运动服务于视差，不要过度炫技。

## 3. 资产一致性原则

动画生成前应先建立资产参考：

1. 角色三视图：正面、侧面、背面。
2. 场景三方向：正面、正面调转 90°、正面调转 180°。
3. 道具参考：单独呈现关键道具的形状、颜色、层次和材质。

后续镜头提示词必须引用已确认资产，例如：

- same orange kitten as the approved front/side/back character reference sheet
- same miniature paper garden as the approved front/90-degree/180-degree scene reference
- same paper butterfly prop as the approved prop reference

## 4. 通用主提示词

### 中文版

3D 立体分层纸艺风格动画，手工剪纸艺术，平整薄卡纸层层叠放，微缩纸艺剧场，立体书 pop-up book 质感，哑光纸张纹理和手工裁剪边缘，薄卡纸厚度清晰可见，前景中景背景分层明显，层与层之间有真实投影和阴影，色彩鲜艳但柔和，工作室柔光照明，微距摄影质感，轻微镜头推拉和平移，强烈视差深度感，定格动画风格，低帧率跳帧感，画面干净可爱，手工制作感。不要波楞纸，不要瓦楞纸，不要纸箱纹理。

### 英文版

3D layered papercraft animation, handcrafted paper cut art, smooth flat cardstock layers, thin matte paper sheets, miniature paper diorama theater, pop-up book style, visible subtle paper texture and hand-cut edges, clear thin cardstock thickness, strong foreground midground background separation, realistic drop shadows between paper layers, vibrant but soft colors, studio soft lighting, macro photography look, subtle camera push-in and pan, strong parallax depth effect, stop-motion animation style, low frame rate, slightly jumpy handmade movement, clean charming handcrafted look. No corrugated cardboard, no ribbed cardboard, no wavy cardboard, no shipping box texture.

## 5. 资产提示词模板

### 角色三视图

```text
Create a character reference sheet for [角色]. Three views: front view, side view, back view, aligned in one clean sheet. 3D layered papercraft style, handcrafted paper cut art, smooth flat cardstock layers, thin matte paper sheets, visible subtle paper texture, hand-cut edges, clear thin cardstock thickness, simple clean background, studio soft lighting, consistent colors and proportions. No corrugated cardboard, no ribbed cardboard, no wavy cardboard, no shipping box texture.
```

### 场景三方向

```text
Create an environment reference sheet for [场景]. Three views: front view, 90-degree rotated side view, 180-degree back view, showing the same miniature paper diorama environment from different directions. 3D layered papercraft style, smooth flat cardstock layers, hand-cut paper shapes, thin matte paper sheets, clear foreground midground background structure, realistic drop shadows between layers, consistent colors and scale. No corrugated cardboard, no ribbed cardboard, no cardboard box texture.
```

### 道具参考

```text
Create a clean prop reference sheet for [道具]. Show the prop clearly from front and slight side angle, with simple separated layout. 3D layered papercraft style, smooth flat cardstock layers, thin matte paper sheets, visible hand-cut edges, subtle paper texture, clean studio lighting, consistent colors. No corrugated cardboard, no ribbed cardboard, no rough shipping box material.
```

## 6. 镜头提示词模板

```text
[主体/角色/物体] 在 [场景] 中 [动作]。
Use the approved character reference sheet and approved environment reference sheet for consistency.
3D layered papercraft animation, handcrafted paper cut art, smooth flat cardstock layers, thin matte paper sheets, miniature paper diorama theater, pop-up book style.
Foreground: [前景纸艺元素]. Midground: [主体动作]. Background: [背景纸艺元素].
Visible subtle paper texture, hand-cut edges, clear thin cardstock thickness, matte paper material, realistic drop shadows between layers.
Studio soft lighting, macro photography look, subtle [push-in / pan / tilt] camera movement, strong parallax depth effect.
Stop-motion animation style, low frame rate, slightly jumpy handmade movement, clean charming handcrafted look.
No corrugated cardboard, no ribbed cardboard, no wavy cardboard, no shipping box texture.
```

## 7. 负面提示词

### 中文

照片级写实，真实皮肤纹理，真实动物毛发，塑料质感，金属质感，光滑 3D 渲染，普通卡通，过度电影感光效，复杂渐变，边缘模糊，材质不清晰，没有纸张纹理，没有层次阴影，背景杂乱，高帧率丝滑动画，真实人物，真实建筑，写实摄影，波楞纸，瓦楞纸，条纹纸板，纸箱纹理，粗糙纸箱材质，蜂窝纸板边缘。

### 英文

photorealistic, realistic skin texture, realistic animal fur, plastic texture, metallic texture, smooth 3D render, generic cartoon, overly cinematic lighting, complex gradients, blurry edges, unclear material, no paper texture, no layered shadows, cluttered background, high frame rate smooth animation, real human, real architecture, realistic photography, corrugated cardboard, ribbed cardboard, wavy cardboard, cardboard box texture, rough shipping box material, exposed corrugated edge, honeycomb cardboard edge.

## 8. 常见修正

- 如果画面太像普通 3D：加强 handcrafted paper cut、smooth flat cardstock、thin matte paper、hand-cut edges。
- 如果画面像波楞纸/瓦楞纸：加入 no corrugated cardboard、no ribbed cardboard、no wavy cardboard、no shipping box texture，并改用 smooth flat cardstock layers。
- 如果主体漂移：回到资产阶段，先生成角色三视图、场景三方向和道具参考。
- 如果画面太平：加强 foreground/midground/background separation、drop shadows、parallax。
- 如果动画太丝滑：加强 stop-motion、low frame rate、slightly jumpy handmade movement。
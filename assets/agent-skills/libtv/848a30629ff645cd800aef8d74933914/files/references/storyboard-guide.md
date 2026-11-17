# 分镜脚本与转场指南

---

## 90秒标准分镜表格

| 镜号 | 画面描述 | 镜头语言 | BGM段落 | 音效标注 | 时长 | AI提示词（中） | AI提示词（英） |
|------|---------|---------|---------|---------|------|--------------|--------------|
| S01 | 乐池管弦乐队全景 | 低角度仰拍乐池 | 序曲开场 | 调音声·指挥拍棒 | 5s | 百老汇剧场乐池，管弦乐队就位，指挥挥棒，低角度仰拍 | Broadway theater orchestra pit, musicians seated, conductor baton raised, low angle upward shot |
| S02 | 深红幕布关闭状态 | 正面中景幕布 | 序曲渐强 | 乐声渐强·幕布静默 | 3s | 深红丝绒幕布关闭，金色流苏，剧场内部全景 | deep red velvet curtain closed, gold tassels, theater interior full view |
| S03 | 幕布骤然拉开 | 正面大全景 | 序曲高潮 | 幕布滑动声·观众惊呼 | 4s | 幕布骤然拉开光线涌出全阵容亮相 | curtain sudden open light flooding full cast reveal |
| S04 | 群舞踢腿阵列 | 低角度仰拍 | 开场曲全编制 | 同步足声·管弦爆发 | 8s | 全阵容群舞齐舞阶梯排列同步踢腿 | full cast ensemble kick-line staircase formation synchronized |
| S05 | 领舞走至台前 | 追光跟随中景 | 领舞独唱旋律 | 追光机械声·脚步声 | 8s | 领舞演员华丽戏服追光跟随走至台前 | lead dancer theatrical costume spotlight follow to stage front |
| S06 | 独唱咏叹追光独照 | 正面特写主角 | 咏叹调抒情段 | 微弱呼吸声·弦乐轻柔 | 10s | 单束追光主角四周暗场，深情咏叹 | single spotlight lead actor surrounding darkness, emotional ballad |
| S07 | 灯光全亮合唱加入 | 正面大全景 | 咏叹调高潮 | 灯光切换声·合唱声浪 | 5s | 灯光全亮全员合唱加入声浪爆发 | full lights on full cast chorus joining sound wall explosion |
| S08 | 双人舞 | 侧面中景双人 | 双人舞Duet | 足尖轻步声·呼吸声 | 10s | 男女主角舞台中央华尔兹抒情舞步 | male female lead center stage waltz lyrical choreography |
| S09 | 追逐光影子投幕后 | 背面中景影子 | 双人舞高潮 | 管弦渐强·心跳感 | 5s | 双人舞追逐光跟随影子投在幕后 | duet dance spotlight following shadows cast on backdrop |
| S10 | 终幕大合唱 | 正面大全景 | 终曲Finale | 管弦全编制·合唱声浪 | 10s | 全员盛装站满舞台管弦全编制爆发 | full cast in regalia filling stage depth orchestral full explosion |
| S11 | 幕布缓缓合拢 | 正面中景幕布 | 终曲渐弱 | 幕布滑动声·歌声渐弱 | 5s | 幕布缓缓合拢歌声渐弱观众掌声预热 | curtain slowly closing music fading applause pre-building |
| S12 | 幕布完全合拢 | 正面中景定格 | 终曲最后一拍 | 幕布合拢声·掌声爆发 | 3s | 最后一拍幕布完全合拢定格掌声爆发 | final beat curtain fully closed freeze frame applause explosion |

---

## 3分钟扩展分镜结构

```
[开场序曲] 15s
  乐池全景→指挥挥棒→深红幕布→序曲渐强→幕布骤开

[群舞登场A] 25s
  幕布全开全阵容亮相→群舞踢腿阵列→领舞台前→追光跟随
  开场曲目全编制

[独唱咏叹A] 20s
  男主角独唱→追光独照→暗场→灯光全亮→全员合唱加入
  男声咏叹调

[双人舞] 20s
  男女主角相遇→抒情舞步→影子投幕后→拥抱定格
  抒情双人舞曲

[群舞登场B] 25s
  第二幕开启→新服装群舞→风格转换（黄金→现代）
  对应风格BGM

[独唱咏叹B] 20s
  女主角独唱→高音花腔→灯光变幻→情感爆发
  女声咏叹调

[反派独唱] 20s
  反派登场→烟雾中出场→诱惑独唱→群舞被吸引
  反派咏叹调

[终幕大合唱] 30s
  全员盛装→站满舞台→管弦全编制→合唱声浪→幕布合拢→掌声
  终曲Finale全编制

[谢幕Curtain Call] 15s
  幕布重新拉开→全员谢幕鞠躬→主角向前→观众席灯光亮起→掌声雷动
  谢幕音乐Reprise
```

---

## 转场清单（8种百老汇舞台转场）

| 转场类型 | 百老汇术语 | 视觉描述 | 使用场景 | 剪辑参数建议 |
|---------|----------|---------|---------|-------------|
| 幕布转场 | Curtain Transition | 红幕拉开/合拢，乐声与幕动同步 | 场景切换/段落进入/幕间 | Duration 0.5-1s / Ease-in-out |
| 追光切换 | Spotlight Crossfade | 追光从一人转向另一人，灯圈缩小/放大 | 独唱→双人舞→群舞 | Duration 0.3-0.5s / Hard cut |
| 黑场骤亮 | Blackout to Full | 黑场→全灯亮起，一拍完成 | 序曲高潮/终幕大结局 | Duration 0.5s / Linear brightness ramp |
| 旋转台切换 | Turntable Transition | 旋转台转动切换场景，演员在转动中定格 | 戏剧段落场景转换 | Duration 1-2s / Rotate Y-axis |
| 花瓣雨 | Magical Dissolve | 金箔/花瓣/烟雾从顶洒落，场景在粒子中切换 | 终幕庆祝/魔法场景/梦境切换 | Duration 1-2s / Particle effect overlay |
| 镜面反射 | Mirror Transition | 后墙镜面反射，演员在镜中"消失"换景 | A Chorus Line 式裸舞台 | Duration 0.8-1.5s / Mirror reflection morph |
| 文件翻页 | Parchment Wipe | 文件/羊皮纸效果切换，历史感 | Hamilton 式历史叙事 | Duration 0.5-1s / Page turn transition |
| 霓虹闪烁 | Neon Flicker | 霓虹灯闪烁切换场景，夜城感 | 芝加哥/西区故事 式都市 | Duration 0.3-0.8s / Neon flicker cut |

---

## 字幕/文字叠加设计指南

| 文字类型 | 视觉风格 | 字体建议 | 示例 |
|---------|---------|---------|------|
| 剧目名称 | 金色衬线字体·大字号·居中 | Playfair Display 48-60 / 思源宋体 金色 | OKLAHOMA! |
| 角色名字 | 白色无衬线·小字号·下对齐 | Helvetica 16-20 / 思源黑体 白色 | CURLY |
| 经典歌词 | 白色衬线·中等字号·字幕式 | Georgia 24-28 / 思源宋体 白色 底部1/4 | "The hills are alive..." |
| 时代标注 | 金色粗体·右上角 | Impact 36-48 / 优设标题黑 金色 | BROADWAY 1956 |
| 幕布字幕 | 金色3D浮雕·幕布上居中 | Playfair Display Bold 72-96 / 思源宋体 金色3D | THE MUSICAL |

---

## 舞台设计术语中英对照

| 中文 | 英文 | 说明 |
|------|------|------|
| 镜框式舞台 | Proscenium arch stage | 传统百老汇剧场标准舞台框架 |
| 天幕 | Cyclorama (cyc) | 舞台后墙弧形白幕，用于投影/灯光 |
| 旋转舞台 | Revolving stage / Turntable | 中央旋转平台，Hamilton/Les Mis核心装置 |
| 升降台 | Fly loft / Flying rig | 演员/道具从上方降下 |
| 乐池 | Orchestra pit | 舞台前方凹陷乐队区域 |
| 防火梯 | Fire escape | West Side Story核心布景 |
| 化装舞会 | Masquerade | Phantom核心场景 |
| 镜面墙 | Mirror wall | A Chorus Line核心布景 |
| 翡翠城 | Emerald City | Wicked核心布景 |
| 地下湖 | Underground lake | Phantom核心布景 |
| 街垒 | Barricade | Les Mis核心布景 |
| 红磨坊风车 | Moulin Rouge windmill | Moulin Rouge!核心标志 |
| 狮子王岩石 | Pride Rock | The Lion King核心平台 |
| 冥界列车 | Hell Train | Hadestown核心道具 |

# 部件卡2 · Camera operation

## 可观察结果优先原则（2026-08-07新增·执行层规则）
```
镜头/光效/材质语言以可观察结果为主（CINEDANCE原文：Seedance responds better to
observable lens results than to camera metadata）：
  ✅ 写「背景压缩成奶油bokeh、前景虚化占画面下1/3」→ 不写「85mm f1.4」
  ✅ 写「高反差强明暗对比、亮部可见暗部压死黑」→ 不写「光比1:8」
  技术参数（mm/f-stop/ISO/光比数值）仅作辅助风格锚，不作主控制，且必须伴随可观察结果描述。
  （Hell Grind真实项目也用「85mm T1.8」——参数可保留，但不可单独出现）
【句内嵌套≤2层】（2026-08-07新增）
  ✅「手背横向旧疤在仪表盘冷光下一闪而过」
  ❌「当他在看着那道在灯光下闪过的疤的时候」——长句拆短句，一句一个动作，嵌套>2层=退回。
```

## 万物生原版（对照用，写详细）
```
Camera operation: handheld documentary-style low-angle camera held by a real human operator
walking backwards in front of the subject, with pronounced visible handheld instability throughout,
the frame floating and bouncing with the operator's backward steps on uneven sand, frequent small
unintentional bumps and corrections, constant breathing micro-shake on top of the larger bouncing
motion, organic unsteadiness that is intentionally amplified.
```
照这个写：手持方式+不稳感+呼吸微震+量级，一整段描述，只写"固定"或"L3"不合格。

## 相机五级制（速查）
| 级别 | 名称 | 适用 | 写法示例 |
|:--:|:----|:----|:----|
| L1 | 机械臂运镜（绝对平稳） | 史诗揭示/升降/环绕华彩 | 「镜头以平滑的机械臂运镜起手，平稳流畅地tilt up」 |
| L2 | steadicam glide（平稳滑行） | 行走/移动跟拍 | 「smooth stabilized steadicam dolly-back tracking at constant velocity」 |
| L3 | 手持呼吸微晃 | 文戏/静态/对话 | 「subtle micro-jitter with breathing motion」 |
| L4 | 剧烈手持 | 打斗/动作 | 「aggressive handheld — violent shaking on impact」 |
| L5 | 极端不稳定POV | 追逐/第一视角 | 「极不稳定，仿佛随时会被甩掉」 |

## 模式区分（2026-08-06照万物生重写）
- 模式A 一镜到底（单镜头组）：Camera operation在组头声明（一行，写详细：手持方式+不稳感+量级）
- 模式B 切镜头（多镜头组）：无独立Camera operation块；共用运镜装置（环绕弧线/匹配剪辑类型）声明进[STYLE LOCK]；各子镜头运镜在每镜入口行一句话（景别+机位角度/位置+运镜质感+节奏四要素）
❌ 模式B写独立Camera operation块 → 与万物生切镜头版不符

## 入口行四要素（模式B每镜开头必写，照万物生）
景别+机位角度/位置+运镜质感+节奏，一句话，缺质感或节奏=退回。
原句示例：
「中近景，略带俯角、轻微手持晃动的机位，快节奏。」
「中景，侧面、轻微手持晃动跟拍的机位，快节奏。」
「远景，固定机位，纯正侧面水平视角拍摄。」
「极低机位、近乎贴地的中近景，镜头先固定。」
「特写（extreme close-up），固定机位。」

## 反应式运镜句（仅L4-L5可用）
镜头被惯性甩向X/被猛地拽回/对焦短暂失焦又恢复/被迫快速仰起。

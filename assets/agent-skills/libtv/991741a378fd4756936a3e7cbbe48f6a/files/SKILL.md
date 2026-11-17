```
# 真人口播封面设计

## 目标与交付形态
产出信息流里能抓点击的口播封面：人物表情与标题金句承担信息，场景与配色承担氛围。默认交付一套两张——3:4 竖版 + 4:3 横版，同一设计语言在两种比例下重新排布；用户只指定单一比例时从其要求。

## 输入清单（动手前收齐）
1. 主标题文案：逐字采用用户原话，不改写不补写；建议 ≤2 行、单行 ≤12 字。
2. 城市/地点标签：参考封面均带城市徽章（胶囊/飘带/六角形），属模板固有位；用户未提供时在统一提问中确认是否加、加什么城市。
3. 副文案 slogan（可选）：手写体小字，逐字采用。
4. 人物素材：1–3 人照片作为身份锚点；没有则走"锚点生成"流程。
5. 风格预设：从下方六族中选一；主题映射到多族时用 ask_human 推荐确认。
6. 比例：默认 3:4 + 4:3 双版；用户指定单版时从用户。

缺主标题、城市标签取舍或人物来源时，合并为一次 ask_human（≤3 问），选项给 3 个推荐 + 1 个自填。

## 风格预设（六族）
每族固定四件套：配色、标题字法、背景场景、装饰元素。

- A 烟火探店：霓虹夜市/街景，红金高饱和；巨幅毛笔书法标题配墨迹火焰笔触；前景底部放食物或产品道具；人物姿态夸张互动。
- B 温暖手写：明亮暖调办公室/居家；橙+奶白；手写马克笔标题配贴纸色块下划线；城市飘带标签；爱心星星手绘点缀；人物微笑坐姿。
- C 金句书房：书架/图书馆场景；两支系——暖棕木色+金色书法标题，或深蓝藏青+金色衬线标题配细线框；书籍、地球仪、笔记本等学术道具；人物谈话手势或交握坐姿。
- D 商务科技：深色高管办公室/城市夜景玻璃幕；蓝白渐变粗黑体标题带辉光；蓝色胶囊城市标签；构图克制；人物正装自信姿态。
- E 城市愿景：白昼城市天际线+雪山；蓝色笔刷标题配黄色点缀笔触；城市名置于破折号之间；人物持话筒演讲姿态。
- F 科技号召：明亮蓝天城市全景；白蓝渐变科技标题带轨道/ai 符号；流光线条+底部线稿城市剪影；六角/胶囊城市标签；多人并排站姿。

## 版式规则
- 3:4 竖版：标题块占顶部约 30%（1–2 行，可微倾斜），城市标签紧贴标题下方；人物半身居中下占画面约 60%；副文案手写小字放人物侧边留白；装饰收在底部边缘。
- 4:3 横版：标题放上缘横带或左上/右上留白（优先 1 行），城市标签在标题下或标题组居中；人物半身居中或右半；副文案放侧边留白；装饰沿底边。
- 通用：标题与人物互不遮压；标题必带描边/投影/辉光保证可读；背景适度虚化衬托前景。

## 一致性（成套的关键）
3:4 与 4:3 是同一封面的两种比例，不是两次独立创作：人物身份、服装、场景、配色、标题字法与文案完全相同，仅构图按比例重排。
- 用户给了人物照片：两张生成都把照片放进 reference_image_urls，prompt 写明"保持参考图中人物身份与服装一致"。
- 没有人物照片：先用 generate_media_v3 生成 1 张锚点定妆图（人物+场景+所选风格，3:4），经 ask_human 给用户确认后，再作为两张比例图的共同参考。
- 两个比例的生成在同一轮并行发起，参考集完全相同。

## 生成流程
1. 按输入清单收齐信息；缺口合并一次 ask_human。
2. 锁定风格预设；用户另给风格参考图时放入 reference_image_urls，prompt 注明"仅参考其版式/字法/配色"。
3. 备好锚点（用户照片，或已确认的生成锚点）。
4. 并行两次 generate_media_v3：aspect_ratio 分别 3:4 与 4:3；prompt = 逐字主标题 + 城市标签 + 该风格的四件套描述 + 对应比例的版式规则 + 一致性声明；reference_image_urls = 人物照片/锚点（+风格参考）。
5. 自检：标题逐字无误、无乱字缺字；人物身份两版一致；城市标签清晰。标题出错时用 edit_media_v3 edit_image 只修文字区域，或重生成一次。
6. 交付双版成套，说明所用风格预设与本次输入，方便下次复用。

## 文字规则
- 主标题、城市名、副文案一律逐字来自用户输入，不发明文案。
- 标题 ≤2 行；关键词用换色/放大/笔触强调（参考封面普遍强调关键词，如"更重要""无量"异色）。
- 标题字法必须匹配所选预设（书法/手写/衬线/科技渐变），不混用。

## 资源（参考封面）
以下为本技能的参考封面，按风格族分组。用户点名"照第 N 张的感觉"或需要校准预设时，将对应 URL 放入 reference_image_urls 作风格/版式参考，并在 prompt 注明"仅参考版式、字法、配色，人物以用户提供照片为准"，不得复制参考图中的人脸：
- A 烟火探店：https://xla-persist.xingliu.art/artifacts/user/l19TRldE6nIn4zhg.png
- B 温暖手写：https://xla-persist.xingliu.art/artifacts/user/4XMK5Gl7PTGDN4Gn.png 、 https://xla-persist.xingliu.art/artifacts/user/7U30c1Xn383WHI0g.png
- C 金句书房：https://xla-persist.xingliu.art/artifacts/user/kiBdkFjArBByakgo.png 、 https://xla-persist.xingliu.art/artifacts/user/PJgqvTtVSDFBzr8I.png 、 https://xla-persist.xingliu.art/artifacts/user/WC8evaipk284oGz7.png 、 https://xla-persist.xingliu.art/artifacts/user/MyW2A9Ibmi5LH0Q1.png
- D 商务科技：https://xla-persist.xingliu.art/artifacts/user/mUxYPfMY4l7hBYYt.png 、 https://xla-persist.xingliu.art/artifacts/user/J15c8nuaSmJ7U9ew.png
- E 城市愿景：https://xla-persist.xingliu.art/artifacts/user/E4KOF7u3Y0Ir350W.png 、 https://xla-persist.xingliu.art/artifacts/user/prsRGFC3Aw3ZaYK3.png
- F 科技号召：https://xla-persist.xingliu.art/artifacts/user/wPwPQtrgFWGQjqys.jpg 、 https://xla-persist.xingliu.art/artifacts/user/h46tsh8FTjCVoxxX.jpg

## 关键约束
- 默认交付 3:4 + 4:3 成套两张；用户指定单比例时从用户。
- 没有主标题文案不生成；没有人物身份来源（照片或已确认锚点）不生成双版。
- 风格参考图只借版式/字法/配色，不搬参考封面的人脸。
- 所有澄清合并为一次 ask_human，不超过 3 问。
```
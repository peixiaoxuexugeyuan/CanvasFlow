# 可复制交付模板

## A. 输入与阻塞项

```yaml
project:
  use: "商业广告 / 电商主图 / 转台视频 / 其他"
  duration_and_format: ""
  delivery_platform: ""
product:
  dimensions: ""
  geometry_anchor: ""
  protected_text_or_logo: ""
  materials:
    - area: ""
      type: "透明玻璃 / 亮面非金属 / 抛光金属 / 拉丝金属 / 其他"
      must_show: ""
camera:
  framing_and_lens: ""
  height_distance: ""
  locked: true
motion:
  product_or_camera: ""
  start_end: ""
  repeatable: "yes / no / unknown"
space:
  size_and_surface_colors: ""
  can_black_out: "yes / no"
available_tools: []
known: []
unknown: []
assumptions: []
blockers: []
```

## B. 材质与卖点证据表

区域材质必须看见允许隐藏英雄高光证明什么禁止反射验证方式例：瓶肩透明玻璃厚度与弧度背面轻微细节双侧渐变说明曲率摄影机、人员深浅背景各看一次

## C. 五姿态连续性表

姿态轮廓英雄高光位置标签摄影机倒影材质线索结论/修复0%25%50%75%100%

## D. 反射地图

```text
俯视图：
                 [背景/背光]
         [英雄白卡]  [辅助白卡]
              \      /
               [产品]  ← 旋转轴/方向
          [黑旗]  [黑旗]
                 [相机]

正视图：
- 受保护标签区域：
- 英雄高光起止：
- 摄影机窗口：
- 人员禁区：
- 运动时变化：
```

## E. 高光与器材等价表

功能目标形状首选方案低预算等价变量测试风险英雄高光连续长条渐变大面积柔光幕安全固定的扩散布/白墙反射距离、面积、角度一次改一项不均匀、入镜

## F. 分层拍摄/生成表

层/镜头保留关闭/隐藏产品与机位锁定提示或动作合成注意轮廓层玻璃边缘标签补光是边缘与折射标签层原始授权文字英雄高光是逐字比对

## G. AI 图片/视频提示模板

```text
无品牌原创产品；保持【几何锚点、比例、材质分区、标签占位】固定。
机位：【视角、焦段感、机位高度、裁切】。
运动：【产品或摄影机、起点、终点、速度、时长】。
材质证明：【透明度、厚度、拉丝方向、倒角或液体颜色】。
英雄高光：【形状、宽度、软硬、起点、运动路径】。
允许反射：【经过设计的白/灰/黑渐变】。
禁止反射：【摄影机、人员、房间杂物、来源不明光斑】。
标签：【保留空白占位，后期合成授权原稿；不要生成文字】。
连续性：在 0%、25%、50%、75%、100% 姿态保持产品身份与高光路径连续。
输出：【画幅、时长、帧率、用途】。
```

## H. 症状诊断

症状证据可能原因最小修复复检帧/尺寸结果

## I. 验收报告

```yaml
inspection:
  viewed_at_100_percent: false
  viewed_at_delivery_size: false
  key_poses_checked: [0, 25, 50, 75, 100]
  geometry_consistent: false
  hero_highlight_continuous: false
  protected_text_exact: false
  unintended_reflections_removed: false
  glass_or_metal_still_reads: false
  compositing_edges_and_motion_clean: false
remaining_risks: []
stop_conditions_triggered: []
decision: "pass / revise / stop"
```
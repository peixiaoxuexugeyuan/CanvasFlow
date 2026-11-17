{
  "skill_name": "Sports_Premium_Unified_Pack",
  "skill_title": "高端赛事统一视觉包装资产系统",
  "version": "2.1",
  "mode": "one_shot",
  "description": "一套同源设计语言的高端赛事包装资产，支持多风格预设切换，全程规避廉价感；分为氛围海报类、视频叠层组件类、信息卡片类；所有资产共享统一字体层级、网格秩序、材质逻辑；叠层组件适配AE直接叠加使用，海报类适合宣传片、大屏、宣发物料。",
  "style_selector": {
    "style_preset": "{{style_preset}}",
    "style_preset_options": [
      "grand_prix_luxury",
      "dark_cinematic",
      "neon_luxury",
      "retro_luxury",
      "royal_awards",
      "data_precision"
    ],
    "style_definition": {
      "grand_prix_luxury": "【默认基准】顶级竞速/全明星赛事，深炭黑基底、金属金为主、银灰为辅，克制轮廓光、少量体积光，真实碳纤维/拉丝金属材质，庄严仪式感，fx_intensity=low",
      "dark_cinematic": "暗调电影质感，冷调主光源，低饱和，厚重阴影，适合纪录片、赛事回顾，fx_intensity=low",
      "neon_luxury": "轻奢霓虹，深蓝黑底色，蓝紫霓虹仅作为线条点缀，搭配金色收边，禁止大面积荧光铺色，玻璃+哑光金属结合，fx_intensity=low",
      "retro_luxury": "复古高级，暖胶片颗粒、旧金、哑光古铜，老式赛事海报构图，无网红滤镜，fx_intensity=low",
      "royal_awards": "颁奖盛典，黑金+酒红丝绒质感，精致细金属边框，庄重隆重，fx_intensity=low",
      "data_precision": "专业数据向，冷黑+冰蓝银灰，极简HUD线条，半透明磨砂面板，线条克制，适合复盘、数据统计，fx_intensity=low"
    },
    "color_system_preset": "{{color_system_preset}}",
    "light_preset": "{{light_preset}}",
    "material_preset": "{{material_preset}}",
    "texture_preset": "{{texture_preset}}",
    "composition_preset": "{{composition_preset}}",
    "fx_intensity": "{{fx_intensity}}"
  },
  "global_rules": {
    "core_principle": "高级克制优先，拒绝堆砌特效；同一套字体骨架、信息层级、网格秩序贯穿全部资产，切换风格仅改变色彩、光影、材质，不改变排版逻辑",
    "font_spec": "主标题：粗压缩无衬线；副标题：中等字重无衬线；信息正文：高可读常规无衬线；标签：小型大写窄体；禁止圆润卡通字体、手写花体；文字抗锯齿干净锐利",
    "poster_rule": "氛围优先，主体突出，光影统一；文字放置安全区，不遮挡主体核心（人脸、座舱、运动员躯干）；允许适度轮廓光、少量体积光",
    "overlay_rule": "【强制约束】信息可读性最高，背景低干扰，禁止强场景、大面积粒子、炫光；fx_intensity强制锁定low；预留logo/队徽/国旗安全放置位；适合视频上层叠加",
    "mark_rule": "极简识别，图形浓缩，小尺寸清晰，无多余装饰",
    "quality_rule": "商业后期合成标准，材质物理真实，明暗层次扎实，暗部保留细节，亮部不过曝，色彩低饱和，细腻可控电影颗粒",
    "global_negative": "塑料质感，玩具感，卡通渲染，荧光溢色，饱和度爆炸，杂乱光斑，厚白雾，AI涂鸦，手绘二次元，纸壳泡沫质感，虚假发光，文字变形，文字压主体，刺眼反光，脏乱噪点",
    "overlay_negative_extra": "复杂背景人物，大面积光轨，粒子爆炸，三维爆炸字，花哨渐变边框，装饰图形遮挡信息，文字溢出安全框"
  },
  "text_content": {
    "top_left": "",
    "top_right": "",
    "main_title": "",
    "sub_title": "",
    "slogan": "",
    "time_info": "",
    "location_info": "",
    "season_info": "",
    "team_a_name": "",
    "team_a_sub": "",
    "team_a_stat": "",
    "team_b_name": "",
    "team_b_sub": "",
    "team_b_stat": "",
    "left_name": "",
    "left_sub": "",
    "right_name": "",
    "right_sub": "",
    "vs_text": "",
    "result_1st": "",
    "result_2nd": "",
    "result_3rd": "",
    "stat_label_1": "",
    "stat_value_1": "",
    "stat_label_2": "",
    "stat_value_2": "",
    "stat_label_3": "",
    "stat_value_3": "",
    "tag_live": "",
    "tag_replay": "",
    "tag_highlight": "",
    "tag_round": "",
    "tag_stage": ""
  },
  "assets": [
    {
      "id": "kv_21_9",
      "name": "主KV 21:9",
      "ratio": "21:9",
      "category": "poster",
      "style_rule": "宽屏电影构图，主体宏大，留白充足，标题层级突出，适合片头大屏、主视觉"
    },
    {
      "id": "poster_16_9",
      "name": "横版海报 16:9",
      "ratio": "16:9",
      "category": "poster",
      "style_rule": "均衡构图，信息完整，适合预告片、社交横版宣发"
    },
    {
      "id": "cover_9_16",
      "name": "竖版封面 9:16",
      "ratio": "9:16",
      "category": "poster",
      "style_rule": "主体居中，上下预留文字区，适配短视频封面"
    },
    {
      "id": "mark_1_1",
      "name": "方形标识 1:1",
      "ratio": "1:1",
      "category": "mark",
      "style_rule": "图形浓缩，极简，适合头像、话题封面、角标底版"
    },
    {
      "id": "hud_bar",
      "name": "HUD装饰条",
      "ratio": "custom",
      "category": "hud",
      "style_rule": "细线条、哑光金属质感，弱流光，仅作为分割点缀，不抢画面"
    },
    {
      "id": "transition_card",
      "name": "转场卡 16:9",
      "ratio": "16:9",
      "category": "transition",
      "style_rule": "大面积留白，主标题独立，干净低元素，用于章节过渡"
    },
    {
      "id": "lower_third_16_9",
      "name": "字幕条（下横条）16:9",
      "ratio": "16:9",
      "category": "overlay",
      "style_rule": "三区布局：左名称、中身份、右数据；半透深色底+细金属收边，预留标识位，文字优先可读"
    },
    {
      "id": "name_card_16_9",
      "name": "人名介绍卡 16:9",
      "ratio": "16:9",
      "category": "overlay",
      "style_rule": "主名字放大突出，副信息辅助；侧边预留队徽/国旗放置区域，背景弱渐变"
    },
    {
      "id": "score_bug_16_9",
      "name": "比分条 16:9",
      "ratio": "16:9",
      "category": "overlay",
      "style_rule": "双方信息对称，数字醒目，重点数值用主色点缀，结构规整，适合直播叠层"
    },
    {
      "id": "stat_card_3_4",
      "name": "数据卡 3:4",
      "ratio": "3:4",
      "category": "info",
      "style_rule": "数据标签与数值分区清晰，重点数据高亮，线条极简，适合图文传播"
    },
    {
      "id": "result_card_16_9",
      "name": "结果卡 16:9",
      "ratio": "16:9",
      "category": "result",
      "style_rule": "冠亚季军层级区分（金/银/古铜），排名优先，背景克制，无烟花爆闪特效"
    },
    {
      "id": "group_battle_card_16_9",
      "name": "组别对抗卡 16:9",
      "ratio": "16:9",
      "category": "battle",
      "style_rule": "阵营左右分割，阵营色克制区分，分组列表秩序工整"
    },
    {
      "id": "countdown_card_9_16",
      "name": "倒计时卡 9:16",
      "ratio": "9:16",
      "category": "countdown",
      "style_rule": "倒计时数字为视觉核心，其余信息轻量化，移动端阅读友好"
    },
    {
      "id": "title_card_16_9",
      "name": "章节标题卡 16:9",
      "ratio": "16:9",
      "category": "title",
      "style_rule": "章节标题独立，留白充足，用于段落开场"
    },
    {
      "id": "corner_bug_1_1",
      "name": "角标 1:1",
      "ratio": "1:1",
      "category": "bug",
      "style_rule": "徽章式极简图形，小尺寸识别清晰，适合画面角落长期叠加"
    },
    {
      "id": "vertical_info_card_9_16",
      "name": "竖版信息卡 9:16",
      "ratio": "9:16",
      "category": "info",
      "style_rule": "信息纵向排布，适合短视频平台选手介绍、赛制说明"
    }
  ],
  "output_note": "默认输出4K分辨率静态图，无多余裁切，PNG透明底优先给overlay类组件，海报类输出纯色合成底；可直接导入AE做后期包装"
}

{
  "skill_name": "TVC后期实拍镜头修补&动态接景",
  "skill_tag": ["TVC", "接景", "实拍修复", "扩景", "擦穿帮", "动态延伸"],
  "skill_description": "TVC后期合成专用工具，上传实拍关键帧，先选择风格参考、原镜头景别、匹配导演风格，完成边缘扩景、擦除穿帮、背景替换、动态镜头接景；严格对齐原图光影透视，快照可迁移Wan3.0生成连贯动态接景片段",
  "system_prompt": "基于上传实拍参考帧进行修补接景；必须严格对齐原图透视、地平线、光源方向、光影、色温、色调、胶片颗粒、镜头暗角；\n延伸区域构图气质匹配【风格参考】流派、原镜头景别与导演视觉风格；\n严禁修改、重绘实拍前景主体（人物、产品、实拍道具）；\n只在指定蒙版区域生成延伸环境，边缘融合自然，无拼接痕迹；\n支持超宽画幅2.39:1 / 5:1，输出素材适配AE、NUKE合成。",
  "negative_prompt_global": "改动实拍主体，产品变形，人脸改动，光影冲突，透视错位，边缘硬切割，拼接痕，画风割裂，色彩跳变，新增文字，水印，物体穿插扭曲，畸形道具，卡通，涂鸦",
  "form": [
    {
      "key": "style_reference",
      "label": "风格参考",
      "type": "select",
      "required": true,
      "options": ["写实商业广告", "A24电影美学", "韦斯安德森美学", "新中式美学", "极简产品静物", "复古胶片叙事", "赛博科幻", "自然治愈生活感", "工业硬核质感", "时尚时装大片"],
      "default": "写实商业广告"
    },
    {
      "key": "repair_type",
      "label": "修补类型",
      "type": "radio",
      "required": true,
      "options": [
        {"value": "extend", "label": "B1 画面边缘延伸扩景"},
        {"value": "remove_mark", "label": "B2 擦除穿帮+原位补景"},
        {"value": "bg_replace", "label": "B3 背景替换，保留前景实拍主体"},
        {"value": "dyn_match", "label": "B4 动态镜头接景（给Wan动态）"}
      ],
      "default": "extend"
    },
    {
      "key": "ref_img",
      "label": "上传实拍关键帧",
      "type": "image",
      "required": true
    },
    {
      "key": "shot_size",
      "label": "原镜头景别",
      "type": "select",
      "required": true,
      "options": ["远景", "全景", "中景", "中近景", "近景", "特写"],
      "default": "中景"
    },
    {
      "key": "director_style",
      "label": "匹配导演视觉风格",
      "type": "select",
      "required": true,
      "options": ["写实纪实", "极简高级", "电影叙事感", "广告轻奢", "暗调氛围感", "清新明亮", "赛博未来", "复古胶片"],
      "default": "极简高级"
    },
    {
      "key": "mask_area",
      "label": "蒙版修补区域描述",
      "type": "textarea",
      "required": true,
      "placeholder": "例：画面左右两侧向外延伸墙面环境，上方补充天花板，不要改动中间人物与产品"
    },
    {
      "key": "aspect_ratio",
      "label": "目标画幅比例",
      "type": "select",
      "required": true,
      "options": ["16:9", "2.39:1 电影宽幅", "5:1 超宽LED屏"],
      "default": "2.39:1 电影宽幅"
    },
    {
      "key": "light_dir",
      "label": "原图主光源方向",
      "type": "select",
      "required": true,
      "options": ["左前方", "右前方", "左侧", "右侧", "后方逆光"],
      "default": "左前方"
    },
    {
      "key": "color_tone",
      "label": "原图色调风格",
      "type": "select",
      "required": true,
      "options": ["冷调高级灰", "暖胶片", "低饱和极简", "高对比商业色", "莫兰迪柔和"],
      "default": "冷调高级灰"
    },
    {
      "key": "texture_style",
      "label": "实拍素材质感",
      "type": "select",
      "required": true,
      "options": ["干净数字机", "低颗粒胶片", "高颗粒胶片"],
      "default": "干净数字机"
    },
    {
      "key": "perspective_strict",
      "label": "透视严格度",
      "type": "select",
      "required": true,
      "options": ["严格写实（修补固定）"],
      "default": "严格写实（修补固定）"
    },
    {
      "key": "subject_strength",
      "label": "主体保护强度",
      "type": "select",
      "required": true,
      "options": ["中", "强"],
      "default": "强"
    },
    {
      "key": "camera_move",
      "label": "镜头运动（B4动态接景必填）",
      "type": "input",
      "required": false,
      "placeholder": "固定机位 / 缓慢横移 / 向前推镜 / 缓慢摇镜"
    },
    {
      "key": "extra_note",
      "label": "额外约束备注",
      "type": "textarea",
      "required": false,
      "placeholder": "不要反光地面、需要和前期置景方案保持一致、远景虚化等"
    }
  ],
  "branch_prompt": {
    "main": "【TVC后期实拍置景修补｜接景修复】\n风格参考：{{style_reference}}\n以上传实拍参考图为基准，原镜头景别：{{shot_size}}，匹配导演视觉风格：{{director_style}}，严格匹配原图透视、地平线、光源方向{{light_dir}}、光影、色温、色调{{color_tone}}、胶片颗粒{{texture_style}}、镜头暗角。\n主体保护强度{{subject_strength}}，不修改、不改动画面中实拍的人物、产品、前景实物。\n只在蒙版区域生成延伸置景环境：{{mask_area}}\n空间结构和原图场景保持一体连贯，材质统一，阴影投射逻辑和原图一致，边缘融合自然，没有拼接痕迹。\n摄影质感和实拍素材一致，商业TVC，电影机拍摄质感。\n画幅：{{aspect_ratio}}\n修补类型：{{repair_type}}\n附加备注：{{extra_note}}"
  },
  "output_snapshot_template": "【后期修补快照｜可迁移Wan3.0动态接景】\n风格参考：{{style_reference}}\n修补类型：{{repair_type}}\n原镜头景别：{{shot_size}}\n匹配导演风格：{{director_style}}\n目标画幅：{{aspect_ratio}}\n原图主光方向：{{light_dir}}\n原图色调：{{color_tone}}｜实拍质感：{{texture_style}}\n镜头运动：{{camera_move}}\n修补区域：{{mask_area}}\n额外约束：{{extra_note}}"
}

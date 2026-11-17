# 角色资产示例：织绢人

用途是确定角色身份与衣装，而非剧情剧照。以下三版描述同一套设计；跨模型仅复用文字不保证同一张脸。先选定一张满意的主图，再用实际支持的参考功能派生角度。具体人物年龄、性别与衣着可按新故事替换。

## C01｜全身定妆主图

### Image

~~~text
生成一张3:4竖幅的真人古装角色全身定妆照片，单人单图，人物从发髻到鞋履完整可见，脚下留少量地面。人物是一位约二十七岁的江南织绢女子：略宽的鹅蛋脸，平直柔和的眉形，深褐色杏眼，鼻尖自然圆润，唇形清楚，肤色自然，面部保留细微肌理。黑发中分后收成低位盘髻，只用一支素木簪固定。

米白色交领右衽窄袖短衫，以侧边布带系合，袖口收束；下着青灰色长裙，裙腰以素色织带固定，裙身有清楚的纵向褶裥，露出朴素布鞋。上衣是哑光细织布，裙料略厚，有真实垂坠和重量。领口、衣层、系带、袖口与鞋履都能读清。

站在简洁的暖灰色墙面前，身体正对摄影机，双臂放松垂下并与身体留少量间隔，双手空着，目光自然平视，神情安静。左前方大面积柔光塑造面部，右侧有较弱环境补光，暗面保留结构，鼻梁、颧骨与下颌的转折自然。妆容克制，唇面有正常的柔和光泽，肤色与衣装颜色中性自然。面孔和衣装同时清晰，背景柔和但不虚化成光斑。单张完整照片，无道具遮挡、拼图、文字、标注或黑边。
~~~

### Banana

~~~text
制作一张可作为后续人物参考的3:4真人全身定妆图，只出现一个人物，不是设定拼板。二十七岁左右的江南织绢女子，略宽鹅蛋脸、平直柔眉、深褐杏眼、自然圆润鼻尖、轮廓清楚的嘴唇；黑发中分，低位盘髻，一支素木簪。肤色自然，保留正常皮肤纹理。

服装结构固定为：米白交领右衽窄袖短衫，侧边布带闭合；青灰长裙，素织带固定裙腰，纵向褶裥与裙料垂坠清楚；朴素布鞋。上衣细织布哑光，裙布略厚，不透光，不改成现代纽扣衬衫或纱质礼服。

人物自然正面站立，双臂放松，与躯干稍微分开，双手空着，头顶、衣摆与鞋履完整进入画面。背景为无装饰暖灰墙面和少量地面。左前方大面积柔光、右侧较弱补光，脸与衣服都具有轻微明暗结构，鼻梁、颧骨和下颌的转折自然，颜色不染黄。妆容克制，眼部清楚，唇面有自然柔和光泽。以人物辨识和衣装可用性为重点，面部、发髻、领袖腰部细节清楚。输出一张图，不加标签、文字、水印或黑边。
~~~

### Midjourney

~~~text
Full-length photographic costume fitting of a 27-year-old Jiangnan silk worker, one woman facing the camera in a relaxed neutral stance, entire hair bun and cloth shoes visible. Slightly broad oval face, straight soft brows, dark brown almond eyes, softly rounded nose tip, natural skin texture, restrained makeup and natural lip sheen. Center-parted black hair in a low coiled bun with one plain wooden pin. Ivory cross-collar narrow-sleeved top closed with side fabric ties, blue-grey long pleated skirt secured with a plain woven sash, matte woven fabrics with substantial drape. Empty hands resting beside her body. Plain warm-grey wall, broad soft front-left light and gentle fill, neutral colors, clear face and garment construction, a single photograph.
~~~

画幅在平台设置中选3:4；已确认接受原生 MJ 参数时，可按[模型适配](../references/model-adapters.md)附加对应设置。不要把这张定妆图硬套成浅景深人物宣传照。

## C02｜基于已选主图派生侧面

前提：已选出主图，并确实上传到当前模型支持的参考或编辑入口。未上传时先提供主图描述，不声称身份已绑定。Image/Banana可使用以下编辑正文；MJ仅在确认可用的参考编辑模式中使用，不把它当作普通文生图。

~~~text
以这次上传的全身定妆主图为人物与服装依据，生成同一人物的一张右侧面全身照片。只将观察角度改为人物右侧，保持脸型、眉眼、鼻部轮廓、低位盘髻、木簪、米白交领上衣、青灰长裙、系带和鞋履的设计一致。人物自然站立，头部与身体朝向一致，头顶和鞋履完整可见。保持原图的中性柔光、背景与颜色，侧面脸部、衣层和裙形清楚。不要增加配饰或道具，不生成多格图或文字。
~~~

人物进入剧情场景时，身份和衣装由主图约束，站位、视线、动作与光照根据新场景重新安排。身份一致不等于姿势、表情和光线永远不变。

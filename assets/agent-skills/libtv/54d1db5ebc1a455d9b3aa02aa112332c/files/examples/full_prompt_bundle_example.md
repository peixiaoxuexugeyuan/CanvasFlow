# 示例｜镜头003 完整Prompt包

## 1. 资产解析结果
| 资产类别 | 资产ID | 用途 | 状态 | 是否自动引用 | 备注 |
|---|---|---|---|---|---|
| CHAR | CHAR_ZHONG_TURNAROUND_LOCK_V001 | 男主钟标准形象 | LOCK | 是 | |
| CHAR | CHAR_GIRL_EP01_STANDARD_DRAFT_V001 | 女孩标准形象 | DRAFT | 是 | 若无则需先生成 |
| MECH | MECH_AI_GUARD_STANDARD_LOCK_V001 | AI守卫 | LOCK | 是 | |
| ENV | ENV_SURFACE_RUINS_MOONLIT_LOCK_V001 | 月夜地表废墟 | LOCK | 是 | |
| PROP | PROP_REDHARE_BLADE_STANDARD_LOCK_V001 | 赤兔刀 | LOCK | 是 | |
| PREVIS | PREVIS_SHOT003_BLOCKING_APPROVED_V001 | 挡刀Blocking | APPROVED | 是 | |

## 2. 缺失资产待生成
| 资产类别 | 推荐资产ID | 生成目的 | 优先级 |
|---|---|---|---|
| CHAR | CHAR_GIRL_EP01_STANDARD_DRAFT_V001 | 女孩标准资产 | 高 |
| FRAME | FRAME_SHOT003_HERO_APPROVED_V001 | 钟挡刀高光帧 | 高 |

## 3. 资产Prompt包

### CHAR_GIRL_EP01_STANDARD_DRAFT_V001
- 资产类型：角色资产
- 目标用途：第一集女孩标准母资产
- 应继承资产：无
- 推荐画幅：横向
- Prompt：
生成高质量电影级超写实角色设定图……（此处在实际执行时应展开为完整Prompt）
- QC重点：脸部稳定、衣装稳定、废墟受害者状态明确

## 4. 分镜图Prompt包

### Shot003 - 钟高速闯入挡刀
- 自动引用资产：CHAR_ZHONG_TURNAROUND_LOCK_V001 / CHAR_GIRL_EP01_STANDARD_DRAFT_V001 / MECH_AI_GUARD_STANDARD_LOCK_V001 / ENV_SURFACE_RUINS_MOONLIT_LOCK_V001 / PREVIS_SHOT003_BLOCKING_APPROVED_V001 / PROP_REDHARE_BLADE_STANDARD_LOCK_V001
- 建议分镜图类型：三关键帧

#### 首帧Prompt
严格参考以下资产……生成AI守卫武器高速下劈、女孩处于必死距离的首帧分镜图……

#### 高光帧Prompt
严格参考以下资产……生成钟高速切入、赤兔刀与AI武器即将碰撞的高光帧分镜图……

#### 尾帧Prompt
严格参考以下资产……生成碰撞后钟挡在女孩前方、双方明显受力的尾帧分镜图……

## 5. 分镜视频Prompt包

### Shot003 - 钟高速闯入挡刀
- 模型建议：Seedance 2.5 / libTV Agent video
- 自动引用资产：同上
- 推荐输入素材顺序：角色 → 机械 → 场景 → 高光帧 → Previs → 动作参考 → 运镜参考
- Prompt：
严格参考以下资产……
0.00–0.35秒：AI重型武器高速向女孩下劈……
0.35–0.45秒：女孩进入必死距离……
0.45–0.70秒：钟从左侧高速切入……
0.70秒：接触前极短降速……
0.72秒：1–2帧Impact Frame……
0.75–1.10秒：猛烈碰撞，钟肩膀下沉、鞋底滑动、AI武器反弹……
摄影机……
禁止……

## 6. QC清单
- [ ] 资产完整
- [ ] 三关键帧完整
- [ ] 视频Prompt明确引用资产
- [ ] 打击感7阶段完整
- [ ] Previs被引用

## 7. 推荐执行顺序
1. 先生成女孩资产
2. 再生成Shot003高光帧
3. 再确认Previs
4. 再生成三张分镜图
5. 最后生成视频


## V4时长补充
- 本示例Shot003的Generation Duration固定为5秒。
- Edit Duration约1.0–1.5秒。
- 动作参考、Camera参考、Previs均不得低于4秒。
- 最终视频Prompt必须采用Head Handle → Core Action → Tail Handle。

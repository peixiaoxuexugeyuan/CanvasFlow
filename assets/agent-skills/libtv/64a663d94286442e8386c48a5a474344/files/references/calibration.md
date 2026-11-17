# 生成器能力档案与最小校准

## 1. generator_profile 字段

```yaml
generator_profile:
  node_name: {用户口径记录，不据此推断能力}
  profile_status: unknown_conservative | user_reported | verified
  evidence: [每项能力的证据来源：实测|用户声明|未知]
  supports_first_last_frame: unknown|true|false
  max_image_refs: unknown|N
  ref_role_separation: unknown|true|false   # 参考图能否分职责
  supports_reference_video: unknown|true|false
  supports_multi_shot: unknown|true|false
  supports_inpaint_mask: unknown|true|false
  supports_video_extend: unknown|true|false
  camera_motion_control: unknown|weak|strong
  supports_negative_prompt: unknown|true|false
  native_audio: unknown|none|ambience|dialogue
  lip_sync: unknown|true|false
  precise_text: unknown|true|false
  seed_reproducible: unknown|true|false
  max_duration_s: unknown|N
```

`unknown_conservative` 下的编译策略：单镜生成、首帧引导（不假定尾帧）、参考图≤2且职责合并到身份、文字全走后期、声音走post_audio、时间码只写因果顺序不写精确秒。

## 2. 最小校准包（`校准：当前节点`）

用C级素材跑5条低成本测试，每条只验一项：

1. 双图分职责（身份图＋场景图）是否互不污染；
2. 首尾帧是否都被遵守；
3. 一行短文字能否稳定正确；
4. 指定机运（如缓推）是否可控；
5. 时长上限与尾部是否掉质量。

`校准结果：{观测}` 写回evidence并把档案升为 `verified`（仅限已测项）。未测项保持unknown。

## 3. 能力矩阵模板（多节点项目）

能力节点A节点B证据首尾帧参考图上限/职责精确文字原生音频/口型多镜/续写

路线选择：A级镜头只走verified能力；unknown能力仅允许C级镜头试探。
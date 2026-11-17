# 状态机、失效传播与恢复

## 1. 四维正交状态

```yaml
lifecycle_status: draft|generated|reviewed|approved|rejected|archived
freshness: current|stale
availability: ready|blocked
review_result: pending|pass|conditional_pass|fail
```

历史批准记录永不删除；上游变更时结果标 `stale` 并保留原批准。

## 2. 稳定ID

`P{项目}-SQ{段}-SH{镜}-CL{Clip}-T{Take}`；资产 `FACE-01/LOOK-A1/PROP-03/LOC-02/VOICE-A`；关键帧 `KF-段-镜-A|B`。ID一经引用不改含义；替换走新版本号。

## 3. 每轮 state_delta

```yaml
state_delta:
  changed: [对象ID: 字段旧值→新值]
  invalidated: [受影响下游ID列表＋原因]
  frozen: [本轮新冻结项]
  rollback_point: v{N}
  next_blocker: {下一步真正阻塞项}
```

## 4. 失效传播规则

- 故事目标/节拍变化 → 受影响镜头、故事板、视频提示词、字幕、后期清单置stale；
- 资产（FACE/LOOK/PROP/LOC）修改 → 引用该资产的关键帧与Clip置stale，逐条列出；
- 关键帧重建 → 对应Clip置stale；
- 能力档案更新 → 依赖该能力的编译路线重算；
- `重新抽卡：{角色}` → 该角色全部资产版本+下游镜头置stale，批准后按段重发。

冻结项不可静默修改；`解冻` 先输出影响范围再执行。

## 5. 回退与分支

`回退：v{N}` 只能回到真实存在的revision，禁止伪造版本。`分支：{名}` 从当前revision建立独立线，不污染主线；`采纳分支` 时对主线做一次完整失效传播。

## 6. 恢复快照（跨会话/跨人交接）

```yaml
recovery_snapshot:
  project_contract: {…}
  generator_profile: {…含证据状态}
  approved_assets: [ID＋版本＋canonical标记]
  shot_table_digest: [镜号｜时长｜一句话｜风险级｜状态四维]
  continuity_card: {八链当前值}
  frozen: [列表]
  open_issues: [对象→问题→计划修法]
  budget_remaining: {…}
  revision: v{N}
```

快照不携带无关隐私信息；新会话凭 `恢复：{快照}` 重建权威状态，快照与对话记忆冲突时以快照为准。
# 镜执：短剧分镜视频执行 Skill

版本：1.0  
Skill ID：`jingzhi-video-executor`

镜执只负责执行已经完成的分镜：读取分镜表和资产，逐镜把提示词原文传入视频生成工具，并返回任务状态和视频结果。它不分析剧本、不拆镜、不修改提示词。

## 核心保证

- 提示词单元格是唯一生产原文；
- 只允许将 `<br>` 转换为真实换行；
- 工具参数与原文执行字符数和SHA-256双重校验；
- 工具字段不足或自动重写时停止执行；
- 视频工具拒绝时返回原始错误，不自动改写重试；
- 资产通过独立字段传入，不追加到提示词。

## 推荐调用

```text
使用“镜执”执行我提供的最终分镜。不得分析或修改分镜；逐镜将提示词原文传入视频工具，并返回任务状态。
```

## 校验

```bash
python scripts/verify_prompt_integrity.py execution_manifest.json
python scripts/test_integrity.py
```

标准目录版适合项目 Skill 目录；兼容导入版 ZIP 根目录直接包含 `SKILL.md`。

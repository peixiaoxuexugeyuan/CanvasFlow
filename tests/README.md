# 本地版回归测试

`preview/full-audit-20261019/run_baseline.py` 按文件在独立进程、临时数据目录运行 Python 测试，再运行 Node 测试。`tests/test_local_release.py <发布目录>` 验证便携运行时和真实 Blender 导出。

测试不提交真实收费模型请求。AI 协议和工具调用使用模拟响应或回环测试服务；Blender 使用本机程序执行。

本地版不再提供账号、角色权限、社区分享、配额和积分结算。旧平台专用断言保留并明确标记跳过；并未为满足旧断言恢复这些功能。对应替代覆盖在 `test_local_app.py`、`test_local_security_audit.py`：无账号可使用、无余额拦截、旧平台路由返回 404、工作区隔离、本地文件和项目保护、跨站请求防护。

2026-10-20 已清理根目录历史 `_test_*` / `_probe_*` 脚本及一次性工具，当前测试入口为本目录和上面的回归脚本。构建文件清单位于 `tools/release/files.txt`。

真实供应商联调留到项目完整开发后进行，不使用旧 API 密钥。

2026-10-20 发行前回归入口为 `preview/release-qa-20261020/run_regression.py`，会单独保存本轮日志，不覆盖前次审计证据。独立发行目录及真实 Blender 验收入口为同目录的 `test_standalone_backend.py`，只写隔离测试数据。

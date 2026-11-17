# 社区 Skill 同步

Agent 首页和画布 Skill 选择器从 `https://skill.zzzapi.xyz/api/library` 读取公开技能。桌面后端提供只读代理 `/api/agent/community-skills`，校验文件路径、正文、体积和哈希，不转发本地凭据。

目录按应用镜像 ID 去重，保留内置和私人技能；提供社区筛选与手动同步。使用时重新确认公开状态并获取主文档和参考文件，下架内容阻止发送，网络失败保留已有目录与草稿。

新页面脚本、Python 模块和运行所需素材必须加入 tools/release/files.txt。`tests/release-inputs.test.cjs` 检查页面入口资源完整性。

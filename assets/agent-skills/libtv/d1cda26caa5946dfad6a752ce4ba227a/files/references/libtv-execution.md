# LibTV CLI 执行

## 唯一入口

只通过官方 `libtv` CLI 操作项目、节点、模型、上传、生成和下载。旧版 `agent-im OpenAPI` 已停用；收到要求升级 CLI 的返回时立即停止旧接口调用。

Windows 默认可执行文件：

```text
%USERPROFILE%\.libtv\libtv.exe
```

先运行 `libtv --help` 和对应子命令的 `--help`。实际输出与本说明不一致时，以当前 CLI 为准。

## 安装与登录

CLI 缺失时从 `https://www.liblib.tv/cli` 获取官方安装包或安装脚本。安装新程序前遵守当前环境的授权要求。

CLI 使用本地登录凭据，不使用旧版 `LIBTV_ACCESS_KEY`。出现错误 `10001 用户未授权` 时：

1. 运行 `libtv login web --open`；
2. 让用户在官方网页亲自登录；
3. 等待 CLI 把凭据写入 `%USERPROFILE%\.libtv\credentials.json`；
4. 再重试原命令。

不要读取、展示、复制或上传凭据文件内容。

## 新任务

 1. 创建本地输出目录，并把它作为 CLI 工作目录。
 2. 使用 `libtv project create "项目名"` 新建画布。
 3. 从结果取得项目 UUID。
 4. 在输出目录执行 `libtv project use <UUID>`，让 `.libtv/project.json` 绑定项目。
 5. 使用 `libtv upload` 把每张参考图片上传为独立节点。
 6. 使用 `libtv model search --type image` 和 `libtv model search --type video` 获取当前模型列表。
 7. 对默认图片模型 `lib-image-2` 和默认视频模型 `star-video2-mini` 执行 `libtv model <modelKey>`，确认真实 schema。
 8. 图片节点默认设置 `model=lib-image-2`、`quality=medium`、`resolution=2K`、`count=1`。
 9. 视频节点默认设置 `model=star-video2-mini`、`resolution=720p`、`count=1`。
10. 按内容路由建立图片或视频节点，把参考图节点连到左侧。
11. 使用 `libtv node <节点名> --run` 生成，并读取最终状态、URL 和进度。
12. 使用 `libtv download -n <节点名> -o <目录>` 下载结果。

不要把同一套包装拆成按图片逐个创建的独立项目。

## 继续修改

用户提出“字幕条再薄一点”“卡片不要阴影”等修改时：

- 在原项目绑定目录中执行；
- 使用原节点名或 nodeKey；
- 只更新用户指出的参数或 prompt；
- 使用 `libtv node <节点> --prompt <新要求> --run` 定向重做；
- 不重新上传没有变化的参考图；
- 把新结果与旧结果区分版本。

## 生成状态

`libtv node <节点> --run` 会等待并输出进度。把 `status=2`、`progressPercent=100` 且存在非空 URL 视为成功。

- 命令超时但已经返回 taskId 时，查询原节点，不新建重复节点。
- 返回空 URL 时先查询原节点状态。
- 部分元素失败时只重做失败节点。
- 不根据命令运行时间猜测成功。

## 下载与水印

优先使用官方 `libtv download`。只有账号本身具有相应权限时才使用 `--without-ai-watermark` 或 `--vip`；不要为了去水印绕过平台限制。

CLI 默认下载结果含平台水印时如实告诉用户。节点结果 URL 可用于检查生成内容，但最终交付仍遵守平台权限和下载规则。

## 常见错误

- `10001 用户未授权`：完成 CLI 网页登录。
- 模型不存在：根据节点类型重新运行 `libtv model search --type image` 或 `libtv model search --type video`。
- schema 校验失败：检查 `libtv model <modelKey>`，不要猜字段。
- 节点重名：查询并复用原节点，或使用新的唯一名称。
- 项目未绑定：在当前输出目录运行 `libtv project use <UUID>`。
- 参考图没有连入：使用 `--left <参考图节点>` 补边后再运行。
- 文字错误：重做一次；仍失败则生成无字底板并记录准确文案。

## 隐私

明确调用本 Skill 生成即代表用户允许把本次提供的参考图片上传到 LibTV。不要上传任务之外的本地文件。不要索取或展示登录凭据。
# 回归测试

在仓库根目录执行：

```powershell
pnpm --dir tools/release install --frozen-lockfile
pnpm --dir tools/desktop install --frozen-lockfile
pnpm --dir tools/openfilm install --frozen-lockfile
node --test 'tests/*.test.cjs' 'tests/*.test.mjs'
Get-ChildItem tests -Filter 'test_*.py' |
  Where-Object Name -ne 'test_local_release.py' |
  ForEach-Object {
    python -m unittest discover -s tests -p $_.Name
    if ($LASTEXITCODE -ne 0) { throw "测试失败：$($_.Name)" }
  }
```

测试使用独立的临时数据目录和模拟供应商接口。3D 回归样本放在 `tests/fixtures/`。需要本机 Blender、OpenFilm 运行组件或原生安装器的测试会在缺少相应条件时跳过。

`python tests/test_local_release.py <发行后端目录>` 需要已构建的发行后端及 Blender 运行组件。

准备好 [成片工作台](../FILM_WORKBENCH.md) 的运行组件后，可执行真实本地剪辑引擎测试：

```powershell
$env:CANVASFLOW_TEST_FILM_RUNTIME = '1'
python -m unittest discover -s tests -p 'test_film_runtime_integration.py'
python -m unittest discover -s tests -p 'test_film_advanced_integration.py'
```

这些测试使用合成媒体，并在本机执行剪辑、保存和导出。

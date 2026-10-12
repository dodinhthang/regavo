# 部署与发布

[English](../en/DEPLOYMENT.md) | [Tiếng Việt](../vi/DEPLOYMENT.md) | **简体中文**

Regavo 使用 Cloudflare Workers Static Assets，Worker 名为 `regavo`，在域名根路径提供优化后的 `dist/`。首次部署使用账户的 `workers.dev` 子域名。模拟仍在浏览器中运行，玩家无需后端、数据库或 API 密钥。

## 流水线触发时机

| 事件                            | 检查                                                                                  | 生产部署       |
| ------------------------------- | ------------------------------------------------------------------------------------- | -------------- |
| 创建或更新面向 `main` 的 PR     | lint、格式、类型、许可证、测试、构建、RGBA 图片检查、Chromium 冒烟和 Wrangler dry-run | 否             |
| push/merge 到 `main`            | 同一组检查                                                                            | 否             |
| push 稳定标签，例如 `v1.0.0`    | 验证标签后执行全部检查                                                                | 全部通过后部署 |
| 手动运行 Release 并输入现有标签 | 验证、重新构建和测试该标签                                                            | 通过后重新部署 |

PR 工作流只有仓库读取权限，不接收 Cloudflare 凭据。`ci.yml` 不部署。`release.yml` 串行处理生产发布，将验证后的产物交给部署任务，不重新构建。部署产物与失败诊断保留一天。

## 本地审查与 GitHub 设置

所有配置可在本地审查和验证。项目与工作流进入 `main` 且 CI 通过后再创建发布标签。目标 remote 为 `git@github.com:dodinhthang/regavo.git`；本地设置分支保留 GitHub 现有 LICENSE 提交和本地历史。push 和创建 PR 是独立步骤。

准备启用 GitHub 部署时：

1. push 设置分支并通过 PR 合并到 `main`。不要 force-push 或提交 `node_modules/`、`dist/`、`.openai/`、`.wrangler/`、测试结果和环境文件。
2. 在 **Settings → Environments** 创建 `production`，添加 environment secrets `CLOUDFLARE_ACCOUNT_ID` 与 `CLOUDFLARE_API_TOKEN`。
3. 先创建 Worker `regavo`，再创建名为 `regavo-github-production` 的账户 API 令牌，权限设为 **Specified Workers → regavo → Editor**，只允许部署该 Worker。直接输入 GitHub Secrets，不写入代码、YAML 或聊天。参见[Workers 权限与范围](https://developers.cloudflare.com/workers/authorization/workers/)。
4. 首次 CI 通过后，将 **Validate** 设为合并到 `main` 的必要状态检查。不要同时启用 Cloudflare Builds 自动部署。

工作流使用 Ubuntu 24.04、Node `22.23.3`、pnpm `12.8.1` 和 Wrangler `4.149.0`。Actions 固定到已验证的提交 SHA。pnpm 与 WebP 缓存按 runner 平台和工具链隔离，缺失或损坏的图片缓存会重新生成。

许可证记录包含特定 OS/CPU 依赖。CI 在 `pnpm validate` 前运行 `pnpm audit:licenses`，确保 Linux 声明与实际安装的包一致并进入发布产物；不会将生成的文件提交回 GitHub。

## 发布前检查

```sh
pnpm install --frozen-lockfile
pnpm audit:licenses
pnpm validate
pnpm exec playwright install chromium
pnpm test:smoke
pnpm dlx wrangler@4.149.0 deploy --dry-run --outdir test-results/wrangler
```

Chromium 检查六个文明 × 三个时代，在模拟 Worker 启动后进入并退出大越对局，以及通过 hash URL 打开工坊。缺失响应、图片/Worker MIME 错误或 JavaScript 错误会使测试失败。冒烟结果位于 `test-results/smoke/` 与 `playwright-report/`。

## 发布与恢复

合并已验证修改、更新 `package.json` 版本，并对 `main` 的确切提交创建标签。首次发布：

```sh
git switch main
git pull --ff-only origin main
git tag -a v1.0.0 -m "Regavo 1.0.0"
git push origin v1.0.0
```

只允许稳定 `vMAJOR.MINOR.PATCH` 标签，不允许前导零或预发布后缀。标签必须存在、提交必须在 `origin/main` 历史内、该提交的包版本必须与标签一致。无效标签在部署前被拒绝。后续修复使用 `v1.0.1`、`v1.0.2` 等，不移动已有发布标签。

部署后比较 HTML、资源清单、代表图片、几何、启动代码、图标和模拟 Worker 与已验证产物。带哈希资源必须有一年的 immutable 缓存，缺失图片必须返回 404。传播期间短暂重试，仍失败则标记工作流失败。任务摘要记录标签、SHA、URL 和结果，不自动回滚。

恢复时从 `main` 打开 **Actions → Release → Run workflow**，在 `tag` 输入之前部署的稳定标签。流水线重新构建、检查并部署该版本。GitHub 产物到期不会阻止恢复；标签必须包含本流水线，不必创建新标签。

初始生产 URL 为 `https://regavo.dothang-hit.workers.dev`，尚未配置自定义域名或 PR 预览 URL。项目原创代码、美术、标志和音频采用 [MIT](../../LICENSE)，依赖保留各自许可证。

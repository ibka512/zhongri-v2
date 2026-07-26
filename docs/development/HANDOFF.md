# AI 接手记录

本文件是跨 AI、跨会话的当前工作交接面。每次暂停、提交、合并或切换 Task 前必须更新。

## 当前快照

- 稳定基线：`main`（已包含 GOV-001 PR #22 与 Task 015 第一小步 PR #24）
- 当前交接分支：`codex/task-015-handoff`（仅用于本次交接快照更新）
- 稳定基线提交：`08854aa`（Task 015 canonical corpus migration gate 合并提交）
- 当前任务：Task 015 · v1 迁移逐域转换与 canonical 身份层
- 当前状态：canonical corpus 契约与 fail-closed 完整性门禁已通过 PR #24 合并，`npm run verify` 已于 2026-07-26 通过；[Issue #23](https://github.com/ibka512/zhongri-v2/issues/23) 仍开放，完整资产与真实脱敏 fixture 仍待提供
- 产品阶段：Phase 1 收口；Task 013 代码已合并，本地浏览器断网启动/恢复复测已完成
- 发布阻塞：`gh auth status -h github.com` 报告 `ibka512` token 无效；重新认证后才能推送和创建 PR。

## 本轮已完成

- GOV-001 已通过 [PR #22](https://github.com/ibka512/zhongri-v2/pull/22) 合并。
- Task 015 第一小步已通过 [PR #24](https://github.com/ibka512/zhongri-v2/pull/24) 合并，Issue #23 保持开放。
- Task 015 新增 `CanonicalCorpusManifestSchema` 和固定 9,828/5,906/3,922 验收目标。
- 新增 `verifyCanonicalCorpusIntegrity`，覆盖双语数量、重复身份、来源摘要和 fail-closed 目标门禁。
- 新增 ADR-012、Task 015 合同和状态文档；CI/本地 `npm run verify` 全部通过。

## 仍未完成

- Phase 1 双语、迁移和产品页面仍未完成。
- v1 逐域迁移、完整 9,828 词身份层和激活/回滚；当前没有完整 canonical source 或真实 backup fixture。
- 首次设置、内容中心、设置与数据安全页。
- 日语五十音/TTS、英语/IPA 双语纵向切片。
- Phase 1 综合验收。

## 已验证命令

以下命令已在本轮治理文件完成后通过：

```bash
npm run verify
```

## 下一个 AI 的固定启动步骤

```bash
git status -sb
git log -5 --oneline
sed -n '1,240p' AGENTS.md
sed -n '1,240p' docs/development/HANDOFF.md
sed -n '1,260p' docs/TASKS.md
npm run verify
```

然后阅读当前 Task 合同、相关基线和 ADR。未在 `TASKS.md` 授权的业务能力不得提前实现。

## 下一项工作

1. 获取完整 canonical source manifest、SHA-256 清单和脱敏 v5+/v10、legacy v4 fixture。
2. 在 Task 015 内实现 source snapshot、逐域 transformer、quarantine、V01–V25 验证和激活/回滚。
3. 迁移 Task 通过后再继续首次设置、内容和双语基础切片。
4. Phase 1 验收完成后才进入 AI Gateway（Issue #20）。

## 交接规则

- 不要使用 `git reset --hard` 或覆盖未知用户改动。
- 发现工作区有不属于当前 Task 的修改时先停下并报告。
- 每次提交后更新本文件的分支、commit、状态和下一步。
- 任何未验证的猜测必须标为“待确认”，不能写入项目事实。

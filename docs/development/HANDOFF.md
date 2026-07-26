# AI 接手记录

本文件是跨 AI、跨会话的当前工作交接面。每次暂停、提交、合并或切换 Task 前必须更新。

## 当前快照

- 稳定基线：`main`（已包含 GOV-001 PR #22、Task 015 第一小步 PR #24、交接 PR #25 和发布清理 PR #26）
- 当前交接分支：`codex/task-015-canonical-assets`
- 稳定基线提交：`3e54b8b`（Task 015 发布交接清理合并提交）
- 当前任务：Task 015 · v1 迁移逐域转换与 canonical 身份层
- 当前状态：完整 9,828 条 canonical corpus 已从固定 `jp-study` 提交导入，fail-closed 完整性门禁与全量测试已通过；[Issue #23](https://github.com/ibka512/zhongri-v2/issues/23) 仍开放，真实脱敏 fixture 与逐域迁移仍待完成
- 产品阶段：Phase 1 收口；Task 013 代码已合并，本地浏览器断网启动/恢复复测已完成
- 发布状态：本轮已验证 GitHub CLI 认证、分支推送、draft PR、CI 和合并流程均可用；下次发布前仍按固定启动步骤复查认证状态。

## 本轮已完成

- GOV-001 已通过 [PR #22](https://github.com/ibka512/zhongri-v2/pull/22) 合并。
- Task 015 第一小步已通过 [PR #24](https://github.com/ibka512/zhongri-v2/pull/24) 合并，Issue #23 保持开放。
- Task 015 第二小步导入 `jp-study@36c8129dfc364453198790b64687ff9105a3ecae` 的 9,828 条资产，新增动态双语 corpus Repository。
- Task 015 新增 `CanonicalCorpusManifestSchema`、固定 9,828/5,906/3,922 验收目标和 `verify:canonical` 来源门禁。
- `verifyCanonicalCorpusIntegrity` 覆盖双语数量、重复身份、来源摘要和 fail-closed 目标门禁。
- 新增 ADR-012、ADR-013、Task 015 合同和状态文档；CI/本地 `npm run verify` 全部通过。

## 仍未完成

- Phase 1 双语、迁移和产品页面仍未完成。
- v1 逐域迁移、source snapshot、quarantine、V01–V25 和激活/回滚；真实 backup fixture 仍未进入仓库。
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

1. 获取脱敏但字段形状真实的 v5+/v10、legacy v4 backup fixture，或明确批准 synthetic fixture 方案。
2. 在 Task 015 内实现 source snapshot、逐域 transformer、quarantine、V01–V25 验证和激活/回滚。
3. 迁移 Task 通过后再继续首次设置、内容和双语基础切片。
4. Phase 1 验收完成后才进入 AI Gateway（Issue #20）。

## 交接规则

- 不要使用 `git reset --hard` 或覆盖未知用户改动。
- 发现工作区有不属于当前 Task 的修改时先停下并报告。
- 每次提交后更新本文件的分支、commit、状态和下一步。
- 任何未验证的猜测必须标为“待确认”，不能写入项目事实。

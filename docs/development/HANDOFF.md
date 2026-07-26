# AI 接手记录

本文件是跨 AI、跨会话的当前工作交接面。每次暂停、提交、合并或切换 Task 前必须更新。

## 当前快照

- 分支：`codex/phase1-closeout`
- 基线提交：`7826c4b`（Task 013 合并提交）
- 当前任务：GOV-001 · 仓库交接与基线治理
- 当前状态：实现完成，治理提交已创建（当前分支 HEAD），`npm run verify` 已于 2026-07-26 通过；GOV-001 已建立为 [Issue #21](https://github.com/ibka512/zhongri-v2/issues/21)，工作区干净，等待推送和 draft PR
- 产品阶段：Phase 1 收口；Task 013 代码已合并，本地浏览器断网启动/恢复复测已完成
- 发布阻塞：`gh auth status -h github.com` 报告 `ibka512` token 无效；重新认证后才能推送和创建 PR。

## 本轮已完成

- 将 7 份用户提供的产品/技术 DOCX 转为仓库内公开 Markdown 基线。
- 新增基线优先级、来源校验和 AI 阅读顺序。
- 统一 README、TASKS、PROJECT_CONTEXT、ROADMAP、STATUS 和 PRODUCT_SCOPE 的阶段状态。
- 建立 Phase 1 收口验收矩阵。
- 增加统一工程门禁与文档链接检查。
- 用本地 Chrome 375px 生产预览完成断网启动、答题反馈、刷新恢复和无横向溢出复测。

## 仍未完成

- Phase 1 双语、迁移和产品页面仍未完成。
- v1 逐域迁移、完整 9,828 词身份层和激活/回滚。
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

1. 提交并推送 GOV-001，创建 draft PR 关联 Issue #21，完成并合并仓库交接治理。
2. 单独定义并授权完整迁移激活 Task。
3. 迁移 Task 通过后再继续首次设置、内容和双语基础切片。
4. Phase 1 验收完成后才进入 AI Gateway。

## 交接规则

- 不要使用 `git reset --hard` 或覆盖未知用户改动。
- 发现工作区有不属于当前 Task 的修改时先停下并报告。
- 每次提交后更新本文件的分支、commit、状态和下一步。
- 任何未验证的猜测必须标为“待确认”，不能写入项目事实。

# GOV-001：仓库交接与基线治理

## 状态

已通过 [PR #22](https://github.com/ibka512/zhongri-v2/pull/22) 合并，对应 [GitHub Issue #21](https://github.com/ibka512/zhongri-v2/issues/21)。

## 目标

让下一个 AI 可以只依赖仓库内容接手项目，准确区分产品基线、当前事实、任务授权、架构决策
和未完成工作。

## 包含范围

- 纳入 7 份用户提供文档的公开 Markdown 基线和来源清单。
- 建立 `HANDOFF.md` 作为跨会话交接面。
- 建立任务合同目录和固定接手顺序。
- 增加 `npm run verify:docs` 与 `npm run verify`。
- 加强 PR 模板，要求任务合同、基线、ADR、验收证据和 HANDOFF 同步。
- 更新 README、TASKS、PROJECT_CONTEXT、ROADMAP、STATUS 和 PRODUCT_SCOPE 的状态口径。

## 明确不包含

- 不修改学习业务逻辑、Schema、FSRS 参数或迁移算法。
- 不接入 AI API、真实音频、账号、同步、ASR 或商业化。
- 不把原始 DOCX、临时脚本、用户本机路径或敏感信息提交到公开仓库。

## 验收标准

- 新 AI 按 `AGENTS → HANDOFF → TASKS → 当前 Task → 基线/ADR` 顺序可完成接手。
- 7 份基线文档均有仓库内公开版本、来源文件名和 SHA-256。
- `npm run verify:docs` 能阻止失效的仓库内 Markdown 链接。
- `npm run verify` 能连续执行格式、Lint、TypeScript、测试、默认构建和 Pages 构建。
- PR 模板要求声明当前 Task、GitHub Issue、产品基线、架构影响、验收命令和交接记录。
- Task 013、Phase 1 和 AI 的边界在所有状态文档中一致。

## 后续依赖

本治理工作合并后，下一项必须单独定义 Phase 1 的迁移、内容和双语切片任务；远端 Issue #20
的 AI Gateway 只能在 Phase 1 验收完成后授权。

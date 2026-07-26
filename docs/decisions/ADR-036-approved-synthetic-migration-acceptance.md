# ADR-036：以批准的 synthetic fixture 验收迁移边界

## 状态

已接受（2026-07-27，负责人批准使用 synthetic fixture）

## 背景

真实 v1 用户备份尚未提供，不能把仓库中的字段形状 fixture 描述为真实迁移结果。与此同时，
迁移 staging、V01–V25 报告、固定抽样、失败注入、activation gate 和 rollback 的组合边界需要
一个可重复的端到端验收样本。

## 决策

采用 `createApprovedSyntheticV1Backup()` 作为批准的合成验收 fixture：

- fixture 只包含仓库测试数据，不包含任何用户备份或真实 API Key；
- fixture 使用完整 9,828 条 canonical corpus，包含 built-in/user Word、Override、Folder、Favorite
  以及一个归一化 ReminderSetting 来源，使 V01、V02、V18 能在完整 corpus 下验证；
- `MigrationFixedSamplingUseCase` 生成 V23 证据，`MigrationRollbackDrillUseCase` 生成 V25 证据；
- `MigrationStagedVerificationUseCase` 从 InMemory persistence 重建两次 payload；
- `MigrationActivationUseCase` 执行原子 commit，随后通过 staging rollback 恢复空 active pointer。

端到端测试位于 `tests/application/migration-synthetic-acceptance.test.ts`。该测试证明的是代码、
契约、摘要绑定和事务边界，不证明真实用户字段覆盖、设备存储分歧或生产迁移安全性。

## 影响与边界

- 可以把 synthetic acceptance 标记为已完成，作为下一个 AI 的可重复回归入口。
- V01–V25 的 synthetic 全通过不等于 Task 015 的真实迁移完成；真实脱敏 fixture 到位后必须重新运行
  同一流程并记录真实 report digest、quarantine、source divergence 和 rollback 证据。
- 不允许把合成 fixture 提交到 active 用户数据，也不允许据此跳过真实 fixture 复核。

## 验收证据

- `tests/application/migration-synthetic-acceptance.test.ts`：V01–V25 全通过、activation commit、
  verification digest 绑定和 rollback 恢复。
- `npm run verify`：全量质量门禁通过。

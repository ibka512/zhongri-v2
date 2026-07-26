# ADR-020：以单一 Application 编排把核心域结果接入隔离 staging

- 状态：已接受
- 日期：2026-07-26
- 关联：Task 015 / Issue #23

## 背景

ADR-019 已经生成了 Word/Override/Folder/Favorite isolated payload，但调用方仍需手工串联
脱敏来源准备、Legacy Source Reader、domain slice 和 `MigrationStagingUseCase`。手工串联容易
绕过来源 fingerprint、快照一致性或 secret 脱敏门禁，也使下一位 AI 难以复用稳定入口。

## 决策

1. 新增 `MigrationDomainSliceStagingUseCase`，固定编排顺序：
   `prepareV1MigrationSource → MigrationLegacySourceReaderUseCase → MigrationDomainSliceUseCase → MigrationStagingUseCase`。
2. 脱敏文本、raw digest、source snapshot 一致性和 `migrationId` 派生逻辑只由
   `prepareV1MigrationSource` 提供；既有 staging 用例和新 orchestrator 共享它，不复制安全逻辑。
3. orchestrator 只调用 `stage`，把 `slice.isolatedPayload` 作为可选 staging 字段保存；不调用
   `commit`、不改变 active pointer、不迁移其他域。
4. staging replay 继续绑定 source/report/snapshot 摘要，并额外绑定 isolated payload digest；同一
   输入返回 `replayed`，不同 payload 不得静默复用旧 dataset。

## 影响与边界

- 现在有一个可供 UI/后续 CLI 使用的 application 入口，减少接线错误并保留完整 source、slice、
  staging 结果供审计。
- 该入口仍消费脱敏/字段形状 fixture；设备快照接线、真实 backup、rawArchive/quarantine 实体存储、
  Mastery/StudyRecord/FSRS、V01–V25 和 active pointer commit 仍不在本 ADR 范围内。

## 验证

- `tests/application/migration-staging-isolated-slice.test.ts` 通过 orchestrator 验证 reader →
  transformer → staging、replay 和 active pointer 保持为空。
- `npm run verify` 是合并门槛。

# ADR-030：将迁移 rawArchive 与 quarantine 写入独立存储

## 状态

已接受（Task 015 进行中）

## 背景

此前 `MigrationDomainSliceUseCase` 已把脱敏来源值绑定到 `isolatedPayload.archives`，但 staging
dataset 仍把它们嵌在一个大 payload 中。这样可以离线复核，却不能独立按 migration 查询、保留或在
未来执行用户确认后的清理；也无法把归档记录与 staging 事务的写入边界明确分开。

## 决策

1. 新增 `MigrationArchiveRecordSchema` 和 `migrationArchives` 存储表。每条记录保留
   `archiveRef`、`archiveKind`、sourceRef、domain、来源 digest、已脱敏 serializedValue、migration/dataset
   归属和创建时间。
2. `MigrationPersistencePort.stageMigration` 在同一 staging 事务中从已校验的 inline archives 生成独立
   记录；重复输入幂等，回滚只恢复 active pointer，不删除归档。
3. 归档默认采用 `stable-version-cycle` 保护策略，`retentionUntil` 在稳定版本周期尚未确定时保持
   `null`；`cleanupConfirmedAt` 只有未来确认清理边界后才可写入。当前不提供自动清理、不压缩/加密，
   也不把归档内容写入 active 业务表。
4. Port 只增加按 migrationId 读取归档的只读能力；commit/rollback 继续只操作 MigrationRun 和
   active pointer，保持现有原子边界。

## 影响

- 同一迁移的 rawArchive/quarantine 可独立审计，并与 staging dataset 的生命周期关联。
- 归档空间会随 staging 增加；在保留周期和用户确认清理策略明确前不会自动回收。
- inline archives 继续保留，作为兼容和 payload digest 的来源；独立记录不是 active 数据。

## 验证

- InMemory 与 Dexie 迁移持久化共享 Port 契约，覆盖 staging/replay/rollback 后归档仍可读取。
- Domain slice staging 测试验证 inline archive 数量与独立记录一致、migration/dataset 绑定正确、默认
  保留策略不产生清理时间。
- 全量 `npm run verify` 必须通过；真实 fixture、V01–V25 和激活前不宣称迁移完成。

# ADR-019：以核心域纵向切片验证 isolated payload 边界

- 状态：已接受
- 日期：2026-07-26
- 关联：Task 015 / Issue #23

## 背景

Legacy Source Reader、canonical idMap 和 disposition/quarantine report 已经分别固定了输入、身份
和处置契约，但没有一条可运行链路验证 Word、Override、Folder、Favorite 如何共同生成目标。
在真实用户 backup fixture 尚未获批前，需要让下一位 AI 能运行、审计和扩展一个不触碰 active
dataset 的纵向切片。

## 决策

1. 新增 `MigrationDomainSliceUseCase`，只消费已经通过 Legacy Source Reader 的 records，并在本轮
   固定处理 `words / overrides / folders / favorites` 四个域。
2. Word/Override 身份只能消费冻结的 `MigrationIdentityMap`；Folder ID 由
   `migrationId + normalizedName + language` 确定性生成；Favorite 只能关联唯一已映射 Word。
3. 每个范围内 sourceRef 必须进入 `MigrationDispositionReportUseCase`。成功/重复记录生成
   rawArchive 引用，孤立、冲突或坏类型记录进入 quarantine；quarantine 不允许携带活跃目标。
4. 新增 `MigrationIsolatedPayloadSchema`，把四个域的目标和 reader/idMap/disposition 摘要绑定到
   `dataset:${migrationId}`，并强制 `writesPerformed:false`、`activePointerUpdated:false`；现有
   staging dataset 以可选 `isolatedDomainSlice` 字段保存它。
5. 在真实 fixture 到位前，仓库只使用字段形状 synthetic fixture；本 ADR 不授权纵向用例直接写
   persistence、提交 active pointer、迁移 Mastery/StudyRecord/FSRS 或通过 V01–V25。

## 取舍与影响

- 先形成可重复的端到端证据，后续 AI 可以围绕稳定 payload 契约继续添加域，而不必重新设计身份
  和处置边界。
- 本轮 disposition report 的 source count 是四个范围域的守恒范围，不等同于整个 v1 备份已迁移；
  reader 中的其他域仍然显式留待后续 transformer。
- rawArchive/quarantine 目前只有确定性引用，没有原始 payload 持久化；下一步应把 isolated payload
  与实际 staging 存储绑定，并增加 V01–V25 及激活/回滚测试。

## 验证

- `tests/application/migration-domain-slice.test.ts` 覆盖 canonical/user Word、Override、Folder、
  Favorite、孤立 Override quarantine、digest 绑定、重复运行幂等和无 persistence 写入。
- `npm run verify` 是合并门槛。

# ADR-024：在 isolated payload 内绑定 rawArchive 与 quarantine 内容

## 状态

已接受（Task 015 第十三小步，2026-07-27）。

## 背景

此前 disposition report 只生成确定性 `raw-v1:*` / `quarantine-v1:*` 引用，原始序列化值仍停留
在 reader 输入中。若只保留引用而不把对应的脱敏内容放入同一份 isolated staging，后续 V01–V25
无法复核“每条来源记录被如何处置”，也无法在不重新读取 v1 的情况下重放报告。

## 决策

1. 新增 `MigrationIsolatedArchiveSchema`，在 `MigrationIsolatedPayload.archives` 中保存
   `archiveRef`、`archiveKind`、sourceRef、domain、sourceRecordDigest 和已经由 Legacy Source
   Reader 脱敏/规范化的 `serializedValue`。
2. transformer 在 disposition report 生成后，按 entry 的 archiveRef 从同一份 source records 绑定
   对应内容；找不到来源记录时 fail-closed，不生成不完整 payload。archives 按 archiveRef 排序，
   schema 禁止重复引用。
3. archives 仍属于 migration-isolated staging，不是 Word、ReviewState、FSRS 活跃卡或
   active pointer；它不绕过敏感键 fail-closed 边界，也不允许 UI 直接导出原始 v1 文本。
4. 新字段默认 `[]` 以兼容旧 isolated payload。独立的 Dexie archive 表、压缩/加密、保留周期和
   raw/quarantine UI 仍留给后续存储与治理任务。

## 影响与边界

- 每个已接入 disposition 的 migrated/deduped/quarantined sourceRef 现在都有可复核的隔离内容；
  preferences、unknown 等尚未进入当前 transformer 的域仍不会被伪装成已迁移。
- serializedValue 受 Legacy Source Reader 的大小、排序和敏感字段规则约束；本 ADR 不引入新的
  明文秘密来源。
- 真实 backup fixture、wrongBook/AI/recycleBin/preferences、V01–V25 和 active pointer 激活/回滚
  仍未完成。

## 验证

- 领域切片测试验证 rawArchive 与 quarantine archive 都包含对应 sourceRef 和 serializedValue。
- `npm run verify` 作为合并门槛，isolated payload 仍固定 `writesPerformed:false` 和
  `activePointerUpdated:false`。

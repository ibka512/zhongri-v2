# v1 来源快照契约

## 本轮范围

Task 015 第三小步新增了纯 TypeScript 的 `MigrationSourceSnapshotSchema` 和
`MigrationSourceSnapshotUseCase`。它描述迁移器在读取 v1 数据时需要保存的脱敏来源边界，
第四小步新增了只读 `BrowserV1SourceStorage`、`V1SourceStoragePort` 和
`CaptureV1SourceSnapshotUseCase`，并把完整快照作为可选审计载荷接入现有 staging；仍不会把
快照激活为 v2 业务域。

合成 fixture 位于
[`tests/fixtures/v1-source-snapshot.ts`](../../tests/fixtures/v1-source-snapshot.ts)，只用于
算法和字段形状测试，不代表任何真实用户数据。

## 快照内容

- IndexedDB 与 localStorage 的来源键按 scope 分开保存，每个值先做稳定 JSON 序列化并按键排序。
- 选定备份保留文件名、UTF-8 字节数、原始字节 SHA-256，以及脱敏后的规范 JSON 与摘要。
- 保存 `sourceAppVersion`、`dataSchemaVersion`、`wordStorageVersion` 和 canonical manifest digest。
- `deepseekApiKey` 等敏感键只保存存在/不存在位；键值、备份中的敏感值和嵌套敏感值均替换为
  `[REDACTED]`。
- `capturedAt` 只用于审计，不参与 sourceFingerprint 或 snapshot digest。

## 浏览器读取边界

- 默认读取 v1 `keyval-store` 数据库的 `keyval` 对象仓库，以及当前 origin 的全部
  `localStorage` 键；localStorage 值保持原始字符串，交由 Application 统一序列化和脱敏。
- 读取 IndexedDB 前先枚举已存在数据库；不存在时返回空 IndexedDB 来源，不调用会创建数据库的
  探测式 `open`。对象仓库读取使用 readonly cursor。
- `zhongri_storage_probe` 仅是 v1 能力探测键，不进入迁移快照。无法安全枚举、读取事务异常、
  非字符串来源键或 localStorage 读期间变化时 fail-closed。
- `dataSchemaVersion` 和 `wordStorageVersion` 从可读版本标记解析为非负整数；缺失保留 `null`，
  格式错误拒绝快照。`sourceAppVersion` 由调用方提供，不能从猜测生成。

## Staging 接线

`MigrationStagingDataset.sourceSnapshot` 默认为 `null`，所以既有“备份预检 → 备份 staging”
入口保持不变。带快照的 staging 必须同时提供同一份选定备份：快照的
`selectedBackup.rawDigestSha256` 要等于预检报告文件摘要，脱敏文本摘要也必须一致；通过后以
快照 `sourceFingerprint` 派生 `migrationId`，并持久化完整脱敏快照。Legacy Source Reader
只有在调用方显式选择 `sourceSelection=device` 时才把 snapshot 中的设备记录作为业务来源；
默认仍是 `sourceSelection=backup`。两种入口都只写隔离 staging，不代表业务域已经迁移或可以
切换 active pointer。

## 两个摘要

`sourceFingerprint` 用于迁移幂等身份，输入为：

1. 版本元数据；
2. 排序后的脱敏 IndexedDB/localStorage 键值；
3. canonical manifest digest；
4. 敏感键存在性位；
5. 选定备份的摘要。备份不含敏感字段时使用原始字节摘要；含敏感字段时改用脱敏规范
   JSON 摘要，避免 secret 的变化通过 fingerprint 暴露或破坏幂等。

`snapshotDigestSha256` 对脱敏快照 payload 计算，排除易变的捕获时间、原始备份摘要和原始
文件大小，保证同一来源重复捕获可以比较。

## Fail-closed 边界

来源键为空或重复、值包含循环/不支持的对象、备份 JSON 损坏、文件大小与 UTF-8 字节数不一致、
备份超过 25 MiB 或版本/manifest digest 无效时，use case 直接拒绝创建快照；不会写入 staging。

## 后续未完成

仍需取得脱敏但字段形状真实的 v5+/v10 与 legacy v4 backup fixture（或明确批准 synthetic
方案），然后实现逐域 idMap/transformer、quarantine/rawArchive、V01–V25、active pointer
激活和回滚演练。本文件不表示这些能力已经完成。

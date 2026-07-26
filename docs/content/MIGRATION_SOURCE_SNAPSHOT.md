# v1 来源快照契约

## 本轮范围

Task 015 第三小步新增了纯 TypeScript 的 `MigrationSourceSnapshotSchema` 和
`MigrationSourceSnapshotUseCase`。它描述迁移器在读取 v1 数据时需要保存的脱敏来源边界，
但还没有接入浏览器 IndexedDB/localStorage 读取器，也不会把快照激活为 v2 业务域。

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

下一步仍需在 Infrastructure 中实现只读浏览器来源 adapter，并把快照接入现有迁移 staging。
之后才能开始逐域 idMap/transformer、quarantine/rawArchive、V01–V25、active pointer 激活和
回滚演练。本文件不表示这些能力已经完成。

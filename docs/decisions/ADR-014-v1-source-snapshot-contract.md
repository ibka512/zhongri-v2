# ADR-014：以脱敏稳定快照固定 v1 迁移来源边界

## 状态

已接受（Task 015 第三小步，2026-07-26）。

## 背景

迁移规格要求在任何转换前复制 IndexedDB、localStorage、选定备份和版本事实，并由
sourceFingerprint 支持相同来源的幂等复跑。现有 Task 009/010 已能读取用户上传备份、生成预检
报告和安全 staging，但还没有描述“设备来源键值 + 备份 + canonical manifest”这一完整输入的
版本化契约。

同时，`deepseekApiKey` 不得进入原始档案、日志、报告或 fingerprint 的可逆输入。若直接对含
secret 的原始 payload 做摘要，secret 的变化仍会改变迁移身份，既不符合“只记录存在性”，也会
使同一用户仅改 API Key 就产生新的迁移运行。

## 决策

1. 新增 `MigrationSourceSnapshotSchema`，分别保存 IndexedDB/localStorage 键、脱敏选定备份、
   版本元数据、canonical manifest digest、敏感键存在性、sourceFingerprint 和 snapshot digest。
2. `MigrationSourceSnapshotUseCase` 位于 Application 层，只接收已由 Infrastructure 读取的值，
   不直接调用浏览器 API、Dexie 或页面。
3. 所有对象使用排序键的稳定 JSON 序列化；敏感键及其嵌套值先替换为 `[REDACTED]`。
4. 不含敏感字段的备份使用原始字节摘要作为 fingerprint 输入；含敏感字段的备份使用脱敏规范
   JSON 摘要；敏感字段统一只加入存在/不存在位。
5. `capturedAt`、原始备份摘要和原始文件大小不参与 snapshot digest。快照只作为后续只读
   source snapshot/staging 的输入契约，不改变现有 `MigrationStagingDataset` 语义。
6. 使用覆盖 v1 必须来源键形状的 synthetic fixture 测试算法；不把 fixture 描述为真实用户
   backup，也不在本 ADR 中授权逐域转换、业务激活或 FSRS 写入。

## 后果

- 同一来源在键顺序、捕获时间或敏感值变化时仍能得到稳定的迁移身份；非敏感业务值变化会改变
  fingerprint 并阻止错误复用。
- 快照可供后续 V24 幂等复跑和 V25 回滚使用，但当前还没有浏览器读取 adapter 或持久化接线。
- 不支持的循环/特殊对象和无法安全解析的备份会 fail-closed；后续 adapter 必须在边界处转换为
  JSON-compatible 值。

## 验证

- Schema 拒绝重复来源键和重复敏感字段定义。
- 测试覆盖 18 个 v1 业务 IndexedDB 键、27 个 localStorage 键、现代 v10 备份、secret 脱敏、
  稳定 fingerprint、非敏感变更和损坏 JSON fail-closed。
- `npm run verify` 必须继续通过后，才进入浏览器 source adapter 与逐域转换。

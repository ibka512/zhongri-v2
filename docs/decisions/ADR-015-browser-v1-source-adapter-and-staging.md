# ADR-015：以只读浏览器读取器把 v1 来源快照接入 staging

## 状态

已接受（Task 015 第四小步，2026-07-26）。

## 背景

ADR-014 已固定了脱敏 source snapshot 的字段和摘要算法，但此前所有输入仍由测试或调用方
手工组装。迁移规格要求读取 v1 的真实 `keyval-store/keyval` IndexedDB 和
`localStorage`，同时不能因为探测不存在的数据库而产生写入，也不能把
`zhongri_storage_probe` 当作业务数据迁移。

现有 Task 010 staging 以用户上传备份为入口。直接替换它会破坏已存在的备份预检和幂等语义，
因此需要一个向后兼容的 source-aware staging 分支：旧入口继续以备份文件摘要作为身份；新入口
保存完整脱敏快照，并以快照的 `sourceFingerprint` 作为 migrationId 输入。

## 决策

1. 新增 `V1SourceStoragePort`，只返回原始 IndexedDB/localStorage 值和可确认的版本元数据；
   Application 不依赖浏览器 API。
2. `BrowserV1SourceStorage` 默认读取 `keyval-store` 数据库的 `keyval` 对象仓库。它先用
   `indexedDB.databases()` 确认数据库已经存在，再无版本号打开并以 readonly cursor 读取；
   不存在时返回空 IndexedDB 来源，绝不为了探测而创建数据库。
3. 读取器过滤 `zhongri_storage_probe`，保留其他原始键；localStorage 值保持原始字符串，
   敏感键的脱敏仍由 `MigrationSourceSnapshotUseCase` 统一完成。
4. 新增 `CaptureV1SourceSnapshotUseCase`，先调用 Port 再调用既有 snapshot use case；
   因此排序、特殊值拒绝、secret 脱敏和摘要规则只有一个实现。
5. `MigrationStagingDatasetSchema` 增加默认值为 `null` 的可选 `sourceSnapshot`。没有该字段的
   既有 v1 dataset 仍按旧备份语义解析；带快照时必须满足：
   - dataset/run 的 `sourceFingerprint` 等于快照 fingerprint；
   - 快照选定备份的原始摘要等于预检报告文件摘要；
   - staging 使用快照中的脱敏备份文本和 snapshot digest。
6. source-aware staging 仍只写隔离的 `MigrationRun`/`MigrationStagingDataset`，不写 Word、
   ReviewState、LearningEvent 或其他活跃业务域；active pointer 只有未来逐域验证通过后才可
   提交。

## 兼容性与失败边界

- 新增字段使用 `default(null)`，旧 staging 记录可继续读取；Schema 版本仍为 v1，因为这是
  可选的审计载荷，不改变旧字段的含义。
- IndexedDB 无数据库时不创建新库；无法只读枚举数据库、对象仓库缺失、非字符串键、读取事务
  失败或 localStorage 在读取期间变化时，读取器 fail-closed。
- 版本标记必须是非负整数；缺失可记录为 `null`，格式错误直接拒绝快照。
- 快照与预检备份不一致时返回 `SNAPSHOT_MISMATCH`，不会创建 staging。

## 验证

- fake-indexeddb 测试验证默认数据库/对象仓库、probe 过滤、版本元数据、localStorage 回退、
  不创建缺失数据库和 fail-closed 错误。
- Application 测试验证 Port → snapshot 编排、敏感值不落盘、快照 fingerprint 驱动
  migrationId，以及快照与报告不匹配时拒绝 staging。
- 旧备份 staging、内存/Dexie persistence contract 和完整 `npm run verify` 必须继续通过。

## 不包含

- 真实用户 backup fixture、逐域 transformer、quarantine/rawArchive、V01–V25、业务域激活、
  FSRS 重算或 AI Gateway。

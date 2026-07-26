# Schemas

版本化数据契约。当前冻结版本位于 `v1/`：

- `QuestionSchema`：结构化题目及 MVP 渲染数据。
- `JudgementResultSchema`：判题结果与反馈数据。
- `LearningEventSchema`：只描述已经发生的学习事实。
- `CanonicalWordSchema`：语言域内稳定的内置词条身份与学习内容。
- `CanonicalManifestSchema`：锁定 canonical 资产来源、数量和完整性摘要。
- `CanonicalCorpusManifestSchema`：锁定日英双语 corpus 的总量、语言分布、来源和摘要。
- `MigrationSourceSnapshotSchema`：锁定 v1 来源键值、备份脱敏档案、版本元数据和可复跑指纹。
- `MigrationStagingDatasetSchema.sourceSnapshot`：可选地把完整脱敏来源快照挂到隔离 staging；
  旧备份 staging 记录以 `null` 兼容。
- `MigrationArchiveRecordSchema`：独立保存 staging 的 rawArchive/quarantine 内容、来源摘要、迁移归属
  和稳定版本周期保留策略；记录不代表 active 业务数据。
- `MigrationVerificationReportSchema`：固定 V01–V25 检查顺序和 passed/failed/unverified 结果；未验证
  项不能作为 active 激活授权。
- `TodayPlanSchema`：锁定某个本地日期的基础课程身份、内容版本和题目引用。

Schema 必须保持纯 TypeScript，不依赖 React、浏览器 API、数据库或 AI 实现。

# Application

应用用例与流程编排。通过 Ports 使用外部能力，不直接依赖基础设施实现。Task 015 的
`MigrationSourceSnapshotUseCase` 只处理已读取来源的稳定序列化和脱敏；
`CaptureV1SourceSnapshotUseCase` 负责编排 `V1SourceStoragePort` 与该纯快照用例，仍不直接访问
浏览器 API。

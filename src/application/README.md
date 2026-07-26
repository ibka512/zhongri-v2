# Application

应用用例与流程编排。通过 Ports 使用外部能力，不直接依赖基础设施实现。Task 015 的
`MigrationSourceSnapshotUseCase` 只处理已读取来源的稳定序列化和脱敏，不直接访问浏览器存储。

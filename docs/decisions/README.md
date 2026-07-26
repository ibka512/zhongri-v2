# Architecture Decision Records

ADR 用于记录会长期影响架构、契约、兼容性或迁移的决策。

## 索引

- [ADR-001：冻结核心数据契约](./ADR-001-schema-contracts.md)
- [ADR-002：先实现第一个学习闭环](./ADR-002-first-learning-loop.md)
- [ADR-003：学习事实持久化与幂等事务边界](./ADR-003-persistence-transaction-boundary.md)
- [ADR-004：以版本化会话状态恢复学习流程](./ADR-004-recoverable-study-session.md)
- [ADR-005：使用 GitHub Pages 发布开发预览](./ADR-005-github-pages-preview.md)
- [ADR-006：按会话边界安全地重新开始学习](./ADR-006-session-reset-boundary.md)
- [ADR-007：在任何数据写入前执行 v1 迁移预检](./ADR-007-v1-migration-preflight.md)
- [ADR-008：以隔离 staging 和单一 active pointer 提交迁移](./ADR-008-migration-staging-commit.md)
- [ADR-009：以固定来源 Manifest 发布 canonical 内容身份](./ADR-009-canonical-content-identity.md)
- [ADR-010：以确定性 TodayPlan 编排正式每日课程](./ADR-010-deterministic-daily-course.md)
- [ADR-011：以学习事实重放画像与 FSRS 复习状态](./ADR-011-replayable-profile-fsrs.md)
- [ADR-012：以 canonical corpus 完整性门禁阻断不完整迁移](./ADR-012-canonical-corpus-integrity-gate.md)
- [ADR-013：固定 jp-study 提交并导入完整 canonical corpus](./ADR-013-full-canonical-corpus-import.md)
- [ADR-014：以脱敏稳定快照固定 v1 迁移来源边界](./ADR-014-v1-source-snapshot-contract.md)
- [ADR-015：以只读浏览器读取器把 v1 来源快照接入 staging](./ADR-015-browser-v1-source-adapter-and-staging.md)
- [ADR-016：以确定性 idMap 固化 canonical 与用户词身份](./ADR-016-deterministic-canonical-id-map.md)
- [ADR-017：以统一处置报告固化迁移质量守恒与隔离边界](./ADR-017-migration-disposition-and-quarantine-report.md)
- [ADR-018：以只读 Legacy Source Reader 固定规范化来源记录边界](./ADR-018-legacy-source-reader-contract.md)
- [ADR-019：以核心域纵向切片验证 isolated payload 边界](./ADR-019-core-domain-slice-isolated-payload.md)
- [ADR-020：以单一 Application 编排把核心域结果接入隔离 staging](./ADR-020-core-domain-staging-orchestration.md)
- [ADR-021：显式设备来源选择并把 source snapshot 接入 Legacy Source Reader](./ADR-021-device-source-reader-wiring.md)
- [ADR-022：以只读隔离 payload 转换 Mastery、StudyRecord 与 FSRS](./ADR-022-mastery-study-fsrs-isolated-transformer.md)
- [ADR-023：以确定性隔离 payload 保存 v1 组完成次数](./ADR-023-group-progress-isolated-transformer.md)
- [ADR-024：在 isolated payload 内绑定 rawArchive 与 quarantine 内容](./ADR-024-isolated-archive-payloads.md)

## 未来

- 仅在出现新的长期架构、契约或兼容性决策时创建，不预先占位实现。

## 规则

- 已接受的 ADR 不直接改写历史结论。
- 新决策或语义变更新增编号。
- Schema 变更必须说明兼容性、迁移影响和测试要求。

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

## 未来

- 仅在出现新的长期架构、契约或兼容性决策时创建，不预先占位实现。

## 规则

- 已接受的 ADR 不直接改写历史结论。
- 新决策或语义变更新增编号。
- Schema 变更必须说明兼容性、迁移影响和测试要求。

# Architecture Decision Records

ADR 用于记录会长期影响架构、契约、兼容性或迁移的决策。

## 索引

- [ADR-001：冻结核心数据契约](./ADR-001-schema-contracts.md)
- [ADR-002：先实现第一个学习闭环](./ADR-002-first-learning-loop.md)
- [ADR-003：学习事实持久化与幂等事务边界](./ADR-003-persistence-transaction-boundary.md)
- [ADR-004：以版本化会话状态恢复学习流程](./ADR-004-recoverable-study-session.md)
- [ADR-005：使用 GitHub Pages 发布开发预览](./ADR-005-github-pages-preview.md)

## 未来

- 仅在出现新的长期架构、契约或兼容性决策时创建，不预先占位实现。

## 规则

- 已接受的 ADR 不直接改写历史结论。
- 新决策或语义变更新增编号。
- Schema 变更必须说明兼容性、迁移影响和测试要求。

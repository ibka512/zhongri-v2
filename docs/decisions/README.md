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
- [ADR-025：以隔离 payload 保存错题本事实](./ADR-025-wrong-book-isolated-transformer.md)
- [ADR-026：以隔离 payload 保存回收站项目](./ADR-026-recycle-bin-isolated-transformer.md)
- [ADR-027：以隔离 payload 保存 AI 会话历史](./ADR-027-ai-conversation-isolated-transformer.md)
- [ADR-028：以隔离 payload 保存 AI 小测历史](./ADR-028-ai-quiz-history-isolated-transformer.md)
- [ADR-029：以隔离 payload 保存安全偏好](./ADR-029-preference-isolated-transformer.md)
- [ADR-030：将迁移 rawArchive 与 quarantine 写入独立存储](./ADR-030-independent-migration-archives.md)
- [ADR-031：以只验证的 V01–V25 报告阻断未完成迁移](./ADR-031-migration-verification-report.md)
- [ADR-032：以隔离 payload 保存提醒设置并保持权限未知](./ADR-032-reminder-setting-isolated-transformer.md)
- [ADR-033：以 V01–V25 验证报告作为迁移激活门禁](./ADR-033-migration-activation-gate.md)
- [ADR-034：以固定抽样与失败注入证据完成 V23/V25 验收](./ADR-034-migration-verification-evidence.md)
- [ADR-035：以持久化 staged payload 重建验证报告](./ADR-035-staged-verification-orchestration.md)
- [ADR-036：以批准的 synthetic fixture 验收迁移边界](./ADR-036-approved-synthetic-migration-acceptance.md)
- [ADR-037：以负责人真实 v1 数据手工验收关闭迁移阻塞](./ADR-037-real-v1-manual-acceptance.md)
- [ADR-038：以本地 UserSettings 契约承载 Phase 1 首次设置](./ADR-038-phase1-onboarding-settings.md)
- [ADR-039：以只读安全摘要承载设置与数据页首个切片](./ADR-039-settings-data-page.md)
- [ADR-040：以 canonical repository 驱动内容中心只读首个切片](./ADR-040-content-center-readonly-slice.md)
- [ADR-041：以浏览器内置朗读承载五十音最小切片](./ADR-041-kana-tts-slice.md)
- [ADR-042：以 canonical 英语词条承载音标最小切片](./ADR-042-english-ipa.md)
- [ADR-043：按语言边界保留双语复习投影](./ADR-043-bilingual-projection-preservation.md)
- [ADR-044：以独立 Gateway 隔离 AI 供应商与学习事实](./ADR-044-ai-gateway-boundary.md)

## 未来

- 仅在出现新的长期架构、契约或兼容性决策时创建，不预先占位实现。

## 规则

- 已接受的 ADR 不直接改写历史结论。
- 新决策或语义变更新增编号。
- Schema 变更必须说明兼容性、迁移影响和测试要求。

# ADR-017：以统一处置报告固化迁移质量守恒与隔离边界

## 状态

已接受（Task 015 第六小步，2026-07-26）。

## 背景

canonical idMap 已经固定 oldRef → targetWordId，但各个逐域 transformer 仍需要统一表达“已迁移、
重复合并、不可关联、只存档”的结果。如果每个域自行记录数量和隔离原因，V21 质量守恒、V24
幂等复跑和后续审计就无法比较，也容易把 quarantine 记录误写入 active dataset。

真实 v1 backup fixture 尚未到位，本决策先冻结通用处置契约，不声称任何业务域已经迁移。

## 决策

1. 新增 `MigrationDispositionReportSchema` 与 `MigrationDispositionReportUseCase`，逐条保存
   sourceRef、domain、sourceRecordDigest、outcome、severity、reason、targetRefs 和 archive ref。
2. outcome 只允许 `migrated`、`deduped`、`quarantined`；quarantine 不得有活跃目标，dedupe 必须
   指向 canonicalSourceRef。
3. rawArchive/quarantine 引用由 `migrationId + sourceRef + sourceRecordDigest` 确定性生成，
   报告只保存引用与摘要，不复制原始 payload。
4. entries 按 sourceRef 排序且来源引用唯一；Schema 强制
   `source = migrated + deduped + quarantined`，并绑定 `identityMapDigestSha256`。
5. 重复 sourceRef、非法处置组合、无效 digest 或敏感 payload 进入报告的情况均 fail-closed。

## 兼容性与影响

- 新契约不修改既有 backup preview、source snapshot、staging 或 idMap 的字段语义。
- 后续 transformer 可以复用相同报告结构；只有报告和 V01–V25 验证通过后，才允许继续 isolated
  staging 的 active commit 流程。
- rawArchive/quarantine 的实际 payload 存储仍由后续 MigrationMetadata/staging 任务实现，
  本 ADR 不提前实现数据库写入。

## 验证

- 应用测试覆盖输入顺序幂等、三类处置、计数守恒、rawArchive/quarantine 引用、重复 sourceRef、
  非法目标组合、敏感文本不进入报告和 digest fail-closed。
- `npm run verify` 是合并门槛；本 ADR 不表示真实 fixture、V01–V25 或 active pointer 已完成。

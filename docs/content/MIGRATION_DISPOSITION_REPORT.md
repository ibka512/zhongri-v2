# 迁移处置与隔离报告契约

## 本轮范围

Task 015 第六小步新增 `MigrationDispositionReportSchema` 与
`MigrationDispositionReportUseCase`。它是后续逐域 transformer 的共同输出边界：每条来源记录
必须被标记为 `migrated`、`deduped` 或 `quarantined`，并留下目标引用、原因、严重级别和来源
记录摘要。该用例只生成可审计报告，不写入 Word、UserWord、Override、active pointer 或其他
活跃业务域。

它消费第五小步冻结的 `identityMapDigestSha256`，所以关系域不能绕过 idMap 重新猜测词条身份。
当前仍未接入真实 v1 backup reader；测试数据只验证契约和失败边界。

## 处置语义

- `migrated`：已创建一个或多个活跃目标，必须有 `targetRefs`，不能填写
  `canonicalSourceRef` 或 `quarantineCode`。
- `deduped`：来源记录被并入已有目标，必须同时保留 `canonicalSourceRef` 和目标引用；可选把
  原始记录放入 `rawArchive`。
- `quarantined`：不创建活跃目标，必须有 `quarantineCode`、warning/blocking 严重级别和
  确定性 `quarantine-v1:<sha256>` 引用。

未知字段、历史快照、重复记录或无法关联的数据只能通过 `rawArchive`/`quarantine` 引用审计，
报告本身不携带原始 payload，避免敏感值进入日志和可导出报告。

## 质量守恒与幂等

报告保存 `source / migrated / deduped / quarantined / rawArchived` 计数，并由 Schema 检查
`source = migrated + deduped + quarantined`。entries 按 `sourceRef` 的代码点顺序排序，来源
引用必须唯一，目标引用也不能重复；同一来源换输入顺序会得到相同 archive ref 和
`reportDigestSha256`。

报告同时保存 `sourceFingerprint` 和冻结的 `identityMapDigestSha256`，可在后续 V21/V24 验证中
证明处置结果来自同一份来源和身份映射。

## Fail-closed 边界

- 重复 `sourceRef` 在任何 archive digest 计算前拒绝。
- migrated 没有 target、deduped 没有 canonicalSourceRef、quarantined 带有 target，或
  quarantine 使用 info 严重级别，均拒绝生成报告。
- digest adapter 返回非 SHA-256 值时拒绝，不生成伪造 archive/report digest。
- `rawArchive` 与 `quarantine` 不能在同一条记录上混用；二者的原始内容仍由未来 staging
  存储层按引用写入，当前用例不接触 payload。

## 后续接线

LegacyReader 和 Word/Override/Folder/Favorite/Mastery/StudyRecord/FSRS 等 transformer 应为每条
来源记录先生成 `sourceRecordDigestSha256`，再把处置输入交给该用例。报告通过后，下一层才能把
可迁移目标写入同一 `migrationId` 的 isolated staging；在 V01–V25 通过前不得提交 active pointer。

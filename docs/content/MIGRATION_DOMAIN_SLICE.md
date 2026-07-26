# v1 核心域纵向转换契约

## 本轮范围

本轮在已完成的 Legacy Source Reader、canonical idMap 和 disposition report 之上，新增
`MigrationDomainSliceUseCase`。它使用字段形状 synthetic fixture 贯通四个核心域：

`words → overrides → folders → favorites → migration-isolated-domain-slice`

本轮的 synthetic fixture 不是任何用户的真实历史。它只验证 `db/userWords`、
`wordOverrides`、`folders/folderLangs` 和 `stars` 的字段形状、身份关联、重复处理和 quarantine
边界。真实脱敏 backup 到位前，不能把测试结果描述为真实迁移完成。

## 输入与输出

用例输入是已经由 `MigrationLegacySourceReaderUseCase` 校验的
`MigrationLegacySourceSchema`。用例只选择 `words`、`overrides`、`folders` 和 `favorites` 记录；
其他域保留在 reader 结果中，等待后续 transformer，不会被静默当成已迁移。

输出 `MigrationDomainSliceResultSchema` 同时绑定三个结果：

- `identityMap`：所有 Word/Override 身份解析仍由既有 canonical idMap 完成；
- `dispositionReport`：四个域的每条 sourceRef 都有 `migrated`、`deduped` 或 `quarantined` 去向，
  成功/去重记录生成 rawArchive 引用，quarantine 不生成活跃目标；
- `isolatedPayload`：包含 canonical/user Word、Override、Folder、Favorite 目标，带 reader、
  idMap、处置报告和自身 payload 摘要。

`isolatedPayload.datasetId` 固定派生自 `migrationId`，并明确携带
`writesPerformed: false` 与 `activePointerUpdated: false`。纵向用例本身不调用
`MigrationPersistencePort`；现有 `StageV1BackupInput.isolatedDomainSlice` 已提供可选的隔离
staging 存储入口，仍不提交 active pointer，也不改变 Word、ReviewState 或 FSRS。

## 身份与关系规则

1. Word 的 `db` 记录按 built-in 处理，`userWords` 按 user 处理；实际目标 ID 只能来自既有
   identity map。
2. Override 以 `data.wordOverrides["old-id"]` 的 sourceRef 关联目标；孤立 key 进入
   `OVERRIDE_ORPHAN` quarantine。
3. Folder 只有同时拥有非空名称和合法 `folderLangs` 语言时才生成确定性
   `folder-v1-*` 目标；孤立/冲突语言不写入 payload。
4. Favorite 只接受可唯一解析到 Word 的旧 ID（兼容 `ja:id` / `en:id` 前缀）；不能唯一解析的
   关系进入 `RELATION_UNRESOLVED` quarantine。
5. 同一目标的重复 Word、Folder、Override 或 Favorite 只生成一个 payload，其余记录标记
   `deduped` 并保留 canonical sourceRef。

## 安全与后续边界

- Override payload 只保留 Legacy Reader 已脱敏的 `serializedValue`；明文 API Key 在更早的
  reader 边界已经 fail-closed。
- disposition report 只生成 rawArchive/quarantine 引用；实际原始 payload 存储仍待后续
  `MigrationMetadata`/staging 切片。
- 该切片不代表 Mastery、StudyRecord、FSRS、AI、V01–V25 或 active pointer 已完成；staging 字段
  接线仍需真实来源和后续验证。
- 下一步是在真实脱敏 fixture（或负责人批准的字段形状 synthetic fixture）上扩展剩余域，并把
  isolated payload 接入 staging 持久化，再实现验证和激活/回滚。

## 测试证据

`tests/application/migration-domain-slice.test.ts` 覆盖：

- canonical Word、user Word、Override、Folder、Favorite 的端到端目标生成；
- 孤立 Override 的 quarantine 与数量守恒；
- reader → transformer → report → isolated payload 的 digest 绑定；
- 重复运行完全相同，且没有 persistence/active pointer 写入。
- 将 isolated payload 作为可选字段存入现有 staging dataset，同时 active pointer 保持为空。

## 统一编排入口

`MigrationDomainSliceStagingUseCase` 现在提供单一 Application 入口，固定执行：

`prepareV1MigrationSource → Legacy Source Reader → Domain Slice → MigrationStagingUseCase`

它复用 staging 的来源一致性和脱敏逻辑，返回 source、slice 和 staging 三份可审计结果；调用方
必须显式选择 `sourceSelection=backup|device`，后者把同一 source snapshot 的设备记录交给
Legacy Source Reader，并报告 IDB/localStorage 分歧。重复调用相同输入会复用 staging dataset，
payload digest 不同则不会静默复用旧结果。该入口只执行隔离 `stage`，不执行 commit。

# v1 核心域纵向转换契约

## 本轮范围

本轮在已完成的 Legacy Source Reader、canonical idMap 和 disposition report 之上，新增
`MigrationDomainSliceUseCase`。当前 isolated transformer 已贯通核心词域和第一批学习事实域：

`words → overrides → folders → favorites → mastery → studyRecords → groupProgress → wrongBook → recycleBin → aiConversations → fsrsCards → fsrsLogs`

本轮的 synthetic fixture 不是任何用户的真实历史。它只验证 `db/userWords`、
`wordOverrides`、`folders/folderLangs`、`stars`、`mtWordClears`、`studyRecords`、
`fsrsCards`、`fsrsReviewLogs`、`mtGroupClears` 和 `wrongBook` 的字段形状、身份关联、重复处理和 quarantine 边界。真实脱敏
backup 到位前，不能把测试结果描述为真实迁移完成。

## 输入与输出

用例输入是已经由 `MigrationLegacySourceReaderUseCase` 校验的
`MigrationLegacySourceSchema`。用例选择 `words`、`overrides`、`folders`、`favorites`、
`mastery`、`studyRecords`、`groupProgress`、`wrongBook`、`recycleBin`、`aiConversations`、`fsrsCards` 和 `fsrsLogs` 记录；
preferences 和 unknown 仍保留在 reader 结果中，等待后续 transformer，不会被静默当成已迁移。

输出 `MigrationDomainSliceResultSchema` 同时绑定三个结果：

- `identityMap`：所有 Word/Override 身份解析仍由既有 canonical idMap 完成；
- `dispositionReport`：已接入域的每条 sourceRef 都有 `migrated`、`deduped` 或 `quarantined` 去向，
  成功/去重记录生成 rawArchive 引用，quarantine 不生成活跃目标；
- `isolatedPayload`：包含 canonical/user Word、Override、Folder、Favorite、Mastery、StudyEvent、GroupProgress、
  WrongBook、RecycleBin、AIConversation、legacy ReviewCard 和 ReviewLog 目标，带 reader、idMap、处置报告和自身 payload 摘要。

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
6. Mastery、StudyRecord、FSRS 卡和日志都只能复用既有 identity map；Mastery 重复状态按 Boolean
   OR 合并，StudyRecord 按 `eventType + dateOnly + groupLabel` 去重，FSRS 日志必须关联有效隔离卡。
   关系、关键数值或关键时间无法解释时进入 quarantine。
7. FSRS payload 只保存 `ts-fsrs@v1-adapter` 的历史卡状态，不调用 v2 scheduler、不重算、不由
   mastery/reps 反造 LearningEvent；未知学习记录类型保留 `UNKNOWN` 与 raw。
8. GroupProgress 只保存规范化组键和非负完成次数；小数向下取整、非法值置 0 并标记质量，重复
   组键取最大值去重，不推导具体 StudySession 或组成员。
9. WrongBook 只保存能关联到既有 Word 身份的错题本聚合事实；计数使用非负整数投影，状态/日期/最近答题
   的不确定性通过 quality flag 保留，最近答题最多 20 条，不从汇总反造 LearningEvent。
10. RecycleBin 只保存 tombstone 和脱敏嵌套快照；kind、时间和可关联 Word 目标保守解析，以 source
    exportDate 判断过期，不执行 restore/cleanup，也不把已删除内容写回活跃域。
11. AIConversation 只保存可审计的会话快照和有序消息；cacheKey/旧 ID 优先去重，未知 role 与日期/语言
    不确定性通过 quality flag 保留，不调用 AI、不迁移 provider/API Key。

## 安全与后续边界

- Override payload 只保留 Legacy Reader 已脱敏的 `serializedValue`；明文 API Key 在更早的
  reader 边界已经 fail-closed。
- disposition report 生成 rawArchive/quarantine 引用后，当前 transformer 会把已脱敏的对应
  `serializedValue` 绑定到 isolated payload 的 `archives`；独立 Dexie archive 表、压缩/加密和保留
  周期仍待后续 `MigrationMetadata`/存储切片。
- 该切片不代表真实 Mastery、StudyRecord、FSRS、WrongBook、RecycleBin、AIConversation 字段覆盖、AI Quiz、V01–V25 或 active pointer 已完成；
  staging 字段接线仍需真实来源和后续验证。
- 下一步是在真实脱敏 fixture（或负责人批准的字段形状 synthetic fixture）上扩展剩余域，并把
  isolated payload 接入 staging 持久化，再实现验证和激活/回滚。

## 测试证据

`tests/application/migration-domain-slice.test.ts` 覆盖：

- canonical Word、user Word、Override、Folder、Favorite 的端到端目标生成；
- Mastery 三维/needsReview 保留与关系 quarantine；
- `daily_punch`/`pendulum` 的 StudyEvent 映射、日期质量标记和确定性去重；
- `mtGroupClears` 组完成次数的确定性 ID、小数取整和 quality flag；
- `wrongBook` 的身份关联、计数/状态/日期投影、最近答题上限和关系 quarantine；
- `recycleBin` 的 item ID、kind、时间基准、过期状态和 resolved target 投影；
- `aiConversations` 的 cacheKey/旧 ID 去重、日期/语言质量、消息 role 顺序和 Word 关联；
- legacy FSRS 卡的完整状态保存、坏卡/孤立日志 quarantine、日志内容指纹去重；
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

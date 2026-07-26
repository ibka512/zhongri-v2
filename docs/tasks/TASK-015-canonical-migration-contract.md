# Task 015：v1 迁移逐域转换与 canonical 身份层

关联：[GitHub Issue #23](https://github.com/ibka512/zhongri-v2/issues/23)

## 已完成切片

本分支先完成迁移的输入契约和 fail-closed 完整性门禁：

- `CanonicalCorpusManifestSchema` 要求双语数量、总量、来源和两个 SHA-256 摘要。
- 固定 V01/V02 目标为 9,828 条（ja 5,906、en 3,922）。
- `verifyCanonicalCorpusIntegrity` 检查重复身份、数量、语言分布和摘要；目标不满足时不能
  进入激活阶段。
- 只使用合成 fixture 测试算法，不提交或伪造真实用户数据及完整词库。

第二小步已从固定的 `ibka512/jp-study@36c8129dfc364453198790b64687ff9105a3ecae` 导入真实
canonical corpus：日语 5,906 条、英语 3,922 条。资产映射、许可、字段覆盖和摘要见
[canonical corpus 导入记录](../content/CANONICAL_CORPUS_IMPORT.md)，实现决策见
[ADR-013](../decisions/ADR-013-full-canonical-corpus-import.md)。

第三小步已建立 `MigrationSourceSnapshotSchema` 与 `MigrationSourceSnapshotUseCase`：覆盖
18 个 v1 业务 IndexedDB 键、27 个 localStorage 键、选定备份、版本元数据和 canonical
manifest digest；所有键值稳定排序，敏感键只保留存在性并替换为 `[REDACTED]`。合成但字段形状
真实的 fixture 和测试见 [v1 来源快照契约](../content/MIGRATION_SOURCE_SNAPSHOT.md) 与
[ADR-014](../decisions/ADR-014-v1-source-snapshot-contract.md)。第四小步新增只读浏览器
source adapter、Port → snapshot 应用编排，并将完整脱敏快照以 `sourceSnapshot` 可选字段接入
现有隔离 staging；旧备份 staging 入口保持兼容。实现决策见
[ADR-015](../decisions/ADR-015-browser-v1-source-adapter-and-staging.md)。

第五小步新增 `MigrationIdentityMapSchema` 与 `MigrationIdentityMapUseCase`：在 canonical 完整性
门禁通过后，按迁移规格 §5 固化 `language + wordId`、用户词 ID 保留/确定性生成、headword
candidate、跨语言冲突和关系/override quarantine；输出按 `sourceRef` 排序且带稳定 digest，
只作为隔离应用层结果，不写入 active dataset。实现决策见
[ADR-016](../decisions/ADR-016-deterministic-canonical-id-map.md)，契约说明见
[v1 身份映射契约](../content/MIGRATION_IDENTITY_MAP.md)。

第六小步新增 `MigrationDispositionReportSchema` 与 `MigrationDispositionReportUseCase`：统一
`migrated / deduped / quarantined` 三类处置、rawArchive/quarantine 确定性引用、V21 数量守恒、
输入顺序幂等和 identity-map digest 绑定；仍只输出隔离报告，不写 active dataset。实现决策见
[ADR-017](../decisions/ADR-017-migration-disposition-and-quarantine-report.md)，契约说明见
[迁移处置与隔离报告契约](../content/MIGRATION_DISPOSITION_REPORT.md)。

第七小步新增 `MigrationLegacySourceSchema` 与 `MigrationLegacySourceReaderUseCase`：读取 staging
中的脱敏现代 v5+/v10 或 legacy v4 JSON，按固定 sourceRef 枚举规范化但未关联的 legacy records，
保存 `wordStorageVersion` 元数据、未知字段、逐条 digest 和 reader digest；类型错误进入可解释
记录，明文 API Key、坏 JSON、过深嵌套和摘要失败 fail-closed。该 reader 仍是只读应用层输出，不
读取浏览器 API、不写 active dataset。实现决策见
[ADR-018](../decisions/ADR-018-legacy-source-reader-contract.md)，契约说明见
[v1 Legacy Source Reader 契约](../content/MIGRATION_LEGACY_SOURCE_READER.md)。

第八小步新增 `MigrationDomainSliceSchema` 与 `MigrationDomainSliceUseCase`：在 reader 输出之上
贯通 `words / overrides / folders / favorites`，复用冻结的 canonical idMap，生成确定性
Word/Override/Folder/Favorite isolated payload，并为每条核心域 sourceRef 生成
`migrated / deduped / quarantined` disposition。synthetic fixture 只验证字段形状，不代表真实
用户历史；payload 明确 `writesPerformed:false`、`activePointerUpdated:false`，纵向用例不直接写入
`MigrationPersistencePort`，但现有 staging 已提供可选 payload 字段。契约说明见
[v1 核心域纵向转换契约](../content/MIGRATION_DOMAIN_SLICE.md)，实现决策见
[ADR-019](../decisions/ADR-019-core-domain-slice-isolated-payload.md)。

第九小步新增 `MigrationDomainSliceStagingUseCase`：统一编排脱敏来源准备、Legacy Source Reader、
核心域转换和现有 staging，用例返回 source/slice/staging 三份结果；staging replay 额外绑定
isolated payload digest，仍不执行 commit。实现决策见
[ADR-020](../decisions/ADR-020-core-domain-staging-orchestration.md)。

第十小步新增显式 `sourceSelection=backup|device`：`device` 必须绑定同一
`sourceFingerprint` 的 `MigrationSourceSnapshot`，Legacy Source Reader 按迁移规格复制
IndexedDB 优先/localStorage 回退语义，输出 `sourceOrigin`、设备 sourceRef 和
`storageDivergences`。分离词存储存在时，`myWordDB_v3` 只作为 unknown archive-only 记录；
UI 新增独立的当前设备暂存入口，仍只执行 stage。实现决策见
[ADR-021](../decisions/ADR-021-device-source-reader-wiring.md)。

第十一小步新增 Mastery、StudyRecord、FSRS 卡和 FSRS 日志的 isolated transformer：关系只复用
冻结的 identity map；掌握状态 OR 合并并保留缺失标记，学习记录按日期粒度映射，FSRS 卡保存
`ts-fsrs@v1-adapter` 历史状态，日志必须关联有效隔离卡。重复/坏关系进入统一 disposition，payload
仍不写 active dataset、不重算 FSRS、不伪造 LearningEvent。实现决策见
[ADR-022](../decisions/ADR-022-mastery-study-fsrs-isolated-transformer.md)，契约说明见
[v1 核心域纵向转换契约](../content/MIGRATION_DOMAIN_SLICE.md)。

第十二小步新增 `groupProgress` isolated transformer：`mtGroupClears_v3` 组键规范化、完成次数
取整/质量标记和重复组键去重均输出到隔离 payload，不拆解历史成员、不生成 StudySession。实现
决策见 [ADR-023](../decisions/ADR-023-group-progress-isolated-transformer.md)。

第十三小步新增 `isolatedPayload.archives`：把 disposition report 的 rawArchive/quarantine 引用
与同一份 Legacy Source Reader 脱敏 serializedValue 绑定，保证 staged 结果可以离线复核且不重新
读取 v1。独立归档表、压缩/加密与保留周期仍待存储治理任务。实现决策见
[ADR-024](../decisions/ADR-024-isolated-archive-payloads.md)。

第十四小步新增 `wrongBook` isolated transformer：按既有 identity map 解析错题本目标，保守投影累计
计数、维度/来源计数、状态、日期和最多 20 条最近答题；不确定字段通过 quality flag 保留，孤立目标
进入 `RELATION_UNRESOLVED` quarantine，结果仍不写入 active dataset。实现决策见
[ADR-025](../decisions/ADR-025-wrong-book-isolated-transformer.md)，契约说明见
[v1 核心域纵向转换契约](../content/MIGRATION_DOMAIN_SLICE.md)。

第十五小步新增 `recycleBin` isolated transformer：按原始 item ID 或确定性内容指纹保存 tombstone，
保守映射 kind、删除/过期时间和可关联 Word 目标，以 source exportDate 判断 retention status；未知或
过期项目只保留在隔离容器，不执行 restore/cleanup。实现决策见
[ADR-026](../decisions/ADR-026-recycle-bin-isolated-transformer.md)，契约说明见
[v1 核心域纵向转换契约](../content/MIGRATION_DOMAIN_SLICE.md)。

第十六小步新增 `aiConversations` isolated transformer：按 cacheKey/旧 ID/内容指纹生成确定性会话 ID，
保留 dateText、系统提示词、预设、Word 快照和有序消息；未知 role、日期、语言或超长消息通过 quality
flag 保留，结果不调用 AI、不激活会话。实现决策见
[ADR-027](../decisions/ADR-027-ai-conversation-isolated-transformer.md)，契约说明见
[v1 核心域纵向转换契约](../content/MIGRATION_DOMAIN_SLICE.md)。

第十七小步新增 `aiQuizHistory` isolated transformer：按旧 quiz ID 或确定性来源指纹保存小测元数据和
最多 100 条逐题答案，统计缺失/冲突、语言/词条关联和答案截断通过 quality flag 保留，不反造
LearningEvent。实现决策见 [ADR-028](../decisions/ADR-028-ai-quiz-history-isolated-transformer.md)，
契约说明见 [v1 核心域纵向转换契约](../content/MIGRATION_DOMAIN_SLICE.md)。

第十八小步新增 `preferences` isolated transformer：按白名单保存安全偏好，未知键进入 quarantine，
`deepseekApiKey` 只保留脱敏存在性和 requiresSecretReentry 标记；该结果不直接写 UserPreference、
ReminderSetting 或 active pointer。实现决策见 [ADR-029](../decisions/ADR-029-preference-isolated-transformer.md)，
契约说明见 [v1 核心域纵向转换契约](../content/MIGRATION_DOMAIN_SLICE.md)。

第十九小步将 inline `archives` 投影到独立 `migrationArchives` 存储：保留 rawArchive/quarantine、
来源 digest、migration/dataset 归属和 stable-version-cycle 保留策略；staging 同事务写入，回滚不清理，
不自动清理、不写 active 数据。实现决策见 [ADR-030](../decisions/ADR-030-independent-migration-archives.md)。

第二十小步新增只验证的 V01–V25 报告：固定检查顺序，先覆盖 canonical 数量、逐域 disposition 守恒、
隔离外键/主键/时间与可选重跑幂等；提醒设置、固定抽样和失败注入回滚在证据到位前保持
`unverified`，报告不调用 persistence、不授权 active。实现决策见
[ADR-031](../decisions/ADR-031-migration-verification-report.md)。

第二十一步新增 `reminderSettings` isolated transformer：按 `nativeStudyReminderSettingsV2` 优先、旧
enabled/time 键回退归一化提醒设置，权限固定 unknown，不迁移系统排程；V18 在来源完整映射时通过。
实现决策见 [ADR-032](../decisions/ADR-032-reminder-setting-isolated-transformer.md)。

第二十二步新增 `MigrationActivationUseCase`：激活前必须提交通过的 V01–V25 报告，校验
`migrationId/sourceFingerprint` 与 staged dataset 一致且包含 isolated payload，再把验证报告 digest
绑定到 `MigrationRun` 并调用既有 active pointer 原子提交。实现决策见
[ADR-033](../decisions/ADR-033-migration-activation-gate.md)。测试中的 all-pass 报告只验证门禁机械流程，
不替代真实迁移证据。

第二十三步新增 `MigrationFixedSamplingUseCase` 与 `MigrationRollbackDrillUseCase`：V23 按
`sourceFingerprint` 固定种子覆盖 16 类抽样并校验 source digest 到 payload/archive 的绑定；V25 在
stage/commit/rollback 三阶段注入失败并校验 active pointer、MigrationRun 与脱敏快照不变。证据通过
可选输入接回验证报告，缺少证据仍保持 `unverified`。实现决策见
[ADR-034](../decisions/ADR-034-migration-verification-evidence.md)。

## 后续范围

在真实 v1 backup fixture 到位后，继续实现：

1. 获取脱敏但字段形状真实的 v5+/v10、legacy v4 backup fixture，或记录负责人批准的
   synthetic 方案；当前设备 snapshot → LegacyReader 的入口和优先级已接通，但仍需真实 fixture
   复核字段覆盖。
2. 用真实/批准的 fixture 复核第十、十一小步的设备来源、字段覆盖和分歧报告。
3. 在真实 fixture 上继续复核字段覆盖，使用固定抽样与失败注入入口补齐 V02/V23/V25 的真实证据；
   独立 archive 记录只读、不自动清理，直到保留周期与用户确认策略明确。
4. 已完成 activation gate 的代码接线；在真实 fixture 上产生 V01–V25 报告后，使用该 gate 完成
   active pointer 原子提交/回滚验收。

## 前置条件

- 已固定的 9,828 canonical asset source、来源 manifest 和 SHA-256 清单已进入仓库。
- canonical idMap 和 Word/Override/Folder/Favorite isolated payload 应用层契约及确定性算法已进入
  仓库，但尚未接入真实 backup fixture 或活跃迁移写入。
- 脱敏但字段形状真实的现代 v5+/v10 与 legacy v4 backup fixture，或负责人明确批准的
  synthetic fixture 方案；当前仓库的 synthetic fixture 只用于 snapshot 算法测试。
- 真实输入到位前，不得把 20 条 N5 日语词条描述为完整 corpus，不得激活迁移业务域。

## 明确不包含

- AI Gateway、模型 SDK、自由聊天或 AI 题目生成（Issue #20 保持阻塞）。
- 首次设置、设置/数据页、五十音/TTS、英语/IPA 内容切片。
- 旧 `word.srs` 活跃化、FSRS 重算或从汇总反造 LearningEvent。

## 第一小步验收

- Schema 拒绝缺失 `ja`/`en` 计数或不守恒的 Manifest。
- 匹配的双语合成 fixture 可通过完整性验证。
- 重复 `language:id`、数量/语言分布偏差、身份摘要或内容摘要不匹配时返回失败报告。
- 传入 9,828/5,906/3,922 验收目标时，当前 20 条资产明确 fail-closed。
- `npm run verify` 通过。

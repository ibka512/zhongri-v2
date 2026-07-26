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

## 后续范围

在真实 v1 backup fixture 到位后，继续实现：

1. 获取脱敏但字段形状真实的 v5+/v10、legacy v4 backup fixture，或记录负责人批准的
   synthetic 方案；当前设备 snapshot → LegacyReader 的入口和优先级已接通，但仍需真实 fixture
   复核字段覆盖。
2. 将第十小步 orchestration 接入真实设备来源和 UI/CLI 调用，再在真实/批准的 fixture 上扩展
   Mastery/StudyRecord/FSRS 等逐域转换。
3. 将处置报告接入 rawArchive/quarantine payload 的实际隔离存储。
4. V01–V25 自动化验证、固定 sourceFingerprint 幂等复跑和 active pointer 原子提交/回滚。

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

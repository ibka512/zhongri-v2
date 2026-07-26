# 钟日 v2 架构边界

当前工程采用以下依赖方向：

```text
UI Layer
↓
Application Layer
↓
Domain Core
↓
Ports
↓
Infrastructure Adapters
```

## 当前各层职责

- **UI Layer**：页面、路由和展示组件，只负责呈现状态与收集用户输入。
- **Application Layer**：编排用例与事务边界，调用 Domain 和 Ports。
- **Domain Core**：纯 TypeScript 业务规则，不感知 React、浏览器或持久化实现。
- **Ports**：定义 Domain/Application 需要的外部能力接口。
- **Infrastructure Adapters**：实现持久化、网络和浏览器能力等 Ports。

## 强制规则

1. Domain 不依赖 React。
2. Domain 不依赖浏览器 API。
3. 页面不能直接访问数据库。
4. UI 组件不能直接调用 AI。
5. Zustand 不能保存业务事实。
6. 数据必须通过 Repository 访问。

Task004 首次在该依赖方向中加入纯 TypeScript Domain 判题和 Application 内存会话编排。
Task005 加入学习持久化 Ports，以及共享同一契约测试的内存/Dexie 适配器。
Task006 加入版本化会话状态和恢复；Task008 加入按会话清除与重新开始用例。
Task009 加入只读迁移预检用例、来源摘要 Port 和版本化报告 Schema。
Task010 加入版本化迁移运行、隔离数据集、active pointer 和原子提交/回滚 Port。
Task011 加入版本化 canonical 内容、固定来源 Manifest 和内容 Repository Port。
Task015 当前切片加入纯 Application source snapshot contract：Infrastructure 通过
`V1SourceStoragePort` 只读读取 IndexedDB/localStorage，Application 负责稳定序列化、敏感字段
脱敏和 sourceFingerprint，并把完整脱敏快照作为可选审计载荷接入隔离 staging；快照仍未激活
任何业务域。
Task012 加入确定性 TodayPlan、正式每日课程编排和文本题判定。
Task013 加入可重放 LearnerProfile、ReviewState、ReviewScheduler Port 与 Dexie v4 投影。
`/today` 与 `/study-demo` 只消费 Application 快照，不直接执行业务规则或访问数据库。

## Task005 学习事务

一次答案提交按以下顺序执行：

1. Application 调用纯 Domain Judge 并创建 LearningEvent。
2. Application 构造 StudySessionCheckpoint v1 和请求指纹。
3. `LearningTransactionPort` 原子写入事件、Checkpoint 和幂等记录。
4. 事务成功后 QuestionFlow 才进入 feedback；失败时保持 answering。
5. 相同幂等键和指纹返回首次提交结果；相同键对应不同答案时拒绝。

Dexie 只存在于 Infrastructure。Domain、页面和 UI 组件不得 import Dexie。

## Task008 会话重新开始

1. UI 先要求用户显式确认，不直接清除数据。
2. Application 通过 `StudySessionRepositoryPort.clearSession(sessionId)` 发起重新开始。
3. Infrastructure 在单一事务中清除该会话的事件、检查点、状态和幂等记录。
4. 清除成功后 Application 创建全新的第一题会话；失败时原 `StudyUseCase` 和页面快照不变。
5. 清除边界不得提供无条件全库删除，也不得影响其他 `sessionId`。

## Task009 v1 迁移预检

1. UI 只把用户明确选择的 JSON 文本和文件元数据交给 Application。
2. Application 识别现代 v5+ 或旧 v4 格式，调用 `TextDigestPort` 计算 SHA-256。
3. Application 按域把每条来源数据分类为可迁移、跳过、冲突或错误，并聚合同类问题。
4. Zod 在返回 UI 前验证版本化报告、分类总数不变量和固定迁移假设。
5. UI 只呈现并导出报告；预检过程中 `writesPerformed` 恒为 `false`。

浏览器哈希能力只存在于 Infrastructure。旧 API 密钥只用于“需要重新输入”的存在性判断，
不得写入报告、日志或页面。活跃 Word/Override/FSRS 的孤立引用是 P0 阻断。

## Task010 staging 与 active pointer

1. UI 只有在预检非 blocked 且用户明确操作后，才把原文件文本与报告交给 Application。
2. Application 重新计算来源 SHA-256、验证报告一致性，并在写入前递归脱敏旧 API Key。
3. `migrationId` 只由来源指纹与固定规格版本生成；同一输入重复执行复用原 staging。
4. `MigrationPersistencePort` 保存 MigrationRun、脱敏隔离数据集并读取 active pointer。
5. Dexie v3 在事务内同时更新 MigrationRun 和唯一 active pointer；失败时两者都不改变。
6. 回滚只把 active pointer 恢复为 `priorActiveDatasetId`，保留快照、报告和诊断数据。
7. 学习事件与会话表不参与迁移事务；staging 不代表业务域已完成迁移。

当前仍不实现 Mastery/StudyRecord/FSRS 等剩余域、ReviewState 激活、FSRS 调度迁移或 AI；
canonical corpus、canonical idMap、disposition/quarantine 报告契约和只读 source-aware staging
已完成。Word/Override/Folder/Favorite 核心域现在已经可以从 Legacy Source Reader 生成
`migration-isolated-domain-slice` payload 和逐条 disposition，但该结果仍只作为隔离应用层输出，
未写入 MigrationPersistencePort 或 active dataset。

## Task011 canonical 内容身份

1. `CanonicalWord v1` 把 `language + id` 作为身份域；`jp-study` 已有 ID 原样保留。
2. `CanonicalManifest v1` 固定来源仓库、提交、分片 blob、许可、数量、ID 摘要与内容摘要。
3. 静态资产在 Infrastructure 适配器边界通过 Zod 校验，页面和未来课程只消费
   `CanonicalContentRepositoryPort`。
4. 解析先查精确 `language + wordId`；仅在 ID 未命中时提供唯一
   `language + normalized headword` 候选。
5. 同语言重名返回 ambiguous；相同 ID 出现在另一语言返回 language-conflict，不自动合并。
6. 完整 9,828 条资产已作为迁移身份底座导入；用户词、Override 和逐域关系转换仍需 Task 015
   的真实 fixture 与后续 transformer。

## Task015 canonical idMap

1. `MigrationIdentityMapUseCase` 先执行 canonical 完整性校验，再按迁移规格 §5 固化
   `oldRef → targetWordId`，并把语言缺省、置信度、冲突和 quarantine 原因写入 entry。
2. 用户词合法且唯一的旧 ID 原样保留；无 ID 或确定性冲突按固定字段和原始记录摘要生成
   `user-v1-*`，不使用随机数或运行时间。
3. entries 按 sourceRef 排序并计算稳定 map digest；后续逐域转换只能消费这份 idMap，不能重新
   按 headword 推导身份。
4. 当前不写入 Word/UserWord/Override、active pointer 或 ReviewState；真实 fixture 到位后再
   接入 transformer 和 V01–V25。

## Task015 disposition / quarantine report

1. `MigrationDispositionReportUseCase` 绑定 `identityMapDigestSha256`，逐条记录 migrated、deduped
   或 quarantined 的去向、目标、原因和 sourceRecordDigest。
2. 报告强制 `source = migrated + deduped + quarantined`，并为 rawArchive/quarantine 生成不含
   原始 payload 的稳定引用。
3. 报告仍不执行存储写入；真实 transformer 只能先生成报告，再把通过质量守恒的目标写入
   migrationId 对应的 isolated staging。

## Task015 Legacy Source Reader

1. `MigrationLegacySourceReaderUseCase` 只接收 staging 中的脱敏选定备份和既定
   `migrationId/sourceFingerprint`，识别 modern v5+ 或 legacy v4，输出规范化但未关联的 source records。
2. 数组/对象域按固定 `sourceRef` 枚举并生成逐条摘要；未知字段作为 `unknown` 记录，坏类型保留为
   单条记录，避免 transformer 将损坏域误当空域；`wordStorageVersion` 只进入来源元数据。
3. JSON key 递归稳定排序、数组顺序保留；reader digest 排除空白和 key 顺序噪声，明文
   `deepseekApiKey`、坏 JSON、过深嵌套和 digest 失败均 fail-closed。
4. reader 只产生隔离应用层结果，不读取浏览器 API、不写 Word/ReviewState/active pointer；设备
   IndexedDB/localStorage 优先级仍由 ADR-015 的 source adapter 负责，接线和真实 fixture 待后续切片。

## Task015 核心域纵向转换

1. `MigrationDomainSliceUseCase` 只消费已经通过 Legacy Source Reader 的 source records，并将本轮
   范围固定为 `words / overrides / folders / favorites`；其他域不会被静默标记为已迁移。
2. Word/Override 目标只能来自 canonical idMap；Folder 以名称、语言和 migrationId 生成确定性
   `folder-v1-*`；Favorite 只接受唯一可解析的 Word 关系。
3. 每条范围内 sourceRef 都进入 disposition report；成功/重复记录保留 rawArchive 引用，孤立或
   类型错误记录进入 quarantine，payload 不包含活跃目标之外的未验证关系。
4. isolated payload 绑定 reader、idMap 和 disposition digest，并固定
   `writesPerformed:false`、`activePointerUpdated:false`。纵向用例不直接调用 persistence；现有
   staging dataset 通过可选 `isolatedDomainSlice` 字段保存该 payload，但该切片尚未实现
   rawArchive/quarantine 实际存储、其他迁移域、V01–V25 或 active pointer 提交。

## Task012 正式每日课程

1. `TodayPlan v1` 固定本地日期、canonical 内容版本和五个课程引用；同一输入生成相同计划。
2. Application 只通过 `CanonicalContentRepositoryPort` 读取词条并生成版本化 Question。
3. 计划固定三道选择题与两道文本输入题，Domain Judge 执行确定性判定。
4. `TodayPlan.id` 作为 `sessionId`，复用既有原子答案事务、刷新恢复与按会话重新开始。
5. 结果只聚合该会话的 LearningEvent，不推断 Profile、薄弱点或复习到期时间。
6. `/today` 是正式入口；`/study-demo` 继续作为 Mock 技术回归页面。

Task012 当时不包含 LearnerProfile、FSRS、AI Gateway、完整 canonical 资产或迁移业务域
激活；画像与调度由下述 Task013 独立引入。

## Task013 学习画像与复习调度

1. `LearningProjector` 只读取已验证 LearningEvent，并按时间与事件 ID 确定性重放。
2. LearnerProfile 聚合有证据的计数、正确率、响应时间、最近错误与趋势；未知 canonical
   身份和其他用户事件不会进入投影。
3. `ReviewSchedulerPort` 把正确/错误映射为 Good/Again；Infrastructure 适配官方
   `ts-fsrs` 并输出 ReviewState v1。
4. `LearningProjectionRepositoryPort` 原子替换一个用户的画像和全部 ReviewState。
   投影可以删除后从 LearningEvent 重建，不反向修改事件。
5. Today Plan 只消费当天零点前的投影，按到期复习、最近错误、基础补位的顺序选满五词。
6. UI 只接收 Application 提供的画像摘要，不直接访问 Dexie 或 FSRS。

当前仍不实现 AI Gateway、FSRS 参数训练、旧 FSRS 迁移、完整 canonical 资产或迁移业务域
激活。

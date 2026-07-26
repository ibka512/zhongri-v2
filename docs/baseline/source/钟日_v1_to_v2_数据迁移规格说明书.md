# 钟日_v1_to_v2_数据迁移规格说明书

ZHONGRI · DATA MIGRATION SPECIFICATION

# 钟日 v1 → v2 数据迁移规格说明书

用于未来 v2 重写时实现可验证、可回滚、幂等的数据迁移程序

| 基线项      | 锁定值                                          | 实施含义                                     |
| ----------- | ----------------------------------------------- | -------------------------------------------- |
| 仓库        | ibka512/jp-study                                | 本文只描述该仓库当前实现。                   |
| Git 基准    | main / 36c8129dfc364453198790b64687ff9105a3ecae | 迁移程序验收必须以此提交生成的字段与键为准。 |
| 应用版本    | V9.1 · build 2026.07.23.2 · package 9.1.0       | 版本证据见 [S33]。                           |
| v1 数据模式 | DATA_SCHEMA_VERSION = 8                         | 用于识别应用内部历史迁移状态。               |
| 备份格式    | zhongri-backup / backupVersion = 10             | 现代备份入口；另兼容无 format 包装的旧 v4。  |
| 内置词基线  | 日语 5,906；英语 3,922；合计 9,828              | 仓库测试在该提交下通过，ID 无重复。          |
| 文档状态    | 实施规格 · 非迁移代码                           | 允许少量确定性算法描述，不包含正式程序。     |

| 规范用语 “必须”表示不得偏离；“应”表示默认实现要求，只有记录充分理由才可偏离；“可”表示可选迁移。无法由代码确认的结论统一标为“不确定”，不得用推断生成历史数据。 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- |

## 阅读顺序与事实优先级

- 事实优先级：当前提交源码与内置资源 ＞ 当前测试与生成报告 ＞ v1 备份文件内容 ＞ 上一份《钟日 PWA v1 产品需求文档》。

- 同一键在 IndexedDB 与 localStorage 同时存在时，v1 运行时优先返回 IndexedDB 的非 undefined 值；迁移程序不得盲目合并，必须先生成“存储分歧报告”。[S06]

- 目标数据域只定义迁移落点和可验证关系，不构成 v2 新业务、UI 或新增功能设计。

## 与上一份 PRD 的代码级补充／校正

| 主题         | PRD 层表述               | 当前代码事实                                                                                                                                                       | 本规格处理                                          |
| ------------ | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Android 提醒 | 设置页保存提醒计划。     | App 只保存提醒设置；未来 7 天通知计划运行时重算并提交给 Android LocalNotifications。系统中已排程实例不是备份字段。[S18][S19]                                       | 迁移设置；不搬运已排程通知实例，v2 首次启动后重排。 |
| 迁移安全快照 | PRD 只描述存在安全快照。 | migrationSafetySnapshot_v1 不含 FSRS、错题本、AI 小测、回收站、提醒、偏好以及分离后的 userWords/overrides 原始集合。[S06]                                          | 仅作为原始档案读取；不能被视为全量恢复源。          |
| 完整备份     | 备份包含主要业务域。     | v10 基础 payload 含 FSRS；后置补丁再加入 wrongBook、aiQuizHistory、recycleBin。提醒设置、API Key、错题/测验开关和词库筛选键不在 BACKUP_PREFERENCE_KEYS。[S11][S16] | 按真实字段迁移，并明确备份之外的数据。              |
| AI 缓存      | PRD 提到例句分析缓存。   | 未发现独立持久化缓存键；可复用内容位于 aiConversations 的 cacheKey/messages。                                                                                      | 不创建虚构缓存域；只迁移会话。                      |
| “模糊”       | PRD 已说明为中间状态。   | 代码再次确认：ft-blur 只设置当题提示状态；最终 correct/wrong 才写 mastery、错题与 FSRS。[S25][S27]                                                                 | 不得反推“模糊次数”或伪造 StudyEvent。               |

## 目录

| 章节 | 内容                   |
| ---- | ---------------------- |
| 1    | 迁移目标与边界         |
| 2    | v1 数据源清单          |
| 3    | v2 建议数据域          |
| 4    | 字段级映射表           |
| 5    | 稳定身份与 ID 映射规则 |
| 6    | 各业务数据的迁移规则   |
| 7    | 历史数据与重复数据处理 |
| 8    | 不可无损迁移的内容     |
| 9    | 迁移执行顺序           |
| 10   | 迁移事务、回滚和幂等性 |
| 11   | 验证清单               |
| 12   | 迁移风险等级           |
| 13   | 待确认问题             |
| 14   | 最终交付物             |

# 1. 迁移目标与边界

迁移目标是将 v1 的可持久化事实转入 v2 迁移落地数据域，同时保留可审计的原始快照、稳定词条身份、关系完整性和调度状态。迁移不是“重算一份看起来合理的数据”，而是“按证据复制、清洗、关联，并把无法确认的内容隔离”。

## 1.1 数据分类

| 分类         | 数据                                                                                                                                                                                                  | 规则                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 必须迁移     | 用户词、内置覆盖与逻辑删除、文件夹与语言、收藏、三维掌握与 needsReview、studyRecords、mtGroupClears、FSRS 卡与日志、错题、AI 会话、AI 小测历史、有效回收站项、业务偏好、提醒设置、迁移/备份版本元数据 | 丢失任一项可能改变用户可见内容、学习结果、到期复习或恢复能力。                                                                                            |
| 可选迁移     | 词根审核决策、词库等级/难度筛选、最后选择范围/布局等短期 UI 偏好、过期但尚未由 v1 cleanup 扫除的回收站项                                                                                              | 默认迁移到偏好或原始档案；不应阻断核心迁移。                                                                                                              |
| 明确不迁移   | Service Worker Cache、运行中队列/当前题索引、未提交输入、AI 流式临时文本、DOM 状态、音频对象、测试通知与已排程通知实例                                                                                | 不是稳定业务事实，或无法跨运行环境复用。                                                                                                                  |
| 只存档不运行 | 历史 word.srs、无法关联的收藏/掌握/FSRS/错题、损坏记录、migrationSafetySnapshot_v1、旧 myWordDB_v3 原始数组、备份原始 JSON、未知字段                                                                  | 写入 MigrationMetadata.rawArchive / quarantine，不进入 v2 活跃逻辑。                                                                                      |
| 敏感信息     | deepseekApiKey                                                                                                                                                                                        | 默认不迁移、不进入导出、不记录明文日志。若产品负责人坚持设备内迁移，必须独立征得用户明确同意并写入系统安全凭据存储；本文默认结果为 requiresReentry=true。 |

## 1.2 明确排除

| 范围       | 本文明确不包含                                                              | 迁移约束                                                                              |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 产品与界面 | v2 UI、页面导航、AI 外教、五十音、音标学习及任何新增业务                    | 不得借迁移新增产品行为。                                                              |
| 平台与服务 | 在线同步、账号体系、云端合并、加密协议、服务端接口                          | 不据此假设跨设备身份。                                                                |
| 实现与历史 | 正式迁移代码；从结果反推作答、从 FSRS 卡反造日志、从错题汇总反造 StudyEvent | 只定义确定性、幂等性和验收，不伪造历史。                                              |
| 敏感数据   | deepseekApiKey 明文自动迁移、导出和日志记录                                 | 该键不在 v1 备份/恢复点中，完全重置也保留；默认 requiresReentry=true。[S11][S17][S28] |

# 2. v1 数据源清单

v1 使用 idb-keyval 6.2.2，调用时未传 customStore，因此 IndexedDB 默认数据库为 keyval-store、对象仓库为 keyval。大多数业务键通过 readStorageValue/writeStorageValue 访问；读取规则是 IndexedDB 非 undefined 值优先，否则尝试 localStorage JSON。[S06][S32]

| 存储键/域                                        | 类型                       | 主要字段                                                                                                             | 写入位置                              | 读取位置                       | 用途            | 仍用              | 历史兼容           | 迁移               |
| ------------------------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------ | --------------- | ----------------- | ------------------ | ------------------ |
| keyval-store/keyval · userWords_v1               | Array<Word>                | _id,lang,word,kana/phonetic,type,meaning,example,folder,level,difficulty,tags,…                                      | saveDB→persistSeparatedWordData       | loadData                       | 用户词条        | 是                | 否                 | 必须               |
| keyval-store/keyval · wordOverrides_v1           | Object<wordId,Override>    | 可编辑词字段,_deleted,updatedAt                                                                                      | saveDB / legacy 拆分                  | loadData→rebuildCombinedDB     | 内置词覆盖/隐藏 | 是                | 否                 | 必须               |
| keyval-store/keyval · myWordDB_v3                | Array<Word>                | 旧版完整词库，内置与用户混合                                                                                         | 旧版本；当前不再写                    | 仅在分离存储不存在时读取       | 历史兼容源      | 只读兼容          | 是                 | 必须读取           |
| localStorage · wordStorageVersion                | 数字字符串                 | 当前为 1                                                                                                             | persistSeparatedWordData              | loadData 分离存储判定          | 词存储版本标记  | 是                | 兼容门槛           | 必须               |
| keyval-store/keyval · myFolders_v3               | string[]                   | 文件夹名称及顺序                                                                                                     | saveFolders                           | loadData                       | 词库/文件夹     | 是                | 键名历史           | 必须               |
| keyval-store/keyval · myFolderLangs              | Object<name,ja             | en>                                                                                                                  | 文件夹语言                            | saveFolderLangs                | loadData        | 文件夹语言归属    | 是                 | 否                 | 必须     |
| keyval-store/keyval · starredWords               | string[]                   | 稳定 wordId 或旧 headword                                                                                            | saveStars                             | loadData→runDataMigrations     | 收藏            | 是                | 值可能历史         | 必须               |
| keyval-store/keyval · studyRecords               | Array<Record>              | date,type,group?                                                                                                     | saveRecords                           | loadData/calculateStats/提醒桥 | 打卡和组完成    | 是                | 否                 | 必须               |
| keyval-store/keyval · mtGroupClears_v3           | Object<groupKey,number>    | group                                                                                                                | 范围                                  | 组号 → 完成次数                | saveClears      | loadData/范围选择 | 组完成次数         | 是                 | 键名历史 | 必须 |
| keyval-store/keyval · mtWordClears_v3            | Object<wordKey,state>      | kanji,kana,meaning,needsReview；旧 en word                                                                           | saveClears                            | loadData→runDataMigrations     | 三维掌握        | 是                | 值兼容旧格式       | 必须               |
| keyval-store/keyval · fsrsCards_v1               | Object<cardKey,Card>       | due,stability,difficulty,elapsed_days,scheduled_days,reps,lapses,learning_steps,state,last_review                    | saveFsrs                              | loadData/getDueFsrsCards       | FSRS 卡         | 是                | 否                 | 必须               |
| keyval-store/keyval · fsrsReviewLogs_v1          | Array<Log>≤500             | key,wordId,lang,dimension,source,rating,review,due                                                                   | recordFsrsReview/saveFsrs             | loadData/提醒桥                | FSRS 日志       | 是                | 否                 | 必须               |
| keyval-store/keyval · aiConversations            | Array<Conversation>≤50     | id,date,sentence,word,lang,cacheKey,systemPrompt,presetId?,messages[]                                                | _persistConversations/saveAllUserData | loadData/AI 历史               | AI 会话         | 是                | 部分会话字段历史   | 必须               |
| keyval-store/keyval · wrongBook_v1               | Object<wordId,WrongRecord> | 计数、维度、来源、recentAnswers、状态与时间                                                                          | saveWrongBook                         | Model.init                     | 错题本          | 是                | 旧 wordId 可重关联 | 必须               |
| keyval-store/keyval · aiQuizHistory_v1           | Array<Quiz>≤100            | id,title,createdAt,durationMs,total,correct,answers[]                                                                | saveAIQuizHistory                     | Model.init                     | AI 小测历史     | 是                | 否                 | 必须               |
| keyval-store/keyval · recycleBin_v1              | Array<RecycleItem>≤300     | id,batchId,kind,label,deletedAt,expiresAt,payload                                                                    | saveRecycleBin                        | Model.init/cleanup             | 7 天回收站      | 是                | 否                 | 必须（有效项）     |
| keyval-store/keyval · migrationSafetySnapshot_v1 | Object                     | type,createdAt,fromVersion,toVersion,db,folders,folderLangs,stars,records,mtGroupClears,mtWordClears,aiConversations | createMigrationSnapshot               | 迁移失败 restore               | v1 内部迁移快照 | 是                | 快照 v1 且不完整   | 只存档             |
| keyval-store/keyval · preImportRestorePoint_v1   | BackupPayload              | 完整 buildBackupPayload 结构                                                                                         | 导入/重置前                           | 撤销数据操作                   | 恢复点          | 是                | 否                 | 必须识别；默认存档 |
| localStorage fallback · 上述业务键               | JSON 字符串                | 与各键对应                                                                                                           | IDB 不可用/写失败                     | IDB 无值/读失败时              | 降级副本        | 条件使用          | 兼容分支           | 必须扫描           |
| IndexedDB probe · **zhongri_storage_probe**      | 未定义/任意                | 只 get，不主动 set                                                                                                   | 无                                    | loadData 可用性探测            | 能力探测        | 是                | 否                 | 不迁移             |

代码依据：[S01][S06][S08][S09][S13]。注意：writeStorageValue 成功写入 IndexedDB 后不会同步清除或更新 localStorage 旧副本。

## 2.2 localStorage 专用键与动态键

| 键                                      | 类型        | 默认/回退                 | 写入                    | 用途                                | 状态           | 迁移                   |
| --------------------------------------- | ----------- | ------------------------- | ----------------------- | ----------------------------------- | -------------- | ---------------------- |
| dataSchemaVersion                       | 数字字符串  | 8                         | loadData 提交           | 判断 v1 内部迁移                    | 是             | 必须→MigrationMetadata |
| theme                                   | light       | dark                      | light（缺失）           | 主题切换                            | 主题           | 是                     | 可选           |
| langMode                                | ja          | en                        | ja                      | 词书切换                            | 当前语言       | 是                     | 必须偏好       |
| autoSpeak                               | 布尔字符串  | true（非 false）          | 设置                    | 自动朗读                            | 是             | 必须偏好               |
| hapticsEnabled                          | 布尔字符串  | true（非 false）          | haptics.js              | 触感                                | 是             | 必须偏好               |
| showRoots                               | 布尔字符串  | true（非 false）          | 设置                    | 英语词根展示                        | 是             | 必须偏好               |
| darkBtnStyle                            | solid       | translucent               | solid                   | 设置                                | 深色按钮样式   | 是                     | 可选           |
| postponeTested                          | 布尔字符串  | false                     | 旧版本                  | wordOrderMode 回退来源              | 否（只读兼容） | 必须兼容               |
| wordOrderMode                           | weak-first  | new-first                 | original                | 由 postponeTested 推导或 weak-first | 设置/初始化    | 筛选队列排序           | 是             | 必须     |
| skipMastered                            | 布尔字符串  | false                     | 设置                    | 跳过已掌握                          | 是             | 必须                   |
| useRubyRender                           | 布尔字符串  | true                      | 设置/MathJax 回退       | 注音渲染                            | 是             | 可选                   |
| ttsEngine                               | local       | youdao                    | azure                   | azure                               | 设置           | 发音引擎               | 是             | 必须偏好 |
| displayMode                             | all         | word                      | kana                    | meaning 等                          | all            | 卡片显示               | 显示模式       | 是       | 可选 |
| lastCustomGroupTxt / lastCustomGroupVal | string      | 由当前词库构造            | 范围选择                | 最近学习组                          | 是             | 可选                   |
| lastSelectedFolder                      | string      | 当前筛选/ all             | 词库筛选                | 最近文件夹                          | 是             | 可选                   |
| lastTestDisplay / lastTestRange         | string      | kana / 当前默认词库       | 检验选择                | 最近检验设置                        | 是             | 可选                   |
| wrongBookEnabled                        | 布尔字符串  | true（非 false）          | 设置                    | 是否新增错题记录                    | 是             | 必须偏好；不在备份     |
| aiQuizRecord                            | 布尔字符串  | true（非 false）          | 设置                    | AI 测验是否写入错题                 | 是             | 必须偏好；不在备份     |
| importMode                              | ai          | manual                    | manual                  | 导入页                              | 最近导入方式   | 是                     | 可选；不在备份 |
| wordbank_level_ja/en                    | string      | 空                        | 动态筛选                | 词库级别筛选                        | 是             | 可选；不在备份         |
| wordbank_difficulty_ja/en               | string      | 空                        | 动态筛选                | 词库难度筛选                        | 是             | 可选；不在备份         |
| deepseekApiKey                          | 敏感字符串  | 空                        | AI Key 设置/提示        | DeepSeek 请求授权                   | 是             | 明确不自动迁移         |
| nativeStudyReminderSettingsV2           | JSON Object | 见 ReminderSetting 默认值 | native-app.saveSettings | Android 提醒设置                    | 是             | 必须                   |
| nativeStudyReminderEnabled              | 布尔字符串  | false                     | saveSettings 同步写     | V2 键缺失时回退                     | 兼容写         | 必须兼容               |
| nativeStudyReminderTime                 | HH:mm       | 20:00                     | saveSettings 同步写     | V2 键缺失时回退                     | 兼容写         | 必须兼容               |
| zhongri-root-review-v1:<batch>          | JSON Object | {}                        | root-review.save        | 词根人工审核                        | 工具页使用     | 可选/只存档            |

代码依据：[S01][S18][S20][S21][S28][S29]。BACKUP_PREFERENCE_KEYS 仅含 theme 至 lastTestRange 的 17 个键；表中其余 localStorage 偏好不在 v10 备份。

## 2.3 内置资源、备份与 Android 原生层

| 来源                      | 真实载体                                                | 主要字段/内容                                                                                                                 | 写入/生成                       | 读取                                | 当前用途               | 历史兼容                     | 迁移                  |
| ------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------- | ---------------------- | ---------------------------- | --------------------- |
| 日语内置词库              | data.js + wordbanks/ja-001…007.js + finalize.js         | _id,builtIn,word,kana,type,meaning,example,lang,level,difficulty,tags,pitch,sourceName,sourceVersion,sourceLevels,dataVersion | 仓库构建/维护工具               | wordbank-loader→DefaultWords        | 5,906 条日语 canonical | finalize 为缺 ID 词补顺序 ID | 必须作为身份表        |
| 英语内置词库              | english-data.js + wordbanks/en-001…005.js + finalize.js | _id,builtIn,word,phonetic,type,meaning,example,roots,folder,level,difficulty,tags,source*,rootsStatus,rootsReview             | 仓库构建/维护工具               | wordbank-loader→DefaultEnglishWords | 3,922 条英语 canonical | finalize 为缺 ID 词补顺序 ID | 必须作为身份表        |
| 词库来源清单              | wordbank-sources.json                                   | version,imports[fingerprint,source,name,license,author,commit,language,importedAt,accepted]                                   | 词库工具                        | 人工/构建审计                       | 来源证据               | 否                           | 可选元数据            |
| 现代备份                  | JSON 文件                                               | format,backupVersion,schemaVersion,appName,kind,exportDate,data,preferences                                                   | buildBackupPayload/exportBackup | normalize/validate/apply            | 完整备份/恢复点        | backupVersion 默认兼容 5     | 必须识别              |
| 旧 v4 备份                | 无 format 包装 JSON                                     | db,folders,folderLangs,stars,records,mtGroupClears,mtWordClears,aiConversations?,preferences?,exportDate?                     | 旧版本                          | normalizeBackupPayload legacy 分支  | 历史导入               | 是                           | 必须识别              |
| Android 提醒设置          | WebView localStorage                                    | nativeStudyReminderSettingsV2 及两旧键                                                                                        | native-app                      | native-app                          | 提醒配置               | 旧键持续双写                 | 必须                  |
| Android 已排程通知        | 操作系统 LocalNotifications                             | ID 21001/21002/21003/21100…21106，title/body/schedule/extra                                                                   | syncScheduledReminders          | 系统通知插件；应用不枚举读取        | 未来 7 天提醒          | 有旧日提醒 ID                | 不迁移；重排          |
| Android 通知权限/准时权限 | 操作系统权限状态                                        | display,exact_alarm                                                                                                           | 系统设置                        | Capacitor 插件                      | 能否通知               | 否                           | 不迁移；重新请求/检测 |

| 不确定 浏览器/Android WebView 的实际 origin、应用升级时 WebView 存储是否跨安装包完整保留，无法仅从仓库代码确定；迁移器必须在运行设备上探测。 |
| -------------------------------------------------------------------------------------------------------------------------------------------- |

# 3. v2 建议数据域

以下是“迁移落地模式”，不是完整 v2 业务模型。所有域都应包含 migrationId、sourceFingerprint、createdByMigration 与 rawV1Fields（必要时）等审计信息；表中只列业务主字段。

| 数据域              | 主键                            | 必需字段                                                                            | 可选字段                                                                      | 关系                                     | 保留原始 v1               |
| ------------------- | ------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------- | ------------------------- |
| Word                | wordId                          | language,headword,meaning,partOfSpeech,isBuiltIn                                    | reading/phonetic,examples,level,difficulty,tags,frequency,pitch,roots,source* | Folder；被各学习域引用                   | 仅未知/历史字段           |
| UserWord            | wordId（沿用或确定性生成）      | language,headword,folderId,isDeleted=false                                          | importedAt,isImported,wordFields                                              | Word 的用户来源记录                      | 是，尤其 srs/未知字段     |
| BuiltInWordOverride | wordId                          | changedFields,isDeleted,updatedAt                                                   | originalV1Override                                                            | 一对一覆盖内置 Word                      | 必须保留完整 override     |
| Folder              | folderId = hash(language,name)  | name,language,sortOrder                                                             | isSynthetic,rawName                                                           | Word/UserWord 多对一                     | 冲突时保留                |
| Favorite            | wordId                          | wordId                                                                              | createdAt,rawReference,mappingConfidence                                      | 一对一引用 Word                          | 旧 headword 引用保留      |
| Mastery             | wordId                          | wordId,language,dimensions,needsReview                                              | updatedAt,mappingConfidence                                                   | 一对一引用 Word                          | 保留 kanji/kana/word 原值 |
| StudyEvent          | eventId                         | eventType,occurredAt,source                                                         | wordId,groupLabel,rawDate,payload                                             | 可引用 Word/StudySession                 | 是                        |
| StudySession        | sessionId                       | sessionType,startedAt?,completedAt?,status                                          | groupKey,groupLabel,completionCount                                           | 聚合 StudyEvent；v1 常只有完成事实       | 是                        |
| ReviewCard          | reviewCardId = wordId#dimension | wordId,language,dimension,due,algorithm                                             | FSRS 状态全部字段                                                             | 一对一引用 Word；一对多 ReviewLog        | 必须                      |
| ReviewLog           | reviewLogId                     | reviewCardId,wordId,dimension,rating,reviewedAt,dueAfter                            | source,rawKey                                                                 | 引用 ReviewCard/Word                     | 必须                      |
| MistakeRecord       | wordId                          | wordId,totals,dimensions,sourceCounts,status                                        | recentAnswers,时间、folder/headword 快照                                      | 一对一引用 Word                          | 必须                      |
| AIConversation      | conversationId                  | language,messages                                                                   | legacyId,dateText,word,sentence,cacheKey,systemPrompt,presetId                | 可选关联 Word                            | 必须                      |
| AIQuizHistory       | quizId                          | title,createdAt,total,correct,answers                                               | durationMs                                                                    | answer 可引用 Word                       | 必须                      |
| RecycleBinItem      | itemId                          | kind,deletedAt,expiresAt,payload                                                    | batchId,label,status                                                          | payload 可封装 Word/Conversation/Example | 必须                      |
| UserPreference      | preferenceKey                   | value,valueType                                                                     | scope,rawValue,isLegacy                                                       | 无强外键；部分引用 Folder                | 必要时                    |
| ReminderSetting     | profileId='default'             | enabled,mode,dueEnabled,rescueEnabled,reminderTime,rescueTime,weekdays,quiet*,exact | sourceKeys,permissionState='unknown'                                          | 由 ReviewCard/StudyEvent 重排提醒        | 必须                      |
| MigrationMetadata   | migrationId                     | sourceCommit,sourceAppVersion,sourceFingerprint,status,startedAt                    | completedAt,counts,warnings,idMap,rawArchive,checkpoints                      | 关联所有迁移写入                         | 必须                      |

| 维度命名 Mastery 与 ReviewCard 在 v2 落地时使用明确维度：日语 spelling/reading/meaning；英语 spelling/listening/meaning。v1 的 kanji/kana 只留在 rawV1Fields，不再承担跨语言双重语义。 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

# 4. 字段级映射表

本章是迁移实现的规范性核心。每行均为独立规则；未列字段不得静默丢弃，应进入 rawV1Fields 或隔离区。表内“必须”指对有效、可解析且满足来源条件的数据。

## 4.1 词条、来源与历史字段

| v1 存储域         | v1 字段             | v1 真实语义                                                                   | v2 数据域                  | v2 字段                 | 转换规则                                                    | 缺失值处理                                          | 冲突处理                                       | 必须迁移 |
| ----------------- | ------------------- | ----------------------------------------------------------------------------- | -------------------------- | ----------------------- | ----------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------- | -------- |
| 内置/用户词/旧 db | _id                 | 词条稳定引用；用户词可随机；内置资产当前均有稳定 ID                           | Word/UserWord              | wordId                  | trim；合法且唯一则原样保留                                  | 内置先查 canonical；用户按 §5 确定性生成            | 跨语言/重复 ID 不共用；冲突记录 idMap          | 是       |
| 同上              | lang                | en 或 ja；缺失历史默认 ja                                                     | Word                       | language                | en→en，其余有效 ja→ja                                       | 旧代码默认 ja，但迁移标 mappingConfidence=defaulted | 与 canonical ID 冲突时 canonical language 优先 | 是       |
| 同上              | word                | 日语词形或英语拼写                                                            | Word                       | headword                | NFKC；按 normalizeHeadword 清理空格、引号、连字符；保留原值 | 空则隔离，不创建活跃 Word                           | 同语同词不自动合并，按 ID                      | 是       |
| 日语词            | kana                | 日语读音                                                                      | Word                       | reading                 | normalizeKanaText；原值存 raw                               | 允许空；不伪造                                      | canonical 与 override 按优先级覆盖             | 是       |
| 英语词            | phonetic            | 英语音标                                                                      | Word                       | phonetic                | normalizePhoneticText；保留斜杠格式原值                     | 允许空                                              | override 优先于 canonical                      | 是       |
| 英语历史词        | kana                | 词条对象中的遗留字段；不是当前英语音标规范字段                                | Word                       | rawV1Fields.kana        | 不映射 phonetic；只存档                                     | 忽略                                                | 不得与 Mastery.kana 混淆                       | 否/存档  |
| 同上              | type                | 词性                                                                          | Word                       | partOfSpeech            | 按 v1 normalizeWordType 归一；保留原文                      | 空允许但标数据质量错误                              | override 优先                                  | 是       |
| 同上              | meaning             | 中文释义                                                                      | Word                       | meaning                 | 按 v1 normalizeMeaningText                                  | 空则隔离活跃词                                      | override 优先                                  | 是       |
| 同上              | example             | 一个或多个例句；                                                              |                            | 分隔，/ 可能分隔译文    | Word                                                        | examples                                            | 按 normalizeExampleText 后再以                 |          | 拆数组；raw 保留原串 | []  | 去重使用规范化全文，不按斜杠强拆未知结构 | 是  |
| 同上              | folder              | 文件夹名称；日语内置缺失时运行时默认“默认词库”                                | Word/UserWord              | folderId                | 先建 Folder，再按 language+name 解析                        | ja→默认词库；en→四级词汇，并标 defaulted            | 同名跨语言见 §7                                | 是       |
| 同上              | level               | JLPT/CET 等级                                                                 | Word                       | level                   | normalizeWordLevel(language)                                | ''                                                  | override 优先；不从 tags 猜缺失等级            | 是       |
| 同上              | difficulty          | 0 等整数学习难度                                                              | Word                       | difficulty              | normalizeWordDifficulty；非数值回退 0                       | 0                                                   | 合法 override 优先                             | 是       |
| 同上              | tags                | 普通标签数组/历史分隔字符串                                                   | Word                       | tags                    | normalizeWordTags、去重                                     | []                                                  | canonical+override 按覆盖，不做集合并集        | 是       |
| 同上              | frequency           | 高频/中频/低频；可从 tags 推导                                                | Word                       | frequency               | 优先显式 frequency；否则按 v1 tags 规则                     | ''                                                  | 显式字段优先                                   | 是       |
| 日语词            | pitch / vocabPitch  | 日语声调标记；vocabPitch 为历史别名                                           | Word                       | pitch                   | pitch 优先，否则 vocabPitch；normalizeWordPitch             | ''                                                  | 显式 pitch 优先                                | 是       |
| 英语词            | roots               | 词根词缀展示文本                                                              | Word                       | roots                   | normalizeRootsText                                          | ''                                                  | override 优先；不验证真伪                      | 是       |
| 日语词            | roots               | 当前 normalizeWordEntry 强制为空                                              | Word                       | rawV1Fields.roots       | 非空只存档，不进入活跃 roots                                | 忽略                                                | 语言规则优先                                   | 否/存档  |
| 同上              | specialTags         | 规范化特殊标签；未显式时可从 tags 筛优先标签                                  | Word                       | specialTags             | 按 v1 normalizeWordSpecialTags                              | 由 tags 推导或 []                                   | 显式值优先                                     | 是       |
| 同上              | sourceId / sourceID | 词条来源内标识；sourceID 为旧别名                                             | Word                       | sourceId                | sourceId 优先，否则 sourceID；trim，最多 128                | null；不得用 headword 伪造                          | 冲突保留 active 值，其他进 raw                 | 是       |
| 同上              | sourceName          | 来源名称                                                                      | Word                       | sourceName              | trim，最多 120                                              | null                                                | override 优先                                  | 是       |
| 同上              | sourceVersion       | 来源版本/提交组合                                                             | Word                       | sourceVersion           | trim，最多 80                                               | null                                                | override 优先                                  | 是       |
| 同上              | source              | 来源名称数组或历史对象/字符串                                                 | Word                       | sources                 | 提取 name/source/title，去重，最多 20                       | []                                                  | override 为完整覆盖值                          | 是       |
| 同上              | aliases             | 别名数组或分隔字符串                                                          | Word                       | aliases                 | NFKC、去重、最多 24                                         | []                                                  | 同规范值去重                                   | 是       |
| 同上              | sourceLevels        | 多来源等级数组                                                                | Word                       | sourceLevels            | 按 v1 normalizeSourceLevels(language)                       | []                                                  | 按来源+等级去重                                | 是       |
| 同上              | reviewStatus        | 词条内容审核状态 draft/reviewed/verified                                      | Word                       | reviewStatus            | 仅三合法值，其余→draft 并告警                               | draft                                               | override 优先                                  | 是       |
| 同上              | dataVersion         | 词条数据版本，至少 1                                                          | Word                       | dataVersion             | parseInt，min 1                                             | 1                                                   | 较新不代表覆盖优先，仍按来源层级               | 是       |
| 同上              | builtIn             | 是否来自内置 canonical；旧值可能错误                                          | Word/UserWord              | isBuiltIn               | canonical ID 集命中优先；否则仅 true 作为匹配线索           | false                                               | canonical 身份表优先                           | 是       |
| 英语内置词        | rootsStatus         | 词根生成/验证状态，如 verified/not-applicable                                 | Word                       | rawV1Fields.rootsStatus | 原样存档；若 v2 有等价元字段可复制                          | null                                                | 不由 reviewStatus 替代                         | 可选     |
| 英语内置词        | rootsReview         | 词根审核来源，如 auto-strict/human                                            | Word                       | rawV1Fields.rootsReview | 原样存档                                                    | null                                                | 不由 reviewStatus 替代                         | 可选     |
| 用户词            | isImported          | 由手工/AI/编辑新增的标志                                                      | UserWord                   | isImported              | Boolean                                                     | false                                               | 原 ID 记录优先                                 | 是       |
| 用户词            | importedAt          | 导入时间，不一定等于词创建时间                                                | UserWord                   | importedAt              | 有效 ISO 转 UTC；无效存 raw                                 | null                                                | 不回填 createdAt                               | 是       |
| 用户词            | srs                 | 旧调度对象；当前创建默认 ease=2.5,interval=0,nextReview=now，当前 FSRS 不读取 | UserWord/MigrationMetadata | rawV1Fields.srs         | 完整原样存档，不生成活跃 ReviewCard                         | null                                                | fsrsCards_v1 永远优先作为活跃调度              | 存档     |

代码依据：[S02][S03][S04][S22][S23][S30]。

## 4.2 内置覆盖、逻辑删除与旧 myWordDB_v3

| v1 存储域          | v1 字段           | v1 真实语义                                   | v2 数据域              | v2 字段              | 转换规则                                                       | 缺失值处理                        | 冲突处理                                         | 必须迁移 |
| ------------------ | ----------------- | --------------------------------------------- | ---------------------- | -------------------- | -------------------------------------------------------------- | --------------------------------- | ------------------------------------------------ | -------- |
| wordOverrides_v1   | <object key>      | 被覆盖的内置 wordId                           | BuiltInWordOverride    | wordId               | 按 canonical ID 解析                                           | 无 canonical→隔离 orphan override | 不得自动变用户词                                 | 是       |
| wordOverrides_v1   | _deleted          | 逻辑删除/隐藏内置词                           | BuiltInWordOverride    | isDeleted            | true→true；其他→false                                          | false                             | 删除标记优先于其他字段展示                       | 是       |
| wordOverrides_v1   | updatedAt         | 覆盖写入/删除时间                             | BuiltInWordOverride    | updatedAt            | 合法时间转 UTC                                                 | null + timeQuality=missing        | 同源冲突取较新；无时间按来源优先级               | 是       |
| wordOverrides_v1   | 可编辑字段集合    | 与 canonical 不同的字段                       | BuiltInWordOverride    | changedFields        | 逐字段执行 4.1，不把未出现字段写 null                          | {}                                | override 值覆盖 canonical                        | 是       |
| wordOverrides_v1   | 未知字段          | 历史/未来覆盖元数据                           | BuiltInWordOverride    | rawV1Fields          | 原样保留                                                       | {}                                | 不进入活跃字段                                   | 存档     |
| myWordDB_v3        | 完整词对象        | 旧版混合内置与用户词                          | Word/UserWord/Override | 按对象拆分           | 先 ID，再 lang+folder+headword，再唯一 loose identity+内置迹象 | 无匹配→UserWord                   | 不得以加载顺序生成不同结果；先加载两语 canonical | 是       |
| myWordDB_v3        | 缺失 canonical 项 | 旧代码可解释为用户删除的内置词                | BuiltInWordOverride    | isDeleted            | 仅设备本地旧库直迁且 markMissingBuiltInsAsDeleted=true 时生成  | 不生成                            | 备份导入路径明确为 false，不推断删除             | 条件必须 |
| wordStorageVersion | <value>           | 是否启用分离词存储；>=1 时 myWordDB_v3 被忽略 | MigrationMetadata      | v1WordStorageVersion | parseInt                                                       | 0                                 | 分离域存在即优先，不与旧 db 合并                 | 是       |

代码依据：[S04][S05][S08][S09]。

## 4.3 文件夹、收藏、三维掌握、needsReview 与学习记录

| v1 存储域        | v1 字段       | v1 真实语义                               | v2 数据域      | v2 字段              | 转换规则                                         | 缺失值处理                                  | 冲突处理                                         | 必须迁移    |
| ---------------- | ------------- | ----------------------------------------- | -------------- | -------------------- | ------------------------------------------------ | ------------------------------------------- | ------------------------------------------------ | ----------- |
| myFolders_v3     | [index]       | 文件夹名与显示顺序                        | Folder         | name,sortOrder       | NFKC/trim；sortOrder=index                       | 空/非法名隔离                               | 同 language+name 去重，最小 index                | 是          |
| myFolderLangs    | <folderName>  | 文件夹语言                                | Folder         | language             | en/ja；其他无效                                  | 由该文件夹词条语言推断；无词则 ja+defaulted | 混合语言拆分并告警                               | 是          |
| starredWords     | [value]       | 稳定 wordId 或旧 headword                 | Favorite       | wordId,rawReference  | 有效 ID 直连；否则按原文与 lowercase headword 查 | 无匹配→隔离                                 | 多匹配按 v1 现行规则全部收藏并标 ambiguous       | 是          |
| mtWordClears_v3  | <object key>  | wordId 或旧 headword                      | Mastery        | wordId               | 有效 ID 直连；否则按 headword 映射               | 无匹配→隔离                                 | 多匹配复制到全部并标 ambiguous，符合 v1 当前迁移 | 是          |
| mtWordClears_v3  | kanji（ja）   | 日语汉字/词形掌握                         | Mastery        | dimensions.spelling  | Boolean                                          | false                                       | 与重复记录 OR 合并                               | 是          |
| mtWordClears_v3  | kana（ja）    | 日语读音掌握                              | Mastery        | dimensions.reading   | Boolean                                          | false                                       | OR 合并                                          | 是          |
| mtWordClears_v3  | meaning（ja） | 日语释义掌握                              | Mastery        | dimensions.meaning   | Boolean                                          | false                                       | OR 合并                                          | 是          |
| mtWordClears_v3  | kanji（en）   | 英语拼写掌握；字段名不是汉字              | Mastery        | dimensions.spelling  | Boolean                                          | false                                       | 旧 word 字段存在时按 word→kanji                  | 是          |
| mtWordClears_v3  | word（en 旧） | 旧英语拼写掌握                            | Mastery        | dimensions.spelling  | Boolean；仅 kanji 缺失时回退                     | false                                       | kanji 显式值优先；raw 保留两者                   | 是          |
| mtWordClears_v3  | kana（en）    | 英语听力掌握；字段名不是假名              | Mastery        | dimensions.listening | Boolean                                          | false                                       | OR 合并                                          | 是          |
| mtWordClears_v3  | meaning（en） | 英语释义掌握                              | Mastery        | dimensions.meaning   | Boolean                                          | false                                       | OR 合并                                          | 是          |
| mtWordClears_v3  | needsReview   | 筛选检验错误后置 true；三维全真时清 false | Mastery        | needsReview          | Boolean                                          | false                                       | 重复记录 OR；不由未掌握自动推导                  | 是          |
| mtGroupClears_v3 | <groupKey>    | 如 group                                  | folder/virtual | index 的组身份       | StudySession                                     | groupKey                                    | 原样保存；解析成功再拆范围                       | 空 key 隔离 | 相同 key 完成次数相加但同快照重复不叠加 | 是  |
| mtGroupClears_v3 | <value>       | 该组完成次数                              | StudySession   | completionCount      | 非负整数；小数取 floor 并告警                    | 0                                           | 跨来源合并见 §7                                  | 是          |
| studyRecords     | date          | zh-CN 本地日期字符串，缺时区              | StudyEvent     | occurredAt/rawDate   | 能解析为本地日期则记录 dateOnly；不伪造时刻      | null+rawDate                                | 同 type/date/group 去重                          | 是          |
| studyRecords     | type          | daily_punch 或 pendulum                   | StudyEvent     | eventType            | 映射 DAILY_PUNCH / GROUP_COMPLETED               | 未知→UNKNOWN+存档                           | 不将 pendulum 解释为唯一具体模式                 | 是          |
| studyRecords     | group         | 完成组显示标签，仅 pendulum 常见          | StudyEvent     | groupLabel           | trim                                             | null                                        | 同日同 group 合并                                | 是          |

代码依据：[S07][S24][S25]。英语 kanji/kana 的真实语义同时由筛选 UI 文案和写入逻辑确认。

## 4.4 FSRS 卡与日志

| v1 存储域         | v1 字段        | v1 真实语义                                             | v2 数据域  | v2 字段             | 转换规则                                                      | 缺失值处理                                | 冲突处理                             | 必须迁移 |
| ----------------- | -------------- | ------------------------------------------------------- | ---------- | ------------------- | ------------------------------------------------------------- | ----------------------------------------- | ------------------------------------ | -------- |
| fsrsCards_v1      | <key>          | lang:wordId:dimension                                   | ReviewCard | reviewCardId,rawKey | 解析三段；ID 映射后生成 wordId#canonicalDimension             | 无法解析→隔离                             | 同卡多源取见 §7                      | 是       |
| fsrsCards_v1      | due            | 下次到期时间 ISO                                        | ReviewCard | due                 | 合法时间转 UTC                                                | 隔离卡，不用 epoch 伪造                   | 与日志不一致以卡为活跃状态并告警     | 是       |
| fsrsCards_v1      | stability      | FSRS 稳定性                                             | ReviewCard | stability           | 有限非负数                                                    | 隔离卡                                    | 活跃卡整体取胜，不逐字段拼接         | 是       |
| fsrsCards_v1      | difficulty     | FSRS 难度                                               | ReviewCard | difficulty          | 有限数                                                        | 隔离卡                                    | 同上                                 | 是       |
| fsrsCards_v1      | elapsed_days   | 距上次复习天数                                          | ReviewCard | elapsedDays         | 非负整数/有限数保留                                           | 0+质量标记                                | 同上                                 | 是       |
| fsrsCards_v1      | scheduled_days | 当前计划间隔天数                                        | ReviewCard | scheduledDays       | 非负整数/有限数保留                                           | 0+质量标记                                | 同上                                 | 是       |
| fsrsCards_v1      | reps           | 复习次数                                                | ReviewCard | reps                | 非负整数                                                      | 0                                         | 同上                                 | 是       |
| fsrsCards_v1      | lapses         | 遗忘次数                                                | ReviewCard | lapses              | 非负整数                                                      | 0                                         | 同上                                 | 是       |
| fsrsCards_v1      | learning_steps | 学习步骤计数                                            | ReviewCard | learningSteps       | 非负整数                                                      | 0                                         | 同上                                 | 是       |
| fsrsCards_v1      | state          | ts-fsrs 卡状态枚举                                      | ReviewCard | state               | 整数原样；保存 algorithm='ts-fsrs@v1-adapter'                 | 隔离卡                                    | 不得按 v2 新算法重算                 | 是       |
| fsrsCards_v1      | last_review    | 最近复习时间                                            | ReviewCard | lastReviewedAt      | 合法时间转 UTC                                                | null                                      | 若晚于 due 告警但不改                | 是       |
| fsrsReviewLogs_v1 | key            | 当时卡键                                                | ReviewLog  | rawKey/reviewCardId | 解析并经 idMap 重写                                           | 用 wordId/lang/dimension 重建；仍缺则隔离 | 与字段冲突时字段三元组优先并告警     | 是       |
| fsrsReviewLogs_v1 | wordId         | 当时词条 ID                                             | ReviewLog  | wordId              | 经 idMap 重写                                                 | 从 key 解析                               | 不同则记录 mismatch                  | 是       |
| fsrsReviewLogs_v1 | lang           | ja/en                                                   | ReviewLog  | language            | 校验                                                          | 从 Word/key                               | Word language 优先                   | 是       |
| fsrsReviewLogs_v1 | dimension      | ja:kanji/reading/meaning；en:spelling/listening/meaning | ReviewLog  | dimension           | 按语言白名单；未知按 scheduler 会回退 meaning，但迁移必须告警 | 从 key                                    | 字段值优先于 key，仅合法时           | 是       |
| fsrsReviewLogs_v1 | source         | study/filter/fsrs-review 等来源                         | ReviewLog  | source              | trim                                                          | unknown                                   | 不改写为会话类型                     | 是       |
| fsrsReviewLogs_v1 | rating         | 数值 1/2/3/4 = Again/Hard/Good/Easy                     | ReviewLog  | rating              | 保存数值与枚举名                                              | 隔离日志                                  | 不把 Filter 的文案“认识”当字符串评分 | 是       |
| fsrsReviewLogs_v1 | review         | 评分发生时间 ISO                                        | ReviewLog  | reviewedAt          | 合法时间转 UTC                                                | 隔离日志或只存档                          | 用作日志去重核心                     | 是       |
| fsrsReviewLogs_v1 | due            | 评分后卡片 due                                          | ReviewLog  | dueAfter            | 合法时间转 UTC                                                | null                                      | 不反向覆盖当前卡 due                 | 是       |

代码依据：[S09][S10]。v1 日志仅存适配层挑选的字段，不包含 ts-fsrs 完整 log 对象。

## 4.5 错题本与 AI 小测历史

| v1 存储域        | v1 字段                                        | v1 真实语义                                              | v2 数据域     | v2 字段                                  | 转换规则                                    | 缺失值处理                             | 冲突处理                                       | 必须迁移 |
| ---------------- | ---------------------------------------------- | -------------------------------------------------------- | ------------- | ---------------------------------------- | ------------------------------------------- | -------------------------------------- | ---------------------------------------------- | -------- |
| wrongBook_v1     | <object key>                                   | 通常为 wordId                                            | MistakeRecord | wordId                                   | 先 key，再 record.wordId，经 idMap          | 按 word+lang+folder 唯一匹配；否则隔离 | 已有目标记录按 §7 合并                         | 是       |
| wrongBook_v1     | wordId                                         | 冗余词 ID                                                | MistakeRecord | rawWordId                                | 保留并校验                                  | 用 object key                          | 冲突记录 mismatch                              | 是       |
| wrongBook_v1     | word/lang/folder                               | 错误发生时词条快照                                       | MistakeRecord | headwordSnapshot/language/folderSnapshot | trim/lang 校验                              | 从关联 Word 补展示快照但标 derived     | 不用于覆盖 Word                                | 是       |
| wrongBook_v1     | totalWrong/totalCorrect                        | 累计错误/正确次数                                        | MistakeRecord | totalWrong/totalCorrect                  | 非负整数                                    | 0                                      | 重复来源最大值或可证明不重叠时相加             | 是       |
| wrongBook_v1     | dimensions                                     | spell,listening,reading,meaning,usage,grammar 的错误次数 | MistakeRecord | dimensionCounts                          | 逐键非负整数；未知键存 raw                  | 六键补 0                               | 同一记录合并取 max 后由 recentAnswers 下限校验 | 是       |
| wrongBook_v1     | sourceCounts                                   | study,filter,aiQuiz 的错误次数                           | MistakeRecord | sourceCounts                             | 逐键非负整数                                | 三键补 0                               | 同上                                           | 是       |
| wrongBook_v1     | recentAnswers                                  | 最近最多 20 条作答                                       | MistakeRecord | recentAnswers                            | 逐项映射、按 at 降序、截 20；不增造         | []                                     | 去重指纹见 §7                                  | 是       |
| recentAnswers[]  | at/correct/dimension                           | 作答时间、对错、维度                                     | MistakeRecord | occurredAt/isCorrect/dimension           | 时间校验；维度白名单                        | 无时保留 raw 且排序末尾                | 同指纹去重                                     | 是       |
| recentAnswers[]  | userAnswer/correctAnswer/source/question       | 作答详情                                                 | MistakeRecord | 同名字段                                 | 字符串化，不清除内容                        | ''                                     | 不覆盖非空值                                   | 是       |
| wrongBook_v1     | correctStreak                                  | 连续正确次数                                             | MistakeRecord | correctStreak                            | 非负整数                                    | 0                                      | 与 recentAnswers 可验证下限不一致则告警        | 是       |
| wrongBook_v1     | lastWrongAt/lastCorrectAt                      | 最近错/对时间                                            | MistakeRecord | lastWrongAt/lastCorrectAt                | 合法 ISO                                    | null                                   | 取最晚合法值                                   | 是       |
| wrongBook_v1     | status                                         | new/reinforcing/repeated/resolved                        | MistakeRecord | status                                   | 合法值保留                                  | 按计数规则只在缺失时推导并标 derived   | 较严重状态优先仅用于冲突；原值保留             | 是       |
| aiQuizHistory_v1 | id                                             | 测验随机 ID                                              | AIQuizHistory | quizId                                   | trim；合法唯一原样保留                      | 按内容指纹确定性生成                   | 重复按 §7                                      | 是       |
| aiQuizHistory_v1 | title/createdAt/durationMs                     | 测验标题、完成时间、用时                                 | AIQuizHistory | 同名字段                                 | 时间/非负数校验                             | title='本次小测'；时间缺失不伪造       | 重复记录保留更完整                             | 是       |
| aiQuizHistory_v1 | total/correct                                  | 已提交答案总数/正确数                                    | AIQuizHistory | total/correct                            | 非负整数；correct≤total                     | 用 answers 计数但标 derived            | answers 是校验依据，不静默改原值               | 是       |
| aiQuizHistory_v1 | answers[]                                      | 每题最终答案记录                                         | AIQuizHistory | answers                                  | 保持顺序，逐字段映射                        | []                                     | 按 questionId+内容指纹去重                     | 是       |
| AI quiz answer   | questionId,type,dimension,word,lang,prompt     | 题目身份与语义                                           | AIQuizHistory | 同名/wordSnapshot                        | 字符串化，lang/维度校验                     | null/unknown                           | 不由 word 文本改语言而覆盖原值                 | 是       |
| AI quiz answer   | userAnswer,correctAnswer,explanation,isCorrect | 作答与反馈                                               | AIQuizHistory | 同名字段                                 | Boolean/string                              | 空字符串/false 但标 missing            | 非空更完整值优先                               | 是       |
| AI quiz answer   | matchedWordId                                  | 当时找到的词条 ID；可能为空                              | AIQuizHistory | wordId                                   | 经 idMap；若失效再按 lang+headword 唯一匹配 | null                                   | 多匹配不自动选择                               | 是       |

代码依据：[S13][S14][S27]。

## 4.6 AI 会话与回收站

| v1 存储域          | v1 字段                                      | v1 真实语义                         | v2 数据域      | v2 字段                    | 转换规则                                                        | 缺失值处理             | 冲突处理                                | 必须迁移 |
| ------------------ | -------------------------------------------- | ----------------------------------- | -------------- | -------------------------- | --------------------------------------------------------------- | ---------------------- | --------------------------------------- | -------- |
| aiConversations    | id                                           | Date.now 数值或历史 ID              | AIConversation | legacyId/conversationId    | legacyId 原样存；conversationId 用 cacheKey 优先或内容指纹      | 按内容指纹             | 重复见 §7                               | 是       |
| aiConversations    | date                                         | zh-CN 本地化展示时间，无可靠时区    | AIConversation | dateText/updatedAt         | 原文保留；仅可解析时写 updatedAt+质量                           | updatedAt=null         | 不使用迁移时间代替                      | 是       |
| aiConversations    | sentence/word/lang                           | 会话上下文词句与语言                | AIConversation | 同名/wordSnapshot/language | lang en/ja；文本原样                                            | lang 缺失→ja+defaulted | 可唯一匹配 Word 时附 wordId，不覆盖快照 | 是       |
| aiConversations    | cacheKey                                     | 会话去重/更新键；自由会话可含时间戳 | AIConversation | cacheKey                   | trim                                                            | null                   | 同 cacheKey 优先视为同会话              | 是       |
| aiConversations    | systemPrompt                                 | 当时系统提示词                      | AIConversation | systemPrompt               | 原样                                                            | ''                     | 更完整/较新会话优先                     | 是       |
| aiConversations    | presetId                                     | AI 页预设；旧会话可能缺失           | AIConversation | presetId                   | 原样；不从标题强推，只有 v1 代码对 free_ 前缀的兼容语义可存 raw | null                   | 不新增预设                              | 是       |
| aiConversations    | messages[]                                   | 有序 role/content 对话              | AIConversation | messages                   | 仅 role user/assistant/system 合法；未知 role 存 raw            | []；空会话可存档       | 相同前缀时取更长且包含另一方的序列      | 是       |
| recycleBin_v1      | id/batchId                                   | 回收项随机 ID/批次                  | RecycleBinItem | itemId/batchId             | 原样；缺失按内容指纹                                            | 确定性生成/null        | 同 ID 同 payload 去重                   | 是       |
| recycleBin_v1      | kind                                         | word/conversation/example           | RecycleBinItem | kind                       | 白名单映射                                                      | UNKNOWN+只存档         | 不猜类型                                | 是       |
| recycleBin_v1      | label                                        | 显示标签                            | RecycleBinItem | label                      | 字符串                                                          | 已删除项目             | 不参与身份                              | 是       |
| recycleBin_v1      | deletedAt/expiresAt                          | 删除时间 ISO/过期 epoch ms          | RecycleBinItem | deletedAt/expiresAt        | 校验并转 UTC；expiresAt 数字毫秒                                | 缺失则不可自动过期     | 过期项默认存档，不进入活跃回收站        | 是       |
| recycleBin_v1      | payload.word                                 | 完整词快照                          | RecycleBinItem | payload                    | 保持原快照并经 idMap 附 resolvedWordId                          | 原样存档               | 不写回活跃 Word                         | 是       |
| word trash payload | originalIndex/starred/clearState/wrongRecord | 删除前位置、收藏、掌握、错题快照    | RecycleBinItem | payload.*                  | 逐项按对应映射；保持嵌套                                        | 缺失不补               | 活跃域与回收快照独立，不重复计数        | 是       |
| conversation trash | conversation/originalIndex                   | 完整 AI 会话及原位置                | RecycleBinItem | payload.*                  | 会话按本表映射但保持原嵌套                                      | 缺失隔离               | 不同时写入活跃 AIConversation           | 是       |
| example trash      | wordId,word,lang,example,originalIndex       | 被删例句及定位                      | RecycleBinItem | payload.*                  | wordId 经 idMap；文本保留                                       | 无法关联仍可保留回收项 | 不自动恢复                              | 是       |

代码依据：[S15][S26]。

## 4.7 偏好、提醒、版本、备份与敏感信息

| v1 存储域                | v1 字段                                                    | v1 真实语义           | v2 数据域         | v2 字段                                      | 转换规则                                                      | 缺失值处理                 | 冲突处理                           | 必须迁移 |
| ------------------------ | ---------------------------------------------------------- | --------------------- | ----------------- | -------------------------------------------- | ------------------------------------------------------------- | -------------------------- | ---------------------------------- | -------- |
| preferences/localStorage | BACKUP_PREFERENCE_KEYS 各键                                | 字符串偏好            | UserPreference    | key/value                                    | 按键白名单与合法值校验                                        | 使用 v1 默认，不一定写记录 | 设备直迁值优先于旧备份；策略见 §7  | 条件     |
| localStorage             | postponeTested                                             | 旧排序开关            | UserPreference    | wordOrderMode                                | 仅 wordOrderMode 无效/缺失时：true→new-first，否则 weak-first | weak-first                 | 有效 wordOrderMode 优先            | 是兼容   |
| localStorage             | wrongBookEnabled/aiQuizRecord                              | 记录开关              | UserPreference    | 同名                                         | 字符串 'false'→false，其余→true                               | true                       | 设备直迁值优先；备份无此键         | 是       |
| localStorage             | wordbank_*                                                 | 按语言筛选偏好        | UserPreference    | wordbank.level/difficulty.<lang>             | 合法选项保留                                                  | 空                         | 无效值清空并存 raw                 | 可选     |
| localStorage             | deepseekApiKey                                             | API 密钥              | MigrationMetadata | requiresSecretReentry                        | 不复制明文；检测非空→true                                     | true/false                 | 任何备份字段中的同名值也丢弃并告警 | 否       |
| localStorage             | nativeStudyReminderSettingsV2                              | 完整提醒设置          | ReminderSetting   | 各字段                                       | JSON 解析后用 planner.normalizeSettings                       | 读取旧键构造               | V2 合法对象优先                    | 是       |
| 提醒 V2                  | enabled                                                    | 是否启用              | ReminderSetting   | enabled                                      | ===true                                                       | false                      | V2 优先                            | 是       |
| 提醒 V2                  | mode                                                       | smart/fixed           | ReminderSetting   | mode                                         | fixed 保留，其余 smart                                        | smart                      | V2 优先                            | 是       |
| 提醒 V2                  | dueEnabled/rescueEnabled                                   | 智能到期/补救提醒开关 | ReminderSetting   | 同名                                         | !==false                                                      | true                       | V2 优先                            | 是       |
| 提醒 V2                  | reminderTime/rescueTime                                    | 主/补救时间           | ReminderSetting   | 同名                                         | HH:mm 合法，否则 20:00/21:30                                  | 默认值                     | V2 优先                            | 是       |
| 提醒 V2                  | weekdays                                                   | 0=周日…6=周六         | ReminderSetting   | weekdays                                     | 整数去重，保留空数组                                          | [1,2,3,4,5,6,0]            | V2 优先                            | 是       |
| 提醒 V2                  | quietEnabled/quietStart/quietEnd                           | 免打扰设置            | ReminderSetting   | 同名                                         | 布尔/HH:mm 校验                                               | true/22:30/07:30           | V2 优先                            | 是       |
| 提醒 V2                  | exact                                                      | 是否请求准时提醒      | ReminderSetting   | exactRequested                               | ===true；权限实际状态设 unknown                               | false                      | 不把历史权限视为已授予             | 是       |
| localStorage             | dataSchemaVersion/wordStorageVersion                       | v1 迁移和词存储版本   | MigrationMetadata | sourceSchemaVersion/sourceWordStorageVersion | parseInt                                                      | 0                          | 不作为 v2 schema 版本              | 是       |
| 备份包装                 | format/backupVersion/schemaVersion/appName/kind/exportDate | 备份来源元数据        | MigrationMetadata | sourceBackup.*                               | 原样+类型校验                                                 | null/默认                  | 不覆盖设备直迁版本事实             | 是       |
| migration snapshot       | fromVersion/toVersion/createdAt                            | v1 内部迁移快照元数据 | MigrationMetadata | rawArchive.snapshotMeta                      | 原样存档                                                      | null                       | 不作为 v2 完成状态                 | 存档     |

代码依据：[S01][S11][S18][S19][S28][S29]。

# 5. 稳定身份与 ID 映射规则

## 5.1 总原则

- 身份域必须包含 language；日语与英语即使 headword 字符完全相同，也不得共用 wordId。

- canonical 内置词 ID 原样保留。当前 9,828 个资产 ID 是本次迁移的首要身份表；不得按数组位置重新编号，也不得用 v2 新哈希替换。

- 用户词已有非空 `_id` 且不与其他实体冲突时原样保留。所有改写必须写入 MigrationMetadata.idMap，格式 oldRef→newWordId，并记录原因。

- 任何无 ID 生成都必须只依赖源数据和固定规则，不使用当前时间、Math.random、crypto.randomUUID 或迁移运行顺序。

## 5.2 确定性解析顺序

| 优先级 | 输入                              | 确定性规则                                                                                                                      | 结果                                    |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1      | 内置 canonical `_id` 命中         | 精确 ID 且 language 一致                                                                                                        | 保留该 ID                               |
| 2      | 旧词存在 `_id` 但不命中 canonical | 若 ID 在用户词集合唯一且不与内置冲突                                                                                            | 保留为 UserWord ID                      |
| 3      | 无/失效内置 ID                    | 精确 language + normalized folder + normalized headword 命中唯一 canonical                                                      | 映射 canonical ID                       |
| 4      | 仍未命中                          | language + normalized headword 命中唯一 canonical，且 builtIn=true、空 folder、folder 同 canonical，或至少 3 个可比内容字段相同 | 映射 canonical ID，confidence=heuristic |
| 5      | 用户词无 ID                       | newId=`user-v1-` + SHA-256(language                                                                                             | normalizedHeadword                      | readingOrPhonetic | normalizedFolder | sourceId | importedAt | rawRecordDigest) 前 24 hex | 确定性 UserWord ID |
| 6      | 仍冲突                            | 同生成 ID 但 rawRecordDigest 不同：追加 `-` + rawRecordDigest 前 8 hex                                                          | 保留不同实体                            |
| 7      | 无法分类                          | 写入 quarantine，不创建活跃 Word                                                                                                | 迁移继续但核心验证给出警告/失败级别     |

## 5.3 关系重写

- FSRS 卡键：解析 `lang:oldWordId:dimension`，oldWordId 经 idMap，dimension 按语言规范化；ReviewCard 主键固定为 `newWordId#dimension`。日语合法维度 kanji→spelling、reading→reading、meaning→meaning；英语 spelling/listening/meaning 原样。

- 错题、收藏、Mastery 与 AIQuizHistory.answers.matchedWordId 先用显式 ID；失效时才用记录内 language+headword+folder 唯一匹配。AI 测验多匹配时不自动选择。

- sourceId 缺失不阻止迁移，也不用于生成内置 ID。它只能辅助审计，不能替代 canonical `_id`。

- 同语言同拼写的重名词条允许拥有不同 ID；folder、reading/phonetic、sourceId 只用于匹配置信度，不构成全局合并依据。

- 用户词与内置词同名不自动合并。若用户词 `_id` 与内置冲突，内置保留原 ID，用户词按确定性冲突后缀改写；所有关系按原来源集合重写。

- 内置词 `_deleted=true` 时仍建立 Word canonical 和 BuiltInWordOverride.isDeleted=true；相关收藏、Mastery、FSRS、错题仍指向该隐藏 Word，避免孤立。

- 回收站内已删用户词应建立 tombstone identity（可不进入活跃词库），使 payload 内关系可解析；不得把它自动恢复为活跃词。

| 禁止项 不得沿用 v1 rebuildCombinedDB 在 ID 冲突时调用 createRandomWordId 的行为；该行为对迁移不确定且会使重复执行产生不同结果。[S04] |
| ------------------------------------------------------------------------------------------------------------------------------------ |

# 6. 各业务数据的迁移规则

## 6.1 内置词库

| 原始来源                                                                      | 转换过程                                                                 | 最终去向             | 清洗                                        | 可能丢失语义                             | 成功验证                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------- | ------------------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| wordbanks 分片与 finalize 后的 DefaultWords / DefaultEnglishWords。[S22][S23] | 固定提交上先加载两种语言；生成 canonical 快照与 ID 索引；按 4.1 归一化。 | Word(isBuiltIn=true) | 不清除未知字段；校验 5,906/3,922、ID 唯一。 | 若 v2 不保留 raw，rootsStatus 等会丢失。 | 总数与语言数精确一致；每个 canonical ID 可查。 |

## 6.2 用户词条

| 原始来源                                                        | 转换过程                                                  | 最终去向        | 清洗                   | 可能丢失语义                  | 成功验证                                |
| --------------------------------------------------------------- | --------------------------------------------------------- | --------------- | ---------------------- | ----------------------------- | --------------------------------------- |
| userWords_v1；无分离存储时来自 myWordDB_v3 未匹配项。[S05][S08] | 保留合法 ID；无 ID 确定性生成；按字段表清洗；srs 只存档。 | UserWord + Word | 必需字段空的记录隔离。 | importedAt 不能证明创建时间。 | 源有效用户词数=目标+隔离数；ID 无重复。 |

## 6.3 内置词条覆盖

| 原始来源                                                  | 转换过程                                                       | 最终去向            | 清洗                    | 可能丢失语义                          | 成功验证                                             |
| --------------------------------------------------------- | -------------------------------------------------------------- | ------------------- | ----------------------- | ------------------------------------- | ---------------------------------------------------- |
| wordOverrides_v1；旧混合 db 的 canonical 差异。[S04][S05] | 按 changedFields 迁移；保留 `_deleted`；orphan override 隔离。 | BuiltInWordOverride | 不把未出现字段补 null。 | 旧 db 匹配可能只有 heuristic 置信度。 | 每个活跃 override 有 canonical；删除项关联数据仍在。 |

## 6.4 文件夹

| 原始来源                                         | 转换过程                                             | 最终去向               | 清洗                              | 可能丢失语义                               | 成功验证                               |
| ------------------------------------------------ | ---------------------------------------------------- | ---------------------- | --------------------------------- | ------------------------------------------ | -------------------------------------- |
| myFolders_v3、myFolderLangs 与词条.folder。[S08] | 按数组顺序建 Folder；补词条引用；非法/混合语言告警。 | Folder + Word.folderId | NFKC/trim；空值使用 v1 代码默认。 | 混合语言同名文件夹无法无损表达原单一映射。 | 所有活跃词 folderId 存在；顺序可重现。 |

## 6.5 收藏

| 原始来源            | 转换过程                                              | 最终去向 | 清洗               | 可能丢失语义                 | 成功验证                                       |
| ------------------- | ----------------------------------------------------- | -------- | ------------------ | ---------------------------- | ---------------------------------------------- |
| starredWords。[S07] | ID 直连；旧 headword 依 v1 现行多匹配规则映射；去重。 | Favorite | 空值和无匹配隔离。 | 旧同名收藏可能扩散到多个词。 | 目标 Favorite 主键唯一；源可解析引用全部覆盖。 |

## 6.6 三维掌握状态

| 原始来源                    | 转换过程                                                | 最终去向 | 清洗                   | 可能丢失语义                             | 成功验证                                   |
| --------------------------- | ------------------------------------------------------- | -------- | ---------------------- | ---------------------------------------- | ------------------------------------------ |
| mtWordClears_v3。[S07][S25] | 按语言改为显式 dimensions；重复状态 OR 合并；保留 raw。 | Mastery  | 布尔化；未知属性存档。 | 只有最终布尔结果，无首次掌握时间和次数。 | 各维度 true 数与确定性映射后的源统计一致。 |

## 6.7 needsReview

| 原始来源                                      | 转换过程                                 | 最终去向            | 清洗                 | 可能丢失语义                    | 成功验证                      |
| --------------------------------------------- | ---------------------------------------- | ------------------- | -------------------- | ------------------------------- | ----------------------------- |
| mtWordClears_v3.state.needsReview。[S07][S25] | 仅复制 Boolean；不从 mastery/FSRS 推断。 | Mastery.needsReview | 缺失→false+missing。 | 历史什么时候被置位/清除不可知。 | true 数精确一致（排除隔离）。 |

## 6.8 学习记录

| 原始来源                 | 转换过程                                                              | 最终去向   | 清洗                         | 可能丢失语义                                        | 成功验证                                          |
| ------------------------ | --------------------------------------------------------------------- | ---------- | ---------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| studyRecords。[S24][S28] | daily_punch→DAILY_PUNCH；pendulum→GROUP_COMPLETED；日期只保留日粒度。 | StudyEvent | 异常日期保留 raw，不补时刻。 | pendulum 不能辨别具体五种模式；普通过程作答不完整。 | 按 type/date/group 指纹计数；提醒用日期集合一致。 |

## 6.9 组完成次数

| 原始来源                | 转换过程                                           | 最终去向 | 清洗         | 可能丢失语义 | 成功验证             |
| ----------------------- | -------------------------------------------------- | -------- | ------------ | ------------ | -------------------- |
| mtGroupClears_v3。[S24] | 保留 groupKey 和非负 completionCount；可解析 group | cat      | index 元素。 | StudySession | 非法数值归零并告警。 | 组内词集合随词库顺序变化，历史集合无法完整恢复。 | key 集合与次数精确一致。 |

## 6.10 FSRS 卡

| 原始来源                 | 转换过程                                      | 最终去向   | 清洗                              | 可能丢失语义                                                     | 成功验证                                           |
| ------------------------ | --------------------------------------------- | ---------- | --------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| fsrsCards_v1。[S09][S10] | 解析卡键、重写词 ID、完整保存卡状态；不重算。 | ReviewCard | 任一关键数值/时间损坏则隔离整卡。 | 算法库版本只从当前适配层确认，卡创建时确切库构建元数据未持久化。 | 有效卡数一致；due/last_review 可解析；三元组唯一。 |

## 6.11 FSRS 日志

| 原始来源                                            | 转换过程                                     | 最终去向  | 清洗                         | 可能丢失语义                        | 成功验证                                                   |
| --------------------------------------------------- | -------------------------------------------- | --------- | ---------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| fsrsReviewLogs_v1，运行时最多保留后 500。[S08][S09] | 逐条关联卡；生成内容指纹；保持源顺序和评分。 | ReviewLog | 坏时间隔离；不由卡反造日志。 | 早于最后 500 条的日志已永久不可用。 | 去重后数量=唯一源指纹数；每条 wordId/card 存在或明确隔离。 |

## 6.12 错题本

| 原始来源                 | 转换过程                                             | 最终去向      | 清洗                        | 可能丢失语义                                    | 成功验证                                    |
| ------------------------ | ---------------------------------------------------- | ------------- | --------------------------- | ----------------------------------------------- | ------------------------------------------- |
| wrongBook_v1。[S13][S27] | 关联词；保留汇总和最近 20 条；旧 ID 按代码规则重连。 | MistakeRecord | 计数非负，六维/三来源补 0。 | 汇总计数超过 recentAnswers 的历史明细不可恢复。 | 总错/总对和状态统计一致；recentAnswers≤20。 |

## 6.13 AI 会话

| 原始来源               | 转换过程                                                                  | 最终去向       | 清洗                 | 可能丢失语义                                                | 成功验证                          |
| ---------------------- | ------------------------------------------------------------------------- | -------------- | -------------------- | ----------------------------------------------------------- | --------------------------------- |
| aiConversations。[S26] | 优先 cacheKey 去重；保持消息顺序、systemPrompt、presetId 和展示日期原文。 | AIConversation | 非法消息隔离到 raw。 | date 无可靠时区；新自由会话是否成功保存取决于 v1 交互路径。 | 会话/消息数一致；重复规则可复现。 |

## 6.14 AI 测验历史

| 原始来源                | 转换过程                                                    | 最终去向      | 清洗                                  | 可能丢失语义                                      | 成功验证                         |
| ----------------------- | ----------------------------------------------------------- | ------------- | ------------------------------------- | ------------------------------------------------- | -------------------------------- |
| aiQuizHistory_v1。[S14] | 保留最多 100 条现存历史和每题答案；matchedWordId 经 idMap。 | AIQuizHistory | 计数与 answers 交叉校验，冲突只告警。 | 超过 100 的更早测验已被截断；未完成测验不持久化。 | 历史数、答题数、正确数统计一致。 |

## 6.15 回收站

| 原始来源             | 转换过程                                                           | 最终去向       | 清洗               | 可能丢失语义                             | 成功验证                                           |
| -------------------- | ------------------------------------------------------------------ | -------------- | ------------------ | ---------------------------------------- | -------------------------------------------------- |
| recycleBin_v1。[S15] | 有效未过期项进入活跃回收站；过期项默认只存档；payload 不自动恢复。 | RecycleBinItem | 时间与 kind 校验。 | 超过 300/已 cleanup/永久删除项不可恢复。 | 按迁移基准时刻判断；有效/过期/隔离数量相加等于源。 |

## 6.16 设置

| 原始来源                                                           | 转换过程                                                                     | 最终去向                         | 清洗                   | 可能丢失语义           | 成功验证                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | -------------------------------- | ---------------------- | ---------------------- | ------------------------------------ |
| BACKUP_PREFERENCE_KEYS 与设备专用 localStorage 键。[S11][S28][S29] | 合法值写 UserPreference；历史 postponeTested 只作为 fallback；API Key 排除。 | UserPreference/MigrationMetadata | 非法值回退并保留 raw。 | 备份不含部分设备设置。 | 逐键比较有效值与 v1 运行时解释结果。 |

## 6.17 Android 提醒

| 原始来源                                                          | 转换过程                                                                   | 最终去向        | 清洗                        | 可能丢失语义                             | 成功验证                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------- | --------------------------- | ---------------------------------------- | ------------------------------------------- |
| nativeStudyReminderSettingsV2 + 两旧键；系统权限/排程。[S18][S19] | V2 对象优先；旧键补 enabled/time；权限设 unknown；迁移后取消旧 ID 并重排。 | ReminderSetting | planner.normalizeSettings。 | 系统权限与已排程通知不能从业务备份恢复。 | 设置字段等价；v2 重排输出符合相同当前数据。 |

## 6.18 备份与恢复点

| 原始来源                                                                                    | 转换过程                                                                                   | 最终去向                     | 清洗                     | 可能丢失语义                       | 成功验证                                         |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------- | ------------------------ | ---------------------------------- | ------------------------------------------------ |
| 手工 v10、旧 v4、preImportRestorePoint_v1、migrationSafetySnapshot_v1。[S06][S11][S12][S16] | 识别格式、计算 sourceFingerprint、原文件只读存档；恢复点可作为另一来源但不得覆盖更新数据。 | MigrationMetadata.rawArchive | 损坏 JSON 拒绝写活跃域。 | migrationSafetySnapshot 并非全量。 | 哈希、文件大小、解析版本、字段覆盖报告均可复核。 |

# 7. 历史数据与重复数据处理

## 7.1 来源优先级

| 同一事实冲突         | 优先级（高→低）                                                                              | 理由/限制                                                      |
| -------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 词条内容             | canonical 内置资源 + 当前 wordOverrides_v1 > userWords_v1 独立实体 > myWordDB_v3 > 旧备份 db | override 只覆盖同 canonical；用户词同名不并入内置。            |
| 业务键设备双副本     | IndexedDB 非 undefined 值 > localStorage                                                     | 复制 v1 运行时语义；同时保留 localStorage 副本摘要和分歧告警。 |
| 设备当前数据 vs 备份 | 默认设备当前数据 > 最新明确选择的备份 > 恢复点 > 迁移快照                                    | 除非迁移入口明确是“从该备份恢复”；不得自动合并两套全量状态。   |
| 提醒设置             | 合法 nativeStudyReminderSettingsV2 > legacy enabled/time > 默认值                            | 与 v1 readSettings 一致。                                      |
| 排序偏好             | 合法 wordOrderMode > postponeTested 映射 > weak-first                                        | 与 v1 初始化一致。                                             |

## 7.2 去重与合并规则

| 对象           | 确定性规则                                                                                                                           | 审计要求                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 多份旧备份     | backupDigest=SHA-256(规范化 payload，排除 exportDate/kind)；digest 相同整份跳过。不同 digest 逐域按业务指纹去重。                    | 记录 sourceFingerprint 和 duplicateOfMigrationId。 |
| 学习记录       | fingerprint=eventType                                                                                                                | normalizedDate                                     | normalizedGroupLabel；完全相同只保留一条，保留所有 sourceRefs。 | 未知 type 还需 raw payload digest。      |
| FSRS 日志      | fingerprint=resolvedWordId                                                                                                           | language                                           | dimension                                                       | rating                                   | reviewedAt                                                               | dueAfter | source；完全相同去重。 | 同 review 时间但 rating/due 不同均保留并标 conflict。 |
| FSRS 卡        | 同 ReviewCard ID：优先 last_review 较新；相同时 reps 较大；仍相同取 source 优先级；整卡取胜，不逐字段拼接。                          | 所有败选卡存 raw archive。                         |
| 错题记录       | 同 resolvedWordId：若记录 digest 相同去重；否则 total/dimension/source 计数默认取 max，时间取最晚，recentAnswers 按指纹并集后截 20。 | 只有能证明来源时间区间不重叠时才允许计数相加。     |
| AI 会话        | cacheKey 非空相同视为同会话；否则使用 language                                                                                       | word                                               | sentence                                                        | normalized message sequence digest。     | 同 cacheKey 选包含另一序列且消息更多者；分叉都保留并加 conflict suffix。 |
| AI 测验        | id 相同且内容 digest 相同去重；无 ID 用 title                                                                                        | createdAt                                          | answers digest。                                                | 同 ID 内容不同则确定性重命名并保留两条。 |
| 回收站         | item.id+payload digest；同 ID 内容不同保留两条并确定性重命名。                                                                       | 活跃实体与 trash payload 不跨域去重。              |
| 时间异常       | ISO/epoch/日期字符串分类型解析；无时区的 date-only 保留 dateOnly，不附加虚构 UTC 时刻。                                              | 无效原文进入 rawTime，排序置后。                   |
| 语言未知       | 显式 en/ja；缺失词条仅按 v1 兼容默认 ja，同时标 defaulted；AI Quiz 可用代码同款字符检查作辅助，但标 inferred。                       | 关系记录不得仅凭拉丁字母覆盖已关联 Word 的语言。   |
| 损坏 JSON/类型 | 顶层 JSON 损坏：该来源零写入并失败；单键/单记录类型错误：隔离记录并继续，达到 P0 阈值则整体回滚。                                    | 绝不把字符串解析失败当空对象覆盖。                 |

# 8. 不可无损迁移的内容

| 丢失内容               | 原因                                                                             | v2 标记                                      | 用户提示                           |
| ---------------------- | -------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------- |
| “模糊”次数与历史       | ft-blur 只改变内存中的提示状态，不写任何持久化域。[S25]                          | MigrationMetadata.losses: BLUR_NOT_PERSISTED | 是：说明无法恢复，但不影响现有结果 |
| 普通模式每次作答       | 只有部分拼写/选择题通过错题本 recentAnswers 记录；没有统一完整 StudyEvent。      | PARTIAL_STUDY_EVENTS                         | 是，若用户查看历史                 |
| 完成行为的过程         | finishPendulum 只留下全掌握、组次数和某日 pendulum 记录；各词各轮表现未存。[S24] | COMPLETION_ONLY                              | 是                                 |
| 历史 srs 调度语义      | word.srs 当前只创建默认值且不被 FSRS 读取；旧版本是否曾更新无法由当前代码确认。  | LEGACY_SRS_ARCHIVED                          | 否，除非用户依赖旧调度             |
| FSRS 早期日志          | 数组保存/载入均 slice(-500)。                                                    | FSRS_LOGS_TRUNCATED                          | 是：显示“仅保留最近记录”           |
| 错题完整明细           | recentAnswers 最多 20；totalWrong/Correct 可能大于明细。                         | MISTAKE_DETAIL_TRUNCATED                     | 是                                 |
| AI 会话早期历史        | aiConversations 最多 50；某些新自由会话路径 activeIdx=-1 时是否持久化，不确定。  | AI_HISTORY_LIMITED                           | 可提示                             |
| AI 测验早期/未完成记录 | 历史最多 100，只有 complete 时写入。                                             | AI_QUIZ_LIMITED                              | 可提示                             |
| 回收站旧项             | 最多 300、7 天 cleanup、永久删除不可逆。                                         | RECYCLE_HISTORY_LIMITED                      | 否                                 |
| 精确学习时刻           | studyRecords.date 是本地日期字符串；daily_punch/pendulum 无时间和时区。          | DATE_ONLY_RECORD                             | 否                                 |
| 组的历史成员集合       | groupKey 依赖当时词库顺序和 10/7 分组；只存 key/label/次数。                     | GROUP_MEMBERS_UNKNOWN                        | 是，避免误解                       |
| 旧收藏/掌握同名目标    | 旧值可能只存 headword，当前代码会映射多个同名词。                                | AMBIGUOUS_LEGACY_REFERENCE                   | 仅多匹配时提示                     |
| 已永久删除数据         | 不在现存业务键、备份或有效回收站中。                                             | PERMANENTLY_DELETED                          | 无需逐项提示                       |
| Android 权限与系统排程 | 权限和计划位于 OS；App 未持久化可移植快照。                                      | NATIVE_STATE_RECREATED                       | 是：需重新授权/重排                |
| 损坏记录的业务语义     | 类型/时间/JSON 无法解释时不能可靠修复。                                          | CORRUPT_V1_RECORD                            | 有隔离项时必须提示                 |

| 强制规则 不得根据 mastery=true、FSRS reps 或错题总数生成伪造的 StudyEvent/ReviewLog；聚合结果与历史事件是不同事实。 |
| ------------------------------------------------------------------------------------------------------------------- |

# 9. 迁移执行顺序

| 顺序 | 阶段                                          | 执行内容                                                                                  | 为何必须在此时                       |
| ---- | --------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------ |
| 1    | 冻结写入并创建原始快照                        | 复制所有 IndexedDB 键、localStorage 键、选定备份、应用版本、设备时间与哈希；不得修改 v1。 | 回滚和审计的唯一可靠起点。           |
| 2    | 读取版本与来源清单                            | 识别 dataSchemaVersion、wordStorageVersion、backupVersion、来源类型与双副本分歧。         | 决定读取分支和兼容规则。             |
| 3    | 加载内置词身份表                              | 从固定提交加载日/英全部 canonical，校验 9,828 与 ID 唯一。                                | 后续所有词与关系都依赖稳定 ID。      |
| 4    | 选择词条主来源                                | 分离域存在/wordStorageVersion≥1 时选 userWords+overrides；否则处理 myWordDB_v3。          | 避免同时导入新旧表示产生重复。       |
| 5    | 迁移词条与 override                           | 先 Word canonical，再 UserWord，再 BuiltInWordOverride/_deleted。                         | 必须先得到完整活跃/隐藏身份集合。    |
| 6    | 建立并固化 ID 映射                            | 写 oldRef→newWordId、置信度、冲突与 tombstone。                                           | 所有外键迁移必须使用同一映射。       |
| 7    | 迁移文件夹与收藏                              | 先 Folder 后 Word.folderId/Favorite。                                                     | 满足外键依赖。                       |
| 8    | 迁移 Mastery、needsReview、StudyEvent/Session | 语言维度显式映射，记录不可恢复边界。                                                      | 为复习、提醒与验证提供状态。         |
| 9    | 迁移 FSRS 卡，再迁移日志                      | 卡键重写；日志引用 ReviewCard。                                                           | 防止日志孤立且保证活跃调度不被重算。 |
| 10   | 迁移错题本                                    | 用已固化 idMap 关联词条并合并 recentAnswers。                                             | 错题引用稳定词 ID。                  |
| 11   | 迁移 AI 会话与 AI 测验                        | 先会话，再测验 answer.wordId。                                                            | 测验可能引用词条；会话可独立。       |
| 12   | 迁移回收站                                    | 构建 tombstone/嵌套快照，不恢复到活跃域。                                                 | 防止删除项污染活跃计数。             |
| 13   | 迁移设置与 Android 提醒                       | 过滤敏感信息；权限 unknown；不搬运排程实例。                                              | 避免迁移中途触发提醒或外部调用。     |
| 14   | 自动验证与抽样                                | 执行 §11 全清单，生成 source/target/rejected/deduped 计数。                               | 只有验证通过才允许提交。             |
| 15   | 原子提交或回滚                                | 切换 v2 活跃数据指针；失败保持 v1 和旧 v2 版本。                                          | 保证崩溃安全。                       |
| 16   | 首次启动后重排提醒                            | 用户授权状态检查后，基于已迁移 FSRS/学习日期生成新计划。                                  | 系统通知状态不可移植。               |

# 10. 迁移事务、回滚和幂等性

## 10.1 状态机

| 状态         | 可写活跃域          | checkpoint                  | 恢复动作                                              |
| ------------ | ------------------- | --------------------------- | ----------------------------------------------------- |
| NOT_STARTED  | 否                  | 无                          | 开始新迁移                                            |
| SNAPSHOTTING | 否                  | 原始键读取进度              | 重做快照；不使用半快照                                |
| IN_PROGRESS  | 只写 staging        | lastCompletedPhase + counts | 从最后完整阶段继续或清空本 migrationId staging 后重跑 |
| VALIDATING   | 只写 staging        | 验证结果                    | 失败→FAILED；通过→COMMITTING                          |
| COMMITTING   | 仅原子指针/版本切换 | commit marker               | 检查 marker：未切换则重试；已切换则完成               |
| COMPLETED    | 是                  | completedAt/reportDigest    | 同输入重复运行返回既有结果，不重复写                  |
| FAILED       | 否                  | errorCode,phase,diagnostics | 保留 v1 与 raw snapshot；修复后同 migrationId 可重试  |
| ROLLED_BACK  | 否                  | rollbackAt,recoveredVersion | 允许重新开始                                          |

## 10.2 migrationId 与幂等键

- sourceFingerprint = SHA-256(按键名排序的原始 IndexedDB 值序列 + localStorage 键值序列 + 选定备份原始字节 + canonicalManifestDigest)。敏感 deepseekApiKey 只加入“存在/不存在”位，不加入明文。

- migrationId = `v1-v2:` + sourceFingerprint 前 24 hex + `:spec-1`。相同输入和规格版本必须得到相同 migrationId。

- 每条目标记录的幂等键固定为 `domain|businessPrimaryKey|migrationId`；插入使用 upsert/compare-and-swap，不使用 append-only 随机 ID。

- ReviewLog、StudyEvent 等无天然主键的记录使用本规格定义的内容指纹；同 migrationId 重跑不得增加计数。

## 10.3 回滚与异常

| 场景             | 处理                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 任一阶段异常     | 停止后续阶段；staging 保留诊断但不切换活跃指针；v1 原始数据只读保留。                                                             |
| 用户中途关闭 App | 下次启动读取 MigrationMetadata.status/checkpoint；验证已完成阶段 digest 后继续，或丢弃该 migrationId staging 重跑。               |
| 验证失败         | status=FAILED，生成失败项与隔离项清单；不得部分提交。                                                                             |
| 提交阶段崩溃     | 依赖单一 commit marker/activeDatasetId；marker 前为旧数据，marker 后为新数据；不得逐表直接替换。                                  |
| 存储空间不足     | 快照前估算：原始快照 + staging + 20% 安全余量；不足则零写入失败。迁移中 quota error 立即停止并清理可安全删除的 staging，不删 v1。 |
| 重复运行         | 同 sourceFingerprint+specVersion 返回 COMPLETED 报告；不同 sourceFingerprint 新建 migrationId，不覆盖旧报告。                     |
| 用户选择回滚     | 将 activeDatasetId 切回迁移前版本；保留迁移报告与 v1 快照。若 v2 已产生新数据，必须先导出/确认，本文不定义合并。                  |

| v1 快照限制 不得用 migrationSafetySnapshot_v1 代替迁移器自己的全量原始快照：它缺少多个业务域和分离词存储原始集合。[S06] |
| ----------------------------------------------------------------------------------------------------------------------- |

# 11. 验证清单

| ID  | 验证项        | 方法                                                                                          | 允许误差                  | 失败条件                    |
| --- | ------------- | --------------------------------------------------------------------------------------------- | ------------------------- | --------------------------- |
| V01 | 内置词总数    | 按 canonical 统计 Word.isBuiltIn                                                              | 0；总 9,828               | 非 9,828 或 ID 重复         |
| V02 | 日语/英语数量 | language 分组                                                                                 | 0；ja 5,906 / en 3,922    | 任一不等                    |
| V03 | 用户词数量    | 源有效 userWords 或旧 db 未匹配数，对比 UserWord+隔离                                         | 0；允许隔离但必须逐条列明 | 无解释差值                  |
| V04 | override 数量 | 源 object key 与目标 active+deleted+orphan                                                    | 0                         | 无解释差值/字段丢失         |
| V05 | 收藏数量      | 按可解析 unique wordId 比较                                                                   | 0；歧义扩散需单列         | 可解析收藏缺失              |
| V06 | 文件夹关系    | 每个活跃 Word.folderId 存在；源 folder 顺序/语言对比                                          | 0                         | 孤立 folderId 或无解释拆分  |
| V07 | 三维掌握数量  | 按语言/维度统计 true                                                                          | 0（排除隔离并列明）       | 任一维度无解释差值          |
| V08 | needsReview   | 源 Boolean true 与目标统计                                                                    | 0                         | 差值                        |
| V09 | 学习记录      | 按 event 指纹集合比较                                                                         | 0                         | 丢失/新增伪造事件           |
| V10 | 组完成次数    | 每个 groupKey 值比较、总和比较                                                                | 0                         | 任一差值                    |
| V11 | FSRS 卡       | 合法卡键集合、字段逐值比较                                                                    | 0                         | 卡丢失、重算、关键字段变化  |
| V12 | FSRS 日志     | 唯一指纹数和评分分布                                                                          | 0；完全重复可去重         | 无解释差值/顺序错误         |
| V13 | 错题记录      | wordId 集、总错/总对、状态/维度汇总                                                           | 0；合并必须有报告         | 计数下降或孤立              |
| V14 | AI 会话       | 会话指纹、消息总数、role 分布                                                                 | 0；重复可去重             | 消息丢失或次序变化          |
| V15 | AI 测验       | quiz 指纹、answers 数、correct 分布                                                           | 0；重复可去重             | 答案丢失/重关联错误         |
| V16 | 回收站        | 有效+过期存档+隔离=源数                                                                       | 0                         | 无解释差值                  |
| V17 | 设置一致      | 逐键执行 v1 解释函数后比较 v2 有效值                                                          | 0；不含 API Key           | 任何业务设置不同            |
| V18 | 提醒设置      | normalizeSettings(v1) 与目标逐字段比较                                                        | 0                         | 字段不同；权限可为 unknown  |
| V19 | 外键          | Favorite/Mastery/Review*/Mistake/Quiz/Recycle resolved 引用检查                               | 0 活跃孤立                | 任一活跃孤立                |
| V20 | 重复主键      | 所有域 PK 唯一约束                                                                            | 0                         | 任一重复                    |
| V21 | 隔离记录      | source=target+deduped+quarantined 质量守恒                                                    | 0 无解释                  | 记录去向不守恒              |
| V22 | 时间字段      | 所有 active ISO/epoch 可解析且范围合理                                                        | 0                         | 无效 active 时间            |
| V23 | 随机抽样      | 每语言各 30 内置、全部 override≤30、用户词 min(30,n)、关联域各 20；固定种子=sourceFingerprint | 0 项不一致                | 任一字段/关联不一致         |
| V24 | 幂等复跑      | 同 snapshot 连跑两次，比较全库内容 digest                                                     | 完全相同                  | 第二次新增/改写任何业务记录 |
| V25 | 回滚演练      | 在每个阶段注入失败，确认 activeDatasetId 与 v1 快照                                           | 100% 恢复                 | 任何阶段部分提交            |

# 12. 迁移风险等级

| 等级 | 风险                        | 影响                                             | 控制/验证                                      |
| ---- | --------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| P0   | 稳定词 ID 变化              | 所有收藏、掌握、FSRS、错题、测验关联可能整体断裂 | 固定 canonical ID；idMap 全量；V19/V24         |
| P0   | 英语 kanji/kana 误译        | 拼写/听力结果互换或丢失                          | 按 4.3 显式语言映射；逐维度计数 V07            |
| P0   | FSRS 卡键丢失/重算          | 到期计划和用户长期记忆状态被破坏                 | 卡整体原样迁移；不重算；V11/V12                |
| P0   | 内置覆盖/_deleted 丢失      | 用户编辑恢复默认或已删词重新出现                 | override 独立迁移；canonical 外键验证          |
| P0   | IndexedDB/localStorage 分歧 | 读取错误副本导致回退到旧数据                     | 复制 v1 IDB 优先语义并生成分歧报告             |
| P0   | 非原子提交/空间不足         | 部分数据进入 v2 且无法回滚                       | staging+active pointer+空间预检                |
| P1   | 用户词与内置词冲突          | 用户词被误当 override 或 ID 改变                 | 同名不合并；冲突确定性改 ID                    |
| P1   | 备份版本兼容                | 旧 v4/现代 v5+ 字段误判、AI/FSRS 被清空          | 先 normalize，再字段覆盖报告；无字段不解释为空 |
| P1   | 旧 headword 关系歧义        | 收藏/掌握扩散到重名词                            | 复制 v1 规则并标 ambiguous；抽样               |
| P1   | 损坏历史数据                | 类型错误导致整域覆盖为空                         | 记录级隔离；P0 阈值回滚                        |
| P1   | Android 配置无法读取        | 用户提醒偏好丢失或误开启                         | V2/legacy/default 优先级；enabled 默认 false   |
| P1   | 回收站 payload 误恢复       | 已删除内容重新进入活跃域                         | 只迁移容器，不执行 restore                     |
| P2   | UI 偏好遗漏                 | 布局、筛选或最近范围重置                         | 可选偏好清单与逐键报告                         |
| P2   | 无时区日期                  | 展示日期可能受解释差异影响                       | 保留 dateOnly/dateText，不虚构时刻             |
| P2   | root review 决策未迁移      | 开发审核工具的本地进度丢失                       | 默认只存档；不影响用户学习数据                 |

等级定义：P0=可能导致不可逆数据损失、全局关系断裂或错误调度，必须阻断发布；P1=部分域或部分用户显著受损，必须有恢复/隔离；P2=非核心偏好或可解释显示差异。

# 13. 待确认问题

| ID  | 问题                                                                                                 | 涉及数据                 | 未确认风险                                          | 推荐默认                                                                 |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------ |
| Q1  | 迁移入口是仅设备原位升级，还是也允许用户选择一份备份作为主来源？                                     | 全部业务域与冲突优先级   | 错误自动合并会重复或覆盖当前数据                    | 默认原位升级；备份恢复作为独立、显式入口，不自动混合。                   |
| Q2  | 是否需要迁移已过期但尚未被 v1 cleanup 扫除的回收站项？                                               | RecycleBinItem           | 继续显示可能违背 7 天语义；丢弃则无法撤销           | 默认只存档，不进入活跃回收站。                                           |
| Q3  | 同名旧收藏/掌握映射多个词时，是否保持 v1 当前“全部映射”行为？                                        | Favorite/Mastery         | 可能扩大状态，也可能丢失用户原意                    | 默认保持 v1 行为并标 ambiguous。                                         |
| Q4  | 混合语言使用同一文件夹名时，v2 是否允许拆成两个同名语言文件夹？                                      | Folder/Word              | 单语言 Folder 无法表达冲突                          | 默认按 language+name 拆分，显示名不改。                                  |
| Q5  | DeepSeek API Key 是否允许在同一设备原位升级时通过安全凭据通道转移？                                  | deepseekApiKey           | 自动复制有安全风险；不复制要求用户重填              | 默认不迁移明文，提示重新输入。                                           |
| Q6  | 迁移后是否保留 migrationSafetySnapshot_v1 与 preImportRestorePoint_v1 供用户访问，还是仅作内部审计？ | 恢复点/原始档案          | 用户可能误以为 v1 不完整快照可全量恢复              | 默认仅内部只读存档；UI 不作为全量恢复入口。                              |
| Q7  | word.srs 若出现非默认值，是否仍坚持只存档？                                                          | 历史 srs                 | 直接转活跃卡可能污染 FSRS；只存档可能放弃旧版本调度 | 默认只存档；除非获得旧版本算法和字段证据。                               |
| Q8  | AI 会话的 systemPrompt 是否属于必须长期保留的用户数据，还是可归档？                                  | AIConversation           | 提示词可能包含上下文；移除会影响继续对话复现        | 默认与会话一起必须迁移。                                                 |
| Q9  | 词根审核动态键是否属于用户数据交付范围？                                                             | zhongri-root-review-v1:* | 遗漏只影响内部审核进度，不影响学习                  | 默认可选存档。                                                           |
| Q10 | 对损坏/孤立记录，允许核心迁移完成并提示，还是任何一条都阻断？                                        | 所有 quarantine          | 过严会阻止升级，过松会隐藏损失                      | 默认：Word/Override/FSRS 活跃记录孤立为 P0 阻断；偏好/工具数据为非阻断。 |
| Q11 | 设备当前数据与用户选定旧备份冲突时，产品是否提供覆盖而非合并语义？                                   | 多来源导入               | 无明确语义无法保证计数正确                          | 默认整包覆盖到独立 migrationId，不自动字段合并。                         |
| Q12 | 迁移完成后 v1 原始数据保留多久？                                                                     | 原始快照与空间           | 过早删除失去回滚；永久保留占空间                    | 默认至少跨一个稳定版本周期且用户确认后再清理；期限不确定。               |

# 14. 最终交付物

本章汇总开发、测试与产品确认时需要直接取用的七类交付物。详细规则以对应章节为准，汇总表不替代第 4 章逐字段映射。

## 14.1 v1 数据源总表

| 来源组                | 存储/资源                                         | 必须读取     | 备注                         |
| --------------------- | ------------------------------------------------- | ------------ | ---------------------------- |
| IndexedDB             | keyval-store / keyval 的 17 个业务/快照键 + probe | 是           | 业务键详见 2.1；IDB 值优先。 |
| localStorage fallback | 所有业务键 JSON 副本                              | 是           | 用于无 IDB 值和分歧审计。    |
| localStorage 专用     | 版本、偏好、动态筛选、提醒、敏感 Key、root review | 是/按分类    | API Key 只检测存在。         |
| 内置资源              | 日语/英语分片、finalize、来源清单                 | 是           | canonical 身份表。           |
| 备份                  | 现代 zhognri-backup v5+（当前 v10）与旧 v4        | 入口有文件时 | 原字节计算哈希。             |
| Android 原生          | 设置在 WebView localStorage；权限/排程在 OS       | 设置是       | 权限/排程不迁移。            |

## 14.2 v1 → v2 字段映射总表

规范总表位于第 4 章，共覆盖：词条与来源、override/旧 db、文件夹/收藏/Mastery/记录、FSRS、错题/AI 测验、AI 会话/回收站、偏好/提醒/版本。实现评审必须逐行打勾，不得以“同名字段直拷”替代。

## 14.3 必须 / 可选 / 不迁移清单

| 必须                                                                                                                                                | 可选                                                           | 不迁移/只存档                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 用户词、override/_deleted、Folder、Favorite、Mastery/needsReview、记录/组次数、FSRS、错题、AI 会话/测验、有效回收站、业务偏好、提醒设置、迁移元数据 | root review、词库筛选、布局/最近范围、过期回收项档案、来源清单 | API Key 明文、运行中状态、缓存、未完成 AI/测验、OS 权限与排程、历史 srs 活跃化；迁移快照只存档 |

## 14.4 数据丢失清单

完整清单见第 8 章。最低必须向迁移报告写入：BLUR_NOT_PERSISTED、PARTIAL_STUDY_EVENTS、COMPLETION_ONLY、FSRS_LOGS_TRUNCATED、MISTAKE_DETAIL_TRUNCATED、DATE_ONLY_RECORD、GROUP_MEMBERS_UNKNOWN、NATIVE_STATE_RECREATED。

## 14.5 迁移执行顺序

严格执行第 9 章 16 步；关键依赖链为：全量快照 → canonical 身份表 → Word/Override → idMap → 关系域 → FSRS → 错题/AI/回收站 → 设置 → 验证 → 原子提交 → 重排提醒。

## 14.6 自动化验证清单

第 11 章 V01–V25 全部纳入 CI/设备迁移验收。P0 项（V01/V02/V11/V19/V20/V24/V25）必须零失败；任何人工豁免必须附源记录、目标记录和负责人签字。

## 14.7 待确认问题清单

第 13 章 Q1–Q12 是唯一需要产品负责人决策的事项；代码可以确定的内容不应再次变成产品问题。未答复时使用表中推荐默认，并写入 MigrationMetadata.assumptions。

# 附录 A · 源码依据索引

| 编号 | 源码位置                                                                | 支持结论                                                     |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------ |
| S01  | app.js:5–16                                                             | 数据模式、备份格式、词条分离存储与恢复点常量。               |
| S02  | app.js:184–231                                                          | 用户词随机 ID、内置词回退哈希 ID、已有 _id 保留。            |
| S03  | app.js:240–304, 1239–1317                                               | aliases、reviewStatus、source、词条字段归一化。              |
| S04  | app.js:3102–3297                                                        | 内置词加载、组合数据库、override 与用户词合并。              |
| S05  | app.js:3299–3475                                                        | 旧 myWordDB_v3 拆分为 userWords_v1 / wordOverrides_v1。      |
| S06  | app.js:3491–3665                                                        | idb-keyval 优先读取、localStorage 回退、迁移安全快照。       |
| S07  | app.js:3667–3943                                                        | 语言、ID、收藏、三维掌握与 needsReview 的历史迁移。          |
| S08  | app.js:3945–4133                                                        | 所有核心存储键的读取顺序、分离词存储判定与版本提交。         |
| S09  | app.js:4136–4293                                                        | 词条分离保存、文件夹、收藏、学习记录、FSRS、掌握状态写入。   |
| S10  | fsrs-scheduler.js:11–83                                                 | 语言维度、卡键、卡片水合、评分、序列化与到期判断。           |
| S11  | app.js:9583–9785                                                        | 备份偏好、v10 备份字段、现代与旧 v4 备份标准化。             |
| S12  | app.js:10014–10164                                                      | 备份应用、旧备份语言补齐、词条恢复、FSRS 截断。              |
| S13  | app.js:14891–15332                                                      | 错题本、AI 小测历史、回收站存储及错题旧 ID 重新关联。        |
| S14  | app.js:15841–16276                                                      | AI 小测题目、答案记录、matchedWordId 与历史上限。            |
| S15  | app.js:16402–16531                                                      | 删除词条快照、回收站 payload 与恢复逻辑。                    |
| S16  | app.js:16928–16972                                                      | 备份扩展：wrongBook、aiQuizHistory、recycleBin。             |
| S17  | app.js:12026–12078                                                      | 清学习进度、恢复内置词库、完全重置的实际边界。               |
| S18  | native-app.js:4–115, 191–429                                            | 提醒键、旧键、设置字段、系统通知 ID 与运行时重排。           |
| S19  | notification-planner.js:14–88, 206–287                                  | 提醒默认值、归一化与未来 7 天计划。                          |
| S20  | root-review.js:4–48, 71–92                                              | 动态词根审核 localStorage 键与决策结构。                     |
| S21  | haptics.js:12, 75–89                                                    | hapticsEnabled 的默认和写入。                                |
| S22  | wordbanks/assets.js; wordbanks/finalize.js; tests/wordbank-data.test.js | 内置词库分片、最终 ID/字段补齐与 5,906/3,922 基线。          |
| S23  | wordbank-sources.json:1–35; wordbanks/ja-_.js; wordbanks/en-_.js        | 内置词来源与真实字段。                                       |
| S24  | app.js:11227–11251, 8704                                                | 组完成次数、全掌握结果、pendulum 与 daily_punch 记录。       |
| S25  | app.js:10837–10903                                                      | 筛选检验对三维掌握和 needsReview 的实际更新。                |
| S26  | app.js:13920–13957, 14337–14382                                         | AI 会话结构、cacheKey 更新与持久化。                         |
| S27  | app.js:15143–15210, 15625–15767                                         | 普通学习、筛选、AI 小测对错题和 FSRS 的写入。                |
| S28  | app.js:7714–8295, 17193–17215                                           | 偏好默认值、设置写入、错题/测验开关。                        |
| S29  | app.js:18402–18449, 18778–18794                                         | 词库等级/难度动态筛选键。                                    |
| S30  | app.js:9191–9221, 11791–11821                                           | 用户词 isImported/importedAt 与历史 srs 默认对象。           |
| S31  | app.js:18822–18909                                                      | 提醒数据桥：学习日期来自 records 与 FSRS 日志。              |
| S32  | index.html:1772–1775; idb-keyval 6.2.2 dist/index.js                    | 未传 customStore，默认数据库 keyval-store、对象仓库 keyval。 |
| S33  | release-info.js:12–16; package.json                                     | V9.1、build 2026.07.23.2 与包版本 9.1.0。                    |

# 附录 B · 迁移实现验收签署

| 角色       | 确认内容                                               | 结论/日期 |
| ---------- | ------------------------------------------------------ | --------- |
| 迁移开发   | 第 4、5、7、9、10 章已实现；同一快照复跑 digest 相同。 |           |
| 测试       | V01–V25 已执行；失败与豁免清单已附。                   |           |
| 产品负责人 | Q1–Q12 已确认；数据丢失提示文案已确认。                |           |
| 发布负责人 | P0=0；回滚演练通过；v1 原始快照保留策略已确认。        |           |

| 最终结论 本规格不新增功能，也不把缺失历史“合理化”。迁移成功的定义是：可持久化事实守恒、词条身份稳定、关系可验证、调度不重算、敏感信息不泄露、重复执行无副作用。 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- |

# v1 Legacy Source Reader 契约

## 本轮范围

Task 015 第七小步新增 `MigrationLegacySourceSchema` 与
`MigrationLegacySourceReaderUseCase`。它接收 staging 中已经脱敏的 JSON 备份，识别现代
`zhongri-backup` v5+ 或 legacy v4，并输出“规范化但未关联”的来源记录。该用例是后续逐域
transformer 的只读输入边界，不写入 Word、UserWord、Override、ReviewState、active pointer 或
其他活跃业务域。

reader 现在支持两种显式来源选择：默认的 `backup` 只处理选定的脱敏备份文本；
`device` 必须绑定同一 `sourceFingerprint` 的 `MigrationSourceSnapshot`，将只读设备快照投影为
规范化来源后再进入 LegacyReader。浏览器 IndexedDB/localStorage 的枚举仍由既有
`BrowserV1SourceStorage`、`CaptureV1SourceSnapshotUseCase` 和
`MigrationSourceSnapshotSchema` 负责，LegacyReader 不直接调用浏览器 API。

## 输入与输出

输入 `MigrationLegacySourceReaderInputSchema` 固定保存：

- `migrationId`、`sourceFingerprint` 和来源文件名；
- staging 中的 `sanitizedSourceText`，上限 30 MB；
- `sourceSelection=backup|device`；选择 `device` 时必须同时提供匹配的 `sourceSnapshot`。

输出 `MigrationLegacySourceSchema` 固定保存：

- 识别出的 `sourceFormat`、`backupVersion`、`dataSchemaVersion`、`wordStorageVersion`、应用元数据
  和规范化的 `exportDate`；
- 每条来源记录的 `sourceRef`、迁移域、稳定 `serializedValue`、值类型和
  `sourceRecordDigestSha256`；
- 原始脱敏文本摘要、按键排序后的规范化来源摘要、未知字段引用、各域计数和 reader 摘要。
- `sourceOrigin` 和 `storageDivergences`：设备来源记录固定复制 v1 的 IndexedDB 优先语义，
  同键两份规范化值不同则保留两侧 sourceRef 与摘要，并明确 `selectedSource=indexedDb`。

`sourceRecordDigestSha256` 的输入包含 schema version、sourceRef、domain 和规范化记录值，因此
相同值出现在不同来源位置时仍然拥有不同的可审计摘要。输出不携带原始文件之外的活跃目标 ID。

## 来源引用规则

数组记录使用 `data.db[0]`、`data.records[0]` 形式的索引引用；对象映射使用
`data.wordOverrides["old-id"]`、`preferences["theme"]` 形式的 JSON key 引用；规格外字段
使用 `topLevel["..."]` 或 `data["..."]`。所有引用按代码点顺序排序并且必须唯一，超过 500 字符的
引用直接 fail-closed，不截断审计身份。

现代备份的 `wordStorageVersion` 属于来源元数据，不伪装成 UserPreference 记录；合法值进入输出
元数据，非法值保留为 `unknown` 记录。对象/数组域类型错误也保留为单条记录，交给后续
transformer 处置，避免错误类型被静默当成空域。

设备来源使用迁移规格中的固定键映射：`userWords_v1`、`wordOverrides_v1`、`myFolders_v3`、
`myFolderLangs`、`starredWords`、`studyRecords`、掌握/FSRS/错题/AI/回收站键进入相应
`data.*` 域；localStorage 专用键进入 `preferences`；`migrationSafetySnapshot_v1`、
`preImportRestorePoint_v1` 和分离存储下的 `myWordDB_v3` 只生成 `unknown` archive-only 记录。
同一设备同时存在分离词存储时，不把旧 `myWordDB_v3` 再作为 `words` 导入。

## 确定性与安全边界

- JSON 对象递归按键排序，数组顺序保持不变；因此空白和 key 顺序变化不会改变规范化来源摘要、
  逐条记录摘要或 reader 摘要。
- `sourceTextDigestSha256` 仍保存输入脱敏文本的原始摘要，方便审计输入字节变化。
- 递归发现 `deepseekApiKey`（含大小写和分隔符变体）且值不是 `[REDACTED]` 时，在任何摘要计算
  前拒绝读取；错误消息和输出均不包含 secret。
- 非法 JSON、根节点类型错误、超过 100 层嵌套、不可序列化值和摘要适配器异常均 fail-closed。
- reader 只生成内存中的版本化报告；rawArchive/quarantine payload 由后续隔离存储负责。

## 当前不包含

- 不从浏览器 API 直接读取 IndexedDB/localStorage；不绕过 source snapshot Port。
- 不把 `backup` 与 `device` 两套业务来源自动合并；来源选择必须由调用方显式指定。
- 不生成 canonical/user idMap，不重写关系，不执行逐域转换。
- 不激活迁移 staging，不切换 active pointer，不重算 FSRS，也不从汇总数据伪造
  LearningEvent。

测试使用仓库内字段形状 synthetic modern v10/legacy v4 fixture 和 synthetic source snapshot，
覆盖域枚举、未知字段、坏类型、脱敏检查、key 顺序稳定性、设备 sourceRef、IDB/localStorage
分歧和 digest fail-closed；不代表真实用户历史，真实脱敏 fixture 到位前不宣称 V01–V25 已通过。

# v1 身份映射契约

## 本轮范围

Task 015 第五小步新增 `MigrationIdentityMapSchema` 与
`MigrationIdentityMapUseCase`。它只把规范化的 v1 词条/关系引用解析为可审计的
`oldRef → targetWordId` idMap，不写入 Word、UserWord、Override 或任何 active dataset。

它依赖 `CanonicalContentRepositoryPort` 的固定 canonical 身份表，并在生成 idMap 之前执行
canonical 完整性校验。当前输入仍是应用层记录契约；未接入真实 v1 backup reader，也不把合成
fixture 描述成用户历史。

## 已实现规则

- `language` 进入每条身份记录；缺失语言按 v1 兼容规则默认 `ja`，同时记录
  `languageDefaulted=true`。
- 先按 `language + wordId` 查 canonical。精确命中原样保留 canonical ID；跨语言同 ID 不共用，
  进入冲突处理。
- `word` 来源中，合法且唯一、未与 canonical 冲突的用户 `_id` 原样保留；重复 ID、跨语言
  canonical 冲突或非法 ID 不能覆盖 canonical。
- 无用户 ID 时，使用固定字段生成 `user-v1-<SHA-256 前 24 位>`：语言、规范化词头、
  reading/phonetic、规范化文件夹、sourceId、importedAt 和 `rawRecordDigestSha256`。
  不使用时间、随机数或运行顺序。
- 生成 ID 与 canonical/其他目标冲突时，按原始记录摘要追加 8/16/64 位后缀；无法保证唯一时
  隔离该条记录。
- `isBuiltIn=true` 且无文件夹时，唯一 headword candidate 可记录为 `heuristic`；同语重名、
  跨语言冲突和缺少上下文不会自动选择。
- `override-reference` 只能解析 canonical ID；无法解析的 override 不创建用户词。
- `relation` 只有显式 canonical ID 或已在同一批 word 记录中确认的用户 ID 才能关联；其余
  保留为 quarantine，避免关系域加载顺序改变结果。

## 输出与幂等

`MigrationIdentityMapSchema` 固定保存：迁移 ID、来源 fingerprint、canonical manifest 的 ID/
内容摘要、排序后的 entries、mapped/quarantined/canonical/user 数量和 `mapDigestSha256`。
entries 按 `sourceRef` 的代码点顺序排序，并且来源引用必须唯一；因此相同来源换输入顺序会得到
相同 idMap digest。

每条 entry 都保留 raw identity、规范化 headword/folder、原始记录摘要、解析状态、置信度、
原因码和 quarantine code。隔离条目没有 target ID，不能被误认为已完成迁移。

## Fail-closed 边界

- canonical 完整性报告无效时直接拒绝创建 idMap。
- 空 identity、无 raw digest 的无 ID 用户词、孤立 override/关系、同语歧义和无法唯一分配的
  目标 ID 写入 quarantine，不创建 active target。
- 重复 `sourceRef` 在 canonical 校验前拒绝，避免同一来源被悄悄覆盖。

## 后续接线

真实脱敏 v5+/v10 与 legacy v4 fixture 到位后，LegacyReader/逐域 transformer 应先生成该契约
所需的规范化记录和 `rawRecordDigestSha256`，再把冻结的 idMap 传给 Folder、Favorite、Mastery、
StudyRecord、FSRS、错题、AI 历史和回收站转换器；每条转换结果还应交给统一的
[迁移处置与隔离报告](./MIGRATION_DISPOSITION_REPORT.md)。关系转换器不得自行重新推导词条身份。

本文件不表示逐域迁移、quarantine/rawArchive 完整报告、V01–V25、active pointer 激活或回滚
已经完成。

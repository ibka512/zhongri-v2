# ADR-016：以确定性 idMap 固化 canonical 与用户词身份

## 状态

已接受（Task 015 第五小步，2026-07-26）。

## 背景

Task 015 已固定 9,828 条 canonical 内容和脱敏 v1 来源快照，但逐域转换还没有可靠的身份
边界。若 Favorite、Mastery、FSRS 或错题各自按 headword 重新猜测目标，会出现跨语言串词、
重复运行 ID 改变和关系加载顺序依赖。迁移规格 §5 要求先得到完整 oldRef → newWordId 映射，
后续关系只能消费这份结果。

真实 v1 backup fixture 尚未进入仓库，因此本决策只冻结输入/输出契约和可验证算法，不激活任何
业务域。

## 决策

1. 新增 `MigrationIdentityMapSchema` 与 `MigrationIdentityMapUseCase`，只输出隔离可审计的
   idMap，不直接写入 persistence 或 active pointer。
2. 每条身份都显式保存语言；缺失语言按历史兼容规则默认 `ja` 并记录 defaulted 标志。
3. canonical 精确 `language + wordId` 永远优先。跨语言同 ID 不复用，canonical 完整性失败
   时整个 idMap fail-closed。
4. 用户词合法且唯一的旧 ID 原样保留；无 ID 或确定性冲突时按固定字段和
   `rawRecordDigestSha256` 生成 `user-v1-<SHA-256 前 24 位>`，冲突追加摘要后缀。
5. headword candidate 只有 `isBuiltIn=true` 且没有文件夹上下文时才以 `heuristic` 输出；
   歧义、孤立 override 和无法解析的关系进入 quarantine，不自动创建用户词。
6. entries 按 `sourceRef` 排序且引用唯一，map digest 不含时间或随机值，保证相同来源换顺序
   重跑得到相同 idMap。

## 兼容性与影响

- 新契约不修改既有 canonical、snapshot 或 staging schema 的语义；它是迁移应用层的新增输出。
- 旧备份 staging 继续可用；没有真实 fixture 时不会出现活跃 Word/UserWord 写入。
- 后续逐域 transformer 必须把 idMap 当作唯一身份来源，并把无法关联的记录保留到
  `quarantine/rawArchive`。

## 验证

- 应用测试覆盖 canonical 精确命中、缺失语言默认、跨语言冲突、用户 ID 保留/生成、重复 ID、
  headword 歧义、override/关系隔离、空 identity、digest 缺失、完整性失败、重复 sourceRef 和
  输入顺序幂等。
- `npm run verify` 仍是合并门槛；本决策不宣称 V01–V25 或真实迁移已经通过。

# ADR-025：以隔离 payload 保存错题本事实

## 状态

已接受（Task 015 进行中）

## 背景

v1 的 `wrongBook` 是按旧词身份聚合的学习事实，可能同时包含累计错/对次数、连续答对次数、状态、维度计数、来源计数、最近答题和时间快照。它既不能直接写入 v2 的 active learner state，也不能在缺少 canonical 身份时自行生成一个新词条。

## 决策

1. `MigrationDomainSliceUseCase` 只通过既有 identity map 解析 `language + wordId` 或 `language + headword`，目标固定为一个 `mistake-v1:*` 隔离记录；关系不唯一或无法解析时进入 `RELATION_UNRESOLVED` quarantine。
2. `totalWrong`、`totalCorrect`、`correctStreak`、各维度计数和来源计数只接受有限非负数；缺失/非法值默认 `0` 并标记 `COUNT_DEFAULTED`，小数向下取整并标记 `COUNT_FLOORED`。
3. 状态只保留 `new`、`reinforcing`、`repeated`、`resolved`；其他值转为 `unknown` 并标记 `STATUS_UNKNOWN`。日期只保存可解析的 ISO 时间，非法日期转为 `null` 并标记 `DATE_INVALID`。
4. 最近答题只保留可解释的答题对象，按时间倒序最多 20 条；坏对象标记 `RECENT_ANSWER_INVALID`，超出上限标记 `RECENT_ANSWER_TRUNCATED`，每条仍绑定脱敏的原始序列化值。
5. 同一目标的多条错题本记录按目标合并：计数取最大值，日期取最新值，最近答题按序列化值去重，来源引用、摘要、质量标记和原始值取并集；后续记录标记 `deduped`。
6. 成功转换与去重记录继续生成 `rawArchive` 引用，错误关系生成 `quarantine` 引用；结果只进入 `isolatedPayload.wrongBook`，并保持 `writesPerformed:false` 与 `activePointerUpdated:false`。

## 影响

- 错题本事实现在可以在 staging 中离线复核，但不等同于 v2 错题本运行时状态已经激活。
- 计数与最近答题的保守投影避免把不确定的 v1 字段当成可重放事件；真实 fixture 到位后仍需复核字段别名和语义。
- `archives` 目前仍是 inline payload；独立 archive 表、保留周期、压缩/加密和最终激活属于后续存储治理与 V01–V25 验证范围。

## 验证

- synthetic fixture 覆盖一个可关联错题本记录和一个孤立目标；前者生成隔离 payload，后者进入关系 quarantine。
- 重复运行保持 payload、disposition 和 archive 引用确定性；切片不调用持久化 port，也不更新 active pointer。

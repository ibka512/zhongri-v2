# ADR-028：以隔离 payload 保存 AI 小测历史

## 状态

已接受（Task 015 进行中）

## 背景

v1 `aiQuizHistory` 保存已完成小测的元数据和逐题答案。历史答案可能引用旧词 ID、缺少统计字段或包含未来题型；迁移应保留可审计历史，不把它重放成 LearningEvent，也不让它绕过 canonical identity map。

## 决策

1. 小测优先保留合法旧 `id/quizId`，缺失时按来源引用和序列化值生成 `quiz-v1:*`；重复小测按 quiz ID 去重。
2. `createdAt` 只接受可解析时间；`durationMs`、`total`、`correct` 只保存非负整数。统计缺失时可由答案推导并标记 `COUNT_DEFAULTED`，`correct > total` 时钳制并标记 `COUNT_CONFLICT`。
3. 每题保留 question/type/dimension、词快照、语言、prompt、用户答案、正确答案、解释和 isCorrect；词条关联只消费既有 identity map，无法关联仍保留答案并标记 `ANSWER_TARGET_UNRESOLVED`。
4. 缺失/未知语言、答案字段或超过 100 条答案通过 quality flag 保留；历史 payload 最多保存 100 条小测，超过部分只通过 disposition/rawArchive 保留来源证据并标记 `HISTORY_TRUNCATED`。
5. 结果只进入 `isolatedPayload.aiQuizHistory`，不生成 LearningEvent、不调用 AI、不写 active dataset；重复运行必须保持 quiz/answer 内容确定性。

## 影响

- staging 可以离线验证小测数量、答案和词条关联，但不代表 AIQuizHistory 已成为 v2 活跃学习事实。
- 超出上限的历史仍可从 inline/独立 archive 追溯；V15、V19 和真实 fixture 复核负责最终数量守恒与关联验收。
- preferences、提醒和 provider/API Key 仍需独立迁移边界，不能由小测记录推断。

## 验证

- synthetic fixture 覆盖两题测验、计数、答案字段和 canonical Word 关联。
- 切片测试断言 answer 顺序、resolved target、quality/disposition 和 active pointer 不变。

# ADR-003：学习事实持久化与幂等事务边界

- 状态：已接受
- 日期：2026-07-24
- 对应任务：[Task 005](https://github.com/ibka512/zhongri-v2/issues/2)

## 背景

Task004 证明了 Question、Judge、LearningEvent、Application 和固定 UI 的依赖方向，但会话与事件仍只存在于内存。Phase 1 需要在不让页面直接操作数据库的前提下，把一次答题产生的事实和会话检查点可靠保存。

一次答题至少产生两条 LearningEvent，并改变会话状态。如果只写入其中一部分，界面会显示“已记录”，但数据无法解释或恢复。用户重复点击、页面重试或应用崩溃恢复也不能产生重复事实。

## 决策

1. Application 只依赖 `LearningTransactionPort`，不依赖 Dexie 或 IndexedDB。
2. 一次提交在同一事务中写入：
   - AnswerSubmitted 与 AnswerCorrect/AnswerIncorrect LearningEvent；
   - `StudySessionCheckpoint v1`；
   - idempotencyKey 与请求指纹。
3. 同一 idempotencyKey 和相同请求指纹返回已提交结果，不重复写入。
4. 同一 idempotencyKey 对应不同答案时抛出冲突，不覆盖第一次事实。
5. 事务失败时 Application 不进入 feedback 状态，当前题目和答案仍可重试。
6. 内存适配器和 Dexie 适配器运行同一组契约测试。
7. Dexie 是 Infrastructure 实现细节；UI、页面和 Domain 不得 import Dexie。

## Schema 与兼容性

新增 `StudySessionCheckpoint v1`，不修改 Question、Judgement 或 LearningEvent v1 的既有语义。

Checkpoint 只记录恢复一次已提交答案所需的最小事实：会话、用户、题目索引、题目、答案、Judgement、事件 ID 和更新时间。未来扩展会话状态时必须新增版本或保持向后兼容。

## 当前不包含

- ReviewState 与真实 ts-fsrs 更新。
- v1 数据迁移和迁移 UI。
- 下一题、暂停和完整会话恢复事务。
- AI、账号、同步或 Android 原生数据。

## 验证

- 正常提交后事件、Checkpoint 和幂等记录同时可见。
- 相同提交重放后事件数量不增加。
- 冲突重放被拒绝。
- 注入事务失败后没有事件或 Checkpoint。
- Domain 测试不需要 DOM、IndexedDB 或网络。

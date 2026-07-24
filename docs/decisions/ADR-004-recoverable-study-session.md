# ADR-004：以版本化会话状态恢复学习流程

- 状态：已接受
- 日期：2026-07-24
- 对应任务：[Task 006](https://github.com/ibka512/zhongri-v2/issues/4)

## 背景

Task005 已能原子提交答题事件、反馈检查点和幂等记录，但刷新页面后无法判断用户当前处于
答题、反馈还是完成状态。单个答案 Checkpoint 也不足以恢复整段会话，因为它不描述题目
集合、累计事件顺序和下一题位置。

恢复过程必须拒绝不兼容或不完整的数据，不能静默重置并覆盖用户进度。

## 决策

1. 新增 `StudySessionState v1`，记录会话身份、题目引用、当前索引、状态、当前反馈、
   累计事件 ID 和更新时间。
2. `answering`、`feedback`、`completed` 是可持久化状态；状态与答案、Judgement 和索引
   的组合由 Zod 约束。
3. 首次开始会话时立即保存初始状态。
4. 提交答案时，在同一 Dexie 事务中写入 LearningEvent、Checkpoint、完整会话状态和
   幂等记录。
5. 进入下一题或完成练习时，先保存目标状态，再改变内存 QuestionFlow。保存失败时界面
   保持原 feedback 状态，允许重试。
6. 恢复时校验 sessionId、userId、题目引用、事件数量、事件 ID 和事件所属会话。任何
   不一致都返回显式恢复错误，不覆盖现有数据。
7. 页面只调用 Application 工厂；Dexie 实例由 App Composition Root 注入，UI 不直接
   import Infrastructure。

## Schema 与兼容性

`StudySessionState v1` 是新增契约，不修改 Question、Judgement、LearningEvent 或
StudySessionCheckpoint v1 的既有语义。

Dexie 数据库升级到版本 2，并新增 `studySessions` 表。已有版本 1 数据不会被删除；如果
旧数据库只有事件而没有完整会话状态，当前版本会拒绝自动恢复。后续若需要从旧事件重建
会话，必须由独立迁移任务定义可验证的转换规则。

## 当前不包含

- 钟日 v1 数据迁移。
- ReviewState、FSRS 或今日学习计划。
- 账号、跨设备同步和云端冲突解决。
- AI 解释、正式题库、首页或真实音频。

## 验证

- 刷新或重新挂载后可恢复 answering、feedback 和 completed。
- 恢复后保留累计 LearningEvent 顺序和数量。
- 下一题状态保存失败时，内存流程不前进且可以重试。
- 题目集合或事件引用不一致时恢复失败，原数据不被覆盖。
- 内存与 Dexie 适配器继续共享持久化契约测试。

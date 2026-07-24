# ADR-010：以确定性 TodayPlan 编排正式每日课程

- 状态：已接受
- 日期：2026-07-24
- 对应任务：[Task 012](https://github.com/ibka512/zhongri-v2/issues/16)

## 背景

Task011 已提供 20 个具备稳定身份和来源证据的 N5 日语词条，但 `/study-demo` 仍使用三道
Mock 选择题。正式课程既要让用户看到“今日计划 → 答题 → 反馈 → 结果”，又必须继续复用
既有 StudyUseCase、LearningEvent、Dexie 会话和离线恢复，不能为页面创建第二套学习事实。

LearnerProfile 与 FSRS 尚未实现，AI Gateway 也属于后续阶段。Task012 因此需要一种没有
画像和 AI 仍可重复生成、可恢复、可审计的基础课程。

## 决策

1. 新增 `TodayPlan v1`。计划固定本地日期、语言、canonical Manifest ID/内容版本、预计
   用时，以及五个 `itemId + wordId + questionId + questionType` 引用。
2. 每日课程从 canonical Repository Port 读取日语词条；页面和 Application 不直接导入
   资产文件。
3. 按本地日期序号在固定顺序的 canonical 列表中滚动选择五个不重复词条。同一日期和
   Manifest 内容版本生成相同计划 ID、题目 ID 与顺序。
4. 第一条正式纵向切片固定为五题：索引 1/3/5 为词义选择，索引 2/4 为根据中文释义输入
   日语词或读音。
5. 选择题使用同日词条生成四个不重复选项；文本题接受 canonical 词头与读音，并遵守
   `caseSensitive` 和 `trimWhitespace` 判定配置。
6. `TodayPlan.id` 同时作为学习 `sessionId`。开始、答案提交、下一题、完成和重新开始继续
   通过原 StudyUseCase 与 StudyPersistencePort。
7. 结果由已持久化 LearningEvent 计算正确数，并展示本日词条。不得伪造 Profile、薄弱点
   或复习到期时间。
8. 网站根路由进入 `/today`；`/study-demo` 保留为技术回归入口。

## 影响

- 用户在无网络、无账号、无 AI 的情况下可完成第一条正式每日课程。
- 刷新或退出后可以恢复 answering、feedback 与 completed 状态；课程生成规则漂移会被
  会话题目引用校验和测试发现。
- Task013 可在真实 LearningEvent 上建立 LearnerProfile 与复习调度，无需改写 Task012
  产生的事实。
- Task014 之后的 AI 只能补充受 Schema 约束的题目、语境和解释，不能替代基础课程或历史。

## 当前不包含

- LearnerProfile、FSRS、到期复习、薄弱点排序或个性化配额。
- AI Gateway、模型 API、AI 出题、AI 解释或聊天界面。
- 完整词库扩容、用户词转换、账号、同步、通知和真实音频。

## 验证

- Schema 测试覆盖日期、唯一身份和固定 3:2 题型配比。
- Application 测试覆盖同日稳定、跨日滚动、canonical 绑定和题目 Schema。
- Domain 测试覆盖文本标准化、正确与错误判定。
- UI 测试覆盖根路由、混合题型完整闭环、结果与 feedback 重载恢复。
- Format、Lint、TypeScript、Vitest、默认构建和 Pages 构建必须全部通过。

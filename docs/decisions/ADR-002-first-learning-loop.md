# ADR-002：先实现第一个学习闭环

- 状态：Accepted
- 日期：2026-07-24
- 决策范围：Task004 技术验证学习闭环

## 背景

Question、Judgement、LearningEvent v1 契约和 UI 基础组件已经冻结，但契约之间的实际
依赖方向尚未通过一条完整路径验证。如果先接入 AI、数据库或 FSRS，会同时引入外部
不确定性、持久化和调度规则，使边界问题难以定位。

## 决策

Task004 使用三道通过 QuestionSchema v1 验证的日语 Mock Question，完成以下最小路径：

```text
Mock Question
↓
Application StudyUseCase
↓
Domain Judge
↓
JudgementResult
↓
LearningEvent
↓
固定 UI 反馈
```

Domain 只实现选择题的确定性判题和答题事实生成。Application 维护内存中的题目顺序、
当前题目、反馈状态和会话事件。React 页面只渲染快照并把用户输入交给 Use Case。

一次答案提交产生两条事实：

1. `answerSubmitted`
2. `answerCorrect` 或 `answerIncorrect`

这些事件严格使用 LearningEvent Schema v1，不包含掌握度、用户画像或 FSRS 状态。

## 明确不包含

- IndexedDB、Repository 实现或其他持久化。
- AI API、AI 判题或 AI 解释。
- FSRS、掌握度和 LearnerProfile。
- 用户账号、词库、数据迁移和真实音频。
- 正式学习首页或生产学习课程。

## 结果

- 可以独立测试 Domain 判题、Application 流程和 UI 交互。
- `/study-demo` 只作为技术验证入口；刷新后内存事件清空。
- 后续持久化或 AI 能力只能通过新的 Task 和边界决策接入，不能绕过 Application。

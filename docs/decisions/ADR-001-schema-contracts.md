# ADR-001：冻结核心数据契约

- 状态：Accepted
- 日期：2026-07-24
- 决策范围：Question Schema v1、Judgement Schema v1、LearningEvent Schema v1

## 背景

钟日 v2 的核心数据会跨越题目生成、程序判题、学习记录和未来的持久化适配器。
如果先实现页面、数据库或 AI 调用，再补充数据契约，各模块会各自解释同一份数据，
导致 UI、业务事实和模型输出相互耦合。

因此 Phase 0 先冻结可验证、与框架无关的 Schema。当前契约只依赖 TypeScript 和
Zod，不依赖 React、浏览器 API、数据库、AI 或 FSRS。

## 决策

### Question Schema v1

Question 是进入答题系统前已经通过验证的结构化题目。

- `prompt` 保存题目内容。
- `answer` 保存标准答案与确定性判题所需规则。
- `options`、`explanation`、`audio` 保存展示数据。
- `metadata` 保存内容来源、难度和标签等统计分类，不保存用户表现。

MVP 可以通过 `QuestionSchema` 的题型只有：

- `choice`
- `textInput`
- `audioChoice`

`grammar`、`matching`、`ordering`、`openAnswer` 只冻结在 `QuestionType` 中作为未来
标识。v1 不接受这些题型的数据，直到各自的数据结构被单独定义和测试。

音频是题目的组合能力：选择题和文本输入题可以带音频，`audioChoice` 必须带音频。
本契约不负责播放、缓存或 TTS 实现。

### Judgement Schema v1

JudgementResult 描述一次判题的输出：

- `status` 为 `correct`、`incorrect` 或 `partial`。
- `userAnswer` 与 `expectedAnswer` 保留用户答案和标准答案。
- `errorReason` 描述可验证的错误原因。
- `feedbackText` 是 UI 可展示的反馈文本。
- `requiresAiExplanation` 只表示是否需要后续解释，不触发 AI 调用。

MVP 的固定答案由程序判定。未来开放回答可以引入 AI 辅助判定，但 AI 不得直接修改
Question 或 LearningEvent 中的事实。

### LearningEvent Schema v1

LearningEvent 只记录已经发生的行为事实，包括：

- 提交答案、答对、答错
- 忘记、模糊、认识
- 使用提示、重听
- 跳过、退出

`payload` 只允许当前已定义的事实字段，例如答案、答题耗时、提示类型和重听次数。
未知字段会被 Zod 拒绝。LearningEvent 不保存：

- AI 推测
- LearnerProfile
- 掌握等级
- FSRS 调度状态

这些聚合或调度数据未来只能从事实事件派生或由独立模块维护。

## 三者关系

```text
Question
  ↓ 用户作答
JudgementResult
  ↓ 记录已发生事实
LearningEvent
```

Question 定义“题目是什么”，JudgementResult 定义“这次答案如何判定”，
LearningEvent 定义“实际发生了什么”。三者不得互相替代。

## 结果

- AI、UI、数据库适配器未来必须使用同一份版本化契约。
- 无效或未实现的题目不能进入 UI。
- LearningEvent 与 LearnerProfile、FSRS 保持清晰边界。
- 修改 v1 Schema 语义时必须新增 ADR，并说明兼容与迁移影响。

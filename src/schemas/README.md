# Schemas

版本化数据契约。当前冻结版本位于 `v1/`：

- `QuestionSchema`：结构化题目及 MVP 渲染数据。
- `JudgementResultSchema`：判题结果与反馈数据。
- `LearningEventSchema`：只描述已经发生的学习事实。

Schema 必须保持纯 TypeScript，不依赖 React、浏览器 API、数据库或 AI 实现。

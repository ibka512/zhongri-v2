# 钟日 v2 路线图

本路线图只记录已冻结的阶段边界，不替代具体 Task 说明。任何阶段功能都必须通过单独任务
授权后才能实现。

## Phase 0：工程初始化与契约冻结

目标：建立长期可维护、适合个人开发者和 AI 协作的施工现场。

已完成：

- React + TypeScript strict + Vite 基础工程。
- ESLint、Prettier、Vitest、Testing Library 和 CI。
- UI → Application → Domain → Ports → Infrastructure 架构边界。
- Question、Judgement、LearningEvent v1 Schema。
- Design Token、Theme Provider、核心组件和 `/ui-lab`。
- AI 友好的项目知识库。

剩余工作：

- Task 004 及后续任务等待负责人逐项冻结。
- 不在路线图中推测或提前实现未授权模块。

完成标准：Phase 0 所有已定义 Task 通过 build、lint、test，文档与实现一致。

## Phase 1：核心学习闭环

目标：在不依赖 AI 的情况下完成可验证、可离线的最小学习闭环。

计划边界：

- 固定结构化题目进入固定答题 UI。
- 程序完成确定性判题。
- 记录 LearningEvent 学习事实。
- 通过明确的应用用例和 Repository Port 隔离持久化。
- 长期复习调度与学习事实保持边界。

不包含：AI 生成、ASR、实时语音、社区和商业化。

## Phase 2：AI 增强

目标：验证 AI 是否能基于受控上下文提升个性化练习和解释价值。

计划边界：

- 学习画像摘要作为 AI 上下文，不发送全部原始历史。
- AI 生成结构化题目、例句、错误解释和学习总结。
- 所有 AI 输出先经过 Schema 验证，再进入既有 UI。
- AI 不可用时，基础学习闭环仍然可完成。

不包含：完整实时语音外教、自建模型集群或自由生成前端布局。

## Phase 3：语音和高级能力

目标：在核心闭环和 AI 价值验证后，逐步加入语音与高级练习能力。

计划边界：

- ASR、跟读、发音反馈和语音回答。
- 后续评估实时语音外教和情景对话。
- 高级题型必须单独冻结 Schema、UI 和判定边界。

该阶段不在当前 MVP 开发范围内。

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

当前交接：

- Task004 已验收；Task005 和 Task006 已完成持久化、离线基线与会话恢复。
- Task007 和 Task008 已完成开发预览、会话重开与安全清除。
- Task009 已完成 v1 备份只读迁移预检。
- Task010 已完成隔离 staging、原子 active 指针与回滚底座。
- Task011 已建立第一批真实日语 canonical 内容与零容差稳定身份层。
- Task012 已建立不依赖 AI 的正式每日课程纵向切片。
- Task013 的代码实现已经合并，本地浏览器断网验收通过，继续进行 Phase 1 收口。
- GOV-001 已通过 PR #22 合并；Task 015 已固定并导入完整 9,828 条 canonical corpus，当前继续迁移转换和 fail-closed 激活。
- 完整逐域迁移、首次设置、五十音/TTS 和英语/IPA 仍需独立 Task；canonical 资产已到位不等于用户迁移已完成。
- 不在路线图中推测或提前实现未授权模块。

完成标准：Phase 0 所有已定义 Task 通过 build、lint、test，文档与实现一致。

## Phase 1：核心学习闭环

目标：在不依赖 AI 的情况下完成可验证、可离线的最小学习闭环。

计划边界：

- 固定结构化题目进入固定答题 UI。
- 程序完成确定性判题。
- 记录 LearningEvent 学习事实。
- 通过明确的应用用例和 Repository Port 隔离持久化。
- 真实 canonical 内容通过内容 Repository Port 进入课程，不让页面直接读取资产文件。
- 长期复习调度与学习事实保持边界。

不包含：AI 生成、ASR、实时语音、社区和商业化。

Phase 1 的完成条件还包括：迁移后的核心资产可核对并可恢复；日语与英语均能通过同一引擎
完成“今日计划—作答—LearningEvent—画像/调度—下一次调整”；基础路径在断网时仍可完成。

## Phase 2：AI 增强

目标：验证 AI 是否能基于受控上下文提升个性化练习和解释价值。

Phase 2 只有在 Phase 1 验收完成后才进入授权范围。

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

# 钟日 v2 开发状态

本文件记录当前工程阶段。详细任务状态以 [`docs/TASKS.md`](../TASKS.md) 为准。

## 已完成

- **Task 001**：React + TypeScript strict + Vite 工程初始化。
- **Task 002**：Question、Judgement、LearningEvent v1 Schema 冻结。
- **Task 003**：UI Lab 与 Design System 实现。
- **Task 003.5**：GitHub 工程化增强。
- **Task 004**：Application 层与第一个学习闭环技术验证，已由产品负责人验收。
- **Task 005**：Ports、幂等事务、Dexie 与最小离线 App Shell。
- **Task 006**：版本化学习会话状态、下一题/完成持久化和刷新恢复。
- **Task 007**：GitHub Pages 子路径构建、产物校验和自动部署。

## 当前

- **Task 008** 正在实施，任务定义见 [GitHub Issue #8](https://github.com/ibka512/zhongri-v2/issues/8)。
- `StudySessionRepositoryPort` 提供按 `sessionId` 清除当前会话的边界。
- 内存与 Dexie 适配器同时清除事件、检查点、会话状态和对应幂等记录。
- `/study-demo` 在答题中和完成后提供显式二次确认，失败时保持原进度。
- 当前仍不包含真实 v1 迁移、FSRS、AI、账号、词库、正式首页或真实音频。

## 下一步

- 完成 Task008 的代码审查、合并和 Pages 预览验收。
- 后续任务继续按日语纵向切片逐项冻结，不从路线图直接推断。

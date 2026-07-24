# 钟日 v2 开发状态

本文件记录当前工程阶段。详细任务状态以 [`docs/TASKS.md`](../TASKS.md) 为准。

## 已完成

- **Task 001**：React + TypeScript strict + Vite 工程初始化。
- **Task 002**：Question、Judgement、LearningEvent v1 Schema 冻结。
- **Task 003**：UI Lab 与 Design System 实现。
- **Task 003.5**：GitHub 工程化增强。
- **Task 004**：Application 层与第一个学习闭环技术验证，已由产品负责人验收。

## 当前

- **Task 005** 正在实施，任务定义见 [GitHub Issue #2](https://github.com/ibka512/zhongri-v2/issues/2)。
- StudyUseCase 只在学习事务成功后进入 feedback 状态。
- 内存与 Dexie 适配器共享幂等事务契约测试。
- 已启用 PWA manifest、App Shell 预缓存、离线导航和更新状态事件。
- 当前仍不包含真实 v1 迁移、FSRS、AI、账号、词库、正式首页或真实音频。

## 下一步

- 完成 Task005 的代码审查和远程 CI。
- 后续任务继续按日语纵向切片逐项冻结，不从路线图直接推断。

# 钟日 v2 开发状态

本文件记录当前工程阶段。详细任务状态以 [`docs/TASKS.md`](../TASKS.md) 为准。

## 已完成

- **Task 001**：React + TypeScript strict + Vite 工程初始化。
- **Task 002**：Question、Judgement、LearningEvent v1 Schema 冻结。
- **Task 003**：UI Lab 与 Design System 实现。
- **Task 003.5**：GitHub 工程化增强。
- **Task 004**：Application 层与第一个学习闭环技术验证，已由产品负责人验收。
- **Task 005**：Ports、幂等事务、Dexie 与最小离线 App Shell。

## 当前

- **Task 006** 正在实施，任务定义见 [GitHub Issue #4](https://github.com/ibka512/zhongri-v2/issues/4)。
- StudyUseCase 可从版本化会话状态恢复 answering、feedback 和 completed。
- 提交答案时会话状态与学习事实原子提交；进入下一题或完成前先保存目标状态。
- `/study-demo` 使用真实 Dexie Composition Root，页面不直接依赖 Infrastructure。
- 当前仍不包含真实 v1 迁移、FSRS、AI、账号、词库、正式首页或真实音频。

## 下一步

- 完成 Task006 的代码审查和远程 CI。
- 后续任务继续按日语纵向切片逐项冻结，不从路线图直接推断。

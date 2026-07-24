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
- **Task 008**：按会话原子清除、显式二次确认和失败后保留原进度。
- **Task 009**：v5+/v4 备份只读预检、逐域报告和安全导出。
- **Task 010**：隔离迁移暂存、原子 active 指针和回滚边界。
- **Task 011**：20 个真实 N5 词条、固定来源 Manifest 与 canonical 身份仓储。
- **Task 012**：正式每日五词课程、混合题型和可恢复纵向闭环。

## 当前

- **Task 013** 正在实施，任务定义见 [GitHub Issue #18](https://github.com/ibka512/zhongri-v2/issues/18)。
- LearnerProfile v1 与 ReviewState v1 从 LearningEvent 全量重放，不创建第二份学习事实。
- 官方 `ts-fsrs` 的 FSRS v6 只负责长期到期时间，并通过 ReviewScheduler Port 隔离。
- Today Plan 优先当天到期复习、最近仍答错的词，再稳定补足五个基础词。
- 首页只显示真实到期数、薄弱词和历史正确率；无历史时明确展示空状态。
- 当前仍不包含完整词库、AI、真实音频、FSRS 参数训练或旧 FSRS 迁移。

## 下一步

- 完成 Task013 的代码审查、移动端、离线与重放验收。
- Task014 在已验证画像摘要之上建立 AI Gateway，基础课程仍保持可离线完成。

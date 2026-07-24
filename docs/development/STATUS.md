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

## 当前

- **Task 012** 正在实施，任务定义见 [GitHub Issue #16](https://github.com/ibka512/zhongri-v2/issues/16)。
- TodayPlan v1 按本地日期和 canonical 内容版本确定性选择五个 N5 词条。
- 正式 `/today` 入口固定三道选择题与两道文本输入题，并复用 LearningEvent、Dexie
  会话恢复和安全重新开始。
- 结果页只显示本日真实学习事实，不推断尚未实现的画像、薄弱点或到期复习。
- 当前仍不包含完整词库、LearnerProfile、FSRS、AI 或真实音频。

## 下一步

- 完成 Task012 的代码审查、移动端与离线验收。
- Task013 基于 LearningEvent 建立学习者画像与复习调度。

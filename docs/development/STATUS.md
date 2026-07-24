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

## 当前

- **Task 007** 正在实施，任务定义见 [GitHub Issue #6](https://github.com/ibka512/zhongri-v2/issues/6)。
- GitHub Pages 预览使用 `/zhongri-v2/` 子路径和 Hash Router。
- `build:pages` 校验 HTML、PWA manifest 和 Service Worker 的托管路径。
- 合并到 `main` 后由 Pages workflow 自动构建和部署。
- 当前仍不包含真实 v1 迁移、FSRS、AI、账号、词库、正式首页或真实音频。

## 下一步

- 完成 Task007 的代码审查、Pages 启用和首次远程部署。
- 后续任务继续按日语纵向切片逐项冻结，不从路线图直接推断。

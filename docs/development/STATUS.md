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

## 当前

- **Task 010** 正在实施，任务定义见 [GitHub Issue #12](https://github.com/ibka512/zhongri-v2/issues/12)。
- 同一来源 SHA-256 和规格版本生成稳定 migrationId，并幂等复用 snapshot/staging。
- Dexie v3 新增迁移运行、隔离数据集和 active pointer 表，不改变现有学习表语义。
- 页面只有在用户明确操作后才写入脱敏暂存；暂存不激活 Word、FSRS 或学习历史。
- 当前仍不包含 canonical 身份表、逐域业务转换、FSRS 激活、AI、正式首页或真实音频。

## 下一步

- 完成 Task010 的代码审查、合并和 Pages 预览验收。
- 后续任务继续按日语纵向切片逐项冻结，不从路线图直接推断。

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

## 当前

- **Task 009** 正在实施，任务定义见 [GitHub Issue #10](https://github.com/ibka512/zhongri-v2/issues/10)。
- `/migration-preview` 识别现代 v5+ 与旧 v4 JSON，并显示来源指纹和逐域迁移分类。
- 活跃 Word/Override/FSRS 孤立关系属于阻断；可恢复冲突与未覆盖数据明确要求复核。
- 报告可安全导出，但预检不写入 IndexedDB，也不回显旧 API 密钥。
- 当前仍不包含写入式 v1 迁移、FSRS 激活、AI、账号、正式首页或真实音频。

## 下一步

- 完成 Task009 的代码审查、合并和 Pages 预览验收。
- 后续任务继续按日语纵向切片逐项冻结，不从路线图直接推断。

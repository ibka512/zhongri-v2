# 钟日 v2 任务记录

## 已完成

| Task       | 内容                                              | 状态   | Commit     |
| ---------- | ------------------------------------------------- | ------ | ---------- |
| Task 001   | 工程初始化、架构目录、开发规范与 CI               | 已完成 | `c83b83d`  |
| Task 002   | 冻结 Question、Judgement、LearningEvent v1 Schema | 已完成 | `21585a4`  |
| Task 003   | 建立 Design System 与 `/ui-lab`                   | 已完成 | `7d88234`  |
| Task 003.5 | GitHub Actions、Issue/PR 模板和协作状态文档       | 已完成 | `78fbbbd`  |
| Task 004   | Application 层与第一个学习闭环技术验证            | 已验收 | `407c3d5`  |
| Task 005   | 持久化边界与离线学习基线                          | 已完成 | `533961e`  |
| Task 006   | 可恢复的持久化学习会话                            | 已完成 | `a3130f6`  |
| Task 007   | GitHub Pages 开发预览部署                         | 已完成 | `2a87aff`  |
| Task 008   | 学习会话重新开始与本地进度清除                    | 已完成 | `abcef219` |
| Task 009   | v1 备份迁移预检                                   | 已完成 | `9f36f55`  |

## 当前

- **Task 010：迁移 staging、原子提交与回滚边界** 正在实施。
- Issue：[#12](https://github.com/ibka512/zhongri-v2/issues/12)。
- 当前切片包含确定性 migrationId、脱敏快照、隔离数据集、内存/Dexie 适配器、原子 active
  指针和回滚。
- 当前切片不包含 canonical 资产、逐域转换、FSRS 激活、云同步、AI 或旧站点自动读取。

## 待完成

| Task          | 状态   | 说明                                                   |
| ------------- | ------ | ------------------------------------------------------ |
| Task 011 以后 | 未排期 | 只在前一 Task 验收后逐项确认，不从路线图直接推断实现。 |

## 维护规则

- 每个 Task 使用单一目标和明确验收标准。
- 完成 Task 后更新本文件、`PROJECT_CONTEXT.md` 和必要的 ADR。
- 不把路线图中的未来方向当作当前开发授权。
- Commit 保持小步、可审查、可回滚。

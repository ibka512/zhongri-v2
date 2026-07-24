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
| Task 010   | 迁移 staging、原子提交与回滚边界                  | 已完成 | `995b404`  |
| Task 011   | 真实日语词条与 canonical 身份底座                 | 已完成 | `1c94658`  |
| Task 012   | 正式每日课程纵向切片                              | 已完成 | `3c21f73`  |

## 当前

- **Task 013：学习者画像与 FSRS 复习调度** 正在实施。
- Issue：[#18](https://github.com/ibka512/zhongri-v2/issues/18)。
- 当前切片从 LearningEvent 重放 LearnerProfile v1 与 ReviewState v1，并让 Today Plan
  优先消费到期复习和最近仍答错的词。
- 当前切片不包含 AI、FSRS 参数训练、旧 FSRS 迁移、完整词库扩容或迁移业务域激活。

## 待完成

| Task          | 状态   | 说明                                                   |
| ------------- | ------ | ------------------------------------------------------ |
| Task 014 以后 | 未排期 | 只在前一 Task 验收后逐项确认，不从路线图直接推断实现。 |

## 维护规则

- 每个 Task 使用单一目标和明确验收标准。
- 完成 Task 后更新本文件、`PROJECT_CONTEXT.md` 和必要的 ADR。
- 不把路线图中的未来方向当作当前开发授权。
- Commit 保持小步、可审查、可回滚。

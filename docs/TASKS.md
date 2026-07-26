# 钟日 v2 任务记录

## 已完成或已合并

| Task       | 内容                                              | 状态               | Commit     |
| ---------- | ------------------------------------------------- | ------------------ | ---------- |
| Task 001   | 工程初始化、架构目录、开发规范与 CI               | 已完成             | `c83b83d`  |
| Task 002   | 冻结 Question、Judgement、LearningEvent v1 Schema | 已完成             | `21585a4`  |
| Task 003   | 建立 Design System 与 `/ui-lab`                   | 已完成             | `7d88234`  |
| Task 003.5 | GitHub Actions、Issue/PR 模板和协作状态文档       | 已完成             | `78fbbbd`  |
| Task 004   | Application 层与第一个学习闭环技术验证            | 已验收             | `407c3d5`  |
| Task 005   | 持久化边界与离线学习基线                          | 已完成             | `533961e`  |
| Task 006   | 可恢复的持久化学习会话                            | 已完成             | `a3130f6`  |
| Task 007   | GitHub Pages 开发预览部署                         | 已完成             | `2a87aff`  |
| Task 008   | 学习会话重新开始与本地进度清除                    | 已完成             | `abcef219` |
| Task 009   | v1 备份迁移预检                                   | 已完成             | `9f36f55`  |
| Task 010   | 迁移 staging、原子提交与回滚边界                  | 已完成             | `995b404`  |
| Task 011   | 真实日语词条与 canonical 身份底座                 | 已完成             | `1c94658`  |
| Task 012   | 正式每日课程纵向切片                              | 已完成             | `3c21f73`  |
| Task 013   | 学习者画像与 FSRS 复习调度                        | 实现与断网验收通过 | `7826c4b`  |
| GOV-001    | 仓库交接与基线治理                                | 已合并（PR #22）   | `b01814a`  |

## 当前

- **Task 015：v1 迁移逐域转换与 canonical 身份层** 正在进行（[Issue #23](https://github.com/ibka512/zhongri-v2/issues/23)）。canonical corpus 已固定并导入 9,828 条，source snapshot contract、只读浏览器 source adapter、Port → snapshot 编排、source-aware staging、确定性 canonical idMap、统一 disposition/quarantine 报告、只读 Legacy Source Reader、显式设备来源选择与 IDB/localStorage 分歧报告、Word/Override/Folder/Favorite/Mastery/StudyRecord/GroupProgress/WrongBook/RecycleBin/AIConversation/AIQuizHistory/Preference/ReminderSetting/FSRS isolated transformer、inline archive payload、独立 migrationArchives 存储、只验证的 V01–V25 报告和统一 staging orchestration 已完成；接下来取得真实脱敏 fixture，复核未验证项，再把报告接入激活回滚 gate，真实输入到位前不宣称迁移完成。
- GOV-001 已通过 [PR #22](https://github.com/ibka512/zhongri-v2/pull/22) 合并，仓库交接记录已进入 `main`。
- Task 013 已通过 PR #19 合并；本地浏览器断网启动/恢复复测已完成，验收证据已同步到项目状态。
- 当前切片从 LearningEvent 重放 LearnerProfile v1 与 ReviewState v1，并让 Today Plan
  优先消费到期复习和最近仍答错的词。
- 当前切片不包含 AI、FSRS 参数训练、FSRS 重算、完整词库扩容或迁移业务域激活；legacy FSRS 只保存为隔离历史 payload。
- 详细证据与 Phase 1 剩余交付见 [Phase 1 收口记录](./development/PHASE1_CLOSEOUT.md)。

## 待完成

| Task              | 状态   | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task 015 迁移转换 | 进行中 | canonical corpus、snapshot contract、只读 source adapter、source-aware staging、确定性 idMap、disposition/quarantine 报告、Legacy Source Reader、显式设备来源接线与分歧报告、Word/Override/Folder/Favorite/Mastery/StudyRecord/GroupProgress/WrongBook/RecycleBin/AIConversation/AIQuizHistory/Preference/ReminderSetting/FSRS isolated payload、inline archives、独立 migrationArchives 存储、只验证 V01–V25 报告和 staging orchestration 已完成；继续真实 fixture 字段复核、V02/V23/V25 证据、激活回滚 gate。 |
| Phase 1 后续 Task | 未排期 | Task 015 通过后再定义首次设置、内容/音频与双语切片，最后考虑 Phase 2 AI。                                                                                                                                                                                                                                                                                                                                                                                                                                       |

远端 Issue #20 当前名为 Task 014（AI Gateway），但它必须等 Phase 1 验收完成后才可授权实施；治理工作不占用产品 Task 编号。

## 维护规则

- 每个 Task 使用单一目标和明确验收标准。
- 完成 Task 后更新本文件、`PROJECT_CONTEXT.md` 和必要的 ADR。
- 不把路线图中的未来方向当作当前开发授权。
- Commit 保持小步、可审查、可回滚。

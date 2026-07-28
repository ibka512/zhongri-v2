# 钟日 v2 任务记录

## 已完成或已合并

| Task       | 内容                                              | 状态                        | Commit     |
| ---------- | ------------------------------------------------- | --------------------------- | ---------- |
| Task 001   | 工程初始化、架构目录、开发规范与 CI               | 已完成                      | `c83b83d`  |
| Task 002   | 冻结 Question、Judgement、LearningEvent v1 Schema | 已完成                      | `21585a4`  |
| Task 003   | 建立 Design System 与 `/ui-lab`                   | 已完成                      | `7d88234`  |
| Task 003.5 | GitHub Actions、Issue/PR 模板和协作状态文档       | 已完成                      | `78fbbbd`  |
| Task 004   | Application 层与第一个学习闭环技术验证            | 已验收                      | `407c3d5`  |
| Task 005   | 持久化边界与离线学习基线                          | 已完成                      | `533961e`  |
| Task 006   | 可恢复的持久化学习会话                            | 已完成                      | `a3130f6`  |
| Task 007   | GitHub Pages 开发预览部署                         | 已完成                      | `2a87aff`  |
| Task 008   | 学习会话重新开始与本地进度清除                    | 已完成                      | `abcef219` |
| Task 009   | v1 备份迁移预检                                   | 已完成                      | `9f36f55`  |
| Task 010   | 迁移 staging、原子提交与回滚边界                  | 已完成                      | `995b404`  |
| Task 011   | 真实日语词条与 canonical 身份底座                 | 已完成                      | `1c94658`  |
| Task 012   | 正式每日课程纵向切片                              | 已完成                      | `3c21f73`  |
| Task 013   | 学习者画像与 FSRS 复习调度                        | 实现与断网验收通过          | `7826c4b`  |
| GOV-001    | 仓库交接与基线治理                                | 已合并（PR #22）            | `b01814a`  |
| Task 016   | Phase 1 首次设置与本地学习者目标                  | 已验收（负责人 Pages 实测） | `81a17a4`  |
| Task 017   | 设置与数据安全页入口                              | 已验收（负责人 Pages 实测） | `cf5d328`  |
| Task 018   | 内容中心首个只读切片                              | 实现完成，待验收            | `38fd7f8`  |

## 当前

- **Task 015：v1 迁移逐域转换与 canonical 身份层** 已完成负责人验收（[Issue #23](https://github.com/ibka512/zhongri-v2/issues/23)）。canonical corpus、source snapshot、只读 source adapter、逐域 isolated transformer、staging、V01–V25 验证、activation gate、V23/V25 证据入口和 synthetic 端到端验收均已完成；负责人已在 GitHub Pages 使用真实 v1 数据手工测试并反馈无问题，原始备份不入库。后续转入 Phase 1 产品功能收尾，真实报告如需审计由负责人本地保留。
- **Task 016：Phase 1 首次设置与本地学习者目标** 已完成并由负责人在 GitHub Pages 验收（见 [ADR-038](./decisions/ADR-038-phase1-onboarding-settings.md)）。本切片只建立版本化本地设置、首次打开入口和 v1 来源只读检测。
- **Task 017：设置与数据安全页入口** 已完成并由负责人在 GitHub Pages 验收（见 [ADR-039](./decisions/ADR-039-settings-data-page.md)）。本切片只提供本地设置摘要、旧来源三态提示和安全迁移入口，不新增 Schema、数据库表或数据写入行为。
- **Task 018：内容中心首个只读切片** 已实现，待负责人在 GitHub Pages 验收（见 [TASK-018](./tasks/TASK-018-content-center.md) 和 [ADR-040](./decisions/ADR-040-content-center-readonly-slice.md)）。本切片只复用 canonical repository 展示当前语言的内容摘要与可搜索词条。
- GOV-001 已通过 [PR #22](https://github.com/ibka512/zhongri-v2/pull/22) 合并，仓库交接记录已进入 `main`。
- Task 013 已通过 PR #19 合并；本地浏览器断网启动/恢复复测已完成，验收证据已同步到项目状态。
- 当前切片从 LearningEvent 重放 LearnerProfile v1 与 ReviewState v1，并让 Today Plan
  优先消费到期复习和最近仍答错的词。
- 当前切片不包含 AI、FSRS 参数训练、FSRS 重算、完整词库扩容或迁移业务域激活；legacy FSRS 只保存为隔离历史 payload。
- 详细证据与 Phase 1 剩余交付见 [Phase 1 收口记录](./development/PHASE1_CLOSEOUT.md)。

## 待完成

| Task                | 状态                 | 说明                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task 015 迁移转换   | 已验收（负责人实测） | canonical corpus、snapshot contract、只读 source adapter、source-aware staging、确定性 idMap、disposition/quarantine 报告、Legacy Source Reader、显式设备来源接线与分歧报告、全域 isolated payload、inline archives、独立 migrationArchives 存储、V01–V25 报告、staging 重建验证、activation gate、V23/V25 证据入口、synthetic 端到端验收和负责人真实 v1 数据手工验收均已完成；真实备份不入库。 |
| Task 016 首次设置   | 已验收（负责人实测） | 版本化本地学习者设置、首次打开路由、语言/时长/重点/声音向导和 v1 来源只读检测。                                                                                                                                                                                                                                                                                                                 |
| Task 017 设置与数据 | 已验收（负责人实测） | 只读设置摘要、旧版来源三态提示、今日/首次设置/迁移预检入口；不扩展设置 Schema、不执行迁移激活。                                                                                                                                                                                                                                                                                                 |
| Task 018 内容中心   | 实现完成，待验收     | 只读展示当前语言 canonical 内容摘要与词条搜索；不实现用户词、编辑、收藏、导入或音频。                                                                                                                                                                                                                                                                                                           |
| Phase 1 后续 Task   | 未排期               | Task 018 完成后再定义五十音/TTS 和英语/IPA 切片，最后进行 Phase 1 双语闭环验收；Phase 2 AI 仍不在当前范围。                                                                                                                                                                                                                                                                                     |

远端 Issue #20 当前名为 Task 014（AI Gateway），但它必须等 Phase 1 验收完成后才可授权实施；治理工作不占用产品 Task 编号。

## 维护规则

- 每个 Task 使用单一目标和明确验收标准。
- 完成 Task 后更新本文件、`PROJECT_CONTEXT.md` 和必要的 ADR。
- 不把路线图中的未来方向当作当前开发授权。
- Commit 保持小步、可审查、可回滚。

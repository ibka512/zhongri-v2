# Phase 1 收口记录

本文件记录 Task 013 合并后的工程验收证据，以及完整 Phase 1 仍未完成的产品交付项。
它不替代 `TASKS.md`，也不授权未定义的 Task。

## 当前结论

- Task 013 的代码已合并到 `main`：实现提交 `0895485`，合并提交 `7826c4b`。
- LearnerProfile v1、ReviewState v1、可重放投影、FSRS v6 调度和 Today Plan 优先级已经进入仓库。
- 当前状态是“Task 013 技术实现与本地浏览器断网复测完成，完整 Phase 1 收口中”，不是“完整 Phase 1 已完成”。
- 仓库已包含固定提交下完整 9,828 条 canonical corpus（ja 5,906、en 3,922）；迁移数据仍停留在预检与隔离 staging，尚未转换并激活业务域。
- GOV-001 已通过 PR #22 合并；Task 015（Issue #23）已完成 canonical corpus 完整性门禁、资产导入、脱敏 source snapshot contract、只读 source adapter 和 source-aware staging 接线；真实脱敏 fixture 到位前不会激活迁移。

## Task 013 验收证据

| 验收项                               | 状态   | 证据或剩余动作                                                                                                             |
| ------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| Profile/ReviewState Schema 与不变量  | 已通过 | Schema 测试覆盖计数、唯一性和字段范围                                                                                      |
| 同一事件流确定性重放                 | 已通过 | Projector 测试覆盖乱序事件、最新判定和用户隔离                                                                             |
| Good/Again 与 FSRS 字段更新          | 已通过 | `FsrsReviewScheduler` 测试覆盖顺序和确定性                                                                                 |
| 投影原子替换与陈旧状态清除           | 已通过 | 内存/Dexie 持久化契约测试覆盖整体替换                                                                                      |
| 同日计划稳定与到期/近期错误优先      | 已通过 | Today Plan 优先级和稳定身份测试覆盖                                                                                        |
| 首页真实计数与无历史空状态           | 已通过 | Application/UI 测试及本地预览人工检查                                                                                      |
| 刷新后继续学习                       | 已通过 | 375px 本地生产预览中完成答题、刷新、继续并恢复反馈                                                                         |
| 375px 无横向滚动与触控目标           | 已通过 | 本地生产预览检查无横向溢出，主控件高度 48px                                                                                |
| 完整断网启动/恢复                    | 已通过 | 2026-07-26 本地 Chrome 375px 预览：Service Worker ready；答题反馈出现；切断网络刷新后恢复到 1/5；无横向溢出、无 page error |
| 格式、Lint、TypeScript、Vitest、构建 | 已通过 | `format:check`、`lint`、`typecheck`、`test`、`build`、`build:pages`                                                        |

## Phase 1 剩余交付顺序

以下顺序来自产品范围冻结、迁移规格和 Phase 1 目标；每一项都需要单独定义并授权 Task。

1. 完成 v1 迁移的逐域转换、完整 canonical 身份表、V01–V25 核对、备份恢复和激活回滚。
2. 补齐首次设置、目标时长、声音偏好、设置与数据页、内容中心和基础数据安全入口。
3. 完成日语五十音与 TTS 最小切片，并在同一学习引擎中加入英语/IPA 最小切片。
4. 完成 Task 021 后，通过 Phase 1 的双语“今日计划—作答—LearningEvent—画像/调度—下一次调整”验收。
5. Phase 1 验收后，才进入 Phase 2 的 AI Gateway 和受约束结构化内容生成。

## 当前明确不做

- 不在 Phase 1 收口前接入 AI API、模型 SDK、聊天界面或 AI 生成题目。
- 不迁移旧 FSRS 状态并重算，不训练 FSRS 参数。
- 不加入 ASR、实时语音、账号同步、商业化或社区功能。
- 不把完整词库、迁移业务域激活或真实音频描述成已经完成。

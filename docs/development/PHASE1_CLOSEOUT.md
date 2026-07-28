# Phase 1 收口记录

本文件记录 Task 013 合并后的工程验收证据、Task 021 双语闭环验收结果，以及仍未完成的产品交付项。
它不替代 `TASKS.md`，也不授权未定义的 Task。

## 当前结论

- Task 013 的代码已合并到 `main`：实现提交 `0895485`，合并提交 `7826c4b`。
- LearnerProfile v1、ReviewState v1、可重放投影、FSRS v6 调度和 Today Plan 优先级已经进入仓库。
- 当前状态是“Task 021 双语学习闭环已由负责人验收，Phase 1 双语门通过”；这不等于所有 MVP 数据安全与迁移产品能力都已完成。
- 仓库已包含固定提交下完整 9,828 条 canonical corpus（ja 5,906、en 3,922）；Task 015 的转换、验证、激活/回滚边界已通过 synthetic 与负责人真实数据手工验收，但真实备份和私人内容不进入仓库。
- GOV-001 已通过 PR #22 合并；Task 015（Issue #23）已完成 canonical corpus 完整性门禁、资产导入、脱敏 source snapshot contract、只读 source adapter、source-aware staging、逐域转换和验证/激活边界；生产数据仍只允许用户明确操作，不把真实数据写入 Git。

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

## Task 021 双语闭环验收证据

| 验收项                                      | 状态   | 证据或剩余动作                                                                                            |
| ------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| 日语与英语使用同一 DailyCourse/StudyUseCase | 已通过 | 英语 UI 测试完成五题计划、选择/文本作答、反馈和结果页；日语既有同一页面测试继续通过。                     |
| LearningEvent 产生并可恢复                  | 已通过 | 英语闭环测试断言每次五题产生 10 条事件，并且 itemId 属于英语 canonical 词条。                             |
| 切换语言不删除另一语言 ReviewState          | 已通过 | `mergeCrossLanguageReviewStates` 测试覆盖当前语言陈旧状态替换和另一语言状态保留；实现位于今日课程组合根。 |
| Pages 双语切换、刷新与离线人工验收          | 已通过 | 负责人已反馈 Task 021 验收完成；真实验收细节不写入私人数据或 Token。                                      |
| Task 021 全量质量门禁                       | 已通过 | `npm run verify`：51 个测试文件、206 个测试，canonical 9,828 条，89 份 Markdown，生产/Pages 构建通过。    |

## Phase 1 / MVP 剩余边界

以下事项已按独立 Task 验收：

1. Task 015：canonical 身份、逐域转换、V01–V25、激活/回滚边界和负责人真实 v1 数据手工验收。
2. Task 016–020：首次设置、设置/数据摘要、内容中心、五十音/TTS 和英语 IPA。
3. Task 021：双语“今日计划—作答—LearningEvent—画像/调度—下一次调整”闭环。

当前仍保留两条边界：

1. 完整产品级备份/恢复体验和生产数据操作仍需按迁移规格独立维护，不把私人数据写入 Git。
2. Issue #20 / Task 014 的 AI Gateway 合同已冻结；负责人已授权 `zhongri-v2` 协议底座、独立 Gateway
   Worker、Secret 和合成真实联调。直连联调因 Worker→DeepSeek 出站 `fetch` 阶段失败而暂停；受限的
   官方 Cloudflare AI Gateway 出口配置已准备，待创建网关后继续，不改变 Phase 1 基础课程的离线可用性。

## 当前明确不做

- 不接入 AI API、模型 SDK、聊天界面或 AI 生成题目；本地协议/Port/HTTP adapter 只用于 contract
  validation，不改变现有学习闭环。
- 不迁移旧 FSRS 状态并重算，不训练 FSRS 参数。
- 不加入 ASR、实时语音、账号同步、商业化或社区功能。
- 不把完整词库、迁移业务域激活或真实音频描述成已经完成。

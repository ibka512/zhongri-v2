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
| Task 018   | 内容中心首个只读切片                              | 已验收（负责人 Pages 实测） | `38fd7f8`  |
| Task 019   | 日语五十音与浏览器 TTS 最小切片                   | 已验收（负责人 Pages 实测） | `c855e30`  |
| Task 020   | 英语音标最小切片                                  | 已验收（负责人 Pages 实测） | `db8322e`  |
| Task 021   | Phase 1 双语学习闭环收口                          | 已验收（负责人 Pages 实测） | `3ce1532`  |

## 当前

- **Task 015：v1 迁移逐域转换与 canonical 身份层** 已完成负责人验收（[Issue #23](https://github.com/ibka512/zhongri-v2/issues/23)）。canonical corpus、source snapshot、只读 source adapter、逐域 isolated transformer、staging、V01–V25 验证、activation gate、V23/V25 证据入口和 synthetic 端到端验收均已完成；负责人已在 GitHub Pages 使用真实 v1 数据手工测试并反馈无问题，原始备份不入库。后续转入 Phase 1 产品功能收尾，真实报告如需审计由负责人本地保留。
- **Task 016：Phase 1 首次设置与本地学习者目标** 已完成并由负责人在 GitHub Pages 验收（见 [ADR-038](./decisions/ADR-038-phase1-onboarding-settings.md)）。本切片只建立版本化本地设置、首次打开入口和 v1 来源只读检测。
- **Task 017：设置与数据安全页入口** 已完成并由负责人在 GitHub Pages 验收（见 [ADR-039](./decisions/ADR-039-settings-data-page.md)）。本切片只提供本地设置摘要、旧来源三态提示和安全迁移入口，不新增 Schema、数据库表或数据写入行为。
- **Task 018：内容中心首个只读切片** 已实现并由负责人在 GitHub Pages 验收（见 [TASK-018](./tasks/TASK-018-content-center.md) 和 [ADR-040](./decisions/ADR-040-content-center-readonly-slice.md)）。本切片只复用 canonical repository 展示当前语言的内容摘要与可搜索词条。
- **Task 019：日语五十音与浏览器 TTS 最小切片** 已按冻结范围实现并由负责人在 GitHub Pages 验收（见 [TASK-019](./tasks/TASK-019-kana-tts-slice.md) 和 [ADR-041](./decisions/ADR-041-kana-tts-slice.md)）。本切片只提供基础平假名辨认/听辨练习和浏览器内置朗读回退，不接入远程音频、AI 或掌握持久化。
- **Task 020：英语音标最小切片** 已按冻结范围实现、通过本地全量验证并由负责人 Pages 验收（见 [TASK-020](./tasks/TASK-020-english-ipa.md) 和 [ADR-042](./decisions/ADR-042-english-ipa.md)）。本切片只复用 canonical 英语词条展示 IPA 并提供当前页面辨认练习，不接入英语 TTS、远程音频、AI 或掌握持久化。
- **Task 021：Phase 1 双语学习闭环收口** 已按冻结合同实现并由负责人在 Pages 验收通过（见 [TASK-021](./tasks/TASK-021-bilingual-loop-closeout.md) 和 [ADR-043](./decisions/ADR-043-bilingual-projection-preservation.md)）。本任务只修复语言切换时的复习投影保留，并补齐英语今日课程真实闭环测试，不新增 Schema、AI 或迁移激活。
- **Task 014：DeepSeek AI Gateway 与结构化任务协议** 已完成 `zhongri-v2` 与独立 Gateway 的本地实现、双端契约测试、公开远端发布、Worker 部署、Secret 配置和真实联调，并已把 Gateway 成功路径接入今日计划页的按需 AI 练习预览（见 [TASK-014](./tasks/TASK-014-ai-gateway.md)、[ADR-044](./decisions/ADR-044-ai-gateway-boundary.md) 和 [Issue #20](https://github.com/ibka512/zhongri-v2/issues/20)）。独立工程为 [`ibka512/zhongri-ai-gateway`](https://github.com/ibka512/zhongri-ai-gateway)，代码基线为 `860aad0`；Worker `/health` 已通过，Cloudflare AI Gateway 网关 `zhongri-deepseek` 已启用，合成 fixture 连续两次返回 HTTP 200 的合同 `success`。预览只读展示且失败回退，不替换今日课程或写入学习事实。
- GOV-001 已通过 [PR #22](https://github.com/ibka512/zhongri-v2/pull/22) 合并，仓库交接记录已进入 `main`。
- Task 013 已通过 PR #19 合并；本地浏览器断网启动/恢复复测已完成，验收证据已同步到项目状态。
- 当前切片从 LearningEvent 重放 LearnerProfile v1 与 ReviewState v1，并让 Today Plan
  优先消费到期复习和最近仍答错的词。
- 当前切片不包含 AI、FSRS 参数训练、FSRS 重算、完整词库扩容或迁移业务域激活；legacy FSRS 只保存为隔离历史 payload。
- 详细证据与 Phase 1 剩余交付见 [Phase 1 收口记录](./development/PHASE1_CLOSEOUT.md)。

## 待完成

| Task                | 状态                              | 说明                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task 015 迁移转换   | 已验收（负责人实测）              | canonical corpus、snapshot contract、只读 source adapter、source-aware staging、确定性 idMap、disposition/quarantine 报告、Legacy Source Reader、显式设备来源接线与分歧报告、全域 isolated payload、inline archives、独立 migrationArchives 存储、V01–V25 报告、staging 重建验证、activation gate、V23/V25 证据入口、synthetic 端到端验收和负责人真实 v1 数据手工验收均已完成；真实备份不入库。 |
| Task 016 首次设置   | 已验收（负责人实测）              | 版本化本地学习者设置、首次打开路由、语言/时长/重点/声音向导和 v1 来源只读检测。                                                                                                                                                                                                                                                                                                                 |
| Task 017 设置与数据 | 已验收（负责人实测）              | 只读设置摘要、旧版来源三态提示、今日/首次设置/迁移预检入口；不扩展设置 Schema、不执行迁移激活。                                                                                                                                                                                                                                                                                                 |
| Task 018 内容中心   | 已验收（负责人实测）              | 只读展示当前语言 canonical 内容摘要与词条搜索；不实现用户词、编辑、收藏、导入或音频。                                                                                                                                                                                                                                                                                                           |
| Task 019 五十音/TTS | 已验收（负责人实测）              | `/kana` 提供基础平假名辨认/听辨和浏览器 Speech Synthesis；不写入 LearningEvent，不接入远程音频、AI、账号或同步。                                                                                                                                                                                                                                                                                |
| Task 020 英语音标   | 已验收（负责人实测）              | `/ipa` 复用 canonical 英语词条展示 IPA 并提供词形/音标辨认；不接入英语 TTS、远程音频、AI、账号或同步。                                                                                                                                                                                                                                                                                          |
| Task 021 双语闭环   | 已验收（负责人实测）              | 日语/英语通过同一今日课程引擎完成计划、作答、LearningEvent、画像/复习状态和下一次计划；切换语言不删除另一语言 ReviewState。                                                                                                                                                                                                                                                                     |
| Task 014 AI Gateway | PWA 按需预览已接入，待 Pages 验收 | `zhongri-v2` 协议底座、应用层按需调用与只读预览、[`zhongri-ai-gateway`](https://github.com/ibka512/zhongri-ai-gateway) 均已通过本地验证；Gateway 代码基线为 `860aad0`，Worker `/health` 返回 200，网关 `zhongri-deepseek` 已启用，合成 fixture 连续两次返回 HTTP 200 的合同 `success`。GitHub Pages workflow 注入公开 Gateway URL；AI 失败仍回退规则课程。                                      |
| Phase 1 后续 Task   | 双语门已通过                      | Task 021 双语闭环已验收；迁移生产级备份/恢复边界仍按现有文档记录，AI Gateway 进入独立 Task 014。                                                                                                                                                                                                                                                                                                |

远端 Issue #20 当前名为 Task 014（AI Gateway）；两仓实现已发布，双端 contract tests、Secret 配置、真实合成联调和 PWA 按需预览接线均已完成。下一步是负责人在 GitHub Pages 验收成功预览、失败回退和今日课程不受影响，治理工作不占用产品 Task 编号。

## 维护规则

- 每个 Task 使用单一目标和明确验收标准。
- 完成 Task 后更新本文件、`PROJECT_CONTEXT.md` 和必要的 ADR。
- 不把路线图中的未来方向当作当前开发授权。
- Commit 保持小步、可审查、可回滚。

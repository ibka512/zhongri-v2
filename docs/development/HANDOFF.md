# AI 接手记录

本文件是跨 AI、跨会话的当前工作交接面。每次暂停、提交、合并或切换 Task 前必须更新。

## 当前快照

- 稳定基线：`origin/main`（已包含 GOV-001 PR #22、Task 015 第一小步 PR #24、交接 PR #25、发布清理 PR #26、完整资产 PR #27、交接 PR #28、source snapshot PR #29、source adapter PR #31、交接 PR #32、canonical idMap PR #33、disposition report PR #34、Legacy Source Reader PR #35、交接 PR #36、核心域纵向切片 PR #37、staging orchestration PR #39/#40、负责人真实 v1 数据验收记录 `07ef6f9`、Task 016 推送记录 `819799b`、Task 017 推送记录 `d182a25`、Task 018 推送记录 `9dc2c7f` 和负责人 Pages 验收确认）
- 当前交接分支：`main`
- 稳定基线提交：`e0d83eb`（Task 020 远端发布记录已推送到远端 main，并由负责人完成 Pages 验收）
- 当前实现提交：`3ce1532`（Task 021 双语复习投影保留与英语今日课程闭环测试；本地已验证，待发布）
- 当前任务：Task 021 · Phase 1 双语学习闭环收口（ADR-043）
- 当前状态：Task 015 的 9,828 条 canonical corpus、全域 isolated 转换、V01–V25 验证、activation/rollback 边界和负责人真实 v1 数据手工验收已完成；Task 016/017/018/019/020 已实现并通过负责人 Pages 验收；Task 021 已实现跨语言 ReviewState 合并，并补上英语今日课程同引擎闭环测试，`npm run lint`、`npm run typecheck`、`npm run test` 已通过（51 个测试文件、206 个测试），待生产构建、Pages 构建和远端发布。英语 TTS、远程音频、AI、账号同步和迁移激活仍未授权
- 产品阶段：Phase 1 收口；Task 013 代码已合并，本地浏览器断网启动/恢复复测已完成
- 发布状态：PR #27、PR #28、PR #29、PR #31、PR #33、PR #34、PR #35、PR #37、PR #39、PR #40 均已通过 CI 并合并；Task 018 的 `38fd7f8`、`9dc2c7f`、`ac1cf49` 已推送且由负责人 Pages 验收。Task 019 的 `04a97ee`、`c855e30`、`7a56f37`、`3a6e55f` 已推送到远端 main，并已由负责人在 GitHub Pages 验收。Task 020 的 `234878b`、`877bc19`、`dfb3260`、`db8322e`、`e0d83eb` 已推送到远端 main，远端核对为 `e0d83eb`，负责人已完成 Pages 验收。
- 发布阻塞记录：普通环境的本地代理端口曾不可用；改用已恢复的外部网络通道后，Task 020 已成功推送并以 `git ls-remote` 核对远端 `HEAD`/`main` 为 `e0d83eb`。

## 本轮已完成

- GOV-001 已通过 [PR #22](https://github.com/ibka512/zhongri-v2/pull/22) 合并。
- Task 015 第一小步已通过 [PR #24](https://github.com/ibka512/zhongri-v2/pull/24) 合并，Issue #23 保持开放。
- Task 015 第二小步导入 `jp-study@36c8129dfc364453198790b64687ff9105a3ecae` 的 9,828 条资产，新增动态双语 corpus Repository。
- Task 015 新增 `CanonicalCorpusManifestSchema`、固定 9,828/5,906/3,922 验收目标和 `verify:canonical` 来源门禁。
- `verifyCanonicalCorpusIntegrity` 覆盖双语数量、重复身份、来源摘要和 fail-closed 目标门禁。
- Task 015 第三小步新增 `MigrationSourceSnapshotSchema`、`MigrationSourceSnapshotUseCase`、ADR-014 和字段形状 synthetic fixture；敏感键只保存存在性并脱敏，稳定 sourceFingerprint 不受捕获时间或 secret 值影响，已通过 PR #29 合并。
- `BrowserV1SourceStorage` 只读枚举既有 `keyval-store/keyval` 和 localStorage，过滤 `zhongri_storage_probe`；`CaptureV1SourceSnapshotUseCase` 编排读取与脱敏快照。
- `MigrationStagingDataset.sourceSnapshot` 默认为 `null` 兼容旧备份 staging；带快照时以快照 fingerprint 派生 migrationId，并校验选定备份与预检报告一致。
- `b289902` / `e3a53d0` 已在 PR #31 CI 通过：canonical 9,828、文档 52、30 个测试文件/120 个测试、默认构建和 Pages 构建均通过。
- 新增 ADR-012、ADR-013、ADR-014、ADR-015、Task 015 合同和状态文档；CI/本地 `npm run verify` 全部通过。
- `674288e` 新增 `MigrationIdentityMapSchema`、`MigrationIdentityMapUseCase` 和 ADR-016：固定语言、canonical 精确命中、用户 ID 保留/生成、冲突后缀、headword heuristic、override/relation quarantine 与稳定 map digest；本地 `npm run verify` 通过（31 个测试文件、127 个测试）。
- 本轮新增 `MigrationDispositionReportSchema`、`MigrationDispositionReportUseCase` 和 ADR-017：统一 migrated/deduped/quarantined、rawArchive/quarantine 引用、V21 数量守恒和 identity-map digest 绑定；真实 payload 仍未写入 staging。
- 当前切片新增 `MigrationLegacySourceSchema`、`MigrationLegacySourceReaderUseCase` 和 ADR-018：只读读取脱敏现代 v5+/v10 或 legacy v4 JSON，固定 sourceRef、逐条 digest、未知字段记录和 reader digest；不读取浏览器 API、不写入活跃域。
- 本轮新增 `MigrationDomainSliceSchema`、`MigrationDomainSliceUseCase` 和 ADR-019：从 reader 输出贯通
  `words / overrides / folders / favorites`，复用 idMap 生成 Word/Override/Folder/Favorite isolated
  payload，并让每条核心域 sourceRef 进入 disposition；synthetic fixture 只验证字段形状，payload
  固定 `writesPerformed:false` 与 `activePointerUpdated:false`；`MigrationStagingDataset` 已增加
  可选 `isolatedDomainSlice` 字段，仍不触发 active pointer。
- 本轮继续新增 `MigrationDomainSliceStagingUseCase`、统一 source preparation 和 ADR-020：固定
  `prepare → reader → transformer → staging` 编排，replay 绑定 isolated payload digest；只执行 stage，
  不调用 commit。
- 本轮新增 ADR-021 和显式 `sourceSelection=backup|device`：设备入口要求绑定同一
  `sourceFingerprint` 的 source snapshot，在 Application 层把 keyval-store/localStorage 投影为
  Legacy Source Reader 输入；复制 IndexedDB 优先/localStorage 回退语义并输出
  `storageDivergences`，分离词存储下的 `myWordDB_v3` 只进入 unknown archive-only。新增当前设备
  暂存 UI 入口，仍只写隔离 staging，不更新 active pointer。
- 本轮新增 ADR-022 和 Mastery/StudyRecord/FSRS isolated transformer：Mastery 只复用 identity map
  并按 Boolean OR 合并；StudyRecord 映射 `DAILY_PUNCH`/`GROUP_COMPLETED`，保留日期粒度与未知类型
  raw；FSRS 卡保存 `ts-fsrs@v1-adapter` 历史字段，日志必须关联有效卡，坏关系/坏卡/孤立日志
  进入统一 quarantine。新增字段形状 synthetic fixture 与 端到端切片测试；payload 仍不写 active。

- 本轮继续新增 ADR-023 和 GroupProgress isolated transformer：`mtGroupClears_v3` 组键规范化、
  非整数向下取整/非法值默认 0、重复组键取最大值并进入同一 disposition；不拆解成员、不生成
  StudySession、不更新 active pointer。
- 本轮继续新增 ADR-024：将 disposition report 的 rawArchive/quarantine 引用与同一份脱敏
  serializedValue 绑定到 `isolatedPayload.archives`，使 staged 结果可离线复核；独立表和保留策略随后
  由 ADR-030 接入，压缩/加密仍未实现。
- 本轮继续新增 ADR-025 和 WrongBook isolated transformer：按既有 identity map 关联错题本目标，
  保守保存累计/维度/来源计数、状态、日期和最多 20 条最近答题；不确定字段通过 quality flag 保留，
  孤立关系进入 `RELATION_UNRESOLVED` quarantine，重复目标合并并保留 inline archive；payload 仍不写 active。
- 本轮继续新增 ADR-026 和 RecycleBin isolated transformer：按原始或确定性 item ID 保存 tombstone，
  保守映射 kind、删除/过期时间和 resolved Word 目标，以 source exportDate 判断 retention，不执行
  restore/cleanup；未知或无法关联项目保留在隔离 payload 并标记 quality flag。
- 本轮继续新增 ADR-027 和 AIConversation isolated transformer：按 cacheKey/旧 ID/内容指纹生成确定性
  会话 ID，保留日期原文、系统提示词、预设、Word 关联和有序消息；未知 role/日期/语言进入 quality
  flag，重复会话合并更完整消息，payload 不调用 AI 或 active persistence。
- 本轮继续新增 ADR-028 和 AIQuizHistory isolated transformer：按旧 quiz ID/来源指纹保存测验元数据和
  最多 100 条逐题答案，统计缺失/冲突、语言/词条关联和答案截断通过 quality flag 保留，不反造
  LearningEvent；payload 仍不调用 AI 或 active persistence。
- 本轮继续新增 ADR-029 和 Preference isolated transformer：只接收安全白名单键，动态词库筛选键按固定
  语言模式接受；未知键进入 quarantine，`deepseekApiKey` 仅保存 `[REDACTED]`、敏感重输标记和
  source digest，不写 active 设置；新增敏感/未知键测试。
- 本轮继续新增 ADR-030 和独立 migrationArchives 存储：`stageMigration` 在同一事务中把已校验的
  inline `archives` 写入 InMemory/Dexie 独立表，按 migrationId 提供只读查询；默认采用
  `stable-version-cycle` 保护，retention boundary 未确定时不自动清理，commit/rollback 不改变 active
  业务数据；新增双适配器归档契约测试。
- 本轮继续新增 ADR-031 和只验证的 V01–V25 报告：固定检查顺序并实际覆盖 canonical 总数、逐域
  disposition 守恒、isolated 外键/主键/时间和可选 replay；V02/V18/V23/V25 在真实双语 corpus、提醒
  transformer、固定抽样和失败注入证据到位前保持 `unverified`，报告不调用 persistence、不授权 active。
- 本轮继续新增 ADR-032 和 ReminderSetting isolated transformer：V2 设置优先、旧 enabled/time 回退，
  时间/星期归一化、默认值和来源摘要保留，权限固定 `unknown`；V18 在提醒来源完整映射时通过，
  不写 active ReminderSetting、不调用 NotificationPort。
- 本轮新增 ADR-033 和 `MigrationActivationUseCase`：激活必须接收 schema-valid 且 `passed=true` 的
  V01–V25 报告，校验 migration/source fingerprint 与 staged dataset 一致、isolated payload 存在，
  再把报告 digest 写入 `MigrationRun.verificationReportDigestSha256` 并调用 persistence 原子 commit；
  失败报告保持 active pointer 不变。门禁机械测试中的 all-pass 报告明确是 synthetic override，不是
  V02/V23/V25 真实证据。
- 本轮新增 ADR-034、`MigrationFixedSamplingUseCase` 和 `MigrationRollbackDrillUseCase`：V23 按
  `sourceFingerprint` 固定种子生成 16 类样本并检查 source digest → active payload/archive 绑定；V25
  在新 persistence 实例中依次注入 stage/commit/rollback 失败，检查 active pointer、MigrationRun 和
  脱敏快照不变。证据必须显式传入 `MigrationVerificationUseCase`，缺失时 V23/V25 仍分别为
  `unverified`；synthetic evidence 只证明算法/事务边界，不授权激活。InMemory 与 Dexie 适配器均提供
  仅验收用 `failNextOperation`。
- 本轮新增 ADR-035、`MigrationStagedVerificationUseCase` 和浏览器入口：`stageV1Backup` 与设备入口
  统一保存 isolated domain slice；验证阶段从持久化 `MigrationRun/MigrationStagingDataset` 重读
  脱敏来源，重跑 Legacy Source Reader 和 domain slice 两次，要求 payload digest 与 staged digest
  一致后才生成 V01–V25 报告。`verifyStagedV1Migration` 只读，`activateStagedV1Migration` 与
  `rollbackStagedV1Migration` 仍是独立显式动作；旧的无 isolated payload staging 会得到
  `ISOLATED_DATASET_REQUIRED`，不会被静默激活。
- 迁移预览页同步更新为 Task015 文案，暂存成功后明确显示“逐域结果已进入隔离数据集、等待 V01–V25
  验证报告”，避免把 staging 误称为已完成业务迁移。
- 负责人批准使用 synthetic fixture 后，新增 `createApprovedSyntheticV1Backup()` 和 ADR-036；完整
  corpus 下的端到端测试通过 V01–V25、V23 固定抽样、V25 失败注入、activation commit 和 rollback，
  但明确标注为实现/事务边界验收，不替代真实用户 fixture。
- Task 016 新增 ADR-038 与版本化 `LearnerSettingsSchema`：本地 UserSettings 通过 Repository
  Port 持久化，首次打开进入语言/时长/重点/声音向导，已有设置可调整，旧 v1 来源只读检测不会写入
  迁移数据；今日课程读取语言和目标时长，并保留 `/migration-preview` 作为后续显式迁移入口。
- Task 016 新增 Launch/Onboarding 页面、Dexie/InMemory 设置适配器及应用层测试；英语选择会进入英语
  今日课程，保存失败会保留用户选择，页面控件满足键盘/标签/窄屏和 reduced-motion 基本要求。
- Task 017 已冻结为只读设置与数据安全页首个切片，见任务合同和 ADR-039；本轮不新增 Schema、数据库表、
  迁移写入或音频内容。
- Task 017 已实现 `/settings` 页面、今日页入口、设置摘要、v1 来源三态提示和迁移安全说明；新增路由
  组合测试与状态测试，页面不直接访问浏览器存储。
- 负责人已在 2026-07-28 使用 GitHub Pages 验收 Task 016/017：首次设置、刷新恢复、英语入口、设置摘要和旧版提示均无阻塞反馈。
- Task 018 已实现 `/content` 内容中心、今日/设置入口、当前语言摘要、搜索、level 筛选、空/错误状态与重试；本轮只复用 canonical repository，不新增内容 Schema、数据库表、用户词或音频能力。
- 负责人已在 2026-07-28 完成 Task 018 的 GitHub Pages 验收，内容摘要、搜索、level 筛选和空/错误状态无阻塞反馈。
- Task 019 已按 [TASK-019](../tasks/TASK-019-kana-tts-slice.md) 与 [ADR-041](../decisions/ADR-041-kana-tts-slice.md) 冻结并实现 `/kana`、10 个基础平假名、辨认/听辨模式、浏览器 Speech Synthesis adapter、不可用/关闭/失败回退和 Today 深链接；新增 10 项专项测试，`npm run verify` 已通过（49 个测试文件、196 个测试）。
- 负责人已在 2026-07-28 完成 Task 019 的 GitHub Pages 验收，10 个假名、辨认/听辨、浏览器支持/关闭/失败回退和今日页深链接无阻塞反馈。
- Task 020 已按 [TASK-020](../tasks/TASK-020-english-ipa.md) 与 [ADR-042](../decisions/ADR-042-english-ipa.md) 冻结并实现 `/ipa` 英语音标最小切片，并由负责人完成 Pages 验收；内容选择、双向辨认、错误/重试、语言提示、Today/内容中心深链接和路由组合测试已完成，不接入英语音频、AI 或学习事实持久化。
- 本轮 Task 020 的本地验证已通过：canonical 9,828 条、文档 87 份、51 个测试文件/204 个测试、生产构建与 Pages 构建均通过；`dist` 已验证 `/zhongri-v2/` 基路径。
- Task 021 已按 [TASK-021](../tasks/TASK-021-bilingual-loop-closeout.md) 与 [ADR-043](../decisions/ADR-043-bilingual-projection-preservation.md) 冻结并实现：当前语言投影精确替换，其他语言 ReviewState 保留；英语今日课程通过同一计划、作答、LearningEvent 持久化闭环。
- 全量并行验证时既有 synthetic migration 验收测试偶发超过 Vitest 默认 5 秒；已将该单测显式设为 15 秒，单独运行和全量运行均通过，不改变业务断言。

## 仍未完成

- Phase 1 双语、迁移和产品页面仍未全部完成。
- 负责人已使用真实 v1 数据完成手工测试并反馈无问题；原始备份和真实内容不入库，真实 report digest
  如需审计由负责人本地保留。仓库仍不把该手工结果伪装成可公开复现的真实 fixture。
- Task 016 已完成并由负责人在 GitHub Pages 验收。
- Task 017 已完成并由负责人在 GitHub Pages 验收。
- Task 018 代码已完成并推送，且已由负责人在 GitHub Pages 验收。
- 内容中心和完整数据安全操作（备份恢复、危险操作等）尚未实现；Task 017 目前只提供安全摘要入口。
- Task 019 代码已完成并推送，且已由负责人 Pages 验收。
- Task 020 代码已完成本地验证、推送到远端并由负责人 Pages 验收。
- Task 021 已完成本地实现与测试，尚未推送；负责人 Pages 双语切换/刷新/离线综合验收尚未开始。
- Phase 1 综合验收。

## 已验证命令

以下命令已在 Task 021 实现后通过（51 个测试文件、206 个测试）：

```bash
npm run verify
```

## 下一个 AI 的固定启动步骤

```bash
git status -sb
git log -5 --oneline
sed -n '1,240p' AGENTS.md
sed -n '1,240p' docs/development/HANDOFF.md
sed -n '1,260p' docs/TASKS.md
npm run verify
```

然后阅读当前 Task 合同、相关基线和 ADR。未在 `TASKS.md` 授权的业务能力不得提前实现。

## 下一项工作

1. 运行 `npm run verify`，更新交接记录并推送 `3ce1532`。
2. 负责人随后在 GitHub Pages 验收日语/英语切换、刷新恢复与离线闭环，再决定 Phase 1 是否收口。

## 交接规则

- 不要使用 `git reset --hard` 或覆盖未知用户改动。
- 发现工作区有不属于当前 Task 的修改时先停下并报告。
- 每次提交后更新本文件的分支、commit、状态和下一步。
- 任何未验证的猜测必须标为“待确认”，不能写入项目事实。

# AI 接手记录

本文件是跨 AI、跨会话的当前工作交接面。每次暂停、提交、合并或切换 Task 前必须更新。

## 当前快照

- 稳定基线：`main`（已包含 GOV-001 PR #22、Task 015 第一小步 PR #24、交接 PR #25、发布清理 PR #26、完整资产 PR #27、交接 PR #28、source snapshot PR #29、source adapter PR #31、交接 PR #32、canonical idMap PR #33、disposition report PR #34、Legacy Source Reader PR #35、交接 PR #36、核心域纵向切片 PR #37）
- 当前交接分支：`codex/task-015-core-domain-slice`
- 稳定基线提交：`6110f49`（PR #37 合并后的 main；核心域 isolated payload 与可选 staging 字段已进入稳定基线）
- 当前实现提交：`4a56cf8` + 工作树待提交（核心域 staging orchestration、统一 source preparation、ADR-020 和编排回归测试；核心域 transformer 已通过 PR #37 合并）
- 当前任务：Task 015 · v1 迁移逐域转换与 canonical 身份层
- 当前状态：完整 9,828 条 canonical corpus 已从固定 `jp-study` 提交导入，fail-closed 完整性门禁与全量测试已通过，脱敏 source snapshot contract、只读浏览器 source adapter、Port → snapshot 编排、source-aware staging、确定性 canonical/user idMap、统一 disposition/quarantine 报告、只读 Legacy Source Reader、Word/Override/Folder/Favorite 核心域纵向 transformer 和统一 staging orchestration 已完成；[Issue #23](https://github.com/ibka512/zhongri-v2/issues/23) 仍开放，真实脱敏 fixture、设备来源接线、剩余域和激活仍待完成
- 产品阶段：Phase 1 收口；Task 013 代码已合并，本地浏览器断网启动/恢复复测已完成
- 发布状态：PR #27、PR #28、PR #29、PR #31、PR #33、PR #34、PR #35、PR #37 均已通过 CI 并合并；下次发布前仍按固定启动步骤复查认证状态。

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

## 仍未完成

- Phase 1 双语、迁移和产品页面仍未完成。
- 真实 backup fixture、设备来源接线、Mastery/StudyRecord/FSRS 等剩余域、rawArchive/quarantine
  payload 存储、V01–V25 和激活/回滚仍未完成。
- 首次设置、内容中心、设置与数据安全页。
- 日语五十音/TTS、英语/IPA 双语纵向切片。
- Phase 1 综合验收。

## 已验证命令

以下命令已在本轮核心域纵向切片和治理文件完成后通过（35 个测试文件、148 个测试）：

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

1. 获取脱敏但字段形状真实的 v5+/v10、legacy v4 backup fixture，或记录负责人批准的 synthetic fixture 方案；再将 Browser source snapshot 中的设备来源记录接入 LegacyReader。
2. 将现有 staging orchestration 接入真实设备来源，再把冻结的 idMap 和 disposition 报告扩展到 Mastery/StudyRecord/FSRS 等逐域 transformer。
3. 在真实输入上实现 V01–V25 验证和激活/回滚。
4. 迁移 Task 通过后再继续首次设置、内容和双语基础切片；Phase 1 验收完成后才进入 AI Gateway（Issue #20）。

## 交接规则

- 不要使用 `git reset --hard` 或覆盖未知用户改动。
- 发现工作区有不属于当前 Task 的修改时先停下并报告。
- 每次提交后更新本文件的分支、commit、状态和下一步。
- 任何未验证的猜测必须标为“待确认”，不能写入项目事实。

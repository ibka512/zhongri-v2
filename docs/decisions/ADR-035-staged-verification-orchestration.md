# ADR-035：以持久化 staged payload 重建验证报告

## 状态

已接受（2026-07-27）

## 背景

`MigrationDomainSliceStagingUseCase` 已经可以把脱敏来源、Legacy Source Reader 和 isolated
domain slice 写入 staging，但如果验证阶段直接复用内存中的 `source/slice`，就无法证明持久化
数据集仍然与转换结果一致。激活门禁要求报告绑定 staged 数据，而不是绑定一次调用的临时对象。

## 决策

新增 `MigrationStagedVerificationUseCase`，作为 staging 与 activation gate 之间的唯一重建入口：

1. 从 `MigrationPersistencePort` 读取 `MigrationRun` 和 `MigrationStagingDataset`，要求数据集包含
   `isolatedDomainSlice`；旧的无 payload staging 只能继续回滚或重新 staging，不能生成激活报告。
2. 用持久化的脱敏来源文本和 run 的 `sourceFingerprint` 重新运行
   `Legacy Source Reader → MigrationDomainSliceUseCase`，并再次重放 domain slice。
3. 用 `MigrationDomainSliceResultSchema` 校验两次结果，要求两次 payload digest 都与已存 staged
   payload 一致；不一致时拒绝生成报告，不调用 persistence 写入。
4. 只把显式提供的 `MigrationSamplingEvidence` 和 `MigrationRollbackDrillEvidence` 传给
   `MigrationVerificationUseCase`。缺少证据时 V23/V25 仍为 `unverified`，不自动推断或伪造验收。
5. 浏览器 Application 入口 `verifyStagedV1Migration` 只负责加载完整 canonical repository 和
   生成报告；`activateStagedV1Migration` 与 `rollbackStagedV1Migration` 仍是独立显式动作。
   生成报告本身不会更新 active pointer。

## 影响与兼容性

- 现有 `MigrationStagingDataset.isolatedDomainSlice` 的可选兼容字段保持不变；旧 staging 会在新
  验证入口收到可解释的 `ISOLATED_DATASET_REQUIRED`，不会被静默激活。
- 正常浏览器 `stageV1Backup` 现在统一使用 domain-slice staging，因此新产生的备份 staging
  可直接进入重建验证；设备入口的 source snapshot 语义不变。
- 验证阶段仍是只读的，未改变 Word、ReviewState、FSRS、提醒或其他 active 业务表。
- 真实 v1 fixture、V02 双语复核和负责人批准的 V23/V25 证据仍是激活前置条件；synthetic 测试只
  证明重建、摘要绑定和错误边界。

## 验收证据

- `tests/application/migration-staged-verification.test.ts` 覆盖持久化 payload 重建、V23/V25
  显式证据接入和无 isolated payload 的拒绝路径。
- `npm run verify` 必须通过；激活仍需另行调用 `MigrationActivationUseCase`。

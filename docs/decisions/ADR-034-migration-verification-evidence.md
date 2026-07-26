# ADR-034：以固定抽样与失败注入证据完成 V23/V25 验收

## 状态

已接受（Task 015 进行中）

## 背景

V23 的抽样规则和 V25 的阶段失败注入已经在迁移规格中固定，但只有“报告仍为
`unverified`”不足以让下一位接手者快速生成可审计证据；把它们硬编码为通过又会把 synthetic fixture
误当成真实用户迁移结果。

## 决策

1. 新增 `MigrationFixedSamplingUseCase`：按 `sourceFingerprint` 作为固定种子，生成日语/英语内置词、
   override、用户词和每个关联域的固定样本；逐条检查 source digest 是否绑定到 active isolated
   payload 或对应 rawArchive/quarantine，并输出 `MigrationSamplingEvidenceSchema`。
2. 新增 `MigrationFailureInjectionPort` 与 `MigrationRollbackDrillUseCase`：在全新 persistence 实例
   上依次注入 stage、commit、rollback 失败，确认 active pointer、MigrationRun 状态和脱敏快照保持
   原子边界，并输出 `MigrationRollbackDrillEvidenceSchema`。InMemory 与 Dexie 适配器都提供仅验收用的
   `failNextOperation` 能力；产品流程不得调用它。
3. `MigrationVerificationUseCase` 只在调用方显式传入身份匹配且 schema-valid 的 V23/V25 证据时更新
   对应检查；缺少证据仍为 `unverified`。证据 digest 只绑定验证输入，不代表 fixture 已获负责人批准。
4. 真实/批准的 v1 fixture、双语 canonical corpus 和设备来源仍是生产验收前置条件；测试中的 synthetic
   evidence 只证明算法和事务边界，不授权激活。

## 影响

- 下一个 AI 可以使用同一组 application use case 复跑固定抽样和回滚演练，并把 digest 直接附在 V01–V25
  报告中。
- V23/V25 不再需要手工编辑报告；来源身份不匹配或任何阶段恢复失败会分别产生 failed/blocking 结果。
- 真实 fixture 到位前，activation gate 仍会被 V02 或其他未验证项阻断。

## 验证

- 固定抽样两次输出完全一致，并覆盖 16 个固定类别。
- InMemory 与 Dexie persistence 的 stage/commit/rollback 失败注入都不留下部分状态；演练可使 V25
  通过，但不会改变 V02 等其他检查。
- `npm run verify` 作为合并门禁；synthetic evidence 不作为迁移完成声明。

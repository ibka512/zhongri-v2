# ADR-031：以只验证的 V01–V25 报告阻断未完成迁移

## 状态

已接受（Task 015 进行中）

## 背景

此前 staging 会把 `validation` 固定为通过，无法区分 canonical 数量、外键、处置守恒、时间、幂等
和回滚证据是否真的存在。直接把这种占位状态用于 active 提交会把“生成了 isolated payload”误报成
“迁移已验收”。

## 决策

1. 新增 `MigrationVerificationUseCase` 和 `MigrationVerificationReportSchema`，固定生成 V01–V25
   顺序的检查记录，每项只能是 `passed`、`failed` 或 `unverified`。
2. 当前层先执行不写入的证据检查：canonical 总数/语言分布、逐域 source/disposition 守恒、isolated
   外键、主键唯一、时间字段、unknown 来源提示，以及可选的同输入重跑（V24）。
3. 提醒设置（V18）、固定抽样证据（V23）和 persistence 失败注入/active pointer 回滚（V25）在专属
   transformer、真实 fixture 或验收 harness 到位前保持 `unverified`；任一 blocking 项未通过时报告
   `passed:false`，不能作为激活授权。
4. 报告只绑定 sourceFingerprint、migrationId 和 isolated slice，不调用 persistence，不改变 active
   数据。后续 staging/activation 可把该报告作为显式输入，但本 ADR 不授权激活。

## 影响

- 迁移状态不再由占位 `validation: passed` 推断；未完成证据会显式阻断后续提交。
- 现有 synthetic fixture 可以验证稳定不变量，但不能冒充双语真实 corpus、提醒设置或回滚演练。
- V01–V25 的最终零失败仍需要真实/批准 fixture、独立 Reminder transformer 和 activation harness。

## 验证

- synthetic core slice 覆盖 V01、V03–V17、V19–V22、带 replay 的 V24；V02/V18/V23/V25 保持明确
  `unverified`。
- 含未知来源字段的 fixture 会让 V21 保持 `unverified`，不会伪造数量守恒。
- `npm run verify` 作为合并门禁；此报告不改变 `writesPerformed:false` 或 active pointer 边界。

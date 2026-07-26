# ADR-033：以 V01–V25 验证报告作为迁移激活门禁

## 状态

已接受（Task 015 进行中）

## 背景

`MigrationVerificationUseCase` 已能生成固定顺序的 V01–V25 报告，但此前 staging 的 `commit` 入口
仍可被直接调用。若调用方绕过报告，生成 isolated payload 就可能被误认为迁移已验收；报告也没有
在 `MigrationRun` 上留下可审计的绑定。

## 决策

1. 新增 `MigrationActivationUseCase` 作为正式激活入口。它先解析验证报告，要求 `passed=true` 且
   `blockingCheckIds` 为空，再检查 staged run、dataset、migrationId 和 sourceFingerprint 一致。
2. 只有包含 `isolatedDomainSlice` 的 staged dataset 才能通过门禁。通过后将验证报告 digest 写入
   `MigrationRun.verificationReportDigestSha256`，并调用既有 persistence 原子 commit 更新唯一
   active pointer。
3. 激活门禁不写 UserPreference、ReminderSetting、ReviewState、通知排程或其他业务表；它只绑定
   已隔离的数据集和 active pointer。commit/rollback 的事务失败语义继续由 persistence adapter 负责。
4. 当前测试中的 all-pass 报告是仅用于验证门禁机械流程的 synthetic override，不是 V02/V23/V25
   的迁移证据。真实激活必须使用真实/批准 fixture 产生的报告，不能修改检查状态绕过门禁。

## 影响

- 迁移调用方有单一、可审计的 activation API，直接调用底层 `commitMigration` 不再是产品流程。
- `MigrationRun` 能追溯激活所依据的验证报告 digest；重放和回滚仍保留 staged dataset 与 archive。
- 在真实双语 corpus、固定抽样和失败注入证据到位前，实际报告仍会被 V02/V23/V25 阻断。

## 验证

- 失败报告会返回 `VERIFICATION_FAILED`，active pointer 保持为空。
- 仅包含 isolated payload 且通过 schema 的报告才会提交；提交结果保存 verification digest 和 commit marker。
- `npm run verify` 作为合并门禁；真实 fixture 与 V01–V25 零未验证项仍是 Task 015 的后续验收。

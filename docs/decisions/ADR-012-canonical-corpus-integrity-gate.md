# ADR-012：以 canonical corpus 完整性门禁阻断不完整迁移

## 状态

已接受（Task 015 第一小步，2026-07-26）。

## 背景

迁移规格 V01/V02 要求 v2 内置 canonical 资产严格为 9,828 条，其中日语 5,906 条、英语
3,922 条。仓库当前只发布了 20 条真实 N5 日语词条，已有的单语言 Manifest 只能证明这
20 条资产自身的一致性，不能证明完整双语 corpus 已到位。

如果不在激活前固定目标并验证数量、语言分布、身份集合和内容摘要，迁移可能把部分词库
当成完整资产，进而让收藏、掌握、FSRS 或错题关系产生不可逆的错误关联。

## 决策

1. 新增 `CanonicalCorpusManifestSchema`，要求一个 corpus 同时声明 `ja` 和 `en` 的数量、
   总数量、身份摘要、内容摘要和来源元数据。
2. 把 V01/V02 的固定验收目标冻结为 `9,828 = 5,906 ja + 3,922 en`，由
   `canonicalCorpusV1AcceptanceTarget` 作为唯一代码常量导出。
3. `verifyCanonicalCorpusIntegrity` 在激活前检查重复的 `language:id`、总数量、语言分布、
   word ID SHA-256 和内容 SHA-256；传入验收目标时，Manifest 本身也必须与固定目标一致。
4. 任一检查失败只返回 `valid: false`，由上层迁移验证阶段阻断提交；本 ADR 不把当前 20 条
   词条扩充成伪造的完整 corpus，也不改变既有单语言内容 Repository 的行为。
5. 完整 canonical source、来源 commit/blob digest 和真实脱敏迁移 fixture 到位前，不得
   宣称 V01/V02 或完整 Phase 1 已通过。

## 后果

- 不完整或语言错误的资产会在迁移激活前明确失败，避免静默降级。
- 合成 fixture 仍可用于验证算法的结构和幂等性，但必须显式标记为测试数据，不能替代真实
  9,828 条资产的验收。
- 后续逐域 transformer、V01–V25 验证报告和 active pointer 提交必须复用这个门禁。

## 验证

- canonical corpus Schema 测试覆盖语言计数结构和总数守恒。
- 完整性测试覆盖匹配的双语合成 fixture、重复身份和 9,828 目标不满足时的 fail-closed
  结果。
- `npm run verify` 必须继续通过后才可进入下一步迁移实现。

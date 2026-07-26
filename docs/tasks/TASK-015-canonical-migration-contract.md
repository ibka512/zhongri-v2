# Task 015：v1 迁移逐域转换与 canonical 身份层

关联：[GitHub Issue #23](https://github.com/ibka512/zhongri-v2/issues/23)

## 已完成切片

本分支先完成迁移的输入契约和 fail-closed 完整性门禁：

- `CanonicalCorpusManifestSchema` 要求双语数量、总量、来源和两个 SHA-256 摘要。
- 固定 V01/V02 目标为 9,828 条（ja 5,906、en 3,922）。
- `verifyCanonicalCorpusIntegrity` 检查重复身份、数量、语言分布和摘要；目标不满足时不能
  进入激活阶段。
- 只使用合成 fixture 测试算法，不提交或伪造真实用户数据及完整词库。

第二小步已从固定的 `ibka512/jp-study@36c8129dfc364453198790b64687ff9105a3ecae` 导入真实
canonical corpus：日语 5,906 条、英语 3,922 条。资产映射、许可、字段覆盖和摘要见
[canonical corpus 导入记录](../content/CANONICAL_CORPUS_IMPORT.md)，实现决策见
[ADR-013](../decisions/ADR-013-full-canonical-corpus-import.md)。

## 后续范围

在真实 v1 backup fixture 到位后，继续实现：

1. v1 IndexedDB/localStorage 语义的只读 source snapshot 与敏感字段存在性摘要。
2. canonical idMap、Word/Override/Folder/Favorite/Mastery/StudyRecord/FSRS 等逐域转换。
3. 不可关联、损坏和重复记录的 quarantine/rawArchive 与可解释报告。
4. V01–V25 自动化验证、固定 sourceFingerprint 幂等复跑和 active pointer 原子提交/回滚。

## 前置条件

- 已固定的 9,828 canonical asset source、来源 manifest 和 SHA-256 清单已进入仓库。
- 脱敏但字段形状真实的现代 v5+/v10 与 legacy v4 backup fixture，或负责人明确批准的
  synthetic fixture 方案。
- 真实输入到位前，不得把 20 条 N5 日语词条描述为完整 corpus，不得激活迁移业务域。

## 明确不包含

- AI Gateway、模型 SDK、自由聊天或 AI 题目生成（Issue #20 保持阻塞）。
- 首次设置、设置/数据页、五十音/TTS、英语/IPA 内容切片。
- 旧 `word.srs` 活跃化、FSRS 重算或从汇总反造 LearningEvent。

## 第一小步验收

- Schema 拒绝缺失 `ja`/`en` 计数或不守恒的 Manifest。
- 匹配的双语合成 fixture 可通过完整性验证。
- 重复 `language:id`、数量/语言分布偏差、身份摘要或内容摘要不匹配时返回失败报告。
- 传入 9,828/5,906/3,922 验收目标时，当前 20 条资产明确 fail-closed。
- `npm run verify` 通过。

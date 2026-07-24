# ADR-009：以固定来源 Manifest 发布 canonical 内容身份

- 状态：已接受
- 日期：2026-07-24
- 对应任务：[Task 011](https://github.com/ibka512/zhongri-v2/issues/14)

## 背景

正式每日课程不能继续依赖三道 Mock Question。旧版 `jp-study` 已有 5,906 个日语词与
3,922 个英语词，收藏、掌握、FSRS、错题和迁移关系都依赖这些稳定 ID。若 v2 按数组位置
重新编号、按词头重新哈希或把同名词自动合并，既有关系会断裂，未来迁移也无法审计。

一次性搬入 9,828 词会把内容打包、许可、性能和课程选择混进同一个 Task。Task011 因此只
发布可供下一项正式课程使用的 20 个 N5 日语词条，但先冻结可扩展到全量资产的身份和来源
边界。

## 决策

1. canonical 身份为 `language + id`；语言必须显式为 `ja` 或 `en`。
2. `jp-study` 的 `_id` 原样保留。不得按数组位置、导入顺序或 v2 新哈希重新生成。
3. `CanonicalWord v1` 记录词头、读音/音标、词性、释义、等级、标签、数据版本和 Manifest
   引用；日语词必须有 reading。
4. `CanonicalManifest v1` 固定源仓库、commit SHA、分片路径、blob SHA、许可说明、词条数、
   排序后身份 SHA-256 和完整内容 SHA-256。
5. 静态适配器在构造时执行 Schema、语言、Manifest 引用和重复身份校验，并提供异步摘要
   完整性验证。
6. 身份解析先执行精确 `language + wordId`。ID 不存在时，唯一
   `language + NFKC/trim headword` 只能作为 candidate，不直接改写来源事实。
7. 同语言重名返回 ambiguous；同 ID 跨语言命中返回 language-conflict。不得自动合并。
8. 页面和未来课程不能直接读取资产模块，只能通过 `CanonicalContentRepositoryPort`。

## 影响

- Task012 可以使用真实 N5 内容建立正式每日课程，同时保持完全离线。
- 未来扩充日语/英语分片时沿用相同 Manifest 与完整性门禁，不改变课程依赖方向。
- 迁移可以复用同一身份仓储，但 Task011 不转换 userWords、Override 或关系域。
- 修改词条 ID 或内容必须显式更新 Manifest 摘要，并在代码审查中说明来源变化。

## 来源与许可

首批资产固定于 `ibka512/jp-study@36c8129dfc364453198790b64687ff9105a3ecae` 的
`wordbanks/ja-001.js`（blob `72ac88e5d7f893d46acab46b96f07ae22ea80356`）。
具体上游、版本与许可见 [第三方内容与许可](../content/THIRD_PARTY_CONTENT.md)。

## 当前不包含

- 全量 9,828 词、英语内容、运行时网络词库或自动同步。
- 用户词、BuiltInWordOverride、迁移 idMap、收藏或 FSRS 转换。
- 正式课程 UI、学习画像、AI Gateway 或 AI 私教。

## 验证

- Schema 测试覆盖固定来源、日语读音与重复标签。
- Repository 测试覆盖精确 ID、候选、歧义、跨语言冲突和重复身份。
- 完整性测试锁定 20 条数量、ID SHA-256 和完整内容 SHA-256。
- Format、Lint、TypeScript、Vitest、默认构建和 Pages 构建必须全部通过。

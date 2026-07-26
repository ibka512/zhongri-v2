# ADR-013：固定 jp-study 提交并导入完整 canonical corpus

## 状态

已接受（Task 015 第二小步，2026-07-26）。

## 背景

Task 015 第一小步已经冻结了 9,828 条资产的验收目标，但仓库当时只有 20 条日语 N5
词条。用户提供的 `ibka512/jp-study` 在固定提交中包含可复核的 `DefaultWords` 和
`DefaultEnglishWords` 分片，正好满足日语 5,906、英语 3,922 的数量与稳定 ID 要求。

## 决策

1. 固定 `jp-study@36c8129dfc364453198790b64687ff9105a3ecae`，保留源 `_id`，不重新编号。
2. 将源分片转换为 `src/content/canonical/assets/ja.json` 与 `en.json`，由
   `loadJpStudyCanonicalWords` 按语言动态加载，再通过 `StaticCanonicalCorpusContentRepository`
   访问；页面不直接导入资产文件。
3. 以 `jp-study-corpus-v1` Manifest 固定来源目录树 SHA-1、9,828/5,906/3,922 数量、
   身份 SHA-256 和内容 SHA-256。
4. 缺失等级归一化为 `UNSPECIFIED`，缺失 `dataVersion` 归一化为 1；当前 v1 Schema 未声明
   的 example、roots、folder、sourceLevels 等字段不进入 canonical 运行时对象，避免未经
   合同冻结的字段扩散。
5. PWA 以两种语言的动态 chunk 发布，Workbox 缓存上限提升到 5 MiB，保证离线加载完整
   corpus，同时不扩大入口 chunk。

## 后果

- V01/V02 的资产数量、语言分布、ID 唯一性和摘要现在有真实来源支撑。
- 全量词库会产生约 1.7 MiB 英语和 2.6 MiB 日语的压缩前动态 chunk；离线首次缓存成本增加，
  但入口 JS 不承载全部内容。
- 扩展字段仍需独立 Schema/资产任务；本 ADR 不实现用户迁移、override、FSRS 或关系域。

## 验证

- `npm run verify:canonical` 通过 9,828 条资产和两个摘要。
- Repository 测试覆盖全量加载、语言数量、精确 ID、跨语言冲突和摘要。
- `npm run verify`（含默认/Pages 构建）必须通过；构建保留大 chunk 的信息性 warning。

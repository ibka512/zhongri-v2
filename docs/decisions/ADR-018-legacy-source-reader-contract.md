# ADR-018：以只读 Legacy Source Reader 固定规范化来源记录边界

## 状态

已接受（Task 015 第七小步，2026-07-26）。

## 背景

source snapshot 和 staging 已经能保存脱敏的 v1 备份文本，但逐域 transformer 仍各自重新解析
JSON，容易出现域覆盖、数组顺序、未知字段和摘要算法不一致。Issue #23 允许在真实 fixture 到位
前先完成 reader skeleton 与 fail-closed checks，因此需要一个不触碰活跃数据的共同输入契约。

## 决策

1. 新增 `MigrationLegacySourceReaderUseCase`，只接受 staging 中的脱敏备份文本和既定
   `migrationId/sourceFingerprint`，输出 `MigrationLegacySourceSchema`。
2. 现代 v5+ 和 legacy v4 使用与现有预检一致的格式识别与元数据默认值；数组/对象域逐条生成
   可审计 `sourceRef`，未知字段单独标记为 `unknown`。
3. 递归稳定排序 JSON key，数组保留原顺序；`wordStorageVersion` 作为来源元数据保存，非法
   值作为未知记录保留，不能被误写入偏好域。
4. 每条记录的 digest 绑定 sourceRef、domain 和规范化值；报告同时保存输入文本摘要与规范化
   来源摘要，reader digest 排除空白和 key 顺序噪声。
5. 输入未脱敏、嵌套过深、类型无法安全序列化、来源引用过长或摘要适配器异常时直接拒绝；本
   用例不存储 payload、不生成 idMap、不写入 staging/active pointer。

## 兼容性与影响

- 新 Schema 是 Task 015 的新增应用层输出，不修改既有预检、source snapshot 或 staging 字段语义。
- 旧 staging 仍可按原入口使用；调用方可将 `MigrationStagingDataset.sanitizedSourceText` 与
  `MigrationRun` 元数据传入 reader。
- 真实浏览器 IndexedDB/localStorage 的读取和优先级仍由 ADR-015 约束；后续可在不改变 reader
  记录语义的前提下，把 snapshot 设备来源作为额外输入流接入。
- reader digest/record digest 是后续 idMap、disposition report 和 V24 幂等校验的来源摘要，
  但当前不表示任何业务域已经迁移。

## 验证

- modern v10 和 legacy v4 synthetic fixture 均能得到固定 metadata、域计数和排序 sourceRef。
- key 顺序/空白变化只改变原始文本摘要，不改变规范化来源、逐条记录和 reader digest。
- unknown 字段、已知域坏类型、raw secret、非法 JSON、过深嵌套和 digest 失败均 fail-closed 或
  进入明确的 unknown 记录，不静默丢弃。
- `npm run verify` 是合并门槛；真实 fixture、逐域 transformer、V01–V25 和激活回滚仍待后续切片。

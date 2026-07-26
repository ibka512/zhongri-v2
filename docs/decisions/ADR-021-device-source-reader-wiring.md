# ADR-021：显式设备来源选择并把 source snapshot 接入 Legacy Source Reader

## 状态

已接受（Task 015 第十小步，2026-07-27）。

## 背景

ADR-015 已经能够只读捕获 `keyval-store/keyval` 和 localStorage 的脱敏快照，ADR-020
也已经把备份文本接入 `Legacy Source Reader`。但此前快照只作为 staging 审计附件保存，
逐域转换仍然只读取所选备份文本，尚未复制 v1 运行时的“IndexedDB 非空值优先、
localStorage 回退”语义。

## 决策

1. `MigrationLegacySourceReaderInput` 增加显式 `sourceSelection`：
   - `backup`：只读取 `sanitizedSourceText`，保持原有备份恢复入口兼容；
   - `device`：必须绑定同一 `sourceFingerprint` 的 `MigrationSourceSnapshot`，当前设备快照
     才是业务来源，所选备份仅作为审计附件。
2. 设备来源在 Application 层投影为规范化的 modern v10 形状，不让 Legacy Source Reader
   读取浏览器 API。设备快照中的业务键按迁移规格映射到 `data.*`，localStorage 专用键进入
   `preferences`，安全快照/恢复点进入 `unknown` archive-only 记录。
3. 对同时存在于 IndexedDB 和 localStorage 且规范化值不同的键，固定选择 IndexedDB，并在
   `storageDivergences` 保存两侧 sourceRef、值摘要和选择结果；不隐式合并两份值。
4. 当分离词存储键存在时，`myWordDB_v3` 不进入活跃 `words` 输入，而作为 unknown 原始
   记录保留，避免旧混合词库与 `userWords_v1` 重复导入。
5. UI 的“创建安全暂存”继续是备份来源；新增的“读取当前设备并创建暂存”才使用
   `sourceSelection=device`。两条入口都只执行 stage，不提交 active pointer。

## 影响与边界

- `MigrationLegacySourceSchema` 新增 `sourceOrigin` 和 `storageDivergences`，旧备份结果
  默认 `sourceOrigin=backup`、空分歧列表，既有调用方保持兼容。
- 设备来源的 `sourceTextDigestSha256` 仍指向所选脱敏备份文本；
  `canonicalSourceDigestSha256` 指向实际设备投影，二者有意分开，便于审计“附件”和“生效来源”。
- 当前只完成设备来源读取、优先级和隔离 staging 接线；Mastery/StudyRecord/FSRS transformer、
  rawArchive/quarantine 实体 payload、V01–V25、active pointer 激活/回滚仍未完成。
- 本轮测试使用字段形状 synthetic source snapshot，不代表真实用户设备数据已经验收。

## 验证

- Reader 测试验证设备 sourceRef、分离词库旧 `myWordDB_v3` archive-only、IDB 优先和分歧摘要。
- Staging orchestration 测试验证 `sourceSnapshot → device reader → domain slice → staging`，
  active pointer 保持为空。
- `npm run verify` 是合并门槛。

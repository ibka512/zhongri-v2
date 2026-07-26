# ADR-029：以隔离 payload 保存安全偏好

## 状态

已接受（Task 015 进行中）

## 背景

v1 的备份偏好和设备 localStorage 偏好来源不同，且包含 API Key、提醒设置和动态筛选键。迁移必须先区分允许迁移的业务偏好、设备专用键和敏感信息，不能把未知键静默当作 v2 设置，也不能把 API Key 写入 active 数据。

## 决策

1. `MigrationDomainSliceUseCase` 只迁移规格白名单中的偏好（主题、语言、朗读/触感、排序、筛选和已脱敏提醒兼容键等），`wordbank_level_*`/`wordbank_difficulty_*` 按固定语言模式接受；未知偏好进入 `DOMAIN_NOT_IMPLEMENTED` quarantine。
2. `deepseekApiKey` 只保存 `[REDACTED]` serializedValue、`isSensitive:true` 与 `requiresSecretReentry:true`，不复制明文、不参与活跃 AI 配置。
3. 每个偏好键生成一个确定性 isolated target；重复来源标记 `deduped`，sourceRef 和 sourceRecordDigest 继续进入 disposition/rawArchive。
4. 偏好只进入 `isolatedPayload.preferences`，不会直接写 UserPreference、ReminderSetting、MigrationMetadata 或 active pointer；真实设置解释与最终提交由后续验证/激活阶段负责。

## 影响

- 备份和设备偏好现在有显式的允许/隔离边界，便于 V17/V18 逐键比较和安全审计。
- 该切片不会把 `postponeTested`、提醒权限或 API Key 推断成 v2 运行时状态；默认值/解释函数仍需真实 fixture 和产品设置契约确认。

## 验证

- synthetic core fixture 覆盖 `theme` 白名单偏好，生成隔离目标并计入数量守恒。
- Sensitive key 仍由 Legacy Source Reader fail-closed/脱敏边界保护；切片不调用 active persistence。

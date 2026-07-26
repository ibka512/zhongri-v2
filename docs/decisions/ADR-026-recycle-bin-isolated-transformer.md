# ADR-026：以隔离 payload 保存回收站项目

## 状态

已接受（Task 015 进行中）

## 背景

v1 的 `recycleBin` 保存已删除词条、会话或例句的 tombstone 与嵌套快照。回收站内容不能因为迁移而恢复到活跃 Word、AI 会话或学习统计，但仍必须可审计、可按原始过期时间复核。

## 决策

1. 每条回收项目生成一个确定性 `itemId`；优先保留 v1 `id`/`itemId`（包括数值 ID 的字符串化），缺失或超长时用来源引用和序列化值生成 `recycle-v1:*`，并标记 `ITEM_ID_GENERATED`。
2. `kind` 只接受 `word`、`conversation`、`example`；未知类型保存为 `unknown` 并标记 `KIND_UNKNOWN`，不根据 label 或 payload 猜测类型。
3. `deletedAt` 与 `expiresAt` 支持 ISO 字符串和 epoch 毫秒；非法值转为 `null` 并标记 `DATE_INVALID`。以 source exportDate 作为确定性迁移基准判断 `active`/`expired`；没有可用基准时标记 `RETENTION_UNDETERMINED`，不使用当前时间。
4. 词条/例句 payload 只尝试通过既有 identity map 关联 `resolvedTargetWordId`；无法关联仍保留回收项目并标记 `TARGET_UNRESOLVED`，绝不写回活跃 Word。完整原始项目继续通过 disposition 的 rawArchive 绑定保存。
5. 同一 `itemId` 的后续来源记录标记 `deduped`，不重复创建回收项目；所有结果进入 `isolatedPayload.recycleBin`，保持 `writesPerformed:false` 与 `activePointerUpdated:false`。

## 影响

- 迁移 staging 可以区分有效、已过期和无法判定保留状态的回收项目，但不会执行 restore 或 cleanup。
- 回收项目的嵌套 payload 仍以脱敏 serializedValue 作为审计边界；独立 archive 表、保留周期和最终激活仍由后续存储/验证任务负责。
- 真实 fixture 到位后需要复核 v1 `kind` 枚举、时间基准和嵌套 payload 的字段覆盖。

## 验证

- synthetic fixture 覆盖一个可解析 Word 目标的未过期回收项目；测试断言确定性 item ID、过期判定和 resolved target。
- 重复运行仍生成相同 payload、disposition 和 archive 引用，且不调用 active persistence。

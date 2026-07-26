# ADR-023：以确定性隔离 payload 保存 v1 组完成次数

## 状态

已接受（Task 015 第十二小步，2026-07-27）。

## 背景

`mtGroupClears_v3` 与 Mastery、StudyRecord 同属学习历史，但它的值是组完成次数，不是可重放的
逐词事件。此前 Legacy Source Reader 已经把每个组键读成 `groupProgress` source record，核心
transformer 为避免把未实现域伪装成已迁移而将其 quarantine。需要先固定一个不激活
`StudySession` 的隔离表示。

## 决策

1. 新增 `MigrationIsolatedGroupProgressSchema`，输出确定性 `groupProgressId`、规范化
   `groupKey`、非负整数 `completionCount`、source refs/digests、原始序列化值和质量标记，挂在
   `MigrationIsolatedPayload.groupProgress` 下；旧 payload 读取时该数组默认为空。
2. 组键按 NFKC/trim 规范化；空键 quarantine。合法非整数次数向下取整并标记
   `COUNT_FLOORED`；缺失、非有限或负数使用 0 并标记 `COUNT_DEFAULTED`，仍保留 raw，不用
   epoch 或其他猜测补值。
3. 同一规范化组键的重复来源只保留一个目标，计数取最大值而不是盲目相加，避免同一快照重复导入
   造成历史膨胀；后续来源标记 `deduped`，原始值仍进入隔离 payload。
4. 本切片不拆解历史组成员、不生成 StudySession/StudyEvent、不更新 active pointer，也不调用
   persistence。V01–V25 仍需在真实/批准 fixture 上完成后才允许激活。

## 影响与边界

- `MigrationIsolatedPayloadSchema` 增加向后兼容的 `groupProgress: []` 默认字段；现有四域和学习
  事实字段保持不变。
- 组完成次数仍只是可审计的聚合事实，不能被解释为每个词已完成或具体学习事件；成员集合依赖
  v1 当时的分组规则，继续由 raw/quality 边界说明。
- 当前 synthetic fixture 只验证字段形状、向下取整和无 active 写入；真实设备字段覆盖、实际
  rawArchive/quarantine 存储、wrongBook/AI/recycleBin/preferences、V01–V25 和激活/回滚未完成。

## 验证

- `tests/application/migration-domain-slice.test.ts` 验证 `2.5 → 2` 与 `COUNT_FLOORED`。
- `npm run verify` 作为合并门槛；本轮全量测试计数将在交接记录中更新。

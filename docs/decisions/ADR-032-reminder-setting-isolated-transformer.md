# ADR-032：以隔离 payload 保存提醒设置并保持权限未知

## 状态

已接受（Task 015 进行中）

## 背景

v1 通过 `nativeStudyReminderSettingsV2` 保存完整提醒设置，并用两个旧 localStorage 键兼容启用开关
和主提醒时间。系统通知实例和 Android 权限不属于可移植备份；如果直接把旧值写入 v2 active 设置，
可能在用户未授权时误排程通知。

## 决策

1. 新增 `MigrationIsolatedReminderSettingSchema`，只保存 default profile 的归一化设置：启用状态、
   smart/fixed 模式、到期/补救开关、主/补救时间、星期、免打扰、exact 请求和来源摘要。
2. `nativeStudyReminderSettingsV2` 对象优先；缺失或非对象时回退两个旧键。非法值使用规格默认值并
   标记 quality flag，星期去重排序；权限固定为 `unknown`，不复制系统排程实例。
3. 提醒设置只进入 `isolatedPayload.reminderSettings`，不写 UserPreference、ReminderSetting active 表、
   NotificationPort 或 active pointer。V18 只在来源全部映射到该隔离设置时通过。

## 影响

- V18 现在可以在设备/真实 fixture 提供提醒键时验证字段覆盖，同时保留权限重授和首次启动重排边界。
- synthetic fixture 没有提醒来源时仍保持 V18 `unverified`，不把缺失当成默认值已验收。
- 后续 activation 必须显式处理 `permissionState=unknown`，不能在迁移事务中调度通知。

## 验证

- synthetic reminder fixture 覆盖 V2 优先、旧键存在、星期去重、默认权限未知和 V18 通过条件。
- domain slice、verification report 和全量 `npm run verify` 作为合并门禁；active 写入保持关闭。

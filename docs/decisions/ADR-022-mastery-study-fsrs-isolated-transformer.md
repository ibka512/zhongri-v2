# ADR-022：以只读隔离 payload 转换 Mastery、StudyRecord 与 FSRS

## 状态

已接受（Task 015 第十一小步，2026-07-27）。

## 背景

ADR-019/020/021 已经把 v1 来源、canonical identity map、处置报告和设备来源接入了核心域
isolated staging，但 `mastery`、`studyRecords`、`fsrsCards`、`fsrsLogs` 仍然只停留在
Legacy Source Reader 的逐条记录层。若这些关系域各自重新猜测旧词 ID，会绕过已经冻结的
`language + rawWordId → targetWordId` 证据链；若直接调用 v2 FSRS scheduler，还会把历史状态
错误地当成新算法输入。

## 决策

1. 新增版本化的 `MigrationIsolatedMasterySchema`、`MigrationIsolatedStudyRecordSchema`、
   `MigrationIsolatedFsrsCardSchema` 和 `MigrationIsolatedFsrsLogSchema`，统一挂在现有
   `MigrationIsolatedPayloadSchema` 下。payload 只保存清洗后的可验证字段、原始序列化值、sourceRef
   和逐条 digest；仍固定 `writesPerformed:false`、`activePointerUpdated:false`。
2. Mastery 关系只通过已有 Word identity map 解析；日语 `kanji/kana/meaning` 映射到
   `spelling/reading/meaning`，英语 `kanji|word/kana/meaning` 映射到
   `spelling/listening/meaning`。缺失字段使用 `false` 并留下 `missingFields`，重复目标按
   Boolean OR 合并并将后续来源标记为 `deduped`；不根据 FSRS 或汇总数据推导 `needsReview`。
3. StudyRecord 只把 `daily_punch`、`pendulum` 映射为 `DAILY_PUNCH`、`GROUP_COMPLETED`；未知
   类型进入 `UNKNOWN` 并保留 raw。日期只生成 date-only，坏日期不补造时刻，原文和质量标记一并
   保留；相同 `eventType + dateOnly + groupLabel` 确定性去重。
4. FSRS 卡先于日志处理。卡键按 `language:rawWordId:dimension` 解析并经 identity map 重写，
   保存完整旧卡字段和 `algorithm='ts-fsrs@v1-adapter'`；关键数字/时间/关系损坏时整卡
   quarantine，缺失的非关键计数使用 0 并标质量标记。日志必须关联一张有效隔离卡，rating、
   review 时间或关系不合法时 quarantine；重复日志按规范化内容指纹去重。
5. 该切片不调用 `ReviewSchedulerPort`，不重算 FSRS，不把 mastery、reps 或错题总数反造为
   `LearningEvent`，也不实现 active dataset 写入。未在本切片内的 groupProgress、wrongBook、
   AI 和 recycleBin 业务记录继续保留为待后续域处理，当前不伪装成已迁移。

## 影响与边界

- 现有 Word/Override/Folder/Favorite payload 的字段保持兼容，只是在 isolated payload 增加四个
  数组；旧调用方由用例重新生成 payload 后自然获得空数组。
- 处置报告继续绑定同一 identity map digest；孤立关系使用确定性 quarantine 引用，重复记录保留
  canonical sourceRef。raw/quarantine 实体 payload 的物理存储仍由后续 staging 任务负责。
- 当前验证使用字段形状 synthetic fixture，不等于真实 v1 backup 字段覆盖已验收；V01–V25、
  active pointer 原子提交/回滚和真实设备 fixture 仍未完成。

## 验证

- 新增 synthetic fixture 覆盖 Mastery、date-only StudyRecord、完整 legacy FSRS card、重复日志、
  孤立卡和孤立日志。
- `npm run verify` 通过；全量测试 35 个文件、152 个测试，active pointer 保持为空。

# ADR-008：以隔离 staging 和单一 active pointer 提交迁移

- 状态：已接受
- 日期：2026-07-24
- 对应任务：[Task 010](https://github.com/ibka512/zhongri-v2/issues/12)

## 背景

Task009 可以识别备份并报告风险，但报告本身不能提供崩溃安全、幂等复跑或回滚。若后续逐域
迁移直接覆盖正式表，任何中途关闭、配额错误或验证失败都可能让新旧数据混合。迁移规格要求
先 snapshot/staging，验证通过后只切换一个 active 指针，失败时保持旧 active 数据。

## 决策

1. v1 迁移使用独立的 MigrationRun、MigrationStagingDataset 和
   ActiveMigrationDatasetPointer v1 契约。
2. `migrationId = v1-v2:<sourceFingerprint 前 24 hex>:spec-1`，datasetId 固定为
   `dataset:<migrationId>`；不得使用时间、随机数或运行顺序生成身份。
3. Application 在 staging 前重新计算原文件 SHA-256，并要求它与预检报告完全一致。
4. 旧 DeepSeek API Key 在任何持久化前递归替换为 `[REDACTED]`；来源指纹仍对应用户选择的
   原始文本，快照摘要对应脱敏文本。
5. staging 只保存脱敏来源、预检报告和摘要，不写 Word、ReviewCard、LearningEvent 等活跃
   业务域。
6. 同 migrationId 与相同摘要重复 staging 返回既有数据；内容不一致则拒绝，不静默覆盖。
7. 提交在单一事务内同时把 MigrationRun 标记为 COMPLETED，并切换唯一 active pointer 与
   commit marker。任何异常都保留事务前状态。
8. 回滚只把 active pointer 恢复为 priorActiveDatasetId，同时保留快照、报告和数据集。
9. 已回滚的同一输入可重新进入 staging；已完成且仍 active 的提交按幂等重放处理。
10. Web composition 复用同一 Dexie v3 实例，但学习表不参加迁移事务。

## 影响

- 后续 canonical、Word/Override、idMap 和关系域可以写入同一 isolated dataset，不需要各自
  发明提交与回滚机制。
- 用户明确创建 staging 后会占用本地存储，但当前学习进度和业务事实不会改变。
- active pointer 的切换能力已存在于 Port 和适配器，但 Task010 页面不提供业务激活操作；
  在完整逐域验证实现前不能把 staging 描述为已迁移。
- 原始含密钥文本只存在于文件读取过程的内存中，不进入 IndexedDB、报告或日志。

## 当前不包含

- canonical 9,828 词身份表、用户词确定性 ID 和任何逐域 Transformer。
- Word、Override、Folder、Favorite、Mastery、FSRS、错题、AI 或回收站激活。
- 从旧 origin 自动读取 IndexedDB/localStorage、空间预估、提醒重排或 v1 原始数据清理。
- 已产生新 v2 数据后的自动合并式回滚。

## 验证

- 内存与 Dexie 共享契约覆盖幂等 staging、提交、回滚、重启和数据集保留。
- 故障注入证明 commit/rollback 失败时 active pointer 与 MigrationRun 都保持原状态。
- Dexie 隔离测试证明 staging 不修改已有 LearningEvent。
- Application 测试覆盖来源变更、blocked 报告、密钥脱敏和确定性 migrationId。
- UI 测试证明 staging 必须显式触发，并明确不等于业务迁移完成。

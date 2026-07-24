# ADR-007：在任何数据写入前执行 v1 迁移预检

- 状态：已接受
- 日期：2026-07-24
- 对应任务：[Task 009](https://github.com/ibka512/zhongri-v2/issues/10)

## 背景

钟日 v1 存在现代 `zhongri-backup` v5+ 和旧 v4 JSON 两类备份。数据中可能出现重复词条
ID、同名多匹配、孤立 Override/FSRS 关系、过期回收站项、未知动态键和明文 DeepSeek API
密钥。若在识别这些风险前直接写入 v2，会把不确定关系激活为新的学习事实或调度状态，并让
失败恢复变得困难。

## 决策

1. 写入式迁移之前必须先运行独立、只读的 `MigrationPreviewUseCase`。
2. 当前预检支持现代 v5+ 和旧 v4 JSON，单文件最大 25 MB；其他格式在输入边界拒绝。
3. UI 只提交用户明确选择的文件内容。Application 通过 `TextDigestPort` 计算 SHA-256，
   Infrastructure 使用浏览器 `crypto.subtle` 实现。
4. 报告使用版本化 Zod Schema，并记录来源元数据、逐域分类、总计、问题、Q1–Q12 迁移
   假设和恒为 `false` 的 `writesPerformed`。
5. 每条来源数据必须恰好归入可迁移、跳过、冲突或错误；同类问题合并计数并最多保留三个
   样例引用。
6. 活跃 Word、Override 或 FSRS 无法唯一关联时属于 P0 阻断。可恢复的旧名称多匹配、未知
   字段或未覆盖域进入复核，不静默丢弃。
7. 旧 DeepSeek API 密钥只检测存在性并要求用户未来重新输入；密钥值不得进入报告、日志或
   页面。
8. Task009 不访问旧站点 IndexedDB，不写 v2 数据库，不激活 FSRS，也不提供“开始迁移”
   操作。

## 影响

- 用户可以先看到迁移规模、冲突和阻断原因，再决定是否修复旧数据或继续后续迁移。
- SHA-256 能标识报告对应的确切备份文本，但不代替备份真实性或内容签名。
- v4 来源天然缺少部分现代域，报告会明确标记覆盖限制。
- 正式迁移需要后续任务实现 staging、canonical ID 映射、验证、原子提交和回滚；预检报告
  可以作为其输入契约，但不能直接视为已迁移。

## 当前不包含

- 从旧域名自动读取 IndexedDB，或把设备原位升级与备份恢复自动合并。
- 写入、覆盖、删除、恢复点、回滚或 raw v1 数据保留周期的执行逻辑。
- FSRS ReviewState 激活、提醒、云同步、AI 对话恢复或 API 密钥存储。
- 对未知第三方 JSON 格式进行猜测性导入。

## 验证

- Application 测试覆盖现代 v10、旧 v4、无效 JSON、未知格式、超限文件、重复 ID、孤立
  FSRS 和 API 密钥脱敏。
- UI 测试覆盖成功报告、无导入操作和可恢复的原位错误。
- Schema 验证分类总数不变量、固定 12 项迁移假设和 `writesPerformed: false`。
- Format、Lint、TypeScript、Vitest、默认构建和 Pages 构建全部通过。

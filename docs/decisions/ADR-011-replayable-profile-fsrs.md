# ADR-011：以学习事实重放画像与 FSRS 复习状态

- 状态：已接受
- 日期：2026-07-25
- 对应任务：[Task 013](https://github.com/ibka512/zhongri-v2/issues/18)

## 背景

Task012 已让真实 canonical 词条产生可恢复的 LearningEvent，但每日课程仍只按日期轮转。
要在接入 AI 前形成个性化基础路径，系统需要从既有学习事实得到可解释的学习画像、长期复习
到期时间和稳定的 Today Plan 优先级，同时保持离线可用且不把第三方调度库泄漏到页面或
Application 契约。

## 决策

1. LearningEvent 继续作为唯一学习事实。`LearnerProfile v1` 与 `ReviewState v1` 是
   `projectionVersion: 1` 的派生投影，可从事件全量重放。
2. 第一版画像只包含现有事件能够证明的数据：答题/正确/错误次数、正确率、平均响应时间、
   最近仍答错的最多五个 canonical item，以及最近六次判定的粗粒度趋势。
3. 最近错误按“每个 item 的最新判定”计算；后来答对会移除该 item，避免永久错误标签。
4. 长期到期时间由官方 `ts-fsrs@5.4.1` 的 FSRS v6 生成。程序判定正确映射为 `Good`，
   错误映射为 `Again`；关闭 fuzz 和短期步骤以保证重放结果确定。
5. Application 只依赖 `ReviewSchedulerPort`。FSRS Card 字段只由 Infrastructure
   `FsrsReviewScheduler` 映射到版本化 `ReviewState`。
6. Dexie v4 增加 `learnerProfiles`、`reviewStates` 和 LearningEvent 的 `userId/itemId`
   索引。画像和该用户全部 ReviewState 在单一事务中整体替换；内存适配器遵守同一契约。
7. 每次打开今日课程时，从已知 canonical 身份的事件重放并持久化当前投影。计划只使用
   当地当天零点以前的事件，避免同一天作答导致正在进行的 Today Plan 改变。
8. Today Plan 依次选择当天结束前到期的复习词、最近仍答错的词，再按 Task012 日期轮转
   补足五词。计划 ID 加入最终词序指纹并升级为 `p2`，保证恢复身份与实际题目一致。

## 影响

- 用户无需账号、网络或 AI，即可得到基于真实答题记录的到期复习与薄弱词优先级。
- 删除画像和 ReviewState 后可从 LearningEvent 重建；投影失败不会产生半套状态。
- Task012 的 `p1` 会话不会被错误恢复到不同题目。升级后同一天首次打开会生成新的 `p2`
  会话；旧 LearningEvent 仍保留并参与后续投影。
- 当前没有旧 FSRS 状态迁移。未来如需导入 v1 FSRS 参数或训练个性化参数，必须单独冻结
  算法版本、迁移规则和回滚方案。

## 当前不包含

- AI Gateway、AI 私教、AI 生成题目或解释。
- FSRS 参数训练、用户可调保留率、短期步骤和旧版 FSRS 数据迁移。
- 提示/音频倾向、混淆组或技能掌握度；现有 LearningEvent 尚无足够证据。
- 完整词库、账号同步、通知和真实音频。

## 验证

- Schema 测试覆盖画像计数不变量、唯一 ReviewState 和 FSRS 字段范围。
- Scheduler 测试覆盖确定性、Good/Again 顺序和连续重放。
- Projector 测试覆盖乱序事件重放、最新判定、趋势、用户与 canonical 身份隔离。
- 内存/Dexie 共享契约测试覆盖投影整体替换、陈旧状态删除和无效输入回滚。
- Application/UI 测试覆盖优先级、稳定五词计划和诚实的无证据展示。
- Format、Lint、TypeScript、Vitest、默认构建和 Pages 构建必须全部通过。

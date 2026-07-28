# Task 021：Phase 1 双语学习闭环收口

## 目标

在 Task 020 完成后，验证日语和英语都能通过同一条今日课程引擎走完“计划—作答—LearningEvent—
画像/复习状态—下一次计划”，并修复切换学习语言时另一语言复习状态被清除的边界。这个任务收口
的是 Phase 1 的可离线学习闭环，不引入新的学习能力。

## 范围内

- 复用现有 `/today`、`DailyCourse`、`StudyUseCase`、`LearningEvent`、`LearningProjector` 和
  `ReviewSchedulerPort`，为英语补齐与日语等价的真实今日课程闭环测试。
- 在 Application/Composition 边界合并当前语言投影与其他语言已有的 ReviewState：当前语言的状态
  以本次完整重放结果为准，其他语言的状态保留；不改变事件、画像或 ReviewState Schema。
- 验证日语/英语各自的五词计划、选择题与输入题、正确/错误反馈、完成结果和持久化 LearningEvent。
- 验证语言切换后回到原语言时，原语言的复习状态仍在，且下一次计划仍能根据到期/近期错误排序。
- 验证现有刷新恢复、幂等提交、失败保留原进度和离线构建回归不被破坏。
- 更新 Phase 1 收口文档、交接记录和相关测试；复用现有设计 token、组件和今日课程 UI。

## 范围外

- 不新增 Question、LearningEvent、LearnerProfile、ReviewState、TodayPlan 或设置 Schema。
- 不修改 FSRS 算法、参数、调度版本或迁移旧 FSRS 状态；不激活 v1 迁移业务域。
- 不新增英语/日语页面、词库、音频、TTS、AI、账号、同步、通知或新的数据表。
- 不把两种语言合并为一个画像；画像仍按 `userId + language` 保存，事件仍是唯一学习事实。
- 不在页面直接访问 Dexie、IndexedDB、LocalStorage 或网络。

## 影响层

- Application/Composition：在创建今日课程并写入投影时，按当前语言 canonical item id 合并跨语言
  ReviewState；持久化适配器继续使用已有原子替换契约。
- Domain：不改动判题、LearningEvent 或 FSRS 规则，只通过现有 projector 生成当前语言投影。
- UI：不新增视觉结构；补充英语今日课程与双语切换的行为回归测试。
- Infrastructure：不新增表或浏览器能力；继续复用 InMemory/Dexie StudyPersistence Port。
- 文档：新增 ADR-043，并更新 `PROJECT_CONTEXT.md`、`TASKS.md`、`STATUS.md` 和 `HANDOFF.md`。

## 验收标准

1. 日语和英语设置下打开 `/today`，都能看到 5 个对应语言 canonical 词条，并通过同一套选择题/输入题 UI 完成课程。
2. 完成课程产生预期 LearningEvent；刷新/重新打开仍能恢复会话，重复提交不会产生重复事实。
3. 当前语言投影重建时，另一语言已有 ReviewState 不会被删除；切回另一语言后到期/近期错误优先级仍可用。
4. 当前语言旧 ReviewState 在完整重放后会被准确替换，不能保留已不存在的陈旧状态。
5. 失败写入不会暴露半套投影，既有 InMemory/Dexie 原子事务契约继续通过。
6. 页面继续满足移动端无横向滚动、键盘可达、触控目标不小于 44px、颜色不是唯一反馈和离线构建要求。
7. `npm run verify` 全部通过；Phase 1 收口记录明确 Task 021 的测试证据与剩余人工验收项。

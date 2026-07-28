# ADR-043：按语言边界保留双语复习投影

## 状态

已接受（2026-07-28，Task 021）

## 背景

Task 013 已建立可从 LearningEvent 重放的 LearnerProfile 与 FSRS ReviewState，Task 016 允许学习者
在日语和英语之间切换目标语言，Task 020 又补齐了英语内容入口。当前今日课程每次打开时只按当前
语言重放投影，然后通过 `replaceLearningProjection` 写入；Dexie 适配器的原子替换会删除该用户的
全部 ReviewState。这样切换语言不会丢失 LearningEvent，但会暂时清掉另一语言的复习状态，直到
再次切回并重放该语言事件，不能满足双语闭环的稳定保留要求。

## 决策

- 保持 `LearningProjection`、`ReviewState` 和 `LearningEvent` Schema 不变。画像仍按 `userId + language`
  保存，ReviewState 的 `itemId` 继续依赖 canonical language-scoped identity。
- 在 Application/Composition 层创建当前课程投影时，使用当前语言的 canonical item id 集合作为边界：
  当前语言的 ReviewState 全量替换为本次重放结果，集合外的其他语言 ReviewState 原样合并后再交给
  既有 `replaceLearningProjection` 原子写入。
- 不让页面、Persistence Adapter 或 FSRS 适配器自行猜测语言；语言边界由创建今日课程的组合根提供。
- 当前语言的 Profile 仍由 `projectLearningState` 从该语言事件重放生成；其他语言 Profile 由既有
  `userId + language` 主键保留，切换回来时重新验证/刷新。

## 影响

- 日语→英语→日语切换不会删除任一语言已经形成的复习状态；下一次计划仍可使用到期和近期错误证据。
- 持久化适配器的原子替换和失败回滚契约不变，避免新增迁移或数据库版本。
- 需要明确测试“当前语言陈旧状态被清除、其他语言状态被保留”，避免简单地把所有旧状态永久累积。

## 当前不包含

- 不改变 FSRS 算法、参数、调度版本或 ReviewState 字段。
- 不新增跨语言统一画像、跨语言排序、AI、迁移激活、音频或账号同步。

## 验证

1. Application 测试覆盖跨语言 ReviewState 合并和当前语言陈旧状态替换。
2. UI 测试覆盖英语今日课程五题闭环、LearningEvent 持久化和语言特定文本。
3. 既有 InMemory/Dexie persistence contract、刷新恢复和幂等测试继续通过。
4. `npm run verify` 通过后，再由负责人在 GitHub Pages 做日语/英语切换与离线复测。

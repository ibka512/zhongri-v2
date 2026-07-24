# 钟日 v2 架构边界

当前工程采用以下依赖方向：

```text
UI Layer
↓
Application Layer
↓
Domain Core
↓
Ports
↓
Infrastructure Adapters
```

## 当前各层职责

- **UI Layer**：页面、路由和展示组件，只负责呈现状态与收集用户输入。
- **Application Layer**：编排用例与事务边界，调用 Domain 和 Ports。
- **Domain Core**：纯 TypeScript 业务规则，不感知 React、浏览器或持久化实现。
- **Ports**：定义 Domain/Application 需要的外部能力接口。
- **Infrastructure Adapters**：实现持久化、网络和浏览器能力等 Ports。

## 强制规则

1. Domain 不依赖 React。
2. Domain 不依赖浏览器 API。
3. 页面不能直接访问数据库。
4. UI 组件不能直接调用 AI。
5. Zustand 不能保存业务事实。
6. 数据必须通过 Repository 访问。

Task004 首次在该依赖方向中加入纯 TypeScript Domain 判题和 Application 内存会话编排。
Task005 加入学习持久化 Ports，以及共享同一契约测试的内存/Dexie 适配器。
`/study-demo` 只消费 Application 快照，不直接执行业务规则或访问数据库。

## Task005 学习事务

一次答案提交按以下顺序执行：

1. Application 调用纯 Domain Judge 并创建 LearningEvent。
2. Application 构造 StudySessionCheckpoint v1 和请求指纹。
3. `LearningTransactionPort` 原子写入事件、Checkpoint 和幂等记录。
4. 事务成功后 QuestionFlow 才进入 feedback；失败时保持 answering。
5. 相同幂等键和指纹返回首次提交结果；相同键对应不同答案时拒绝。

Dexie 只存在于 Infrastructure。Domain、页面和 UI 组件不得 import Dexie。

当前仍不实现真实迁移、ReviewState、FSRS 或 AI。

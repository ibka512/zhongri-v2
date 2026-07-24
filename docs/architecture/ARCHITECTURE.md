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
Task006 加入版本化会话状态和恢复；Task008 加入按会话清除与重新开始用例。
Task009 加入只读迁移预检用例、来源摘要 Port 和版本化报告 Schema。
`/study-demo` 只消费 Application 快照，不直接执行业务规则或访问数据库。

## Task005 学习事务

一次答案提交按以下顺序执行：

1. Application 调用纯 Domain Judge 并创建 LearningEvent。
2. Application 构造 StudySessionCheckpoint v1 和请求指纹。
3. `LearningTransactionPort` 原子写入事件、Checkpoint 和幂等记录。
4. 事务成功后 QuestionFlow 才进入 feedback；失败时保持 answering。
5. 相同幂等键和指纹返回首次提交结果；相同键对应不同答案时拒绝。

Dexie 只存在于 Infrastructure。Domain、页面和 UI 组件不得 import Dexie。

## Task008 会话重新开始

1. UI 先要求用户显式确认，不直接清除数据。
2. Application 通过 `StudySessionRepositoryPort.clearSession(sessionId)` 发起重新开始。
3. Infrastructure 在单一事务中清除该会话的事件、检查点、状态和幂等记录。
4. 清除成功后 Application 创建全新的第一题会话；失败时原 `StudyUseCase` 和页面快照不变。
5. 清除边界不得提供无条件全库删除，也不得影响其他 `sessionId`。

## Task009 v1 迁移预检

1. UI 只把用户明确选择的 JSON 文本和文件元数据交给 Application。
2. Application 识别现代 v5+ 或旧 v4 格式，调用 `TextDigestPort` 计算 SHA-256。
3. Application 按域把每条来源数据分类为可迁移、跳过、冲突或错误，并聚合同类问题。
4. Zod 在返回 UI 前验证版本化报告、分类总数不变量和固定迁移假设。
5. UI 只呈现并导出报告；预检过程中 `writesPerformed` 恒为 `false`。

浏览器哈希能力只存在于 Infrastructure。旧 API 密钥只用于“需要重新输入”的存在性判断，
不得写入报告、日志或页面。活跃 Word/Override/FSRS 的孤立引用是 P0 阻断。

当前仍不实现迁移 staging、原子写入、回滚、ReviewState 激活、FSRS 调度或 AI。

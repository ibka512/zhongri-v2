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

当前 Phase 0 只冻结工程边界、数据契约和 UI 基础设施，不实现 Repository、AI、
数据库、FSRS 或学习业务。

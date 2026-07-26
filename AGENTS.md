# 钟日 v2 AI 开发规则

## 开始前必读

按顺序阅读：

1. `docs/development/HANDOFF.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/TASKS.md`
4. 当前 Task 对应的 `docs/tasks/` 合同
5. `docs/baseline/README.md` 与当前任务相关的基线文档
6. `docs/ROADMAP.md`
7. `docs/architecture/ARCHITECTURE.md`
8. 与任务相关的 `docs/decisions/` ADR

`ROADMAP.md` 只描述方向，不构成开发授权。只有 `TASKS.md` 中已由负责人定义的当前
Task 可以执行。

## 修改原则

- 修改前说明影响范围。
- 不跨架构层调用。
- 不随意新增依赖。
- 不改变已有 Schema 语义。
- 大改动拆分提交。
- 不自行开始未定义的 Task。
- 修改实现后同步更新受影响的知识库文档。
- 每次暂停、提交、合并或切换 Task 前更新 `docs/development/HANDOFF.md`。

## 开发流程

AI 修改代码前必须：

1. 阅读 `docs/PROJECT_CONTEXT.md` 和 `docs/TASKS.md`。
2. 阅读与当前修改相关的 ADR。
3. 确认修改属于 UI、Application、Domain、Ports 或 Infrastructure 中的哪个架构层。
4. 明确本次修改不包含的范围。

修改后必须运行：

```bash
npm run verify
```

`npm run verify` 已包含文档链接、格式、Lint、TypeScript、测试、默认构建和 Pages 构建。

## 禁止行为

- 创建职责不清的新大文件。
- 绕过 Repository Port 访问业务数据。
- 让组件直接调用 AI。
- 让页面直接操作 IndexedDB。
- 未经讨论新增依赖。
- 修改 Schema 却不更新 ADR、兼容性说明和测试。
- 从 `ROADMAP.md` 直接推断开发授权。

## 代码规则

- 使用 TypeScript strict。
- 优先保持简单。
- 不重复造轮子。
- 不生成无用抽象。
- 不为了未来需求提前复杂化。
- Domain 不依赖 React 或浏览器 API。
- 页面和 UI 组件不直接访问数据库、AI 或 FSRS。
- Zustand 不保存业务事实。
- 数据必须通过 Repository Port 访问。
- AI 输出必须先通过版本化 Schema 验证。

## 文档规则

- `PROJECT_CONTEXT.md` 保存当前项目事实。
- `TASKS.md` 是任务状态的唯一清单。
- 重要架构、Schema 和兼容性决策使用 ADR。
- 不把计划中的能力写成已经实现。
- 不伪造用户数据、历史指标或 GitHub 同步状态。
- 不把本机 Downloads、临时目录或聊天上下文作为项目唯一事实来源。

## AI 交接规则

- 当前事实以代码、测试和 `PROJECT_CONTEXT.md` 为准；产品目标以 `docs/baseline/` 为准。
- 当前授权以 `TASKS.md` 和对应 Task 合同为准；路线图只描述方向。
- 发现规范冲突时先记录并新增 ADR，不得静默选择。
- PR 必须说明影响范围、验证命令、剩余风险，并更新 HANDOFF。

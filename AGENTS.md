# 钟日 v2 AI 开发规则

## 开始前必读

按顺序阅读：

1. `docs/PROJECT_CONTEXT.md`
2. `docs/TASKS.md`
3. `docs/ROADMAP.md`
4. `docs/architecture/ARCHITECTURE.md`
5. 与任务相关的 `docs/decisions/` ADR

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

## 测试规则

修改后必须运行：

```bash
npm run format:check
npm run lint
npm run build
npm run test
```

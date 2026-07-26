# 开发与 AI 协作

## 环境

- Node.js 22 或更高版本。
- npm。
- React + TypeScript strict + Vite。

## 常用命令

```bash
npm install
npm run dev
npm run format:check
npm run lint
npm run test
npm run build
npm run build:pages
```

学习演示启动后访问 `/`，UI Lab 访问 `/#/ui-lab`。

## 修改流程

1. 阅读 `docs/development/HANDOFF.md`、`docs/PROJECT_CONTEXT.md` 和 `docs/TASKS.md`。
2. 阅读当前 Task 合同、相关基线和 ADR。
3. 说明修改范围、涉及层级和不包含的内容。
4. 检查工作区，保留无关的用户改动。
5. 只修改当前 Task 授权范围。
6. 运行 `npm run verify`。
7. 使用与任务一致的单一 Commit。
8. 更新受影响的项目文档和 HANDOFF。

## 依赖规则

- 不为“以后可能需要”新增依赖。
- UI 不直接依赖数据库、AI、FSRS 或基础设施实现。
- Domain 不依赖 React、DOM、IndexedDB 或网络。
- Schema 语义变更必须新增 ADR 并说明兼容与迁移影响。

## 文档规则

- `PROJECT_CONTEXT.md`：当前事实和 AI 首读上下文。
- `ROADMAP.md`：阶段方向，不构成开发授权。
- `TASKS.md`：唯一任务状态清单。
- `architecture/`：架构边界。
- `decisions/`：不可只靠代码解释的重要决策。
- `product/`、`design/`：冻结范围和实现索引。

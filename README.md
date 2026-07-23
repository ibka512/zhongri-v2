# 钟日 v2

面向中文母语者的 AI 个性化语言学习伙伴。

## 当前状态

Phase 0：工程初始化与契约冻结。

已完成：

- React + TypeScript strict + Vite 基础工程。
- Question、Judgement、LearningEvent v1 Schema。
- Design Token、Theme Provider、核心 UI 组件和 `/ui-lab`。
- 架构边界、ADR 和 AI 项目知识库。

尚未实现学习流程、数据库、AI、FSRS、词库或数据迁移。

## 开发状态

当前工作单元为 **Phase 0 - Task 003.5：GitHub 工程化增强**。

- Task 001：工程初始化，已完成。
- Task 002：核心 Schema 冻结，已完成。
- Task 003：UI Lab 与 Design System，已完成。
- Task 004：Application 层与第一个学习闭环，尚未开始。

详细状态见 [开发状态](./docs/development/STATUS.md)。

## 开发方式

- 使用 Issue 驱动开发，每个任务先明确背景、目标、不包含范围和验收标准。
- 使用小步 Commit，保持单一目标、可审查和可回滚。
- 使用 AI 辅助开发，但 AI 必须先阅读项目上下文、任务状态和相关 ADR。
- 路线图不构成开发授权，未定义的 Task 不提前实现。

## CI 状态

提交到 `main` 或创建 Pull Request 时，GitHub Actions 自动执行：

- 格式检查。
- ESLint。
- Vitest 测试。
- TypeScript 编译与 Vite 构建。

任一检查失败时，提交不应视为可交付状态。

## 项目知识库

建议按以下顺序阅读：

1. [项目上下文](./docs/PROJECT_CONTEXT.md)
2. [任务记录](./docs/TASKS.md)
3. [路线图](./docs/ROADMAP.md)
4. [架构边界](./docs/architecture/ARCHITECTURE.md)
5. [ADR 索引](./docs/decisions/README.md)

分类文档：

- [产品范围](./docs/product/PRODUCT_SCOPE.md)
- [Design System](./docs/design/DESIGN_SYSTEM.md)
- [开发与 AI 协作](./docs/development/DEVELOPMENT.md)
- [开发状态](./docs/development/STATUS.md)

## 本地运行

```bash
npm install
npm run dev
```

启动后访问：

- 初始化页：`/`
- UI Lab：`/ui-lab`

## 基础检查

```bash
npm run format:check
npm run build
npm run lint
npm run test
```

`vite-plugin-pwa` 已安装，但当前尚未启用完整 Service Worker 和离线业务逻辑。

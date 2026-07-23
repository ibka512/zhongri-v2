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

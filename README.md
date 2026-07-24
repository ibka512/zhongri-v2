# 钟日 v2

面向中文母语者的 AI 个性化语言学习伙伴。

## 当前状态

Phase 1：核心学习闭环技术验证。

已完成：

- React + TypeScript strict + Vite 基础工程。
- Question、Judgement、LearningEvent v1 Schema。
- Design Token、Theme Provider、核心 UI 组件和 `/ui-lab`。
- 架构边界、ADR 和 AI 项目知识库。
- 选择题 Domain Judge、Application QuestionFlow 和学习闭环技术演示。
- Task004 已由产品负责人验收。
- Task005 已完成幂等学习事务、Dexie 持久化和最小 PWA App Shell。
- Task006 已完成版本化会话状态和刷新恢复。

正在实施 Task007：GitHub Pages 开发预览部署。当前分支加入 Pages 子路径构建、
Hash 路由、PWA 路径校验和自动部署。

尚未实现正式学习首页、真实 v1 迁移、FSRS、AI、词库或真实音频。

## 开发状态

**Phase 1 - Task 007：GitHub Pages 开发预览部署** 正在实施。

- Task 001：工程初始化，已完成。
- Task 002：核心 Schema 冻结，已完成。
- Task 003：UI Lab 与 Design System，已完成。
- Task 003.5：GitHub 工程化增强，已完成。
- Task 004：Application 层与第一个学习闭环，已验收。
- Task 005：Ports、幂等事务、Dexie 与最小离线壳，已完成。
- Task 006：版本化会话状态与刷新恢复，已完成。
- Task 007：GitHub Pages 开发预览部署，实施中。

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

- 学习闭环技术演示：`/` 或 `/#/study-demo`
- UI Lab：`/#/ui-lab`

## GitHub Pages 开发预览

Task007 合并并完成首次 Pages 配置后访问：

- [钟日 v2 开发预览](https://ibka512.github.io/zhongri-v2/)
- UI Lab：`https://ibka512.github.io/zhongri-v2/#/ui-lab`

Pages 专用构建和本地生产预览：

```bash
npm run build:pages
npm run preview:pages
```

首次部署前，仓库所有者需要在 GitHub 的 `Settings → Pages → Build and deployment`
中把 Source 设置为 `GitHub Actions`。以后每次合并到 `main` 会自动更新预览站。

## 基础检查

```bash
npm run format:check
npm run build
npm run build:pages
npm run lint
npm run test
```

`vite-plugin-pwa` 已启用 App Shell 预缓存、导航回退和更新状态事件。`/study-demo`
会在 IndexedDB 保存学习会话；正式题库资源缓存仍属于后续任务。

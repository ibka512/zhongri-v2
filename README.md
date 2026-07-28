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
- Task007 已完成 GitHub Pages 开发预览部署。
- Task008 已完成学习会话重新开始与单会话原子清除。
- Task009 已完成 v1 备份只读迁移预检。
- Task010 已完成迁移安全暂存、原子 active 指针与回滚边界。
- Task011 已完成真实 N5 词条与 canonical 身份底座。
- Task012 已完成正式每日五词课程与可恢复混合题型闭环。
- Task016/017 已完成首次设置、设置与数据摘要，并由负责人在 GitHub Pages 验收。
- Task018 已完成内容中心只读切片，并由负责人在 GitHub Pages 验收。
- Task019 已完成日语五十音与浏览器朗读最小切片，并由负责人在 GitHub Pages 验收。
- Task020 已完成英语音标最小切片，并由负责人在 GitHub Pages 验收。

Task013 的代码实现已经合并，本地浏览器断网复测已通过，当前继续进行 Phase 1 收口。系统从
LearningEvent 重放画像与 ReviewState，网站根入口优先安排当天到期复习和最近仍答错的词，
再稳定补足五词。

当前工作项是 Task 021：Phase 1 双语学习闭环收口。Task 015（[Issue #23](https://github.com/ibka512/zhongri-v2/issues/23)）的 canonical corpus、迁移契约和负责人真实 v1 数据验收已完成；Task 016/017/018/019/020 已在 GitHub Pages 验收，Task 021 已实现并通过本地全量验证，待负责人 Pages 验收。GOV-001 已通过 [PR #22](https://github.com/ibka512/zhongri-v2/pull/22) 合并。

尚未实现真实 v1 逐域迁移与激活、AI、FSRS 参数训练或远程真实音频；Task 021 只处理双语复习投影保留和英语今日课程闭环，不新增 Schema 或 AI。

## 开发状态

**Task 021 - Phase 1 双语学习闭环收口已实现，待负责人验收；Task 016/017/018/019/020 已验收，Phase 1 收口继续进行。**

- Task 001：工程初始化，已完成。
- Task 002：核心 Schema 冻结，已完成。
- Task 003：UI Lab 与 Design System，已完成。
- Task 003.5：GitHub 工程化增强，已完成。
- Task 004：Application 层与第一个学习闭环，已验收。
- Task 005：Ports、幂等事务、Dexie 与最小离线壳，已完成。
- Task 006：版本化会话状态与刷新恢复，已完成。
- Task 007：GitHub Pages 开发预览部署，已完成。
- Task 008：学习会话重新开始与本地进度清除，已完成。
- Task 009：v1 备份迁移预检，已完成。
- Task 010：迁移 staging、原子提交与回滚边界，已完成。
- Task 011：真实日语词条与 canonical 身份底座，已完成。
- Task 012：正式每日课程纵向切片，已完成。
- GOV-001：仓库交接与基线治理，已通过 PR #22 合并。
- Task 015：v1 迁移逐域转换与 canonical 身份层，canonical 资产、source snapshot contract、只读 source adapter 与 staging 接线已导入，迁移转换实施中。
- Task 013：学习者画像与 FSRS 复习调度，代码已合并，浏览器断网验收通过。
- Task 016：首次设置与本地学习者目标，已由负责人在 GitHub Pages 验收。
- Task 017：设置与数据安全页入口，已由负责人在 GitHub Pages 验收。
- Task 018：内容中心首个只读切片，已由负责人在 GitHub Pages 验收。
- Task 019：日语五十音与浏览器 TTS 最小切片，已由负责人在 GitHub Pages 验收。
- Task 020：英语音标最小切片，已实现、通过本地全量验证并由负责人 Pages 验收。
- Task 021：Phase 1 双语学习闭环收口，已实现并通过本地全量验证，待负责人 Pages 验收。

详细状态见 [开发状态](./docs/development/STATUS.md) 和 [Phase 1 收口记录](./docs/development/PHASE1_CLOSEOUT.md)。

## 开发方式

- 使用 Issue 驱动开发，每个任务先明确背景、目标、不包含范围和验收标准。
- 使用小步 Commit，保持单一目标、可审查和可回滚。
- 使用 AI 辅助开发，但 AI 必须先阅读项目上下文、任务状态和相关 ADR。
- 路线图不构成开发授权，未定义的 Task 不提前实现。

## CI 状态

提交到 `main` 或创建 Pull Request 时，GitHub Actions 自动执行：

- 格式检查。
- 仓库内 Markdown 链接检查。
- ESLint。
- Vitest 测试。
- TypeScript 编译、Vite 默认构建与 Pages 构建。

任一检查失败时，提交不应视为可交付状态。

## 项目知识库

建议按以下顺序阅读：

1. [AI 接手记录](./docs/development/HANDOFF.md)
2. [项目上下文](./docs/PROJECT_CONTEXT.md)
3. [任务记录](./docs/TASKS.md)
4. 当前 Task 合同（见 [`docs/tasks/`](./docs/tasks/)）
5. [产品与迁移基线](./docs/baseline/README.md)
6. [路线图](./docs/ROADMAP.md)
7. [架构边界](./docs/architecture/ARCHITECTURE.md)
8. [ADR 索引](./docs/decisions/README.md)

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

- 正式每日课程：`/` 或 `/#/today`
- 内容中心：`/#/content`
- 五十音练习：`/#/kana`
- 英语音标练习：`/#/ipa`
- 学习闭环技术演示：`/#/study-demo`
- v1 备份迁移预检：`/#/migration-preview`
- UI Lab：`/#/ui-lab`

## GitHub Pages 开发预览

开发预览访问：

- [钟日 v2 开发预览](https://ibka512.github.io/zhongri-v2/)
- 迁移预检：`https://ibka512.github.io/zhongri-v2/#/migration-preview`
- UI Lab：`https://ibka512.github.io/zhongri-v2/#/ui-lab`

Pages 专用构建和本地生产预览：

```bash
npm run build:pages
npm run preview:pages
```

每次合并到 `main` 会通过 GitHub Actions 自动更新预览站。

## 基础检查

```bash
npm run format:check
npm run build
npm run build:pages
npm run lint
npm run test
```

`vite-plugin-pwa` 已启用 App Shell 预缓存、导航回退和更新状态事件。`/today`
会在 IndexedDB 保存正式每日课程，并可在二次确认后仅清除当日会话。
`/migration-preview` 先只读生成报告；只有用户明确创建安全暂存后，脱敏快照与报告才进入
IndexedDB 隔离数据集。Task010 不激活 Word、FSRS 或其他业务域。
Task011 的 20 个 N5 日语词条随构建离线发布；来源与许可见
[第三方内容与许可](./docs/content/THIRD_PARTY_CONTENT.md)。
Task012 的课程规则见
[ADR-010](./docs/decisions/ADR-010-deterministic-daily-course.md)。
Task013 的可重放画像与复习调度规则见
[ADR-011](./docs/decisions/ADR-011-replayable-profile-fsrs.md)。
Task013 的验收证据与 Phase 1 剩余交付见
[Phase 1 收口记录](./docs/development/PHASE1_CLOSEOUT.md)。

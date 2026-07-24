# 钟日 v2 项目上下文

> AI、开发者或维护者开始工作前，应先阅读本文件，再阅读 `ROADMAP.md`、
> `TASKS.md`、架构说明和相关 ADR。

## 项目定位

钟日 v2 是面向中文母语者的 AI 个性化语言学习伙伴，当前主要面向日语和英语学习。

它不是普通背单词 App、AI 聊天套壳或在线考试系统。长期核心闭环是：

```text
用户学习行为
↓
LearningEvent
↓
LearnerProfile 聚合
↓
FSRS 复习调度
↓
今日学习计划
↓
结构化题目
↓
固定 UI 作答
↓
新的学习事实
```

该闭环是产品方向，不表示相关模块已经实现。

## 当前阶段

当前进入 **Phase 1：核心学习闭环**。

仓库已经具备可维护的 React + TypeScript + Vite 基础、核心数据契约、UI Lab 和
GitHub 协作基础设施。**Task 004：第一个学习闭环技术验证** 已由产品负责人验收。
Task 012 已完成，当前实施 **Task 013：学习者画像与 FSRS 复习调度**。

## 已完成任务

- **Task 001**：建立 React + TypeScript strict + Vite 工程、架构目录、质量工具和 CI。
- **Task 002**：冻结 Question Schema v1、Judgement Schema v1、LearningEvent Schema v1。
- **Task 003**：建立 Design Token、Theme Provider、核心展示组件和 `/ui-lab`。
- **Task 003.5**：建立 GitHub Actions、Issue/PR 模板和开发状态文档。
- **Task 004**：建立选择题判题、内存 QuestionFlow、LearningEvent 生成和 `/study-demo`，已验收。
- **Task 005**：建立 Ports、幂等学习事务、内存/Dexie 适配器和基础 PWA App Shell。
- **Task 006**：建立版本化学习会话状态、下一题/完成持久化和刷新恢复。
- **Task 007**：建立 GitHub Pages 子路径构建、Hash 路由、产物校验和自动部署。
- **Task 008**：建立按会话原子清除、显式二次确认和失败后保留原进度。
- **Task 009**：建立 v5+/v4 备份识别、逐域预检、安全报告和迁移默认决策。
- **Task 010**：建立隔离 staging、确定性 migrationId、原子 active 指针与回滚边界。
- **Task 011**：建立首批真实 N5 词条、固定来源 Manifest 和 canonical 身份仓储。
- **Task 012**：建立正式每日五词计划、混合题型、结果页和可恢复纵向闭环。

准确提交记录见 [TASKS.md](./TASKS.md)。

## 架构原则

依赖方向：

```text
UI
↓
Application Use Cases
↓
Domain Core
↓
Ports
↓
Infrastructure Adapters
```

必须遵守：

1. Domain 使用纯 TypeScript，不依赖 React 或浏览器 API。
2. 页面和 UI 组件不直接访问数据库、AI 或 FSRS。
3. 数据通过 Repository Port 访问。
4. Zustand 只保存界面或短期会话状态，不保存业务事实。
5. Question、Judgement、LearningEvent 使用版本化 Schema，并在边界处经过 Zod 验证。
6. LearningEvent 是事实；LearnerProfile 是聚合；FSRS 是调度，三者不得混合。
7. AI 只能输出受约束的结构化数据，不能生成 UI 或直接修改学习事实。

完整说明见 [架构边界](./architecture/ARCHITECTURE.md) 和
[ADR-001](./decisions/ADR-001-schema-contracts.md)。

## 禁止事项

在负责人明确下达对应任务前，禁止：

- 修改 FSRS 算法版本、参数或接入未经独立任务授权的写入式数据迁移。
- 接入 AI API、模型 SDK、聊天界面或真实音频服务。
- 创建首页、词库、五十音、IPA、账号、同步、商业化或社区功能。
- 让组件直接调用外部能力或把业务事实写入 Zustand、LocalStorage。
- 修改既有 Schema 语义而不新增 ADR 和兼容性说明。
- 为未来需求提前创建空模块、无用抽象或新增依赖。
- 把 UI Lab 示例数据描述成真实用户历史。

## 当前任务

当前任务是 **Task 013：学习者画像与 FSRS 复习调度**。

范围包括 LearnerProfile v1、ReviewState v1、LearningEvent 全量重放、FSRS v6
Scheduler Port、Dexie v4 原子投影替换，以及 Today Plan 的到期复习/最近错误优先级。
当天计划只使用当地零点前的事件，保持同日稳定；不实现 AI 或未经事件证明的画像指标。

详细决策见 [ADR-011](./decisions/ADR-011-replayable-profile-fsrs.md)。

## 下一步路线

1. 完成 Task013 的代码审查、重放、移动端与离线验收。
2. Task014 才接入 AI Gateway，并只发送受控画像摘要。
3. AI 增强必须继续复用固定题目 UI 和真实 LearningEvent，不替代基础课程。
4. 完整迁移转换与 9,828 词扩容继续使用独立 Task，不阻塞核心学习纵向切片。

阶段路线见 [ROADMAP.md](./ROADMAP.md)。

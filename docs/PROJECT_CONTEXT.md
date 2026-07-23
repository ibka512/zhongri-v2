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

当前处于 **Phase 0：工程初始化与契约冻结**。

仓库已经具备可维护的 React + TypeScript + Vite 基础、三项核心数据契约和 UI Lab，
当前工作单元为 **Task 003.5：GitHub 工程化增强**，尚未进入学习业务实现。

## 已完成任务

- **Task 001**：建立 React + TypeScript strict + Vite 工程、架构目录、质量工具和 CI。
- **Task 002**：冻结 Question Schema v1、Judgement Schema v1、LearningEvent Schema v1。
- **Task 003**：建立 Design Token、Theme Provider、核心展示组件和 `/ui-lab`。

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

- 实现学习流程、数据库、Repository、FSRS 或数据迁移。
- 接入 AI API、模型 SDK、聊天界面或真实音频服务。
- 创建首页、词库、五十音、IPA、账号、同步、商业化或社区功能。
- 让组件直接调用外部能力或把业务事实写入 Zustand、LocalStorage。
- 修改既有 Schema 语义而不新增 ADR 和兼容性说明。
- 为未来需求提前创建空模块、无用抽象或新增依赖。
- 把 UI Lab 示例数据描述成真实用户历史。

## 当前任务

当前执行 **Task 003.5：GitHub 工程化增强**，范围仅包括 CI 核对、Issue 与 Pull
Request 模板、AI 协作规则和开发状态文档。

Task 003.5 不实现业务功能，不修改 Schema，不接入数据库、AI、FSRS 或学习引擎。

完成后等待产品负责人定义并确认 **Task 004** 的范围，不自行开始下一项业务开发。

## 下一步路线

1. 由产品负责人冻结 Task 004 的目标、边界和验收标准。
2. Task 004 必须继续采用单一纵向范围、小步提交和全量验证。
3. Phase 0 完成后才进入 Phase 1 核心学习闭环。
4. AI 增强属于 Phase 2；语音和高级能力属于 Phase 3。

阶段路线见 [ROADMAP.md](./ROADMAP.md)。

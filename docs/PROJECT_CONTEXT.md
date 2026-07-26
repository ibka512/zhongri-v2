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
Task 012 已完成，Task 013 的代码实现和本地浏览器断网复测已经完成，GOV-001 已通过 PR #22 合并，当前进行 Task 015 迁移契约与 Phase 1 收口验收。

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
- **Task 013**：完成 LearnerProfile v1、ReviewState v1、可重放投影、FSRS v6 和 Today Plan 优先级的代码实现。
- **GOV-001**：通过 PR #22 纳入产品基线、任务授权、验收证据和跨 AI 交接治理。

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

当前任务是 **Task 015：v1 迁移逐域转换与 canonical 身份层**（[Issue #23](https://github.com/ibka512/zhongri-v2/issues/23)）；完整 9,828 条 canonical corpus 已从固定 `jp-study` 提交导入，Task 013 已完成代码实现与本地浏览器断网复测，GOV-001 已合并，负责人已使用真实 v1 数据在 GitHub Pages 完成手工验收并反馈无问题。

当前 Task 已完成 canonical corpus Schema、固定 9,828/5,906/3,922 目标、真实资产导入、fail-closed 完整性验证、脱敏 source snapshot contract、只读浏览器 source adapter、source-aware staging、确定性 canonical idMap、统一 disposition/quarantine 报告、只读 Legacy Source Reader、显式设备来源选择与 IDB/localStorage 分歧报告、Word/Override/Folder/Favorite/Mastery/StudyRecord/GroupProgress/WrongBook/RecycleBin/AIConversation/AIQuizHistory/Preference/ReminderSetting/FSRS isolated 纵向转换、inline archive payload、独立 migrationArchives 存储、只验证的 V01–V25 报告、统一 staging orchestration、持久化 staged payload 重建验证、显式 activation gate、V23 固定抽样证据入口、V25 失败注入演练入口、负责人批准 synthetic fixture 的端到端 activation/rollback 验收和负责人真实 v1 数据手工验收；真实备份不入库，下一步转入 Phase 1 产品功能收尾，不修改 FSRS 参数或接入 AI。

Task 013 的实现与决策见 [ADR-011](./decisions/ADR-011-replayable-profile-fsrs.md)，其验收证据见 [Phase 1 收口记录](./development/PHASE1_CLOSEOUT.md)。

## 下一步路线

1. 将负责人真实 v1 数据手工验收作为不入库的产品验收记录，保留真实备份和必要报告在负责人本地。
2. 为首次设置/数据页、五十音/TTS 和英语/IPA 切片分别定义并授权 Task。
3. 完成 Phase 1 的双语核心闭环验收，之后再接入 AI Gateway（Issue #20）。

详细验收证据见 [Phase 1 收口记录](./development/PHASE1_CLOSEOUT.md)。

阶段路线见 [ROADMAP.md](./ROADMAP.md)。

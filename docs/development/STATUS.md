# 钟日 v2 开发状态

本文件记录当前工程阶段。详细任务状态以 [`docs/TASKS.md`](../TASKS.md) 为准。

## 已完成

- **Task 001**：React + TypeScript strict + Vite 工程初始化。
- **Task 002**：Question、Judgement、LearningEvent v1 Schema 冻结。
- **Task 003**：UI Lab 与 Design System 实现。
- **Task 003.5**：GitHub 工程化增强。
- **Task 004**：Application 层与第一个学习闭环技术验证，已由产品负责人验收。
- **Task 005**：Ports、幂等事务、Dexie 与最小离线 App Shell。
- **Task 006**：版本化学习会话状态、下一题/完成持久化和刷新恢复。
- **Task 007**：GitHub Pages 子路径构建、产物校验和自动部署。
- **Task 008**：按会话原子清除、显式二次确认和失败后保留原进度。
- **Task 009**：v5+/v4 备份只读预检、逐域报告和安全导出。
- **Task 010**：隔离迁移暂存、原子 active 指针和回滚边界。
- **Task 011**：20 个真实 N5 词条、固定来源 Manifest 与 canonical 身份仓储。
- **Task 012**：正式每日五词课程、混合题型和可恢复纵向闭环。
- **Task 013**：LearnerProfile v1、ReviewState v1、可重放投影、FSRS v6 和 Today Plan 优先级，代码已合并。
- **Task 016**：首次设置与本地学习者目标，已由负责人在 GitHub Pages 验收。
- **Task 017**：设置与数据安全页入口，已由负责人在 GitHub Pages 验收。
- **Task 018**：内容中心首个只读切片，已由负责人在 GitHub Pages 验收。
- **Task 019**：日语五十音与浏览器 TTS 最小切片，已由负责人在 GitHub Pages 验收。
- **Task 020**：英语音标最小切片，已由负责人在 GitHub Pages 验收。

## 当前

- **Task 021：Phase 1 双语学习闭环收口** 已实现并通过全量验证，待负责人 Pages 验收。Task 015（[Issue #23](https://github.com/ibka512/zhongri-v2/issues/23)）已完成负责人真实 v1 数据验收，Task 016/017/018/019/020 已完成负责人 Pages 验收。
- Task 015 已完成 canonical corpus Schema、9,828/5,906/3,922 目标声明、真实资产导入、完整性验证、脱敏 source snapshot contract、只读浏览器 source adapter、source-aware staging 接线、确定性 canonical/user idMap 和统一 disposition/quarantine 报告契约；真实备份不入库，完整产品级备份恢复操作仍未实现。
- LearnerProfile v1 与 ReviewState v1 从 LearningEvent 全量重放，不创建第二份学习事实。
- 官方 `ts-fsrs` 的 FSRS v6 只负责长期到期时间，并通过 ReviewScheduler Port 隔离。
- Today Plan 优先当天到期复习、最近仍答错的词，再稳定补足五个基础词。
- 首页只显示真实到期数、薄弱词和历史正确率；无历史时明确展示空状态。
- 当前仍不包含用户词库管理、AI、远程真实音频、FSRS 参数训练或旧 FSRS 迁移；Task 019 的基础平假名/TTS 与 Task 020 的 canonical 英语 IPA 已验收，Task 021 正在收口双语今日课程与复习投影保留。

## 下一步

- 获取并固定脱敏 v5+/v10、legacy v4 fixture；在缺少输入时保持 fail-closed。
- 在 Task 015 内取得真实 fixture，将冻结 idMap 和 disposition 报告接入逐域转换，再实现隔离 payload、V01–V25 可执行验证和激活/回滚演练。
- Task 021 Pages 验收通过后完成 Phase 1 双语闭环总结，再进入 AI Gateway。
- Phase 1 验收后，才在已验证画像摘要之上建立 AI Gateway；基础课程仍保持可离线完成。

验收证据与剩余交付见 [Phase 1 收口记录](./PHASE1_CLOSEOUT.md)。

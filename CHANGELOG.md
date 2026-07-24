# Changelog

## Unreleased

- 新增 StudySessionCheckpoint v1、学习持久化 Ports 和 ADR-003。
- 新增内存与 Dexie 幂等学习事务适配器。
- StudyUseCase 在持久化成功后才进入反馈状态，失败时保留当前题目。
- 启用最小 PWA manifest、App Shell 预缓存、离线导航和更新状态事件。
- 新增版本化学习会话状态和刷新恢复。
- 新增 GitHub Pages 子路径构建、产物校验与自动部署工作流。
- 新增学习会话重新开始用例、单会话原子清除和显式二次确认。
- 清除失败时保留当前持久化数据和可见学习进度，并提供原位重试提示。
- 新增现代 v5+ 与旧 v4 钟日备份的只读迁移预检和 SHA-256 来源指纹。
- 新增按数据域分类的版本化迁移报告、阻断/复核提示与安全 JSON 导出。
- 预检不写入数据库，不回显旧 DeepSeek API 密钥，并聚合同类问题以支持大型备份。
- 新增版本化迁移运行、隔离数据集与 active migration dataset 指针契约。
- 新增内存和 Dexie v3 迁移适配器，支持幂等 staging、原子提交和回滚。
- 迁移页面新增显式“创建安全暂存”，写入前脱敏旧 API Key，且不激活任何业务数据。
- 新增 CanonicalWord/CanonicalManifest v1、20 个真实日语 N5 词条与固定来源清单。
- 新增静态 canonical 内容仓储、语言域身份解析和 ID/内容双 SHA-256 完整性校验。
- 新增 TodayPlan v1、每日五词确定性课程编排与选择/文本混合判题。
- 网站根路由进入正式今日课程，支持计划、答题、反馈、结果与刷新恢复。
- 新增 LearnerProfile v1、ReviewState v1 与可重放 LearningProjector。
- 接入官方 `ts-fsrs` FSRS v6，通过 ReviewScheduler Port 隔离长期复习调度。
- Dexie 升级到 v4，原子替换一个用户的画像和全部复习状态。
- Today Plan 优先当天到期复习和最近仍答错的词，再稳定补足五个基础词。
- 今日计划首页展示真实到期数、薄弱词与历史正确率，无证据时显示诚实空状态。

## 0.1.0

初始化项目。

包含：

- React + TypeScript + Vite
- 基础目录
- 开发规范

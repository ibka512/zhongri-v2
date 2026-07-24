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

## 0.1.0

初始化项目。

包含：

- React + TypeScript + Vite
- 基础目录
- 开发规范

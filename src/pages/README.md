# Pages

页面组合层。当前包含学习技术演示和内部开发验收页面：

- `/#/study-demo`：可恢复的本地学习会话演示。
- `/#/migration-preview`：先只读分析 v1 JSON；用户确认后可创建脱敏隔离 staging。
- `/#/ui-lab`：Design Token、组件状态、主题、触控、无障碍与动效检查面。

UI Lab 不包含学习流程、数据库、AI 调用或业务事实写入。迁移页面只调用 Application
用例，不直接访问 Infrastructure；staging 不激活业务事实。

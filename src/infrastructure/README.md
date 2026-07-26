# Infrastructure

实现 Ports 的浏览器和静态资源适配器：

- `study/`：内存与 Dexie 学习事务、会话恢复和清除。
- `migration/`：内存迁移 staging、提交、回滚，以及只读 v1 浏览器 source adapter。
- `content/`：固定来源 canonical 内容加载、身份索引和完整性校验。
- `system/`：浏览器时钟、ID 和 SHA-256。

`BrowserV1SourceStorage` 只读取既有 `keyval-store/keyval` 和 localStorage；它不得创建或写入
v1 数据。Infrastructure 不得被页面直接 import；AI、同步和真实音频仍未实现。

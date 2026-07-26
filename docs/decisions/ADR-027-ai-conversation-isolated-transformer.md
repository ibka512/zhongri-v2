# ADR-027：以隔离 payload 保存 AI 会话历史

## 状态

已接受（Task 015 进行中）

## 背景

v1 `aiConversations` 记录了词句上下文、展示日期、缓存键、系统提示词、预设和有序消息。旧日期可能没有可靠时区，消息 role 也可能来自未来版本；这些内容可以审计和展示，但不能在迁移时重新触发 AI 请求或自动创建 v2 活跃会话。

## 决策

1. 会话使用 `cacheKey` 优先、其次旧 `id`、最后来源内容指纹作为去重种子；输出确定性 `conversation-v1:*`，同时保留 `legacyId`。
2. `dateText` 原文保留；只有可解析时间才写 `updatedAt`，非法值标记 `DATE_INVALID`，不使用迁移时间补造。
3. 缺失/非法语言按 v1 兼容规则投影为 `ja` 并标记 `LANGUAGE_DEFAULTED`；Word 关联只消费既有 identity map，无法解析仍保留会话并标记 `TARGET_UNRESOLVED`。
4. 消息保持源顺序，role 白名单为 `user`、`assistant`、`system`，未知 role 投影为 `unknown` 并保留该消息的 serializedValue；缺失或过长内容标记质量问题，消息最多 1,000 条。
5. 同一去重键的重复会话选择消息更完整、systemPrompt 更长的记录，并合并来源、摘要、质量标记和原始序列化值；后续来源标记 `deduped`。
6. 会话结果只进入 `isolatedPayload.aiConversations`，所有 rawArchive/quarantine 仍由 disposition/inline archives 绑定；不调用 AI、Persistence 或 active pointer。

## 影响

- staging 能离线复核 AI 会话历史和未知消息 role，但不代表 AIConversation 已激活，也不迁移 provider/API Key。
- `aiQuizHistory` 仍是下一条独立切片；真实 fixture 到位后需要复核消息字段别名、日期语义和 cacheKey 去重覆盖。

## 验证

- synthetic fixture 覆盖带词条关联、系统提示词和 user/assistant 消息的会话。
- 重复运行保持 conversation ID、消息顺序、disposition 与 archive 引用确定性。

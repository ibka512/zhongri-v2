# ADR-040：以 canonical repository 驱动内容中心只读首个切片

## 状态

已接受（2026-07-28，Task 018）

## 背景

Task 016/017 已完成并由负责人验收，用户可以设置目标并查看数据安全摘要，但还不能确认当前
语言实际使用的内容规模，也没有独立的词库浏览入口。仓库已经拥有经过完整性门禁的日语/英语
canonical corpus；下一步应先复用这份稳定资产建立可离线浏览的内容入口，再分别授权五十音、TTS
和英语/IPA 练习能力。

## 决策

- 新增 `/content` 作为只读内容中心，页面只消费 composition root 注入的 `loadUserSettings` 与
  `loadCanonicalContent`。
- 当前语言来自已保存的 `LearnerSettings.language`；无设置时沿用现有今日课程的 `ja` 默认值，
  页面明确提示用户可进入首次设置修改。
- 词条搜索与 level 筛选在已加载的当前语言数组上执行，并用 `useMemo` 保持重复渲染稳定；只渲染
  前 50 条结果，避免把完整 corpus 一次性挂到 DOM。
- 内容版本、总量和来源摘要来自 `CanonicalContentRepositoryPort.getManifest()`；页面不重新计算、
  修改或复制 canonical ID/顺序，也不创建用户词记录。
- 内容加载失败只影响本页，提供重试；页面不直接调用浏览器存储、网络、TTS 或迁移写入用例。

## 影响

- 内容中心成为今日学习与设置之间的稳定只读入口，并为后续词条详情、五十音/IPA 和音频切片保留
  深链接。
- 任何编辑、收藏、用户导入、掌握状态、批量操作或虚拟化列表都必须通过独立 Task/ADR 决定持久化
  边界和性能策略。
- canonical corpus 仍由既有完整性门禁保护，页面不降低 9,828 条资产的发布要求。

## 验收

1. 日语/英语与无设置三种入口状态均有可解释页面。
2. 搜索、level 筛选、空结果、加载失败和重试行为有 UI 测试覆盖。
3. 路由 composition 测试证明页面通过 callbacks 访问设置和内容 repository。
4. `npm run verify` 通过。

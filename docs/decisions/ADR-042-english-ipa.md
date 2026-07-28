# ADR-042：以 canonical 英语词条承载音标最小切片

## 状态

已接受（2026-07-28，Task 020）

## 背景

Task 019 已由负责人在 GitHub Pages 验收，日语基础假名和浏览器朗读有了可离线复测入口。Phase 1
还缺少英语侧的文字发音入口。仓库已有经过完整性门禁的 3,922 条英语 canonical 词条，每条词条
包含可选 `phonetic` 字段；下一步应先验证真实资产、IPA 展示和词形/音标辨认的 UI 边界，不接入
英语 TTS 或新的学习事实写入。

## 决策

- 新增 `/ipa` 页面，固定使用 10 个已知英语 canonical 词条 id 作为首批内容。页面从
  `CanonicalContentRepositoryPort.listByLanguage('en')` 读取真实词条，并在选择 helper 中 fail-closed：
  缺少词条、音标或必要字段时返回错误，不用占位文本伪造内容。
- 页面提供“看音标选词形”和“看词形选音标”两种当前会话练习模式。候选、反馈、进度和模式只存在
  React 页面状态，刷新即重置，不创建 LearningEvent，不接入 LearnerProfile/FSRS。
- 当前本地学习语言只用于提示，不阻止英语入口；语言修改统一回到现有首次设置路由，不在 `/ipa`
  内复制设置写入逻辑。
- 复用既有设计 token、Button、Card、Progress 和 canonical repository；不新增 schema、数据库、
  音频 adapter、网络请求、外部依赖或 AI。

## 影响

- 英语侧有了可离线、可深链接、可验收的 IPA 入口，但当前切片只能证明内容展示与文字辨认，不能
  证明发音质量、口语能力或长期掌握效果。
- 固定首批词条 id 将 canonical 资产变更风险暴露为可测试错误；若未来更换内容版本，必须更新
  helper 测试和对应 ADR，不静默回退到其他词条。
- 未来若接入英语音频或 LearningEvent，必须单独定义音频许可、缓存、隐私、事件语义和复习调度边界。

## 验收

1. `/ipa` 的 10 个真实词条、两种模式、反馈、错误/重试和语言提示通过 UI 测试。
2. 固定词条选择 helper 在完整 corpus、缺失词条、缺失音标和缺失字段时通过内容测试。
3. 路由组合证明页面通过注入的 `loadCanonicalContent` / `loadUserSettings` 获取外部能力。
4. `npm run verify` 通过，且页面不引入音频、网络请求或学习事实持久化。

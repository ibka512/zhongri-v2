# Task 020：英语音标最小切片

## 目标

在日语五十音切片之后提供一个可直接验收的英语发音文字入口，让学习者能看到真实英语词条的
词形、IPA 音标和中文义，并用一组短练习建立“词形 ↔ 音标”的基本辨认能力。这个切片验证的是
现有 canonical 英语内容如何进入英语学习入口，不把展示练习描述成完整的发音训练系统。

## 范围内

- 新增 `/ipa` 路由和移动端优先的英语音标页面。
- 复用经过完整性门禁的 `CanonicalContentRepositoryPort` 英语词条，不复制词库数据；固定首批
  10 个英语词条 id，要求每个词条都有 `headword`、`phonetic`、`meaning` 和 `level`。
- 提供只读 IPA 词条卡片，展示英文词形、IPA、中文义和等级，并明确内容来自内置 canonical 词库。
- 提供两个只存在于当前页面的辨认模式：看到 IPA 选择正确英文词形，或看到英文词形选择正确 IPA；
  选项反馈和下一题状态不写入学习事实。
- 当前学习语言不是英语时给出非阻塞提示，仍允许查看和练习；提供进入首次设置的深链接，不在本页
  修改语言设置。
- 为加载中、canonical 内容读取失败、词条不足、无音标和答题反馈提供可理解状态；页面不直接访问
  IndexedDB、LocalStorage、网络、TTS 或 AI。
- 从今日课程和内容中心提供 `/ipa` 深链接；复用既有 Button/Card/Progress 与设计 token。
- 新增内容选择 helper、页面、路由组合和 UI/内容测试。

## 范围外

- 不新增英语词库、内容 Schema、数据库表、用户词或内置词覆盖；不改变 canonical corpus 顺序、ID、
  来源或完整性门禁。
- 不接入英语 TTS、远程音频、音频缓存、发音评分、语音识别、AI、账号、同步或通知。
- 不把本页答题结果写入 `LearningEvent`、LearnerProfile、ReviewState、FSRS、错题本或掌握画像。
- 不实现句子、连读、重音/语调分析、口语输入、完整 IPA 课程或新的英语学习目标设置。

## 影响层

- UI：新增 `/ipa` 页面、模式切换、IPA/词形候选、可解释反馈和响应式样式；不新增通用设计系统。
- Content：新增固定首批英语词条 id 选择 helper，只从注入的 canonical repository 读取真实数据。
- Application/Composition：路由注入 `loadCanonicalContent` 与 `loadUserSettings`；页面不直接加载 JSON 或
  读取浏览器存储。
- Ports/Infrastructure：复用既有 `CanonicalContentRepositoryPort`，不新增持久化或浏览器能力。
- 文档：新增 ADR-042，并更新 `PROJECT_CONTEXT.md`、`TASKS.md`、`STATUS.md` 和 `HANDOFF.md`。

## 验收标准

1. 打开 `/#/ipa` 能看到 10 个真实 canonical 英语词条的词形、IPA、中文义和等级；页面移动端无横向滚动。
2. 两种辨认模式均能从候选中选择答案，显示正确/错误文字反馈并进入下一题；刷新后不声称保留练习进度。
3. 当前语言为日语或没有设置时，页面仍可用，并明确提示这是英语音标切片且提供首次设置入口。
4. canonical 读取失败、固定词条缺失或缺少 IPA 时显示可理解的错误状态和返回/重试入口；不伪造音标。
5. 所有模式、候选、导航控件键盘可达，触摸目标不小于 44px；反馈不只依赖颜色。
6. 页面遵守现有设计 token 与 reduced-motion 规则，不添加外部字体、图标包或网络依赖。
7. 新增内容选择、页面和路由测试；`npm run verify` 全部通过。

# Task 019：日语五十音与浏览器 TTS 最小切片

## 目标

在内容中心之后提供一个可直接验收的日语基础假名入口，让学习者能看到一小组真实的平假名、
用罗马字辨认，并在浏览器支持时听到浏览器内置日语朗读。这个切片验证的是离线内容与语音能力
边界，不把演示练习描述成完整的掌握系统。

## 范围内

- 新增 `/kana` 路由和移动端优先的基础平假名练习页。
- 固定发布第一组基础平假名（あ行、か行，共 10 个），包含 glyph、罗马字和稳定 id；数据随构建
  离线发布，不读取网络或用户词库。
- 提供一个“辨认”模式：看到罗马字，从候选假名中选择对应字符；答题状态仅存在当前页面，
  不产生学习事实。
- 提供一个“听辨”模式：先播放当前假名读音，再从候选假名中选择；播放按钮使用浏览器
  `SpeechSynthesis`，固定 `ja-JP` 和温和语速。
- 明确显示浏览器不支持、声音在设置中关闭、朗读失败和答题反馈等状态；文字辨认在没有 TTS 时
  仍可继续。
- 从今日课程提供到 `/kana` 的深链接；页面不直接访问 IndexedDB、LocalStorage、网络或 AI。
- 新增 Port/Infrastructure adapter、路由组合、内容、语音适配器和页面测试。

## 范围外

- 不修改 Question、Judgement、LearningEvent、LearnerProfile 或 ReviewState Schema 语义。
- 不把假名练习结果写入 LearningEvent、FSRS、Dexie 或任何用户事实存储；不做掌握画像、错题本或
  混淆组分析。
- 不接入远程音频、音频文件、音频缓存、发音评分、语音识别、AI、账号、同步或通知。
- 不实现完整五十音表、片假名、拗音、促音、长音或英语/IPA；后续切片另行授权。
- 不新增设置键；已有 `audioEnabled` 只作为语音关闭时的明确提示，设置仍由 Task 016/017 负责。

## 影响层

- UI：新增 `/kana` 页面、模式切换、候选按钮、朗读状态和响应式样式；复用 Button/Card/Progress 等
  既有组件与设计 token。
- Content：新增静态基础平假名数据，保持稳定 id、顺序和日语标签。
- Ports/Infrastructure：新增 SpeechSynthesis Port 和浏览器 adapter；adapter 负责能力检测、取消
  上一段朗读和错误归一化，页面只消费注入的 port。
- Application/Composition：路由只注入 `loadUserSettings` 与 `loadKanaSpeech`，页面不直接调用
  浏览器 API。
- 文档：新增 ADR-041，并更新 `PROJECT_CONTEXT.md`、`TASKS.md`、`STATUS.md` 和 `HANDOFF.md`。

## 验收标准

1. 打开 `/#/kana` 能看到 10 个基础平假名、罗马字和稳定顺序；移动端无横向滚动。
2. “辨认”模式的候选选择会显示正确/错误反馈并可进入下一题；刷新后不声称保留练习进度。
3. “听辨”模式在注入的语音能力可用时调用 `ja-JP` 浏览器 Speech Synthesis；朗读期间按钮有
   loading/disabled 反馈，重复点击不会并发播放。
4. 不支持 Speech Synthesis、设置关闭声音或朗读失败时均有可理解的文本提示，且辨认模式仍可用。
5. 所有候选和朗读控件键盘可达、触摸目标不小于 44px、具有可读的 label/状态；颜色不是唯一反馈。
6. 页面遵守现有设计 token 与 reduced-motion 规则，不添加外部字体、图标包或网络依赖。
7. 新增内容、adapter、页面与路由测试；`npm run verify` 全部通过。

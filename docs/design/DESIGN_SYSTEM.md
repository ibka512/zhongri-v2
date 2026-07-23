# Design System 实现索引

## 视觉方向

```text
苹果式秩序感
+
日系柔和气质
+
克制的学习游戏感
```

核心表达：

- 内容像纸。
- 操作像玻璃。
- AI 像柔光。

## 已实现

- CSS Variables Design Token：颜色、排版、4px 间距、圆角、阴影和动效。
- Theme Provider：日间与暗色模式。
- Button、Card、IconButton、Progress。
- QuestionFrame、ChoiceAnswer、TextAnswer、Feedback。
- AIBubble 和 mock AudioControl。
- `/ui-lab` 状态验收页面。

源码位于 `src/ui/`，UI Lab 位于 `src/pages/UILab/`。

## 实现规则

- 内容层使用高可读实色表面，不默认使用毛玻璃。
- 玻璃只用于真实浮动交互层。
- AI Bubble 是上下文辅助，不是聊天窗口。
- 普通文字保持 WCAG AA 对比度；重要触控目标默认至少 48px。
- 状态不能只靠颜色表达。
- 高频交互动效保持短促，只使用有明确目的的状态反馈。
- 禁止 `transition: all`、过度弹跳、无限装饰动画和大面积渐变。
- 必须支持暗色、`prefers-reduced-motion`、减少透明和键盘焦点。

新增组件进入业务页面前，必须先在 `/ui-lab` 展示并完成状态测试。

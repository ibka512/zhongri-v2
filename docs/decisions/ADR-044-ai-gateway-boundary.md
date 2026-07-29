# ADR-044：以独立 Gateway 隔离 AI 供应商与学习事实

## 状态

PWA 底座与独立 Gateway 已实现、发布并完成 Worker 健康检查；Secret 与官方 Cloudflare AI Gateway 网关已配置，
合成真实联调连续两次成功（2026-07-29）。今日计划页的 PWA 按需 AI 练习只读预览已接入，待负责人完成
GitHub Pages 成功与失败回退验收。

## 背景

Task 021 已完成日语/英语共用学习闭环，基础课程必须在离线或 AI 不可用时继续可用。Issue #20
提出进入 Phase 2，但如果让 PWA 直接请求 DeepSeek，会把供应商密钥、模型协议、重试策略和上游
失败语义带入浏览器，也会诱发 AI 输出绕过既有 Schema 写入学习事实。

## 决策

- AI 供应商访问隔离在独立 `zhongri-ai-gateway` Cloudflare Worker；PWA 只依赖公开 Gateway URL，
  不保存或传递 `DEEPSEEK_API_KEY`。
- `zhongri-v2` 先冻结版本化 AI Task Protocol、`AIGateway` Port 和错误分类；Gateway 和 PWA 两端
  都执行 reject-by-default 的 Zod Schema 校验。
- 首个任务只允许 `generateQuestions`，请求使用最小画像摘要与受限内容上下文，输出只能是结构化
  题目候选，不能直接写 `LearningEvent`、`LearnerProfile`、`ReviewState` 或 `TodayPlan`。
- Gateway 暴露固定健康检查和白名单任务端点，不开放任意 prompt/model、外部 URL 或通用代理；供应商
  失败映射为稳定失败结果，PWA 回退到现有规则课程。
- 独立 Gateway 已在 `work/zhongri-ai-gateway` 完成本地 Worker 工程、Mock provider、DeepSeek adapter、
  稳定错误映射和 Wrangler dry-run，并发布到公开仓库
  [`ibka512/zhongri-ai-gateway`](https://github.com/ibka512/zhongri-ai-gateway)。
- 两仓共享 `contracts/ai-task-protocol-v1.json`；两个仓库各自用本地 Zod Schema 解析该 fixture，
  `zhongri-v2` 的 `npm run verify:gateway-contract` 额外比较两份 fixture 的 SHA，防止跨仓协议样例漂移。
- 真实 Secret、生产 Worker 和真实供应商联调已在负责人单独确认后执行；Cloudflare AI Gateway 网关
  `zhongri-deepseek` 已创建并使用官方 DeepSeek provider 路径，网关请求日志关闭，Authenticated Gateway
  关闭；不把 Key 下沉到 PWA。
- DeepSeek 返回的完整或紧凑候选结构都会先经过受限转换，再通过完整结果 Schema 和请求匹配校验；失败时
  仍返回稳定 failure 并保留本地规则回退。
- PWA 通过 `GenerateQuestionsUseCase` 在 Application 层组装最小 request；用户明确点击今日计划页的按需
  入口后才请求 Gateway。成功结果只做只读预览，不替换 `TodayPlan`，不写 `LearningEvent`、`LearnerProfile`
  或 `ReviewState`；失败结果回到规则课程。

## 影响

- 新增一个独立部署边界和跨仓库交接面，但供应商替换、失败降级和密钥轮换不会污染 PWA。
- AI 输出仍需经过现有 Question Schema 或专门的版本化任务 Schema；AI 不获得学习事实写权限。
- 需要同步维护两个仓库的版本、fixture、CI、回滚和安全说明。

## 当前不包含

- AI 私教 UI、自由聊天、流式对话、`explainError`、账号同步、计费、队列、数据库或滥用防护平台。
- PWA 内 API Key、本地明文密钥、真实用户数据上传、迁移数据写入或 AI 事实回写。

## 验证要求

1. PWA 与 Gateway 的 request/result/failure/trace metadata contract fixtures 双向通过。
2. 未知字段、超限请求、非白名单任务、外部 URL、超时、429、5xx、空响应、截断和无效 JSON 均拒绝或
   稳定降级。
3. `DEEPSEEK_API_KEY` 不出现在前端构建产物、日志、备份、fixture 或 Git 历史。
4. Gateway 缺失、断网或失败时，`/#/today` 现有课程仍可完成。

## 本地实现证据

- `src/schemas/v1/AITaskProtocolSchema.ts` 是 request/result/failure/trace metadata 的单一来源，
  并导出按需 JSON Schema。
- `src/ports/ai/AIGateway.ts` 只暴露白名单 `generateQuestions`；
  `src/infrastructure/ai/AIGatewayHttpClient.ts` 固定端点、超时、Content-Type 和稳定失败映射。
- `src/application/ai/GenerateQuestionsUseCase.ts` 只组装最小画像/内容上下文并把 failure 转成 PWA fallback；
  `/today` 计划页的 AI 练习预览只读展示通过校验的候选，不触碰学习事实。
- `tests/schemas/ai-task-protocol.test.ts` 与 `tests/infrastructure/ai-gateway.test.ts` 覆盖有效/无效
  fixture、未知字段、关联校验、空/非 JSON、超时、429、4xx、5xx 和网络失败。
- `tests/application/ai-generate-questions.test.ts` 与 `tests/ui/today-course.test.tsx` 覆盖最小上下文、
  成功预览、未配置 Gateway 回退和学习事件不变。
- `npm run verify`：主仓库全量验证、独立 Gateway 17 个测试、默认构建和 Pages 构建均通过；构建产物不包含
  `DEEPSEEK_API_KEY`。

## 真实联调证据

- Worker：[`zhongri-ai-gateway.moyu54433.workers.dev`](https://zhongri-ai-gateway.moyu54433.workers.dev)，
  `/health` 返回 200。
- 合成 fixture：`contracts/ai-task-protocol-v1.json` 的 `request`，`requestId=ai-request-ja-001`；生产端点
  连续两次返回 HTTP 200 的协议 `success`，耗时约 3.8–4.2 秒。
- Cloudflare Secret 列表包含 `DEEPSEEK_API_KEY`；未读取或记录 Secret 值。最终 Worker 版本为
  `2594b989-f42b-4c49-b806-8dd9265f0c82`，Gateway 代码提交为 `860aad0`。
- 当前结论：合同、Worker 路由、Secret 绑定、官方 AI Gateway 出口、真实合成成功路径和 PWA 按需预览接线均
  已验证；下一步由负责人在 GitHub Pages 验收成功预览、失败回退和今日课程不受影响。

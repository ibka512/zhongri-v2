# ADR-044：以独立 Gateway 隔离 AI 供应商与学习事实

## 状态

PWA 底座与独立 Gateway 已实现、发布并完成 Worker 健康检查；Secret 已配置，真实联调被 Cloudflare→DeepSeek 出站网络阻塞（2026-07-29）

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
- 真实 Secret、生产 Worker 和真实供应商联调已在负责人单独确认后执行；合成请求确认 Secret 已进入
  Worker，但 Cloudflare→DeepSeek 出站 `fetch` 抛出 `TypeError`，因此继续保留稳定 failure 和本地规则回退。
  Gateway 代码已准备只允许官方 Cloudflare AI Gateway DeepSeek 地址的 `DEEPSEEK_BASE_URL`，但在网关
  创建并验证前不启用；不把 Key 下沉到 PWA。

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
- `tests/schemas/ai-task-protocol.test.ts` 与 `tests/infrastructure/ai-gateway.test.ts` 覆盖有效/无效
  fixture、未知字段、关联校验、空/非 JSON、超时、429、4xx、5xx 和网络失败。
- `npm run verify`：53 个测试文件、220 个测试、默认构建和 Pages 构建均通过；构建产物不包含
  `DEEPSEEK_API_KEY`。

## 真实联调证据

- Worker：[`zhongri-ai-gateway.moyu54433.workers.dev`](https://zhongri-ai-gateway.moyu54433.workers.dev)，
  `/health` 返回 200。
- 合成 fixture：`contracts/ai-task-protocol-v1.json` 的 `request`，`requestId=ai-request-ja-001`；生产端点
  返回 HTTP 200 的协议 failure `unavailable`。
- Cloudflare Secret 列表包含 `DEEPSEEK_API_KEY`；未读取或记录 Secret 值。临时安全 tail 只记录了
  `deepseek_fetch_failed`、`timedOut=false`、`errorName=TypeError`，随后已移除调试标志并重新部署干净版本。
- 当前结论：合同、Worker 路由和 Secret 绑定均已验证；直连阻塞点是 Cloudflare 到 DeepSeek 的出站路径，
  尚未取得供应商 HTTP 响应；下一步通过官方 AI Gateway 出口配置重跑合成联调。

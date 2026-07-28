# Task 014：DeepSeek AI Gateway 与结构化任务协议

关联：[GitHub Issue #20](https://github.com/ibka512/zhongri-v2/issues/20)

## 当前状态

负责人已授权 Task 014 的 Gateway 本地施工（2026-07-28）。`zhongri-v2` 本地底座和独立
`zhongri-ai-gateway` Worker 工程均已完成：前者包含 AI Task Protocol v1、`AIGateway` Port、HTTP
adapter、运行时公开 URL 配置、fixture、contract tests、跨仓 fixture SHA 检查和 JSON Schema 导出；后者固定
`/health`、`/v1/tasks/generate-questions`、Prompt Registry、Mock provider、DeepSeek adapter、请求/响应
校验、稳定 failure mapping、CORS 和 secret 扫描。独立工程路径为
`work/zhongri-ai-gateway`，当前提交 `7c71e1e`（代码基线 `f27cb6e`）；其 `npm run verify`（15 tests）和 Wrangler dry-run
均通过。公开远端已创建并推送为 [`ibka512/zhongri-ai-gateway`](https://github.com/ibka512/zhongri-ai-gateway)，
`main` 核对为 `7c71e1e`。主仓库的 `npm run verify:gateway-contract` 已通过，Cloudflare Secret、真实 DeepSeek API 和生产部署均未执行。

## 背景

Phase 1 的固定课程、LearningEvent、画像与复习安排已经可以在 AI 不可用时独立运行。Phase 2
只允许把 AI 作为受约束的增强能力：浏览器不能持有供应商密钥，AI 不能直接写入学习事实，
无效输出必须拒绝并回退到基础学习路径。

## 目标

建立一条可审计、可回退的 AI API 接入底座：

- 在 `zhongri-v2` 冻结 AI Task Protocol v1、`AIGateway` Port 和 HTTP Client 边界。
- 首个白名单任务为 `generateQuestions`，只接收最小画像摘要、语言、目标数量和受约束内容上下文。
- 在独立 `zhongri-ai-gateway` Cloudflare Worker 中提供 `/health` 与
  `/v1/tasks/generate-questions`，不提供通用 prompt/model 代理。
- Gateway 与 PWA 对 request/result/failure/trace metadata 做双重 Schema 校验，拒绝未知字段、
  超限输入、非白名单任务、外部 URL 和任意模型覆盖。
- 供应商密钥只存在 Worker Secret `DEEPSEEK_API_KEY`；不进入 PWA、IndexedDB、日志、备份或 Git。
- 供应商失败、离线、超时、429、5xx、空内容、截断和无效 JSON 都映射为稳定可测试的失败结果，
  不破坏现有离线学习闭环。

## `zhongri-v2` 范围

- Zod 单一来源的 request/result/failure/trace metadata Schema 与 JSON Schema 导出。
- `AIGateway` Port、HTTP adapter、公开 Gateway URL 配置和错误分类。
- `generateQuestions` 最小上下文与输出约束；有效/无效 fixture 和 contract tests。
- 不把 AI 输出直接写入 `LearningEvent`、`LearnerProfile`、`ReviewState` 或 `TodayPlan`。
- ADR、状态文档、回滚说明和下一个 AI handoff。

本地实现已验证：未知字段、非白名单任务、语言/数量/来源约束、响应关联错误、空/非 JSON/无效
Schema、408/429/4xx/5xx、超时和网络不可用均会拒绝或映射为不泄漏上游内容的稳定 failure。

## `zhongri-ai-gateway` 范围

- Cloudflare Worker 工程、CI、Wrangler 配置与安全部署说明。
- 首个 ModelAdapter 使用 Issue #20 冻结的 DeepSeek OpenAI-compatible Chat Completions API 和
  `deepseek-v4-flash` 模型；真实联调仅在 Secret 配置并单独批准后执行。
- Content-Type、请求体大小、语言、目标数量、字符串长度、来源和 CORS 校验。
- 固定 Prompt Registry 版本，使用 `response_format: { type: "json_object" }`，不开放任意 prompt/model。
- 只记录 task/schema/prompt/model 版本、耗时、状态和 failure reason，不记录完整上下文、内部 Prompt
  或供应商原文。

## 明确不包含

- AI 私教 UI、自由聊天、`explainError` 用户入口或流式消息体验。
- AI 写入 LearningEvent、LearnerProfile、ReviewState、TodayPlan 或迁移数据。
- PWA 内保存 DeepSeek API Key、账号、同步、计费、队列、数据库或完整滥用防护平台。
- 真实 Secret、生产部署、供应商额度购买和未批准的跨仓库自动化。

## 验收标准

1. 两个仓库均通过 format、lint、typecheck、test、build；`zhongri-v2` 的 `npm run verify` 通过。
2. 非白名单任务、任意 prompt/model、外部 URL、未知字段和超限请求均被拒绝。
3. 空响应、截断、超时、429、5xx 和 Schema 错误返回稳定 `AIResult` failure，且不泄漏上游细节。
4. PWA 在 Gateway 缺失、离线或失败时保持当前学习闭环可用。
5. 浏览器构建产物和两个仓库均不包含 `DEEPSEEK_API_KEY`。
6. Draft PR 链接本 Task、ADR、fixture、contract test、回滚与部署前置条件。

## 下一阶段前置

- 远端仓库已按负责人授权创建为公开仓库并推送；后续修改必须继续保持密钥不入 Git，并在两个仓库
  同步协议 fixture/Schema。
- 若需要真实联调，负责人另行提供 Cloudflare 账户/Worker 权限和 Secret 配置；本地 mock/contract 测试
  不需要真实密钥。真实 Secret、真实 API 请求和生产部署仍需单独确认。

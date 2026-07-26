# 钟日_v2_Phase_0_工程初始化方案

ZHONGRI · PHASE 0 ENGINEERING

钟日 v2

工程初始化方案

Phase 0：工程初始化与契约冻结

冻结结论 建立一个单仓库、单包、React + TypeScript strict + Vite 的本地优先 PWA。先冻结 Question、LearningEvent、Judgement、Repository Port 与 AI Task 协议，再用 /ui-lab 和一条固定夹具纵向切片验证边界；不在 Phase 0 实现完整学习、真实 AI、账号或高级题型。

| 基线          | 本方案的继承方式                                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| MVP 范围      | Phase 0 只做准备与契约冻结；Phase 1 才建立无 AI 学习闭环，Phase 2 才接入 AI。                                       |
| Design System | Design Token、QuestionFrame、Choice/Text、InlineFeedback、AIBubble、AudioControl、ProgressTrack 先在 /ui-lab 验证。 |
| 技术架构      | UI → Application Use Cases → Domain Core → Ports → Infrastructure Adapters；依赖方向不可反转。                      |
| 适用对象      | 个人开发者；小步提交、可重复构建、可由 AI 协作但必须受契约和门禁约束。                                              |

# 0. 冻结摘要与使用方式

本文件不是搭建脚本，也不是业务实现说明。它冻结 Phase 0 需要创建的仓库骨架、依赖、配置、契约、测试面与提交顺序。实际初始化时可以逐项执行，但不得借“顺手搭框架”提前进入 Phase 1—3。

| 项目    | 冻结决定                                                                | 拒绝的替代                                            |
| ------- | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| 仓库    | 新建 zhongri-v2 独立仓库；单 package；npm + package-lock.json。         | 在 v1 app.js 上继续堆叠；一开始使用 monorepo。        |
| 运行时  | Node.js 24 LTS 的具体 patch 固定在 .nvmrc 与 CI；季度集中升级。         | 开发者本机、CI、AI 环境各用不同 Node。                |
| 路由    | React Router Declarative 模式；静态 SPA。                               | React Router Framework 模式、SSR、Next.js。           |
| 状态    | 局部 React state + Zustand 短生命周期 ViewModel。                       | Zustand persist 保存业务事实；Redux/XState 提前引入。 |
| 数据    | Dexie / IndexedDB，通过 Repository 访问；Phase 0 只建空库与适配器骨架。 | LocalStorage 保存学习数据；组件直接查询 Dexie。       |
| 契约    | Zod 是运行时单一来源，并导出版本化 JSON Schema。                        | TypeScript type、JSON Schema 与 AI 示例各维护一份。   |
| PWA     | vite-plugin-pwa + Workbox injectManifest；SW 只管网络与缓存。           | Service Worker 写 LearningEvent、FSRS 或用户设置。    |
| UI 验证 | 内部 /ui-lab，静态夹具驱动。                                            | 引入 Storybook；先做真实页面再补状态。                |
| AI      | 只冻结 AI Task Protocol 与固定样例，不连接模型。                        | 安装供应商 SDK、Prompt 框架或聊天 UI。                |

Phase 0 的一句话目标 让下一阶段可以在稳定、可验证、不会跨层的合同上直接编码。

# 1. GitHub 仓库初始化方案

## 1.1 仓库策略

- 仓库名：zhongri-v2。与 v1 仓库分离，v1 只作为迁移事实来源，不作为 v2 运行时依赖。

- 默认分支：main。保持可发布；初始化期间使用短生命周期分支，合并前通过同一套 CI。

- 包管理器：npm。提交 package-lock.json；CI 使用 npm ci；禁止并存 yarn.lock 或 pnpm-lock.yaml。[S02][S16]

- 版本策略：已冻结主线使用 React 19.2、Vite 8、Zod 4、Vitest 4；其余依赖安装兼容的稳定版本并锁定具体 patch。

- Node：初始化当天固定 Node 24 LTS 的具体 patch；package.json engines、.nvmrc 与 CI 三处一致。[S01]

- 发布策略：Phase 0 不配置正式生产部署；只要求本地 preview 与 CI 构建产物可验证。

## 1.2 推荐仓库结构

| 路径                | 职责                                                                 | Phase 0 状态       |
| ------------------- | -------------------------------------------------------------------- | ------------------ |
| .github/workflows/  | CI：安装、格式检查、lint、typecheck、单测、构建、Playwright smoke。  | 现在创建           |
| docs/adr/           | 记录会改变长期边界的架构决策；首批包含仓库、依赖方向、契约版本策略。 | 现在创建           |
| docs/contracts/     | 由 Zod 导出的 JSON Schema 与人类可读变更说明；生成物不可手改。       | 现在创建           |
| docs/phase-0/       | 本方案的仓库内摘要、完成清单与初始化日志。                           | 现在创建           |
| public/icons/       | PWA 安装图标等静态资源；只放无需构建处理的文件。                     | 现在创建           |
| src/app/            | 启动、Provider 组合、路由、全局错误边界与 PWA 注册。                 | 现在创建           |
| src/domain/         | 纯 TypeScript 学习规则与领域结果；不依赖 React、Dexie 或浏览器。     | 现在创建           |
| src/application/    | 用例、事务编排、ViewModel 映射与 Ports。                             | 现在创建           |
| src/infrastructure/ | Dexie、PWA 及未来 AI / Audio 的适配器。                              | 只创建 db 与 pwa   |
| src/schemas/        | 跨边界运行时契约与 JSON Schema 导出源。                              | 现在创建           |
| src/ui/             | Design Token 与无业务副作用的组件。                                  | 现在创建           |
| src/pages/          | 页面级组合；Phase 0 只有 UiLabPage 和 NotFoundPage。                 | 现在创建           |
| tests/              | contract、unit、component、integration、e2e、fixtures 与 setup。     | 现在创建必要子目录 |

## 1.3 根目录文件

| 文件                             | 用途                                                             | 约束                           |
| -------------------------------- | ---------------------------------------------------------------- | ------------------------------ |
| README.md                        | 一分钟启动、脚本、目录边界、Phase 0 状态。                       | 不复制完整 PRD。               |
| AGENTS.md                        | AI 协作的强制边界、修改流程、测试要求。                          | 短、可执行；与本文件一致。     |
| ARCHITECTURE.md                  | 仓库内依赖方向与禁止 import 的摘要。                             | 只写当前结构，不描绘远期系统。 |
| package.json / package-lock.json | 依赖、scripts、engines 与可重复安装。                            | 锁文件必须提交。               |
| .nvmrc / .npmrc                  | 固定 Node 主线与精确安装策略。                                   | save-exact；不保存 token。     |
| .editorconfig                    | 跨编辑器基础空格、换行与字符集。                                 | 与 Prettier 不冲突。           |
| .gitignore                       | 忽略 dist、coverage、test-results、playwright-report、环境密钥。 | 不得忽略契约与 fixtures。      |
| index.html                       | Vite SPA 入口与基础元信息。                                      | 不承载页面逻辑。               |

## 1.4 GitHub 基础治理

- main 至少要求 CI 成功后再合并；个人开发阶段不强制复杂审批或 CODEOWNERS。

- Issue 使用“目标、范围外、验收、影响层”四段式；避免一句话任务驱动大范围 AI 修改。

- 涉及 Schema、依赖方向、数据库、FSRS 或 PWA 更新策略的变更必须先写 ADR。

- 不在 Phase 0 配置自动发布、依赖机器人、提交信息校验器或多环境矩阵；等真实维护成本出现再加。

# 2. 第一阶段需要创建的目录

## 2.1 必须现在创建

| 目录                                           | 最小内容                                                                                                 | 现在创建的理由                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| src/app/                                       | main、router、providers、error boundary、app shell 装配。                                                | 让依赖入口唯一，防止页面各自装配。       |
| src/domain/questions/                          | Question 领域类型视图、Judge、Normalizer、Judgement。                                                    | 首批契约与纵向切片必需。                 |
| src/domain/learning-events/                    | 事件工厂与不可变语义。                                                                                   | 先冻结事实，再允许画像或复习消费。       |
| src/domain/review/                             | ReviewScheduler Port 与 ReviewState 领域语义。                                                           | 组件不能直接调用 FSRS。                  |
| src/application/use-cases/                     | submitAnswer 探针用例。                                                                                  | 验证 UI → 用例 → 领域 → Port。           |
| src/application/ports/                         | Question、LearningEvent、ReviewState、Session、Clock、Id、事务 Ports。                                   | 隔离 Dexie 与可测试替身。                |
| src/infrastructure/db/                         | ZhongriDb 空库、schema 版本、Repository 骨架。                                                           | 验证 IndexedDB 装配，不实现完整表模型。  |
| src/infrastructure/pwa/                        | sw、注册、更新状态与缓存常量。                                                                           | 完成可安装、可离线的 App Shell。         |
| src/schemas/                                   | Question v1、LearningEvent v1、Judgement v1、AI Task v1。                                                | 跨层合同的单一运行时来源。               |
| src/ui/tokens/                                 | primitives、themes、motion、media preferences。                                                          | Design System 必须先落为 CSS Variables。 |
| src/ui/components/                             | Button、QuestionFrame、ChoiceAnswer、TextAnswer、InlineFeedback、AIBubble、AudioControl、ProgressTrack。 | 只做状态矩阵与无障碍契约。               |
| src/pages/ui-lab/                              | UiLabPage 与 fixture catalog。                                                                           | 组件进入真实页面前的验收面。             |
| tests/contracts/                               | 有效 / 无效 Schema 固定样例。                                                                            | 阻止 AI 与导入数据绕过验证。             |
| tests/unit/ / component/ / integration/ / e2e/ | 当前用到的最小测试。                                                                                     | 按测试职责分离，而不是统一 tests.ts。    |

## 2.2 未来按需创建

| 目录                        | 最早阶段                | 创建触发条件                                               |
| --------------------------- | ----------------------- | ---------------------------------------------------------- |
| src/domain/study/           | Phase 1                 | 今日计划与 StudySession 状态机开始实现。                   |
| src/domain/profile/         | Phase 1                 | LearningEvent projector 有真实输出。                       |
| src/features/onboarding/    | Phase 1                 | 首次设置进入开发。                                         |
| src/features/today-plan/    | Phase 1                 | 规则计划骨架进入开发。                                     |
| src/features/study-session/ | Phase 1                 | 真实会话页面需要组合用例。                                 |
| src/features/content/       | Phase 1                 | 词库、假名或 IPA 内容页进入开发。                          |
| src/features/settings-data/ | Phase 1                 | 备份、恢复和数据诊断开始。                                 |
| src/infrastructure/audio/   | Phase 1                 | 浏览器 TTS 第一次被真实题目调用。                          |
| src/migration/              | Phase 1                 | 开始实现 v1 只读迁移；Phase 0 只保留 fixtures 与验收计划。 |
| src/infrastructure/ai/      | Phase 2                 | AI Gateway 已有明确端点与威胁模型。                        |
| src/platform/               | Phase 3 或 Android 评估 | 第一个 Web / Capacitor 差异能力出现。                      |

## 2.3 暂不创建

| 目录 / 结构                                   | 为什么不创建                                                 |
| --------------------------------------------- | ------------------------------------------------------------ |
| packages/、apps/、turbo.json                  | 当前只有一个 PWA；monorepo 只增加发布、路径和 AI 理解成本。  |
| src/services/ 大目录                          | 会把 AI、数据库、音频和业务用例重新混成“万能服务”。          |
| src/utils/、src/types/、src/constants/ 大杂烩 | 共享内容只有出现第二个真实调用方后才上移。                   |
| src/features/ai-chat/                         | AI 不是聊天主入口，Phase 0 不实现 AI。                       |
| server/、api/、gateway/                       | 薄 AI Gateway 属于 Phase 2 的独立部署，不塞入当前 PWA 仓库。 |
| src/sync/、src/auth/、src/billing/            | 账号同步和商业化均不在 MVP。                                 |
| storybook/、.storybook/                       | /ui-lab 已满足当前组件状态验收，避免双套示例系统。           |

目录创建规则 目录必须对应当前可运行文件、契约或测试；不创建空目录证明“架构完整”。一个 feature 只有一个文件时先保持扁平。

# 3. 初始化依赖清单

## 3.1 Phase 0 生产依赖

| 依赖              | 用途                                               | 边界                                          |
| ----------------- | -------------------------------------------------- | --------------------------------------------- |
| react / react-dom | App Shell、/ui-lab 与组件渲染。                    | React 19.2 系列，锁定具体 patch。             |
| react-router      | Declarative SPA 路由：/ui-lab、404 与未来六页。    | 不安装 @react-router/node 或 Framework 模式。 |
| dexie             | IndexedDB 版本与 Repository 适配器。               | 只允许 infrastructure/db import。             |
| zustand           | 主题、离线 / 更新状态、当前 UI Lab ViewModel。     | 不使用 persist 保存业务事实。                 |
| zod               | 外部输入、Question、Event 与 AI 协议的运行时验证。 | 使用 Zod 4 原生 JSON Schema 导出。[S06]       |

Phase 0 的生产依赖保持在五组。React Router 的 Declarative 安装只需要 react-router；Dexie React hooks 不安装，因为页面不应直接订阅数据库。[S03][S04]

## 3.2 Phase 0 开发依赖

| 依赖组         | 包                                                                                                                    | 为什么现在需要                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 构建 / 类型    | vite、@vitejs/plugin-react、typescript、@types/react、@types/react-dom、@types/node                                   | React TS 构建、配置类型与严格类型检查。                             |
| Lint           | eslint、@eslint/js、typescript-eslint、eslint-plugin-react-hooks、eslint-plugin-react-refresh、eslint-plugin-jsx-a11y | 类型感知 lint、Hooks、Fast Refresh 与基础无障碍规则。[S13][S14]     |
| 格式化         | prettier、eslint-config-prettier                                                                                      | 格式与规则职责分离；不运行 eslint-plugin-prettier。[S15]            |
| 单元 / 组件    | vitest、jsdom、@testing-library/react、@testing-library/jest-dom、@testing-library/user-event                         | 领域单测、组件状态与真实用户交互。[S07][S08][S09]                   |
| IndexedDB 测试 | fake-indexeddb                                                                                                        | 在 Vitest 中测试 Dexie Repository，不依赖浏览器残留数据。           |
| E2E            | @playwright/test                                                                                                      | 运行 preview server、路由、暗色、离线和 PWA smoke。[S10]            |
| PWA            | vite-plugin-pwa、workbox-core、workbox-precaching、workbox-routing                                                    | 自定义 TypeScript Service Worker、预缓存与 SPA 导航回退。[S11][S12] |

## 3.3 延迟安装

| 依赖 / 能力                                          | 最早安装点                               | 延迟理由                                                  |
| ---------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| ts-fsrs                                              | Phase 1 首个真实 ReviewScheduler adapter | Phase 0 先冻结 Port，并用 Fake Scheduler 验证用例。       |
| workbox-strategies / expiration / cacheable-response | Phase 1 首次出现运行时资源缓存           | Phase 0 只需要 App Shell 预缓存与导航。                   |
| AI provider SDK / HTTP client                        | Phase 2 Gateway 与客户端协议明确后       | 浏览器不得持有供应商密钥；原生 fetch 已足够调用 Gateway。 |
| MSW                                                  | 出现两个以上稳定网络接口且测试重复时     | Phase 0 没有真实网络业务。                                |
| 图标包                                               | 设计验证表明确实际图标集合后             | 避免整包引入与风格漂移；首批可用受控 SVG。                |
| 虚拟列表                                             | 词库性能测试证明需要时                   | Phase 0 没有长列表。                                      |

## 3.4 明确不安装

- Redux Toolkit、XState、TanStack Query：当前状态规模与离线数据流不需要第二套缓存或状态框架。

- Next.js、React Router Framework 运行时：MVP 是静态 PWA，不需要 SSR、服务端路由或 route action。

- Storybook：/ui-lab 是冻结的内部验收面。

- Axios：Phase 0 无真实 API；Phase 2 Gateway client 优先使用 fetch adapter。

- Moment、date-fns：时间必须通过 ClockPort；出现真实日历运算前不添加日期库。

- Immer、Lodash、clsx：当前需求可用语言和小型本地函数表达；第二个真实需求出现后再评估。

## 3.5 依赖版本与升级纪律

- 初始化时使用稳定版本，随后把具体 patch 写入 package.json 与 package-lock.json；不长期保留宽泛 latest。

- CI 使用 npm ci，任何 lockfile 不一致直接失败。[S16]

- 依赖升级独立提交，不和 Schema、UI 或业务逻辑修改混在一起。

- 每季度集中检查一次；安全修复可单独提前。升级后至少运行全量门禁和 PWA 离线 smoke。

- FSRS、Question、LearningEvent、Prompt 与迁移版本不随 npm 包升级自动改变。

# 4. 配置文件规划

## 4.1 配置文件清单

| 文件                               | 作用                                                | Phase 0 冻结点                                                    |
| ---------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| package.json                       | 包元数据、scripts、engines、依赖。                  | type=module；Node 与 npm 范围；脚本命名；不放秘密。               |
| tsconfig.json                      | 项目引用入口。                                      | 只协调 app / node；不承载大量选项。                               |
| tsconfig.app.json                  | src 的浏览器与 React 类型。                         | strict、bundler resolution、noEmit、附加强约束。                  |
| tsconfig.node.json                 | Vite、Vitest、Playwright 等配置文件。               | Node 类型与独立 include。                                         |
| vite.config.ts                     | React、别名、构建、PWA manifest 与 injectManifest。 | 不包含业务路由、AI endpoint 或数据库配置。                        |
| vitest.config.ts                   | unit / component / integration 测试环境。           | 继承 Vite alias；jsdom；setup；coverage 只针对 domain / schemas。 |
| tests/setup/vitest.setup.ts        | jest-dom、清理与统一测试初始化。                    | 不放全局业务 mock。                                               |
| playwright.config.ts               | E2E 浏览器、webServer、trace 与输出。               | 运行 build + preview；CI 单 worker；本地复用 server。[S10]        |
| eslint.config.js                   | Flat Config 与目录 import 限制。                    | 类型感知规则；domain / ui / sw 分目录禁入。                       |
| .prettierrc.json / .prettierignore | 格式化单一来源。                                    | 不与 ESLint 争夺代码风格。                                        |
| .editorconfig                      | 编辑器最低一致性。                                  | UTF-8、LF、末尾换行、2 空格。                                     |
| .npmrc                             | 安装行为。                                          | save-exact；不写 registry token。                                 |
| .nvmrc                             | 本地 Node 基线。                                    | 与 CI、engines 一致。                                             |
| .github/workflows/ci.yml           | 提交门禁。                                          | npm ci → format → lint → typecheck → test → build → e2e smoke。   |

## 4.2 TypeScript strict 约束

strict 是最低线，不是全部。Question、Event 和外部数据依赖正确收窄，因此 Phase 0 同时启用能暴露索引、可选字段和分支遗漏的检查。[S17]

| 选项                       | 决定             | 原因                                                     |
| -------------------------- | ---------------- | -------------------------------------------------------- |
| strict                     | 开启             | 启用严格类型家族。                                       |
| noUncheckedIndexedAccess   | 开启             | 选项索引、题库映射和 registry 读取必须处理不存在。       |
| exactOptionalPropertyTypes | 开启             | 区分缺失与显式 undefined，减少 Schema 漂移。             |
| noImplicitReturns          | 开启             | Judge、normalizer 和 reducer 的全部分支必须返回。        |
| noFallthroughCasesInSwitch | 开启             | 判别联合不能意外穿透。                                   |
| noImplicitOverride         | 开启             | 适配器类行为更明确。                                     |
| useUnknownInCatchVariables | 开启             | 外部错误先收窄，不把 provider / Dexie error 当任意对象。 |
| noEmit                     | 开启             | TypeScript 负责检查，Vite 负责构建。                     |
| paths @/*                  | 只保留一个根别名 | 避免大量别名掩盖真实依赖方向。                           |

## 4.3 ESLint 依赖边界

| 作用域                       | 禁止 import                                                                          | 允许方向                                             |
| ---------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| src/domain/**                | react、react-dom、react-router、zustand、dexie、workbox-*、ui、infrastructure、pages | domain 内部；schemas 的 type-only；无副作用 shared。 |
| src/schemas/**               | app、application、ui、pages、infrastructure                                          | Zod 与少量中立常量；不得反向依赖。                   |
| src/application/**           | React 组件、CSS、Dexie 表、Workbox、供应商 SDK                                       | domain、schemas、ports。                             |
| src/ui/**                    | dexie、ts-fsrs、infrastructure/db、infrastructure/ai                                 | React、Design Token、输入 ViewModel 与回调。         |
| src/pages/**                 | Dexie 表、AI SDK、FSRS 包                                                            | app 装配、application facade、ui。                   |
| src/infrastructure/pwa/sw.ts | domain、application、db、zustand                                                     | Workbox 与纯缓存常量。                               |

自动化优先 上述规则必须写入 eslint.config.js 的文件级 override；不能只写在 README 里等待记忆。

## 4.4 package.json scripts

| 脚本                  | 职责                                            | 是否进入 CI           |
| --------------------- | ----------------------------------------------- | --------------------- |
| dev                   | Vite 开发服务器；/ui-lab 默认可用。             | 否                    |
| build                 | 先 typecheck，再生成生产静态产物。              | 是                    |
| preview               | 本地运行 dist，供 PWA / Playwright 验证。       | 由 E2E 调用           |
| typecheck             | tsc 项目检查，不产出 JS。                       | 是                    |
| lint / lint:fix       | ESLint 检查 / 本地修复。                        | lint 是               |
| format / format:check | Prettier 写入 / 只检查。                        | format:check 是       |
| test / test:run       | Vitest watch / 一次性执行。                     | test:run 是           |
| test:coverage         | 查看 domain 与 schemas 的覆盖盲点。             | Phase 0 可选门槛      |
| test:e2e              | Playwright 运行 build preview 的 smoke。        | 是                    |
| contracts:export      | 从 Zod 输出 docs/contracts JSON Schema。        | 是；生成后检查无 diff |
| check                 | 串行运行 format、lint、typecheck、test、build。 | 本地提交前            |

## 4.5 PWA 配置边界

- vite.config.ts 使用 strategies: injectManifest；自定义 TypeScript SW 位于 src/infrastructure/pwa/sw.ts。[S11]

- Phase 0 仅预缓存 App Shell、图标和必要静态文件，并为 SPA 导航回退到 index.html。

- 更新方式使用 prompt；学习会话存在时未来必须延迟刷新，Phase 0 先冻结 update-available 状态协议。

- 开发环境默认不注册 Service Worker，避免陈旧缓存干扰；PWA 行为在 build + preview 中验证。

- Service Worker 不能 import domain、application、Dexie 或 Zustand；只发离线 / 更新消息。

- Phase 0 不缓存 AI、词库大文件或音频；这些策略等真实资源与配额出现后增加。

# 5. 第一批核心文件设计

## 5.1 App 与路由

| 文件                           | 职责                                         | 只能依赖                                     |
| ------------------------------ | -------------------------------------------- | -------------------------------------------- |
| src/main.tsx                   | 创建 React root，调用 app bootstrap。        | src/app；不直接组装业务。                    |
| src/app/App.tsx                | App Shell、全局错误边界与 Router 容器。      | router、providers、ui shell。                |
| src/app/router.tsx             | 定义 /ui-lab 与 404；为未来路由留组合入口。  | pages；不写数据加载。                        |
| src/app/providers.tsx          | 主题、短生命周期 store、端口容器的统一装配。 | application ports、infrastructure adapters。 |
| src/app/AppErrorBoundary.tsx   | 未处理错误的恢复界面。                       | ui；不吞掉领域错误细节映射。                 |
| src/pages/ui-lab/UiLabPage.tsx | 组合组件状态样例与测试控制。                 | ui、static fixtures。                        |
| src/pages/NotFoundPage.tsx     | 最小 404 与返回入口。                        | ui。                                         |

## 5.2 Schema 与 Domain

| 文件                                           | 职责                                            | 依赖方向                              |
| ---------------------------------------------- | ----------------------------------------------- | ------------------------------------- |
| src/schemas/questions/question-v1.schema.ts    | Question v1 的 Zod 单一来源与导出类型。         | 只依赖 Zod / 中立 schema helpers。    |
| src/schemas/events/learning-event-v1.schema.ts | LearningEvent envelope 与允许事件判别联合。     | 不依赖 Repository 或 Profile。        |
| src/schemas/judgement/judgement-v1.schema.ts   | 确定性判题输出协议。                            | 不包含 UI 文案。                      |
| src/schemas/ai/ai-task-v1.schema.ts            | AI task 请求 / 响应 envelope；仅用于 fixtures。 | 不安装模型 SDK。                      |
| src/schemas/export-contracts.ts                | 把 Zod 源导出为版本化 JSON Schema。             | 生成 docs/contracts；不得手写第二份。 |
| src/domain/questions/Question.ts               | 向领域暴露 Question 类型与不变量。              | 对 schema 仅 type-only import。       |
| src/domain/questions/AnswerNormalizer.ts       | 文本输入的已批准规范化策略。                    | 纯函数；语言规则显式版本化。          |
| src/domain/questions/Judge.ts                  | choice / text-input 的确定性判断。              | Question、Judgement；不依赖 React。   |
| src/domain/questions/Judgement.ts              | 领域结果与错误分类。                            | 不含颜色、动画或 AI 解释。            |
| src/domain/learning-events/LearningEvent.ts    | 事件创建、不变式、幂等与 correction 语义。      | Clock / Id 由参数传入。               |
| src/domain/review/ReviewScheduler.ts           | ReviewState 变更所需 Port。                     | 不 import ts-fsrs。                   |
| src/domain/review/ReviewState.ts               | 架构级调度状态与版本引用。                      | 不设计完整数据库字段。                |

## 5.3 Application 与 Ports

| 文件                                             | 职责                                                         | 禁止                               |
| ------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------- |
| src/application/use-cases/submitAnswer.ts        | 判题、构造事件、请求复习更新、原子提交并返回 FeedbackModel。 | JSX、Dexie 表、AI、直接 Date.now。 |
| src/application/models/FeedbackModel.ts          | UI 可渲染但与样式无关的反馈数据。                            | CSS class、ReactNode。             |
| src/application/ports/QuestionRepository.ts      | 读取已验证 Question。                                        | 返回 raw AI JSON。                 |
| src/application/ports/LearningEventRepository.ts | append 与 idempotency 查询。                                 | updateEvent。                      |
| src/application/ports/ReviewStateRepository.ts   | 读取 / 保存 ReviewState。                                    | 暴露 Dexie Table。                 |
| src/application/ports/StudySessionRepository.ts  | 保存会话检查点。                                             | 组件状态。                         |
| src/application/ports/LearningTransaction.ts     | 原子提交 Event、Session checkpoint 与 ReviewState。          | 在事务中等待网络或音频。           |
| src/application/ports/ClockPort.ts               | 提供绝对时间与本地日期语义。                                 | 业务代码直接读取系统时钟。         |
| src/application/ports/IdPort.ts                  | 生成稳定 ID 与幂等键。                                       | 组件自行生成业务 ID。              |

## 5.4 Infrastructure、UI 与测试

| 文件组                                | 职责                                                      | Phase 0 深度                              |
| ------------------------------------- | --------------------------------------------------------- | ----------------------------------------- |
| src/infrastructure/db/ZhongriDb.ts    | 声明 v2 DB 名、schema version 与空表 / 最小表。           | 只证明可打开和升级，不设计完整数据模型。  |
| src/infrastructure/db/repositories/*  | 实现首批 Port。                                           | 只做 contract smoke；真实事务在 Phase 1。 |
| src/infrastructure/pwa/sw.ts          | 预缓存、导航回退、清理旧缓存、更新消息。                  | 无业务数据。                              |
| src/infrastructure/pwa/registerPwa.ts | 注册 SW 并映射 offline / update 状态。                    | 供 App Shell 使用。                       |
| src/ui/tokens/*.css                   | Design Token primitive、light / dark、motion 与媒体偏好。 | 完整复制已冻结 token，不自行改色。        |
| src/ui/components/*                   | UI Lab 的八类组件与 Button。                              | 状态呈现；不实现课程。                    |
| tests/fixtures/contracts/*            | valid / invalid JSON 固定样例。                           | 纳入版本控制。                            |
| tests/fixtures/migration/*            | 脱敏 v1 样本、期望计数和 digest 说明。                    | 不实现迁移器。                            |
| tests/helpers/fakes/*                 | Fake Clock / ID / Repository / Scheduler。                | 只供测试和纵向切片探针。                  |

## 5.5 文件数量控制

第一批文件不是全部未来文件 如果一个目录只有 index.ts 和空接口，不创建；如果一个“service”同时涉及 UI、数据库与算法，先把它拆成 Use Case 与 Port。barrel index.ts 只在稳定公共入口出现后增加。

# 6. Schema 初始冻结

## 6.1 统一版本策略

- 每份跨边界协议都有独立 schemaVersion，Phase 0 使用整数主版本 1；未知版本 reject-by-default。

- Zod 文件是唯一可编辑来源；JSON Schema 是自动导出并提交的兼容工件。

- 兼容性添加只能增加可选字段且默认行为明确；改变已有字段含义必须升主版本。

- Schema 通过有效样例、边界样例和无效样例证明；只看 TypeScript 编译通过不算冻结。

- 任何变更必须同步：ADR、changelog、fixtures、consumer tests、导出 Schema 与迁移影响说明。

## 6.2 Question Schema v1

| 字段组      | Phase 0 冻结                                                                        | 拒绝条件                                      |
| ----------- | ----------------------------------------------------------------------------------- | --------------------------------------------- |
| envelope    | id、schemaVersion=1、type、language、source。                                       | 未知 version / type / language。              |
| type        | 仅 choice、text-input。                                                             | 句子排序、配对、开放回答等未注册类型。        |
| content     | prompt + 可选 stimulus；纯文本 / 受控数据。                                         | HTML、CSS、脚本、布局指令、空题干。           |
| answer      | choice: correctOptionId；text-input: acceptedAnswers + normalizationPolicy。        | 答案缺失、不可确定判断。                      |
| options     | choice 必须 2–6 个稳定 optionId，label 不重复；text-input 不存在。                  | 答案不在 options、重复 optionId、多正确答案。 |
| explanation | 可选模板事实或已验证解释引用。                                                      | 作为正确答案唯一来源。                        |
| audio       | 可选 TTS 文本 / 资产引用、语言、默认语速、required。                                | required=true 但无无音频回退。                |
| metadata    | targetRef、difficulty、validatorVersion、contentHash、prompt / model version 可选。 | 包含 UI 布局或用户推断事实。                  |

Question v1 的渲染映射固定为 choice → ChoiceAnswer、text-input → TextAnswer；音频是组合能力，不成为第三种题型。

## 6.3 LearningEvent v1

| 组成             | 冻结内容                                                                                | 原则                                      |
| ---------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| envelope         | eventId、schemaVersion=1、eventType、occurredAt、sessionId、targetRef、idempotencyKey。 | 稳定身份；同一命令重试去重。              |
| answer-submitted | questionId、questionType、实际答案 / 选项、Judgement、耗时、提示、重听、修改次数。      | 一次提交汇总有价值事实，不逐按键记录。    |
| question-skipped | questionId、已停留时长、是否用提示 / 音频。                                             | 跳过是事实，不伪装为答错。                |
| self-rated       | forgot / fuzzy / known 与 target dimension。                                            | 用户自评和程序判题分开。                  |
| event-corrected  | originalEventId、reason、修正内容。                                                     | 追加修正，不 update 原事件。              |
| 事实边界         | 输入、点击、时间、提示与重听是事实。                                                    | “薄弱”“混淆”“依赖提示”属于 Profile 投影。 |

迁移约束 v1 的学习记录和聚合状态不得被反造为 v2 LearningEvent；Phase 0 fixtures 必须保留这种“历史存在但没有 v2 事件”的情况。

## 6.4 Judgement v1

| 字段 / 语义      | 冻结决定                                                                         |
| ---------------- | -------------------------------------------------------------------------------- |
| schemaVersion    | 1；作为事件与 Feedback 的稳定引用。                                              |
| verdict          | correct 或 incorrect；invalid-input 属于提交前 ValidationFailure，不伪装为答错。 |
| submittedAnswer  | 保留用户实际提交值或 optionId。                                                  |
| normalizedAnswer | 仅 text-input 可有；记录使用的 normalizationPolicyVersion。                      |
| correctAnswerRef | 引用正确 optionId 或接受答案集合，不把解释当答案。                               |
| reasonCode       | 稳定机器码，例如 option_mismatch、text_mismatch、accepted。                      |
| UI 边界          | 不包含颜色、动画、鼓励文案、ReactNode 或 AI 解释。                               |

## 6.5 Repository Port v1

| Port                    | 最小语义                                               | 必须保证                                       |
| ----------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| QuestionRepository      | 按 id 读取 validated Question；可读取固定 fixture。    | 永不返回未验证 raw candidate。                 |
| LearningEventRepository | append；按 idempotencyKey 判断已存在；按 cursor 读取。 | 没有普通 update / upsert 事件。                |
| ReviewStateRepository   | 按 target + dimension 读取 / 保存。                    | 保存算法 / adapter version。                   |
| StudySessionRepository  | 读取与保存 checkpoint。                                | 中断后可恢复。                                 |
| LearningTransaction     | 一次提交 event + checkpoint + ReviewState。            | 原子性；不泄漏 Dexie transaction 类型。        |
| ClockPort / IdPort      | 可替换时间与 ID。                                      | 测试可重复；领域不直接调用 Date / randomUUID。 |

Port v1 冻结行为和错误语义，不冻结 Dexie 表名或索引。错误至少区分 not-found、conflict / duplicate、storage-unavailable 与 unexpected，Application 再映射为 UI 状态。

## 6.6 AI Task Protocol v1

Phase 0 只冻结协议和 fixtures，不安装 SDK、不调用 Gateway。协议的存在是为了让 Phase 2 不破坏 Question 与 LearningEvent 边界。

| 部分                      | 冻结内容                                                                                      | 禁止                                |
| ------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------- |
| request envelope          | protocolVersion=1、taskId、taskType、language、requestedSchemaVersion、context、constraints。 | 供应商字段、Prompt 原文、API key。  |
| taskType                  | suggestPlan、generateQuestions、explainError、generateExample、summarizeSession。             | 自由聊天、UI 生成、修改事实。       |
| context                   | target facts、Profile 摘要、当前题与必要近期证据。                                            | 全量 LearningEvent、完整数据库。    |
| constraints               | 允许题型、正确答案约束、难度、长度、语言和禁止项。                                            | 模型自行决定 UI 或答案事实。        |
| response envelope         | taskId、protocolVersion、status、payload、failureReason、trace metadata。                     | 把 raw 文本当正式题目。             |
| generateQuestions payload | Question candidate 数组；进入 UI 前仍需结构、语义与事实校验。                                 | validationStatus 由模型自报即可信。 |

## 6.7 契约固定样例矩阵

| 契约               | 必须通过                                                           | 必须失败                                                       |
| ------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| Question v1        | ja choice、en text-input、可选 audio。                             | 未知 version、duplicate option、answer missing、HTML content。 |
| LearningEvent v1   | answer-submitted、skip、self-rated、correction。                   | 缺 idempotencyKey、负耗时、未知 eventType、推断字段写入事实。  |
| Judgement v1       | choice correct / incorrect、text normalized。                      | UI 文案、未知 verdict、缺 correctAnswerRef。                   |
| Repository Port v1 | append once、retry dedupe、transaction success、read cursor。      | 事件 update、部分提交、泄漏 Dexie 类型。                       |
| AI Task v1         | generateQuestions request / candidate response、failure response。 | raw history、未知 task、UI layout、错误 Question version。     |

# 7. UI Lab 初始化方案

## 7.1 路由与数据原则

- /ui-lab 是内部开发页面，不计入用户功能和 MVP 页面数量。

- 开发环境默认启用；preview / CI 通过明确构建标记启用；正式生产构建默认不注册该路由。

- 全部示例来自 tests / ui fixtures；不得访问 Dexie、AI、FSRS、TTS 或真实用户数据。

- 组件只接收 props / ViewModel 和回调；状态切换由 Lab 控制器模拟。

- 每个组件同时展示语义名称、状态、键盘路径与无障碍说明，避免只看视觉截图。

## 7.2 第一批组件状态矩阵

| 组件           | 必须验证的状态                                                              | 重点                                      |
| -------------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| Button         | default、hover、focus-visible、pressed、loading、success、error、disabled。 | 44px 触控、状态连续、loading 不跳宽。     |
| QuestionFrame  | idle、answering、submitting、feedback、long-content。                       | 题目、进度、答案和反馈插槽；200% 字体。   |
| ChoiceAnswer   | default、selected、submitting、correct、incorrect、disabled。               | 键盘 / 触控、可访问名称、颜色非唯一线索。 |
| TextAnswer     | empty、focus、composing、filled、submitting、correct、incorrect、disabled。 | 中文 / 日文 IME composing 时禁止误提交。  |
| InlineFeedback | neutral、correct、incorrect、explanation-loading / unavailable。            | 不惩罚；aria-live 时机；保留当前题可见。  |
| AIBubble       | hidden、offer、loading、response、error、dismissed。                        | 有来源、不遮题、不抢焦点、按钮受控。      |
| AudioControl   | idle、loading、playing、paused、ended、error、unsupported。                 | 无自动播放；文本回退；状态标签。          |
| ProgressTrack  | empty、partial、near-complete、complete。                                   | 可解释数值、非金币化、读屏进度语义。      |

## 7.3 每个组件的横向验收

| 维度      | 测试方式                                           | 通过标准                                   |
| --------- | -------------------------------------------------- | ------------------------------------------ |
| 日 / 暗色 | 主题开关与系统偏好。                               | 文字、边框、焦点和状态均可辨；暗色非纯黑。 |
| 无障碍    | 语义查询、键盘、焦点顺序、aria-live、名称 / 描述。 | 不依赖 data-testid 完成交互主测试。        |
| 触控      | 窄屏与粗指针视图。                                 | 主要目标至少 44px；操作不靠 hover。        |
| 减少动态  | prefers-reduced-motion。                           | 位移 / 缩放关闭；保留必要短淡化。          |
| 减少透明  | backdrop-filter 不可用 / reduced transparency。    | 玻璃层有实色回退，内容层始终实色。         |
| 长文本    | 中文、日文、英文、IPA 与 200% 字体。               | 无裁切、横向滚动或按钮被挤出。             |
| 安全区域  | 模拟底部 safe-area 与软键盘。                      | 输入和提交不被固定层遮挡。                 |
| 离线      | 全局 offline 标记。                                | 基础组件仍可用；AI 状态明确 unavailable。  |

进入真实页面的门槛 组件只有在 /ui-lab 中通过主题、状态、键盘、触控、读屏、离线、减少动态、长文本与窄屏检查，才能被生产页面使用。

## 7.4 UI Lab 测试分层

- Vitest + Testing Library：状态、语义、键盘、IME、回调与 aria-live。

- Playwright：真实浏览器中的暗色、窄屏、触控尺寸、减少动态、离线导航与视觉状态 smoke。

- 人工检查：玻璃回退、柔光不抢焦点、长日文 / IPA 排版、安全区域和 PWA 安装模式。

- Phase 0 不设置大规模截图基准；先验证关键状态，等组件稳定后再决定是否增加视觉回归。

# 8. 第一个纵向切片规划

## 8.1 切片范围

首个切片是架构探针，不是完整学习页：使用一个固定日语词条和一个 choice Question fixture，走通提交、判题、LearningEvent、ReviewState 与 Feedback。它证明依赖方向和事务语义，暂不证明课程、迁移或 AI 价值。

| 包含                                                                                                                                                               | 不包含                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 固定日语词条 / Question fixture；ChoiceAnswer；确定性 Judge；Fake Clock / ID；Fake Repository / Transaction；Fake ReviewScheduler；FeedbackModel；契约和集成测试。 | 真实 v1 迁移、真实 FSRS 算法、今日计划、用户画像、TTS、AI、正式学习页、完整 Dexie 表。 |

## 8.2 调用顺序

- UiLab fixture 提供已通过 Question v1 校验的 ja choice 题目与 targetRef。

- ChoiceAnswer 只提交 optionId，不计算正确性。

- submitAnswer Use Case 读取 Question，并调用纯 Judge。

- Use Case 使用 Fake Clock / Id 构造 answer-submitted LearningEvent v1。

- Use Case 把当前 ReviewState 和 Judgement 交给 ReviewScheduler Port。

- LearningTransaction 原子提交事件、会话检查点与新 ReviewState；重复 idempotencyKey 返回已有结果。

- 提交成功后构造 FeedbackModel；UI 才进入 correct / incorrect 状态。

- 若提交失败，UI 保持当前题目和用户答案，展示可恢复错误；不得显示“已记录”。

## 8.3 涉及文件

| 层             | 文件                                                                 | 验证点                              |
| -------------- | -------------------------------------------------------------------- | ----------------------------------- |
| Schema         | question-v1、learning-event-v1、judgement-v1 与 fixtures             | 外部数据先验证，未知版本拒绝。      |
| Domain         | Judge、AnswerNormalizer、LearningEvent factory、ReviewScheduler Port | 纯函数 / 纯协议，无 React / Dexie。 |
| Application    | submitAnswer、FeedbackModel、LearningTransaction                     | 编排与错误映射。                    |
| Infrastructure | Fake adapters；可选 Dexie open smoke                                 | 不泄漏实现类型。                    |
| UI             | QuestionFrame、ChoiceAnswer、InlineFeedback、ProgressTrack           | 只消费 ViewModel 与回调。           |
| Tests          | contract、judge unit、submit integration、ui-lab component / e2e     | 一条路径覆盖全部边界。              |

## 8.4 切片验收标准

- 同一 Question fixture 在 Schema、Judge、Use Case 与 UI 测试中引用同一版本，不复制结构。

- 正确 / 错误两条路径均产生可验证的 Judgement 和 LearningEvent。

- 相同 idempotencyKey 重试不会产生第二条事件或重复更新 ReviewState。

- 事务失败时三项均不提交；UI 保留输入并允许重试。

- domain 测试可在无 DOM、无 IndexedDB、无网络环境运行。

- UI 测试使用角色、名称和可见反馈查询，不以内部 class 判断业务结果。

## 8.5 Phase 0 与 Phase 1 的交接

| Phase 0 保留                  | Phase 1 替换 / 扩展                                |
| ----------------------------- | -------------------------------------------------- |
| Fake Clock / ID               | Web Clock / Crypto Id adapter；契约不变。          |
| Fake Repository / Transaction | Dexie Repository 与真实原子事务；Port 不变。       |
| Fake ReviewScheduler          | 固定版本 ts-fsrs adapter；输入 / 输出契约不变。    |
| 固定 Question fixture         | 迁移词条、模板题与 validated Question Repository。 |
| UI Lab slice                  | 真实 StudySession 页面复用同一组件。               |
| 一题反馈                      | 题目队列、Session checkpoint、结果页和下一次计划。 |

# 9. Git 提交规划

提交应让每一步都可构建、可审查、可回退。以下顺序允许 AI 每次只理解一个边界，并避免一个“初始化提交”包含数百个无法判断来源的文件。

| 顺序 | 建议 commit                              | 内容                                                                | 完成检查                        |
| ---- | ---------------------------------------- | ------------------------------------------------------------------- | ------------------------------- |
| 1    | chore: init react typescript vite        | Vite React TS、Node / npm 固定、基础 README、lockfile。             | dev、build。                    |
| 2    | chore: add quality gates                 | ESLint、Prettier、Vitest、Testing Library、Playwright、CI。         | format、lint、typecheck、test。 |
| 3    | chore: add pwa app shell                 | manifest、icons、injectManifest SW、更新 / 离线状态。               | preview、SW、offline route。    |
| 4    | docs: freeze architecture boundaries     | ARCHITECTURE.md、AGENTS.md、ADR-0001—0003。                         | 人工核对禁止 import。           |
| 5    | feat: freeze question and judgement v1   | Zod source、JSON Schema、valid / invalid fixtures、contract tests。 | contracts:export 无 diff。      |
| 6    | feat: freeze learning event and ports v1 | Event、Repository / Clock / Id / Transaction Ports 与 tests。       | 未知版本 / 重试语义测试。       |
| 7    | feat: add design tokens and ui lab shell | tokens、主题、/ui-lab 路由、Button / QuestionFrame。                | 日 / 暗、200% 字体。            |
| 8    | feat: add answer components ui lab       | Choice、Text、Feedback、AI Bubble、Audio、Progress 状态矩阵。       | 组件与 Playwright smoke。       |
| 9    | test: add first vertical slice probe     | Fake Ports、submitAnswer、端到端探针。                              | 事件、事务、反馈路径。          |
| 10   | docs: close phase 0 baseline             | DoD、依赖清单、已知限制、初始化记录。                               | 全量 npm run check + e2e。      |

- 每个提交只修改一个主要层或一份协议；格式化大改不得与语义改动混合。

- Schema 生成物与对应 Zod 源放在同一提交。

- 完成后创建轻量 tag：phase0-contracts-v1；它标记可开始 Phase 1 的基线，不代表 MVP 发布。

# 10. AI 辅助开发规则

## 10.1 每次修改前

- 先读取 AGENTS.md、ARCHITECTURE.md 与相关 contract；说明目标、影响层、预计文件和不做事项。

- 确认任务属于 Phase 0；若触及 Phase 1—3，停止并拆出独立 issue。

- 先列现有调用链与测试；不根据文件名猜测职责。

- 若需新增依赖，说明原生能力为何不足、包的运行时位置、体积 / 维护 / 安全影响和移除方案。

## 10.2 修改规则

| 规则               | 强制要求                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| 不跨层             | UI 只能调用 Application facade / callback；Domain 不 import React / Dexie；组件不调用 AI / FSRS。 |
| 不扩依赖           | 未经任务明确批准不得修改 package.json；不为一个函数引入工具库。                                   |
| 不复制契约         | Question / Event 类型从 Zod 源推导；禁止再写 interface 模拟同一协议。                             |
| 外部输入为 unknown | AI、IndexedDB 导入、备份、迁移和 URL 数据必须 parse 后进入领域。                                  |
| 无任意 any         | 边界不使用未解释 any、双重断言或 @ts-ignore；必要例外写明原因和退出条件。                         |
| 不静默改语义       | 字段同名但含义改变必须升版本；不能只让测试适配新含义。                                            |
| 不大扫除           | 修复一个问题不顺带改目录、命名、格式和无关组件。                                                  |
| 保留事实           | 不 update LearningEvent；不把 Profile 推断或 AI 文本写成事实。                                    |
| 事务纯净           | Dexie 事务内不等待网络、TTS、AI 或计时器。                                                        |
| UI 状态显式        | 使用判别联合 / data-state / aria-*；不靠多组松散 boolean 猜状态。                                 |

## 10.3 Schema 修改门槛

- 说明兼容性：旧数据能否读取、旧 consumer 是否继续工作、是否需要迁移。

- 同时更新 Zod、导出 JSON Schema、有效 / 无效 fixtures、contract tests、ADR 与 changelog。

- Question type 新增还必须有 renderer、judge、event mapper 与无障碍方案；Phase 0 默认拒绝新增。

- LearningEvent 变更不得重解释历史；新增 projector 行为必须能从固定事件流重放。

- AI Task 变更必须说明 Gateway / client 两侧影响；模型输出自报的版本不能替代本地验证。

## 10.4 AI 交付说明格式

| 部分     | AI 必须报告                                                   |
| -------- | ------------------------------------------------------------- |
| 范围     | 改了哪些层和文件；明确未修改内容。                            |
| 依赖方向 | 是否新增 import；为什么没有违反边界。                         |
| 契约影响 | Schema / Port / Event / migration 是否变化。                  |
| 验证     | 实际运行的 format、lint、typecheck、test、build、e2e 及结果。 |
| 风险     | 尚未覆盖的浏览器、离线、迁移、IME 或无障碍情况。              |
| 回滚     | 可回退的提交或最小恢复方式。                                  |

## 10.5 禁止的 AI 行为

- 一次生成整套未来目录和空接口。

- 为通过测试而删除断言、扩大 unknown 字段、使用 catch-all 或关闭 strict。

- 直接编辑 docs/contracts 中的 JSON Schema 生成物。

- 把 raw AI 输出、HTML 或供应商响应直接交给 React。

- 用 Zustand persist、LocalStorage 或组件 state 复制 IndexedDB 业务事实。

- 未经说明重命名事件、改变 FSRS 评分语义或改写 v1 身份映射。

- 在同一提交中升级依赖、改 Schema、重构目录并实现功能。

# 11. Phase 0 完成标准

## 11.1 自动化门禁

| 检查     | 通过标准                                                                       | 失败即阻断 |
| -------- | ------------------------------------------------------------------------------ | ---------- |
| 安装     | 全新目录 npm ci 成功，只有 package-lock.json。                                 | 是         |
| 格式     | format:check 无 diff。                                                         | 是         |
| Lint     | 含目录 import 限制，0 error。                                                  | 是         |
| 类型     | TypeScript strict 与附加选项 0 error。                                         | 是         |
| 契约     | Question / Event / Judgement / AI Task valid / invalid fixtures 全部符合预期。 | 是         |
| 单元测试 | Judge、Normalizer、事件工厂、幂等与 Fake Scheduler 通过。                      | 是         |
| 组件测试 | 八类组件的关键状态、键盘、IME 与可访问名称通过。                               | 是         |
| 集成测试 | submitAnswer 探针正确、错误、重试与事务失败路径通过。                          | 是         |
| 构建     | 生产 build 成功；无 API key、raw fixture 或 UI Lab 默认生产入口。              | 是         |
| E2E      | preview 下 /、/ui-lab 测试构建、404、暗色、离线导航和更新状态 smoke 通过。     | 是         |

## 11.2 架构验收

- src/domain 在 Node 环境单独测试，不依赖 DOM、React、Dexie、fetch 或 Service Worker。

- 页面和组件没有 Dexie、AI SDK、ts-fsrs 或 Workbox import。

- Zustand store 不包含 User、Question、LearningEvent、ReviewState 或 Repository 数据副本。

- Question 与 LearningEvent 只有一个运行时 Schema 来源，JSON Schema 可重复生成。

- Service Worker 不 import domain / application / db，也不写 IndexedDB。

- Repository Port 的测试替身与 Dexie adapter 骨架共享同一契约测试。

## 11.3 PWA 与 UI 人工验收

| 项目            | 完成标准                                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| 安装            | 在受支持 Chromium 浏览器的 build preview 上 manifest 无错误、图标正确、可安装并以 standalone 打开。[S18] |
| 离线            | 安装 / 首次在线加载后，断网仍能进入 App Shell 与测试构建的 /ui-lab；不出现无限刷新。                     |
| 更新            | 新 SW 到达时显示非阻断提示；不自动丢失当前页面状态。                                                     |
| 主题            | 日 / 暗模式、系统切换和刷新后首屏无明显闪烁；LocalStorage 只允许极小主题启动标记。                       |
| 无障碍          | 键盘遍历、焦点可见、200% 字体、读屏名称与 reduced-motion 通过清单。                                      |
| 触控 / 安全区域 | 窄屏主要目标 44px；底部安全区域和软键盘不遮挡 TextAnswer。                                               |

## 11.4 Phase 0 交付包

- 可重复安装与构建的仓库。

- 五份 v1 contract 的 Zod 源、JSON Schema、fixtures 与变更说明。

- /ui-lab 的八类组件状态矩阵和测试。

- 一个首题纵向切片探针与 Fake Ports。

- PWA App Shell、manifest、SW 与离线 / 更新 smoke。

- ARCHITECTURE.md、AGENTS.md、ADR、CI 与 Phase 0 完成清单。

- phase0-contracts-v1 tag。

## 11.5 以下情况不算完成

- 只有 npm run dev 可运行，但 build、CI、离线或测试失败。

- 目录很多，但没有契约 fixtures 或真实调用链。

- UI Lab 只有漂亮默认态，没有 loading、error、disabled、暗色和键盘状态。

- Question interface 能编译，但 raw JSON 未经过运行时校验。

- 纵向切片由组件直接判题、写 Dexie 或调用 ReviewScheduler。

- Phase 0 已出现真实 AI、完整迁移、账号、ASR、高级题型或正式课程页面。

# 12. 推荐执行顺序

| 步  | 工作                                               | 退出条件                        |
| --- | -------------------------------------------------- | ------------------------------- |
| 0   | 确认新仓库、Node / npm 和范围非目标。              | README 写明 Phase 0。           |
| 1   | Vite React TS 初始化并锁定依赖。                   | clean install + build。         |
| 2   | 配置格式、lint、strict、Vitest、Playwright 与 CI。 | 空骨架全绿。                    |
| 3   | 建立 App Shell、router 与 PWA injectManifest。     | build preview 可安装 / 离线。   |
| 4   | 写 ARCHITECTURE.md、AGENTS.md 与首批 ADR。         | 依赖规则可自动执行。            |
| 5   | 冻结 Question / Judgement v1。                     | valid / invalid fixtures 通过。 |
| 6   | 冻结 LearningEvent / Repository / AI Task v1。     | 重试、未知版本与事务语义通过。  |
| 7   | 落 Design Token 与 /ui-lab shell。                 | 日 / 暗、媒体偏好可切换。       |
| 8   | 完成八类组件状态矩阵。                             | component tests + 人工清单。    |
| 9   | 完成首个纵向切片探针。                             | 一题跨层、无跨层 import。       |
| 10  | 全量验收、记录已知限制并打 tag。                   | Phase 0 DoD 全部勾选。          |

最终推荐 先把可执行的边界做成 CI 与 contract tests，再开始真实迁移、FSRS 和每日学习。Phase 0 应短而硬：它的价值是减少后续返工，不是提前展示完整产品。

# 附录 A：Phase 0 决策速查

| 主题       | 推荐                                      | 暂不采用                         |
| ---------- | ----------------------------------------- | -------------------------------- |
| 仓库       | 新 zhongri-v2；单 package；npm lockfile。 | v1 分支续写；monorepo。          |
| 运行时     | Node 24 LTS exact patch。                 | Current 非 LTS；本机与 CI 漂移。 |
| React 路由 | react-router Declarative。                | Framework mode / SSR。           |
| 状态       | local state + Zustand ViewModel。         | 业务事实 persist。               |
| Schema     | Zod 4 → JSON Schema。                     | 手写多份类型。                   |
| 测试       | Vitest + Testing Library + Playwright。   | 只测快照；只做人工点击。         |
| PWA        | injectManifest；小型自定义 SW。           | SW 中放领域逻辑。                |
| 组件实验   | /ui-lab。                                 | Storybook。                      |
| AI         | 协议 + fixtures。                         | SDK、模型调用、聊天 UI。         |
| FSRS       | 先 Port + Fake，Phase 1 接 adapter。      | 组件直接 import ts-fsrs。        |
| 迁移       | fixtures + 验收计划。                     | Phase 0 实现完整迁移。           |

# 附录 B：官方技术参考

以下资料用于核对截至 2026-07-24 的初始化工具链。版本选择仍以已冻结的钟日技术架构和 package-lock.json 为准。

S01 Node.js Download 查看原始页面 当前 Node 24 为 LTS；初始化时固定具体 patch。

S02 Vite Getting Started 查看原始页面 React TypeScript 模板、Node 兼容线与静态构建。

S03 React Router Declarative Installation 查看原始页面 Vite SPA 只安装 react-router 并使用 Declarative Router。

S04 Dexie TypeScript 查看原始页面 Dexie 4 的 TypeScript 与 IndexedDB 使用。

S05 Zustand TypeScript Guide 查看原始页面 轻量 React 状态管理与 TypeScript。

S06 Zod JSON Schema 查看原始页面 Zod 4 原生 JSON Schema 转换，可用于结构化 AI 协议。

S07 Vitest Configuration 查看原始页面 独立 vitest.config、environment、setupFiles 与 coverage。

S08 React Testing Library Setup 查看原始页面 React 组件测试环境与用户视角测试。

S09 jest-dom with Vitest 查看原始页面 Vitest setup 中使用 @testing-library/jest-dom/vitest。

S10 Playwright Web Server 查看原始页面 E2E 运行本地 preview server。

S11 Vite PWA injectManifest 查看原始页面 TypeScript 自定义 SW、Workbox precache 与 manifest 注入。

S12 Workbox injectManifest 查看原始页面 保留自定义 Service Worker 并注入预缓存清单。

S13 ESLint Getting Started 查看原始页面 ESLint Flat Config 基线。

S14 typescript-eslint Typed Linting 查看原始页面 类型感知 lint 与 projectService。

S15 Prettier Install 查看原始页面 本地锁定 Prettier 并使用 format check。

S16 npm ci 查看原始页面 CI 中根据 lockfile 做干净、冻结安装。

S17 TypeScript strict 查看原始页面 strict 启用更强类型检查。

S18 PWA Installation 查看原始页面 构建后的安装与 standalone 验证参考。

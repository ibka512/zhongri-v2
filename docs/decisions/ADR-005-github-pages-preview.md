# ADR-005：使用 GitHub Pages 发布开发预览

- 状态：已接受
- 日期：2026-07-24
- 对应任务：[Task 007](https://github.com/ibka512/zhongri-v2/issues/6)

## 背景

Task006 之后，学习演示已经能够在浏览器本地持久化和恢复，但产品负责人仍需克隆仓库、
安装依赖并启动开发服务器。项目当前是纯客户端 PWA，适合先建立稳定的 HTTPS 预览入口，
让每个合并到 `main` 的纵向切片都能直接验收。

GitHub Pages 项目站点部署在 `/zhongri-v2/` 子路径，而且不提供 SPA 服务端重写。直接使用
Browser History 路由会导致子页面首次打开或刷新时返回 404。

## 决策

1. GitHub Pages 只作为开发预览环境，不声明为正式产品或公共 Beta。
2. Pages 构建使用独立的 `pages` mode，把 Vite base、PWA scope、start URL 和导航回退
   固定在 `/zhongri-v2/`。
3. 客户端路由改用 Hash Router，确保静态主机不需要服务端重写；根入口自动进入学习演示。
4. `main` 的 push 和手动触发通过 GitHub Actions 构建并部署 `dist`。
5. Pull Request 通过普通 CI 和 `build:pages` 验证托管产物，但不部署临时环境。
6. Pages 构建完成后运行产物检查，拒绝根路径资源、错误 PWA scope 或错误导航回退。
7. 所有学习数据继续保存在当前浏览器的 IndexedDB；Pages 不提供账号、同步或后端。

## 影响

- 预览入口为 `https://ibka512.github.io/zhongri-v2/`。
- 内部路由显示为 `#/study-demo` 和 `#/ui-lab`。
- 本地开发仍使用根路径构建，不受 Pages 子路径影响。
- 未来采用支持 SPA rewrite 的正式托管或自定义域名时，可以通过独立任务恢复 History Router。
- 任何 AI、账号或同步能力都不能把密钥放入 Pages 前端，必须使用独立后端。

## 当前不包含

- 自定义域名、环境矩阵或每个 PR 的独立预览站。
- 后端、云数据库、账号、跨设备同步或秘密管理。
- 正式监控、分析、SLA 或公共 Beta 发布。

## 验证

- Pages 构建中的 HTML、manifest 和 Service Worker 使用 `/zhongri-v2/`。
- 根入口自动进入学习演示，Hash 路由刷新不依赖服务端重写。
- 自动化测试、类型检查、Lint、默认构建和 Pages 构建全部通过。
- 合并后 Pages workflow 能发布并返回站点 URL。

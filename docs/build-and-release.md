# 构建与 nightly 发布

本文面向主题维护者，说明从受维护源码到开发运行单元、生产运行单元和 nightly 分支的
长期边界。具体设置方法参见[超高级设置](./advanceSetting.md)，质量门禁参见
[测试与验证](./testing.md)。

## 源码与运行单元

仓库中的 PHP 模板、`includes/`、`libs/`、`assets/`、`scripts/`、测试和构建配置是受维护
输入。JavaScript 领域源码的连接顺序由 `scripts/header-sources.cjs`、
`scripts/void-sources.cjs` 和 `scripts/editor-sources.cjs` 定义，不能从已有生成文件反推。

构建链有四个不同层次：

```text
受维护源码 -> dev-build/ 或 build/ -> 已部署副本
```

- `dev-build/` 是完整、未压缩并保留逻辑资源名的开发运行单元，只用于本地调试。
- `build/` 是经过压缩和内容哈希处理的完整生产运行单元，也是唯一可发布形态。
- 已部署主题目录是可替换副本，不是源码，也不能证明它来自当前提交。
- `dev-build/`、`build/` 和 `temp/` 都是可删除、可重建且不纳入版本控制的输出。
- `docs/`、`tests/`、JavaScript 领域分片和 SCSS 源码不进入主题运行单元。

不要向 `assets/` 写入或提交生成的 `VOID.js`、`header.js`、`editor.js`、编译后 CSS、bundle
或源映射。开发和生产部署都必须整体替换运行单元，不能从不同构建中挑选单个文件混用。

## 权威命令

| 命令 | 职责 |
| --- | --- |
| `make dev-build` | 使用仓库本地 Gulp 生成完整 `dev-build/`，再执行开发输出合同检查。PHP 保持逻辑资源引用，JavaScript 与 CSS 不压缩。 |
| `make watch` | 先生成完整 `dev-build/`，再监听 SCSS、三组第一方 JavaScript、PHP、字体和运行资源，增量刷新对应开发输出。 |
| `make verify` | 执行 ESLint、全部 Node 测试、全部受跟踪 PHP 文件语法检查、自动发现的 PHP 合同测试、一次完整生产构建和 `git diff --check`。 |
| `make build` | 清理旧生产输出，以仓库本地 Gulp 生成 `build/`，再检查字体选择和完整生产输出合同。 |

这些命令在需要依赖时通过 `package-lock.json` 执行 `npm ci`。日常流程不依赖全局 Gulp。
`make build` 不会隐式运行 `npm run emotes:build`；修改表情受维护输入时必须先显式重建并
检查表情数据。

## 生产构建流程

`gulpfile.js` 的生产任务先清理 `build/`、临时 revision manifest 和源码目录中的历史开发
输出，再并行处理 CSS、JavaScript 与独立资源：

1. `assets/VOID.scss` 经 Sass、Autoprefixer 和压缩生成带内容哈希的主 CSS。
2. 第三方 CSS、后台 CSS 和表情选择器 CSS 分别处理，保持各自加载边界。
3. `assets/js/header/`、`assets/js/void/`、`assets/js/editor/` 按各自 source list 连接、
   压缩并生成 `header-[hash].js`、`VOID-[hash].js`、`editor-[hash].js`。
4. 页头依赖与前台依赖分别连接为 `bundle-header-[hash].js` 和 `bundle-[hash].js`。
5. `assets/check_update.js`、`assets/service-worker-registration.js` 以及表情选择器脚本保持
   独立，并分别生成内容哈希文件。
6. revision manifest 驱动 PHP 中逻辑资源名的引用改写；禁止在源码中硬编码某次构建的
   哈希文件名。
7. 根模板、`includes/`、`libs/`、许可证、README、设置示例、字体和必要运行资源被复制到
   `build/`，形成可独立部署的完整主题单元。

`npm run build:check` 会检查每类生产资源只存在一个哈希文件、PHP 确实引用它们、逻辑名
资源没有混入生产输出、运行时 PHP 与静态资源没有遗漏，以及源码、测试、SCSS、源映射和
文档专用文件没有泄漏到运行单元。`npm run fonts:check` 另行检查 Fontsource 的选择、路径、
内容和运行时引用。

## 页面加载关系

`includes/head.php` 依次加载页头依赖 `bundle-header.js`、内联序列化后的
`window.VOIDConfig`，再加载第一方 `header.js`。生产构建会把这些逻辑名改写为同次构建的
哈希资源。

`includes/footer.php` 先用 `application/json` 节点提供 Service Worker 配置，再依次加载
`service-worker-registration.js`、前台依赖 `bundle.js` 和第一方 `VOID.js`。管理员配置的
`pjaxreload` 仍由模板按请求输出，不属于静态资源连接过程。

Typecho 的文章和独立页面后台 Hook 调用 `Utils::addButton()`，按既有边界加载独立的表情
选择器、`editor.js`、表情选择器样式和 `editor-admin.css`；生产引用同样由构建改写为内容
哈希文件。编辑器没有进入前台 `bundle.js`。

## Service Worker 一致性

`assets/service-worker-registration.js` 是页面侧的注册、所有权和卸载运行时；它作为主题内
独立哈希资源发布。`assets/VOIDCacheRule.js` 是实际 Worker 源码，构建会把它复制到主题
运行单元，但站点使用根 scope 时仍需把同一构建中的该文件同步到站点根目录。

PHP 引用、哈希资源和 Worker 缓存规则必须来自同一源码提交。若混用不同构建，页面可能
引用已不存在的哈希文件，或由旧 Worker 缓存、清理和返回另一组资源。已有 `build/` 的
存在不代表它是当前源码的产物；发布或部署前必须从确定的源码状态重新构建整个运行单元。

## CI 与 nightly 权限

`.github/workflows/ci.yml` 在 pull request 和 `master` push 上启动，工作流默认只有
`contents: read`：

- `verify` 使用 Node.js 26、npm 11 和 PHP 8.5 执行 `make verify`，并上传以当前
  `github.sha` 命名的生产构建 artifact。
- `php-contracts` 在 PHP 7.0 与 PHP 8.5 上分别执行 PHP 语法检查和合同测试。该矩阵验证
  PHP 兼容范围，不会启动真实 Typecho 站点。
- `nightly` 只在 `master` push 上运行，并同时依赖 `verify` 与 `php-contracts` 成功。只有
  这个 job 获得 `contents: write`，且只下载同一 `github.sha` 的已验证 artifact 发布到
  `nightly`，不会重新从另一份工作区构建。

工作流和 nightly job 都有并发控制，用于取消同一范围内已经过期的运行。pull request
不会获得发布权限，也不会执行 nightly 发布。`master`、`nightly` 和任何已部署副本承担
不同角色：`master` 保存源码，`nightly` 保存 CI 发布的生产构建，部署副本只反映某次明确
部署的运行单元。

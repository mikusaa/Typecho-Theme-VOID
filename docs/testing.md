# 测试与验证

VOID 的自动化以快速源码合同、PHP CLI 合同和构建输出检查为主。它们适合阻止已知兼容
边界漂移，但仓库目前没有可重复启动真实 Typecho 的 HTTP 或浏览器冒烟自动化；涉及请求
生命周期和界面的改动仍需选择真实环境验证。

## 权威完整门禁

`make verify` 当前按以下顺序执行：

```text
npm run lint
-> npm test
-> npm run lint:php
-> npm run test:php
-> make build
-> git diff --check
```

其中：

- `npm run lint` 使用 ESLint 检查 Gulp、脚本和第一方浏览器 JavaScript。三组领域源码通过
  source list 进入 lint；纯第三方 vendored 文件按配置排除。
- `npm test` 先运行 `npm run emotes:check`，再使用 Node 内置 test runner 执行
  `tests/js/*.test.cjs`。
- `npm run lint:php` 通过 `git ls-files` 找出全部受跟踪 `*.php`，逐文件执行 `php -l`。
- `npm run test:php` 递归发现 `tests/php/` 中以 `Test.php` 结尾的文件，并把每个文件交给
  独立 PHP 进程，避免 Typecho stub、全局函数和类在测试间互相污染。
- `make build` 生成生产运行单元，并执行 Fontsource 与生产输出合同检查。
- 最后的 `git diff --check` 检查空白错误。

新增 PHP 合同文件会被测试 runner 自动发现。由于 PHP 语法清单只包含 Git 已跟踪文件，
新测试在最终权威验证前必须进入 Git index；相关 Node 合同会检查受跟踪 PHP 测试与自动
发现结果一致。

## 各层能证明什么

### JavaScript 合同

Node 测试直接加载领域源码或通过受控 DOM、事件、网络与计时器 fixture 执行行为。它们能
证明 source list 完整和顺序稳定、公开全局仍存在、重复初始化/销毁与异步失效符合合同，
并覆盖 PJAX 事件、评论、图片、Gallery、主题颜色、编辑器、Service Worker 等已明确建模
的行为。

这些测试不是完整浏览器。fixture 无法证明真实布局、CSS 级联、焦点环、移动键盘、原生
图片解码、浏览器历史、Service Worker 控制权、第三方脚本兼容或 Typecho 生成的最终 DOM。

### PHP 语法与合同

`php -l` 能证明受跟踪 PHP 在当前解释器上可解析。PHP 合同能证明 `Contents` 管线、HTML
scanner、Repository、设置 schema、表单生成、输出转义和模板连接点等已建模的输入输出。
每文件独立进程保证测试 stub 不互相泄漏，但不会自动获得真实 Typecho 请求状态。

PHP CLI 合同不能证明 Typecho 路由、Hook 注册时机、数据库驱动、永久链接、Cookie、后台
保存、动态 404、Feed 响应头或模板完整渲染。Typecho 1.2/1.3 分支的 stub 覆盖也不等于
两个版本的真实站点都已启动验证。

### 构建输出检查

`npm run dev-build:check` 检查开发运行单元包含所有运行时 PHP、根文件、字体和静态资源，
并逐字确认 `header.js`、`VOID.js`、`editor.js` 按权威清单连接。

`npm run build:check` 检查生产输出每类哈希资源唯一、PHP 引用已改写、逻辑名资源不存在、
运行资源完整且源码/测试/SCSS/源映射未泄漏。Fontsource 检查验证选定字体文件、内容、路径
与 PHP 引用。

这些检查只能证明目录内部自洽，不能证明某个已部署目录来自刚生成的 `build/`，也不能
证明站点根 `VOIDCacheRule.js`、Web 服务器、PHP OPcache、浏览器缓存或当前 Service Worker
已经同步。

## CI 范围

pull request 与 `master` push 都运行只读验证。`verify` job 在 PHP 8.5 上执行完整
`make verify` 并上传生产 artifact；独立的 `php-contracts` job 在 PHP 7.0 与 PHP 8.5 上
执行 `npm run lint:php` 和 `npm run test:php`。

PHP 7.0 是当前 CI 的最低 PHP 检查端，PHP 8.5 是当前维护检查端。CI 没有真实安装 Typecho，
也没有针对 Typecho 版本、数据库、HTTP、PJAX 或浏览器的矩阵。只有 `master` push 的两个
验证 job 都成功后，nightly job 才能使用同一提交的 artifact 发布；权限细节参见
[构建与 nightly 发布](./build-and-release.md)。

## 按修改范围选择验证

迭代时可以先运行聚焦测试，交付前再扩大到完整门禁：

| 修改范围 | 最低自动化方向 | 仍需的真实验证 |
| --- | --- | --- |
| `assets/js/header/` 或 source list | 对应 header 行为与 `header-source-layout.test.cjs`；合并前运行 `npm run lint`、`npm test`，涉及构建顺序时运行 `make verify`。 | 直接加载、主 PJAX、前进/后退、页头/导航/登录/Masonry/主题模式，桌面与移动端。 |
| `assets/js/void/` 或 source list | 对应领域测试、`void-source-layout.test.cjs`、`void-pjax-events.test.cjs`；合并前运行 `npm run lint`、`npm test`。 | 主 PJAX 与评论 PJAX、快速导航、内容增强、评论、图片交互和焦点恢复。 |
| `assets/js/editor/` 或 source list | editor menu、fields、switch、banner 与 source layout 合同；合并前运行 `npm run lint`、`npm test`。 | Typecho 文章和独立页面后台、原生字段提交、光标/选区、键盘菜单、重复初始化与异步图片探测。 |
| `libs/Content/`、`libs/Repository/`、`libs/Contents.php` 或 Hook | `npm run lint:php`、`npm run test:php`；发布或共享边界改变时运行 `make verify`。 | 文章、页面、Gallery、归档、搜索、空站、动态 404、Feed 的 HTTP 状态与完整正文。 |
| `libs/Settings/`、设置表单、示例或前端配置 | 设置 schema/form PHP 合同；影响 `VOIDConfig` 或 editor 时再运行相关 Node 测试。 | 后台读取与保存、旧配置回退、文章字段、移动分支和页面输出的实际值。 |
| `assets/VOIDCacheRule.js` 或注册脚本 | Service Worker 注册与缓存合同、`npm run lint`、`npm test`；发布前运行 `make verify`。 | 真实浏览器安装/激活/控制、启用/禁用、旧注册迁移、缓存清退和当前哈希资源。 |
| Gulp、Makefile、package scripts、source list 或 CI | 构建工作流、源码布局、字体和输出合同；执行完整 `make verify`。 | 对部署流程有影响时确认完整运行单元和实际加载资源来自同一构建。 |

## 真实 Typecho、HTTP 与浏览器

自动化之外，根据风险检查：

- 首页、文章、独立页面、Gallery、归档、搜索、空站点和动态 404。
- 直接加载、主 `#pjax-container`、评论 `#comments`、快速连续导航和前进/后退。
- HTTP 状态、完整响应正文、PHP 日志及页面实际引用的哈希资源。
- 评论开启/关闭、访客/登录用户，以及配套插件缺失与启用状态。
- 桌面、约 390px 手机和受影响的中间断点；浅色、深色与减少动态效果。
- 键盘操作、焦点恢复、长中文、长 URL、代码、图片和水平溢出。
- Service Worker 的注册、scope、controller、旧缓存清退和站点根 Worker 内容。

目前这些场景没有仓库内的统一真实冒烟 runner。人工或临时浏览器验证必须如实报告环境、
范围和未覆盖项，不能把计划中的真实冒烟自动化描述为已经存在。

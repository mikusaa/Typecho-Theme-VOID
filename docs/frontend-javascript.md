# 前台 JavaScript 架构

VOID 的主要前台主题代码按领域维护在 `assets/js/void/` 与 `assets/js/header/`。两组权威
加载顺序分别只定义在 `scripts/void-sources.cjs` 和 `scripts/header-sources.cjs`；Gulp
生产构建、开发构建、lint 和测试必须读取对应清单，不能各自维护第二份顺序。
独立的 `assets/service-worker-registration.js` 负责 Service Worker 的注册、所有权记录、
旧 Worker 迁移和安全卸载，不属于两个连接脚本的生命周期。

## 构建模型

这些文件是传统浏览器脚本，不是 ES Modules。生产构建按清单顺序连接源码，压缩并加上
内容哈希，最终仍只发布一个 `VOID-[hash].js` 和一个 `header-[hash].js`。`make dev-build`
会在独立的 `dev-build/` 中生成完整、未压缩且使用逻辑资源名的本地运行单元，不会把
`VOID.js`、`header.js`、`VOID.css` 或 bundle 写回 `assets/`。`make watch` 先生成该运行
单元，再根据对应源码清单持续更新它；生产 `build/` 始终由 `make build` 清理后完整生成。
Service Worker 管理脚本也作为独立内容哈希资源发布；模板仅通过不可执行的
`application/json` 节点传递启用或禁用配置。站点根目录和主题目录中的
`VOIDCacheRule.js` 仍必须来自同一次完整构建。

## 领域边界

- `content.js` 负责正文增强、表格、目录、排版和 MathJax。
- `dialog-scroll-lock.js` 提供对话框共享的滚动锁。
- `photo-sets.js`、`gallery.js` 和 `photo-viewer.js` 负责图片组、Gallery、PhotoSwipe
  和赞赏对话框。
- `runtime.js` 负责首次加载、主 PJAX 和评论 PJAX 的生命周期编排。
- `interactions.js` 负责投票和分享，`comments.js` 负责评论交互与提交。
- `bootstrap.js` 必须最后执行，负责 ready、运行时间、剪贴板和启动入口。

页头脚本保留 `TOC`、`VOID_Util`、封面与 Gallery 加载器、滚动器、控制面板和 `VOID_Ui`
等传统全局对象。`VOID_Ui` 的核心界面、登录、Masonry、主题颜色和手势实现分别维护，
`assets/js/header/bootstrap.js` 必须最后执行，并且只负责绑定一次卡片封面与全局 UI 事件。

## 接口与生命周期

PHP 模板直接使用 `VOID`、`VOID_Vote`、`Share` 和 `AjaxComment`，这些全局接口及其参数
属于兼容边界。其他既有顶层对象也继续保留全局可见性，源码拆分不得借机私有化。

组件必须同时支持首次加载与 PJAX 重建。持有监听器、观察器、定时器、请求或动态 DOM
的组件应继续提供幂等销毁路径；评论容器 `#comments` 的局部 PJAX 不得触发主容器
`#pjax-container` 的完整重建。

`VoidPjax` 启用后由其接管 `history.scrollRestoration`，为每个历史条目记录滚动坐标，
并在目标容器替换后恢复位置。不要改回浏览器自动恢复，否则 `popstate` 的异步请求期间会
把目标位置提前应用到仍在显示的旧容器；评论锚点可以在替换后的生命周期中继续覆盖该坐标。

新增领域文件时，必须加入相应的 source list。源码布局合同会拒绝遗漏、重复条目以及
不再最后执行的 `bootstrap.js`。

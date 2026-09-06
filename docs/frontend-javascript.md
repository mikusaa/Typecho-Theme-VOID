# 前端与编辑器 JavaScript

VOID 的第一方 JavaScript 使用传统浏览器脚本和全局对象，不使用 ES Modules。源码文件
可以按领域拆分，但连接顺序、公开全局和加载时副作用都是兼容契约。构建边界参见
[构建与 nightly 发布](./build-and-release.md)，验证范围参见[测试与验证](./testing.md)。

## 三组受维护源码

`assets/js/header/` 负责页头与跨页面 UI。唯一权威顺序位于
`scripts/header-sources.cjs`：

```text
toc.js
util.js
card-cover.js
gallery-lazyload.js
smooth-scroller.js
anchor-scroller.js
controller-panel.js
ui-core.js
login.js
masonry.js
theme-mode.js
gestures.js
bootstrap.js
```

其中 `toc.js` 与 `util.js` 提供基础状态和工具；封面、Gallery 懒加载、滚动与锚点、控制
面板分别拥有自己的生命周期；`ui-core.js` 建立 `VOID_Ui` facade，登录、Masonry、主题
颜色和手势文件继续扩展这个对象。`bootstrap.js` 必须最后连接，并且只执行一次
`VOID_CardCover.bind()` 与 `VOID_Ui.bindGlobalEvents()`。

`assets/js/void/` 负责正文、PJAX 和主要前台交互。唯一权威顺序位于
`scripts/void-sources.cjs`：

```text
content.js
dialog-scroll-lock.js
photo-sets.js
gallery.js
photo-viewer.js
runtime.js
interactions.js
comments.js
bootstrap.js
```

`content.js` 负责正文排版增强、代码、表格、目录与 MathJax；图片组、Gallery、图片查看器
和赞赏对话框由相邻领域文件负责；`runtime.js` 编排首次加载、主内容 PJAX 与评论 PJAX；
`interactions.js` 和 `comments.js` 分别负责投票/分享与评论。`bootstrap.js` 必须最后连接，
先按需绑定 PJAX 生命周期，再执行首次 `VOID.init()`，并负责运行时间与代码复制入口。

`assets/js/editor/` 只服务 Typecho 文章和独立页面后台。唯一权威顺序位于
`scripts/editor-sources.cjs`：

```text
menu.js
banner-meta.js
fields.js
bootstrap.js
```

- `menu.js` 拥有 Markdown 插入、VOID 菜单、Alert/图集入口和表情选择器适配。
- `banner-meta.js` 拥有头图尺寸探测、版本化元数据解析/序列化、陈旧异步响应失效和销毁。
- `fields.js` 拥有 Typecho 自定义字段提取、分组、原生字段同步、分段控件、开关和字段联动。
- `bootstrap.js` 是唯一的 jQuery DOM-ready 入口，依次启动菜单、头图元数据和字段增强。

新增、删除或重排领域文件时，必须先修改对应 source list。Gulp 的生产连接、开发连接和
watch、ESLint、测试 helper 与开发输出审计共同读取这些清单；不得在其他入口复制第二份
顺序。

## 生产资源边界

三组源码在生产中仍分别只发布一个文件：`header-[hash].js`、`VOID-[hash].js` 和
`editor-[hash].js`。源码分片不会进入 `build/`。

以下第一方或适配层保持独立，不并入三组领域脚本：

- `service-worker-registration-[hash].js`：页面侧 Worker 注册、所有权、迁移与安全卸载。
- `check_update-[hash].js`：后台主题更新检查。
- `assets/libs/emotes/emote-picker-[hash].js`：前台与后台共用的表情选择器内核。
- `assets/libs/pjax/void-pjax.js`：第一方维护的 PJAX 适配实现，随前台依赖连接进入
  `bundle-[hash].js`。

其余 `assets/libs/` 浏览器依赖由 Gulp 按既有页头或前台 bundle 边界连接，或以静态树
复制。它们的版本、许可证和升级来源属于第三方资源治理；本架构文档只规定第一方适配器、
领域源码和构建输出的所有权边界。

## jQuery 边界

主题不在前台打包或提供全局 `$` / `jQuery`，第一方前台源码与模板也不调用它们。前台交互
使用原生 DOM、`CustomEvent`、`fetch` 和浏览器 API。部分 vendored 库保留上游的可选
jQuery 适配代码，但主题只使用其原生接口；外部自定义脚本若需要 jQuery，必须由使用方
自行加载和管理。

后台编辑器是明确例外：`assets/js/editor/` 使用 Typecho 管理端提供的 jQuery，并只通过
`admin/write-post.php` 与 `admin/write-page.php` Hook 加载。编辑器源码和 jQuery 都不得
复制到主题前台。表情选择器内核本身保持可由前台和后台调用，其宿主适配分别归所属领域
管理。

## 公开入口与连接顺序

经典脚本全局是模板、相邻脚本或现有自定义代码可见的兼容面。主要入口包括：

- 页头：`TOC`、`VOID_Util`、`VOID_CardCover`、`VOID_GalleryLazyload`、
  `VOID_SmoothScroller`、`VOID_AnchorScroller`、`VOID_ControllerPanel`、`VOID_Ui`。
- 前台：`VOID_Content`、`VOID_DialogScrollLock`、`VOID_PhotoSets`、`VOID_Gallery`、
  `VOID_PhotoSwipe`、`VOID_RewardDialog`、`VOID`、`VOID_Vote`、`Share`、`AjaxComment`。
- 后台：`VOID_Editor_Menu`、`VOID_BannerMeta`、`VOID_Editor_Admin`，以及既有的文本插入和
  编辑器启动函数。

源码拆分不得借机改名、私有化或改变这些对象的调用形态。页头依赖必须先于 header 领域
脚本，`window.VOIDConfig` 必须在 `header.js` 前建立；前台依赖必须先于 `VOID.js`。编辑器
必须在 Typecho 编辑器 DOM 与 jQuery 可用后，通过唯一 ready 入口初始化。

## 首次加载与 PJAX 生命周期

每个操作可替换 DOM 的组件都必须同时支持首次加载和 PJAX 重建。最低合同如下：

- 初始化可重复调用，但不得重复创建 DOM、监听器、观察器、计时器、请求或全局状态。
- 持有资源的组件提供幂等销毁或暂停路径，并在 `pjax:beforeReplace` 前释放旧 DOM。
- 主容器 `#pjax-container` 与评论容器 `#comments` 分开判断；评论分页不能触发整页重建。
- PJAX 生命周期只依赖一次原生 `CustomEvent` 派发，并保留 `detail.options`、
  `detail.args` 和旧版末尾 `options` 回退。
- 异步图片、MathJax、登录请求、评论提交和其他延迟工作使用 generation、token 或
  `AbortController` 失效；旧响应不得写入已销毁或替换的节点。
- 关闭菜单、对话框、评论线程或重排内容后，保留原有焦点、选区和滚动位置；键盘触发的
  流程应把焦点恢复到可预期控件，且不得因恢复焦点强制滚动。
- 动画与媒体加载遵守 `prefers-reduced-motion`，禁用装饰性动效时不继续获取仅供动效的
  媒体。

`VOID.bindPjaxLifecycle()` 只绑定一次全局监听；`VOID.init()` 负责当前文档的首次增强。
主 PJAX 在替换前销毁或暂停图片、Gallery、评论、Masonry、登录请求和排版异步工作，完成
后只对新容器重建。改变该顺序或公开事件参数时，必须同时审计模板、原生监听器、第三方
适配和自定义扩展点。

## 后台编辑器合同

编辑器必须同时适配文章和独立页面后台已有的 Typecho DOM 形态。`fields.js` 可以重组展示，
但原生可提交控件必须保留并保持同步；隐藏的 `bannerMeta` 也不能因移动字段而丢失。

菜单插入应保留 Markdown 文本、光标与选区；菜单和表情面板的打开、关闭、方向键、
`Tab`、`Escape` 与焦点恢复属于兼容行为。`banner-meta.js` 的异步图片探测必须只允许当前
URL 写入元数据，销毁后不得写回。重复执行后台初始化时，不得生成第二套菜单、字段控件
或监听器。

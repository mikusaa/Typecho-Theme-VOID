# 前台 JavaScript 架构

VOID 的前台主题代码按领域维护在 `assets/js/void/`。权威加载顺序只定义在
`scripts/void-sources.cjs`；Gulp 生产构建、开发构建和测试必须读取同一清单，不能各自
维护第二份顺序。

## 构建模型

这些文件是传统浏览器脚本，不是 ES Modules。生产构建按清单顺序连接源码，压缩并加上
内容哈希，最终仍只发布一个 `VOID-[hash].js`。`gulp dev` 会在 `assets/VOID.js` 生成
未压缩的开发副本；该文件不是受维护源码，也不得提交。

## 领域边界

- `content.js` 负责正文增强、表格、目录、排版和 MathJax。
- `dialog-scroll-lock.js` 提供对话框共享的滚动锁。
- `photo-sets.js`、`gallery.js` 和 `photo-viewer.js` 负责图片组、Gallery、PhotoSwipe
  和赞赏对话框。
- `runtime.js` 负责首次加载、主 PJAX 和评论 PJAX 的生命周期编排。
- `interactions.js` 负责投票和分享，`comments.js` 负责评论交互与提交。
- `bootstrap.js` 必须最后执行，负责 ready、运行时间、剪贴板和启动入口。

## 接口与生命周期

PHP 模板直接使用 `VOID`、`VOID_Vote`、`Share` 和 `AjaxComment`，这些全局接口及其参数
属于兼容边界。其他既有顶层对象也继续保留全局可见性，源码拆分不得借机私有化。

组件必须同时支持首次加载与 PJAX 重建。持有监听器、观察器、定时器、请求或动态 DOM
的组件应继续提供幂等销毁路径；评论容器 `#comments` 的局部 PJAX 不得触发主容器
`#pjax-container` 的完整重建。

新增领域文件时，必须加入 `scripts/void-sources.cjs`。源码布局合同会拒绝遗漏、重复条目
以及不再最后执行的 `bootstrap.js`。

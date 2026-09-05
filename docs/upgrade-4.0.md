# VOID 4.0 升级说明

## 前端脚本兼容

VOID 4.0 起不再在前台打包或提供全局 `$` 和 `jQuery`。主题自身的前台交互已经使用
原生 DOM、事件和 `fetch` API；从 3.x 升级前，应检查自定义 `head`、`footer`、
`pjaxreload` 脚本及第三方插件。仍依赖 jQuery 的代码必须迁移，或由使用方在依赖脚本
之前自行加载和管理 jQuery。

`pjaxreload` 设置中的代码会在主内容 PJAX 完成后执行，当前原生事件可通过
`event.detail.options` 读取请求选项：

```javascript
var options = event.detail && event.detail.options;
if (options && options.container === '#pjax-container') {
    // 重建自定义前台组件。
}
```

在自定义 `head` 或 `footer` 中直接监听生命周期时，使用原生事件：

```javascript
document.addEventListener('pjax:complete', function (event) {
    var options = event.detail && event.detail.options;
    if (!options || options.container !== '#pjax-container') {
        return;
    }

    // 重建自定义前台组件。
});
```

旧的 `$(document).on('pjax:complete', ...)` 写法在 VOID 4.0 中默认不再可用。站点若自行
加载 jQuery，仍可从 `event.originalEvent.detail.options` 取得同一个原生事件，但主题不再
提供或管理这项依赖。

后台 `assets/editor.js` 只由 Typecho 的文章/页面编辑器钩子加载，继续使用 Typecho 管理端
提供的 jQuery，不依赖 VOID 前台的 vendored jQuery。

## Feed 设置迁移

VOID 4.0 不再内置 Feed 正文截断，也不再覆盖 Typecho 的 `feedFullText` 设置。主题仍会将
图片、照片集、表情和 Alerts 转换为适合阅读器的静态内容；未安装 FeedEnhancer 时，正文
输出由 Typecho 的“聚合全文输出”和 `<!--more-->` 决定。

需要 Feed 截断、Media RSS 或浏览器预览时，可安装
[FeedEnhancer 1.1.0 或更高版本](https://github.com/mikusaa/Typecho-Plugin-FeedEnhancer)。
`theme:VOID` 与 `plugin:FeedEnhancer` 属于不同配置空间，旧主题设置不会自动迁移。需要接近
VOID 3.6 的默认输出长度时，可在插件中将正文开头长度设为 `300`；其他配置以插件文档为准。

# VOID 超高级设置

主题后台的“超高级设置”接受一个 JSON 对象。可以从
[`advanceSetting.sample.json`](./advanceSetting.sample.json) 复制所需字段，未填写的字段使用主题默认值。

JSON 不支持注释或末尾多余的逗号。保存前建议使用 JSON 校验工具检查；任一处语法错误都会使整份超高级设置无法解析。

## 站点与头图

| 设置 | 类型与默认值 | 说明 |
| --- | --- | --- |
| `name` | 字符串，`""` | 左上角站点名；留空时使用 Typecho 站点标题。 |
| `brandFont` | 对象 | 自定义站点名字体，包含 `src`、`style`、`weight`。`src` 留空时不加载；远程字体服务器需要允许跨域访问。 |
| `desktopBannerHeight` | 数字或空字符串，`""` | 桌面端头图最小高度，单位为视口高度百分比 `vh`。 |
| `mobileBannerHeight` | 数字或空字符串，`""` | 移动端头图最小高度，单位为 `vh`。 |

`brandFont` 示例：

```json
{
    "brandFont": {
        "src": "https://example.com/font.woff2",
        "style": "normal",
        "weight": "400"
    }
}
```

## 导航与链接

| 设置 | 类型与默认值 | 说明 |
| --- | --- | --- |
| `headerMode` | 整数，`1` | 导航栏模式：`0` 随滚动显隐，`1` 固定，`2` 不固定。 |
| `headerModeMobile` | 整数，未设置 | 移动设备的导航栏模式；未设置时沿用 `headerMode`。移动设备由服务端 User-Agent 判断，缩窄桌面浏览器窗口不会触发。 |
| `link` | 数组，`[]` | 设置面板中的社交链接。每项必须包含 `name`、`icon`、`href`、`target`；`icon` 对应主题已有的 `voidicon-*` 图标名。 |
| `nav` | 数组，空 | 桌面和移动导航中的自定义分组。每组包含 `name` 和 `items`；子项包含 `link`、`title`，可选 `target`，未设置时使用 `_blank`。 |

## 正文与代码

| 设置 | 类型与默认值 | 说明 |
| --- | --- | --- |
| `defaultFontSize` | 整数，`3` | 默认正文字号：`1` 至 `5` 分别对应 14、16、18、20、22px。访客在前台选择的字号会覆盖它。 |
| `useFiraCodeFont` | 布尔值，`false` | 为代码启用主题自带的 Fira Code 字体。 |
| `parseFigcaption` | 布尔值，`true` | 将正文图片的非空替代文本显示为图题。 |
| `largePhotoSet` | 布尔值，`true` | 允许 `[photos]` 图集在宽屏超出正文栏；主要在视口宽度不小于 1200px 时可见。 |
| `macStyleCodeBlock` | 布尔值，`true` | 显示 Mac 风格代码块标题栏。 |
| `lineNumbers` | 布尔值，`true` | 显示代码块行号。 |

## 评论与分享

| 设置 | 类型与默认值 | 说明 |
| --- | --- | --- |
| `twitterId` | 字符串，`""` | Twitter/X 分享文字和卡片元数据中的账号 ID，不含 `@`。 |
| `weiboId` | 字符串，`""` | 微博分享文字中的账号 ID，不含 `@`。 |
| `commentNotification` | 字符串，`""` | 评论表单上方的提示语；支持换行、加粗和链接。 |
| `commentFoldThreshold` | 二元素数组，`[5, 1.5]` | 自动折叠评论的 `[最低点踩数, 点踩/点赞比例]`。依赖启用中的 VOID 插件 1.4.0 或更高版本。 |

`commentNotification` 可以使用 JSON 的 `\n` 或 `<br>` 换行，使用 `<strong>`、`<b>` 加粗，并使用
`<a href="...">` 添加链接。链接仅接受 HTTP(S) 或站内相对地址；`target` 仅支持 `_self` 和 `_blank`，
其中 `_blank` 会自动增加 `rel="noopener noreferrer"`。其他标签和属性会被丢弃，但标签内的文字会保留。

```json
{
    "commentNotification": "请<strong>友善交流</strong><br>提交前请阅读<a href=\"/about\">评论规则</a>"
}
```

`[5, 1.5]` 表示点踩数至少为 5，且至少达到点赞数的 1.5 倍时折叠。访客仍可手动展开评论。

## 图片加载

图片加载不再提供超高级设置。后台“内容图片懒加载”是唯一公开开关，默认开启：普通正文图片、`[photos]` 和友链缩略图使用浏览器原生 `loading="lazy"`，Gallery 为保持分批展示控制而使用主题脚本加载。关闭后，这些内容图片均直接加载。

头图、首页与归档封面、表情由主题根据位置自动安排加载优先级，不受该开关控制。

已退役的 `browserLevelLoadingLazy`、`bluredLazyload`、`CDNType`、`darkModeTime` 和 `followSystemColorScheme` 会从运行时配置中过滤。旧配置无需手工删除这些字段，但它们不再产生效果。

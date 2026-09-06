# VOID 超高级设置

主题后台的“超高级设置”接受一个 JSON 对象。可以从
[`advanceSetting.sample.json`](../advanceSetting.sample.json) 复制所需字段，未填写的字段使用主题默认值。

JSON 不支持注释或末尾多余的逗号。保存前建议使用 JSON 校验工具检查；任一处语法错误都会使整份超高级设置无法解析。设置解析失败时，主题会使用 schema 中定义的安全默认值。

## 站点与头图

| 设置 | 类型与默认值 | 说明 |
| --- | --- | --- |
| `name` | `string`，`""` | 左上角站点名；留空时使用 Typecho 站点标题。 |
| `brandFont` | `object`，`{"src":"","style":"normal","weight":"normal"}` | 自定义站点名字体，包含 `src`、`style`、`weight`。`src` 留空时不加载；远程字体服务器需要允许跨域访问。`style` 可为 `normal`、`italic` 或 `oblique`，`weight` 可为 `normal`、`bold`、`bolder`、`lighter` 或三位数字字重。 |
| `desktopBannerHeight` | `number|string`，`""` | 桌面端头图最小高度，单位为视口高度百分比 `vh`。 |
| `mobileBannerHeight` | `number|string`，`""` | 移动端头图最小高度，单位为 `vh`。 |

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
| `headerMode` | `enum`，`1` | 导航栏模式：`0` 随滚动显隐，`1` 固定，`2` 不固定。 |
| `headerModeMobile` | `enum|null`，未设置 | 移动设备的导航栏模式：`0` 随滚动显隐，`1` 固定，`2` 不固定；未设置或无效时沿用 `headerMode`。移动设备由服务端 User-Agent 判断，缩窄桌面浏览器窗口不会触发。 |
| `link` | `array`，`[]` | 设置面板中的社交链接。每项必须包含 `name`、`icon`、`href`、`target`；`icon` 对应主题已有的 `voidicon-*` 图标名。 |
| `nav` | `array`，`[]` | 桌面和移动导航中的自定义分组。每组包含 `name` 和 `items`；子项包含 `link`、`title`，可选 `target`，未设置时使用 `_blank`。 |

## 正文与代码

| 设置 | 类型与默认值 | 说明 |
| --- | --- | --- |
| `defaultFontSize` | `enum`，`3` | 默认正文字号：`1`、`2`、`3`、`4`、`5` 分别对应 14、16、18、20、22px。访客在前台选择的字号会覆盖它。 |
| `useFiraCodeFont` | `boolean`，`false` | 为代码启用主题自带的 Fira Code 字体。 |
| `parseFigcaption` | `boolean`，`true` | 将正文图片的非空替代文本显示为图题。 |
| `largePhotoSet` | `boolean`，`true` | 允许 `[photos]` 图集在宽屏超出正文栏；主要在视口宽度不小于 1200px 时可见。 |
| `macStyleCodeBlock` | `boolean`，`true` | 显示 Mac 风格代码块标题栏。 |
| `lineNumbers` | `boolean`，`true` | 显示代码块行号。 |

## 评论与分享

| 设置 | 类型与默认值 | 说明 |
| --- | --- | --- |
| `twitterId` | `string`，`""` | Twitter/X 分享文字和卡片元数据中的账号 ID，不含 `@`。 |
| `weiboId` | `string`，`""` | 微博分享文字中的账号 ID，不含 `@`。 |
| `commentNotification` | `string`，`""` | 评论表单上方的提示语；支持换行、加粗和链接。 |
| `commentFoldThreshold` | `tuple`，`[5,1.5]` | 自动折叠评论的 `[最低点踩数, 点踩/点赞比例]`。依赖启用中的 VOID 插件 1.4.0 或更高版本。 |

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

`darkModeTime`、`followSystemColorScheme`、`bluredLazyload`、`CDNType`、`browserLevelLoadingLazy` 和 `feedContentMode` 已退役，会从运行时配置中过滤。旧配置无需手工删除这些字段，但它们不再产生效果，也不能作为新设置使用。

## 自由格式扩展点

高级 JSON 中未被 schema 认识的键会继续原样保留，供自定义模板或插件读取。主题设置中的同名键优先于高级 JSON 中的已知主题键。

主题设置中的 `head`、`footer` 和 `pjaxreload` 仍是管理员控制的自由格式扩展点，分别在文档头部、页脚和主内容 PJAX 完成后输出或执行；它们不会被高级设置 schema 重新解释。

## 实现与兼容合同

主题在 `libs/Settings/Schema.php` 集中登记已知主题设置、高级设置、文章字段和废弃键；后台表单、运行时默认值、类型与枚举都从这里取得。`Resolver.php` 负责读取 Typecho 设置和高级 JSON：已知值按 schema 规范化，未知高级键继续透传，公开主题设置不允许被同名高级键覆盖，解析失败则整体使用默认高级设置。

`FrontendConfig.php` 是服务器设置与 `window.VOIDConfig` 之间的唯一投影边界。只有 schema 明确标记或该类明确登记的运行时值会发送到浏览器；自由格式扩展内容、未知高级键和废弃键都不会进入 `VOIDConfig`。新增或修改设置时，必须同步通过设置合同测试对后台表单、运行时、前端投影、JSON 示例与本文档的检查。

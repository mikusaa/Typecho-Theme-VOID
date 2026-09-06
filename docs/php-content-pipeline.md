# PHP 内容管线与查询边界

本文记录 `Contents` 兼容 facade、内容转换顺序、Typecho Hook 和数据库访问的维护边界。
转换顺序和公开入口会影响历史文章、模板与自定义代码，不能作为普通内部重构随意改变。
相关门禁参见[测试与验证](./testing.md)。

## 加载入口与 facade

`functions.php` 是主题初始化入口，使用基于 `__DIR__` 的确定路径加载 `libs/Utils.php`、
`libs/Contents.php` 和 `libs/Comments.php`。`libs/Contents.php` 再加载
`libs/Content/bootstrap.php`；这个 bootstrap 按固定顺序加载 scanner、各 Transform、
Pipeline 和两个 Repository。内部代码不依赖请求工作目录，也不需要 Composer 或 PSR-4。

`Contents` 是模板、Hook 和可能存在的外部主题代码之间的兼容 facade。调用者不应直接
依赖内部类。当前公开面按职责分为：

| 领域 | `Contents` 入口 |
| --- | --- |
| 标题 | `titleText()`、`title()` |
| Hook 与管线 | `markdown()`、`contentEx()`、`excerptEx()` |
| 内容兼容转换 | `parseHeader()`、`parseHeaderCallback()`、`parseAlerts()`、`parseNotice()`、`parsePhotoSet()`、`parseBiaoQing()`、`parseImages()`、`parseRuby()`、`parseBoardCallback1()`、`parseBoardCallback2()` |
| 头图 | `getBannerDimensions()`、`shouldShowBannerSource()`、`getBannerSourceHtml()` |
| 内容读取 | `getPost()`、`getComment()`、`getMeta()`、`getRecentComments()` |
| 归档读取 | `thePrev()`、`theNext()`、`archives()`、`getTags()`、`getCategories()` |

即使仓库内暂时没有某个 facade 方法的调用者，也不能据此删除或改名；这需要先审计模板、
插件和用户自定义代码，并提供明确迁移方案。

## 内部所有权

| 组件 | 所有权 |
| --- | --- |
| `VOID_Content_Pipeline` | 组织三个 Hook 的输入选择、转换顺序、Feed/Gallery 上下文、标题编号和 Feed 清理。 |
| `VOID_Content_HtmlScanner` | 提供标签边界、嵌套元素、raw-text 元素和属性解析，供多个转换器共享。 |
| `VOID_Content_Transform_Alerts` | 转换 GitHub Alerts，并保留旧 `[notice]` 兼容入口。 |
| `VOID_Content_Transform_PhotoSets` | 识别 `[photos]`、生成或解包容器，并在摘要中删除图集。 |
| `VOID_Content_Transform_Emotes` | 读取清单、匹配受支持短码、验证资源路径并生成表情 HTML。 |
| `VOID_Content_Transform_Images` | 处理正文图片结构、尺寸、图题、加载策略、Feed/Gallery 差异和头图尺寸。 |
| `VOID_Content_Transform_BannerSource` | 解析纯文本、Markdown/HTML 链接，验证 URL 并输出头图来源。 |
| `VOID_Content_Transform_Markdown` | 处理友链包装、代码语言别名、Typecho Markdown 委托与注音。 |
| `VOID_Repository_ContentRepository` | 读取文章、评论、Meta 与最近评论，并组装 Typecho 组件。 |
| `VOID_Repository_ArchiveRepository` | 读取相邻文章、年度归档、标签与分类。 |

Transform 只负责字符串或明确上下文的转换，不应顺手查询数据库。Repository 只封装现有
Typecho 查询和组件组装语义，不引入内容重写、缓存、分页或新的数据库 schema。

## Typecho Hook

`functions.php` 将以下 Hook 注册到 `Contents` facade：

```text
markdown  -> Contents::markdown
contentEx -> Contents::contentEx
excerptEx -> Contents::excerptEx
```

`VOID_registerContentsHook()` 同时兼容 Typecho 1.2 风格的
`Widget_Abstract_Contents` 与 Typecho 1.3 的 `Widget\Base\Contents`，并先规范化句柄，
避免同一组件因别名被重复注册。Hook 名称、回调签名和调用顺序是公开兼容边界。

模板通过 facade 读取标题、头图、归档、相邻文章和分类标签；`libs/Comments.php` 通过
`Contents::parseBiaoQing()` 处理评论内容。数据库访问集中在 Repository，不应重新散落到
Transform 或模板。

## 转换顺序

`markdown($text)` 的顺序是：

```text
[links] 与旧友链容器去换行
-> 渲染友链卡片
-> 按现有 Typecho 标志规范化代码语言别名
-> 调用 Markdown 转换
```

`contentEx($data, $widget, $last)` 优先采用非 `null` 的 `$last`，顺序是：

```text
注音 -> 图片 -> 表情 -> PhotoSets -> Alerts
-> Feed：清理主题交互标记并解包 PhotoSets
-> 非 Feed：为 h2-h6 增加目录 id
```

`excerptEx($data, $widget, $last)` 同样优先采用非 `null` 的 `$last`，顺序是：

```text
注音 -> 表情 -> Alerts -> 删除已渲染 PhotoSets -> 删除 [photos] 边界
```

不要交换 Transform 顺序来获得“更整洁”的实现。某些输入同时包含 Markdown、短码、图片、
Alert 或图集时，顺序本身决定最终 HTML；任何调整都需要先建立精确回归合同。

## 页面、Gallery、Feed 与摘要

普通内容页经过完整 `contentEx` 转换，并在非 Feed 输出中生成标题目录 id。Gallery 上下文
由当前模板是否为 `Gallery.php` 判定，只改变图片转换的布局/加载语义，不建立另一套内容
管线。摘要使用 `excerptEx`，有意删除图集内容和 shortcode 边界，不执行正文图片与标题
编号流程。

Feed 上下文从 Typecho 内容组件的 `parameter.type` 或 `parameter.isFeed` 判断。主题仍会
转换注音、图片、表情、PhotoSets 与 Alerts，最后删除无法在阅读器工作的主题 class、
`style`、`loading`、`data-*`、`no-pjax` 和交互容器，同时保留正文、图片、图题、Alert
标题与内容顺序。

这项 Feed 清理不等于 Feed 截断。主题不会限制字符、追加“阅读全文”链接或读取
`feedContentMode`；全文与 `<!--more-->` 的选择继续由 Typecho 决定。`feedContentMode`
是退役设置，只能在设置解析时过滤，不能被内容管线重新利用。Feed 截断、Media RSS 和
浏览器预览属于可选插件边界，不应搬回主题。

## 数据访问边界

`ContentRepository` 通过 Typecho 的内容、评论和 Meta 组件读取单条记录或最近评论；
`ArchiveRepository` 使用 Typecho 查询与组件读取相邻文章、公开归档、标签和分类。Typecho
1.3 的归档分类关系可以批量填充，Typecho 1.2 则保留其组件原有计算路径。

Repository 返回现有模板所需的 Typecho 对象或数组，不把数据转换成新的领域模型。修改
查询条件时必须继续考虑发布时间、状态、类型、密码保护、评论审核与现有排序等契约，并
通过真实 Typecho 请求确认组件与数据库行为。

## 自动化覆盖与限制

PHP 合同测试覆盖以下边界：

- `ContentsArchitectureContractTest.php`：facade、加载入口、Hook 与退役 Feed 符号。
- `ContentsPipelineContractTest.php`：三条管线的顺序、复合输入与 `$last` 优先级。
- `ContentsHtmlScannerContractTest.php`：标签、属性、嵌套/raw-text、异常 HTML 与 Unicode。
- `ContentsAlertContractTest.php`、`ContentsEmoteContractTest.php`、
  `ContentsEmoteProductionContractTest.php`、`ContentsImageContractTest.php`：各转换领域。
- `ContentsFeedContractTest.php`：完整 Feed、静态清理和禁止恢复截断。
- `ContentsArchiveContractTest.php`、`ContentsRepositoryContractTest.php`：查询、组件组装与
  Typecho 1.2/1.3 兼容分支。
- `ArchiveTemplateContractTest.php`、`GalleryTemplateContractTest.php`、
  `EmptySiteContractTest.php` 及头图合同：模板发现、空上下文和输出连接点。

这些测试以 stub、fixture 和 PHP CLI 证明转换与调用合同，不能证明真实 Typecho 路由、
Hook 时机、数据库驱动、Cookie、HTTP 状态、模板完整正文或浏览器行为。修改管线、查询或
模板后，仍需在适用的真实 Typecho 环境检查文章、独立页面、Gallery、归档、搜索、空站、
动态 404 与 Feed，并同时核对 HTTP 状态和响应正文。

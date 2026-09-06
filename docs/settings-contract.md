# 设置兼容合同

主题设置和文章字段是持久化用户数据，也是公开兼容面。本文说明设置定义、解析、后台表单
和浏览器投影的维护边界；具体可填写的超高级设置仍以[超高级设置](./advanceSetting.md)为
用户手册，验证入口参见[测试与验证](./testing.md)。

## 三种持久化来源

`libs/Settings/Schema.php` 使用 `source` 区分三类持久化数据：

| 来源 | 含义 | 读取或表单入口 |
| --- | --- | --- |
| `theme` | Typecho 主题设置，包括普通表单值、自由格式扩展点和 `advance` JSON 文本。 | `themeConfig()` 生成表单，`Resolver` 从 Typecho options 读取运行时值。 |
| `advanced` | `advance` JSON 中的已知高级键，以及需要过滤的退役键。 | `Resolver` 解码 JSON，并按 schema 规范化已知值。 |
| `field` | 文章或独立页面的自定义字段。 | `themeFields()` 生成 Typecho 字段，模板通过内容对象字段读取。 |

`derived` 只表示 `VOIDPlugin` 等运行时派生能力，不是第四种持久化来源。它不会出现在后台
保存数据或高级设置示例中。

## Schema 的职责

`VOID_Settings_Schema` 是已知设置的单一登记入口。每项定义同时保存：

```text
source
default
type
normalizer
allowedValues
compatibilityFallback
retired
exposeToFrontend
frontendKey
form
includeInRuntime
documented
```

`default` 用于旧配置缺少键或输入无效时的安全行为；`type` 描述合同；`normalizer` 执行
布尔、枚举、字符串、可选枚举、尺寸、字体、导航、链接与评论折叠阈值等规范化；
`allowedValues` 和 `compatibilityFallback` 约束已有枚举与历史回退。`form` 保存 Typecho
控件、标题、说明、选项和校验规则；`exposeToFrontend` 与 `frontendKey` 决定是否进入浏览器。

`themeConfig()` 与 `themeFields()` 是 Typecho 要求的全局入口，它们通过
`VOID_addSchemaFormElements()` 按 schema 顺序生成表单。不要在 `functions.php` 另建一份
默认值或选项清单。

## Resolver 的合并规则

`VOID_Settings_Resolver::resolve()` 先解析 `theme`，再解析 `advanced`，最后补充派生能力。
合并必须保持以下顺序和兼容边界：

1. 公开主题设置是同名键的事实来源。高级 JSON 不能覆盖 `lazyload`、`head` 等已知
   `theme` 键。
2. 已知高级键按 schema 的默认值、类型、normalizer、枚举和兼容回退处理。
3. 高级 JSON 不是对象或无法解析时，使用全部已知高级设置的安全默认值。
4. 未知高级键继续原样透传，供自定义模板或插件读取；它们不因此成为主题正式设置。
5. `headerModeMobile` 只在服务端判定移动设备时覆盖本次运行的 `headerMode`；未设置或无效
   时沿用桌面值。
6. `head`、`footer` 和 `pjaxreload` 是管理员控制的自由格式扩展点，保持原有输出能力，
   不进入普通前端配置白名单。

未知键透传是服务器端兼容行为，不代表可以把未知对象自动发送到浏览器。任何准备转为
正式设置的自定义键，都应先进入 schema 并确定迁移、默认值、类型和公开范围。

## 退役键

`darkModeTime`、`followSystemColorScheme`、`bluredLazyload`、`CDNType`、
`browserLevelLoadingLazy` 和 `feedContentMode` 仍登记在 schema 中，但标记为 `retired`、
不进入运行时，也不出现在示例和公开设置表格中。

保留这些名称是为了过滤旧配置，防止它们通过“未知高级键透传”重新生效。退役键只能继续
过滤，不能为新功能重新利用；新的产品需求必须使用新键，并提供独立的默认值与迁移决定。

## FrontendConfig 的白名单

`VOID_Settings_FrontendConfig` 是服务器设置到 `window.VOIDConfig` 的唯一投影边界。
`project()` 只读取 schema 中明确设置 `exposeToFrontend` 和 `frontendKey` 的值，`build()`
再补充 `searchBase`、`home`、`buildTime`、MathJax/表情/投票 URL、背景存在标志、字体样式表、
版本和开发模式等明确登记的运行时派生值。

自由格式扩展内容、未知高级键、退役键和未列入白名单的服务器设置不得进入
`VOIDConfig`。新增浏览器字段时，应先决定它是持久化设置投影还是请求期派生值，并在
`Schema.php` 或 `FrontendConfig::runtimeDefinitions()` 中登记，而不是在模板中临时拼接。
`includes/head.php` 只负责提供请求期派生值并用安全 JSON 建立全局配置。

## 示例、用户文档与自动化

这几处承担不同职责：

- `advanceSetting.sample.json` 是随主题运行单元发布的可复制示例，只包含当前公开高级键。
- `docs/advanceSetting.md` 是用户配置手册，说明键、类型、默认值、枚举和可观察行为，不
  承担内部架构说明，也不进入主题运行单元。
- `functions.php` 的 `themeConfig()`、`themeFields()` 和 schema 表单元数据共同决定后台
  表单；编辑器脚本只增强展示和交互，不另行定义持久化键。
- `SettingsSchemaContractTest.php` 交叉检查 schema、运行时调用、退役键、合并行为、前端
  白名单、JSON 示例和高级设置文档表格。
- `SettingsFormContractTest.php` 检查主题设置与文章字段的控件、顺序、默认值、规则和
  Typecho 全局入口。

这些合同能发现定义漂移，但不能替代真实 Typecho 保存、升级、移动设备判断、后台编辑器
DOM、模板输出和浏览器 `VOIDConfig` 验证。

## 修改设置的检查清单

新增、修改或退役设置时，至少同步检查：

1. `libs/Settings/Schema.php` 中的来源、持久化键名、默认值、类型、normalizer、枚举、兼容
   回退、退役状态、表单元数据和前端公开范围。
2. `libs/Settings/Resolver.php` 是否已有合适的规范化与合并行为；不要为单个调用者绕过
   Resolver。
3. `libs/Settings/FrontendConfig.php` 与 `includes/head.php` 是否确实需要公开或派生该值。
4. `functions.php`、模板、`libs/Utils.php` 和编辑器字段增强中的全部读写调用。
5. 面向用户的高级键是否同步到 `advanceSetting.sample.json` 和
   `docs/advanceSetting.md`；主题表单设置是否需要 README 或升级说明。
6. `SettingsSchemaContractTest.php`、`SettingsFormContractTest.php` 与相关前端合同是否覆盖
   新的默认、回退、表单和投影行为。

实现后至少运行 `npm run lint:php`、`npm run test:php`；涉及前端配置或后台编辑器时再运行
相应 Node 测试。共享设置合同或发布前应执行完整 `make verify`，并在真实 Typecho 后台
确认保存后的表单值、文章字段及前台输出。

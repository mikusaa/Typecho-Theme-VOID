

# Typecho Theme VOID

> ✏ 一款简洁优雅的 Typecho 主题

作为计算机术语时，VOID 的意思是「无类型」。

![](https://raw.githubusercontent.com/mikusaa/Typecho-Theme-VOID/master/screenshot.webp)

[![Build](https://github.com/mikusaa/Typecho-Theme-VOID/workflows/Build/badge.svg)](https://github.com/mikusaa/Typecho-Theme-VOID/actions) [![downloads](https://img.shields.io/github/downloads/mikusaa/Typecho-Theme-VOID/total.svg?style=flat-square)](https://github.com/mikusaa/Typecho-Theme-VOID/releases) [![](https://img.shields.io/github/release/mikusaa/Typecho-Theme-VOID.svg?style=flat-square)](https://github.com/mikusaa/Typecho-Theme-VOID/releases) ![](https://img.shields.io/github/license/mikusaa/Typecho-Theme-VOID.svg?style=flat-square)

## 特性

> 介绍文章：[VOID：现在可以公开的情报](https://blog.imalan.cn/archives/247/)。

* 响应式设计
* PJAX 无刷新体验
* AJAX 评论
* 前台无跳转登陆（兼容 PJAX）
* 跟随设备及固定深浅色的主题颜色模式
* 优秀的可读性
* 衬线、非衬线两种文字风格
* 代码高亮（浅色暗色两种风格，随主题切换）
* Mac 风格代码块（可开启或关闭）
* 代码行号
* 站点样式设置面板（日夜转换、字体、字号）
* MathJax 公式（默认关闭；启用后仅在当前页面检测到公式时加载）
* 表情解析（文章、评论可用）
* 图片排版（可用作相册）
* 图片懒加载
* 灵活的头图设置
* 文章目录解析
* 完整的结构化数据支持
* 够用的后台设置与丰富的高级设置

结合附带的配套专用插件，还有更多功能：

* 浏览量统计
* 文章点赞
* 文章字数统计
* 评论投票与自动折叠
* 访客互动展示

以及其他很多细节，总之用起来还算舒服。我建立了一个示例页面，在这里你可以看到 VOID 对常用写作元素的支持以及一些特色功能演示：[示例页面](https://blog.imalan.cn/archives/194/)。

## 开始使用

### 安装主题

1. 下载主题：[发布版](https://github.com/mikusaa/Typecho-Theme-VOID/releases)，注意是下载 VOID-x.x.x.zip 这个压缩包，而不是 Source code
2. 解压
3. 将主题文件夹重命名为 `VOID`，上传至站点 /usr/themes 目录下
4. 后台启用主题

* 可选：将主题 `assets` 文件夹下的 `VOIDCacheRule.js` 复制一份到站点根目录，并在主题设置中启用 Service Worker 缓存。
* 可选：按[超高级设置说明](./advanceSetting.md)从合法的 [JSON 示例](./advanceSetting.sample.json)中选取所需配置。

开发版主题可以在这里获取：[开发版](https://github.com/mikusaa/Typecho-Theme-VOID/archive/refs/heads/nightly.zip)。注意，不保证开发版有更新更多的功能。而且开发版变动频繁，若无必要请使用发布版主题。

### 安装插件

1. 下载插件：[传送门](https://github.com/mikusaa/Typecho-Plugin-VOID/releases)，注意是下载 VOID-x.zip 这个压缩包，而不是 Source code
2. 解压
3. 将插件文件夹重命名为 `VOID`，上传至站点 /usr/plugins 目录下
4. 后台启用插件

Feed 截断、Media RSS 和浏览器预览可选安装 [FeedEnhancer 1.1.0 或更高版本](https://github.com/mikusaa/Typecho-Plugin-FeedEnhancer)，详细配置以插件文档为准。

## **常见问题（请务必仔细阅读）**

<details><summary>如何开启文章点赞？</summary><br>

文章点赞功能依赖配套插件，请上传至插件目录并启用。插件一般会随主题包发布，开发版主题请前往 https://github.com/AlanDecode/VOID-Plugin 获取。

</details>

<details><summary>如何开启文章浏览量统计？</summary><br>

文章浏览量统计功能依赖配套插件，请上传至插件目录并启用。插件一般会随主题包发布，开发版主题请前往 https://github.com/AlanDecode/VOID-Plugin 获取。

</details>

<details><summary>如何开启文章字数统计？</summary><br>

文章字数统计功能依赖配套插件，请上传至插件目录并启用。插件一般会随主题包发布，开发版主题请前往 https://github.com/AlanDecode/VOID-Plugin 获取。

</details>

<details><summary>下载安装后样式不对？</summary><br>

仓库中的是未压缩的源代码，包含大量实际使用中不需要的文件，并且可能无法直接使用。请一定通过这两个链接下载主题：[发布版](https://github.com/mikusaa/Typecho-Theme-VOID/releases) | [开发版](https://github.com/mikusaa/Typecho-Theme-VOID/archive/refs/heads/nightly.zip)。注意其中发布版是下载 VOID-x.x.x.zip 这个压缩包，而不是 Source code。

</details>

<details><summary>添加归档页面</summary><br>

新建独立页面，自定义模板选择 `Archives`，内容留空。

</details>

<details><summary>添加相册页面</summary><br>

新建独立页面，自定义模板选择 `Gallery`。可使用二级标题划分年份或相册分组，标题下连续的普通 Markdown 图片会按原始比例组成自适应照片墙；文字、标题等非图片内容会自然分隔照片组。例如：

```markdown
## 2026

![照片说明](https://example.com/photo-1.jpg)
![照片说明](https://example.com/photo-2.jpg)
```

已有的 `[photos][/photos]` 内容可以直接沿用，在 Gallery 模板中会并入相同的响应式排版。照片墙明显超过当前视口高度时会按完整照片行渐进显示，可通过“显示更多照片”继续展开；较短相册保持完整显示，JavaScript 不可用时也不会隐藏内容。每张图片继续使用主题当前的单图聚焦层并保留原图链接；不提供相册导航、缩略图、二次缩放或平移，JavaScript 不可用时会直接打开原图。页面评论区及评论开关与普通独立页面一致。

</details>

<details><summary>添加友情链接</summary><br>

新建独立页面，然后如此书写：

```
[links]
[熊猫小A](https://www.imalan.cn)+(https://secure.gravatar.com/avatar/1741a6eef5c824899e347e4afcbaa75d?s=200&r=G&d=)
[熊猫小A的博客](https://blog.imalan.cn)+(https://secure.gravatar.com/avatar/1741a6eef5c824899e347e4afcbaa75d?s=64&r=G&d=)
[/links]
```

文章中、独立页面中都可以通过该语法插入类似的展示块。在某些 Typecho 版本中 HTML 会被转义后输出，请使用 `!!!` 包裹以上代码，例如：

```
!!!
[links]
···
[/links]
!!!
```

`!!!` 需要单独占一行。

</details>

<details><summary>图片排版</summary><br>

正文图片会保留原图链接。普通左键点击已加载完成的图片时，主题会打开仅包含当前图片的全视口聚焦层；点击图片、背景或关闭按钮，或按 `Esc`，都可返回正文。该交互不提供上一张/下一张、二次缩放或相册导航；当 JavaScript 或浏览器原生 Dialog 不可用时，会直接打开原图。

在文章中使用 `[photos][/photos]` 包裹图片，可按数量自动排版：

* 1 张：与普通正文单图相同，居中显示。
* 2 张：按原始宽高比等高并排，不裁切图片。
* 3 张及以上：显示为单行横向图片带。触屏设备与触控板使用浏览器原生横向滚动惯性，并在手势结束后吸附到相邻图片起点；桌面端也可按住鼠标横向拖动。有可见溢出时提供左右按钮，以平滑滚动到相邻图片；普通鼠标滚轮仍用于页面纵向滚动。

每张图片保持独立的原图链接和键盘焦点，横向图片带会在有更多图片时显示左右滚动按钮。例如：

```
[photos]
![](https://cdn.imalan.cn/img/post/2018-10-26/IMG_0073.jpeg)
![](https://cdn.imalan.cn/img/post/2018-10-26/IMG_0053.jpeg)
[/photos]

[photos]
![](https://cdn.imalan.cn/img/post/2018-10-26/IMG_0039.jpeg)
![](https://cdn.imalan.cn/img/post/2018-10-26/IMG_0051.jpeg)
![](https://cdn.imalan.cn/img/post/2018-10-26/IMG_0005.jpeg)
[/photos]
```

在某些 Typecho 版本中 HTML 会被转义后输出，请使用 `!!!` 包裹以上代码，例如：

```
!!!
[photos]
···
[/photos]
!!!
```

`!!!` 需要单独占一行。

</details>

<details><summary>增强的 Markdown 语法</summary><br>

* 注音语法：`{{文本:zhu yin}}`，会渲染为：<ruby>文本<rp> (</rp><rt>zhu yin</rt><rp>)</rp></ruby>

提示块使用 [GitHub Alerts](https://docs.github.com/zh/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts) 语法。例如：

```markdown
> [!WARNING]
> 升级之前请先备份数据库。
>
> - 检查 PHP 版本
> - 停用缓存插件
```

支持 `NOTE`、`TIP`、`IMPORTANT`、`WARNING`、`CAUTION` 五种大写类型，默认标题依次为“说明、提示、重要、警告、危险”。提示块不支持自定义标题。

旧文章中的单段 `[notice]提示内容[/notice]` 仍会作为 `NOTE` 兼容解析；新内容请只使用 GitHub Alerts 语法。

</details>

<details><summary>页面空白</summary><br>

* 另外，推荐使用 PHP 7.0 及以上版本搭配 MySQL 数据库。PHP 5.6 或者更低版本以及其它数据库可能出现未知问题（并且我不会去修复）。

</details>

## 更新

同[开始使用](#开始使用)，区别是你可以直接覆盖主题文件。大多数情况下无需禁用主题，这样你的主题设置就不会丢失。

某些版本由于改用幅度较大需要重启主题与插件，请参见对应版本的发布日志。

VOID 4.0 的兼容性变更和迁移步骤参见 [VOID 4.0 升级说明](https://github.com/mikusaa/Typecho-Theme-VOID/blob/master/docs/upgrade-4.0.md)。

## 开发与自定义

**首先注意：我不保证提供任何自定义修改相关的指导与帮助。You are on your own.**

<details><summary>展开详情</summary><br>

如果你有不错的想法，可以定制自己的版本。开发环境使用 Node.js 26 和 npm 11。先 clone
这个 repo：

```bash
git clone https://github.com/mikusaa/Typecho-Theme-VOID ./VOID && cd ./VOID
```

按锁文件安装依赖，不需要全局安装 Gulp：

```bash
npm ci
```

生成完整、未压缩的本地开发运行单元：

```bash
make dev-build
```

输出位于 `./dev-build`，PHP 会引用其中的逻辑资源名。需要持续更新 SCSS（包括
`assets/parts/` 分部）、JavaScript、PHP 和运行资源时使用：

```bash
make watch
```

交付前运行与 CI 相同的完整门禁；它会检查 JavaScript、表情资源、全部受跟踪 PHP
文件的语法、自动发现的 PHP 合同测试，并完成一次生产构建：

```bash
make verify
```

只需重新生成生产运行单元时使用 `make build`。生产输出位于 `./build`，包含内容哈希
资源和已同步改写引用的 PHP 文件；部署时必须整体使用同一次构建，不能与
`./dev-build` 或旧资源混合。如果你对自己的更改很满意，**欢迎提出 Pull Request**。

</details>

## 更新日志

完整更新日志（包括未发布内容与历史版本）请查看 [`change-log.md`](./change-log.md)。

## 鸣谢

### 开源项目

[Masonry](https://masonry.desandro.com/) | [PrismJS](https://prismjs.com/index.html) | [MathJax](https://www.mathjax.org/) | [littlefoot](https://littlefoot.js.org/) | [yue.css](https://github.com/lepture/yue.css) | [tocbot](https://tscanlin.github.io/tocbot/) | [pangu.js](https://github.com/vinta/pangu.js) | [Fontsource](https://fontsource.org/) | [social](https://github.com/lepture/social) | [Headroom.js](http://wicky.nillia.ms/headroom.js/) | [hypher](https://github.com/bramstein/hypher)

### 其他

[RAW](https://github.com/AlanDecode/Typecho-Theme-RAW) | [Mirages](https://get233.com/archives/mirages-intro.html) | [handsome](https://www.ihewro.com/archives/489/) | [Card](https://blog.shuiba.co/bitcron-theme-card) | [Casper](https://github.com/TryGhost/Casper) | [Typlog](https://typlog.com/) | [FORMA](https://justgoodthemes.com/ghost-themes/forma/)

## 捐助

**如果本项目对你有所帮助，请考虑捐助我**

![谢谢支持](https://wx1.sinaimg.cn/large/0060lm7Tly1g0c4cbi71lj30sc0iv453.jpg)

## License

MIT © [AlanDecode](https://github.com/AlanDecode)

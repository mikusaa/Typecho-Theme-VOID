

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
* MathJax 公式
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

### 主题颜色模式

主题设置提供“跟随设备”“日间模式”和“夜间模式”三种颜色模式，新安装默认跟随访客设备。升级前保存为“定时切换”的站点会迁移为“跟随设备”，下次保存主题设置时完成持久化。

前台设置面板中的单按钮依次切换“跟随主题设置”“手动日间”和“手动夜间”。手动选择在当前浏览器会话内有效，重新选择设备图标即可恢复后台设置。

### Feed 正文开头

主题设置 `feedContentMode` 默认关闭，RSS 与 Atom 会继续沿用 Typecho 原有输出。启用后，主题会从正文提取首个有效文本块（最长 300 个 Unicode 字符），并在其后附上前往网站阅读全文的链接。

启用该功能时，主题生成的正文开头会优先于 Typecho 的“聚合全文输出”设置和文章中的 `<!--more-->` 分隔符。截取内容始终来自文章正文，不使用“文章摘要”自定义字段。

### 内置字体

主题使用 [Fontsource](https://fontsource.org/) 将 Open Sans、Noto Serif SC 和可选的 Fira Code 随发布包提供，默认不会为了这些内置字体连接 Google Fonts。管理员配置的站点标题字体或自定义 `<head>` 仍可主动引用第三方资源。

字体文件分别遵循各自的 SIL Open Font License 1.1；发布包在对应字体目录中附带许可证和上游元数据。Service Worker 只会按访问过的字符范围缓存字体资源，不会预缓存完整中文字体，也不提供页面本身的冷启动离线能力。

开发版主题可以在这里获取：[开发版](https://github.com/mikusaa/Typecho-Theme-VOID/archive/refs/heads/nightly.zip)。注意，不保证开发版有更新更多的功能。而且开发版变动频繁，若无必要请使用发布版主题。

### 安装插件

1. 下载插件：[传送门](https://github.com/mikusaa/Typecho-Plugin-VOID/releases)，注意是下载 VOID-x.zip 这个压缩包，而不是 Source code
2. 解压
3. 将插件文件夹重命名为 `VOID`，上传至站点 /usr/plugins 目录下
4. 后台启用插件

### 首页封面尺寸与加载

首页和搜索、分类、标签等归档列表会在存在可信尺寸时为实际显示的文章封面输出原始宽高，让浏览器在图片到达前按真实比例预留空间。封面由浏览器原生加载并在解码完成后以 `0.5s` 淡入；加载或解码失败时会直接显示浏览器降级结果，不会永久保持透明。该效果独立于正文图片懒加载开关，并在访客启用“减少动态效果”时取消过渡。

只有实际显示的封面参与加载优先级：第一张使用高优先级立即加载，第二张立即加载，其余封面使用浏览器原生懒加载。未启用封面样式或 URL 为空的文章不会输出隐藏图片请求。

主题编辑器会在主图 URL 稳定后独立加载当前封面，成功时把尺寸随文章表单保存在隐藏自定义字段 `bannerMeta` 中；该过程不依赖配套 VOID 插件，也不会阻塞保存和发布。输入 URL 后立即提交、探测失败、旧文章或其他发布入口没有该字段时，封面仍会正常显示，并由现有瀑布流在图片加载后完成重排；封面 URL 已有的 `vwid` / `vhei` 尺寸标记继续兼容。

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
* 3 张及以上：显示为单行横向图片带。触屏设备可原生滑动，桌面端可按住鼠标横向拖动；滚轮仍用于页面纵向滚动。

每张图片保持独立的原图链接和键盘焦点，横向图片带会显示当前位置与总数。例如：

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

* 首先检查是否有插件重复引入了 JQuery，若有，在插件设置页面关闭。
* 另外，推荐使用 PHP 7.0 及以上版本搭配 MySQL 数据库。PHP 5.6 或者更低版本以及其它数据库可能出现未知问题（并且我不会去修复）。

</details>

## 更新

同[开始使用](#开始使用)，区别是你可以直接覆盖主题文件。大多数情况下无需禁用主题，这样你的主题设置就不会丢失。

某些版本由于改用幅度较大需要重启主题与插件，请参见对应版本的发布日志。

## 开发与自定义

**首先注意：我不保证提供任何自定义修改相关的指导与帮助。You are on your own.**

<details><summary>展开详情</summary><br>

如果你有不错的想法，可以定制自己的版本。首先你需要准备好 NodeJS 环境，然后 clone 这个 repo：

```bash
git clone https://github.com/mikusaa/Typecho-Theme-VOID ./VOID && cd ./VOID
```

安装依赖：

```bash
npm install -g gulp
npm install
```

用以下命令打包依赖的 JS 和 CSS：

```bash
gulp dev
```

主题的样式是用 SCSS 写的，你可以使用自己喜欢的方式编译 SCSS，或者使用：

```bash
gulp sass
```

监听 SCSS 更改然后实时编译。尽请添加自己想要的功能，满意后就提交代码。然后：

```bash
gulp build
```

构建你的主题，生成的主题位于 `./build` 目录下。如果你对自己的更改很满意，**欢迎提出 Pull Request**。

</details>

## 更新日志

完整更新日志（包括未发布内容与历史版本）请查看 [`change-log.md`](./change-log.md)。

## 鸣谢

### 开源项目

[JQuery](https://github.com/jquery/jquery) | [PrismJS](https://prismjs.com/index.html) | [MathJax](https://www.mathjax.org/) | [littlefoot](https://littlefoot.js.org/) | [yue.css](https://github.com/lepture/yue.css) | [tocbot](https://tscanlin.github.io/tocbot/) | [pangu.js](https://github.com/vinta/pangu.js) | [Fontsource](https://fontsource.org/) | [social](https://github.com/lepture/social) | [Headroom.js](http://wicky.nillia.ms/headroom.js/) | [hypher](https://github.com/bramstein/hypher)

### 其他

[RAW](https://github.com/AlanDecode/Typecho-Theme-RAW) | [Mirages](https://get233.com/archives/mirages-intro.html) | [handsome](https://www.ihewro.com/archives/489/) | [Card](https://blog.shuiba.co/bitcron-theme-card) | [Casper](https://github.com/TryGhost/Casper) | [Typlog](https://typlog.com/) | [FORMA](https://justgoodthemes.com/ghost-themes/forma/)

## 捐助

**如果本项目对你有所帮助，请考虑捐助我**

![谢谢支持](https://wx1.sinaimg.cn/large/0060lm7Tly1g0c4cbi71lj30sc0iv453.jpg)

## License

MIT © [AlanDecode](https://github.com/AlanDecode)

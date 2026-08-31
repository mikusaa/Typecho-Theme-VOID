<?php

class FeedContractParameter
{
    private $values;

    public function __construct($values)
    {
        $this->values = $values;
    }

    public function __get($name)
    {
        return array_key_exists($name, $this->values) ? $this->values[$name] : null;
    }

    public function __isset($name)
    {
        return isset($this->values[$name]);
    }
}

class FeedContractWidget
{
    public $parameter;
    public $permalink;
    public $fields;
    private $archiveTypes;

    public function __construct(
        $parameters,
        $permalink = 'https://example.test/posts/feed-preview',
        $archiveTypes = array(),
        $fields = null
    )
    {
        $this->parameter = new FeedContractParameter($parameters);
        $this->permalink = $permalink;
        $this->archiveTypes = $archiveTypes;
        $this->fields = $fields;
    }

    public function is($type)
    {
        if ($type === 'feed') {
            return $this->parameter->__get('type') === 'feed'
                || (bool) $this->parameter->__get('isFeed');
        }

        return in_array($type, $this->archiveTypes, true);
    }
}

class FeedContractForbiddenFields
{
    public function __get($name)
    {
        throw new RuntimeException('Feed truncation must not read custom field: ' . $name);
    }

    public function __isset($name)
    {
        throw new RuntimeException('Feed truncation must not inspect custom field: ' . $name);
    }
}

require_once dirname(__DIR__, 2) . '/libs/Contents.php';

$failures = 0;

function feedContractAssertSame($expected, $actual, $message)
{
    global $failures;
    if ($expected === $actual) {
        echo "ok - {$message}\n";
        return;
    }

    ++$failures;
    echo "not ok - {$message}\n";
    echo '  expected: ' . var_export($expected, true) . "\n";
    echo '  actual:   ' . var_export($actual, true) . "\n";
}

function feedContractAssertContains($needle, $actual, $message)
{
    feedContractAssertSame(true, is_string($actual) && strpos($actual, $needle) !== false, $message);
}

function feedContractAssertNotContains($needle, $actual, $message)
{
    feedContractAssertSame(false, is_string($actual) && strpos($actual, $needle) !== false, $message);
}

function setFeedContentMode($mode)
{
    $GLOBALS['VOIDSetting'] = array(
        'feedContentMode' => $mode,
        'largePhotoSet' => false
    );
}

$feed = new FeedContractWidget(array('type' => 'feed'));
$legacyFeed = new FeedContractWidget(array('isFeed' => true));
$page = new FeedContractWidget(array('type' => 'post'));
$source = '<p>第一段</p><p>第二段</p>';
$defaultCta = '<p class="more">请前往 <a href="https://example.test/posts/feed-preview">'
    . 'https://example.test/posts/feed-preview</a> 阅读全文</p>';

setFeedContentMode(0);
feedContractAssertSame(false, Contents::shouldTruncateFeed($feed), '默认模式不启用 Feed 截断');
feedContractAssertSame(
    $source,
    Contents::contentEx_999($source, $feed, null),
    '默认模式保持 Typecho 原始 Feed 内容'
);
feedContractAssertSame(
    '<p>上一个过滤器</p>',
    Contents::contentEx_999($source, $feed, '<p>上一个过滤器</p>'),
    '默认模式继续传递过滤链的最后结果'
);

$alertSource = '<blockquote>[!NOTE]<br>Feed 正文</blockquote>';
$fullAlertFeed = Contents::contentEx($alertSource, $feed, null);
feedContractAssertSame(
    '<blockquote><p>说明</p><p>Feed 正文</p></blockquote>',
    $fullAlertFeed,
    '完整 Feed 清理 Alert class 后保留标题和正文顺序'
);
feedContractAssertSame(
    '<blockquote><p>普通引用</p></blockquote>',
    Contents::contentEx('<blockquote><p>普通引用</p></blockquote>', $feed, null),
    '完整 Feed 中普通引用保持不变'
);
feedContractAssertSame(
    '<blockquote class="void-alert void-alert--note"><p class="void-alert__title">说明</p>'
        . '<p>Feed 正文</p></blockquote>',
    Contents::excerptEx($alertSource, $page, null),
    '普通摘要保留 Alert 结构'
);

setFeedContentMode(1);
feedContractAssertSame(false, Contents::shouldTruncateFeed($page), '普通文章页面不启用 Feed 截断');
feedContractAssertSame($source, Contents::contentEx_999($source, $page, null), '非 Feed 正文保持不变');
feedContractAssertSame($source, Contents::excerptEx_999($source, $page, null), '非 Feed 摘要保持不变');
feedContractAssertSame(true, Contents::shouldTruncateFeed($feed), 'type=feed 信号启用截断');
feedContractAssertSame(true, Contents::shouldTruncateFeed($legacyFeed), 'isFeed 信号兼容旧版 Feed 调用');
feedContractAssertSame(
    false,
    Contents::shouldTruncateFeed(new FeedContractWidget(array('isFeed' => true), null, array('single'))),
    '单篇文章的评论 Feed 不启用正文截断'
);
feedContractAssertSame(
    false,
    Contents::shouldTruncateFeed(new FeedContractWidget(array('type' => 'comments'))),
    '独立评论 Feed 不启用正文截断'
);

$truncatedAlertFeed = Contents::contentEx_999(
    $alertSource,
    $feed,
    Contents::contentEx($alertSource, $feed, null)
);
feedContractAssertContains(
    '<p>说明 Feed 正文</p>',
    $truncatedAlertFeed,
    '截断 Feed 将 Alert 标题和正文输出为可读导语'
);
feedContractAssertNotContains('void-alert', $truncatedAlertFeed, '截断 Feed 不保留主题样式 class');

$basic = Contents::contentEx_999($source, $feed, null);
feedContractAssertContains('<p>第一段</p>', $basic, '正文 Feed 保留首个文本段落');
feedContractAssertNotContains('第二段', $basic, '正文 Feed 丢弃后续段落');
feedContractAssertContains(
    $defaultCta,
    $basic,
    '正文 Feed 追加固定阅读全文提示'
);
feedContractAssertSame(1, substr_count($basic, 'class="more"'), '阅读全文提示只输出一次');
feedContractAssertSame(
    '<p>第一段</p>',
    Contents::excerptEx_999($basic, $feed, null),
    'Feed 摘要只保留 teaser，不包含阅读全文提示'
);

$twice = Contents::contentEx_999($basic, $feed, null);
feedContractAssertSame(1, substr_count($twice, 'class="more"'), '重复处理已有 CTA 时仍只输出一个提示');
feedContractAssertContains('<p>第一段</p>', $twice, '重复处理保留原 teaser');

$moreSeparated = Contents::contentEx_999(
    '<p>分隔符之前</p><!--more--><p>分隔符之后</p>',
    $feed,
    null
);
feedContractAssertContains('<p>分隔符之前</p>', $moreSeparated, '主题截断保留 more 分隔符前的首段');
feedContractAssertNotContains('分隔符之后', $moreSeparated, '主题截断不泄漏 more 分隔符后的正文');
feedContractAssertNotContains('<!--more-->', $moreSeparated, '主题 Feed 不输出 more 分隔符');
feedContractAssertSame(1, substr_count($moreSeparated, 'class="more"'), 'more 文章只输出主题 CTA');

$lastResult = Contents::contentEx_999(
    '<p>原始数据</p>',
    $feed,
    '<p>过滤链结果</p><p>不会保留</p>'
);
feedContractAssertContains('<p>过滤链结果</p>', $lastResult, '截断基于过滤链的最后结果');
feedContractAssertNotContains('原始数据', $lastResult, '存在最后结果时不回退原始数据');

$rich = '<h2>跳过标题</h2>'
    . '<p> &nbsp; </p>'
    . '<figure><img src="/cover.jpg" alt="图片替代文本"><figcaption>图题</figcaption></figure>'
    . '<pre>跳过预格式文本</pre>'
    . '<code>跳过行内代码块</code>'
    . '<script>跳过脚本</script>'
    . '<style>跳过样式</style>'
    . '<template><p>跳过模板</p></template>'
    . '<iframe>跳过框架</iframe>'
    . '<form><p>跳过表单</p></form>'
    . "<p title=\"1 > 0\"> 第一&nbsp;段\n\t<strong>加粗 &amp; 安全</strong> 文本 </p>"
    . '<p>后续正文</p>';
$richFeed = Contents::contentEx_999($rich, $feed, null);
feedContractAssertContains(
    '<p>第一 段 加粗 &amp; 安全 文本</p>',
    $richFeed,
    '首段转为解码实体、折叠空白并重新转义的纯文本'
);
foreach (array(
    '跳过标题',
    '图片替代文本',
    '图题',
    '跳过预格式文本',
    '跳过行内代码块',
    '跳过脚本',
    '跳过样式',
    '跳过模板',
    '跳过框架',
    '跳过表单',
    '后续正文',
    '<strong>'
) as $unexpected) {
    feedContractAssertNotContains($unexpected, $richFeed, '首段输出排除 ' . $unexpected);
}

$rawTextFeed = Contents::contentEx_999(
    '<p>首段开头<script>const sample = "<p>";</script>首段结尾</p><p>第二段秘密</p>',
    $feed,
    null
);
feedContractAssertContains('<p>首段开头首段结尾</p>', $rawTextFeed, '脚本原始文本中的伪标签不干扰首段边界');
feedContractAssertNotContains('第二段秘密', $rawTextFeed, '脚本伪标签不会导致后续正文泄漏');

$hiddenFeed = Contents::contentEx_999(
    '<p hidden>隐藏导语</p><details><summary>折叠说明</summary><p>折叠正文</p></details><p>公开导语</p>',
    $feed,
    null
);
feedContractAssertContains('<p>公开导语</p>', $hiddenFeed, 'hidden 和关闭的 details 不参与导语提取');
feedContractAssertNotContains('隐藏导语', $hiddenFeed, 'hidden 文本不会进入 Feed');
feedContractAssertNotContains('折叠正文', $hiddenFeed, '关闭的 details 正文不会进入 Feed');

$openDetailsFeed = Contents::contentEx_999(
    '<details open><summary>展开说明</summary><p>展开正文</p></details><p>后续</p>',
    $feed,
    null
);
feedContractAssertContains('<p>展开正文</p>', $openDetailsFeed, '展开的 details 正文仍可作为可见导语');
feedContractAssertNotContains('后续', $openDetailsFeed, '展开 details 中的首段保持文档顺序');

$blockCandidates = array(
    '<blockquote> 引用 <em>内容</em> </blockquote><p>后续</p>' => '<p>引用 内容</p>',
    '<ul><li>第一 <strong>项</strong></li><li>第二&nbsp;项 &amp; 更多</li><li><img src="/empty.jpg"></li></ul><p>后续</p>'
        => '<p>第一 项；第二 项 &amp; 更多</p>',
    '<ol><li>甲</li><li>乙</li></ol><p>后续</p>' => '<p>甲；乙</p>'
);
foreach ($blockCandidates as $html => $expectedTeaser) {
    $candidateFeed = Contents::contentEx_999($html, $legacyFeed, null);
    feedContractAssertContains($expectedTeaser, $candidateFeed, $expectedTeaser . ' 可作为首个文本块');
    feedContractAssertSame(
        $expectedTeaser,
        Contents::excerptEx_999($candidateFeed, $legacyFeed, null),
        $expectedTeaser . ' 在摘要中保持纯 teaser'
    );
}

$longText = str_repeat('测', 301);
$longFeed = Contents::contentEx_999('<p>' . $longText . '</p>', $feed, null);
feedContractAssertContains(
    '<p>' . str_repeat('测', 297) . '...</p>',
    $longFeed,
    '超过 300 个 Unicode 字符时截断为 297 字加省略号'
);
feedContractAssertNotContains('<p>' . $longText . '</p>', $longFeed, '超长 teaser 不保留第 301 个字符');

$exactLimit = str_repeat('界', 300);
$exactLimitFeed = Contents::contentEx_999('<p>' . $exactLimit . '</p>', $feed, null);
feedContractAssertContains('<p>' . $exactLimit . '</p>', $exactLimitFeed, '恰好 300 个 Unicode 字符完整保留');
feedContractAssertNotContains('...</p>', $exactLimitFeed, '未超过 300 字符时不追加省略号');

$mixedNoSpaces = str_repeat('a', 100) . str_repeat('文', 100) . str_repeat('😀', 99);
$mixedNoSpacesFeed = Contents::contentEx_999('<p>' . $mixedNoSpaces . '</p>', $feed, null);
feedContractAssertContains(
    '<p>' . $mixedNoSpaces . '</p>',
    $mixedNoSpacesFeed,
    '299 个英文、中文与 emoji 无空格字符按 Unicode 字符完整保留'
);
feedContractAssertNotContains('...</p>', $mixedNoSpacesFeed, '299 个混合字符不追加省略号');

$emojiLong = str_repeat('😀', 301);
$emojiLongFeed = Contents::contentEx_999('<p>' . $emojiLong . '</p>', $feed, null);
feedContractAssertContains(
    '<p>' . str_repeat('😀', 297) . '...</p>',
    $emojiLongFeed,
    'emoji 超长内容按 Unicode 字符而非字节截断'
);

$plainTextFeed = Contents::contentEx_999('纯文本&nbsp;fallback &amp; 安全', $feed, null);
feedContractAssertContains(
    '<p>纯文本 fallback &amp; 安全</p>',
    $plainTextFeed,
    '没有候选块时回退到全文可见纯文本'
);

$malformedFeed = Contents::contentEx_999('<p>未闭合 <strong>仍可见', $feed, null);
feedContractAssertContains('<p>未闭合 仍可见</p>', $malformedFeed, '畸形未闭合 HTML 安全降级为可见文本');

$guardedFieldsFeed = new FeedContractWidget(
    array('type' => 'feed'),
    'https://example.test/posts/no-custom-excerpt',
    array(),
    new FeedContractForbiddenFields()
);
try {
    $guardedOutput = Contents::contentEx_999('<p>只取正文</p>', $guardedFieldsFeed, null);
    feedContractAssertContains('<p>只取正文</p>', $guardedOutput, 'Feed 截断不读取 fields->excerpt');
} catch (RuntimeException $exception) {
    feedContractAssertSame('未读取自定义字段', $exception->getMessage(), 'Feed 截断不读取 fields->excerpt');
}

$unsafeUrl = 'https://example.test/read?a=1&b="two"<three>';
$unsafeUrlFeed = new FeedContractWidget(array('type' => 'feed'), $unsafeUrl);
$escapedCta = Contents::contentEx_999('<p>链接安全</p>', $unsafeUrlFeed, null);
feedContractAssertContains(
    '<p class="more">请前往 <a href="https://example.test/read?a=1&amp;b=&quot;two&quot;&lt;three&gt;">https://example.test/read?a=1&amp;b=&quot;two&quot;&lt;three&gt;</a> 阅读全文</p>',
    $escapedCta,
    '阅读全文 URL 同时按属性和文本上下文安全转义'
);

foreach (array(
    '',
    '/posts/relative',
    'ftp://example.test/archive',
    'javascript:alert(1)',
    'not a url'
) as $invalidUrl) {
    $invalidUrlFeed = new FeedContractWidget(array('type' => 'feed'), $invalidUrl);
    $invalidUrlOutput = Contents::contentEx_999('<p>无链接 teaser</p>', $invalidUrlFeed, null);
    feedContractAssertSame('<p>无链接 teaser</p>', $invalidUrlOutput, '非法原文地址不生成 CTA: ' . $invalidUrl);
    feedContractAssertNotContains('<a ', $invalidUrlOutput, '非法原文地址不输出链接: ' . $invalidUrl);
}

$emptySource = '<h2>标题</h2><figure><img src="/only-image.jpg" alt="替代文本"></figure>'
    . '<pre>代码</pre><script>脚本</script>';
$emptyFeed = Contents::contentEx_999($emptySource, $feed, null);
feedContractAssertSame($defaultCta, $emptyFeed, '纯图片及不可用块正文只输出 CTA');
feedContractAssertSame('', Contents::excerptEx_999($emptyFeed, $feed, null), '无可见正文块时 Feed 摘要为空');
feedContractAssertSame($defaultCta, Contents::contentEx_999('', $feed, null), '空正文只输出 CTA');
feedContractAssertSame($defaultCta, Contents::contentEx_999(null, $feed, null), '非字符串正文只输出 CTA');
feedContractAssertSame('', Contents::excerptEx_999('', $feed, null), '空摘要保持为空');
feedContractAssertSame('', Contents::excerptEx_999(null, $feed, null), '非字符串摘要归一为空');

$functionsSource = file_get_contents(dirname(__DIR__, 2) . '/functions.php');
feedContractAssertContains(
    'if (Contents::shouldTruncateFeed($archive))',
    $functionsSource,
    'themeInit 只在主题 Feed 截断生效时覆盖核心选项'
);
feedContractAssertContains(
    '$options->feedFullText = true;',
    $functionsSource,
    '主题截断请求强制使用 content 分支，避开 feedFullText/more 的核心双链接分支'
);

setFeedContentMode(2);
feedContractAssertSame(false, Contents::shouldTruncateFeed($feed), '非法模式不会意外启用 Feed 截断');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} Contents Feed contract test(s) failed.\n");
    exit(1);
}

echo "All Contents Feed contract tests passed.\n";

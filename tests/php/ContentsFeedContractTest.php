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
}

class FeedContractWidget
{
    public $parameter;

    public function __construct($parameters)
    {
        $this->parameter = new FeedContractParameter($parameters);
    }
}

require_once dirname(__DIR__, 2) . '/libs/Contents.php';

$GLOBALS['VOIDSetting'] = array('largePhotoSet' => false);
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

function feedContractAssertNotContains($needle, $actual, $message)
{
    feedContractAssertSame(false, is_string($actual) && strpos($actual, $needle) !== false, $message);
}

$feed = new FeedContractWidget(array('type' => 'feed'));
$legacyFeed = new FeedContractWidget(array('isFeed' => true));
$source = '<p>第一段</p><p>第二段</p>';

feedContractAssertSame(
    $source,
    Contents::contentEx($source, $feed, null),
    'Feed 保留完整的多段正文'
);
feedContractAssertNotContains(
    'class="more"',
    Contents::contentEx($source, $feed, null),
    '主题不向 Feed 追加阅读全文链接'
);

$decorated = '<p class="content" style="color:red" data-void-test="1">第一段</p><p>第二段</p>';
$staticContent = '<p>第一段</p><p>第二段</p>';
feedContractAssertSame(
    $staticContent,
    Contents::contentEx($decorated, $feed, null),
    'type=feed 信号清理主题交互属性但不截断'
);
feedContractAssertSame(
    $staticContent,
    Contents::contentEx($decorated, $legacyFeed, null),
    'isFeed 信号继续兼容旧版 Feed 调用'
);

$alertSource = '<blockquote>[!NOTE]<br>Feed 正文</blockquote>';
feedContractAssertSame(
    '<blockquote><p>说明</p><p>Feed 正文</p></blockquote>',
    Contents::contentEx($alertSource, $feed, null),
    'Feed 清理 Alert class 后保留标题和正文顺序'
);
feedContractAssertSame(
    '<blockquote><p>普通引用</p></blockquote>',
    Contents::contentEx('<blockquote><p>普通引用</p></blockquote>', $feed, null),
    'Feed 中普通引用保持不变'
);

$functionsSource = file_get_contents(dirname(__DIR__, 2) . '/functions.php');
foreach (array('contentEx_999', 'excerptEx_999', 'shouldTruncateFeed', 'feedFullText', 'feedContentMode') as $retired) {
    feedContractAssertNotContains($retired, $functionsSource, '主题初始化不再包含 ' . $retired);
}

$contentsSource = file_get_contents(dirname(__DIR__, 2) . '/libs/Contents.php');
foreach (array('contentEx_999', 'excerptEx_999', 'shouldTruncateFeed', 'renderFeedTeaser') as $retired) {
    feedContractAssertNotContains($retired, $contentsSource, '内容处理不再包含 ' . $retired);
}

if ($failures > 0) {
    fwrite(STDERR, "{$failures} Contents Feed contract test(s) failed.\n");
    exit(1);
}

echo "All Contents Feed contract tests passed.\n";

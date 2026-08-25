<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class EmptySiteQuery
{
    public function from($table)
    {
        return $this;
    }

    public function where($condition, $value = null)
    {
        return $this;
    }

    public function order($field, $direction)
    {
        return $this;
    }

    public function limit($limit)
    {
        return $this;
    }
}

class Typecho_Db
{
    const SORT_ASC = 'ASC';

    public static $row = null;
    private static $instance;

    public static function get()
    {
        if (!self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function select()
    {
        return new EmptySiteQuery();
    }

    public function fetchRow($query)
    {
        return self::$row;
    }
}

class EmptySiteOptions
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

    public function charset()
    {
        echo 'UTF-8';
    }

    public function index($path)
    {
        echo 'https://example.test' . $path;
    }

    public function themeUrl($path)
    {
        echo 'https://example.test/usr/themes/VOID' . $path;
    }
}

class Helper
{
    public static $options;

    public static function options()
    {
        return self::$options;
    }
}

class Contents
{
    public static function title($archive)
    {
        echo 'Empty site contract';
    }
}

class EmptySiteRequest
{
    private $uri;

    public function __construct($uri)
    {
        $this->uri = $uri;
    }

    public function getRequestUri()
    {
        return $this->uri;
    }

    public function isPost()
    {
        return false;
    }
}

class EmptySiteHeadWidget
{
    public $created = 1609459200;
    public $excerptCalls = 0;
    public $fields;
    public $modified = 1609459200;
    public $options;
    public $permalink = 'https://example.test/post.html';
    public $request;
    private $archiveType;
    private $hasContent;
    private $throwOnExcerpt;

    public function __construct($archiveType, $hasContent, $throwOnExcerpt)
    {
        $this->archiveType = $archiveType;
        $this->hasContent = $hasContent;
        $this->throwOnExcerpt = $throwOnExcerpt;
        $this->fields = (object) array('banner' => '', 'excerpt' => '');
        $this->options = Helper::options();
        $this->request = new EmptySiteRequest('/' . $archiveType . '/');
    }

    public function author()
    {
        echo 'author';
    }

    public function excerpt($length)
    {
        ++$this->excerptCalls;
        if ($this->throwOnExcerpt) {
            throw new RuntimeException('Non-content archive called excerpt()');
        }
        echo 'post excerpt';
    }

    public function have()
    {
        return $this->hasContent;
    }

    public function header($rules)
    {
    }

    public function is($type)
    {
        return $type === $this->archiveType;
    }

    public function render($path)
    {
        ob_start();
        try {
            include $path;
            return ob_get_clean();
        } catch (Exception $exception) {
            ob_end_clean();
            throw $exception;
        }
    }
}

require_once dirname(__DIR__, 2) . '/libs/Utils.php';

$failures = 0;

function emptySiteAssertSame($expected, $actual, $message)
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

function emptySiteAssertContains($needle, $haystack, $message)
{
    emptySiteAssertSame(true, strpos($haystack, $needle) !== false, $message);
}

function emptySiteCaptureBuildTime()
{
    ob_start();
    Utils::getBuildTime();
    return ob_get_clean();
}

foreach (array(null, false, array()) as $emptyRow) {
    Typecho_Db::$row = $emptyRow;
    $before = date('Y-m-d\TH:i');
    $actual = emptySiteCaptureBuildTime();
    $after = date('Y-m-d\TH:i');
    emptySiteAssertSame(
        true,
        $actual === $before || $actual === $after,
        '空内容查询 ' . var_export($emptyRow, true) . ' 在 PHP 8 下回退当前时间'
    );
}

Typecho_Db::$row = array('created' => 1609459200);
emptySiteAssertSame(
    date('Y-m-d\TH:i', 1609459200),
    emptySiteCaptureBuildTime(),
    '有内容时继续输出最早公开内容时间'
);

$_POST = array();
$_COOKIE = array();
$GLOBALS['VOIDVersion'] = 'test';
$GLOBALS['VOIDSetting'] = array(
    'brandFont' => array(),
    'browserLevelLoadingLazy' => false,
    'colorScheme' => 3,
    'desktopBannerHeight' => '',
    'enableMath' => false,
    'head' => '',
    'headerMode' => 0,
    'indexStyle' => 0,
    'lazyload' => false,
    'lineNumbers' => false,
    'mobileBannerHeight' => '',
    'pjax' => false,
    'serifincontent' => false,
    'siteBg' => '',
    'siteBgVertical' => '',
    'twitterId' => '',
    'useFiraCodeFont' => false,
    'VOIDPlugin' => false
);

$headTemplate = dirname(__DIR__, 2) . '/includes/head.php';
Helper::$options = new EmptySiteOptions(array(
    'description' => '',
    'loginAction' => 'https://example.test/action/login',
    'rootUrl' => 'https://example.test'
));
Typecho_Db::$row = null;

foreach (array('index', 'search', 'category', 'archive', '404') as $archiveType) {
    $widget = new EmptySiteHeadWidget($archiveType, false, true);
    $rendered = $widget->render($headTemplate);

    emptySiteAssertSame(0, $widget->excerptCalls, $archiveType . ' 空上下文不调用文章摘要 API');
    emptySiteAssertContains('<meta name="description" content="" />', $rendered, $archiveType . ' 保留空站点描述');
    emptySiteAssertContains('<meta property="og:description" content="" />', $rendered, $archiveType . ' 保留空 OG 描述');
    emptySiteAssertContains('<meta name="twitter:description" content="" />', $rendered, $archiveType . ' 保留空 Twitter 描述');
    emptySiteAssertContains('buildTime : "', $rendered, $archiveType . ' 仍能生成完整前端配置');
}

Helper::$options = new EmptySiteOptions(array(
    'description' => 'site description',
    'loginAction' => 'https://example.test/action/login',
    'rootUrl' => 'https://example.test'
));
$archiveWithDescription = new EmptySiteHeadWidget('search', false, true);
$descriptionHead = $archiveWithDescription->render($headTemplate);
emptySiteAssertSame(0, $archiveWithDescription->excerptCalls, '非内容页有站点描述时也不调用文章摘要 API');
emptySiteAssertSame(3, substr_count($descriptionHead, 'content="site description"'), '站点描述复用于三处描述元数据');

$post = new EmptySiteHeadWidget('post', true, false);
$postHead = $post->render($headTemplate);
emptySiteAssertSame(1, $post->excerptCalls, '真实文章缺少自定义摘要时只调用一次文章摘要 API');
emptySiteAssertSame(3, substr_count($postHead, 'content="post excerpt"'), '文章摘要复用于三处描述元数据');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} empty-site contract test(s) failed.\n");
    exit(1);
}

echo "All empty-site contract tests passed.\n";

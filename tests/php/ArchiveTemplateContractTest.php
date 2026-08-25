<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

if (!function_exists('_t')) {
    function _t($message)
    {
        return $message;
    }
}

require_once dirname(__DIR__, 2) . '/libs/Utils.php';

if (!class_exists('Contents', false)) {
    class Contents
    {
        public static function title($archive)
        {
            echo 'archive-contract-title';
        }
    }
}

class ArchiveTemplateContractWidget
{
    public $needed = array();
    public $pageNavCalls = 0;
    public $archiveTitleCalls = 0;
    private $archiveType;
    private $archiveSlug;
    private $hasPosts;

    public function __construct($archiveType, $archiveSlug, $hasPosts = false)
    {
        $this->archiveType = $archiveType;
        $this->archiveSlug = $archiveSlug;
        $this->hasPosts = $hasPosts;
    }

    public function getArchiveType()
    {
        return $this->archiveType;
    }

    public function getArchiveSlug()
    {
        return $this->archiveSlug;
    }

    public function have()
    {
        return $this->hasPosts;
    }

    public function is($archiveType, $archiveSlug = null)
    {
        $matchesType = $archiveType === $this->archiveType
            || ($archiveType === 'archive' && $this->archiveType !== 'index');

        return $matchesType && ($archiveSlug === null || $archiveSlug === $this->archiveSlug);
    }

    public function need($path)
    {
        $this->needed[] = $path;
    }

    public function archiveTitle($formats, $before = '', $after = '')
    {
        ++$this->archiveTitleCalls;
        if (isset($formats[$this->archiveType])) {
            echo $before . sprintf($formats[$this->archiveType], $this->archiveSlug) . $after;
        }
    }

    public function pageNav()
    {
        ++$this->pageNavCalls;
    }

    public function render($file)
    {
        ob_start();
        include $file;
        return ob_get_clean();
    }
}

$failures = 0;

function archiveTemplateAssertSame($expected, $actual, $message)
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

function archiveTemplateAssertContains($needle, $haystack, $message)
{
    archiveTemplateAssertSame(true, strpos($haystack, $needle) !== false, $message);
}

function archiveTemplateAssertNotContains($needle, $haystack, $message)
{
    archiveTemplateAssertSame(false, strpos($haystack, $needle) !== false, $message);
}

$notFound = new ArchiveTemplateContractWidget('archive', '404', false);
$emptySearch = new ArchiveTemplateContractWidget('search', 'nothing-here', false);
$categoryNamed404 = new ArchiveTemplateContractWidget('category', '404', false);
$emptyArchive = new ArchiveTemplateContractWidget('archive', '2026-08', false);

archiveTemplateAssertSame(true, Utils::isNotFoundArchive($notFound), 'Typecho 的 archive/404 上下文识别为真实 404');
archiveTemplateAssertSame(false, Utils::isNotFoundArchive($emptySearch), '零结果搜索不是 404');
archiveTemplateAssertSame(false, Utils::isNotFoundArchive($categoryNamed404), 'slug 为 404 的合法分类不是 404');
archiveTemplateAssertSame(false, Utils::isNotFoundArchive($emptyArchive), '普通空日期归档不是 404');
archiveTemplateAssertSame(false, Utils::isNotFoundArchive(null), '无效归档对象不会被误判为 404');

$archiveTemplate = dirname(__DIR__, 2) . '/archive.php';
$_SERVER['HTTP_X_PJAX'] = 'true';

$notFound->render($archiveTemplate);
archiveTemplateAssertSame(
    array('includes/404.php'),
    $notFound->needed,
    '真实 404 进入故障页分支'
);

$emptySearch->render($archiveTemplate);
archiveTemplateAssertSame(
    array('includes/archives.php'),
    $emptySearch->needed,
    '零结果搜索继续进入正常归档分支'
);

$categoryNamed404->render($archiveTemplate);
archiveTemplateAssertSame(
    array('includes/archives.php'),
    $categoryNamed404->needed,
    '合法的 404 分类继续进入正常归档分支'
);

unset($_SERVER['HTTP_X_PJAX']);

$GLOBALS['VOIDSetting'] = array(
    'defaultBanner' => '',
    'indexStyle' => 0
);

$bannerTemplate = dirname(__DIR__, 2) . '/includes/banner.php';
$emptySearchBanner = $emptySearch->render($bannerTemplate);
archiveTemplateAssertNotContains(' not-found', $emptySearchBanner, '零结果搜索 Banner 不使用 404 外观');
archiveTemplateAssertContains(
    '包含关键字 "nothing-here" 的文章',
    $emptySearchBanner,
    '零结果搜索 Banner 保留搜索词和归档标题'
);
archiveTemplateAssertNotContains('<span class="glitch">0</span>', $emptySearchBanner, '零结果搜索不再退回数字 0 标题');

$category404Banner = $categoryNamed404->render($bannerTemplate);
archiveTemplateAssertNotContains(' not-found', $category404Banner, '404 分类 Banner 不使用 404 外观');
archiveTemplateAssertContains('分类 "404" 下的文章', $category404Banner, '404 分类 Banner 保留合法分类标题');

$notFoundBanner = $notFound->render($bannerTemplate);
archiveTemplateAssertContains(' not-found', $notFoundBanner, '真实 404 Banner 保留故障页外观');
archiveTemplateAssertContains('<span class="glitch">0</span>', $notFoundBanner, '真实 404 Banner 保留故障标题');

$emptyListWidget = new ArchiveTemplateContractWidget('search', 'nothing-here', false);
$emptyList = $emptyListWidget->render(dirname(__DIR__, 2) . '/includes/archives.php');
archiveTemplateAssertContains('class="archive-empty" role="status"', $emptyList, '合法空归档输出正式空状态');
archiveTemplateAssertContains('暂时没有找到文章', $emptyList, '合法空归档输出清晰提示');
archiveTemplateAssertNotContains('<ul id="masonry">', $emptyList, '合法空归档不输出空瀑布流容器');
archiveTemplateAssertSame(0, $emptyListWidget->pageNavCalls, '合法空归档不输出无效分页');
archiveTemplateAssertSame(1, $emptyListWidget->archiveTitleCalls, '合法空归档仍输出语义标题');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} archive template contract test(s) failed.\n");
    exit(1);
}

echo "All archive template contract tests passed.\n";

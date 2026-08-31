<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class Utils
{
    public static function captureOutput($target, $method, $arguments = array())
    {
        ob_start();
        call_user_func_array(array($target, $method), $arguments);
        return ob_get_clean();
    }

    public static function decodeHtmlEntities($value)
    {
        return html_entity_decode((string) $value, ENT_QUOTES, 'UTF-8');
    }

    public static function decodeHtmlText($value)
    {
        return html_entity_decode(strip_tags((string) $value), ENT_QUOTES, 'UTF-8');
    }

    public static function escapeHtml($value)
    {
        return htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');
    }

    public static function isNotFoundArchive($archive)
    {
        return false;
    }

    public static function getCatNum()
    {
        return 0;
    }

    public static function getPostNum()
    {
        return 0;
    }

    public static function getTagNum()
    {
        return 0;
    }
}

class BannerSourceTemplateAuthor
{
    public function permalink()
    {
        echo 'https://example.test/author';
    }
}

class BannerSourceTemplateUser
{
    public function hasLogin()
    {
        return false;
    }
}

class BannerSourceTemplateWidget
{
    public $author;
    public $created = 1767225600;
    public $fields;
    public $template;
    public $user;
    private $contentType;

    public function __construct($contentType, $banner, $bannerSource, $bannerStyle = '0', $template = null)
    {
        $this->contentType = $contentType;
        $this->template = $template === null ? $contentType . '.php' : $template;
        $this->author = new BannerSourceTemplateAuthor();
        $this->user = new BannerSourceTemplateUser();
        $this->fields = new stdClass();
        $this->fields->banner = $banner;
        $this->fields->bannerSource = $bannerSource;
        $this->fields->bannerStyle = $bannerStyle;
    }

    public function is($type)
    {
        return $type === $this->contentType;
    }

    public function title()
    {
        echo '题图来源测试';
    }

    public function author()
    {
        echo '测试作者';
    }

    public function commentsNum()
    {
        echo '3';
    }

    public function render($file)
    {
        ob_start();
        include $file;
        return ob_get_clean();
    }
}

require_once dirname(__DIR__, 2) . '/libs/Contents.php';

$failures = 0;

function bannerSourceTemplateAssertSame($expected, $actual, $message)
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

function bannerSourceTemplateAssertContains($needle, $haystack, $message)
{
    bannerSourceTemplateAssertSame(true, strpos($haystack, $needle) !== false, $message);
}

function bannerSourceTemplateAssertNotContains($needle, $haystack, $message)
{
    bannerSourceTemplateAssertSame(false, strpos($haystack, $needle) !== false, $message);
}

$GLOBALS['VOIDSetting'] = array(
    'defaultBanner' => '',
    'VOIDPlugin' => false
);

$bannerTemplate = dirname(__DIR__, 2) . '/includes/banner.php';
$longText = str_repeat('完整来源说明', 12);
$source = $longText . ' [来源站点 & 说明](https://example.test/source?foo=1&bar=2) <script>alert(1)</script>';
$post = new BannerSourceTemplateWidget('post', 'https://example.test/banner.jpg', $source);
$postHtml = $post->render($bannerTemplate);

bannerSourceTemplateAssertSame(1, substr_count($postHtml, 'class="banner-source-meta"'), '有题图和来源的文章只输出一行来源');
bannerSourceTemplateAssertSame(
    true,
    strpos($postHtml, 'class="banner-source-meta"') > strpos($postHtml, 'class="post-meta"'),
    '来源行位于主要元信息之后'
);
bannerSourceTemplateAssertContains('封面图来源：', $postHtml, '来源行使用明确的封面图来源文案');
bannerSourceTemplateAssertContains($longText, $postHtml, '较长来源保持完整输出');
bannerSourceTemplateAssertContains('href="https://example.test/source?foo=1&amp;bar=2"', $postHtml, '来源链接按 HTML 属性安全转义');
bannerSourceTemplateAssertContains('来源站点 &amp; 说明', $postHtml, '来源链接文字按 HTML 文本安全转义');
bannerSourceTemplateAssertContains('&lt;script&gt;alert(1)&lt;/script&gt;', $postHtml, '来源普通文本不会注入 HTML');
bannerSourceTemplateAssertNotContains('<script>alert(1)</script>', $postHtml, '来源不输出未转义脚本');

$page = new BannerSourceTemplateWidget('page', 'https://example.test/page.jpg', '页面来源');
bannerSourceTemplateAssertSame(1, substr_count($page->render($bannerTemplate), 'class="banner-source-meta"'), '普通独立页复用来源第二行');

$gallery = new BannerSourceTemplateWidget('page', 'https://example.test/gallery.jpg', 'Gallery 来源', '0', 'Gallery.php');
bannerSourceTemplateAssertSame(1, substr_count($gallery->render($bannerTemplate), 'class="banner-source-meta"'), 'Gallery 复用来源第二行');

$archives = new BannerSourceTemplateWidget('page', 'https://example.test/archives.jpg', '归档来源', '0', 'Archives.php');
bannerSourceTemplateAssertNotContains('class="banner-source-meta"', $archives->render($bannerTemplate), '归档专页不输出内容来源');

$emptySource = new BannerSourceTemplateWidget('post', 'https://example.test/banner.jpg', '');
bannerSourceTemplateAssertNotContains('class="banner-source-meta"', $emptySource->render($bannerTemplate), '来源为空时不保留来源行');

$emptyBanner = new BannerSourceTemplateWidget('post', '', '仍有来源');
bannerSourceTemplateAssertNotContains('class="banner-source-meta"', $emptyBanner->render($bannerTemplate), '题图为空时不保留来源行');

$hiddenBanner = new BannerSourceTemplateWidget('post', 'https://example.test/banner.jpg', '仍有来源', '2');
bannerSourceTemplateAssertNotContains('class="banner-source-meta"', $hiddenBanner->render($bannerTemplate), '题图设为不显示时不保留来源行');

$unsafeLinkHtml = Contents::getBannerSourceHtml('[危险链接](javascript:alert(1))');
bannerSourceTemplateAssertNotContains('href="javascript:', $unsafeLinkHtml, '不安全协议不会生成来源链接');

$mainTemplate = file_get_contents(dirname(__DIR__, 2) . '/includes/main.php');
$galleryTemplate = file_get_contents(dirname(__DIR__, 2) . '/Gallery.php');
$coverTemplate = file_get_contents(dirname(__DIR__, 2) . '/includes/main-large.php');
$bannerStyles = file_get_contents(dirname(__DIR__, 2) . '/assets/parts/_index.scss');

bannerSourceTemplateAssertNotContains("\$this->need('includes/banner-source.php')", $mainTemplate, '普通内容不再输出外置来源横带');
bannerSourceTemplateAssertNotContains("\$this->need('includes/banner-source.php')", $galleryTemplate, 'Gallery 不再输出外置来源横带');
bannerSourceTemplateAssertContains("\$this->need('includes/banner-source.php')", $coverTemplate, '封面文章保留独立来源布局');
bannerSourceTemplateAssertContains("\$bannerSourceDisplayMode = 'cover'", $coverTemplate, '封面文章继续使用 cover 显示规则');
bannerSourceTemplateAssertContains('max-width: 32rem', $bannerStyles, '来源第二行限制阅读宽度');
bannerSourceTemplateAssertContains('overflow-wrap: anywhere', $bannerStyles, '长来源允许换行');
bannerSourceTemplateAssertNotContains('text-overflow: ellipsis', $bannerStyles, '来源第二行不截断文本');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} banner source template contract test(s) failed.\n");
    exit(1);
}

echo "All banner source template contract tests passed.\n";

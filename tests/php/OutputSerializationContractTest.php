<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class OutputSerializationQuery
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

    public static $row = array('created' => 1609459200);
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
        return new OutputSerializationQuery();
    }

    public function fetchRow($query)
    {
        return self::$row;
    }
}

class Typecho_Common
{
    public static function gravatarUrl($mail, $size, $rating = null, $default = null, $isSecure = true)
    {
        $url = 'https://avatar.example/avatar/hash?s=' . (int) $size;
        if (isset($rating)) {
            $url .= '&amp;r=' . $rating;
        }
        if (isset($default)) {
            $url .= '&amp;d=' . $default;
        }

        return $url;
    }
}

class OutputSerializationOptions
{
    private $values;

    public function __construct($values)
    {
        $this->values = $values;
    }

    public function __get($name)
    {
        if ($name === 'title') {
            return 'bypassed site title property';
        }

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

    public function title()
    {
        echo $this->values['title'];
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
    public static function titleText($archive)
    {
        return $archive->completeTitle;
    }

    public static function title($archive)
    {
        echo Utils::escapeHtml(self::titleText($archive));
    }
}

class OutputSerializationRequest
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

class OutputSerializationAuthor
{
    public $mail = 'author@example.test';
    public $permalink = 'https://property.example.test/author/';
    public $screenName = 'bypassed author property';

    private $outputPermalink;
    private $outputScreenName;

    public function __construct($screenName, $permalink)
    {
        $this->outputScreenName = $screenName;
        $this->outputPermalink = $permalink;
    }

    public function permalink()
    {
        echo $this->outputPermalink;
    }

    public function screenName()
    {
        echo $this->outputScreenName;
    }
}

class OutputSerializationWidget
{
    public $authorReads = 0;
    public $completeTitle;
    public $created = 1609459200;
    public $fields;
    public $modified = 1612137600;
    public $options;
    public $permalink;
    public $request;
    public $title;

    private $archiveType;
    private $archiveUrl;
    private $contentAuthor;
    private $hasContent;
    private $outputPermalink;
    private $outputTitle;

    public function __construct($archiveType, $values)
    {
        $this->archiveType = $archiveType;
        $this->archiveUrl = $values['archiveUrl'];
        $this->completeTitle = $values['completeTitle'];
        $this->contentAuthor = $values['author'];
        $this->fields = (object) array(
            'banner' => $values['banner'],
            'excerpt' => $values['excerpt']
        );
        $this->hasContent = $values['hasContent'];
        $this->options = Helper::options();
        $this->outputPermalink = $values['permalink'];
        $this->outputTitle = $values['title'];
        $this->permalink = 'https://property.example.test/content/';
        $this->request = new OutputSerializationRequest($values['requestUri']);
        $this->title = 'bypassed content title property';
    }

    public function __get($name)
    {
        if ($name === 'author') {
            ++$this->authorReads;
            if (!$this->hasContent) {
                throw new RuntimeException('Non-content context accessed the author');
            }

            return $this->contentAuthor;
        }

        return null;
    }

    public function excerpt($length)
    {
        echo $this->fields->excerpt;
    }

    public function author()
    {
        $this->contentAuthor->screenName();
    }

    public function getArchiveUrl()
    {
        return $this->archiveUrl;
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

    public function permalink()
    {
        echo $this->outputPermalink;
    }

    public function title()
    {
        echo $this->outputTitle;
    }

    public function render($path)
    {
        ob_start();
        try {
            include $path;
            return ob_get_clean();
        } catch (Throwable $throwable) {
            ob_end_clean();
            throw $throwable;
        }
    }
}

require_once dirname(__DIR__, 2) . '/libs/Utils.php';

$failures = 0;

function outputSerializationAssertSame($expected, $actual, $message)
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

function outputSerializationAssertNotContains($needle, $haystack, $message)
{
    outputSerializationAssertSame(false, strpos($haystack, $needle) !== false, $message);
}

function outputSerializationAssertContains($needle, $haystack, $message)
{
    outputSerializationAssertSame(true, strpos($haystack, $needle) !== false, $message);
}

function outputSerializationDecodeHtml($value)
{
    return html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

function outputSerializationMetaContent($html, $attribute, $name)
{
    $pattern = '/<meta\s+' . preg_quote($attribute, '/') . '="' . preg_quote($name, '/')
        . '"\s+content="([^"]*)"\s*\/?>/s';
    if (!preg_match($pattern, $html, $matches)) {
        return null;
    }

    return outputSerializationDecodeHtml($matches[1]);
}

function outputSerializationVoidConfig($html)
{
    if (!preg_match('/window\.VOIDConfig\s*=\s*(\{.*?\});/s', $html, $matches)) {
        return null;
    }

    return json_decode($matches[1], true);
}

function outputSerializationStructuredData($html)
{
    if (!preg_match('/<script\s+type="application\/ld\+json">(.*?)<\/script>/s', $html, $matches)) {
        return null;
    }

    return json_decode($matches[1], true);
}

function outputSerializationWidgetValues($overrides = array())
{
    global $encodedAuthor, $encodedExcerpt, $encodedTitle, $semanticCompleteTitle;
    global $attackBannerUrl, $attackCanonicalUrl, $attackArchiveUrl, $attackAuthorUrl;

    return array_merge(array(
        'archiveUrl' => $attackArchiveUrl,
        'author' => new OutputSerializationAuthor($encodedAuthor, $attackAuthorUrl),
        'banner' => $attackBannerUrl,
        'completeTitle' => $semanticCompleteTitle,
        'excerpt' => $encodedExcerpt,
        'hasContent' => true,
        'permalink' => $attackCanonicalUrl,
        'requestUri' => '/current/?query=a&label="quoted"',
        'title' => $encodedTitle
    ), $overrides);
}

$attackPayload = "A \"double\" 'single' & <tag> 中文\n</script><script id=\"injected\">";
$semanticSiteTitle = '站点 ' . $attackPayload;
$semanticTitle = '文章 ' . $attackPayload;
$semanticCompleteTitle = $semanticTitle . ' - ' . $semanticSiteTitle;
$semanticExcerpt = '摘要 ' . $attackPayload;
$semanticAuthor = '作者 ' . $attackPayload;
$encodedTitle = htmlspecialchars($semanticTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$encodedExcerpt = htmlspecialchars($semanticExcerpt, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$encodedAuthor = htmlspecialchars($semanticAuthor, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$encodedSiteTitle = htmlspecialchars($semanticSiteTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$attackCanonicalUrl = 'https://example.test/post/?a=1&label="quoted"&next=</script>';
$attackArchiveUrl = 'https://example.test/category/topic/?a=1&label="quoted"&next=</script>';
$attackAuthorUrl = 'https://example.test/author/?from=a&label="quoted"&next=</script>';
$attackBannerUrl = 'https://cdn.example/banner.jpg?a=1&label="quoted"&next=</script>';

$hookAwareTemplates = array(
    'Archives.php' => array("Utils::captureOutput(\$tags, 'permalink')", "Utils::captureOutput(\$tags, 'name')"),
    'includes/archives.php' => array("Utils::captureOutput(\$this, 'permalink')", "Utils::captureOutput(\$this, 'title')"),
    'includes/banner.php' => array("Utils::captureOutput(\$this, 'title')", "Utils::captureOutput(\$this->author, 'permalink')"),
    'includes/comments.php' => array("Utils::captureOutput(\$this, 'commentUrl')", "Utils::captureOutput(\$this->options, 'profileUrl')"),
    'includes/footer.php' => array("Utils::captureOutput(\$this->options, 'loginAction')", "Utils::captureOutput(\$this, 'permalink')"),
    'includes/main.php' => array("Utils::captureOutput(\$prev, 'permalink')", "Utils::captureOutput(\$next, 'title')"),
    'index.php' => array("Utils::captureOutput(\$this, 'permalink')", "Utils::captureOutput(\$this, 'title')")
);
foreach ($hookAwareTemplates as $templatePath => $contracts) {
    $templateSource = file_get_contents(dirname(__DIR__, 2) . '/' . $templatePath);
    foreach ($contracts as $contract) {
        outputSerializationAssertContains($contract, $templateSource, $templatePath . ' 保留 Typecho 输出方法钩子');
    }
}

outputSerializationAssertSame(
    $attackPayload,
    Utils::decodeHtmlText(htmlspecialchars($attackPayload, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')),
    'HTML 实体还原为语义纯文本'
);
$escapedPayload = Utils::escapeHtml($attackPayload);
outputSerializationAssertSame(
    $attackPayload,
    outputSerializationDecodeHtml($escapedPayload),
    'HTML 转义后由属性解析器还原为原值'
);
outputSerializationAssertNotContains('</script><script id="injected">', $escapedPayload, 'HTML 转义不保留可执行标签边界');

$encodedJson = Utils::encodeJsonForHtml(array('payload' => $attackPayload), '{}');
outputSerializationAssertSame(
    array('payload' => $attackPayload),
    json_decode($encodedJson, true),
    'script 内 JSON 序列化保留完整语义值'
);
outputSerializationAssertNotContains('</script><script id="injected">', $encodedJson, 'script 内 JSON 不产生提前闭合标签');
$partialJson = Utils::encodeJsonForHtml(array("\xB1\x31"), '{}');
outputSerializationAssertSame(true, is_array(json_decode($partialJson, true)), '非法 UTF-8 仍生成合法 JSON');

foreach (array(1, 2, 3, 4, 5, '1', '2', '3', '4', '5') as $validTextSize) {
    $_COOKIE['textsize'] = $validTextSize;
    outputSerializationAssertSame((int) $validTextSize, Utils::getTextSize(array('defaultFontSize' => 4)), '接受字号 ' . var_export($validTextSize, true));
}

foreach (array(0, 6, '0', '6', '01', '5x', '', false, true, 3.0, array('5')) as $invalidTextSize) {
    $_COOKIE['textsize'] = $invalidTextSize;
    outputSerializationAssertSame(4, Utils::getTextSize(array('defaultFontSize' => '4')), '拒绝非法字号 ' . var_export($invalidTextSize, true));
}
unset($_COOKIE['textsize']);
outputSerializationAssertSame(5, Utils::getTextSize(array('defaultFontSize' => '5')), '缺少字号 Cookie 时使用合法默认值');
outputSerializationAssertSame(3, Utils::getTextSize(array('defaultFontSize' => 'invalid')), '非法默认字号回退为 3');

Helper::$options = new OutputSerializationOptions(array(
    'description' => $encodedExcerpt,
    'loginAction' => 'https://example.test/action/login',
    'rootUrl' => 'https://example.test',
    'title' => $encodedSiteTitle
));
$_COOKIE = array();
$_POST = array();
$GLOBALS['VOIDVersion'] = '版本 ' . $attackPayload;
$GLOBALS['VOIDSetting'] = array(
    'brandFont' => array(),
    'browserLevelLoadingLazy' => false,
    'colorScheme' => 3,
    'desktopBannerHeight' => '',
    'enableMath' => false,
    'head' => '',
    'headerMode' => 2,
    'indexStyle' => 1,
    'lazyload' => true,
    'lineNumbers' => true,
    'mobileBannerHeight' => '',
    'pjax' => true,
    'serifincontent' => false,
    'siteBg' => $attackBannerUrl,
    'siteBgVertical' => '',
    'twitterId' => $attackPayload,
    'useFiraCodeFont' => false,
    'VOIDPlugin' => true
);

$headWidget = new OutputSerializationWidget('post', outputSerializationWidgetValues());
$headHtml = $headWidget->render(dirname(__DIR__, 2) . '/includes/head.php');
outputSerializationAssertNotContains('</script><script id="injected">', $headHtml, 'head 输出不允许攻击载荷创建新 script 元素');
outputSerializationAssertSame($semanticAuthor, outputSerializationMetaContent($headHtml, 'name', 'author'), 'author Meta 保留语义值');
outputSerializationAssertSame($semanticExcerpt, outputSerializationMetaContent($headHtml, 'name', 'description'), 'description Meta 保留语义值');
outputSerializationAssertSame($semanticCompleteTitle, outputSerializationMetaContent($headHtml, 'property', 'og:title'), 'Open Graph 标题保留语义值');
outputSerializationAssertSame($semanticExcerpt, outputSerializationMetaContent($headHtml, 'property', 'og:description'), 'Open Graph 描述保留语义值');
outputSerializationAssertSame($semanticSiteTitle, outputSerializationMetaContent($headHtml, 'property', 'og:site_name'), 'Open Graph 站点名保留语义值');
outputSerializationAssertSame($attackCanonicalUrl, outputSerializationMetaContent($headHtml, 'property', 'og:url'), 'Open Graph URL 保留完整参数');
outputSerializationAssertSame($attackBannerUrl, outputSerializationMetaContent($headHtml, 'property', 'og:image'), 'Open Graph 图片 URL 保留完整参数');
outputSerializationAssertSame($semanticCompleteTitle, outputSerializationMetaContent($headHtml, 'name', 'twitter:title'), 'Twitter 标题保留语义值');
outputSerializationAssertSame($semanticExcerpt, outputSerializationMetaContent($headHtml, 'name', 'twitter:description'), 'Twitter 描述保留语义值');
outputSerializationAssertSame('@' . $attackPayload, outputSerializationMetaContent($headHtml, 'name', 'twitter:site'), 'Twitter ID 保留语义值');
outputSerializationAssertSame($attackBannerUrl, outputSerializationMetaContent($headHtml, 'name', 'twitter:image'), 'Twitter 图片 URL 保留完整参数');

$voidConfig = outputSerializationVoidConfig($headHtml);
outputSerializationAssertSame(true, is_array($voidConfig), 'VOIDConfig 是可解析 JSON');
if (is_array($voidConfig)) {
    outputSerializationAssertSame(true, $voidConfig['PJAX'], 'VOIDConfig 保留布尔值');
    outputSerializationAssertSame(false, $voidConfig['enableMath'], 'VOIDConfig 保留 false 布尔值');
    outputSerializationAssertSame(3, $voidConfig['colorScheme'], 'VOIDConfig 保留整数值');
    outputSerializationAssertSame(2, $voidConfig['headerMode'], 'VOIDConfig 保留 headerMode 整数值');
    outputSerializationAssertSame('https://example.test/search/', $voidConfig['searchBase'], 'VOIDConfig 保留搜索根地址');
    outputSerializationAssertSame('https://example.test/', $voidConfig['home'], 'VOIDConfig 保留首页地址');
    outputSerializationAssertSame('2021-01-01T00:00', $voidConfig['buildTime'], 'VOIDConfig 保留建站时间字符串');
    outputSerializationAssertSame('https://example.test/usr/themes/VOID/assets/libs/emotes/', $voidConfig['emotesBase'], 'VOIDConfig 保留表情资源地址');
    outputSerializationAssertSame('https://example.test/action/void?', $voidConfig['votePath'], 'VOIDConfig 保留投票地址');
    outputSerializationAssertSame($GLOBALS['VOIDVersion'], $voidConfig['version'], 'VOIDConfig 保留含攻击字符的版本字符串');
}

$GLOBALS['VOIDSetting'] = array('defaultBanner' => $attackBannerUrl);
$ldjsonTemplate = dirname(__DIR__, 2) . '/includes/ldjson.php';
$expectedPublisherAvatar = 'https://avatar.example/avatar/hash?s=200&r=&d=';
$expectedAuthorAvatar = 'https://avatar.example/avatar/hash?s=400&r=&d=';

$postWidget = new OutputSerializationWidget('post', outputSerializationWidgetValues());
$postHtml = $postWidget->render($ldjsonTemplate);
$postData = outputSerializationStructuredData($postHtml);
outputSerializationAssertNotContains('</script><script id="injected">', $postHtml, '文章 JSON-LD 不允许攻击载荷创建新 script 元素');
outputSerializationAssertSame(true, is_array($postData), '文章 JSON-LD 是可解析 JSON');
if (is_array($postData)) {
    outputSerializationAssertSame('Article', $postData['@type'], '文章 JSON-LD 类型正确');
    outputSerializationAssertSame($semanticTitle, $postData['headline'], '文章 JSON-LD 标题保留语义值');
    outputSerializationAssertSame($semanticExcerpt, $postData['description'], '文章 JSON-LD 描述保留语义值');
    outputSerializationAssertSame($attackCanonicalUrl, $postData['url'], '文章 JSON-LD 使用文章规范 URL');
    outputSerializationAssertSame($attackCanonicalUrl, $postData['mainEntityOfPage']['@id'], '文章主实体使用文章规范 URL');
    outputSerializationAssertSame($attackBannerUrl, $postData['image']['url'], '文章 JSON-LD 图片 URL 保留完整参数');
    outputSerializationAssertSame($semanticAuthor, $postData['author']['name'], '文章作者名保留语义值');
    outputSerializationAssertSame($attackAuthorUrl, $postData['author']['url'], '文章作者链接保留输出方法与插件钩子');
    outputSerializationAssertSame($semanticSiteTitle, $postData['publisher']['name'], '发布者名称保留输出方法与插件钩子');
    outputSerializationAssertSame($expectedPublisherAvatar, $postData['publisher']['logo']['url'], '发布者头像在 JSON 中使用语义 URL');
    outputSerializationAssertSame($expectedAuthorAvatar, $postData['author']['image']['url'], '作者头像在 JSON 中使用语义 URL');
}

$pageWidget = new OutputSerializationWidget('page', outputSerializationWidgetValues());
$pageHtml = $pageWidget->render($ldjsonTemplate);
$pageData = outputSerializationStructuredData($pageHtml);
outputSerializationAssertNotContains('</script><script id="injected">', $pageHtml, '页面 JSON-LD 不允许攻击载荷创建新 script 元素');
outputSerializationAssertSame(true, is_array($pageData), '页面 JSON-LD 是可解析 JSON');
if (is_array($pageData)) {
    outputSerializationAssertSame('WebPage', $pageData['@type'], '页面 JSON-LD 类型正确');
    outputSerializationAssertSame($semanticTitle, $pageData['name'], '页面 JSON-LD 标题保留语义值');
    outputSerializationAssertSame($semanticExcerpt, $pageData['description'], '页面 JSON-LD 描述保留语义值');
    outputSerializationAssertSame($attackCanonicalUrl, $pageData['url'], '页面 JSON-LD 使用页面规范 URL');
    outputSerializationAssertSame($attackCanonicalUrl, $pageData['mainEntityOfPage']['@id'], '页面主实体使用页面规范 URL');
}

$indexWidget = new OutputSerializationWidget('index', outputSerializationWidgetValues(array('hasContent' => false)));
$indexHtml = $indexWidget->render($ldjsonTemplate);
$indexData = outputSerializationStructuredData($indexHtml);
outputSerializationAssertNotContains('</script><script id="injected">', $indexHtml, '首页 JSON-LD 不允许攻击载荷创建新 script 元素');
outputSerializationAssertSame(0, $indexWidget->authorReads, '空首页不读取文章作者属性');
outputSerializationAssertSame(true, is_array($indexData), '首页 JSON-LD 是可解析 JSON');
if (is_array($indexData)) {
    outputSerializationAssertSame('WebSite', $indexData['@type'], '首页 JSON-LD 类型正确');
    outputSerializationAssertSame('https://example.test/', $indexData['url'], '首页 JSON-LD 使用站点首页 URL');
    outputSerializationAssertSame('https://example.test/', $indexData['mainEntityOfPage']['@id'], '首页主实体使用站点首页 URL');
    outputSerializationAssertSame($semanticExcerpt, $indexData['description'], '首页 JSON-LD 描述保留语义值');
    outputSerializationAssertSame($attackBannerUrl, $indexData['image']['url'], '首页 JSON-LD 图片 URL 保留完整参数');
}

$_SERVER['PHP_SELF'] = '/wrong-script.php';
$archiveWidget = new OutputSerializationWidget('archive', outputSerializationWidgetValues(array('hasContent' => false)));
$archiveHtml = $archiveWidget->render($ldjsonTemplate);
$archiveData = outputSerializationStructuredData($archiveHtml);
outputSerializationAssertNotContains('</script><script id="injected">', $archiveHtml, '归档 JSON-LD 不允许攻击载荷创建新 script 元素');
outputSerializationAssertSame(0, $archiveWidget->authorReads, '空归档不读取文章作者属性');
outputSerializationAssertSame(true, is_array($archiveData), '归档 JSON-LD 是可解析 JSON');
if (is_array($archiveData)) {
    outputSerializationAssertSame('Series', $archiveData['@type'], '归档 JSON-LD 类型正确');
    outputSerializationAssertSame($attackArchiveUrl, $archiveData['url'], '归档 JSON-LD 使用当前归档规范 URL');
    outputSerializationAssertSame($semanticCompleteTitle, $archiveData['name'], '归档 JSON-LD 标题保留语义值');
    outputSerializationAssertSame($attackArchiveUrl, $archiveData['mainEntityOfPage']['@id'], '归档主实体指向当前归档规范 URL');
}

if ($failures > 0) {
    fwrite(STDERR, "{$failures} output serialization contract test(s) failed.\n");
    exit(1);
}

echo "All output serialization contract tests passed.\n";

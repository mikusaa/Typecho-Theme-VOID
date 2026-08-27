<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

$GLOBALS['VOIDSetting'] = array(
    'indexStyle' => 0,
    'VOIDPlugin' => false
);

function _t($message)
{
    return $message;
}

class Utils
{
    public static function captureOutput($target, $method)
    {
        ob_start();
        $target->$method();
        return ob_get_clean();
    }

    public static function decodeHtmlEntities($value)
    {
        return html_entity_decode($value, ENT_QUOTES, 'UTF-8');
    }

    public static function decodeHtmlText($value)
    {
        return html_entity_decode(strip_tags($value), ENT_QUOTES, 'UTF-8');
    }

    public static function escapeHtml($value)
    {
        return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
    }

    public static function isMobile()
    {
        return false;
    }

    public static function isPjax()
    {
        return true;
    }
}

class Contents
{
    public static function getBannerDimensions($url, $meta)
    {
        return is_array($meta) ? $meta : null;
    }

    public static function title($widget)
    {
        echo 'Card cover fixture';
    }
}

class CardCoverTemplateWidget
{
    public $created = 0;
    public $fields;
    public $wordCount = 0;

    private $current = null;
    private $index = -1;
    private $posts;

    public function __construct($posts)
    {
        $this->posts = $posts;
        $this->fields = (object) array();
    }

    public function archiveTitle($labels, $before, $after)
    {
        echo 'Synthetic archive';
    }

    public function cid()
    {
        echo $this->current['cid'];
    }

    public function content()
    {
        echo '<p>Full content</p>';
    }

    public function excerpt($length)
    {
        echo 'Synthetic excerpt';
    }

    public function have()
    {
        return count($this->posts) > 0;
    }

    public function is($type)
    {
        return false;
    }

    public function need($template)
    {
    }

    public function next()
    {
        ++$this->index;
        if (!isset($this->posts[$this->index])) {
            return false;
        }

        $this->current = $this->posts[$this->index];
        $this->created = 1609459200 + $this->index;
        $this->wordCount = 100 + $this->index;
        $this->fields = (object) array(
            'banner' => $this->current['banner'],
            'bannerascover' => $this->current['bannerascover'],
            'bannerMeta' => isset($this->current['dimensions']) ? $this->current['dimensions'] : null,
            'excerpt' => 'Fixture excerpt',
            'showfullcontent' => $this->current['showfullcontent']
        );
        return true;
    }

    public function pageNav($prev, $next, $splitPage, $splitWord, $template)
    {
    }

    public function permalink()
    {
        echo 'https://example.test/post-' . $this->current['cid'];
    }

    public function render($template)
    {
        ob_start();
        include $template;
        return ob_get_clean();
    }

    public function title()
    {
        echo 'Post ' . $this->current['cid'];
    }
}

$failures = 0;

function cardCoverTemplateAssertSame($expected, $actual, $message)
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

function cardCoverTemplateAssertContains($needle, $haystack, $message)
{
    cardCoverTemplateAssertSame(true, strpos($haystack, $needle) !== false, $message);
}

function cardCoverTemplateAssertNotContains($needle, $haystack, $message)
{
    cardCoverTemplateAssertSame(false, strpos($haystack, $needle) !== false, $message);
}

function cardCoverTemplateItem($html, $cid)
{
    if (!preg_match('/<li id="p-' . (int) $cid . '"[^>]*>.*?<\/li>/s', $html, $matches)) {
        return '';
    }
    return $matches[0];
}

function cardCoverTemplateImages($html)
{
    preg_match_all('/<img\b[^>]*data-void-card-cover[^>]*>/i', $html, $matches);
    return $matches[0];
}

$indexPosts = array(
    array('cid' => 1, 'banner' => 'https://img.test/index-full-0.jpg', 'bannerascover' => '0', 'showfullcontent' => '1'),
    array('cid' => 2, 'banner' => 'https://img.test/index-full-1.jpg', 'bannerascover' => '1', 'showfullcontent' => '1', 'dimensions' => array(1600, 900)),
    array('cid' => 3, 'banner' => 'https://img.test/index-full-2.jpg', 'bannerascover' => '2', 'showfullcontent' => '1'),
    array('cid' => 4, 'banner' => 'https://img.test/index-card-2.jpg', 'bannerascover' => '2', 'showfullcontent' => '0'),
    array('cid' => 5, 'banner' => 'https://img.test/index-card-0.jpg', 'bannerascover' => '0', 'showfullcontent' => '0'),
    array('cid' => 6, 'banner' => '', 'bannerascover' => '1', 'showfullcontent' => '0')
);
$indexHtml = (new CardCoverTemplateWidget($indexPosts))->render(dirname(__DIR__, 2) . '/index.php');
$indexImages = cardCoverTemplateImages($indexHtml);

cardCoverTemplateAssertContains('class="masonry-item style-0 full-content"', cardCoverTemplateItem($indexHtml, 1), '首页完整内容 style 0 保持完整类名');
cardCoverTemplateAssertContains('class="masonry-item style-1 full-content"', cardCoverTemplateItem($indexHtml, 2), '首页完整内容 style 1 保持 style 1');
cardCoverTemplateAssertContains('class="masonry-item style-1 full-content"', cardCoverTemplateItem($indexHtml, 3), '首页完整内容 style 2 映射为 style 1');
cardCoverTemplateAssertContains('class="masonry-item style-2"', cardCoverTemplateItem($indexHtml, 4), '首页普通卡片保留 style 2');
cardCoverTemplateAssertNotContains('https://img.test/index-full-0.jpg', $indexHtml, '首页完整内容 style 0 不输出隐藏封面请求');
cardCoverTemplateAssertNotContains('https://img.test/index-card-0.jpg', $indexHtml, '首页普通 style 0 不输出隐藏封面请求');
cardCoverTemplateAssertSame(3, count($indexImages), '首页只输出三张实际可见封面');
cardCoverTemplateAssertContains('loading="eager" fetchpriority="high"', $indexImages[0], '首页第一张可见封面高优先级立即加载');
cardCoverTemplateAssertContains('width="1600" height="900"', $indexImages[0], '首页保留可信封面固有尺寸');
cardCoverTemplateAssertContains('loading="eager"', $indexImages[1], '首页第二张可见封面立即加载');
cardCoverTemplateAssertNotContains('fetchpriority=', $indexImages[1], '首页第二张可见封面不声明高优先级');
cardCoverTemplateAssertContains('loading="lazy"', $indexImages[2], '首页第三张可见封面原生懒加载');

$archivePosts = array(
    array('cid' => 11, 'banner' => 'https://img.test/archive-0.jpg', 'bannerascover' => '0', 'showfullcontent' => '0'),
    array('cid' => 12, 'banner' => 'https://img.test/archive-1.jpg', 'bannerascover' => '1', 'showfullcontent' => '0', 'dimensions' => array(1200, 800)),
    array('cid' => 13, 'banner' => 'https://img.test/archive-2.jpg', 'bannerascover' => '2', 'showfullcontent' => '0'),
    array('cid' => 14, 'banner' => 'https://img.test/archive-3.jpg', 'bannerascover' => '1', 'showfullcontent' => '0')
);
$archiveHtml = (new CardCoverTemplateWidget($archivePosts))->render(dirname(__DIR__, 2) . '/includes/archives.php');
$archiveImages = cardCoverTemplateImages($archiveHtml);

cardCoverTemplateAssertContains('style-0', cardCoverTemplateItem($archiveHtml, 11), '归档保留 style 0');
cardCoverTemplateAssertContains('style-1', cardCoverTemplateItem($archiveHtml, 12), '归档保留 style 1');
cardCoverTemplateAssertContains('style-2', cardCoverTemplateItem($archiveHtml, 13), '归档保留 style 2');
cardCoverTemplateAssertNotContains('https://img.test/archive-0.jpg', $archiveHtml, '归档 style 0 不输出隐藏封面请求');
cardCoverTemplateAssertSame(3, count($archiveImages), '归档只输出三张实际可见封面');
cardCoverTemplateAssertContains('loading="eager" fetchpriority="high"', $archiveImages[0], '归档第一张可见封面高优先级立即加载');
cardCoverTemplateAssertContains('width="1200" height="800"', $archiveImages[0], '归档保留可信封面固有尺寸');
cardCoverTemplateAssertContains('loading="eager"', $archiveImages[1], '归档第二张可见封面立即加载');
cardCoverTemplateAssertNotContains('fetchpriority=', $archiveImages[1], '归档第二张可见封面不声明高优先级');
cardCoverTemplateAssertContains('loading="lazy"', $archiveImages[2], '归档第三张可见封面原生懒加载');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} card cover template test(s) failed.\n");
    exit(1);
}

echo "All card cover template tests passed.\n";

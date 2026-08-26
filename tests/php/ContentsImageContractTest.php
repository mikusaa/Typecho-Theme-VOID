<?php

class ImageContractOptions
{
    public $lazyload = '0';
}

class Helper
{
    public static $options;

    public static function options()
    {
        return self::$options;
    }
}

class ImageContractParameter
{
    private $values;

    public function __construct($values)
    {
        $this->values = $values;
    }

    public function __get($name)
    {
        return isset($this->values[$name]) ? $this->values[$name] : null;
    }
}

class ImageContractWidget
{
    public $parameter;
    public $template;

    public function __construct($values, $template = null)
    {
        $this->parameter = new ImageContractParameter($values);
        $this->template = $template;
    }
}

Helper::$options = new ImageContractOptions();

require_once dirname(__DIR__, 2) . '/libs/Contents.php';

$failures = 0;

function assertImageSame($expected, $actual, $message)
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

function assertImageContains($needle, $actual, $message)
{
    global $failures;
    if (strpos($actual, $needle) !== false) {
        echo "ok - {$message}\n";
        return;
    }

    ++$failures;
    echo "not ok - {$message}\n";
    echo '  missing: ' . var_export($needle, true) . "\n";
    echo '  actual:  ' . var_export($actual, true) . "\n";
}

function assertImageNotContains($needle, $actual, $message)
{
    global $failures;
    if (strpos($actual, $needle) === false) {
        echo "ok - {$message}\n";
        return;
    }

    ++$failures;
    echo "not ok - {$message}\n";
    echo '  unexpected: ' . var_export($needle, true) . "\n";
    echo '  actual:     ' . var_export($actual, true) . "\n";
}

function resetImageSettings()
{
    $GLOBALS['VOIDSetting'] = array(
        'browserLevelLoadingLazy' => false,
        'largePhotoSet' => false,
        'parseFigcaption' => true
    );
    Helper::$options->lazyload = '0';
}

resetImageSettings();
$semantic = Contents::parseImages(
    '<p><img alt="海边 &quot;日落&quot; &lt;i&gt;" src="https://img.example/a.jpg#vwid=1920&amp;vhei=1080"></p>'
);
assertImageContains(
    '<figure data-void-image-item data-void-image-width="1920" data-void-image-height="1080" style="--void-image-ratio: 1.7778">',
    $semantic,
    '完整保存尺寸输出主题语义和比例'
);
assertImageContains(
    '<a class="void-image-link" data-void-image-zoom no-pjax href="https://img.example/a.jpg#vwid=1920&amp;vhei=1080">',
    $semantic,
    '正文图片保留真实链接和无 PJAX 降级'
);
assertImageContains(
    '<img data-void-image-content width="1920" height="1080" alt="海边 &quot;日落&quot; &lt;i&gt;" src="https://img.example/a.jpg#vwid=1920&amp;vhei=1080" decoding="async">',
    $semantic,
    '真实图片输出尺寸、转义属性和异步解码'
);
assertImageContains(
    '<figcaption>海边 &quot;日落&quot; &lt;i&gt;</figcaption>',
    $semantic,
    'Caption 作为纯文本安全输出'
);
assertImageNotContains('data-fancybox', $semantic, '正文图片不再输出 Fancybox 属性');
assertImageNotContains('data-caption', $semantic, '正文图片不再输出 Fancybox Caption 属性');

foreach (array(
    'https://img.example/a.jpg#vwid=1920',
    'https://img.example/a.jpg#vwid=1920&vhei=0',
    'https://img.example/a.jpg#vwid=abc&vhei=1080',
    'https://img.example/a.jpg#vwid=1920x&vhei=1080'
) as $invalidDimensionSrc) {
    $invalidDimensions = Contents::parseImages('<img src="' . $invalidDimensionSrc . '" alt="x">');
    assertImageNotContains('data-void-image-width=', $invalidDimensions, '残缺或非法尺寸不输出语义宽度');
    assertImageNotContains(' width="', $invalidDimensions, '残缺或非法尺寸不伪造图片宽度');
}

resetImageSettings();
Helper::$options->lazyload = '1';
$scriptLazy = Contents::parseImages(
    '<img src="https://cdn.example/a.jpg#vwid=800&vhei=1200" alt="竖图">'
);
assertImageContains(
    '<img data-void-image-content width="800" height="1200" class="lazyload" alt="竖图" data-src="https://cdn.example/a.jpg#vwid=800&amp;vhei=1200" src="" decoding="async">',
    $scriptLazy,
    '脚本懒加载保留真实地址且不提前请求原图'
);
assertImageSame(1, substr_count($scriptLazy, '<img '), '脚本懒加载只输出一个真实图片节点');
assertImageNotContains('blured-placeholder', $scriptLazy, '脚本懒加载不再输出模糊占位图');
assertImageNotContains('remove-after', $scriptLazy, '脚本懒加载不再输出延时删除标记');

resetImageSettings();
Helper::$options->lazyload = '1';
$GLOBALS['VOIDSetting']['browserLevelLoadingLazy'] = true;
$browserLazy = Contents::parseImages('<img src="/native.jpg#vwid=1200&vhei=800" alt="原生懒加载">');
assertImageContains('class="lazyload browserlevel-lazy"', $browserLazy, '浏览器原生懒加载类保持兼容');
assertImageContains('data-src="/native.jpg#vwid=1200&amp;vhei=800"', $browserLazy, '原生懒加载保留真实 data-src');
assertImageContains('src="/native.jpg#vwid=1200&amp;vhei=800"', $browserLazy, '原生懒加载保留真实 src');
assertImageContains('loading="lazy"', $browserLazy, '原生懒加载输出 loading 属性');
assertImageSame(1, substr_count($browserLazy, '<img '), '原生懒加载只输出一个真实图片节点');

$galleryWidget = new ImageContractWidget(array(), 'Gallery.php');
$galleryLazy = Contents::contentEx(
    '<img src="/gallery-later.jpg#vwid=1200&vhei=800" alt="相册图片">',
    $galleryWidget,
    null
);
assertImageContains('class="lazyload"', $galleryLazy, 'Gallery 强制使用可由分批展示控制的脚本懒加载');
assertImageContains('data-src="/gallery-later.jpg#vwid=1200&amp;vhei=800"', $galleryLazy, 'Gallery 保留延迟图片地址');
assertImageContains('src=""', $galleryLazy, 'Gallery 折叠前不输出可提前请求的真实 src');
assertImageNotContains('browserlevel-lazy', $galleryLazy, 'Gallery 不受全站原生懒加载模式影响');

$ordinaryWidget = new ImageContractWidget(array(), 'page.php');
$ordinaryNativeLazy = Contents::contentEx(
    '<img src="/ordinary.jpg#vwid=1200&vhei=800" alt="普通正文图片">',
    $ordinaryWidget,
    null
);
assertImageContains('class="lazyload browserlevel-lazy"', $ordinaryNativeLazy, '普通正文继续使用配置的原生懒加载');
assertImageContains('src="/ordinary.jpg#vwid=1200&amp;vhei=800"', $ordinaryNativeLazy, '普通正文继续输出真实原生懒加载 src');

resetImageSettings();
$feed = Contents::parseImages('<img src="/feed.jpg#vwid=640&vhei=480" alt="Feed 图">', true);
assertImageSame(
    '<figure><img src="/feed.jpg#vwid=640&amp;vhei=480" alt="Feed 图" width="640" height="480" decoding="async"><figcaption>Feed 图</figcaption></figure>',
    $feed,
    'Feed 只输出静态 figure、真实图片和 Caption'
);
assertImageNotContains('<a ', $feed, 'Feed 图片不输出链接');
assertImageNotContains('data-void-', $feed, 'Feed 图片不输出主题交互属性');

resetImageSettings();
$GLOBALS['VOIDSetting']['parseFigcaption'] = false;
$captionDisabled = Contents::parseImages('<img src="/plain.jpg" alt="不显示">');
assertImageNotContains('<figcaption>', $captionDisabled, '关闭 Caption 设置后不输出图题');

resetImageSettings();
$withoutAlt = Contents::parseImages("<img title='保留解析' src='/no-alt.jpg'>");
assertImageContains('alt=""', $withoutAlt, '缺少 alt 的正文图片仍安全解析为空文本');
assertImageNotContains('<figcaption>', $withoutAlt, '缺少 alt 时不输出空 Caption');

$protected = Contents::parseImages('<code><img src="/code.jpg" alt="code"></code><img src="/body.jpg" alt="body">');
assertImageContains('<code><img src="/code.jpg" alt="code"></code>', $protected, '代码区域内的图片标签保持原文');
assertImageSame(1, substr_count($protected, 'data-void-image-item'), '代码区域外图片仍正常解析');

resetImageSettings();
$oneFigure = Contents::parseImages('<img src="/one.jpg#vwid=900&vhei=600" alt="一张">');
$singleSet = Contents::parsePhotoSet('[photos]' . $oneFigure . '[/photos]');
assertImageContains(
    '<div class="photos" data-void-photo-set data-void-photo-count="1" data-void-photo-layout="single">',
    $singleSet,
    '单张 photos 输出独立 single 布局契约'
);
assertImageNotContains('tabindex=', $singleSet, '单图不伪装成可滚动区域');

$twoFigures = $oneFigure . Contents::parseImages('<img src="/two.jpg#vwid=600&vhei=900" alt="二张">');
$pairSet = Contents::parsePhotoSet('[photos]' . $twoFigures . '[/photos]');
assertImageContains('data-void-photo-count="2" data-void-photo-layout="pair"', $pairSet, '双图自动分类为 pair');
assertImageNotContains('data-void-photo-position=', $pairSet, '双图不显示横带序号');

$threeFigures = $twoFigures . Contents::parseImages('<img src="/three.jpg#vwid=1600&vhei=900" alt="三张">');
$stripSet = Contents::parsePhotoSet('[photos]' . $threeFigures . '[/photos]');
assertImageContains('data-void-photo-count="3" data-void-photo-layout="strip"', $stripSet, '三张及以上自动分类为 strip');
assertImageContains('tabindex="0" role="region" aria-label="横向图片集，共 3 张"', $stripSet, '横带容器可聚焦并提供总数标签');
assertImageSame(3, substr_count($stripSet, 'data-void-photo-position='), '横带为每张图片输出序号');
assertImageContains('data-void-photo-index="1" data-void-photo-position="1 / 3"', $stripSet, '横带首图序号正确');
assertImageContains('data-void-photo-index="3" data-void-photo-position="3 / 3"', $stripSet, '横带末图序号正确');

$nearMatchFigures = $oneFigure
    . '<figure data-void-image-item-extra><img src="/extra.jpg"></figure>'
    . '<figure title="data-void-image-item"><img src="/title.jpg"></figure>';
$nearMatchSet = Contents::parsePhotoSet('[photos]' . $nearMatchFigures . '[/photos]');
assertImageContains('data-void-photo-count="1" data-void-photo-layout="single"', $nearMatchSet, '图片计数只识别精确语义属性');
assertImageNotContains('data-void-photo-position=', $nearMatchSet, '相似属性名和值不触发横带序号');

$GLOBALS['VOIDSetting']['largePhotoSet'] = true;
$largePair = Contents::parsePhotoSet('[photos]' . $twoFigures . '[/photos]');
assertImageContains('<div class="photos large"', $largePair, 'largePhotoSet 继续控制桌面加宽 class');

$GLOBALS['VOIDSetting']['largePhotoSet'] = false;
$multipleSets = Contents::parsePhotoSet('[photos]' . $oneFigure . '[/photos][photos mode="story"]' . $threeFigures . '[/photos]');
assertImageSame(2, substr_count($multipleSets, 'data-void-photo-set'), '多个 photos shortcode 保持彼此隔离');
assertImageContains('data-void-photo-layout="single"', $multipleSets, '多个 photos 中保留单图分类');
assertImageContains('data-void-photo-layout="strip"', $multipleSets, '多个 photos 中保留横带分类');

resetImageSettings();
$feedSource = '[photos]<img src="/feed-one.jpg#vwid=640&vhei=480" alt="Feed 一"><img src="/feed-two.jpg#vwid=800&vhei=600" alt="Feed 二">[/photos]';
$feedWidget = new ImageContractWidget(array('type' => 'feed'));
$feedSet = Contents::contentEx($feedSource, $feedWidget, null);
assertImageSame(2, substr_count($feedSet, '<figure><img '), 'Feed 展开 photos 后保留静态图片');
assertImageNotContains('class="photos', $feedSet, 'Feed 不保留 photos 包装');
assertImageNotContains('data-void-', $feedSet, 'Feed photos 不泄漏主题交互属性');
assertImageNotContains('<a ', $feedSet, 'Feed photos 图片不输出原图链接');

$legacyFeedWidget = new ImageContractWidget(array('isFeed' => true));
$legacyFeed = Contents::contentEx(
    '<div class="photos"><figure><div class="nested">嵌套</div></figure></div><p>保留</p>',
    $legacyFeedWidget,
    null
);
assertImageContains('<figure><div>嵌套</div></figure><p>保留</p>', $legacyFeed, 'isFeed 信号独立生效且嵌套 div 不截断照片集解包');

$feedNearMatches = Contents::contentEx(
    '<div class="photos-grid">网格</div><div data-class="photos">数据</div>',
    $feedWidget,
    null
);
assertImageContains('<div>网格</div><div>数据</div>', $feedNearMatches, 'Feed 不把相似 class 或 data-class 当成照片集');

$renderedExcerpt = '<div class="photos large" data-void-photo-set data-void-photo-count="3" data-void-photo-layout="strip"><figure>图</figure></div><p>保留</p>';
assertImageSame('<p>保留</p>', Contents::excerptEx($renderedExcerpt, null, null), '摘要移除带 data 属性的已渲染 photos');
assertImageSame('保留', Contents::excerptEx('[PHOTOS mode="story"]保留[/PHOTOS]', null, null), '摘要移除带属性及大小写变化的 photos 标记');
assertImageSame(
    '<p>保留</p>',
    Contents::excerptEx('<div data-void-photo-set><figure><div>嵌套</div></figure></div><p>保留</p>', null, null),
    '摘要完整移除包含嵌套 div 的照片集'
);
assertImageSame(
    '<div class="photos-grid">网格</div><div data-class="photos">数据</div>',
    Contents::excerptEx('<div class="photos-grid">网格</div><div data-class="photos">数据</div>', null, null),
    '摘要保留相似 class 和 data-class 容器'
);
assertImageSame(
    '[photoshop]设计[/photoshop][photos-note]说明[/photos-note]',
    Contents::excerptEx('[photoshop]设计[/photoshop][photos-note]说明[/photos-note]', null, null),
    '摘要不误删名称相近的 shortcode'
);

assertImageSame('', Contents::parseImages(''), '空图片内容保持不变');
assertImageSame(null, Contents::parseImages(null), '非字符串图片内容保持不变');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} image contract test(s) failed.\n");
    exit(1);
}

echo "All Contents image contract tests passed.\n";

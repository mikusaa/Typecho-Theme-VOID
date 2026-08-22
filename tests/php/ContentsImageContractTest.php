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
        'CDNType' => array(),
        'bluredLazyload' => false,
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
$GLOBALS['VOIDSetting']['bluredLazyload'] = true;
$GLOBALS['VOIDSetting']['CDNType'] = array('cdn.example' => 'UPYUN');
$customLazy = Contents::parseImages(
    '<img src="https://cdn.example/a.jpg#vwid=800&vhei=1200" alt="竖图">'
);
assertImageContains(
    '<img class="blured-placeholder remove-after" src="https://cdn.example/a.jpg!/max/64" alt="" aria-hidden="true" decoding="async">',
    $customLazy,
    '脚本懒加载占位图为空替代文本且对辅助技术隐藏'
);
assertImageContains(
    '<img data-void-image-content width="800" height="1200" class="lazyload" alt="竖图" data-src="https://cdn.example/a.jpg#vwid=800&amp;vhei=1200" src="" decoding="async">',
    $customLazy,
    '脚本懒加载只标记真实正文图片'
);
assertImageSame(1, substr_count($customLazy, 'data-void-image-content'), '模糊占位图不带真实图片标记');

resetImageSettings();
Helper::$options->lazyload = '1';
$GLOBALS['VOIDSetting']['browserLevelLoadingLazy'] = true;
$browserLazy = Contents::parseImages('<img src="/native.jpg#vwid=1200&vhei=800" alt="原生懒加载">');
assertImageContains('class="lazyload browserlevel-lazy"', $browserLazy, '浏览器原生懒加载类保持兼容');
assertImageContains('data-src="/native.jpg#vwid=1200&amp;vhei=800"', $browserLazy, '原生懒加载保留真实 data-src');
assertImageContains('src="/native.jpg#vwid=1200&amp;vhei=800"', $browserLazy, '原生懒加载保留真实 src');
assertImageContains('loading="lazy"', $browserLazy, '原生懒加载输出 loading 属性');
assertImageNotContains('blured-placeholder', $browserLazy, '原生懒加载不重复输出模糊占位图');

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

assertImageSame('', Contents::parseImages(''), '空图片内容保持不变');
assertImageSame(null, Contents::parseImages(null), '非字符串图片内容保持不变');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} image contract test(s) failed.\n");
    exit(1);
}

echo "All Contents image contract tests passed.\n";

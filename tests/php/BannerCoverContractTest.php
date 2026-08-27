<?php

class BannerCoverContractOptions
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

Helper::$options = new BannerCoverContractOptions();
require_once dirname(__DIR__, 2) . '/libs/Contents.php';

$failures = 0;

function bannerCoverAssertSame($expected, $actual, $message)
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

$source = 'https://example.test/cover.jpg';
$validMeta = json_encode(array(
    'version' => 1,
    'source' => $source,
    'width' => 1920,
    'height' => 1080
));
bannerCoverAssertSame(array(1920, 1080), Contents::getBannerDimensions($source, $validMeta), '有效同源元数据生效');
bannerCoverAssertSame(
    null,
    Contents::getBannerDimensions($source, json_encode(array(
        'version' => 1,
        'source' => ' ' . $source,
        'width' => 1920,
        'height' => 1080
    ))),
    '来源必须与当前封面完全一致'
);
bannerCoverAssertSame(
    array(800, 600),
    Contents::getBannerDimensions($source . '#vwid=800&vhei=600', '{"version":1,"source":"other","width":1,"height":1}'),
    '来源不匹配时回退 URL 尺寸'
);

$invalidValues = array(
    '{"version":2,"source":"' . $source . '","width":1,"height":1}',
    '{"version":1,"source":"' . $source . '","width":"1920","height":1080}',
    '{"version":1,"source":"' . $source . '","width":0,"height":1080}',
    '{"version":1,"source":"' . $source . '","width":100001,"height":1080}',
    '{"version":1,"source":"<script>alert(1)</script>","width":1,"height":1}',
    'not-json'
);
foreach ($invalidValues as $invalidValue) {
    bannerCoverAssertSame(null, Contents::getBannerDimensions($source, $invalidValue), '非法元数据不输出尺寸');
}

bannerCoverAssertSame(null, Contents::getBannerDimensions($source . '#vwid=1&vhei=100001'), 'URL 超界尺寸被拒绝');
bannerCoverAssertSame(null, Contents::getBannerDimensions('javascript:alert(1)', $validMeta), '来源不匹配不采用元数据');
bannerCoverAssertSame(null, Contents::getBannerDimensions('', $validMeta), '空封面不采用旧元数据');

$functions = file_get_contents(dirname(__DIR__, 2) . '/functions.php');
bannerCoverAssertSame(
    1,
    preg_match('/Form_Element_Hidden\(\'bannerMeta\',\s*null,\s*null,\s*\'[^\']+\'\)/', $functions),
    '主题注册带非空标签的隐藏 bannerMeta 字段'
);

if ($failures > 0) {
    fwrite(STDERR, "{$failures} banner cover contract test(s) failed.\n");
    exit(1);
}

echo "All banner cover contract tests passed.\n";

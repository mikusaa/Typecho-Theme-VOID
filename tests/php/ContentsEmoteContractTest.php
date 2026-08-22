<?php

define('VOID_EMOTE_MANIFEST_DIR', dirname(__DIR__) . '/fixtures/emotes/packs');

class Utils
{
    public static function indexTheme($path)
    {
        echo 'https://example.test/usr/themes/VOID' . $path;
    }
}

require_once dirname(__DIR__, 2) . '/libs/Contents.php';

$failures = 0;

function assertSameValue($expected, $actual, $message)
{
    global $failures;
    if ($expected === $actual) {
        echo "ok - {$message}\n";
        return;
    }

    ++$failures;
    echo "not ok - {$message}\n";
    echo "  expected: " . var_export($expected, true) . "\n";
    echo "  actual:   " . var_export($actual, true) . "\n";
}

function assertContainsValue($needle, $actual, $message)
{
    global $failures;
    if (strpos($actual, $needle) !== false) {
        echo "ok - {$message}\n";
        return;
    }

    ++$failures;
    echo "not ok - {$message}\n";
    echo "  missing: " . var_export($needle, true) . "\n";
    echo "  actual:  " . var_export($actual, true) . "\n";
}

$bangumi = Contents::parseBiaoQing(':bgm(053)');
assertSameValue(
    '<img class="biaoqing biaoqing--bangumi" src="https://example.test/usr/themes/VOID/assets/libs/emotes/bangumi/poster/053.webp" data-animated-src="https://example.test/usr/themes/VOID/assets/libs/emotes/bangumi/animated/053.gif" width="240" height="240" loading="lazy" decoding="async" alt="Bangumi 娘：爱心 3 &quot;&lt;测试&gt;&quot;">',
    $bangumi,
    'Bangumi 短码输出 poster、动画元数据与原始尺寸'
);
assertContainsValue('&quot;&lt;测试&gt;&quot;', $bangumi, 'Bangumi 标签经过 HTML 属性转义');

assertSameValue(':bgm(999)', Contents::parseBiaoQing(':bgm(999)'), '未知 Bangumi ID 保留原文');
assertSameValue(':bgm(53)', Contents::parseBiaoQing(':bgm(53)'), '非三位 Bangumi ID 保留原文');
assertSameValue(':bgm(0053)', Contents::parseBiaoQing(':bgm(0053)'), '四位 Bangumi ID 保留原文');
assertSameValue(':bgm(abc)', Contents::parseBiaoQing(':bgm(abc)'), '非数字 Bangumi ID 保留原文');
assertSameValue(':bgm(054)', Contents::parseBiaoQing(':bgm(054)'), '越界资源路径不会输出');
assertSameValue(':bgm(055)', Contents::parseBiaoQing(':bgm(055)'), '缺少原始尺寸不会输出 Bangumi 图片');
assertSameValue(':bgm(056)', Contents::parseBiaoQing(':bgm(056)'), '重复 manifest token 不会输出不确定条目');
assertContainsValue('/bangumi/preview/057.webp"', Contents::parseBiaoQing(':bgm(057)'), '兼容 preview/src/shortcode manifest 字段');

assertSameValue(
    '<img class="biaoqing" src="https://example.test/usr/themes/VOID/assets/libs/emotes/aru/happy.png" width="64" height="64" loading="lazy" decoding="async" alt="高兴">',
    Contents::parseBiaoQing(':@(高兴)'),
    '阿鲁短码只从 manifest 解析'
);
assertContainsValue('/emotes/quyin/peek.png"', Contents::parseBiaoQing(':&(蛆音娘_偷看)'), '蛆音娘短码只从 manifest 解析');
assertContainsValue('/emotes/bilibili/first.png"', Contents::parseBiaoQing(':$(2233娘_第一)'), '哔哩哔哩短码只从 manifest 解析');
assertContainsValue('/emotes/mihoyo/butterfly.png"', Contents::parseBiaoQing(':!(遐蝶_蝴蝶)'), '米哈游短码只从 manifest 解析');
assertContainsValue('width="128" height="128"', Contents::parseBiaoQing(':!(遐蝶_蝴蝶)'), '数字字符串尺寸被规范化');
assertContainsValue('/assets/libs/emotes/aru/', Contents::parseBiaoQing(':@(高兴)'), '静态表情使用统一 emotes 包目录');

assertSameValue(':@(不存在)', Contents::parseBiaoQing(':@(不存在)'), '未知旧包短码保留原文');
assertSameValue(':@(../../private)', Contents::parseBiaoQing(':@(../../private)'), '用户输入不会用于拼接路径');
assertSameValue(':@(路径逃逸)', Contents::parseBiaoQing(':@(路径逃逸)'), 'manifest 越界路径不会输出');
assertSameValue(':@(旧绝对路径)', Contents::parseBiaoQing(':@(旧绝对路径)'), '旧 OwO 绝对资源路径不再解析');
assertSameValue('::(滑稽)', Contents::parseBiaoQing('::(滑稽)'), '旧泡泡短码不再解析');
assertSameValue(':@(高兴', Contents::parseBiaoQing(':@(高兴'), '畸形旧包短码保留原文');
assertSameValue(
    '<code>:bgm(053)</code><pre>:@(高兴)</pre>',
    Contents::parseBiaoQing('<code>:bgm(053)</code><pre>:@(高兴)</pre>'),
    '代码区域中的短码保持原文'
);
assertSameValue(
    '<a href="/tag/:bgm(053)" title=":@(高兴)">链接</a>',
    Contents::parseBiaoQing('<a href="/tag/:bgm(053)" title=":@(高兴)">链接</a>'),
    'HTML 属性中的短码保持原文'
);
$mixedHtml = Contents::parseBiaoQing('<p>前 :bgm(053) 后</p><code>:bgm(053)</code>');
assertContainsValue('<p>前 <img class="biaoqing biaoqing--bangumi"', $mixedHtml, '普通文本节点中的短码仍会解析');
assertContainsValue('<code>:bgm(053)</code>', $mixedHtml, '混合 HTML 中的代码短码不解析');
assertSameValue('', Contents::parseBiaoQing(''), '空内容保持不变');
assertSameValue(null, Contents::parseBiaoQing(null), '非字符串内容保持不变');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} contract test(s) failed.\n");
    exit(1);
}

echo "All Contents emote contract tests passed.\n";

<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

require_once dirname(__DIR__, 2) . '/libs/Content/HtmlScanner.php';

$failures = 0;

function scannerAssertSame($expected, $actual, $message)
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

$quoted = '<a title="攻击 > 仍在属性内" href="https://example.test/?a=1&amp;b=2">正文</a>';
scannerAssertSame(
    strpos($quoted, '>正文'),
    VOID_Content_HtmlScanner::findTokenEnd($quoted, 0),
    '引号中的 > 不会提前结束标签'
);

$attributes = VOID_Content_HtmlScanner::parseAttributes(
    '<img SRC="/first.jpg" src="javascript:alert(1)" disabled alt="中文😀">'
);
scannerAssertSame('/first.jpg', $attributes['src'], '重复属性保留第一个值，避免后值覆盖');
scannerAssertSame(null, $attributes['disabled'], '布尔属性保持存在且没有伪造值');
scannerAssertSame('中文😀', $attributes['alt'], 'Unicode 属性值保持字节边界和内容');

$nested = '<div><div>内层</div><script>"</div>"</script><p>尾部</p></div><p>之后</p>';
$closing = VOID_Content_HtmlScanner::findClosingElement($nested, 'div', 5);
scannerAssertSame(
    strpos($nested, '</div><p>之后'),
    $closing[0],
    '嵌套同名标签正确计数且 raw-text 内伪标签不参与'
);

$rawText = '<style>.x::after{content:"</stylex>"}</style><p>保留</p>';
$rawClosing = VOID_Content_HtmlScanner::findClosingElement($rawText, 'style', 7);
scannerAssertSame(strpos($rawText, '</style>'), $rawClosing[0], 'raw-text 只匹配精确结束标签');

scannerAssertSame(null, VOID_Content_HtmlScanner::findTokenEnd('正文 < 3', 3), '异常小于号不是 HTML 标签');
scannerAssertSame(8, VOID_Content_HtmlScanner::findTokenEnd('<a title=', 0), '未闭合标签安全延伸到输入末尾');
scannerAssertSame(null, VOID_Content_HtmlScanner::parseTag('<!-- <div> -->'), '注释不会被误识别为元素');
scannerAssertSame(
    array('name' => 'img', 'closing' => false, 'selfClosing' => true),
    VOID_Content_HtmlScanner::parseTag('<IMG alt="图">'),
    'void 元素被识别为自闭合边界'
);

if ($failures > 0) {
    fwrite(STDERR, "{$failures} HTML scanner contract test(s) failed.\n");
    exit(1);
}

echo "All HTML scanner contract tests passed.\n";

<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class PjaxCacheHeadersResponse
{
    public $headers = array();

    public function setHeader($name, $value)
    {
        $this->headers[$name] = $value;
        return $this;
    }
}

require_once dirname(__DIR__, 2) . '/libs/Utils.php';

$failures = 0;

function pjaxCacheHeadersAssertSame($expected, $actual, $message)
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

unset($_SERVER['HTTP_X_PJAX']);
$fullResponse = new PjaxCacheHeadersResponse();
Utils::applyPjaxCacheHeaders($fullResponse);
pjaxCacheHeadersAssertSame(
    array('Vary' => 'X-PJAX'),
    $fullResponse->headers,
    '完整页面声明随 X-PJAX 变化，且不限制自身缓存'
);

$_SERVER['HTTP_X_PJAX'] = 'true';
$partialResponse = new PjaxCacheHeadersResponse();
Utils::applyPjaxCacheHeaders($partialResponse);
pjaxCacheHeadersAssertSame(
    array('Vary' => 'X-PJAX', 'Cache-Control' => 'no-store'),
    $partialResponse->headers,
    'PJAX 局部片段声明随 X-PJAX 变化，并禁止任何缓存存储'
);
unset($_SERVER['HTTP_X_PJAX']);

$functionsSource = file_get_contents(dirname(__DIR__, 2) . '/functions.php');
$themeInitStart = strpos($functionsSource, 'function themeInit(');
$themeInitSource = $themeInitStart === false ? '' : substr($functionsSource, $themeInitStart, 300);
pjaxCacheHeadersAssertSame(
    true,
    strpos($themeInitSource, 'Utils::applyPjaxCacheHeaders(Typecho\\Response::getInstance());') !== false,
    'themeInit 在主题渲染前为每个主请求设置 PJAX 缓存头'
);

if ($failures > 0) {
    fwrite(STDERR, "{$failures} PJAX cache header contract test(s) failed.\n");
    exit(1);
}

echo "All PJAX cache header contract tests passed.\n";

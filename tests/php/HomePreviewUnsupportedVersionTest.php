<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class HomePreviewUnsupportedTerminal extends Exception
{
    public $status;

    public function __construct($status, $body)
    {
        parent::__construct((string) $body, (int) $status);
        $this->status = (int) $status;
    }
}

class HomePreviewUnsupportedRequest
{
    private $values;

    public function __construct($values)
    {
        $this->values = $values;
    }

    public function get($name, $default = null)
    {
        return array_key_exists($name, $this->values) ? $this->values[$name] : $default;
    }
}

class HomePreviewUnsupportedResponse
{
    public $headers = array();
    public $status = 200;

    public function setHeader($name, $value)
    {
        $this->headers[$name] = $value;
        return $this;
    }

    public function setStatus($status)
    {
        $this->status = (int) $status;
        return $this;
    }

    public function throwContent($body)
    {
        throw new HomePreviewUnsupportedTerminal($this->status, $body);
    }
}

class HomePreviewUnsupportedArchive
{
    public $request;
    public $response;

    public function __construct($values)
    {
        $this->request = new HomePreviewUnsupportedRequest($values);
        $this->response = new HomePreviewUnsupportedResponse();
    }
}

class Typecho_Common
{
    const VERSION = '1.2.1';
}

require_once dirname(__DIR__, 2) . '/libs/HomePreview.php';

$failures = 0;

function homePreviewUnsupportedAssertSame($expected, $actual, $message)
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

$plainArchive = new HomePreviewUnsupportedArchive(array());
homePreviewUnsupportedAssertSame(
    false,
    HomePreview::handle($plainArchive),
    'Typecho 1.2 普通请求不启用首页预览'
);
homePreviewUnsupportedAssertSame(
    array(),
    $plainArchive->response->headers,
    'Typecho 1.2 普通请求响应保持原状'
);

$previewArchive = new HomePreviewUnsupportedArchive(array(
    HomePreview::QUERY_NAME => '12',
    '_' => 'unused-token'
));
$terminal = null;
try {
    HomePreview::handle($previewArchive);
} catch (HomePreviewUnsupportedTerminal $error) {
    $terminal = $error;
}

homePreviewUnsupportedAssertSame(404, $terminal ? $terminal->status : null, 'Typecho 1.2 预览参数失败关闭');
homePreviewUnsupportedAssertSame(
    'private, no-store, max-age=0',
    isset($previewArchive->response->headers['Cache-Control'])
        ? $previewArchive->response->headers['Cache-Control'] : null,
    'Typecho 1.2 拒绝响应禁止缓存'
);
homePreviewUnsupportedAssertSame(
    'noindex, nofollow, noarchive',
    isset($previewArchive->response->headers['X-Robots-Tag'])
        ? $previewArchive->response->headers['X-Robots-Tag'] : null,
    'Typecho 1.2 拒绝响应禁止索引'
);

$_SERVER['SCRIPT_NAME'] = '/admin/write-post.php';
homePreviewUnsupportedAssertSame(
    null,
    HomePreview::getEditorConfig(),
    'Typecho 1.2 文章编辑器不下发首页预览配置'
);

if ($failures > 0) {
    fwrite(STDERR, "{$failures} unsupported-version contract test(s) failed.\n");
    exit(1);
}

echo "All unsupported-version home preview contract tests passed.\n";

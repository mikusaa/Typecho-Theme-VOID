<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class ArchiveComputedFieldsOptions
{
    public function __get($name)
    {
        return null;
    }
}

class Helper
{
    public static function options()
    {
        return new ArchiveComputedFieldsOptions();
    }
}

class ArchiveComputedFieldsPluginHandle
{
    public $bottom;
    public $contentEx;
    public $excerptEx;
    public $markdown;
}

class Typecho_Plugin
{
    public static function factory($handle)
    {
        return new ArchiveComputedFieldsPluginHandle();
    }

    public static function export()
    {
        return array('activated' => array());
    }
}

class Typecho_Widget
{
    protected $row = array();

    public function __construct(array $row)
    {
        $this->row = $row;
    }

    public function have()
    {
        return !empty($this->row);
    }

    public function getRow()
    {
        return $this->row;
    }
}

class Widget_Archive extends Typecho_Widget
{
}

class Widget_Comments_Archive
{
}

class_alias('Typecho_Plugin', 'Typecho\Plugin');
class_alias('Typecho_Widget', 'Typecho\Widget');
class_alias('Widget_Archive', 'Widget\Archive');
class_alias('Widget_Comments_Archive', 'Widget\Comments\Archive');

require_once dirname(__DIR__, 2) . '/functions.php';

$failures = 0;

function archiveComputedFieldsAssertSame($expected, $actual, $message)
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

$archive = new Widget_Archive(array(
    'cid' => 1,
    'text' => '正文',
    '#content' => '未经主题 Hook 的正文',
    '#excerpt' => '未经主题 Hook 的摘要',
    '#plainExcerpt' => '未经主题 Hook 的纯文本摘要',
    '#title' => '标题'
));
VOID_refreshArchiveComputedFields($archive);
archiveComputedFieldsAssertSame(
    array('cid' => 1, 'text' => '正文', '#title' => '标题'),
    $archive->getRow(),
    '只删除 content、excerpt、plainExcerpt 三个缓存键，下次读取时经主题 Hook 重新计算'
);

$empty = new Widget_Archive(array());
VOID_refreshArchiveComputedFields($empty);
archiveComputedFieldsAssertSame(array(), $empty->getRow(), '空归档保持不变');

$other = new Typecho_Widget(array('#content' => '其他组件'));
VOID_refreshArchiveComputedFields($other);
archiveComputedFieldsAssertSame(
    array('#content' => '其他组件'),
    $other->getRow(),
    '非归档组件不受影响'
);

if ($failures > 0) {
    fwrite(STDERR, "{$failures} archive computed field contract test(s) failed.\n");
    exit(1);
}

echo "All archive computed field contract tests passed.\n";

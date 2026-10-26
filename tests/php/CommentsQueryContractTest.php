<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class CommentsQueryStub
{
    public $fields;
    public $where = array();

    public function __construct($fields)
    {
        $this->fields = $fields;
    }

    public function from($table)
    {
        return $this;
    }

    public function where($expression, $value)
    {
        $this->where[] = array($expression, $value);
        return $this;
    }
}

class CommentsQueryDb
{
    public $queries = array();
    public $rows = array();

    public function select()
    {
        return new CommentsQueryStub(func_get_args());
    }

    public function fetchAll($query)
    {
        $this->queries[] = $query;
        return $this->rows;
    }

    public function fetchRow($query)
    {
        $this->queries[] = $query;
        return array();
    }
}

class Widget_Abstract_Comments
{
    public $row = array();
    public $stack = array();
    public $levels = 0;
    protected $db;
}

require_once dirname(__DIR__, 2) . '/libs/Comments.php';

$failures = 0;

function commentsQueryAssertSame($expected, $actual, $message)
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

function commentsQueryWidget(CommentsQueryDb $db)
{
    $reflection = new ReflectionClass('VOID_Widget_Comments_Archive');
    $widget = $reflection->newInstanceWithoutConstructor();
    $property = new ReflectionProperty('Widget_Abstract_Comments', 'db');
    $property->setValue($widget, $db);
    return $widget;
}

function commentsQueryCall($widget, $method)
{
    $reflection = new ReflectionMethod('VOID_Widget_Comments_Archive', $method);
    return $reflection->invoke($widget);
}

function commentsQuerySetAuthors($widget, array $authors)
{
    $property = new ReflectionProperty('VOID_Widget_Comments_Archive', '_commentAuthors');
    $property->setValue($widget, $authors);
}

$db = new CommentsQueryDb();
$widget = commentsQueryWidget($db);
$widget->row = array('coid' => 5, 'likes' => '3', 'dislikes' => '7');
commentsQueryAssertSame(
    array('likes' => 3, 'dislikes' => 7),
    commentsQueryCall($widget, 'getLikesAndDislikes'),
    '赞踩直接取自评论列表已查询的整行'
);
$widget->row = array('coid' => 6);
commentsQueryAssertSame(
    array('likes' => 0, 'dislikes' => 0),
    commentsQueryCall($widget, 'getLikesAndDislikes'),
    '缺少赞踩列时按 0 处理'
);
commentsQueryAssertSame(0, count($db->queries), '读取赞踩不再逐条查询数据库');

$db = new CommentsQueryDb();
$db->rows = array(array('coid' => 9, 'author' => '待审核的父评论'));
$widget = commentsQueryWidget($db);
$widget->stack = array(
    1 => array('coid' => 1, 'parent' => 0, 'author' => 'A'),
    2 => array('coid' => 2, 'parent' => 1, 'author' => 'B'),
    3 => array('coid' => 3, 'parent' => 9, 'author' => 'C'),
    4 => array('coid' => 4, 'parent' => 9, 'author' => 'D'),
    5 => array('coid' => 5, 'parent' => 11, 'author' => 'E')
);
commentsQuerySetAuthors($widget, array(1 => 'A', 2 => 'B', 3 => 'C', 4 => 'D', 5 => 'E'));
commentsQueryCall($widget, 'loadMissingParentAuthors');
commentsQueryAssertSame(1, count($db->queries), '不在列表中的父评论作者一次批量查询');
commentsQueryAssertSame(array(array('coid IN ?', array(9, 11))), $db->queries[0]->where, '批量查询只包含缺失的父评论');

$widget->levels = 2;
$widget->row = array('coid' => 3, 'parent' => 9, 'realParent' => 9);
commentsQueryAssertSame(
    true,
    strpos(commentsQueryCall($widget, 'getParent'), '@待审核的父评论') !== false,
    '回复标签使用批量取回的父评论作者'
);
$widget->row = array('coid' => 5, 'parent' => 11, 'realParent' => 11);
commentsQueryAssertSame(
    true,
    strpos(commentsQueryCall($widget, 'getParent'), '@已删除的评论') !== false,
    '数据库中也不存在的父评论显示为已删除'
);
commentsQueryAssertSame(1, count($db->queries), '渲染回复标签时不再单独查询父评论');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} comments query contract test(s) failed.\n");
    exit(1);
}

echo "All comments query contract tests passed.\n";

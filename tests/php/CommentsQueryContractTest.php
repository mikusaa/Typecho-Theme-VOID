<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class Widget_Comments_Archive
{
    protected $row = array();
    protected $stack = array();

    public function __get($name)
    {
        return isset($this->row[$name]) ? $this->row[$name] : null;
    }

    public function setRow(array $row)
    {
        $this->row = $row;
    }

    public function getStack()
    {
        return $this->stack;
    }

    public function push(array $value): array
    {
        $this->stack[$value['coid']] = $value;
        return $value;
    }
}

// 主题源码使用 Typecho 1.3 命名空间类名；替身按下划线名声明，再像核心一样建立别名。
class_alias('Widget_Comments_Archive', 'Widget\Comments\Archive');

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

function commentsQueryCall($widget, $method, array $args = array())
{
    $reflection = new ReflectionMethod('VOID_Widget_Comments_Archive', $method);
    return $reflection->invokeArgs($reflection->isStatic() ? null : $widget, $args);
}

commentsQueryAssertSame(
    true,
    is_subclass_of('VOID_Widget_Comments_Archive', 'Widget\Comments\Archive'),
    '评论组件继承 Typecho 1.3 核心评论归档组件'
);
commentsQueryAssertSame(true, function_exists('threadedComments'), '主题提供核心评论组件调用的全局 threadedComments() 回调');

$widget = new VOID_Widget_Comments_Archive();
$widget->setRow(array('coid' => 5, 'likes' => '3', 'dislikes' => '7'));
commentsQueryAssertSame(
    array('likes' => 3, 'dislikes' => 7),
    commentsQueryCall(null, 'getLikesAndDislikes', array($widget)),
    '赞踩直接取自评论列表已查询的整行'
);
$widget->setRow(array('coid' => 6));
commentsQueryAssertSame(
    array('likes' => 0, 'dislikes' => 0),
    commentsQueryCall(null, 'getLikesAndDislikes', array($widget)),
    '缺少赞踩列时按 0 处理'
);

$widget = new VOID_Widget_Comments_Archive();
foreach (array(
    array('coid' => 1, 'parent' => 0, 'author' => 'A'),
    array('coid' => 2, 'parent' => 1, 'author' => 'B<script>'),
    array('coid' => 3, 'parent' => 2, 'author' => 'C'),
    array('coid' => 4, 'parent' => 3, 'author' => '')
) as $row) {
    $widget->push($row);
}
$stack = $widget->getStack();
commentsQueryAssertSame(2, $stack[3]['realParent'], 'push() 在核心改挂超深评论前记录实际父评论');

// 核心把超过最大嵌套层级的评论改挂到上上层：parent 变化，realParent 不变。
$widget->setRow(array('coid' => 4, 'levels' => 2, 'parent' => 1, 'realParent' => 3));
commentsQueryAssertSame(
    true,
    strpos(commentsQueryCall($widget, 'getParentLabel'), '@C</b>') !== false,
    '超深评论的回复标签指向实际回复的评论'
);
$widget->setRow(array('coid' => 3, 'levels' => 2, 'parent' => 2, 'realParent' => 2));
commentsQueryAssertSame(
    true,
    strpos(commentsQueryCall($widget, 'getParentLabel'), '@B&lt;script&gt;</b>') !== false,
    '回复标签转义父评论作者名'
);
$widget->setRow(array('coid' => 5, 'levels' => 2, 'parent' => 4, 'realParent' => 4));
commentsQueryAssertSame(
    true,
    strpos(commentsQueryCall($widget, 'getParentLabel'), '@已删除的评论') !== false,
    '父评论作者名为空时显示为已删除'
);
$widget->setRow(array('coid' => 2, 'levels' => 1, 'parent' => 1, 'realParent' => 1));
commentsQueryAssertSame('', commentsQueryCall($widget, 'getParentLabel'), '第一层回复不显示回复标签');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} comments query contract test(s) failed.\n");
    exit(1);
}

echo "All comments query contract tests passed.\n";

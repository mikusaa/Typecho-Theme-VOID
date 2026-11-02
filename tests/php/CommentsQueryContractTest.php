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

    protected function ___children(): array
    {
        return isset($this->row['children']) ? $this->row['children'] : array();
    }

    public static function pluginHandle()
    {
        return new class {
            public function trigger(&$plugged)
            {
                $plugged = false;
                return $this;
            }

            public function call(...$args)
            {
                return null;
            }
        };
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
    array('coid' => 1, 'parent' => 0, 'levels' => 0, 'author' => 'A'),
    array('coid' => 2, 'parent' => 1, 'levels' => 1, 'author' => 'B<script>'),
    array('coid' => 3, 'parent' => 2, 'levels' => 2, 'author' => 'C'),
    array('coid' => 4, 'parent' => 3, 'levels' => 3, 'author' => '')
) as $row) {
    $widget->push($row);
}
$stack = $widget->getStack();
commentsQueryAssertSame(2, $stack[3]['realParent'], 'push() 在核心改挂超深评论前记录实际父评论');
commentsQueryAssertSame(3, $stack[4]['realLevels'], 'push() 在核心压平超深评论前记录实际深度');

function commentsQueryChildIds($widget, $order, array $children)
{
    $widget->setRow(array(
        'coid' => 8783,
        'children' => $children,
        'options' => (object) array('commentsOrder' => $order)
    ));
    return array_map(function ($child) {
        return $child['coid'];
    }, commentsQueryCall($widget, '___children'));
}

$deepReply = function ($coid, $realParent) {
    return array('coid' => $coid, 'parent' => 8783, 'realParent' => $realParent, 'levels' => 6);
};
$childrenWidget = new VOID_Widget_Comments_Archive();
// DESC 时核心把 8783 下的 [8784, 8785, 8786] 整体反转；楼中楼应还原为回复先后，8785 实际回复 8784。
commentsQueryAssertSame(
    array(8784, 8785, 8786),
    commentsQueryChildIds($childrenWidget, 'DESC', array($deepReply(8786, 8783), $deepReply(8785, 8784), $deepReply(8784, 8783))),
    'DESC 下楼中楼仍按回复先后排列，超深回复排在被回复评论之后'
);
commentsQueryAssertSame(
    array(8784, 8786),
    commentsQueryChildIds($childrenWidget, 'DESC', array($deepReply(8786, 8783), $deepReply(8784, 8783))),
    'DESC 只作用于顶层评论，同一评论的多条回复按回复先后排列'
);
commentsQueryAssertSame(
    array(8784, 8785, 8787, 8786),
    commentsQueryChildIds($childrenWidget, 'ASC', array($deepReply(8784, 8783), $deepReply(8785, 8784), $deepReply(8786, 8783), $deepReply(8787, 8784))),
    '超深回复按实际回复关系紧跟被回复评论'
);
commentsQueryAssertSame(
    array(8784, 8785, 8788),
    commentsQueryChildIds($childrenWidget, 'ASC', array($deepReply(8784, 8783), $deepReply(8785, 8784), $deepReply(8788, 8785))),
    '连续超深回复按实际回复链展开'
);
commentsQueryAssertSame(
    array(8784, 8786),
    commentsQueryChildIds($childrenWidget, 'ASC', array($deepReply(8784, 8783), $deepReply(8786, 8783))),
    '没有超深回复时 ASC 保持核心子评论顺序'
);
commentsQueryAssertSame(
    array(8784, 8790),
    commentsQueryChildIds($childrenWidget, 'ASC', array($deepReply(8784, 8783), $deepReply(8790, 8999))),
    '实际父评论不在本组时仍保留评论'
);

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

function commentsQueryReplyOutput($widget)
{
    ob_start();
    $widget->reply('');
    return ob_get_clean();
}

$replyRow = array(
    'coid' => 8784,
    'levels' => 6,
    'theId' => 'comment-8784',
    'permalink' => 'https://example.test/archives/1.html/comment-page-1#comment-8784',
    'isTopLevel' => true,
    'options' => (object) array('commentsThreaded' => 1),
    'parameter' => (object) array('allowComment' => true, 'respondId' => 'respond-post-1')
);
$widget = new VOID_Widget_Comments_Archive();
$widget->setRow($replyRow);
commentsQueryAssertSame(
    true,
    strpos(commentsQueryReplyOutput($widget), 'href="https://example.test/archives/1.html/comment-page-1?replyTo=8784#respond-post-1"') !== false,
    '最深一层评论仍输出回复链接，更深的回复交由核心改挂到上上层'
);
$widget->setRow(array_merge($replyRow, array('options' => (object) array('commentsThreaded' => 0))));
commentsQueryAssertSame('', commentsQueryReplyOutput($widget), '关闭评论回复时不输出回复链接');
$widget->setRow(array_merge($replyRow, array('parameter' => (object) array('allowComment' => false, 'respondId' => 'respond-post-1'))));
commentsQueryAssertSame('', commentsQueryReplyOutput($widget), '文章关闭评论时不输出回复链接');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} comments query contract test(s) failed.\n");
    exit(1);
}

echo "All comments query contract tests passed.\n";

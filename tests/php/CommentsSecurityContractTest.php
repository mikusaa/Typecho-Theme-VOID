<?php

$root = dirname(__DIR__, 2);
$functions = file_get_contents($root . '/functions.php');
$head = file_get_contents($root . '/includes/head.php');
$comments = file_get_contents($root . '/includes/comments.php');
$commentWidget = file_get_contents($root . '/libs/Comments.php');
$failures = 0;

function commentsSecurityAssertSame($expected, $actual, $message)
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

function commentsSecurityAssertContains($needle, $haystack, $message)
{
    commentsSecurityAssertSame(true, strpos($haystack, $needle) !== false, $message);
}

function commentsSecurityAssertNotContains($needle, $haystack, $message)
{
    commentsSecurityAssertSame(false, strpos($haystack, $needle) !== false, $message);
}

commentsSecurityAssertNotContains(
    '$options->commentsAntiSpam =',
    $functions,
    '主题不再覆盖 Typecho 反垃圾开关'
);
commentsSecurityAssertNotContains(
    '$options->commentsMaxNestingLevels =',
    $functions,
    '主题不再覆盖 Typecho 最大评论嵌套层级'
);
commentsSecurityAssertNotContains(
    '$options->commentsOrder =',
    $functions,
    '主题不再覆盖 Typecho 评论排序'
);
commentsSecurityAssertNotContains(
    'error_reporting(',
    $functions,
    '主题不再全局关闭 PHP 错误报告'
);
commentsSecurityAssertNotContains(
    'setAccessible(',
    $functions,
    'PHP 8.1 起无需再调用 ReflectionProperty::setAccessible()'
);

commentsSecurityAssertContains(
    '$commentsRequireUrl = !empty(Helper::options()->commentsRequireUrl);',
    $comments,
    '评论网址必填只读取 Typecho 1.3 的 commentsRequireUrl'
);
commentsSecurityAssertNotContains('commentsRequireURL', $comments, '不再兜底读取 Typecho 1.2 的 commentsRequireURL 旧键');

commentsSecurityAssertContains(
    "\$this->header('commentReply=&description=&social=0')",
    $head,
    '完整页面继续由核心输出反垃圾脚本并执行 header 插件过滤'
);
commentsSecurityAssertNotContains('antiSpam=0', $head, 'head 不会关闭核心反垃圾脚本');
commentsSecurityAssertNotContains('$this->header(', $comments, '评论局部模板不重复触发全局 header 插件钩子');

commentsSecurityAssertContains(
    "if (!empty(Helper::options()->commentsAntiSpam))",
    $comments,
    '仅在后台启用反垃圾时为 PJAX 响应生成令牌'
);
commentsSecurityAssertContains(
    '$commentSecurity->getToken($this->request->getRequestUrl())',
    $comments,
    'PJAX 令牌绑定当前评论页面 URL'
);
commentsSecurityAssertContains(
    "document.readyState === 'loading'",
    $comments,
    '完整页面解析阶段不会重复安装主题令牌'
);
commentsSecurityAssertContains(
    'AjaxComment.installAntiSpamToken(',
    $comments,
    'PJAX 替换后把令牌安装到当前评论表单'
);
commentsSecurityAssertContains(
    'var token = <?php echo $commentSecurityTokenExpression; ?>',
    $comments,
    'Typecho 自带结尾分号的混淆表达式先赋值再作为函数参数使用'
);
commentsSecurityAssertContains(
    'data-comments-order="<?php echo $commentsOrder; ?>"',
    $comments,
    '评论模板把规范化后的排序传给 Ajax 评论逻辑'
);

commentsSecurityAssertContains(
    'class VOID_Widget_Comments_Archive extends \\Widget\\Comments\\Archive',
    $commentWidget,
    '评论组件继承 Typecho 1.3 核心评论归档组件'
);
foreach (array('execute', 'pageNav', 'listComments', 'threadedComments', 'num', 'alt', 'levelsAlt', '___permalink', '___children', '___isTopLevel') as $coreMethod) {
    commentsSecurityAssertSame(
        0,
        preg_match('/(?:public|protected|private)(?:\s+static)?\s+function\s+' . preg_quote($coreMethod, '/') . '\s*\(/', $commentWidget),
        '查询、嵌套、DESC 子评论反转与分页沿用核心 ' . $coreMethod . '()，主题不再复制'
    );
}
commentsSecurityAssertContains(
    'data-comment-parent="<?php echo (int)$comments->parent; ?>"',
    $commentWidget,
    '评论节点暴露服务端实际父级供 Ajax 保持嵌套顺序'
);
commentsSecurityAssertContains(
    'data-comment-depth="<?php echo (int)$comments->levels; ?>"',
    $commentWidget,
    '评论节点暴露服务端实际深度供 Ajax 保持嵌套顺序'
);
commentsSecurityAssertContains(
    "\$commentClass = '';",
    $commentWidget,
    '评论样式变量在所有分支中均已初始化'
);
commentsSecurityAssertContains(
    '<time datetime="<?php $comments->date(\'c\'); ?>">',
    $commentWidget,
    '评论时间使用带 datetime 属性的 time 元素'
);
commentsSecurityAssertSame(0, preg_match('/<time(?![\\s>])/', $commentWidget), '评论模板的 time 标签名后不直接粘连属性');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} comment security contract test(s) failed.\n");
    exit(1);
}

echo "All comment security contract tests passed.\n";

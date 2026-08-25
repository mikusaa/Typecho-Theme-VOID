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
commentsSecurityAssertContains(
    'if (PHP_VERSION_ID < 80100)',
    $functions,
    '仅在仍需要时调用 ReflectionProperty 兼容接口'
);

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
    "\$this->_threadedComments = array_map('array_reverse', \$this->_threadedComments);",
    $commentWidget,
    'DESC 排序同时反转每组子评论'
);
commentsSecurityAssertContains(
    'data-comment-parent="<?php echo (int)$this->parent; ?>"',
    $commentWidget,
    '评论节点暴露服务端实际父级供 Ajax 保持嵌套顺序'
);
commentsSecurityAssertContains(
    'data-comment-depth="<?php echo (int)$this->levels; ?>"',
    $commentWidget,
    '评论节点暴露服务端实际深度供 Ajax 保持嵌套顺序'
);
commentsSecurityAssertContains(
    "\$commentClass = '';",
    $commentWidget,
    '评论样式变量在所有分支中均已初始化'
);

if ($failures > 0) {
    fwrite(STDERR, "{$failures} comment security contract test(s) failed.\n");
    exit(1);
}

echo "All comment security contract tests passed.\n";

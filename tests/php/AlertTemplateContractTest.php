<?php

$failures = 0;

function alertTemplateAssert($condition, $message)
{
    global $failures;
    if ($condition) {
        echo "ok - {$message}\n";
        return;
    }

    ++$failures;
    echo "not ok - {$message}\n";
}

$root = dirname(__DIR__, 2);
$main = file_get_contents($root . '/includes/main.php');
$comments = file_get_contents($root . '/includes/comments.php');
$functions = file_get_contents($root . '/functions.php');

alertTemplateAssert(
    strpos($main, '<p class="notice">请注意，本文编写于') !== false,
    '文章过时提醒保留原 notice 结构'
);
alertTemplateAssert(
    strpos($main, 'void-alert--system') === false,
    '文章过时提醒不使用正文 Alert 组件'
);
alertTemplateAssert(
    strpos($comments, 'class="comment-notification notice"') !== false,
    '评论须知保留原 notice 结构'
);
alertTemplateAssert(
    strpos($comments, 'comment-notification void-alert') === false,
    '评论须知不使用正文 Alert 组件'
);
alertTemplateAssert(
    strpos($comments, 'Utils::formatCommentNotification($setting[\'commentNotification\'])') !== false,
    '评论须知继续经过受限富文本格式化器'
);
alertTemplateAssert(
    strpos($functions, '<p id="void-check-update" class="notice">') !== false,
    '后台更新检查继续使用后台 notice 样式'
);
alertTemplateAssert(
    strpos($functions, '<p class="notice">未检测到合适的 VOID 插件！') !== false,
    '后台插件提示继续使用后台 notice 样式'
);

if ($failures > 0) {
    fwrite(STDERR, "{$failures} alert template contract test(s) failed.\n");
    exit(1);
}

echo "All alert template contract tests passed.\n";

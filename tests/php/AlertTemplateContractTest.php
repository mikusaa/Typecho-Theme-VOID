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
    strpos($main, '<aside class="article-outdated-notice" aria-labelledby="article-outdated-notice-title">') !== false,
    '文章时效提醒使用独立 aside 结构'
);
alertTemplateAssert(
    strpos($main, 'class="article-outdated-notice__title" id="article-outdated-notice-title"') !== false,
    '文章时效提醒以可见标题命名区域'
);
alertTemplateAssert(
    strpos($main, '<svg class="article-outdated-notice__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">') !== false
        && strpos($main, '<path d="M8 4.4v3.9l2.5 1.5"></path>') !== false,
    '文章时效提醒使用设计稿中的装饰性时钟图标'
);
alertTemplateAssert(
    strpos($main, '<time datetime="<?php echo Utils::escapeHtml($outdatedDate); ?>"><?php echo Utils::escapeHtml($outdatedDate); ?></time>') !== false,
    '文章时效提醒输出语义化最后更新时间'
);
alertTemplateAssert(
    strpos($main, '本文最后更新于 <time') !== false
        && strpos($main, '文中涉及的方法、版本、链接或操作步骤可能已经变化，请在参考或操作前确认其是否仍然适用。') !== false,
    '文章时效提醒使用最终文案'
);
alertTemplateAssert(
    strpos($main, '<p class="notice">请注意，本文编写于') === false,
    '文章时效提醒不再使用旧 notice 文案'
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

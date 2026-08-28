<?php

require_once dirname(__DIR__, 2) . '/libs/Utils.php';

$failures = 0;

function commentNotificationAssertSame($expected, $actual, $message)
{
    global $failures;

    if ($expected === $actual) {
        return;
    }

    ++$failures;
    fwrite(
        STDERR,
        "FAIL: {$message}\nExpected: " . var_export($expected, true)
        . "\nActual:   " . var_export($actual, true) . "\n"
    );
}

commentNotificationAssertSame(
    "第一行<br>第二行<br>第三行<br>第四行<br>\n第五行",
    Utils::formatCommentNotification("第一行<br>第二行<br/>第三行<br />第四行\n第五行"),
    '兼容 HTML 换行标签并支持纯文本换行'
);

commentNotificationAssertSame(
    '<strong>重要 &amp;</strong>，<strong>请先阅读</strong>',
    Utils::formatCommentNotification(
        '<strong class="ignored" onclick="alert(1)">重要 &amp;</strong>，<b>请先阅读</b>'
    ),
    '加粗标签统一为无属性的 strong'
);

commentNotificationAssertSame(
    '<a href="https://example.com/rules?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">评论规则 &amp;</a>',
    Utils::formatCommentNotification(
        '<a href="https://example.com/rules?a=1&amp;b=2" target="_blank" onclick="alert(1)">评论规则 &amp;</a>'
    ),
    'HTTP 链接仅保留安全属性并保护新窗口上下文'
);

commentNotificationAssertSame(
    '<a href="/rules?q=1&amp;x=2" target="_self">站内规则</a>',
    Utils::formatCommentNotification(
        '<a href="/rules?q=1&amp;x=2" target="_self" rel="opener">站内规则</a>'
    ),
    '站内相对链接保留语义并丢弃未知属性'
);

commentNotificationAssertSame(
    '脚本链接 数据链接 邮件链接 无主机链接 畸形相对链接',
    Utils::formatCommentNotification(
        '<a href="javascript&colon;alert(1)">脚本链接</a> '
        . '<a href="data:text/html,test">数据链接</a> '
        . '<a href="mailto:test@example.com">邮件链接</a> '
        . '<a href="https:///missing-host">无主机链接</a> '
        . '<a href="rules%ZZ">畸形相对链接</a>'
    ),
    '拒绝 HTTP(S) 与相对地址之外的链接协议'
);

commentNotificationAssertSame(
    'alert(1)图片斜体<br><strong>安全</strong>',
    Utils::formatCommentNotification(
        '<script>alert(1)</script><img src=x onerror=alert(1)>图片<em>斜体</em>'
        . '<br onclick="alert(1)"><strong onclick="alert(1)">安全</strong>'
    ),
    '不支持的标签被移除且允许标签的属性不会进入输出'
);

commentNotificationAssertSame(
    '&lt;strong&gt;保持文字&lt;/strong&gt; &amp;',
    Utils::formatCommentNotification('&lt;strong&gt;保持文字&lt;/strong&gt; &amp;'),
    '已编码标签保持文字语义且实体不被重复编码'
);

commentNotificationAssertSame(
    '<strong><a href="https://example.com/">自动闭合</a></strong>',
    Utils::formatCommentNotification('<strong><a href="https://example.com/">自动闭合</strong>'),
    '不完整的允许标签不会越过评论提示容器'
);

commentNotificationAssertSame(
    '',
    Utils::formatCommentNotification(array('not', 'a', 'string')),
    '非法设置类型安全回退为空字符串'
);

$commentsTemplate = file_get_contents(dirname(__DIR__, 2) . '/includes/comments.php');
commentNotificationAssertSame(
    true,
    strpos($commentsTemplate, 'Utils::formatCommentNotification($setting[\'commentNotification\'])') !== false,
    '评论模板使用受限格式化器输出提示语'
);

if ($failures > 0) {
    fwrite(STDERR, "{$failures} comment notification contract test(s) failed.\n");
    exit(1);
}

echo "All comment notification contract tests passed.\n";

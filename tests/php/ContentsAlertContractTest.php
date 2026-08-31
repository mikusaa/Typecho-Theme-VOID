<?php

require_once dirname(__DIR__, 2) . '/libs/Contents.php';

$failures = 0;

function alertContractAssertSame($expected, $actual, $message)
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

function alertContractAssertContains($needle, $actual, $message)
{
    alertContractAssertSame(true, strpos($actual, $needle) !== false, $message);
}

$types = array(
    'NOTE' => array('note', '说明'),
    'TIP' => array('tip', '提示'),
    'IMPORTANT' => array('important', '重要'),
    'WARNING' => array('warning', '警告'),
    'CAUTION' => array('caution', '危险')
);

foreach ($types as $token => $expected) {
    $source = '<blockquote><p>[!' . $token . ']<br>正文</p></blockquote>';
    $output = Contents::parseAlerts($source);
    alertContractAssertSame(
        '<blockquote class="void-alert void-alert--' . $expected[0] . '">'
            . '<p class="void-alert__title">' . $expected[1] . '</p><p>正文</p></blockquote>',
        $output,
        $token . ' 输出固定类型和中文标题'
    );
}

$hyperDownSingleParagraph = '<blockquote>[!NOTE]<br>HyperDown 单段正文</blockquote>';
alertContractAssertSame(
    '<blockquote class="void-alert void-alert--note"><p class="void-alert__title">说明</p>'
        . '<p>HyperDown 单段正文</p></blockquote>',
    Contents::parseAlerts($hyperDownSingleParagraph),
    '解析 HyperDown 不带 p 的单段引用输出'
);
alertContractAssertSame(
    '<blockquote class="void-alert void-alert--note"><p class="void-alert__title">说明</p></blockquote>',
    Contents::parseAlerts('<blockquote>[!NOTE]</blockquote>'),
    '解析 HyperDown 不带 p 的空正文输出'
);

$rich = '<blockquote><p>[!WARNING]<br>第一段包含 <strong>强调</strong>。</p>'
    . '<p>第二段。</p><ul><li>列表</li></ul><pre><code>code</code></pre></blockquote>';
$richOutput = Contents::parseAlerts($rich);
alertContractAssertContains('<p>第一段包含 <strong>强调</strong>。</p>', $richOutput, '保留首段行内 HTML');
alertContractAssertContains('<p>第二段。</p><ul><li>列表</li></ul>', $richOutput, '保留多段和列表');
alertContractAssertContains('<pre><code>code</code></pre>', $richOutput, '保留代码块');

$mergedAlerts = '<blockquote><p>[!TIP]<br>第一条提示。</p>'
    . '<p>[!WARNING]<br>第二条警告。</p></blockquote>';
alertContractAssertSame(
    '<blockquote class="void-alert void-alert--tip"><p class="void-alert__title">提示</p>'
        . '<p>第一条提示。</p></blockquote>'
        . '<blockquote class="void-alert void-alert--warning"><p class="void-alert__title">警告</p>'
        . '<p>第二条警告。</p></blockquote>',
    Contents::parseAlerts($mergedAlerts),
    'HyperDown 合并的连续引用恢复为多个 Alert'
);

$empty = '<blockquote><p>[!NOTE]</p></blockquote>';
alertContractAssertSame(
    '<blockquote class="void-alert void-alert--note"><p class="void-alert__title">说明</p></blockquote>',
    Contents::parseAlerts($empty),
    '允许只有标题的空 Alert'
);

$unchanged = array(
    '<blockquote><p>普通引用</p></blockquote>' => '普通引用保持不变',
    '<blockquote><p>[!SUCCESS]<br>未知类型</p></blockquote>' => '未知类型保持普通引用',
    '<blockquote><p>[!note]<br>小写类型</p></blockquote>' => '小写类型不偏离 GitHub 正式语法',
    '<blockquote>[!NOTE] 同行正文</blockquote>' => '无换行的同行正文保持普通引用',
    '<blockquote><p>[!NOTE] 同行正文</p></blockquote>' => 'p 内无换行的同行正文保持普通引用',
    '<blockquote><p>前言<br>[!NOTE]<br>非首段开头</p></blockquote>' => '非首段开头不解析',
    '<ul><li><blockquote><p>[!NOTE]<br>列表内嵌套</p></blockquote></li></ul>' => '其他元素内的 Alert 不解析',
    '<blockquote><blockquote><p>[!NOTE]<br>引用内嵌套</p></blockquote></blockquote>' => '引用内嵌套不解析',
    '<pre><code>&lt;blockquote&gt;&lt;p&gt;[!NOTE]&lt;/p&gt;&lt;/blockquote&gt;</code></pre>' => '代码区伪标记不解析',
    '<blockquote class="custom"><p>[!NOTE]<br>带属性引用</p></blockquote>' => '带属性引用不重写',
    '<blockquote><p>[!NOTE]<br>缺少闭合' => '畸形引用保持不变'
);
foreach ($unchanged as $source => $message) {
    alertContractAssertSame($source, Contents::parseAlerts($source), $message);
}

$legacy = '<p>[notice]旧内容包含 <strong>强调</strong>[/notice]</p>';
$legacyOutput = '<blockquote class="void-alert void-alert--note">'
    . '<p class="void-alert__title">说明</p><p>旧内容包含 <strong>强调</strong></p></blockquote>';
alertContractAssertSame($legacyOutput, Contents::parseAlerts($legacy), '旧 notice 单段映射到 NOTE');
alertContractAssertSame($legacyOutput, Contents::parseNotice($legacy), '旧 parseNotice 入口委托到统一解析器');

$invalidLegacy = array(
    '<p>[notice type="warning"]参数[/notice]</p>' => '带参数旧 notice 保持原文',
    '<p>[notice]<br>换行内容<br>[/notice]</p>' => '同一段中带换行的旧 notice 保持原文',
    '<p>[notice]开始</p><p>结束[/notice]</p>' => '跨段旧 notice 保持原文',
    '<p>[notice]</p><ul><li>列表</li></ul><p>[/notice]</p>' => '列表旧 notice 保持原文',
    '<p>[notice]</p><pre><code>代码</code></pre><p>[/notice]</p>' => '代码块旧 notice 保持原文',
    '<p>[notice]缺少闭合</p>' => '缺少闭合旧 notice 保持原文',
    '<p class="custom">[notice]带属性段落[/notice]</p>' => '带属性段落不重写'
);
foreach ($invalidLegacy as $source => $message) {
    alertContractAssertSame($source, Contents::parseAlerts($source), $message);
}

$once = Contents::parseAlerts('<blockquote><p>[!TIP]<br>幂等</p></blockquote>');
alertContractAssertSame($once, Contents::parseAlerts($once), '重复解析不重复标题或 class');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} alert contract test(s) failed.\n");
    exit(1);
}

echo "All alert contract tests passed.\n";

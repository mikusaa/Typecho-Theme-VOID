<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

define('VOID_EMOTE_MANIFEST_DIR', dirname(__DIR__) . '/fixtures/emotes/packs');

class Utils
{
    public static function indexTheme($path)
    {
        echo 'https://example.test/usr/themes/VOID' . $path;
    }
}

class Markdown
{
    public static $lastInput;

    public static function convert($text)
    {
        self::$lastInput = $text;
        return '<converted>' . $text . '</converted>';
    }
}

class PipelineContractParameter
{
    private $values;

    public function __construct($values)
    {
        $this->values = $values;
    }

    public function __get($name)
    {
        return array_key_exists($name, $this->values) ? $this->values[$name] : null;
    }
}

class PipelineContractWidget
{
    public $parameter;
    public $template;

    public function __construct($parameters, $template)
    {
        $this->parameter = new PipelineContractParameter($parameters);
        $this->template = $template;
    }
}

require_once dirname(__DIR__, 2) . '/libs/Contents.php';

$GLOBALS['VOIDSetting'] = array(
    'largePhotoSet' => false,
    'lazyload' => false,
    'parseFigcaption' => true
);
$failures = 0;

function pipelineAssertSame($expected, $actual, $message)
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

function pipelineAssertOrdered($source, $needles, $message)
{
    $lastPosition = -1;
    foreach ($needles as $needle) {
        $position = strpos($source, $needle, $lastPosition + 1);
        if ($position === false || $position <= $lastPosition) {
            pipelineAssertSame(true, false, $message);
            return;
        }
        $lastPosition = $position;
    }
    pipelineAssertSame(true, true, $message);
}

$pipelineSource = file_get_contents(dirname(__DIR__, 2) . '/libs/Content/Pipeline.php');
pipelineAssertOrdered($pipelineSource, array(
    'Transform_Markdown::parseRuby($text)',
    'Transform_Images::transform(',
    'Transform_Emotes::transform($text)',
    'Transform_PhotoSets::transform(',
    'Transform_Alerts::transform($text)',
    'if ($isFeedContext)'
), 'contentEx 转换顺序固定为注音、图片、表情、图集、Alert、上下文收尾');
pipelineAssertOrdered($pipelineSource, array(
    'public static function excerptEx',
    'Transform_Markdown::parseRuby($text)',
    'Transform_Emotes::transform($text)',
    'Transform_Alerts::transform($text)',
    'Transform_PhotoSets::unwrap($text, true)',
    "preg_replace('/\\[(?:photos"
), 'excerptEx 转换顺序固定并在末尾移除图集');

$markdown = Contents::markdown("<!--markdown-->\n```c++\n[links][站点](https://example.test)+(cover.jpg)[/links]");
pipelineAssertSame(false, strpos(Markdown::$lastInput, '```c++') !== false, 'Markdown 转换前规范化代码语言别名');
pipelineAssertSame(true, strpos(Markdown::$lastInput, 'board-list link-list') !== false, '友链先渲染再进入 Markdown 转换');
pipelineAssertSame(true, strpos($markdown, '<converted>') === 0, 'facade 保留 Markdown Hook 返回值');

$ordinary = new PipelineContractWidget(array(), 'post.php');
$combined = Contents::contentEx(
    '<h2>标题</h2>{{汉:han}}[photos]<img src="/a.jpg#vwid=2&vhei=1" alt="图 :@(高兴)">[/photos]',
    $ordinary,
    null
);
pipelineAssertSame(true, strpos($combined, '<h2 id="toc_') !== false, '非 Feed 最后生成标题锚点');
pipelineAssertSame(true, strpos($combined, '<ruby>汉') !== false, 'contentEx 解析注音');
pipelineAssertSame(true, strpos($combined, 'data-void-photo-count="1"') !== false, '图片先转换为 figure 再由 PhotoSets 计数');
pipelineAssertSame(true, strpos($combined, '<figcaption>图 <img class="biaoqing"') !== false, '图片图题生成后再解析表情文本');

$last = Contents::contentEx('应被忽略', $ordinary, '<p>来自 last</p>');
pipelineAssertSame('<p>来自 last</p>', $last, '非 null 的 last 继续覆盖 data');

$feed = new PipelineContractWidget(array('type' => 'feed'), 'post.php');
$longBody = str_repeat('<p>完整 Feed 正文</p>', 80) . '<!--more--><p>尾段</p>';
$feedOutput = Contents::contentEx($longBody, $feed, null);
pipelineAssertSame($longBody, $feedOutput, '完整 Feed 保留长正文、more 标记和尾段');
pipelineAssertSame(false, strpos($feedOutput, '阅读全文') !== false, '完整 Feed 不追加主题 CTA');

$excerpt = Contents::excerptEx(
    '<div data-void-photo-set><p>删除</p></div>{{字:zi}} :@(高兴)',
    null,
    null
);
pipelineAssertSame(false, strpos($excerpt, '删除') !== false, '摘要移除已渲染 PhotoSets 及内容');
pipelineAssertSame(true, strpos($excerpt, '<ruby>字') !== false, '摘要保留注音转换');
pipelineAssertSame(true, strpos($excerpt, 'class="biaoqing"') !== false, '摘要保留表情转换');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} content pipeline contract test(s) failed.\n");
    exit(1);
}

echo "All content pipeline contract tests passed.\n";

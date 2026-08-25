<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class Widget_Archive
{
}

class ArchiveContractOptions
{
    public $time;

    public function __construct($time)
    {
        $this->time = $time;
    }

    public function title()
    {
        echo 'Archive contract site';
    }
}

class Helper
{
    public static $options;

    public static function options()
    {
        return self::$options;
    }
}

class Utils
{
    public static function captureOutput($target, $method, $arguments = array())
    {
        ob_start();
        call_user_func_array(array($target, $method), $arguments);
        return ob_get_clean();
    }

    public static function decodeHtmlText($value)
    {
        return html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    public static function escapeHtml($value)
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    public static function isPluginAvailable($name)
    {
        return false;
    }

    public static function isPjax()
    {
        return true;
    }
}

class Typecho_Date
{
    public static $timezoneOffset = 28800;
    private $timestamp;

    public function __construct($timestamp)
    {
        $this->timestamp = (int) $timestamp;
    }

    public function format($format)
    {
        return gmdate($format, $this->timestamp + self::$timezoneOffset);
    }
}

class ArchiveContractQuery
{
    public $fields;
    public $table;
    public $orders = array();
    public $wheres = array();

    public function __construct($fields)
    {
        $this->fields = $fields;
    }

    public function from($table)
    {
        $this->table = $table;
        return $this;
    }

    public function order($field, $direction)
    {
        $this->orders[] = array($field, $direction);
        return $this;
    }

    public function where($condition)
    {
        $this->wheres[] = func_get_args();
        return $this;
    }
}

class ArchiveContractDb
{
    public static $contentRows = array();
    public static $relationshipRows = array();
    public static $fetchesByTable = array();
    public static $queriesByTable = array();

    public function select()
    {
        return new ArchiveContractQuery(func_get_args());
    }

    public function fetchAll($query)
    {
        if (!isset(self::$fetchesByTable[$query->table])) {
            self::$fetchesByTable[$query->table] = 0;
            self::$queriesByTable[$query->table] = array();
        }

        ++self::$fetchesByTable[$query->table];
        self::$queriesByTable[$query->table][] = $query;

        if ($query->table === 'table.contents') {
            $rows = self::$contentRows;
            foreach ($query->wheres as $where) {
                if (strpos($where[0], 'created < ?') !== false) {
                    $cutoff = (int) $where[1];
                    $rows = array_values(array_filter($rows, function ($row) use ($cutoff) {
                        return (int) $row['created'] < $cutoff;
                    }));
                }
            }

            usort($rows, function ($left, $right) use ($query) {
                foreach ($query->orders as $order) {
                    $fieldParts = explode('.', $order[0]);
                    $field = end($fieldParts);
                    if ($left[$field] == $right[$field]) {
                        continue;
                    }

                    $comparison = $left[$field] < $right[$field] ? -1 : 1;
                    return $order[1] === Typecho_Db::SORT_DESC ? -$comparison : $comparison;
                }

                return 0;
            });

            return $rows;
        }

        if ($query->table === 'table.relationships') {
            $rows = self::$relationshipRows;
            foreach ($query->wheres as $where) {
                if (strpos($where[0], 'cid IN ?') !== false) {
                    $postIds = array_map('intval', $where[1]);
                    $rows = array_values(array_filter($rows, function ($row) use ($postIds) {
                        return in_array((int) $row['cid'], $postIds, true);
                    }));
                }
            }
            return $rows;
        }

        throw new RuntimeException('Unexpected archive query table: ' . $query->table);
    }

    public static function resetCounters()
    {
        self::$fetchesByTable = array();
        self::$queriesByTable = array();
    }
}

class Typecho_Db
{
    const SORT_ASC = 'ASC';
    const SORT_DESC = 'DESC';

    public static $instance;

    public static function get()
    {
        return self::$instance;
    }
}

class Typecho_Common
{
    const VERSION = '1.3.0';
}

class Widget_Metas_Category_List
{
    public static $rows = array();
    public static $allocCalls = 0;
    private $position = 0;
    private $row = array();

    public static function alloc()
    {
        ++self::$allocCalls;
        return new self();
    }

    public function next()
    {
        if (!isset(self::$rows[$this->position])) {
            $this->position = 0;
            $this->row = array();
            return false;
        }

        $this->row = self::$rows[$this->position];
        ++$this->position;
        return $this->row;
    }

    public function __get($name)
    {
        return isset($this->row[$name]) ? $this->row[$name] : null;
    }

    public static function resetCounters()
    {
        self::$allocCalls = 0;
    }
}

class Widget_Metas_Category_Related
{
    public static function allocWithAlias()
    {
        throw new RuntimeException('Archives must not query categories once per post');
    }
}

class Widget_Abstract_Contents
{
    public static $allocCalls = 0;
    public static $pushedCategoriesByCid = array();
    public $title;
    public $permalink;

    public static function alloc()
    {
        ++self::$allocCalls;
        return new self();
    }

    public function push($row)
    {
        $cid = (int) $row['cid'];
        self::$pushedCategoriesByCid[$cid] = isset($row['#categories'])
            ? $row['#categories'] : null;
        $this->title = !empty($row['password'])
            ? '此内容被密码保护' : 'Visible ' . $row['title'];
        $this->permalink = 'https://example.test/posts/' . $cid
            . '?from=archive&name="' . $cid . '"';
        return $row;
    }

    public static function resetCounters()
    {
        self::$allocCalls = 0;
        self::$pushedCategoriesByCid = array();
    }
}

class ArchiveContractEmptyTags
{
    public function have()
    {
        return false;
    }
}

class ArchiveContractTagBinder
{
    public function to(&$target)
    {
        $target = new ArchiveContractEmptyTags();
    }
}

class ArchiveContractWidget extends Widget_Archive
{
    public $needed = array();

    public function archiveTitle()
    {
    }

    public function need($path)
    {
        $this->needed[] = $path;
    }

    public function widget()
    {
        return new ArchiveContractTagBinder();
    }

    public function render($file)
    {
        ob_start();
        include $file;
        return ob_get_clean();
    }
}

require_once dirname(__DIR__, 2) . '/libs/Contents.php';

$failures = 0;

function contentsArchiveAssertSame($expected, $actual, $message)
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

function contentsArchiveAssertContains($needle, $haystack, $message)
{
    contentsArchiveAssertSame(true, strpos($haystack, $needle) !== false, $message);
}

function contentsArchiveAssertNotContains($needle, $haystack, $message)
{
    contentsArchiveAssertSame(false, strpos($haystack, $needle) !== false, $message);
}

function contentsArchiveFindPost($archives, $cid)
{
    foreach ($archives as $posts) {
        foreach ($posts as $post) {
            if ($post['cid'] === $cid) {
                return $post;
            }
        }
    }

    return null;
}

function contentsArchiveResetCounters()
{
    ArchiveContractDb::resetCounters();
    Widget_Metas_Category_List::resetCounters();
    Widget_Abstract_Contents::resetCounters();
}

$originalTimezone = date_default_timezone_get();
date_default_timezone_set('America/Los_Angeles');

$sameSecond = gmmktime(12, 0, 0, 12, 30, 2025);
$crossYear = gmmktime(18, 30, 0, 12, 31, 2025);
$cutoff = gmmktime(0, 0, 0, 1, 2, 2026);
$future = gmmktime(0, 0, 0, 1, 3, 2026);

Helper::$options = new ArchiveContractOptions($cutoff);
Typecho_Db::$instance = new ArchiveContractDb();
ArchiveContractDb::$contentRows = array(
    array('cid' => 101, 'created' => $sameSecond, 'title' => 'Same low', 'content' => 'low'),
    array('cid' => 999, 'created' => $future, 'title' => 'Future', 'content' => 'future'),
    array('cid' => 100, 'created' => $sameSecond - 60, 'title' => 'Older', 'content' => 'older'),
    array('cid' => 103, 'created' => $crossYear, 'title' => 'Cross year', 'content' => 'cross'),
    array(
        'cid' => 102,
        'created' => $sameSecond,
        'title' => 'Same high',
        'content' => 'high',
        'wordCount' => '1234'
    ),
    array(
        'cid' => 104,
        'created' => $sameSecond - 120,
        'title' => 'Secret title',
        'content' => 'protected',
        'password' => 'secret'
    )
);
ArchiveContractDb::$relationshipRows = array(
    array('cid' => 103, 'mid' => 7),
    array('cid' => 102, 'mid' => 7),
    array('cid' => 102, 'mid' => 9),
    array('cid' => 101, 'mid' => 8),
    array('cid' => 100, 'mid' => 7),
    array('cid' => 999, 'mid' => 8),
    array('cid' => 102, 'mid' => 404)
);
Widget_Metas_Category_List::$rows = array(
    array(
        'mid' => 7,
        'name' => 'R&D "Core"',
        'slug' => 'rd-core',
        'description' => '',
        'order' => 1,
        'parent' => 0,
        'count' => 3,
        'permalink' => 'https://example.test/category/rd-core/?a=1&b="2"'
    ),
    array(
        'mid' => 8,
        'name' => 'R&D "Core"',
        'slug' => 'rd-other',
        'description' => '',
        'order' => 2,
        'parent' => 0,
        'count' => 1,
        'permalink' => 'https://example.test/category/rd-other/'
    ),
    array(
        'mid' => 9,
        'name' => 'Nested & Child',
        'slug' => 'child',
        'description' => '',
        'order' => 3,
        'parent' => 7,
        'count' => 1,
        'permalink' => 'https://example.test/category/rd-core/child/'
    )
);

contentsArchiveResetCounters();
$widget = new ArchiveContractWidget();
$archives = Contents::archives($widget);

contentsArchiveAssertSame(array(2026, 2025), array_keys($archives), '年度分组使用 Typecho 站点时区并保持倒序');
contentsArchiveAssertSame(array(103), array_column($archives['2026'], 'cid'), 'UTC 年末文章按站点时区归入下一年');
contentsArchiveAssertSame('01-01', $archives['2026'][0]['dateLabel'], '日期标签使用站点时区格式化');
contentsArchiveAssertSame(
    array(102, 101, 100, 104),
    array_column($archives['2025'], 'cid'),
    '同秒文章全部保留并按 cid 倒序稳定排列'
);
contentsArchiveAssertSame(null, contentsArchiveFindPost($archives, 999), '归档截止时间使用 Typecho 请求时间并排除未来文章');

$post102 = contentsArchiveFindPost($archives, 102);
contentsArchiveAssertSame('Visible Same high', $post102['title'], '标题继续使用 Typecho 内容组件的过滤结果');
contentsArchiveAssertSame($sameSecond, $post102['created'], '归档项保留原始 created 时间戳');
contentsArchiveAssertSame('12-30', $post102['dateLabel'], '归档项直接提供站点时区日期标签');
contentsArchiveAssertSame(array(7, 9), array_column($post102['categories'], 'mid'), '多分类按分类组件顺序批量关联');
contentsArchiveAssertSame(
    'https://example.test/category/rd-core/child/',
    $post102['categories'][1]['permalink'],
    '嵌套分类保留 Typecho 生成的 canonical permalink'
);
contentsArchiveAssertSame('R&D "Core"', $post102['categories'][0]['name'], '数据层保留未转义的原始分类名');
contentsArchiveAssertSame(
    '此内容被密码保护',
    contentsArchiveFindPost($archives, 104)['title'],
    '密码保护文章沿用 Typecho 的隐藏标题'
);
contentsArchiveAssertSame(false, array_key_exists('words', $post102), '插件能力关闭时不读取归档字数');

contentsArchiveAssertSame(1, ArchiveContractDb::$fetchesByTable['table.contents'], '公开文章只查询一次');
contentsArchiveAssertSame(1, ArchiveContractDb::$fetchesByTable['table.relationships'], '全部文章分类关系只查询一次');
contentsArchiveAssertSame(1, Widget_Metas_Category_List::$allocCalls, '分类树及 permalink 只加载一次');
contentsArchiveAssertSame(5, Widget_Abstract_Contents::$allocCalls, '每篇实际归档文章都经过内容组件');
contentsArchiveAssertSame(
    array(7, 9),
    array_column(Widget_Abstract_Contents::$pushedCategoriesByCid[102], 'mid'),
    '批量分类通过 Typecho 的 #categories 缓存注入内容组件'
);
contentsArchiveAssertSame(false, method_exists('Widget_Metas_Category_List', 'toArray'), '分类采集只使用 Typecho 1.2/1.3 共有接口');

contentsArchiveResetCounters();
$GLOBALS['VOIDSetting'] = array('VOIDPlugin' => true);
$pluginArchives = Contents::archives($widget);
contentsArchiveAssertSame(1234, contentsArchiveFindPost($pluginArchives, 102)['words'], '兼容插件启用时输出归档字数');
contentsArchiveAssertSame(
    false,
    array_key_exists('words', contentsArchiveFindPost($pluginArchives, 101)),
    '插件字段缺失时不生成未定义字数'
);

contentsArchiveResetCounters();
$GLOBALS['VOIDSetting'] = array('VOIDPlugin' => false);
$rendered = $widget->render(dirname(__DIR__, 2) . '/Archives.php');

contentsArchiveAssertContains(
    'data-tooltip="R&amp;D &quot;Core&quot;(2)',
    $rendered,
    '年度 tooltip 按分类 mid 分别统计同名分类'
);
contentsArchiveAssertContains('R&amp;D &quot;Core&quot;(1)', $rendered, '同名但不同 mid 的分类不被合并');
contentsArchiveAssertNotContains('R&amp;D &quot;Core&quot;(3)', $rendered, '同名分类不会按名称错误合计');
contentsArchiveAssertNotContains('R&amp;amp;D', $rendered, '分类名在最终 HTML 上下文中只转义一次');
contentsArchiveAssertContains(
    'href="https://example.test/category/rd-core/?a=1&amp;b=&quot;2&quot;"',
    $rendered,
    '分类 permalink 按 HTML 属性上下文转义'
);
contentsArchiveAssertContains(
    'href="https://example.test/posts/102?from=archive&amp;name=&quot;102&quot;"',
    $rendered,
    '文章 permalink 按 HTML 属性上下文转义'
);
contentsArchiveAssertContains('<span class="date">01-01</span>Visible Cross year', $rendered, '模板直接使用站点时区日期标签');
contentsArchiveAssertNotContains('Secret title', $rendered, '年度归档 HTML 不泄露密码文章原始标题');
contentsArchiveAssertContains('此内容被密码保护', $rendered, '年度归档显示密码保护占位标题');
contentsArchiveAssertSame(1, ArchiveContractDb::$fetchesByTable['table.contents'], '完整年度模板仍只查询一次文章');
contentsArchiveAssertSame(1, ArchiveContractDb::$fetchesByTable['table.relationships'], '完整年度模板仍只查询一次分类关系');
contentsArchiveAssertSame(1, Widget_Metas_Category_List::$allocCalls, '完整年度模板没有逐篇分类 Widget');

ArchiveContractDb::$contentRows = array();
contentsArchiveResetCounters();
$emptyArchives = Contents::archives($widget);
contentsArchiveAssertSame(array(), $emptyArchives, '无公开文章时返回空归档');
contentsArchiveAssertSame(1, ArchiveContractDb::$fetchesByTable['table.contents'], '空站点只执行文章查询');
contentsArchiveAssertSame(false, isset(ArchiveContractDb::$fetchesByTable['table.relationships']), '空站点不查询无意义的分类关系');
contentsArchiveAssertSame(0, Widget_Metas_Category_List::$allocCalls, '空站点不初始化分类组件');

date_default_timezone_set($originalTimezone);

if ($failures > 0) {
    fwrite(STDERR, "{$failures} Contents archive contract test(s) failed.\n");
    exit(1);
}

echo "All Contents archive contract tests passed.\n";

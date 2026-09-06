<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class RepositoryQuery
{
    public $owner;
    public $table;
    public $where = array();
    public $limitValue;

    public function __construct($owner = null)
    {
        $this->owner = $owner;
    }

    public function select()
    {
        return $this;
    }

    public function from($table)
    {
        $this->table = $table;
        return $this;
    }

    public function where($expression)
    {
        $arguments = func_get_args();
        array_shift($arguments);
        $this->where[] = array($expression, $arguments);
        return $this;
    }

    public function order($field, $direction)
    {
        return $this;
    }

    public function limit($limit)
    {
        $this->limitValue = $limit;
        return $this;
    }

    public function firstWhereValue()
    {
        return isset($this->where[0][1][0]) ? $this->where[0][1][0] : null;
    }
}

class Typecho_Db
{
    const SORT_DESC = 'DESC';
    const SORT_ASC = 'ASC';

    public static $instance;
    public static $componentRows = array();
    public static $commentRows = array();
    public static $relationshipRows = array();
    public static $contentLookupRows = array();
    public static $queries = array();

    public static function get()
    {
        if (!self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function select()
    {
        return new RepositoryQuery();
    }

    public function fetchRow($query, $callback = null)
    {
        self::$queries[] = $query;
        if ($query->owner) {
            $id = $query->firstWhereValue();
            $row = isset(self::$componentRows[$query->owner][$id])
                ? self::$componentRows[$query->owner][$id] : array();
            if ($callback && $row) {
                call_user_func($callback, $row);
            }
            return $row;
        }

        return empty(self::$contentLookupRows)
            ? false : array_shift(self::$contentLookupRows);
    }

    public function fetchAll($query)
    {
        self::$queries[] = $query;
        if ($query->table === 'table.comments') {
            return self::$commentRows;
        }
        if ($query->table === 'table.relationships') {
            return self::$relationshipRows;
        }
        return array();
    }
}

class RepositoryComponent
{
    public $cid;
    public $coid;
    public $mid;
    public $name;
    public $permalink;
    public $title;
    public $type;

    private $owner;

    public function __construct($owner)
    {
        $this->owner = $owner;
    }

    public function select()
    {
        return new RepositoryQuery($this->owner);
    }

    public function push($row)
    {
        foreach ($row as $key => $value) {
            $this->{$key} = $value;
        }
        return $row;
    }
}

class Widget_Abstract_Contents extends RepositoryComponent
{
    public static function alloc()
    {
        return new self(__CLASS__);
    }
}

class Widget_Abstract_Comments extends RepositoryComponent
{
    public static function alloc()
    {
        return new self(__CLASS__);
    }
}

class Widget_Abstract_Metas extends RepositoryComponent
{
    public static function alloc()
    {
        return new self(__CLASS__);
    }
}

class RepositoryCategoryRelated
{
    public static $rows = array();

    public function toArray($columns)
    {
        return self::$rows;
    }
}

class Widget_Metas_Category_Related
{
    public static function allocWithAlias($cid, $parameters)
    {
        return new RepositoryCategoryRelated();
    }
}

class Typecho_Date
{
    public static function time()
    {
        return 5000;
    }
}

class Utils
{
}

require_once dirname(__DIR__, 2) . '/libs/Contents.php';

$failures = 0;

function repositoryAssertSame($expected, $actual, $message)
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

Typecho_Db::$componentRows = array(
    'Widget_Abstract_Contents' => array(
        7 => array('cid' => 7, 'title' => '文章 7'),
        8 => array('cid' => 8, 'title' => '上一篇'),
        9 => array('cid' => 9, 'title' => '下一篇')
    ),
    'Widget_Abstract_Comments' => array(
        3 => array('coid' => 3, 'permalink' => 'https://example.test/comment/3'),
        4 => array('coid' => 4, 'permalink' => 'https://example.test/comment/4')
    ),
    'Widget_Abstract_Metas' => array(
        11 => array('mid' => 11, 'type' => 'tag', 'name' => '标签', 'permalink' => '/tag/test'),
        12 => array('mid' => 12, 'type' => 'category', 'name' => '分类', 'permalink' => '/category/test')
    )
);

repositoryAssertSame('文章 7', Contents::getPost(7)->title, 'getPost 通过内容组件读取并 push');
repositoryAssertSame(
    'https://example.test/comment/3',
    Contents::getComment(3)->permalink,
    'getComment 通过评论组件读取并 push'
);
repositoryAssertSame('标签', Contents::getMeta(11)->name, 'getMeta 通过 Meta 组件读取并 push');

Typecho_Db::$commentRows = array(
    array('coid' => 3, 'mail' => 'a@example.test', 'author' => 'A'),
    array('coid' => 4, 'mail' => 'b@example.test', 'author' => 'B')
);
$recent = Contents::getRecentComments(2);
repositoryAssertSame(2, count($recent), '最近评论保留查询限制和行数');
repositoryAssertSame('https://example.test/comment/4', $recent[1]['permalink'], '最近评论由评论组件生成 permalink');

$archive = new stdClass();
$archive->created = 1000;
$archive->type = 'post';
Typecho_Db::$contentLookupRows = array(array('cid' => 8), array('cid' => 9), false);
repositoryAssertSame('上一篇', Contents::thePrev($archive)->title, '上一篇查询后通过文章组件返回');
repositoryAssertSame('下一篇', Contents::theNext($archive)->title, '下一篇查询后通过文章组件返回');
repositoryAssertSame(null, Contents::theNext($archive), '没有下一篇时返回 null');

Typecho_Db::$relationshipRows = array(array('mid' => 11), array('mid' => 12));
repositoryAssertSame(
    array(array('name' => '标签', 'permalink' => '/tag/test')),
    Contents::getTags(7),
    '标签查询继续通过 Meta 类型过滤'
);

RepositoryCategoryRelated::$rows = array(
    array('name' => '分类一', 'permalink' => '/category/one'),
    array('name' => '分类二', 'permalink' => '/category/two')
);
repositoryAssertSame(RepositoryCategoryRelated::$rows, Contents::getCategories(7), '分类保留 Typecho Related Widget 顺序');

$oneRowQueries = 0;
foreach (Typecho_Db::$queries as $query) {
    if ($query->owner && $query->limitValue === 1) {
        $oneRowQueries++;
    }
}
repositoryAssertSame(9, $oneRowQueries, '单对象读取全部保留 limit(1)');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} repository contract test(s) failed.\n");
    exit(1);
}

echo "All repository contract tests passed.\n";

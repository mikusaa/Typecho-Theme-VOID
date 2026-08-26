<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class HomePreviewContractTerminal extends Exception
{
    public $status;
    public $body;

    public function __construct($status, $body)
    {
        parent::__construct($body, (int) $status);
        $this->status = (int) $status;
        $this->body = (string) $body;
    }
}

class HomePreviewContractParameter
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

    public function __isset($name)
    {
        return isset($this->values[$name]);
    }
}

class HomePreviewContractRequest
{
    private $values;
    private $isGet;

    public function __construct($values, $isGet)
    {
        $this->values = $values;
        $this->isGet = $isGet;
    }

    public function get($name, $default = null)
    {
        return array_key_exists($name, $this->values) ? $this->values[$name] : $default;
    }

    public function isGet()
    {
        return $this->isGet;
    }
}

class HomePreviewContractResponse
{
    public $headers = array();
    public $status = 200;

    public function setHeader($name, $value)
    {
        $this->headers[$name] = $value;
        return $this;
    }

    public function setStatus($status)
    {
        $this->status = (int) $status;
        return $this;
    }

    public function throwContent($body)
    {
        throw new HomePreviewContractTerminal($this->status, $body);
    }
}

class HomePreviewContractArchive
{
    public $parameter;
    public $request;
    public $response;
    public $pushed = array();
    private $feed;

    public function __construct($requestValues, $options = array())
    {
        $defaults = array(
            'feed' => false,
            'isGet' => true,
            'parameterFeed' => false,
            'preview' => false,
            'type' => 'index'
        );
        $options = array_merge($defaults, $options);
        $this->parameter = new HomePreviewContractParameter(array(
            'isFeed' => $options['parameterFeed'],
            'preview' => $options['preview'],
            'type' => $options['type']
        ));
        $this->request = new HomePreviewContractRequest($requestValues, $options['isGet']);
        $this->response = new HomePreviewContractResponse();
        $this->feed = $options['feed'];
    }

    public function is($type)
    {
        return $type === 'feed' && $this->feed;
    }

    public function push($row)
    {
        $this->pushed[] = $row;
        return $row;
    }
}

class HomePreviewContractUser
{
    public $uid;
    private $editor;
    private $loggedIn;

    public function __construct($uid, $editor, $loggedIn)
    {
        $this->uid = $uid;
        $this->editor = $editor;
        $this->loggedIn = $loggedIn;
    }

    public function hasLogin()
    {
        return $this->loggedIn;
    }

    public function pass($group, $return = false)
    {
        return $group === 'editor' && $this->editor;
    }
}

class HomePreviewContractSecurity
{
    public $purposes = array();
    private $token;

    public function __construct($token)
    {
        $this->token = $token;
    }

    public function getToken($purpose)
    {
        $this->purposes[] = $purpose;
        return $this->token;
    }
}

class Typecho_Widget
{
    public static $widgets = array();

    public static function widget($name)
    {
        if (!isset(self::$widgets[$name])) {
            throw new RuntimeException('Unexpected widget: ' . $name);
        }

        return self::$widgets[$name];
    }
}

class HomePreviewContractQuery
{
    public $cid;
    public $parent;
    public $table;
    public $type;
    public $types = array();
    public $orders = array();

    public function from($table)
    {
        $this->table = $table;
        return $this;
    }

    public function where($condition, $value, $secondValue = null)
    {
        if (strpos($condition, 'cid = ?') !== false) {
            $this->cid = (int) $value;
        } elseif (strpos($condition, 'parent = ?') !== false) {
            $this->parent = (int) $value;
        } elseif (strpos($condition, 'type = ?') !== false) {
            $this->type = (string) $value;
            $this->types = array((string) $value);
            if ($secondValue !== null) {
                $this->types[] = (string) $secondValue;
            }
        }
        return $this;
    }

    public function order($column, $sort)
    {
        $this->orders[] = array((string) $column, (string) $sort);
        return $this;
    }

    public function limit($limit)
    {
        return $this;
    }
}

class HomePreviewContractDb
{
    public $fetchCount = 0;
    public $queries = array();
    public $rows = array();
    public $writeCount = 0;

    public function select()
    {
        return new HomePreviewContractQuery();
    }

    public function fetchRow($query)
    {
        ++$this->fetchCount;
        $this->queries[] = $query;
        if ($query->table !== 'table.contents') {
            throw new RuntimeException('Unexpected preview table: ' . $query->table);
        }

        if ($query->cid !== null) {
            return isset($this->rows[$query->cid]) ? $this->rows[$query->cid] : null;
        }

        $matches = array();
        foreach ($this->rows as $row) {
            if (
                isset($row['parent'], $row['type'])
                && (int) $row['parent'] === (int) $query->parent
                && in_array((string) $row['type'], $query->types, true)
            ) {
                $matches[] = $row;
            }
        }

        if (!empty($query->orders)) {
            usort($matches, function ($left, $right) use ($query) {
                foreach ($query->orders as $order) {
                    $column = substr((string) $order[0], strrpos((string) $order[0], '.') + 1);
                    $leftValue = isset($left[$column]) ? $left[$column] : 0;
                    $rightValue = isset($right[$column]) ? $right[$column] : 0;

                    if ($leftValue == $rightValue) {
                        continue;
                    }

                    $comparison = $leftValue < $rightValue ? -1 : 1;
                    return $order[1] === Typecho_Db::SORT_DESC ? -$comparison : $comparison;
                }

                return 0;
            });
        }

        return empty($matches) ? null : $matches[0];
    }

    public function query($query)
    {
        ++$this->writeCount;
        throw new RuntimeException('Home preview must not write to the database');
    }
}

class Typecho_Db
{
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

    public static function url($path, $prefix)
    {
        return rtrim($prefix, '/') . '/' . ltrim($path, '/');
    }
}

class HomePreviewContractOptions
{
    public $adminUrl = 'https://example.test/control/';
    public $frontPage = 'recent';
    public $index = 'https://example.test/index.php';
    public $time = 1700000000;
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
    public static $pjax = false;

    public static function isPjax()
    {
        return self::$pjax;
    }
}

class VOID_WordCount
{
    public static function calculate($text)
    {
        return strlen($text);
    }
}

require_once dirname(__DIR__, 2) . '/libs/HomePreview.php';

$failures = 0;

function homePreviewAssertSame($expected, $actual, $message)
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

function homePreviewAssertContains($needle, $haystack, $message)
{
    homePreviewAssertSame(true, strpos($haystack, $needle) !== false, $message);
}

function homePreviewRows()
{
    return array(
        101 => array(
            'cid' => 101,
            'authorId' => 7,
            'created' => 0,
            'parent' => 0,
            'slug' => 'new-draft',
            'status' => 'publish',
            'text' => 'draft text',
            'type' => 'post_draft'
        ),
        200 => array(
            'cid' => 200,
            'authorId' => 7,
            'created' => 1600000000,
            'parent' => 0,
            'slug' => 'canonical',
            'status' => 'hidden',
            'text' => 'canonical text',
            'type' => 'post'
        ),
        201 => array(
            'cid' => 201,
            'authorId' => 7,
            'created' => 1600000100,
            'parent' => 200,
            'slug' => '@canonical-revision',
            'status' => 'private',
            'text' => 'revision text',
            'type' => 'revision'
        ),
        202 => array(
            'cid' => 202,
            'authorId' => 7,
            'created' => 1600000200,
            'parent' => 0,
            'slug' => 'waiting',
            'status' => 'waiting',
            'text' => 'waiting text',
            'type' => 'post'
        ),
        300 => array(
            'cid' => 300,
            'authorId' => 9,
            'created' => 1600000300,
            'parent' => 0,
            'slug' => 'other-author',
            'status' => 'private',
            'text' => 'other text',
            'type' => 'post'
        ),
        400 => array(
            'cid' => 400,
            'authorId' => 7,
            'created' => 1600000400,
            'parent' => 0,
            'slug' => 'page',
            'status' => 'hidden',
            'text' => 'page text',
            'type' => 'page'
        ),
        500 => array(
            'cid' => 500,
            'authorId' => 7,
            'created' => 1600000500,
            'parent' => 999,
            'slug' => '@orphan',
            'status' => 'publish',
            'text' => 'orphan text',
            'type' => 'revision'
        ),
        501 => array(
            'cid' => 501,
            'authorId' => 7,
            'created' => 1600000600,
            'parent' => 999,
            'slug' => 'invalid-draft-parent',
            'status' => 'publish',
            'text' => 'invalid draft',
            'type' => 'post_draft'
        ),
        600 => array(
            'cid' => 600,
            'authorId' => 7,
            'created' => 1600000700,
            'parent' => 0,
            'slug' => 'invalid-status',
            'status' => 'draft',
            'text' => 'invalid status',
            'type' => 'post'
        ),
        601 => array(
            'cid' => 601,
            'authorId' => 7,
            'created' => 1600000800,
            'parent' => 200,
            'slug' => 'invalid-parent',
            'status' => 'hidden',
            'text' => 'invalid parent',
            'type' => 'post'
        ),
        700 => array(
            'cid' => 700,
            'authorId' => 7,
            'created' => 1600000900,
            'parent' => 0,
            'slug' => 'invalid-revision-status-parent',
            'status' => 'hidden',
            'text' => 'canonical text',
            'type' => 'post'
        ),
        701 => array(
            'cid' => 701,
            'authorId' => 7,
            'created' => 1600001000,
            'parent' => 700,
            'slug' => '@invalid-revision-status',
            'status' => 'draft',
            'text' => 'invalid revision',
            'type' => 'revision'
        ),
        800 => array(
            'cid' => 800,
            'authorId' => 7,
            'created' => 1600001100,
            'parent' => 0,
            'slug' => 'cross-author-revision-parent',
            'status' => 'hidden',
            'text' => 'owned canonical text',
            'type' => 'post'
        ),
        801 => array(
            'cid' => 801,
            'authorId' => 9,
            'created' => 1600001200,
            'parent' => 800,
            'slug' => '@cross-author-revision',
            'status' => 'hidden',
            'text' => 'other author revision',
            'type' => 'revision'
        ),
        900 => array(
            'cid' => 900,
            'authorId' => 7,
            'created' => 1600001300,
            'parent' => 0,
            'slug' => 'legacy-parent',
            'status' => 'hidden',
            'text' => 'legacy canonical text',
            'type' => 'post'
        ),
        901 => array(
            'cid' => 901,
            'authorId' => 7,
            'created' => 1600001400,
            'parent' => 900,
            'slug' => 'legacy-draft',
            'status' => 'hidden',
            'text' => 'legacy saved draft text',
            'type' => 'post_draft'
        ),
        1000 => array(
            'cid' => 1000,
            'authorId' => 7,
            'created' => 1600001500,
            'modified' => 1600001500,
            'parent' => 0,
            'slug' => 'duplicate-child-parent',
            'status' => 'hidden',
            'text' => 'duplicate child canonical text',
            'type' => 'post'
        ),
        1001 => array(
            'cid' => 1001,
            'authorId' => 7,
            'created' => 1600001510,
            'modified' => 1600001510,
            'parent' => 1000,
            'slug' => '@older-duplicate-child',
            'status' => 'hidden',
            'text' => 'older duplicate child',
            'type' => 'revision'
        ),
        1002 => array(
            'cid' => 1002,
            'authorId' => 7,
            'created' => 1600001520,
            'modified' => 1600001520,
            'parent' => 1000,
            'slug' => 'newer-legacy-duplicate-child',
            'status' => 'hidden',
            'text' => 'newer legacy duplicate child',
            'type' => 'post_draft'
        ),
        1003 => array(
            'cid' => 1003,
            'authorId' => 7,
            'created' => 1600001520,
            'modified' => 1600001520,
            'parent' => 1000,
            'slug' => '@newest-duplicate-child',
            'status' => 'hidden',
            'text' => 'newest duplicate child',
            'type' => 'revision'
        )
    );
}

function homePreviewReset($user = null, $token = 'valid-token')
{
    $db = new HomePreviewContractDb();
    $db->rows = homePreviewRows();
    Typecho_Db::$instance = $db;
    Helper::$options = new HomePreviewContractOptions();
    Typecho_Widget::$widgets = array(
        'Widget_User' => $user ?: new HomePreviewContractUser(7, false, true),
        'Widget_Security' => new HomePreviewContractSecurity($token)
    );
    Utils::$pjax = false;
    return $db;
}

function homePreviewRequest($cid, $extra = array(), $options = array())
{
    $values = array_merge(array(
        'void_home_preview' => (string) $cid,
        '_' => 'valid-token'
    ), $extra);
    return new HomePreviewContractArchive($values, $options);
}

function homePreviewRun($archive)
{
    try {
        return array('result' => HomePreview::handle($archive), 'terminal' => null);
    } catch (HomePreviewContractTerminal $terminal) {
        return array('result' => null, 'terminal' => $terminal);
    }
}

function homePreviewAssertPrivateHeaders($archive, $message)
{
    homePreviewAssertSame(
        'private, no-store, max-age=0',
        isset($archive->response->headers['Cache-Control'])
            ? $archive->response->headers['Cache-Control'] : null,
        $message . ' 禁止缓存'
    );
    homePreviewAssertSame(
        'no-cache',
        isset($archive->response->headers['Pragma'])
            ? $archive->response->headers['Pragma'] : null,
        $message . ' 禁止兼容缓存'
    );
    homePreviewAssertSame(
        '0',
        isset($archive->response->headers['Expires'])
            ? $archive->response->headers['Expires'] : null,
        $message . ' 立即过期'
    );
    homePreviewAssertSame(
        'noindex, nofollow, noarchive',
        isset($archive->response->headers['X-Robots-Tag'])
            ? $archive->response->headers['X-Robots-Tag'] : null,
        $message . ' 禁止索引'
    );
    homePreviewAssertSame(
        'no-referrer',
        isset($archive->response->headers['Referrer-Policy'])
            ? $archive->response->headers['Referrer-Policy'] : null,
        $message . ' 不发送来源 URL'
    );
}

$db = homePreviewReset();
$plainIndex = new HomePreviewContractArchive(array());
$plainResult = homePreviewRun($plainIndex);
homePreviewAssertSame(false, $plainResult['result'], '普通首页请求不启用预览');
homePreviewAssertSame(0, $db->fetchCount, '普通首页请求不查询预览内容');
homePreviewAssertSame(array(), $plainIndex->response->headers, '普通首页响应头保持原状');

homePreviewReset();
$corePreview = new HomePreviewContractArchive(array(), array('preview' => true, 'type' => 'single'));
$coreResult = homePreviewRun($corePreview);
homePreviewAssertSame(false, $coreResult['result'], 'Typecho 原生文章预览不注入首页卡片');
homePreviewAssertPrivateHeaders($corePreview, 'Typecho 原生文章预览');

$db = homePreviewReset();
$draftArchive = homePreviewRequest(101);
$draftResult = homePreviewRun($draftArchive);
homePreviewAssertSame(true, $draftResult['result'], '作者可以预览新文章草稿');
homePreviewAssertSame(1, count($draftArchive->pushed), '草稿只注入一张首页卡片');
$draftRow = $draftArchive->pushed[0];
homePreviewAssertSame(101, $draftRow['cid'], '草稿卡保留精确 source cid');
homePreviewAssertSame('post', $draftRow['type'], 'post_draft 合成为首页文章语义');
homePreviewAssertSame(true, $draftRow['voidHomePreview'], '草稿卡带服务端预览标记');
homePreviewAssertSame(0, $draftRow['voidHomePreviewReplacementCid'], '新草稿不替换现有卡片');
homePreviewAssertSame(
    'https://example.test/control/preview.php?cid=101',
    $draftRow['#permalink'],
    '草稿卡链接使用实际后台目录和精确 source cid'
);
homePreviewAssertSame(
    'https://example.test/control/preview.php?cid=101',
    $draftRow['voidHomePreviewUrl'],
    '草稿卡保留不受内容 filter 覆盖的预览链接'
);
homePreviewAssertSame(strlen('draft text'), $draftRow['wordCount'], '草稿卡即时计算保存内容字数');
homePreviewAssertSame(1700000000, $draftRow['created'], 'created=0 的草稿只在内存中使用站点当前时间');
homePreviewAssertPrivateHeaders($draftArchive, '首页草稿预览');
homePreviewAssertSame(0, $db->writeCount, '草稿预览不写数据库');

$db = homePreviewReset();
$revisionArchive = homePreviewRequest(200);
$revisionResult = homePreviewRun($revisionArchive);
homePreviewAssertSame(true, $revisionResult['result'], 'canonical cid 自动解析当前 revision');
$revisionRow = $revisionArchive->pushed[0];
homePreviewAssertSame(201, $revisionRow['cid'], '解析后的 revision 保留 source cid 以读取草稿字段');
homePreviewAssertSame('canonical-revision', $revisionRow['slug'], 'revision 卡移除内部 slug 前缀');
homePreviewAssertSame(200, $revisionRow['voidHomePreviewReplacementCid'], 'revision 卡替换父文章普通卡');
homePreviewAssertSame('private', $revisionRow['status'], 'revision 保存状态保持不变');
homePreviewAssertSame(2, $db->fetchCount, 'revision 额外验证父 post 关系');
homePreviewAssertSame(0, $db->writeCount, 'revision 预览不写数据库');

$db = homePreviewReset();
$legacyRevisionArchive = homePreviewRequest(900);
$legacyRevisionResult = homePreviewRun($legacyRevisionArchive);
homePreviewAssertSame(true, $legacyRevisionResult['result'], 'canonical cid 自动解析遗留 post_draft 快照');
$legacyRevisionRow = $legacyRevisionArchive->pushed[0];
homePreviewAssertSame(901, $legacyRevisionRow['cid'], '遗留快照保留精确 source cid');
homePreviewAssertSame('post', $legacyRevisionRow['type'], '遗留 post_draft 快照合成为首页文章语义');
homePreviewAssertSame(900, $legacyRevisionRow['voidHomePreviewReplacementCid'], '遗留快照替换父文章普通卡');
homePreviewAssertSame(
    'https://example.test/control/preview.php?cid=901',
    $legacyRevisionRow['voidHomePreviewUrl'],
    '遗留快照卡点击进入精确后台预览'
);
homePreviewAssertSame(2, $db->fetchCount, '遗留快照与 revision 共用一次子查询');
homePreviewAssertSame(0, $db->writeCount, '遗留快照预览不写数据库');

$db = homePreviewReset();
$duplicateChildArchive = homePreviewRequest(1000);
$duplicateChildResult = homePreviewRun($duplicateChildArchive);
homePreviewAssertSame(true, $duplicateChildResult['result'], '异常重复快照仍可稳定预览');
homePreviewAssertSame(1003, $duplicateChildArchive->pushed[0]['cid'], '重复快照选择 modified 最新且 cid 最大的行');
homePreviewAssertSame(
    array(
        array('table.contents.modified', Typecho_Db::SORT_DESC),
        array('table.contents.cid', Typecho_Db::SORT_DESC)
    ),
    $db->queries[1]->orders,
    '快照查询按 modified 和 cid 倒序稳定排序'
);
homePreviewAssertSame(0, $db->writeCount, '重复快照选择不写数据库');

$db = homePreviewReset();
$canonicalArchive = homePreviewRequest(202);
$canonicalResult = homePreviewRun($canonicalArchive);
homePreviewAssertSame(true, $canonicalResult['result'], '无 revision 时使用 canonical 文章');
$canonicalRow = $canonicalArchive->pushed[0];
homePreviewAssertSame(202, $canonicalRow['cid'], 'canonical source cid 保持不变');
homePreviewAssertSame(202, $canonicalRow['voidHomePreviewReplacementCid'], 'canonical 卡替换自身普通卡');
homePreviewAssertSame('waiting', $canonicalRow['status'], 'canonical 保存状态只读保留');
homePreviewAssertSame(2, $db->fetchCount, 'canonical 解析确认不存在当前 revision');
homePreviewAssertSame(0, $db->writeCount, 'canonical 预览不写数据库');

$editorDb = homePreviewReset(new HomePreviewContractUser(7, true, true));
$editorArchive = homePreviewRequest(300);
$editorResult = homePreviewRun($editorArchive);
homePreviewAssertSame(true, $editorResult['result'], 'editor 可以预览其他作者的已保存文章');
homePreviewAssertSame(0, $editorDb->writeCount, 'editor 预览不写数据库');

$unauthorizedDb = homePreviewReset(new HomePreviewContractUser(7, false, true));
$unauthorizedArchive = homePreviewRequest(300);
$unauthorizedResult = homePreviewRun($unauthorizedArchive);
homePreviewAssertSame(403, $unauthorizedResult['terminal']->status, '非 editor 不能预览其他作者文章');
homePreviewAssertSame(0, count($unauthorizedArchive->pushed), '越权请求不注入内容');
homePreviewAssertSame(1, $unauthorizedDb->fetchCount, '越权检查只读取指定 source');
homePreviewAssertPrivateHeaders($unauthorizedArchive, '越权首页预览');

$crossAuthorRevisionDb = homePreviewReset(new HomePreviewContractUser(7, false, true));
$crossAuthorRevisionArchive = homePreviewRequest(800);
$crossAuthorRevisionResult = homePreviewRun($crossAuthorRevisionArchive);
homePreviewAssertSame(
    403,
    $crossAuthorRevisionResult['terminal']->status,
    '非 editor 同时拥有 canonical 与最终 revision 才能预览'
);
homePreviewAssertSame(0, count($crossAuthorRevisionArchive->pushed), '跨作者 revision 不注入内容');
homePreviewAssertSame(2, $crossAuthorRevisionDb->fetchCount, '跨作者 revision 在父子关系解析后拒绝');
homePreviewAssertSame(0, $crossAuthorRevisionDb->writeCount, '跨作者 revision 拒绝流程不写数据库');
homePreviewAssertPrivateHeaders($crossAuthorRevisionArchive, '跨作者 revision 首页预览');

$loggedOutDb = homePreviewReset(new HomePreviewContractUser(0, false, false));
$loggedOutArchive = homePreviewRequest(101);
$loggedOutResult = homePreviewRun($loggedOutArchive);
homePreviewAssertSame(403, $loggedOutResult['terminal']->status, '未登录请求失败关闭');
homePreviewAssertSame(0, $loggedOutDb->fetchCount, '未登录请求不查询内容');

$invalidTokenDb = homePreviewReset();
$invalidTokenArchive = homePreviewRequest(101, array('_' => 'forged-token'));
$invalidTokenResult = homePreviewRun($invalidTokenArchive);
homePreviewAssertSame(403, $invalidTokenResult['terminal']->status, '伪造 token 请求失败关闭');
homePreviewAssertSame(0, $invalidTokenDb->fetchCount, 'token 校验先于内容查询');

$invalidCidDb = homePreviewReset();
$invalidCidArchive = homePreviewRequest('101abc');
$invalidCidResult = homePreviewRun($invalidCidArchive);
homePreviewAssertSame(403, $invalidCidResult['terminal']->status, '非严格正整数 cid 请求失败关闭');
homePreviewAssertSame(0, $invalidCidDb->fetchCount, '非法 cid 不触发内容查询');

foreach (array(
    999 => '已删除 source 不回退其他版本',
    400 => '静态页面不能注入文章首页',
    500 => '前端不能直接使用 revision cid',
    501 => '带父级的 post_draft 不能注入首页',
    600 => '异常 status 不能注入首页',
    601 => '带父级的 canonical post 不能注入首页',
    700 => '异常 status 的 revision 不能注入首页'
) as $cid => $message) {
    $db = homePreviewReset();
    $archive = homePreviewRequest($cid);
    $result = homePreviewRun($archive);
    homePreviewAssertSame(404, $result['terminal']->status, $message);
    homePreviewAssertSame(0, count($archive->pushed), $message . ' 且不注入卡片');
    homePreviewAssertSame(0, $db->writeCount, $message . ' 且不写数据库');
}

$requestGuards = array(
    array(array('isGet' => false), array(), '非 GET 请求'),
    array(array('type' => 'index_page'), array(), '分页路由'),
    array(array('type' => 'page'), array(), '静态首页路由'),
    array(array('feed' => true), array(), 'Feed 请求'),
    array(array('parameterFeed' => true), array(), '参数标记的 Feed 请求'),
    array(array(), array('page' => '2'), '第二页查询')
);
foreach ($requestGuards as $guard) {
    $db = homePreviewReset();
    $archive = homePreviewRequest(101, $guard[1], $guard[0]);
    $result = homePreviewRun($archive);
    homePreviewAssertSame(403, $result['terminal']->status, $guard[2] . ' 不允许首页预览');
    homePreviewAssertSame(0, $db->fetchCount, $guard[2] . ' 不查询 source');
    homePreviewAssertPrivateHeaders($archive, $guard[2]);
}

$pjaxDb = homePreviewReset();
Utils::$pjax = true;
$pjaxArchive = homePreviewRequest(101);
$pjaxResult = homePreviewRun($pjaxArchive);
homePreviewAssertSame(403, $pjaxResult['terminal']->status, 'PJAX 请求不允许首页预览');
homePreviewAssertSame(0, $pjaxDb->fetchCount, 'PJAX 请求不查询 source');
homePreviewAssertPrivateHeaders($pjaxArchive, 'PJAX 首页预览');

homePreviewReset();
Helper::$options->index = 'https://example.test/index.php?lang=zh#top';
$_SERVER['SCRIPT_NAME'] = '/control/write-post.php';
$editorConfig = HomePreview::getEditorConfig();
homePreviewAssertSame(
    'https://example.test/index.php?lang=zh&void_home_preview={cid}&_=valid-token#top',
    $editorConfig['urlTemplate'],
    '文章编辑器 URL 模板兼容非重写入口、已有 query 和 fragment'
);
homePreviewAssertSame(
    array('void-home-preview'),
    Typecho_Widget::$widgets['Widget_Security']->purposes,
    '编辑器与前台使用固定用途登录 token'
);

$_SERVER['SCRIPT_NAME'] = '/control/write-page.php';
homePreviewAssertSame(null, HomePreview::getEditorConfig(), '静态页面编辑器不下发首页预览配置');

$_SERVER['SCRIPT_NAME'] = '/control/write-post.php';
$tokenPurposeCount = count(Typecho_Widget::$widgets['Widget_Security']->purposes);
Helper::$options->frontPage = 'page:12';
homePreviewAssertSame(null, HomePreview::getEditorConfig(), '静态页面首页不下发文章卡预览配置');
Helper::$options->frontPage = 'file:landing.php';
homePreviewAssertSame(null, HomePreview::getEditorConfig(), '自定义文件首页不下发无法注入的预览配置');
homePreviewAssertSame(
    $tokenPurposeCount,
    count(Typecho_Widget::$widgets['Widget_Security']->purposes),
    '自定义首页不生成无效预览 token'
);

$root = dirname(__DIR__, 2);
$functionsSource = file_get_contents($root . '/functions.php');
$utilsSource = file_get_contents($root . '/libs/Utils.php');
$indexSource = file_get_contents($root . '/index.php');
$homePreviewSource = file_get_contents($root . '/libs/HomePreview.php');
homePreviewAssertContains("require_once('libs/HomePreview.php')", $functionsSource, '主题加载首页预览模块');
homePreviewAssertContains('HomePreview::handle($archive);', $functionsSource, 'themeInit 接入首页预览生命周期');
homePreviewAssertContains('window.VOIDHomePreviewConfig=', $utilsSource, '文章编辑器安全序列化预览配置');
homePreviewAssertContains(
    "version_compare((string) Typecho_Common::VERSION, '1.3.0', '>=')",
    $homePreviewSource,
    '真实首页预览以 Typecho 1.3+ 为运行门槛'
);
homePreviewAssertContains(
    "return self::fail(\$archive, 404, '首页预览不可用。');",
    $homePreviewSource,
    '不支持的 Typecho 版本不会回落到普通首页'
);
homePreviewAssertSame(
    3,
    substr_count($indexSource, '<a<?php echo $postNoPjax; ?>'),
    '预览卡所有文章链接均绕过 PJAX'
);
homePreviewAssertContains('$voidHomePreviewReplacementCid', $indexSource, '首页模板按服务端 replacement cid 去重');
homePreviewAssertContains('$this->voidHomePreviewUrl', $indexSource, '预览卡使用不受内容 filter 覆盖的独立链接');
homePreviewAssertContains('continue;', $indexSource, '重复父文章或 canonical 卡在渲染前跳过');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} home preview contract test(s) failed.\n");
    exit(1);
}

echo "All home preview contract tests passed.\n";

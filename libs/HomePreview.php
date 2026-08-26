<?php
/**
 * 真实首页预览
 *
 * 仅把已经保存的文章快照注入当前首页请求，不写入或修改任何内容。
 */
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class HomePreview
{
    const QUERY_NAME = 'void_home_preview';
    const TOKEN_PURPOSE = 'void-home-preview';
    const ROW_MARKER = 'voidHomePreview';
    const ROW_REPLACEMENT_CID = 'voidHomePreviewReplacementCid';
    const ROW_PREVIEW_URL = 'voidHomePreviewUrl';

    /**
     * 接入 Archive 生命周期。
     *
     * @return bool 是否注入了首页预览行
     */
    public static function handle($archive)
    {
        if (!is_object($archive)) {
            return false;
        }

        $request = $archive->request;
        $sourceValue = $request->get(self::QUERY_NAME);
        if (!self::isSupportedTypecho()) {
            if ($sourceValue === null || $sourceValue === '') {
                return false;
            }

            self::setPrivatePreviewHeaders($archive);
            return self::fail($archive, 404, '首页预览不可用。');
        }

        if (self::isCoreContentPreview($archive)) {
            self::setPrivatePreviewHeaders($archive);
        }

        if ($sourceValue === null || $sourceValue === '') {
            return false;
        }

        self::setPrivatePreviewHeaders($archive);

        if (!self::isSupportedHomeRequest($archive, $request)) {
            return self::fail($archive, 403, '无权访问首页预览。');
        }

        $sourceCid = self::parsePositiveInteger($sourceValue);
        if ($sourceCid === null) {
            return self::fail($archive, 403, '无权访问首页预览。');
        }

        $user = Typecho_Widget::widget('Widget_User');
        if (!$user->hasLogin()) {
            return self::fail($archive, 403, '无权访问首页预览。');
        }

        $security = Typecho_Widget::widget('Widget_Security');
        $providedToken = $request->get('_');
        $expectedToken = $security->getToken(self::TOKEN_PURPOSE);
        if (
            !is_string($providedToken)
            || !is_string($expectedToken)
            || !hash_equals($expectedToken, $providedToken)
        ) {
            return self::fail($archive, 403, '无权访问首页预览。');
        }

        $db = Typecho_Db::get();
        $canonical = self::findContent($db, $sourceCid);
        if (!is_array($canonical)) {
            return self::fail($archive, 404, '首页预览内容不存在。');
        }

        $canonicalType = isset($canonical['type']) ? (string) $canonical['type'] : '';
        $replacementCid = 0;

        if ($canonicalType === 'post_draft') {
            if (!empty($canonical['parent']) || !self::hasPreviewableStatus($canonical)) {
                return self::fail($archive, 404, '首页预览内容不存在。');
            }

            $source = $canonical;
        } elseif ($canonicalType === 'post') {
            if (!empty($canonical['parent']) || !self::hasPreviewableStatus($canonical)) {
                return self::fail($archive, 404, '首页预览内容不存在。');
            }

            if (!self::canAccessContent($user, $canonical)) {
                return self::fail($archive, 403, '无权访问首页预览。');
            }

            $replacementCid = $sourceCid;
            $revision = self::findRevision($db, $sourceCid);
            if (is_array($revision)) {
                $revisionType = isset($revision['type']) ? (string) $revision['type'] : '';
                if (
                    !in_array($revisionType, array('revision', 'post_draft'), true)
                    || !isset($revision['parent'])
                    || (int) $revision['parent'] !== $sourceCid
                    || !self::hasPreviewableStatus($revision)
                ) {
                    return self::fail($archive, 404, '首页预览内容不存在。');
                }

                $source = $revision;
                if (isset($source['slug'])) {
                    $source['slug'] = ltrim((string) $source['slug'], '@');
                }
            } else {
                $source = $canonical;
            }
        } else {
            return self::fail($archive, 404, '首页预览内容不存在。');
        }

        if (!self::canAccessContent($user, $source)) {
            return self::fail($archive, 403, '无权访问首页预览。');
        }

        $resolvedSourceCid = (int) $source['cid'];
        $previewUrl = self::buildAdminPreviewUrl($resolvedSourceCid);
        $source['type'] = 'post';
        $source['#permalink'] = $previewUrl;
        $source['#url'] = $previewUrl;
        $source[self::ROW_MARKER] = true;
        $source[self::ROW_REPLACEMENT_CID] = $replacementCid;
        $source[self::ROW_PREVIEW_URL] = $previewUrl;

        if (!isset($source['created']) || (int) $source['created'] <= 0) {
            $previewTime = (int) Helper::options()->time;
            $source['created'] = $previewTime > 0 ? $previewTime : time();
        }

        if (class_exists('VOID_WordCount') && method_exists('VOID_WordCount', 'calculate')) {
            $source['wordCount'] = (int) VOID_WordCount::calculate(
                isset($source['text']) ? (string) $source['text'] : ''
            );
        }

        $archive->push($source);
        return true;
    }

    /**
     * 生成后台脚本使用的首页预览 URL 模板。
     */
    public static function getEditorUrlTemplate()
    {
        $options = Helper::options();
        $security = Typecho_Widget::widget('Widget_Security');
        $token = $security->getToken(self::TOKEN_PURPOSE);
        $indexUrl = (string) $options->index;

        $fragment = '';
        $fragmentPosition = strpos($indexUrl, '#');
        if ($fragmentPosition !== false) {
            $fragment = substr($indexUrl, $fragmentPosition);
            $indexUrl = substr($indexUrl, 0, $fragmentPosition);
        }

        if (strpos($indexUrl, '?') === false) {
            $separator = '?';
        } else {
            $lastCharacter = substr($indexUrl, -1);
            $separator = $lastCharacter === '?' || $lastCharacter === '&' ? '' : '&';
        }

        return $indexUrl . $separator
            . self::QUERY_NAME . '={cid}&_=' . rawurlencode($token)
            . $fragment;
    }

    /**
     * 仅在文章列表首页的文章编辑器下发前端配置。
     */
    public static function getEditorConfig()
    {
        $scriptName = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '';
        if ($scriptName === '' && isset($_SERVER['PHP_SELF'])) {
            $scriptName = $_SERVER['PHP_SELF'];
        }

        if (basename((string) $scriptName) !== 'write-post.php') {
            return null;
        }

        if (!self::isSupportedTypecho()) {
            return null;
        }

        $frontPage = (string) Helper::options()->frontPage;
        if (strpos($frontPage, 'page:') === 0 || strpos($frontPage, 'file:') === 0) {
            return null;
        }

        return array('urlTemplate' => self::getEditorUrlTemplate());
    }

    private static function isSupportedTypecho()
    {
        return defined('Typecho_Common::VERSION')
            && version_compare((string) Typecho_Common::VERSION, '1.3.0', '>=');
    }

    private static function isSupportedHomeRequest($archive, $request)
    {
        if (!$request->isGet() || Utils::isPjax()) {
            return false;
        }

        $parameter = $archive->parameter;
        if (!is_object($parameter) || (string) $parameter->type !== 'index') {
            return false;
        }

        if (!empty($parameter->isFeed)) {
            return false;
        }

        if (method_exists($archive, 'is') && $archive->is('feed')) {
            return false;
        }

        $page = $request->get('page', 1);
        return $page === 1 || $page === '1';
    }

    private static function isCoreContentPreview($archive)
    {
        $parameter = $archive->parameter;
        return is_object($parameter) && !empty($parameter->preview);
    }

    private static function parsePositiveInteger($value)
    {
        if (!is_int($value) && !is_string($value)) {
            return null;
        }

        $value = (string) $value;
        if (!preg_match('/^[1-9][0-9]*$/D', $value)) {
            return null;
        }

        $integer = filter_var($value, FILTER_VALIDATE_INT, array(
            'options' => array('min_range' => 1)
        ));

        return $integer === false ? null : (int) $integer;
    }

    private static function findContent($db, $cid)
    {
        return $db->fetchRow($db->select()
            ->from('table.contents')
            ->where('table.contents.cid = ?', (int) $cid)
            ->limit(1));
    }

    private static function findRevision($db, $canonicalCid)
    {
        return $db->fetchRow($db->select()
            ->from('table.contents')
            ->where('table.contents.parent = ?', (int) $canonicalCid)
            ->where(
                'table.contents.type = ? OR table.contents.type = ?',
                'revision',
                'post_draft'
            )
            ->order('table.contents.modified', Typecho_Db::SORT_DESC)
            ->order('table.contents.cid', Typecho_Db::SORT_DESC)
            ->limit(1));
    }

    private static function hasPreviewableStatus($content)
    {
        $status = isset($content['status']) ? (string) $content['status'] : '';
        return in_array($status, array('publish', 'hidden', 'private', 'waiting'), true);
    }

    private static function canAccessContent($user, $content)
    {
        if ($user->pass('editor', true)) {
            return true;
        }

        return isset($content['authorId'])
            && (int) $content['authorId'] > 0
            && (int) $content['authorId'] === (int) $user->uid;
    }

    private static function buildAdminPreviewUrl($sourceCid)
    {
        $path = 'preview.php?' . http_build_query(array('cid' => (int) $sourceCid));
        return Typecho_Common::url($path, Helper::options()->adminUrl);
    }

    private static function setPrivatePreviewHeaders($archive)
    {
        $response = $archive->response;
        $response->setHeader('Cache-Control', 'private, no-store, max-age=0');
        $response->setHeader('Pragma', 'no-cache');
        $response->setHeader('Expires', '0');
        $response->setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
        $response->setHeader('Referrer-Policy', 'no-referrer');
    }

    private static function fail($archive, $status, $message)
    {
        $archive->response->setStatus((int) $status)->throwContent((string) $message);
        return false;
    }
}

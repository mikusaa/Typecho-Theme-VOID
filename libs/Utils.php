<?php
/**
 * Utils.php
 * 
 * 工具类
 * 
 * @author      熊猫小A
 * @version     2019-01-15 0.01
 */

class Utils
{
    /**
     * 捕获 Typecho 输出方法的结果，并保留其插件钩子
     *
     * @return string
     */
    public static function captureOutput($target, $method, $arguments = array())
    {
        ob_start();
        try {
            call_user_func_array(array($target, $method), $arguments);
            return ob_get_clean();
        } catch (Throwable $throwable) {
            ob_end_clean();
            throw $throwable;
        }
    }

    /**
     * 将 Typecho 已编码的标题等值还原为语义纯文本
     *
     * @return string
     */
    public static function decodeHtmlText($value)
    {
        return html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * 还原已编码的 HTML 实体，不改变 URL 等结构化值
     *
     * @return string
     */
    public static function decodeHtmlEntities($value)
    {
        return html_entity_decode((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * 编码 HTML 文本或双引号属性值
     *
     * @return string
     */
    public static function escapeHtml($value)
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /**
     * 将评论提示语格式化为仅含换行、加粗和安全链接的 HTML
     *
     * @return string
     */
    public static function formatCommentNotification($value)
    {
        if (!is_scalar($value)) {
            return '';
        }

        $source = (string) $value;
        $parts = preg_split(
            '/(<(?:[^>"\']|"[^"]*"|\'[^\']*\')*>)/',
            $source,
            -1,
            PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY
        );

        if (false === $parts) {
            return self::formatCommentNotificationText($source);
        }

        $output = '';
        $stack = array();
        foreach ($parts as $part) {
            if (!preg_match('/^<(\/?)([a-z][a-z0-9]*)(.*?)>$/is', $part, $matches)) {
                $output .= self::formatCommentNotificationText($part);
                continue;
            }

            $closing = $matches[1] === '/';
            $tag = strtolower($matches[2]);
            $attributes = $matches[3];
            if (!in_array($tag, array('a', 'b', 'br', 'strong'), true)) {
                continue;
            }

            if ($closing) {
                $last = count($stack) - 1;
                if ($last < 0 || $stack[$last]['source'] !== $tag) {
                    continue;
                }

                $entry = array_pop($stack);
                if ($entry['output'] !== '') {
                    $output .= '</' . $entry['output'] . '>';
                }
                continue;
            }

            if ($tag === 'br') {
                $output .= '<br>';
                continue;
            }

            if ($tag === 'strong' || $tag === 'b') {
                $output .= '<strong>';
                $stack[] = array('source' => $tag, 'output' => 'strong');
                continue;
            }

            $link = self::formatCommentNotificationLink($attributes);
            $hasOpenLink = false;
            foreach ($stack as $entry) {
                if ($entry['source'] === 'a') {
                    $hasOpenLink = true;
                    break;
                }
            }

            if ($link !== '' && !$hasOpenLink) {
                $output .= $link;
                $stack[] = array('source' => 'a', 'output' => 'a');
            } else {
                $stack[] = array('source' => 'a', 'output' => '');
            }
        }

        while (!empty($stack)) {
            $entry = array_pop($stack);
            if ($entry['output'] !== '') {
                $output .= '</' . $entry['output'] . '>';
            }
        }

        return $output;
    }

    private static function formatCommentNotificationText($value)
    {
        $text = html_entity_decode((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return nl2br(self::escapeHtml($text), false);
    }

    private static function formatCommentNotificationLink($source)
    {
        $attributes = array();
        if (preg_match_all(
            '/(?:^|\s+)([a-z][a-z0-9:-]*)\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s"\'=<>\x60]+))/i',
            (string) $source,
            $matches,
            PREG_SET_ORDER
        )) {
            foreach ($matches as $match) {
                $name = strtolower($match[1]);
                if (array_key_exists($name, $attributes)) {
                    continue;
                }

                if (isset($match[2]) && $match[2] !== '') {
                    $attributes[$name] = $match[2];
                } elseif (isset($match[3]) && $match[3] !== '') {
                    $attributes[$name] = $match[3];
                } else {
                    $attributes[$name] = isset($match[4]) ? $match[4] : '';
                }
            }
        }

        if (!array_key_exists('href', $attributes)) {
            return '';
        }

        $url = self::getSafeHttpUrl($attributes['href']);
        if (null === $url) {
            return '';
        }

        $output = '<a href="' . self::escapeHtml($url) . '"';
        if (isset($attributes['target'])) {
            $target = strtolower(trim(html_entity_decode(
                $attributes['target'],
                ENT_QUOTES | ENT_HTML5,
                'UTF-8'
            )));
            if ($target === '_blank') {
                $output .= ' target="_blank" rel="noopener noreferrer"';
            } elseif ($target === '_self') {
                $output .= ' target="_self"';
            }
        }

        return $output . '>';
    }

    /**
     * 将结构化数据安全嵌入 HTML script 元素
     *
     * @return string
     */
    public static function encodeJsonForHtml($value, $fallback = 'null')
    {
        $json = json_encode(
            $value,
            JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
            | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR
        );

        return false === $json ? $fallback : $json;
    }

    /**
     * 输出相对首页路由，本方法会自适应伪静态
     * 
     * @return void
     */
    public static function index($path)
    {
        Helper::options()->index($path);
    }

    /**
     * 输出相对首页路径，本方法不处理伪静态，用于静态文件
     * 
     * @return void
     */
    public static function indexHome($path)
    {
        Helper::options()->siteUrl($path);
    }

    /**
     * 输出相对主题目录路径，用于静态文件
     * 
     * @return void
     */
    public static function indexTheme($path)
    {
        Helper::options()->themeUrl($path);
    }

    /**
     * 输出头像链接
     * 
     * @return void
     */
    public static function gravatar($mail, $size = 64, $d = '')
    {
        echo Typecho_Common::gravatarUrl($mail, $size, '', urlencode($d), true);
    }

    /**
     * 判断插件是否可用
     * 
     * @return bool
     */
    public static function isPluginAvailable($name) 
    {
        $plugins = Typecho_Plugin::export();
        return is_array($plugins)
            && isset($plugins['activated'])
            && is_array($plugins['activated'])
            && array_key_exists($name, $plugins['activated']);
    }

    /**
     * PJAX判定
     * 
     * @return bool
     */
    public static function isPjax()
    {
        return array_key_exists('HTTP_X_PJAX', $_SERVER) && $_SERVER['HTTP_X_PJAX'];
    }

    /**
     * 判断当前归档是否为 Typecho 的 404 上下文
     *
     * @return bool
     */
    public static function isNotFoundArchive($archive)
    {
        return is_object($archive)
            && method_exists($archive, 'getArchiveType')
            && method_exists($archive, 'getArchiveSlug')
            && $archive->getArchiveType() === 'archive'
            && (string) $archive->getArchiveSlug() === '404';
    }

    /**
     * 使用衬线体判定
     */
    public static function isSerif($setting)
    {
        if(isset($_COOKIE['serif'])) {
            if ($_COOKIE['serif']=='1') return true; 
        } else {
            if ($setting['serifincontent']) return true;
        }
        return false;
    }

    /**
     * 界面大小风格
     * 1: 14px, 2: 16px, 3: 18px, 4: 20px, 5: 22px
     */
    public static function getTextSize($setting) {
        $default = isset($setting['defaultFontSize']) ? $setting['defaultFontSize'] : 3;
        $value = isset($_COOKIE['textsize']) ? $_COOKIE['textsize'] : $default;

        if (is_int($value) && $value >= 1 && $value <= 5) {
            return $value;
        }
        if (is_string($value) && preg_match('/^[1-5]$/D', $value)) {
            return (int) $value;
        }

        if (is_int($default) && $default >= 1 && $default <= 5) {
            return $default;
        }
        if (is_string($default) && preg_match('/^[1-5]$/D', $default)) {
            return (int) $default;
        }

        return 3;
    }

    /**
     * 移动端判定
     * 
     * @return bool
     */
    public static function isMobile()
    { 
        if (isset ($_SERVER['HTTP_X_WAP_PROFILE'])){
            return TRUE;
        }
        
        if (isset ($_SERVER['HTTP_USER_AGENT'])) {
            $clientkeywords = array ('mobile','nokia','sony','ericsson','mot','samsung','htc','sgh','lg','sharp','sie-','philips','panasonic','alcatel','lenovo','iphone','ipod','blackberry','meizu','android','netfront','symbian','ucweb','windowsce','palm','operamini','operamobi','openwave','nexusone','cldc','midp','wap'); 
            $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? '';
            if (preg_match("/(" . implode('|', $clientkeywords) . ")/i", strtolower($userAgent))){
                return TRUE;
            }
        }
        if (isset ($_SERVER['HTTP_ACCEPT'])){
            if ((strpos($_SERVER['HTTP_ACCEPT'], 'vnd.wap.wml') !== FALSE) && (strpos($_SERVER['HTTP_ACCEPT'], 'text/html') === FALSE || (strpos($_SERVER['HTTP_ACCEPT'], 'vnd.wap.wml') < strpos($_SERVER['HTTP_ACCEPT'], 'text/html')))){
                return TRUE;
            }
        }
        return FALSE;
    }

    /**
     * iOS 判定
     */
    public static function isIosSafari () {
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        return strpos($ua, 'iPhone') !== false || strpos($ua, 'iPad') !== false;
    }

    /**
     * 编辑界面添加Button
     * 
     * @return void
     */
    public static function addButton()
    {
        ob_start();
        self::indexTheme('/assets/libs/emotes/emote-picker-8bb0eaeec2.js');
        $emotePickerUrl = ob_get_clean();
        echo '<script src="' . self::escapeHtml($emotePickerUrl) . '"></script>';

        ob_start();
        self::indexTheme('/assets/libs/emotes/');
        $emotesBaseUrl = ob_get_clean();
        echo '<script>window.VOIDEmotesConfig={baseUrl:'
            . self::encodeJsonForHtml($emotesBaseUrl) . '};</script>';

        ob_start();
        self::indexTheme('/assets/editor-88dbc15fea.js');
        $editorUrl = ob_get_clean();
        echo '<script src="' . self::escapeHtml($editorUrl) . '"></script>';

        ob_start();
        self::indexTheme('/assets/libs/emotes/emote-picker-00a566ee43.css');
        $emotePickerStyleUrl = ob_get_clean();
        echo '<link rel="stylesheet" href="' . self::escapeHtml($emotePickerStyleUrl) . '" />';

        ob_start();
        self::indexTheme('/assets/editor-admin-686afd1648.css');
        $editorStyleUrl = ob_get_clean();
        echo '<link rel="stylesheet" href="' . self::escapeHtml($editorStyleUrl) . '" />';
    }

    /**
     * 判定内容是否过时
     * 
     * @return array
     */
    public static function isOutdated($archive)
    {
        $created = round((time()- $archive->created) / 3600 / 24);
        $updated = round((time()- $archive->modified) / 3600 / 24);

        return array("is" => $created > 90,
                    "created" => $created,
                    "updated" => $updated);
    }

    /**
     * 判定是否显示过时提示
     *
     * @return bool
     */
    public static function shouldShowOutdatedNotice($archive)
    {
        if (!is_object($archive)) {
            return false;
        }

        $fields = $archive->fields;
        if (!is_object($fields)) {
            return false;
        }

        return '1' === $fields->showOutdated;
    }

    /**
     * 输出建站时间（最早一篇文章的写作时间）
     * 
     * @return void
     */
    public static function getBuildTime()
    {
        $db = Typecho_Db::get();
        $content = $db->fetchRow($db->select()->from('table.contents')
            ->where('table.contents.status = ?', 'publish')
            ->where('table.contents.password IS NULL')
            ->order('table.contents.created', Typecho_Db::SORT_ASC)
            ->limit(1));
        if (is_array($content) && isset($content['created']))
            echo date('Y-m-d\TH:i', $content['created']);
        else
            echo date('Y-m-d\TH:i');
    }

    /**
     * 已发布文章数量
     * 
     * @return int
     */
    public static function getPostNum()
    {
        $db = Typecho_Db::get();
        return $db->fetchObject($db->select(array('COUNT(cid)' => 'num'))
                    ->from('table.contents')
                    ->where('table.contents.type = ?', 'post')
                    ->where('table.contents.status = ?', 'publish'))->num;
    }

    /**
     * 分类数量
     * 
     * @return int
     */
    public static function getCatNum()
    {
        $db = Typecho_Db::get();
        return $db->fetchObject($db->select(array('COUNT(mid)' => 'num'))
                    ->from('table.metas')
                    ->where('table.metas.type = ?', 'category'))->num;
    }

    /**
     * 标签数量
     * 
     * @return int
     */
    public static function getTagNum()
    {
        $db = Typecho_Db::get();
        return $db->fetchObject($db->select(array('COUNT(mid)' => 'num'))
                    ->from('table.metas')
                    ->where('table.metas.type = ?', 'tag'))->num;
    }

    /**
     * 存在 VOID 插件且满足要求
     */
    public static function hasVOIDPlugin($req)
    {
        if (!self::isPluginAvailable('VOID')
            || !class_exists('VOID_Plugin')
            || !property_exists('VOID_Plugin', 'VERSION')) {
            return false;
        }

        try {
            $versionProperty = new ReflectionProperty('VOID_Plugin', 'VERSION');
        } catch (ReflectionException $error) {
            return false;
        }

        if (!$versionProperty->isPublic() || !$versionProperty->isStatic()) {
            return false;
        }

        try {
            $versionValue = $versionProperty->getValue();
        } catch (Exception $error) {
            return false;
        } catch (Error $error) {
            return false;
        }

        $versionHave = self::normalizePluginVersion($versionValue);
        $versionRequired = self::normalizePluginVersion($req);
        return null !== $versionHave
            && null !== $versionRequired
            && version_compare($versionHave, $versionRequired, '>=');
    }

    /**
     * 规范化 VOID 插件使用过的点分版本格式。
     */
    private static function normalizePluginVersion($version)
    {
        if (is_float($version)) {
            if (is_nan($version) || is_infinite($version)) {
                return null;
            }
            $version = (string) $version;
        } elseif (is_int($version)) {
            $version = (string) $version;
        }

        if (!is_string($version)
            || !preg_match(
                '/^[0-9]+(?:\.[0-9]+)+(?:-(?:dev|alpha|a|beta|b|rc|pl|p)(?:[.-]?[0-9]+)?)?$/Di',
                $version
            )) {
            return null;
        }

        return $version;
    }

    /**
     * 规范化主题颜色模式，旧定时模式及非法值统一迁移为跟随设备。
     */
    public static function normalizeColorScheme($value)
    {
        if (is_int($value)) {
            $mode = $value;
        } elseif (is_string($value) && preg_match('/^[123]$/D', $value)) {
            $mode = intval($value);
        } else {
            return 3;
        }

        return in_array($mode, array(1, 2, 3), true) ? $mode : 3;
    }

    /**
     * 规范化 Feed 内容模式，只接受整数或单字符字符串 0/1。
     */
    public static function normalizeFeedContentMode($value)
    {
        if (is_int($value)) {
            $mode = $value;
        } elseif (is_string($value) && preg_match('/^[01]$/D', $value)) {
            $mode = intval($value);
        } else {
            return 0;
        }

        return in_array($mode, array(0, 1), true) ? $mode : 0;
    }

    /**
     * 返回经过校验的 HTTP(S) 或相对 URL，非法输入返回 null。
     */
    public static function getSafeHttpUrl($value)
    {
        if (!is_string($value)) {
            return null;
        }

        $url = $value;
        for ($i = 0; $i < 5; ++$i) {
            $decoded = html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if ($decoded === $url) {
                break;
            }
            $url = $decoded;
        }

        // Reject unusually deep entity nesting instead of validating a partially decoded URL.
        if (html_entity_decode($url, ENT_QUOTES | ENT_HTML5, 'UTF-8') !== $url) {
            return null;
        }

        if ($url === '' || preg_match('//u', $url) !== 1) {
            return null;
        }

        if (preg_match('/[\x{0000}-\x{001F}\x{007F}-\x{009F}]/u', $url) !== 0) {
            return null;
        }

        $url = trim($url);
        if (
            $url === ''
            || strpos($url, '\\') !== false
            || preg_match('/\s/u', $url) !== 0
            || preg_match('/%(?![0-9A-Fa-f]{2})/', $url) !== 0
        ) {
            return null;
        }

        if (preg_match('/^([A-Za-z][A-Za-z0-9+.-]*):/', $url, $matches) === 1) {
            $scheme = strtolower($matches[1]);
            if ($scheme !== 'http' && $scheme !== 'https') {
                return null;
            }

            return self::isValidHttpAbsoluteUrl($url) ? $url : null;
        }

        if (substr($url, 0, 2) === '//') {
            return self::isValidHttpAbsoluteUrl('https:' . $url) ? $url : null;
        }

        if (substr($url, 0, 1) !== '/' && preg_match('/^[^\/?#]*:/', $url) === 1) {
            return null;
        }

        $parts = parse_url($url);
        if ($parts === false || isset($parts['scheme']) || isset($parts['host'])) {
            return null;
        }

        return $url;
    }

    /**
     * 保留公开的赞赏 URL 校验入口。
     */
    public static function getSafeRewardUrl($value)
    {
        return self::getSafeHttpUrl($value);
    }

    /**
     * 校验带主机名的 HTTP(S) URL。
     */
    private static function isValidHttpAbsoluteUrl($url)
    {
        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        $parts = parse_url($url);
        return is_array($parts) && isset($parts['host']) && $parts['host'] !== '';
    }

    /**
     * 超高级设置
     * 
     * @return array
     */
    public static function getVOIDSettings()
    {
        $options = Helper::options();

        // 主题设置
        $themeSetting = array(
            'defaultBanner' => '',
            'enableMath' => false,
            'head' => '',
            'footer' => '',
            'serifincontent' => false,
            'pjax' => false,
            'pjaxreload' => '',
            'indexStyle' => 0,
            'lazyload' => true,
            'indexBannerTitle' => '',
            'indexBannerSubtitle' => '',
            'serviceworker' => '',
            'colorScheme' => 3, // 1: 日间，2: 夜间，3: 跟随设备；旧值 0 迁移为 3
            'feedContentMode' => 0, // 0: 保持 Typecho 默认行为，1: 仅输出正文开头
            'reward' => ''
        );

        $keys = array_keys($themeSetting);
        foreach ($keys as $key) {
            if($options->{$key} !== null && $options->{$key} !== ''){
                $themeSetting[$key] = $options->{$key};
            }
        }

        // 一些类型变换
        $themeSetting['enableMath'] = boolval($themeSetting['enableMath']);
        $themeSetting['lazyload'] = boolval($themeSetting['lazyload']);
        $themeSetting['colorScheme'] = self::normalizeColorScheme($themeSetting['colorScheme']);
        $themeSetting['feedContentMode'] = self::normalizeFeedContentMode($themeSetting['feedContentMode']);
        $themeSetting['pjax'] = boolval($themeSetting['pjax']);
        $themeSetting['serifincontent'] = boolval($themeSetting['serifincontent']);
        $themeSetting['indexStyle'] = intval($themeSetting['indexStyle']);

        // 高级设置
        $advanceSetting = array(
            'nav' => '',
            'name' => '',
            'brandFont' => array(
                'src' => '',
                'style' => 'normal',
                'weight' => 'normal'
            ),
            'desktopBannerHeight' => '',
            'mobileBannerHeight' => '',
            'twitterId' => '',
            'weiboId' => '',
            'headerMode' => 1,
            'defaultFontSize' => 3,
            'useFiraCodeFont' => false,
            'largePhotoSet' => true,
            'macStyleCodeBlock' => true,
            'lineNumbers' => true,
            'parseFigcaption' => true,
            'link' => array(),
            'commentFoldThreshold' => array(5, 1.5),
            'commentNotification' => ''
        );

        if(!empty($options->advance)){
            $settings = json_decode($options->advance, true);
            if (is_array($settings)) {
                foreach ($settings as $key => $value) {
                    $advanceSetting[$key] = $value;
                }
            }
        }

        // 废弃键可以留在用户的自由格式配置中，但不再进入主题运行时设置。
        unset(
            $advanceSetting['darkModeTime'],
            $advanceSetting['followSystemColorScheme'],
            $advanceSetting['bluredLazyload'],
            $advanceSetting['CDNType'],
            $advanceSetting['browserLevelLoadingLazy']
        );

        if(self::isMobile() && array_key_exists('headerModeMobile', $advanceSetting)){
            $advanceSetting['headerMode'] = $advanceSetting['headerModeMobile'];
        }

        $output = array_merge($themeSetting, $advanceSetting);
        // 公开设置不允许被自由格式的高级设置同名键覆盖。
        $output['feedContentMode'] = $themeSetting['feedContentMode'];
        $output['lazyload'] = $themeSetting['lazyload'];
        $output['VOIDPlugin'] = self::hasVOIDPlugin($GLOBALS['VOIDPluginREQ']);

        return $output;
    }
}

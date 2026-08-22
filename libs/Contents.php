<?php
/**
 * Contents.php
 * 
 * 解析器等内容处理相关
 * 
 * @author      熊猫小A
 * @version     2019-01-15 0.01
 */

Class Contents
{
    /**
     * 文章图集 class
     */
    static private $photoSetClass = 'photos';

    /**
     * 当前请求内缓存已校验的表情清单。
     */
    static private $emoteManifestCache = array();

    /**
     * 根据 cid 返回文章对象
     * 
     * @return Widget_Abstract_Contents
     */
    public static function getPost($cid)
    {
        $db = Typecho_Db::get();
        $post = Widget_Abstract_Contents::alloc();
        $db->fetchRow($post->select()
            ->where("cid = ?", $cid)
            ->limit(1),
            array($post, 'push'));
        return $post;
    }

    /**
     * 根据 cid 返回评论对象
     * 
     * @return Widget_Abstract_Comments
     */
    public static function getComment($coid)
    {
        $db = Typecho_Db::get();
        $comment = Widget_Abstract_Comments::alloc();
        $db->fetchRow($comment->select()
            ->where("coid = ?", $coid)
            ->limit(1),
            array($comment, 'push'));
        return $comment;
    }

    /**
     * 根据 mid 返回 meta 对象
     * 
     * @return Widget_Abstract_Metas
     */
    public static function getMeta($mid)
    {
        $db = Typecho_Db::get();
        $meta = Widget_Abstract_Metas::alloc();
        $db->fetchRow($meta->select()
            ->where("mid = ?", $mid)
            ->limit(1),
            array($meta, 'push'));
        return $meta;
    }

    /**
     * 输出完备的标题
     * 
     * @return void
     */
    public static function title(Widget_Archive $archive)
    {
        $archive->archiveTitle(array(
            'category'  =>  '分类 %s 下的文章',
            'search'    =>  '包含关键字 %s 的文章',
            'tag'       =>  '标签 %s 下的文章',
            'author'    =>  '%s 发布的文章'
        ), '', ' - ');
        Helper::options()->title();
    }

    /**
     * 获取当前过滤链中的文本
     *
     * @return string|null
     */
    static private function getFilteredText($data, $last)
    {
        return null !== $last ? $last : $data;
    }

    /**
     * 当前是否为 feed 输出
     */
    static private function isFeedContext($widget)
    {
        if (!is_object($widget) || !isset($widget->parameter)) {
            return false;
        }

        return $widget->parameter->__get('type') == 'feed'
            || (bool) $widget->parameter->__get('isFeed');
    }

    /**
     * 净化 feed 内容中的主题样式和交互属性
     */
    static private function sanitizeFeedHtml($content)
    {
        $content = preg_replace_callback(
            '/<a\b([^>]*)>\s*<div\b[^>]*class="board-thumb"[^>]*><\/div>\s*<div\b[^>]*class="board-title"[^>]*>(.*?)<\/div>\s*<\/a>/is',
            function ($matches) {
                $href = '';
                if (preg_match('/\bhref="([^"]+)"/i', $matches[1], $hrefMatches)) {
                    $href = $hrefMatches[1];
                }

                return '<p><a href="' . $href . '">' . $matches[2] . '</a></p>';
            },
            $content
        );

        $content = preg_replace('/<div class="board-list link-list">\s*(.*?)\s*<\/div>/is', '$1', $content);
        $content = preg_replace('/<div class="photos(?: large)?">(.*?)<\/div>/is', '$1', $content);
        $content = preg_replace('/\s+no-pjax(?=[\s>])/i', '', $content);
        $content = preg_replace('/\s+(?:class|style|loading|data-[a-z0-9_-]+)="[^"]*"/i', '', $content);
        return $content;
    }

    /**
     * 内容解析点钩子
     * 目录解析移至前端完成
     */
    static public function contentEx($data, $widget, $last)
    {
        $text = self::getFilteredText($data, $last);
        if (!is_string($text) || $text === '') {
            return $text;
        }

        $isFeedContext = self::isFeedContext($widget);
        $text = self::parseRuby($text);
        $text = self::parseImages($text, $isFeedContext);
        $text = self::parseBiaoQing($text);
        $text = self::parsePhotoSet($text);
        $text = self::parseNotice($text);

        if ($isFeedContext) {
            $text = self::sanitizeFeedHtml($text);
        } else {
            $text = self::parseHeader($text);
        }

        return $text;
    }

    /**
     * 摘要解析点钩子
     */
    static public function excerptEx($data, $widget, $last)
    {
        $text = self::getFilteredText($data, $last);
        if (!is_string($text) || $text === '') {
            return $text;
        }

        $text = self::parseRuby($text);
        $text = self::parseBiaoQing($text);
        $text = self::parseNotice($text);
        // Typecho 1.3 的 excerpt 基于 content 生成，需要额外清理已渲染图集
        $text = preg_replace('/<div class="photos(?: large)?">.*?<\/div>/is', '', $text);
        $text = str_replace('[photos]', '', $text);
        $text = str_replace('[/photos]', '', $text);
        return $text;
    }

    /**
     * 解析文章内 h2 ~ h5 元素
     * 
     * @return string
     */
    static public function parseHeader($content)
    {
        $reg='/\<h([2-6])(.*?)\>(.*?)\<\/h.*?\>/s';
        $new = preg_replace_callback($reg, array('Contents', 'parseHeaderCallback'), $content);
        return $new;
    }

    /**
     * 为内容中的 h2-h6 元素编号
     */
    static private $CurrentTocID = 0;
    static public function parseHeaderCallback($matchs)
    {
        // 增加单独标记，否则冲突
        $id = 'toc_'.(self::$CurrentTocID++);
        return '<h'.$matchs[1].$matchs[2].' id="'.$id.'">'.$matchs[3].'</h'.$matchs[1].'>';
    }

    /**
     * 解析提示块
     * 
     * @return string
     */
    static public function parseNotice($content)
    {
        $reg = '/<p>\s*\[notice(?:[^\]]*)\](.*?)\[\/notice\]\s*<\/p>/is';
        $content = preg_replace($reg, '<p class="notice">$1</p>', $content);
        $reg = '/\[notice(?:[^\]]*)\](.*?)\[\/notice\]/is';
        return preg_replace($reg, '<p class="notice">$1</p>', $content);
    }

    /**
     * 解析照片集
     *
     * @return string
     */
    static public function parsePhotoSet($content)
    {
        $setting = $GLOBALS['VOIDSetting'];
        self::$photoSetClass = $setting['largePhotoSet'] ? 'photos large' : 'photos';
        $reg = '/(?:<p>\s*)?\[photos(?:[^\]]*)\](.*?)(?:\[\/photos\])(?:\s*<\/p>)?/is';
        return preg_replace_callback($reg, array('Contents', 'parsePhotoSetCallBack'), $content);
    }

    /**
     * 解析照片集回调函数
     * 
     * @return string
     */
    private static function parsePhotoSetCallBack($match)
    {
        $content = preg_replace('/<br\s*\/?>/i', '', $match[1]);
        $content = str_replace(array('<p>', '</p>'), '', $content);
        $content = trim($content);

        return '<div class="' . self::$photoSetClass . '">' . $content . '</div>';
    }

    /**
     * 解析表情
     * 
     * @return string
     */
    static public function parseBiaoQing($content)
    {
        if (!is_string($content) || $content === '') {
            return $content;
        }

        if (strpos($content, '<') === false) {
            return self::replaceEmotesInText($content);
        }

        $result = '';
        $offset = 0;
        $length = strlen($content);
        $protectedTags = array();

        while ($offset < $length) {
            $tagStart = strpos($content, '<', $offset);
            if (false === $tagStart) {
                $tail = substr($content, $offset);
                $result .= empty($protectedTags) ? self::replaceEmotesInText($tail) : $tail;
                break;
            }

            $text = substr($content, $offset, $tagStart - $offset);
            $result .= empty($protectedTags) ? self::replaceEmotesInText($text) : $text;

            $tagEnd = self::findHtmlTokenEnd($content, $tagStart);
            if (null === $tagEnd) {
                $result .= '<';
                $offset = $tagStart + 1;
                continue;
            }

            $tag = substr($content, $tagStart, $tagEnd - $tagStart + 1);
            $result .= $tag;
            self::updateProtectedEmoteTags($tag, $protectedTags);
            $offset = $tagEnd + 1;
        }

        return $result;
    }

    /**
     * 找到一个 HTML 标签、注释或处理指令的末尾，同时保留属性引号中的 >。
     */
    static private function findHtmlTokenEnd($content, $offset)
    {
        $length = strlen($content);
        $prefix = substr($content, $offset, 9);

        if (substr($prefix, 0, 4) === '<!--') {
            $end = strpos($content, '-->', $offset + 4);
            return false === $end ? $length - 1 : $end + 2;
        }
        if (substr($prefix, 0, 9) === '<![CDATA[') {
            $end = strpos($content, ']]>', $offset + 9);
            return false === $end ? $length - 1 : $end + 2;
        }

        $next = $offset + 1 < $length ? $content[$offset + 1] : '';
        if ($next === '/') {
            $nameOffset = $offset + 2;
            while ($nameOffset < $length && ctype_space($content[$nameOffset])) {
                $nameOffset++;
            }
            if ($nameOffset >= $length || !ctype_alpha($content[$nameOffset])) {
                return null;
            }
        } elseif ($next !== '!' && $next !== '?' && !ctype_alpha($next)) {
            return null;
        }

        if ($next === '?') {
            $end = strpos($content, '?>', $offset + 2);
            return false === $end ? $length - 1 : $end + 1;
        }

        $quote = null;
        for ($index = $offset + 1; $index < $length; $index++) {
            $character = $content[$index];
            if (null !== $quote) {
                if ($character === $quote) {
                    $quote = null;
                }
                continue;
            }
            if ($character === '"' || $character === "'") {
                $quote = $character;
            } elseif ($character === '>') {
                return $index;
            }
        }

        return $length - 1;
    }

    /**
     * code/pre 等原样内容区域不解析短码。
     */
    static private function updateProtectedEmoteTags($tag, &$protectedTags)
    {
        if (!preg_match('/\A<\s*(\/?)\s*(code|pre|script|style|textarea)\b/i', $tag, $matches)) {
            return;
        }

        $name = strtolower($matches[2]);
        if ($matches[1] === '') {
            if (!preg_match('/\/\s*>\z/', $tag)) {
                $protectedTags[] = $name;
            }
            return;
        }

        for ($index = count($protectedTags) - 1; $index >= 0; $index--) {
            if ($protectedTags[$index] === $name) {
                array_splice($protectedTags, $index, 1);
                return;
            }
        }
    }

    /**
     * 仅在 HTML 文本节点中替换白名单短码。
     */
    static private function replaceEmotesInText($content)
    {
        if ($content === '') {
            return $content;
        }

        $packages = array(
            array('id' => 'aru', 'marker' => ':@(', 'pattern' => '/:\@\(\s*([^()\r\n]{1,240}?)\s*\)/'),
            array('id' => 'quyin', 'marker' => ':&(', 'pattern' => '/:\&\(\s*([^()\r\n]{1,240}?)\s*\)/'),
            array('id' => 'bilibili', 'marker' => ':$(', 'pattern' => '/:\$\(\s*([^()\r\n]{1,240}?)\s*\)/'),
            array('id' => 'mihoyo', 'marker' => ':!(', 'pattern' => '/:\!\(\s*([^()\r\n]{1,240}?)\s*\)/'),
            array('id' => 'bangumi', 'marker' => ':bgm(', 'pattern' => '/:bgm\(([0-9]{3})\)/')
        );

        foreach ($packages as $package) {
            if (strpos($content, $package['marker']) !== false) {
                $content = self::replaceManifestEmotes($content, $package['id'], $package['pattern']);
            }
        }

        return $content;
    }

    /**
     * 只替换清单中存在的短码；清单不可用或短码未知时保留原文。
     */
    static private function replaceManifestEmotes($content, $packageId, $pattern)
    {
        $items = self::getEmoteManifestItems($packageId);
        if (empty($items)) {
            return $content;
        }

        return preg_replace_callback($pattern, function ($matches) use ($items, $packageId) {
            $tokenKey = trim($matches[1]);
            if (!array_key_exists($tokenKey, $items)) {
                return $matches[0];
            }

            $html = self::renderManifestEmote($packageId, $items[$tokenKey]);
            return null === $html ? $matches[0] : $html;
        }, $content);
    }

    /**
     * 从包清单建立“短码捕获值 -> 条目”映射。
     */
    static private function getEmoteManifestItems($packageId)
    {
        if (array_key_exists($packageId, self::$emoteManifestCache)) {
            return self::$emoteManifestCache[$packageId];
        }

        self::$emoteManifestCache[$packageId] = array();
        $manifestDir = defined('VOID_EMOTE_MANIFEST_DIR')
            ? VOID_EMOTE_MANIFEST_DIR
            : dirname(__DIR__) . '/assets/libs/emotes/packs';
        $manifestPath = rtrim($manifestDir, '/\\') . DIRECTORY_SEPARATOR . $packageId . '.json';

        if (!is_file($manifestPath) || !is_readable($manifestPath)) {
            return self::$emoteManifestCache[$packageId];
        }

        $json = file_get_contents($manifestPath);
        if (false === $json || strlen($json) > 2 * 1024 * 1024) {
            return self::$emoteManifestCache[$packageId];
        }

        $manifest = json_decode($json, true);
        if (!is_array($manifest)
            || !isset($manifest['id'])
            || $manifest['id'] !== $packageId
            || !isset($manifest['items'])
            || !is_array($manifest['items'])) {
            return self::$emoteManifestCache[$packageId];
        }

        $items = array();
        $duplicates = array();
        foreach ($manifest['items'] as $item) {
            if (!is_array($item)) {
                continue;
            }

            $token = isset($item['token']) ? $item['token'] : (isset($item['shortcode']) ? $item['shortcode'] : null);
            $tokenKey = self::getManifestTokenKey($packageId, $token);
            if (null === $tokenKey) {
                continue;
            }

            if (array_key_exists($tokenKey, $items) || isset($duplicates[$tokenKey])) {
                unset($items[$tokenKey]);
                $duplicates[$tokenKey] = true;
                continue;
            }

            $items[$tokenKey] = $item;
        }

        self::$emoteManifestCache[$packageId] = $items;
        return $items;
    }

    /**
     * 验证清单声明的短码，并返回解析时使用的捕获值。
     */
    static private function getManifestTokenKey($packageId, $token)
    {
        if (!is_string($token)) {
            return null;
        }

        $patterns = array(
            'aru' => '/\A:\@\(([^()\r\n]{1,240})\)\z/',
            'quyin' => '/\A:\&\(([^()\r\n]{1,240})\)\z/',
            'bilibili' => '/\A:\$\(([^()\r\n]{1,240})\)\z/',
            'mihoyo' => '/\A:\!\(([^()\r\n]{1,240})\)\z/',
            'bangumi' => '/\A:bgm\(([0-9]{3})\)\z/'
        );

        if (!isset($patterns[$packageId]) || !preg_match($patterns[$packageId], $token, $matches)) {
            return null;
        }

        $tokenKey = trim($matches[1]);
        return $tokenKey === '' ? null : $tokenKey;
    }

    /**
     * 将经过校验的清单相对路径转换为当前 Typecho 主题 URL。
     */
    static private function getEmoteAssetUrl($relativePath)
    {
        if (!is_string($relativePath) || $relativePath === '' || strpos($relativePath, '\\') !== false) {
            return null;
        }

        if ($relativePath[0] === '/') {
            return null;
        }
        $assetPath = '/assets/libs/emotes/' . $relativePath;

        if (!preg_match('/\A\/[A-Za-z0-9][A-Za-z0-9._\/-]*\z/', $assetPath)) {
            return null;
        }

        foreach (explode('/', ltrim($assetPath, '/')) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..') {
                return null;
            }
        }

        ob_start();
        Utils::indexTheme($assetPath);
        $url = ob_get_clean();
        return is_string($url) && $url !== '' ? $url : null;
    }

    /**
     * 返回可安全输出为 HTML 尺寸属性的原图尺寸。
     */
    static private function getEmoteDimension($value)
    {
        if (is_int($value)) {
            $dimension = $value;
        } elseif (is_string($value) && preg_match('/\A[0-9]+\z/', $value)) {
            $dimension = (int) $value;
        } else {
            return null;
        }

        return $dimension > 0 && $dimension <= 10000 ? $dimension : null;
    }

    /**
     * 由清单条目输出表情 HTML，绝不使用用户输入构造资源路径。
     */
    static private function renderManifestEmote($packageId, $item)
    {
        if (!isset($item['label']) || !is_string($item['label']) || trim($item['label']) === '') {
            return null;
        }

        $label = trim($item['label']);
        $width = isset($item['width']) ? self::getEmoteDimension($item['width']) : null;
        $height = isset($item['height']) ? self::getEmoteDimension($item['height']) : null;

        if ($packageId === 'bangumi') {
            $posterPath = isset($item['poster']) ? $item['poster'] : (isset($item['preview']) ? $item['preview'] : null);
            if (isset($item['animated']) && is_string($item['animated'])) {
                $animatedPath = $item['animated'];
            } elseif ((!isset($item['animated']) || $item['animated'] === true) && isset($item['src'])) {
                $animatedPath = $item['src'];
            } else {
                $animatedPath = null;
            }

            $posterUrl = self::getEmoteAssetUrl(is_string($posterPath) ? $packageId . '/' . $posterPath : null);
            $animatedUrl = self::getEmoteAssetUrl(is_string($animatedPath) ? $packageId . '/' . $animatedPath : null);
            if (null === $posterUrl || null === $animatedUrl || null === $width || null === $height) {
                return null;
            }

            return '<img class="biaoqing biaoqing--bangumi"'
                . ' src="' . self::escapeHtml($posterUrl) . '"'
                . ' data-animated-src="' . self::escapeHtml($animatedUrl) . '"'
                . ' width="' . $width . '" height="' . $height . '"'
                . ' loading="lazy" decoding="async"'
                . ' alt="' . self::escapeHtml('Bangumi 娘：' . $label) . '">';
        }

        $srcPath = isset($item['src']) ? $item['src'] : (isset($item['poster']) ? $item['poster'] : null);
        $srcUrl = self::getEmoteAssetUrl(is_string($srcPath) ? $packageId . '/' . $srcPath : null);
        if (null === $srcUrl) {
            return null;
        }

        $sizeAttributes = '';
        if (null !== $width && null !== $height) {
            $sizeAttributes = ' width="' . $width . '" height="' . $height . '"';
        }

        return '<img class="biaoqing" src="' . self::escapeHtml($srcUrl) . '"'
            . $sizeAttributes . ' loading="lazy" decoding="async"'
            . ' alt="' . self::escapeHtml($label) . '">';
    }

    static private function escapeHtml($value)
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /**
     * 将正文图片转换为主题语义结构；Feed 只保留静态 figure/img。
     */
    static private $imageFeedMode = false;
    static public function parseImages($content, $feedMode = false)
    {
        if (!is_string($content) || $content === '' || stripos($content, '<img') === false) {
            return $content;
        }

        self::$imageFeedMode = (bool) $feedMode;
        $result = '';
        $offset = 0;
        $length = strlen($content);
        $protectedTags = array();

        while ($offset < $length) {
            $tagStart = strpos($content, '<', $offset);
            if (false === $tagStart) {
                $result .= substr($content, $offset);
                break;
            }

            $result .= substr($content, $offset, $tagStart - $offset);
            $tagEnd = self::findHtmlTokenEnd($content, $tagStart);
            if (null === $tagEnd) {
                $result .= '<';
                $offset = $tagStart + 1;
                continue;
            }

            $tag = substr($content, $tagStart, $tagEnd - $tagStart + 1);
            if (empty($protectedTags)
                && preg_match('/\A<\s*img\b/i', $tag)
                && stripos($tag, 'data-void-image-content') === false) {
                $result .= self::renderContentImage($tag);
            } else {
                $result .= $tag;
            }

            self::updateProtectedEmoteTags($tag, $protectedTags);
            $offset = $tagEnd + 1;
        }

        return $result;
    }

    /**
     * 读取 HTML 标签中的属性并还原实体，供重新输出时按上下文转义。
     */
    static private function getHtmlAttribute($tag, $name)
    {
        $pattern = '/(?:^|\s)' . preg_quote($name, '/') . '\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>"\']+))/i';
        if (!preg_match($pattern, $tag, $matches)) {
            return null;
        }

        if (isset($matches[1]) && $matches[1] !== '') {
            $value = $matches[1];
        } elseif (isset($matches[2]) && $matches[2] !== '') {
            $value = $matches[2];
        } else {
            $value = isset($matches[3]) ? $matches[3] : '';
        }

        return html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * 从保存流程写入的 vwid/vhei 参数读取一组可信图片尺寸。
     */
    static private function getImageDimensions($src)
    {
        $parts = parse_url($src);
        if (false === $parts || !is_array($parts)) {
            return null;
        }

        $parameters = array();
        foreach (array('query', 'fragment') as $partName) {
            if (!isset($parts[$partName]) || !is_string($parts[$partName])) {
                continue;
            }

            $current = array();
            parse_str(html_entity_decode($parts[$partName], ENT_QUOTES | ENT_HTML5, 'UTF-8'), $current);
            $parameters = array_merge($parameters, $current);
        }

        if (!isset($parameters['vwid'], $parameters['vhei'])
            || !is_scalar($parameters['vwid'])
            || !is_scalar($parameters['vhei'])) {
            return null;
        }

        $widthText = (string) $parameters['vwid'];
        $heightText = (string) $parameters['vhei'];
        if (!preg_match('/^[1-9][0-9]*$/D', $widthText)
            || !preg_match('/^[1-9][0-9]*$/D', $heightText)) {
            return null;
        }

        $width = filter_var($widthText, FILTER_VALIDATE_INT, array('options' => array('min_range' => 1)));
        $height = filter_var($heightText, FILTER_VALIDATE_INT, array('options' => array('min_range' => 1)));
        if (false === $width || false === $height) {
            return null;
        }

        return array((int) $width, (int) $height);
    }

    /**
     * 输出单张正文图片。
     */
    static private function renderContentImage($tag)
    {
        $setting = $GLOBALS['VOIDSetting'];
        $srcOriginal = self::getHtmlAttribute($tag, 'src');
        if (!is_string($srcOriginal) || $srcOriginal === '') {
            return $tag;
        }

        $alt = self::getHtmlAttribute($tag, 'alt');
        $alt = null === $alt ? '' : $alt;
        $dimensions = self::getImageDimensions($srcOriginal);
        $dimensionAttributes = '';
        $figureAttributes = '';

        if (null !== $dimensions) {
            $width = $dimensions[0];
            $height = $dimensions[1];
            $ratio = rtrim(rtrim(number_format($width / $height, 4, '.', ''), '0'), '.');
            $dimensionAttributes = ' width="' . $width . '" height="' . $height . '"';
            $figureAttributes = ' data-void-image-width="' . $width . '" data-void-image-height="' . $height
                . '" style="--void-image-ratio: ' . $ratio . '"';
        }

        $escapedSrc = self::escapeHtml($srcOriginal);
        $escapedAlt = self::escapeHtml($alt);
        $figcaption = '';
        if ($alt !== '' && !empty($setting['parseFigcaption'])) {
            $figcaption = '<figcaption>' . $escapedAlt . '</figcaption>';
        }

        if (self::$imageFeedMode) {
            return '<figure><img src="' . $escapedSrc . '" alt="' . $escapedAlt . '"'
                . $dimensionAttributes . ' decoding="async">' . $figcaption . '</figure>';
        }

        $lazyload = Helper::options()->lazyload == '1';
        $browserLazyload = $lazyload && !empty($setting['browserLevelLoadingLazy']);
        $imageClass = '';
        $imageSrc = $escapedSrc;
        $lazyAttributes = '';
        $placeholder = '';

        if ($lazyload) {
            $imageClass = $browserLazyload ? 'lazyload browserlevel-lazy' : 'lazyload';
            $lazyAttributes = ' data-src="' . $escapedSrc . '"';

            if ($browserLazyload) {
                $lazyAttributes .= ' loading="lazy"';
            } else {
                $imageSrc = '';
                if (!empty($setting['bluredLazyload'])) {
                    $placeholderSrc = self::escapeHtml(self::genBluredPlaceholderSrc($srcOriginal));
                    $placeholder = '<img class="blured-placeholder remove-after" src="' . $placeholderSrc
                        . '" alt="" aria-hidden="true" decoding="async">';
                }
            }
        }

        $classAttribute = $imageClass === '' ? '' : ' class="' . $imageClass . '"';
        $image = $placeholder . '<img data-void-image-content' . $dimensionAttributes . $classAttribute
            . ' alt="' . $escapedAlt . '"' . $lazyAttributes . ' src="' . $imageSrc . '" decoding="async">';

        return '<figure data-void-image-item' . $figureAttributes . '><a class="void-image-link'
            . ($lazyload ? ' lazyload-container' : '')
            . '" data-void-image-zoom no-pjax href="' . $escapedSrc . '">' . $image . '</a>'
            . $figcaption . '</figure>';
    }

    /**
     * 根据 CDN 类型生成占位图片
     */
    public static function genBluredPlaceholderSrc($src)
    {
        $setting = $GLOBALS['VOIDSetting'];
        $cdn_config = $setting['CDNType'];
        $addons = array(
            "UPYUN" => '!/max/64',
            "QINIU" => '?imageView2/2/w/64/q/75'
        );

        // 兼容 PHP 8.1+：parse_url 参数需为字符串
        if (!is_string($src) || $src === '') {
            return is_scalar($src) ? (string) $src : '';
        }

        // 兼容 PHP 8.1+：parse_url 结果可能非数组或缺少键
        $components = parse_url($src);
        $cdn = '';
        if (is_array($components) && array_key_exists('host', $components) && array_key_exists($components['host'], $cdn_config)) {
            $cdn = $cdn_config[$components['host']];
        }

        $addon = '';
        if (array_key_exists($cdn, $addons)) {
            $addon = $addons[$cdn];
        }

        $fragment = (is_array($components) && array_key_exists('fragment', $components)) ? $components['fragment'] : null;
        $srcWithoutFragment = $fragment !== null ? str_replace('#' . $fragment, '', $src) : $src;

        return $srcWithoutFragment . $addon;
    }

    /**
     * 解析友情链接
     * 
     * @return string
     */
    static public function markdown($text)
    {
        if (!is_string($text) || $text === '') {
            return $text;
        }

        // 去除换行
        $reg = '/\[links.*?\](.*?)\[\/links\]/s';
        $text = preg_replace_callback($reg, array('Contents', 'parseBoardCallback1'), $text);

        // 向前兼容
        $reg = '/<div class="board-list link-list">(.*?)<\/div>/s';
        $text = preg_replace_callback($reg, array('Contents', 'parseBoardCallback1'), $text);

        $reg = '/\[links.*?\](.*?)\[\/links\]/s';
        $text = preg_replace_callback($reg, array('Contents', 'parseBoardCallback2'), $text);

        if (0 == strpos($text, '<!--markdown-->')) {
            $text = str_replace("```objective-c", "```objectivec", $text);
            $text = str_replace("```c++", "```cpp", $text);
            $text = str_replace("```c#", "```csharp", $text);
            $text = str_replace("```f#", "```fsharp", $text);
            $text = str_replace("```F#", "```Fsharp", $text);
            $text = Markdown::convert($text);
        }

        return $text;
    }

    /**
     * 主图来源是否应在当前布局中显示
     *
     * @return bool
     */
    static public function shouldShowBannerSource($archive, $displayMode = 'normal')
    {
        if (!is_object($archive) || !isset($archive->fields) || !is_object($archive->fields)) {
            return false;
        }

        $bannerSource = trim((string) $archive->fields->bannerSource);
        $banner = trim((string) $archive->fields->banner);
        if ($bannerSource === '' || $banner === '') {
            return false;
        }

        if ('cover' === $displayMode) {
            return true;
        }

        return '2' !== trim((string) $archive->fields->bannerStyle);
    }

    /**
     * 输出主图来源说明 HTML
     *
     * @return string
     */
    static public function getBannerSourceHtml($text)
    {
        $text = trim((string) $text);
        if ($text === '') {
            return '';
        }

        $content = '';
        $segments = self::splitBannerSourceSegments($text);

        foreach ($segments as $segment) {
            if ($segment['type'] === 'text') {
                $content .= htmlspecialchars($segment['content'], ENT_QUOTES, 'UTF-8');
                continue;
            }

            $linkHtml = self::renderBannerSourceLink($segment['label'], $segment['url']);
            if ($linkHtml === '') {
                $content .= htmlspecialchars($segment['raw'], ENT_QUOTES, 'UTF-8');
                continue;
            }

            $content .= $linkHtml;
        }

        return '题图来自 ' . $content;
    }

    /**
     * 将主图来源文本拆分为普通文本与链接片段
     *
     * @return array
     */
    static private function splitBannerSourceSegments($text)
    {
        $segments = array();
        $offset = 0;
        $length = strlen($text);

        while ($offset < $length) {
            $nextPosition = self::findNextBannerSourceTokenPosition($text, $offset);

            if ($nextPosition === false) {
                self::appendBannerSourceTextSegment($segments, substr($text, $offset));
                break;
            }

            if ($nextPosition > $offset) {
                self::appendBannerSourceTextSegment($segments, substr($text, $offset, $nextPosition - $offset));
            }

            $segment = self::parseBannerSourceTokenAt($text, $nextPosition);
            if (is_array($segment)) {
                $segments[] = $segment;
                $offset = $nextPosition + strlen($segment['raw']);
                continue;
            }

            self::appendBannerSourceTextSegment($segments, substr($text, $nextPosition, 1));
            $offset = $nextPosition + 1;
        }

        if (empty($segments)) {
            self::appendBannerSourceTextSegment($segments, $text);
        }

        return $segments;
    }

    /**
     * 查找下一个可解析的主图来源 token 起点
     *
     * @return int|false
     */
    static private function findNextBannerSourceTokenPosition($text, $offset)
    {
        $markdownPosition = strpos($text, '[', $offset);
        $htmlPosition = false;

        if (preg_match('/<a\b/isu', $text, $matches, PREG_OFFSET_CAPTURE, $offset)) {
            $htmlPosition = $matches[0][1];
        }

        if ($markdownPosition === false) {
            return $htmlPosition;
        }

        if ($htmlPosition === false) {
            return $markdownPosition;
        }

        return min($markdownPosition, $htmlPosition);
    }

    /**
     * 解析指定位置的主图来源 token
     *
     * @return array|null
     */
    static private function parseBannerSourceTokenAt($text, $offset)
    {
        $htmlSegment = self::parseBannerSourceHtmlLinkAt($text, $offset);
        if (is_array($htmlSegment)) {
            return $htmlSegment;
        }

        return self::parseBannerSourceMarkdownLinkAt($text, $offset);
    }

    /**
     * 解析指定位置的 HTML 链接
     *
     * @return array|null
     */
    static private function parseBannerSourceHtmlLinkAt($text, $offset)
    {
        if (!preg_match('/\G<a\b(?<htmlAttrs>[^>]*)>(?<htmlLabel>.*?)<\/a>/isu', $text, $matches, 0, $offset)) {
            return null;
        }

        return array(
            'type' => 'link',
            'label' => self::extractBannerSourceHtmlLabel($matches['htmlLabel']),
            'url' => self::extractBannerSourceHtmlHref($matches['htmlAttrs']),
            'raw' => $matches[0]
        );
    }

    /**
     * 解析指定位置的 Markdown 链接，兼容 URL 中的括号
     *
     * @return array|null
     */
    static private function parseBannerSourceMarkdownLinkAt($text, $offset)
    {
        $length = strlen($text);
        if ($offset >= $length || substr($text, $offset, 1) !== '[') {
            return null;
        }

        $labelEnd = self::findBannerSourceMarkdownDelimiter($text, $offset + 1, ']');
        if ($labelEnd === false || $labelEnd + 1 >= $length || substr($text, $labelEnd + 1, 1) !== '(') {
            return null;
        }

        $urlStart = $labelEnd + 2;
        $urlEnd = self::findBannerSourceMarkdownUrlEnd($text, $urlStart);
        if ($urlEnd === false) {
            return null;
        }

        $raw = substr($text, $offset, $urlEnd - $offset + 1);
        $label = substr($text, $offset + 1, $labelEnd - $offset - 1);
        $url = substr($text, $urlStart, $urlEnd - $urlStart);

        return array(
            'type' => 'link',
            'label' => trim(self::decodeBannerSourceMarkdownText($label)),
            'url' => trim(self::decodeBannerSourceMarkdownText($url)),
            'raw' => $raw
        );
    }

    /**
     * 查找 Markdown 文本中的结束分隔符
     *
     * @return int|false
     */
    static private function findBannerSourceMarkdownDelimiter($text, $offset, $delimiter)
    {
        $length = strlen($text);
        while ($offset < $length) {
            $char = substr($text, $offset, 1);
            if ($char === '\\') {
                $offset += 2;
                continue;
            }

            if ($char === $delimiter) {
                return $offset;
            }

            if ($char === "\r" || $char === "\n") {
                return false;
            }

            $offset++;
        }

        return false;
    }

    /**
     * 查找 Markdown 链接 URL 的结束位置，兼容嵌套括号
     *
     * @return int|false
     */
    static private function findBannerSourceMarkdownUrlEnd($text, $offset)
    {
        $length = strlen($text);
        $depth = 1;

        while ($offset < $length) {
            $char = substr($text, $offset, 1);
            if ($char === '\\') {
                $offset += 2;
                continue;
            }

            if ($char === '(') {
                $depth++;
            } elseif ($char === ')') {
                $depth--;
                if ($depth === 0) {
                    return $offset;
                }
            } elseif ($char === "\r" || $char === "\n") {
                return false;
            }

            $offset++;
        }

        return false;
    }

    /**
     * 解码 Markdown 链接中的转义字符
     *
     * @return string
     */
    static private function decodeBannerSourceMarkdownText($text)
    {
        return preg_replace('/\\\\([\\\\\[\]\(\)])/u', '$1', (string) $text);
    }

    /**
     * 追加主图来源文本片段，并合并相邻文本节点
     *
     * @return void
     */
    static private function appendBannerSourceTextSegment(&$segments, $content)
    {
        if (!is_string($content) || $content === '') {
            return;
        }

        $lastIndex = count($segments) - 1;
        if ($lastIndex >= 0 && $segments[$lastIndex]['type'] === 'text') {
            $segments[$lastIndex]['content'] .= $content;
            return;
        }

        $segments[] = array(
            'type' => 'text',
            'content' => $content
        );
    }

    /**
     * 从 HTML 链接属性中提取 href
     *
     * @return string
     */
    static private function extractBannerSourceHtmlHref($attributes)
    {
        if (!is_string($attributes) || $attributes === '') {
            return '';
        }

        if (preg_match('/\bhref\s*=\s*(["\'])(.*?)\1/isu', $attributes, $matches)) {
            return trim(html_entity_decode($matches[2], ENT_QUOTES, 'UTF-8'));
        }

        if (preg_match('/\bhref\s*=\s*([^\s>]+)/isu', $attributes, $matches)) {
            return trim(html_entity_decode($matches[1], ENT_QUOTES, 'UTF-8'));
        }

        return '';
    }

    /**
     * 从 HTML 链接片段中提取文本
     *
     * @return string
     */
    static private function extractBannerSourceHtmlLabel($label)
    {
        $label = strip_tags((string) $label);
        return trim(html_entity_decode($label, ENT_QUOTES, 'UTF-8'));
    }

    /**
     * 输出安全的主图来源链接
     *
     * @return string
     */
    static private function renderBannerSourceLink($label, $url)
    {
        $label = trim((string) $label);
        $url = trim((string) $url);

        if ($label === '' || !self::isSafeBannerSourceUrl($url)) {
            return '';
        }

        return '<a no-pjax target="_blank" rel="noopener noreferrer nofollow" href="' . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '">' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</a>';
    }

    /**
     * 校验主图来源链接是否安全
     *
     * @return bool
     */
    static private function isSafeBannerSourceUrl($url)
    {
        if (!is_string($url) || $url === '') {
            return false;
        }

        if (false === filter_var($url, FILTER_VALIDATE_URL)) {
            return false;
        }

        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
        return in_array($scheme, array('http', 'https'), true);
    }

    /**
     * 去除换行
     * 
     * @return string
     */
    static function parseBoardCallback1($matchs)
    {
        $text =  str_replace(array("\r\n", "\r", "\n"), "", $matchs[1]);
        return '[links]'.$text.'[/links]';
    }

    /**
     * 解析友链列表
     * 
     * @return string
     */
    static function parseBoardCallback2($matchs)
    {
        $text = "\n\n<div class=\"board-list link-list\">%boards%</div>\n\n";

        $reg='/\[(.*?)\]\((.*?)\)\+\((.*?)\)/s';
        $rp = '<a target="_blank" href="$2" class="board-item link-item"><div class="board-thumb" data-thumb="$3"></div><div class="board-title">$1</div></a>';
        $boards = trim(preg_replace($reg, $rp, $matchs[1]));

        return  str_replace('%boards%', $boards, $text);
    }

    /**
     * 解析 ruby
     * 
     * @return string
     */
    static public function parseRuby($string)
    {
        $reg = '/\{\{(.+?):(.+?)\}\}/us';
        $rp = '<ruby>$1<rp>(</rp><rt>$2</rt><rp>)</rp></ruby>';
        return preg_replace($reg, $rp, $string);
    }

    /**
     * 最近评论，过滤引用通告，过滤博主评论
     * 
     * @return array
     */
    public static function getRecentComments($num = 10)
    {
        $output = array();

        $db = Typecho_Db::get();
        $rows = $db->fetchAll($db->select()->from('table.comments')->where('table.comments.status = ?', 'approved')
        ->where('type = ?', 'comment')
        ->where('ownerId <> authorId')
        ->order('table.comments.created', Typecho_Db::SORT_DESC)
        ->limit($num));

        foreach ($rows as $row) {
            $comment = self::getComment($row['coid']);
            $output[] = array(
                'permalink' => $comment->permalink,
                'mail' => $row['mail'],
                'author' => $row['author'],
            );
        }

        return $output;
    }

    /**
     * 文章上一篇
     */
    public static function thePrev($archive)
    {
        $db = Typecho_Db::get();
        $content = $db->fetchRow($db->select()->from('table.contents')->where('table.contents.created < ?', $archive->created)
            ->where('table.contents.status = ?', 'publish')
            ->where('table.contents.type = ?', $archive->type)
            ->where('table.contents.password IS NULL')
            ->order('table.contents.created', Typecho_Db::SORT_DESC)
            ->limit(1));

        if ($content) {
            return self::getPost($content['cid']);    
        } else {
            return null;
        }
    }

    /**
     * 文章下一篇
     */
    public static function theNext($archive)
    {
        $db = Typecho_Db::get();
        $currentTime = (class_exists('Typecho_Date') && method_exists('Typecho_Date', 'time'))
            ? Typecho_Date::time()
            : time();

        $content = $db->fetchRow($db->select()->from('table.contents')->where('table.contents.created > ? AND table.contents.created < ?',
            $archive->created, $currentTime)
            ->where('table.contents.status = ?', 'publish')
            ->where('table.contents.type = ?', $archive->type)
            ->where('table.contents.password IS NULL')
            ->order('table.contents.created', Typecho_Db::SORT_ASC)
            ->limit(1));

        if ($content) {
            return self::getPost($content['cid']);    
        } else {
            return null;
        }
    }

    /**
     * 内容归档
     * 
     * @return array
     */
    public static function archives($widget, $excerpt = false)
    {
        $db = Typecho_Db::get();
        $rows = $db->fetchAll($db->select()
                    ->from('table.contents')
                    ->order('table.contents.created', Typecho_Db::SORT_DESC)
                    ->where('table.contents.type = ?', 'post')
                    ->where('table.contents.status = ?', 'publish')
                    ->where('table.contents.created < ?', time()));

        $stat = array();
        foreach ($rows as $row) {
            // 用文章自身的内容组件计算 permalink，避免归档页上下文把链接统一解析成当前归档地址。
            $post = Widget_Abstract_Contents::alloc();
            $row = $post->push($row);
            $arr = array(
                'title' => $row['title'],
                'permalink' => $post->permalink,
                'categories' => self::getCategories($row['cid']));

            if(Utils::isPluginAvailable('VOID')) {
                $arr['words'] = $row['wordCount'];
            }
            
            if($excerpt){
                $arr['excerpt'] = substr($row['content'], 30);
            }
            $stat[date('Y', $row['created'])][$row['created']] = $arr;
        }
        return $stat;
    }

    /**
     * 文章标签
     * 
     * @return array
     */
    public static function getTags($cid)
    {
        $db = Typecho_Db::get();
        $rows = $db->fetchAll($db->select('mid')
            ->from('table.relationships')
            ->where("cid = ?", $cid));
        
        $metas = array();
        foreach ($rows as $row) {
            $meta = self::getMeta($row['mid']);
            if ($meta->type == 'tag') {
                $meta = array('name' => $meta->name,
                    'permalink' => $meta->permalink);
                $metas[] = $meta;
            }
        }

        return $metas;
    }

    /**
     * 文章分类
     * 
     * @return array
     */
    public static function getCategories($cid)
    {
        $rows = Widget_Metas_Category_Related::allocWithAlias($cid, array('cid' => $cid))
            ->toArray(array('name', 'permalink'));
        
        $metas = array();
        foreach ($rows as $row) {
            $metas[] = array(
                'name' => $row['name'],
                'permalink' => $row['permalink']
            );
        }
        return $metas;
    }
}

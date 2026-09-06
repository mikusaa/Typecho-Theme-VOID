<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class VOID_Content_Transform_Emotes
{
    private static $manifestCache = array();

    public static function transform($content)
    {
        if (!is_string($content) || $content === '') {
            return $content;
        }

        if (strpos($content, '<') === false) {
            return self::replaceInText($content);
        }

        $result = '';
        $offset = 0;
        $length = strlen($content);
        $protectedTags = array();

        while ($offset < $length) {
            $tagStart = strpos($content, '<', $offset);
            if (false === $tagStart) {
                $tail = substr($content, $offset);
                $result .= empty($protectedTags) ? self::replaceInText($tail) : $tail;
                break;
            }

            $text = substr($content, $offset, $tagStart - $offset);
            $result .= empty($protectedTags) ? self::replaceInText($text) : $text;

            $tagEnd = VOID_Content_HtmlScanner::findTokenEnd($content, $tagStart);
            if (null === $tagEnd) {
                $result .= '<';
                $offset = $tagStart + 1;
                continue;
            }

            $tag = substr($content, $tagStart, $tagEnd - $tagStart + 1);
            $result .= $tag;
            self::updateProtectedTags($tag, $protectedTags);
            $offset = $tagEnd + 1;
        }

        return $result;
    }

    private static function updateProtectedTags($tag, &$protectedTags)
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

    private static function replaceInText($content)
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
                $content = self::replaceManifestItems($content, $package['id'], $package['pattern']);
            }
        }

        return $content;
    }

    private static function replaceManifestItems($content, $packageId, $pattern)
    {
        $items = self::getManifestItems($packageId);
        if (empty($items)) {
            return $content;
        }

        return preg_replace_callback($pattern, function ($matches) use ($items, $packageId) {
            $tokenKey = trim($matches[1]);
            if (!array_key_exists($tokenKey, $items)) {
                return $matches[0];
            }

            $html = self::renderManifestItem($packageId, $items[$tokenKey]);
            return null === $html ? $matches[0] : $html;
        }, $content);
    }

    private static function getManifestItems($packageId)
    {
        if (array_key_exists($packageId, self::$manifestCache)) {
            return self::$manifestCache[$packageId];
        }

        self::$manifestCache[$packageId] = array();
        $manifestDir = defined('VOID_EMOTE_MANIFEST_DIR')
            ? VOID_EMOTE_MANIFEST_DIR
            : dirname(__DIR__, 3) . '/assets/libs/emotes/packs';
        $manifestPath = rtrim($manifestDir, '/\\') . DIRECTORY_SEPARATOR . $packageId . '.json';

        if (!is_file($manifestPath) || !is_readable($manifestPath)) {
            return self::$manifestCache[$packageId];
        }

        $json = file_get_contents($manifestPath);
        if (false === $json || strlen($json) > 2 * 1024 * 1024) {
            return self::$manifestCache[$packageId];
        }

        $manifest = json_decode($json, true);
        if (!is_array($manifest)
            || !isset($manifest['id'])
            || $manifest['id'] !== $packageId
            || !isset($manifest['items'])
            || !is_array($manifest['items'])) {
            return self::$manifestCache[$packageId];
        }

        $items = array();
        $duplicates = array();
        foreach ($manifest['items'] as $item) {
            if (!is_array($item)) {
                continue;
            }

            $token = isset($item['token'])
                ? $item['token']
                : (isset($item['shortcode']) ? $item['shortcode'] : null);
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

        self::$manifestCache[$packageId] = $items;
        return $items;
    }

    private static function getManifestTokenKey($packageId, $token)
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

    private static function getAssetUrl($relativePath)
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

    private static function getDimension($value)
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

    private static function renderManifestItem($packageId, $item)
    {
        if (!isset($item['label']) || !is_string($item['label']) || trim($item['label']) === '') {
            return null;
        }

        $label = trim($item['label']);
        $width = isset($item['width']) ? self::getDimension($item['width']) : null;
        $height = isset($item['height']) ? self::getDimension($item['height']) : null;

        if ($packageId === 'bangumi') {
            $posterPath = isset($item['poster'])
                ? $item['poster']
                : (isset($item['preview']) ? $item['preview'] : null);
            if (isset($item['animated']) && is_string($item['animated'])) {
                $animatedPath = $item['animated'];
            } elseif ((!isset($item['animated']) || $item['animated'] === true) && isset($item['src'])) {
                $animatedPath = $item['src'];
            } else {
                $animatedPath = null;
            }

            $posterUrl = self::getAssetUrl(
                is_string($posterPath) ? $packageId . '/' . $posterPath : null
            );
            $animatedUrl = self::getAssetUrl(
                is_string($animatedPath) ? $packageId . '/' . $animatedPath : null
            );
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

        $srcPath = isset($item['src'])
            ? $item['src']
            : (isset($item['poster']) ? $item['poster'] : null);
        $srcUrl = self::getAssetUrl(is_string($srcPath) ? $packageId . '/' . $srcPath : null);
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

    private static function escapeHtml($value)
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class VOID_Content_Transform_Images
{
    public static function transform($content, $feedMode, $galleryMode, $settings)
    {
        if (!is_string($content) || $content === '' || stripos($content, '<img') === false) {
            return $content;
        }

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
            $tagEnd = VOID_Content_HtmlScanner::findTokenEnd($content, $tagStart);
            if (null === $tagEnd) {
                $result .= '<';
                $offset = $tagStart + 1;
                continue;
            }

            $tag = substr($content, $tagStart, $tagEnd - $tagStart + 1);
            if (empty($protectedTags)
                && preg_match('/\A<\s*img\b/i', $tag)
                && !VOID_Content_HtmlScanner::hasAttribute($tag, 'data-void-image-content')) {
                $result .= self::renderContentImage($tag, $feedMode, $galleryMode, $settings);
            } else {
                $result .= $tag;
            }

            self::updateProtectedTags($tag, $protectedTags);
            $offset = $tagEnd + 1;
        }

        return $result;
    }

    public static function getBannerDimensions($banner, $bannerMeta = null)
    {
        if (!is_string($banner)) {
            return null;
        }

        $banner = trim($banner);
        if ($banner === '') {
            return null;
        }

        if (is_string($bannerMeta) && trim($bannerMeta) !== '') {
            $meta = json_decode($bannerMeta, true);
            if (is_array($meta)
                && isset($meta['version'], $meta['source'], $meta['width'], $meta['height'])
                && $meta['version'] === 1
                && is_string($meta['source'])
                && $meta['source'] === $banner
                && is_int($meta['width'])
                && is_int($meta['height'])
                && $meta['width'] >= 1
                && $meta['width'] <= 100000
                && $meta['height'] >= 1
                && $meta['height'] <= 100000) {
                return array($meta['width'], $meta['height']);
            }
        }

        return self::getDimensions($banner);
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

    private static function getDimensions($src)
    {
        if (!is_string($src) || trim($src) === '') {
            return null;
        }

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

        $range = array('options' => array('min_range' => 1, 'max_range' => 100000));
        $width = filter_var($widthText, FILTER_VALIDATE_INT, $range);
        $height = filter_var($heightText, FILTER_VALIDATE_INT, $range);
        if (false === $width || false === $height) {
            return null;
        }

        return array((int) $width, (int) $height);
    }

    private static function renderContentImage($tag, $feedMode, $galleryMode, $settings)
    {
        $srcOriginal = VOID_Content_HtmlScanner::getAttribute($tag, 'src');
        if (!is_string($srcOriginal) || $srcOriginal === '') {
            return $tag;
        }

        $alt = VOID_Content_HtmlScanner::getAttribute($tag, 'alt');
        $alt = null === $alt ? '' : $alt;
        $displayDimensions = self::getDimensions($srcOriginal);
        $dimensionAttributes = '';
        $figureAttributes = '';

        if (null !== $displayDimensions) {
            $width = $displayDimensions[0];
            $height = $displayDimensions[1];
            $ratio = rtrim(rtrim(number_format($width / $height, 4, '.', ''), '0'), '.');
            $dimensionAttributes = ' width="' . $width . '" height="' . $height . '"';
            $figureAttributes = ' data-void-image-width="' . $width
                . '" data-void-image-height="' . $height
                . '" style="--void-image-ratio: ' . $ratio . '"';
        }

        $escapedSrc = self::escapeHtml($srcOriginal);
        $escapedAlt = self::escapeHtml($alt);
        $figcaption = '';
        if ($alt !== '' && !empty($settings['parseFigcaption'])) {
            $figcaption = '<figcaption>' . $escapedAlt . '</figcaption>';
        }

        if ($feedMode) {
            return '<figure><img src="' . $escapedSrc . '" alt="' . $escapedAlt . '"'
                . $dimensionAttributes . ' decoding="async">' . $figcaption . '</figure>';
        }

        $lazyload = !empty($settings['lazyload']);
        $scriptLazyload = $lazyload && $galleryMode;
        $imageClass = '';
        $imageSrc = $escapedSrc;
        $lazyAttributes = '';

        if ($scriptLazyload) {
            $imageClass = 'lazyload';
            $lazyAttributes = ' data-src="' . $escapedSrc . '"';
            $imageSrc = '';
        } elseif ($lazyload) {
            $lazyAttributes = ' loading="lazy"';
        }

        $classAttribute = $imageClass === '' ? '' : ' class="' . $imageClass . '"';
        $image = '<img data-void-image-content' . $dimensionAttributes . $classAttribute
            . ' alt="' . $escapedAlt . '"' . $lazyAttributes
            . ' src="' . $imageSrc . '" decoding="async">';

        return '<figure data-void-image-item' . $figureAttributes
            . '><a class="void-image-link' . ($scriptLazyload ? ' lazyload-container' : '')
            . '" data-void-image-zoom no-pjax href="' . $escapedSrc . '">' . $image . '</a>'
            . $figcaption . '</figure>';
    }

    private static function escapeHtml($value)
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}

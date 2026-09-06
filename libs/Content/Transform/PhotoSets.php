<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class VOID_Content_Transform_PhotoSets
{
    private static $containerClass = 'photos';

    public static function transform($content, $largePhotoSet)
    {
        self::$containerClass = $largePhotoSet ? 'photos large' : 'photos';
        $pattern = '/(?:<p>\s*)?\[photos(?=\s|\])[^\]]*\](.*?)\[\/photos\](?:\s*<\/p>)?/is';
        return preg_replace_callback($pattern, array(__CLASS__, 'render'), $content);
    }

    /**
     * Unwrap rendered sets for Feed, or remove them with their contents for excerpts.
     */
    public static function unwrap($content, $removeContents)
    {
        if (!is_string($content) || stripos($content, '<div') === false) {
            return $content;
        }

        $result = '';
        $offset = 0;
        $length = strlen($content);

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
            if (self::isContainerTag($tag) && !preg_match('/\/\s*>\z/', $tag)) {
                $closing = VOID_Content_HtmlScanner::findClosingElement($content, 'div', $tagEnd + 1);
                if (null !== $closing) {
                    if (!$removeContents) {
                        $inner = substr($content, $tagEnd + 1, $closing[0] - $tagEnd - 1);
                        $result .= self::unwrap($inner, false);
                    }
                    $offset = $closing[1] + 1;
                    continue;
                }
            }

            $result .= $tag;
            $offset = $tagEnd + 1;
        }

        return $result;
    }

    private static function render($match)
    {
        $content = preg_replace('/<br\s*\/?>/i', '', $match[1]);
        $content = str_replace(array('<p>', '</p>'), '', $content);
        $content = trim($content);
        preg_match_all('/<figure\b[^>]*>/i', $content, $figures);
        $count = 0;
        foreach ($figures[0] as $figure) {
            if (VOID_Content_HtmlScanner::hasAttribute($figure, 'data-void-image-item')) {
                $count++;
            }
        }
        $layout = $count === 2 ? 'pair' : ($count >= 3 ? 'strip' : 'single');
        $accessibility = $layout === 'strip'
            ? ' tabindex="0" role="region" aria-label="横向图片集，共 ' . $count . ' 张"'
            : '';

        return '<div class="' . self::$containerClass
            . '" data-void-photo-set data-void-photo-count="' . $count
            . '" data-void-photo-layout="' . $layout . '"' . $accessibility . '>'
            . $content . '</div>';
    }

    private static function isContainerTag($tag)
    {
        if (!preg_match('/\A<\s*div\b/i', $tag)) {
            return false;
        }

        $attributes = VOID_Content_HtmlScanner::parseAttributes($tag);
        if (array_key_exists('data-void-photo-set', $attributes)) {
            return true;
        }

        if (!isset($attributes['class']) || !is_string($attributes['class'])) {
            return false;
        }

        $classes = preg_split('/\s+/', trim($attributes['class']));
        return in_array('photos', $classes, true);
    }
}

<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

/**
 * Authoritative ordering for Typecho's markdown, contentEx and excerptEx hooks.
 */
class VOID_Content_Pipeline
{
    private static $currentTocId = 0;

    public static function markdown($text)
    {
        return VOID_Content_Transform_Markdown::transform($text);
    }

    public static function contentEx($data, $widget, $last, $settings)
    {
        $text = self::getFilteredText($data, $last);
        if (!is_string($text) || $text === '') {
            return $text;
        }

        $isFeedContext = self::isFeedContext($widget);
        $isGalleryContext = self::isGalleryContext($widget);
        $text = VOID_Content_Transform_Markdown::parseRuby($text);
        $text = VOID_Content_Transform_Images::transform(
            $text,
            $isFeedContext,
            $isGalleryContext,
            $settings
        );
        $text = VOID_Content_Transform_Emotes::transform($text);
        $text = VOID_Content_Transform_PhotoSets::transform(
            $text,
            !empty($settings['largePhotoSet'])
        );
        $text = VOID_Content_Transform_Alerts::transform($text);

        if ($isFeedContext) {
            return self::sanitizeFeedHtml($text);
        }

        return self::parseHeader($text);
    }

    public static function excerptEx($data, $widget, $last, $settings)
    {
        $text = self::getFilteredText($data, $last);
        if (!is_string($text) || $text === '') {
            return $text;
        }

        $text = VOID_Content_Transform_Markdown::parseRuby($text);
        $text = VOID_Content_Transform_Emotes::transform($text);
        $text = VOID_Content_Transform_Alerts::transform($text);
        $text = VOID_Content_Transform_PhotoSets::unwrap($text, true);
        return preg_replace('/\[(?:photos(?=\s|\])[^\]]*|\/photos\s*)\]/i', '', $text);
    }

    public static function parseHeader($content)
    {
        $pattern = '/\<h([2-6])(.*?)\>(.*?)\<\/h.*?\>/s';
        return preg_replace_callback($pattern, array(__CLASS__, 'parseHeaderCallback'), $content);
    }

    public static function parseHeaderCallback($matches)
    {
        $id = 'toc_' . (self::$currentTocId++);
        return '<h' . $matches[1] . $matches[2] . ' id="' . $id . '">'
            . $matches[3] . '</h' . $matches[1] . '>';
    }

    private static function getFilteredText($data, $last)
    {
        return null !== $last ? $last : $data;
    }

    private static function isFeedContext($widget)
    {
        if (!is_object($widget) || !isset($widget->parameter)) {
            return false;
        }

        return $widget->parameter->__get('type') == 'feed'
            || (bool) $widget->parameter->__get('isFeed');
    }

    private static function isGalleryContext($widget)
    {
        if (!is_object($widget)
            || (!property_exists($widget, 'template') && !method_exists($widget, '__get'))) {
            return false;
        }

        return $widget->template === 'Gallery.php';
    }

    private static function sanitizeFeedHtml($content)
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
        $content = VOID_Content_Transform_PhotoSets::unwrap($content, false);
        $content = preg_replace('/\s+no-pjax(?=[\s>])/i', '', $content);
        return preg_replace('/\s+(?:class|style|loading|data-[a-z0-9_-]+)="[^"]*"/i', '', $content);
    }
}

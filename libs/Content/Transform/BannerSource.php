<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class VOID_Content_Transform_BannerSource
{
    public static function shouldShow($archive, $displayMode)
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

    public static function render($text)
    {
        $text = trim((string) $text);
        if ($text === '') {
            return '';
        }

        $content = '';
        $segments = self::splitSegments($text);

        foreach ($segments as $segment) {
            if ($segment['type'] === 'text') {
                $content .= htmlspecialchars($segment['content'], ENT_QUOTES, 'UTF-8');
                continue;
            }

            $linkHtml = self::renderLink($segment['label'], $segment['url']);
            if ($linkHtml === '') {
                $content .= htmlspecialchars($segment['raw'], ENT_QUOTES, 'UTF-8');
                continue;
            }

            $content .= $linkHtml;
        }

        return '封面图来源：' . $content;
    }

    private static function splitSegments($text)
    {
        $segments = array();
        $offset = 0;
        $length = strlen($text);

        while ($offset < $length) {
            $nextPosition = self::findNextTokenPosition($text, $offset);

            if ($nextPosition === false) {
                self::appendTextSegment($segments, substr($text, $offset));
                break;
            }

            if ($nextPosition > $offset) {
                self::appendTextSegment(
                    $segments,
                    substr($text, $offset, $nextPosition - $offset)
                );
            }

            $segment = self::parseTokenAt($text, $nextPosition);
            if (is_array($segment)) {
                $segments[] = $segment;
                $offset = $nextPosition + strlen($segment['raw']);
                continue;
            }

            self::appendTextSegment($segments, substr($text, $nextPosition, 1));
            $offset = $nextPosition + 1;
        }

        if (empty($segments)) {
            self::appendTextSegment($segments, $text);
        }

        return $segments;
    }

    private static function findNextTokenPosition($text, $offset)
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

    private static function parseTokenAt($text, $offset)
    {
        $htmlSegment = self::parseHtmlLinkAt($text, $offset);
        if (is_array($htmlSegment)) {
            return $htmlSegment;
        }

        return self::parseMarkdownLinkAt($text, $offset);
    }

    private static function parseHtmlLinkAt($text, $offset)
    {
        if (!preg_match('/\G<a\b(?<htmlAttrs>[^>]*)>(?<htmlLabel>.*?)<\/a>/isu', $text, $matches, 0, $offset)) {
            return null;
        }

        return array(
            'type' => 'link',
            'label' => self::extractHtmlLabel($matches['htmlLabel']),
            'url' => self::extractHtmlHref($matches['htmlAttrs']),
            'raw' => $matches[0]
        );
    }

    private static function parseMarkdownLinkAt($text, $offset)
    {
        $length = strlen($text);
        if ($offset >= $length || substr($text, $offset, 1) !== '[') {
            return null;
        }

        $labelEnd = self::findMarkdownDelimiter($text, $offset + 1, ']');
        if ($labelEnd === false || $labelEnd + 1 >= $length
            || substr($text, $labelEnd + 1, 1) !== '(') {
            return null;
        }

        $urlStart = $labelEnd + 2;
        $urlEnd = self::findMarkdownUrlEnd($text, $urlStart);
        if ($urlEnd === false) {
            return null;
        }

        $raw = substr($text, $offset, $urlEnd - $offset + 1);
        $label = substr($text, $offset + 1, $labelEnd - $offset - 1);
        $url = substr($text, $urlStart, $urlEnd - $urlStart);

        return array(
            'type' => 'link',
            'label' => trim(self::decodeMarkdownText($label)),
            'url' => trim(self::decodeMarkdownText($url)),
            'raw' => $raw
        );
    }

    private static function findMarkdownDelimiter($text, $offset, $delimiter)
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

    private static function findMarkdownUrlEnd($text, $offset)
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

    private static function decodeMarkdownText($text)
    {
        return preg_replace('/\\\\([\\\\\[\]\(\)])/u', '$1', (string) $text);
    }

    private static function appendTextSegment(&$segments, $content)
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

    private static function extractHtmlHref($attributes)
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

    private static function extractHtmlLabel($label)
    {
        $label = strip_tags((string) $label);
        return trim(html_entity_decode($label, ENT_QUOTES, 'UTF-8'));
    }

    private static function renderLink($label, $url)
    {
        $label = trim((string) $label);
        $url = trim((string) $url);

        if ($label === '' || !self::isSafeUrl($url)) {
            return '';
        }

        return '<a no-pjax target="_blank" rel="noopener noreferrer nofollow" href="'
            . htmlspecialchars($url, ENT_QUOTES, 'UTF-8') . '">'
            . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</a>';
    }

    private static function isSafeUrl($url)
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
}

<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class VOID_Content_Transform_Alerts
{
    private static $types = array(
        'NOTE' => array('slug' => 'note', 'title' => '说明'),
        'TIP' => array('slug' => 'tip', 'title' => '提示'),
        'IMPORTANT' => array('slug' => 'important', 'title' => '重要'),
        'WARNING' => array('slug' => 'warning', 'title' => '警告'),
        'CAUTION' => array('slug' => 'caution', 'title' => '危险')
    );

    public static function transform($content)
    {
        if (!is_string($content) || $content === ''
            || (strpos($content, '[!') === false && stripos($content, '[notice]') === false)) {
            return $content;
        }

        $result = '';
        $offset = 0;
        $length = strlen($content);
        $openElements = array();

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
            $tagInfo = VOID_Content_HtmlScanner::parseTag($tag);
            if (null === $tagInfo) {
                $result .= $tag;
                $offset = $tagEnd + 1;
                continue;
            }

            if (!$tagInfo['closing'] && !$tagInfo['selfClosing']
                && VOID_Content_HtmlScanner::isRawTextTag($tagInfo['name'])) {
                $closing = VOID_Content_HtmlScanner::findClosingElement(
                    $content,
                    $tagInfo['name'],
                    $tagEnd + 1
                );
                if (null === $closing) {
                    $result .= substr($content, $tagStart);
                    break;
                }

                $result .= substr($content, $tagStart, $closing[1] - $tagStart + 1);
                $offset = $closing[1] + 1;
                continue;
            }

            if (empty($openElements) && !$tagInfo['closing'] && !$tagInfo['selfClosing']
                && ($tagInfo['name'] === 'blockquote' || $tagInfo['name'] === 'p')) {
                $closing = VOID_Content_HtmlScanner::findClosingElement(
                    $content,
                    $tagInfo['name'],
                    $tagEnd + 1
                );
                if (null !== $closing) {
                    $inner = substr($content, $tagEnd + 1, $closing[0] - $tagEnd - 1);
                    $transformed = $tagInfo['name'] === 'blockquote'
                        ? self::transformGitHubAlert($tag, $inner)
                        : self::transformLegacyNotice($tag, $inner);

                    if (null !== $transformed) {
                        $result .= $transformed;
                        $offset = $closing[1] + 1;
                        continue;
                    }

                    if ($tagInfo['name'] === 'blockquote') {
                        $result .= substr($content, $tagStart, $closing[1] - $tagStart + 1);
                        $offset = $closing[1] + 1;
                        continue;
                    }
                }
            }

            $result .= $tag;
            self::updateElementStack($tagInfo, $openElements);
            $offset = $tagEnd + 1;
        }

        return $result;
    }

    private static function transformGitHubAlert($openingTag, $inner)
    {
        $sections = self::splitGitHubAlertSections($inner);
        if (count($sections) > 1) {
            $rendered = '';
            foreach ($sections as $section) {
                $alert = self::transformGitHubAlertSingle($openingTag, $section);
                if (null === $alert) {
                    return null;
                }
                $rendered .= $alert;
            }
            return $rendered;
        }

        return self::transformGitHubAlertSingle($openingTag, $inner);
    }

    private static function splitGitHubAlertSections($inner)
    {
        $sections = array();
        $current = '';
        $offset = 0;
        $length = strlen($inner);
        $openElements = array();

        while ($offset < $length) {
            $tagStart = strpos($inner, '<', $offset);
            if (false === $tagStart) {
                $current .= substr($inner, $offset);
                break;
            }

            $current .= substr($inner, $offset, $tagStart - $offset);
            $tagEnd = VOID_Content_HtmlScanner::findTokenEnd($inner, $tagStart);
            if (null === $tagEnd) {
                $current .= '<';
                $offset = $tagStart + 1;
                continue;
            }

            $tag = substr($inner, $tagStart, $tagEnd - $tagStart + 1);
            $tagInfo = VOID_Content_HtmlScanner::parseTag($tag);
            if (null === $tagInfo) {
                $current .= $tag;
                $offset = $tagEnd + 1;
                continue;
            }

            if (!$tagInfo['closing'] && !$tagInfo['selfClosing']
                && $tagInfo['name'] === 'p' && empty($openElements)) {
                $closing = VOID_Content_HtmlScanner::findClosingElement($inner, 'p', $tagEnd + 1);
                if (null !== $closing) {
                    $paragraphInner = substr(
                        $inner,
                        $tagEnd + 1,
                        $closing[0] - $tagEnd - 1
                    );
                    if (self::isGitHubAlertParagraph($paragraphInner)
                        && trim($current) !== '') {
                        $sections[] = $current;
                        $current = '';
                    }

                    $current .= substr($inner, $tagStart, $closing[1] - $tagStart + 1);
                    $offset = $closing[1] + 1;
                    continue;
                }
            }

            $current .= $tag;
            self::updateElementStack($tagInfo, $openElements);
            $offset = $tagEnd + 1;
        }

        if ($current !== '' || empty($sections)) {
            $sections[] = $current;
        }

        return $sections;
    }

    private static function isGitHubAlertParagraph($content)
    {
        return preg_match('/\A\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/', $content) === 1;
    }

    private static function transformGitHubAlertSingle($openingTag, $inner)
    {
        $attributes = VOID_Content_HtmlScanner::parseAttributes($openingTag);
        if (!empty($attributes)) {
            return null;
        }

        if (!preg_match('/\A\s*/', $inner, $leading)) {
            return null;
        }
        $paragraphStart = strlen($leading[0]);
        if ($paragraphStart >= strlen($inner)) {
            return null;
        }

        if ($inner[$paragraphStart] !== '<') {
            $paragraphInner = substr($inner, $paragraphStart);
            $remainingParagraph = self::stripGitHubAlertMarker($paragraphInner, $type);
            if (null === $remainingParagraph) {
                return null;
            }

            $body = trim($remainingParagraph) === '' ? '' : '<p>' . $remainingParagraph . '</p>';
            return self::renderAlertBlock($type, $body);
        }

        $paragraphTagEnd = VOID_Content_HtmlScanner::findTokenEnd($inner, $paragraphStart);
        if (null === $paragraphTagEnd) {
            return null;
        }
        $paragraphTag = substr($inner, $paragraphStart, $paragraphTagEnd - $paragraphStart + 1);
        $paragraphInfo = VOID_Content_HtmlScanner::parseTag($paragraphTag);
        if (null === $paragraphInfo || $paragraphInfo['name'] !== 'p'
            || $paragraphInfo['closing'] || $paragraphInfo['selfClosing']
            || !empty(VOID_Content_HtmlScanner::parseAttributes($paragraphTag))) {
            return null;
        }

        $paragraphClosing = VOID_Content_HtmlScanner::findClosingElement(
            $inner,
            'p',
            $paragraphTagEnd + 1
        );
        if (null === $paragraphClosing) {
            return null;
        }
        $paragraphInner = substr(
            $inner,
            $paragraphTagEnd + 1,
            $paragraphClosing[0] - $paragraphTagEnd - 1
        );
        $remainingParagraph = self::stripGitHubAlertMarker($paragraphInner, $type);
        if (null === $remainingParagraph) {
            return null;
        }

        $body = '';
        if (trim($remainingParagraph) !== '') {
            $body .= '<p>' . $remainingParagraph . '</p>';
        }
        $body .= substr($inner, $paragraphClosing[1] + 1);

        return self::renderAlertBlock($type, $body);
    }

    private static function stripGitHubAlertMarker($content, &$type)
    {
        if (!preg_match('/\A\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/', $content, $marker)) {
            return null;
        }

        $remaining = substr($content, strlen($marker[0]));
        if (trim($remaining) === '') {
            $type = self::$types[$marker[1]];
            return '';
        }

        if (!preg_match('/\A[ \t]*(?:\r?\n|<br\s*\/?>)[ \t\r\n]*/i', $remaining, $separator)) {
            return null;
        }

        $type = self::$types[$marker[1]];
        return substr($remaining, strlen($separator[0]));
    }

    private static function transformLegacyNotice($openingTag, $inner)
    {
        if (!empty(VOID_Content_HtmlScanner::parseAttributes($openingTag))
            || !preg_match('/\A\s*\[notice\](.*?)\[\/notice\]\s*\z/is', $inner, $matches)) {
            return null;
        }

        if (stripos($matches[1], '<br') !== false
            || preg_match('/<\s*\/?\s*(?:p|div|ul|ol|li|pre|blockquote|table|h[1-6]|hr)\b/i', $matches[1])) {
            return null;
        }

        $body = trim($matches[1]) === '' ? '' : '<p>' . $matches[1] . '</p>';
        return self::renderAlertBlock(self::$types['NOTE'], $body);
    }

    private static function renderAlertBlock($type, $body)
    {
        return '<blockquote class="void-alert void-alert--' . $type['slug'] . '">'
            . '<p class="void-alert__title">' . $type['title'] . '</p>'
            . $body . '</blockquote>';
    }

    private static function updateElementStack($tagInfo, &$openElements)
    {
        if ($tagInfo['selfClosing']) {
            return;
        }

        if (!$tagInfo['closing']) {
            $openElements[] = $tagInfo['name'];
            return;
        }

        for ($index = count($openElements) - 1; $index >= 0; $index--) {
            if ($openElements[$index] === $tagInfo['name']) {
                array_splice($openElements, $index);
                return;
            }
        }
    }
}

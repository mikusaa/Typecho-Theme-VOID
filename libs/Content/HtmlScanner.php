<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

/**
 * Minimal HTML token scanner shared by content transforms.
 */
class VOID_Content_HtmlScanner
{
    /**
     * Find the end of a tag-like token without treating quoted > as a boundary.
     */
    public static function findTokenEnd($content, $offset)
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
     * Parse the name and boundary properties of an opening or closing tag.
     */
    public static function parseTag($tag)
    {
        if (!preg_match('/\A<\s*(\/?)\s*([a-z][a-z0-9:_-]*)\b/i', $tag, $matches)) {
            return null;
        }

        $name = strtolower($matches[2]);
        $voidTags = array('area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
            'link', 'meta', 'param', 'source', 'track', 'wbr');

        return array(
            'name' => $name,
            'closing' => $matches[1] === '/',
            'selfClosing' => preg_match('/\/\s*>\z/', $tag) === 1
                || in_array($name, $voidTags, true)
        );
    }

    /**
     * Find the closing token paired with an opening element.
     */
    public static function findClosingElement($content, $name, $offset)
    {
        if (self::isRawTextTag($name)) {
            return self::findClosingRawTextElement($content, $name, $offset);
        }

        $depth = 1;
        $length = strlen($content);
        while ($offset < $length) {
            $tagStart = strpos($content, '<', $offset);
            if (false === $tagStart) {
                return null;
            }

            $tagEnd = self::findTokenEnd($content, $tagStart);
            if (null === $tagEnd) {
                $offset = $tagStart + 1;
                continue;
            }

            $tag = substr($content, $tagStart, $tagEnd - $tagStart + 1);
            $tagInfo = self::parseTag($tag);
            if (null !== $tagInfo && !$tagInfo['closing'] && !$tagInfo['selfClosing']
                && self::isRawTextTag($tagInfo['name'])) {
                $rawClosing = self::findClosingRawTextElement(
                    $content,
                    $tagInfo['name'],
                    $tagEnd + 1
                );
                if (null === $rawClosing) {
                    return null;
                }
                $offset = $rawClosing[1] + 1;
                continue;
            }

            if (null !== $tagInfo && $tagInfo['name'] === $name) {
                if ($tagInfo['closing']) {
                    $depth--;
                    if ($depth === 0) {
                        return array($tagStart, $tagEnd);
                    }
                } elseif (!$tagInfo['selfClosing']) {
                    $depth++;
                }
            }

            $offset = $tagEnd + 1;
        }

        return null;
    }

    public static function isRawTextTag($name)
    {
        return in_array($name, array('script', 'style', 'textarea', 'title'), true);
    }

    /**
     * Parse attributes without allowing later duplicates to override the first value.
     */
    public static function parseAttributes($tag)
    {
        $attributes = array();
        if (!preg_match('/\A<\s*[a-z][a-z0-9:_-]*/i', $tag, $tagMatch)) {
            return $attributes;
        }

        $offset = strlen($tagMatch[0]);
        $length = strlen($tag);
        while ($offset < $length) {
            while ($offset < $length && ctype_space($tag[$offset])) {
                $offset++;
            }
            if ($offset >= $length || $tag[$offset] === '>'
                || ($tag[$offset] === '/' && $offset + 1 < $length && $tag[$offset + 1] === '>')) {
                break;
            }

            $nameStart = $offset;
            while ($offset < $length
                && !ctype_space($tag[$offset])
                && strpos('=/>', $tag[$offset]) === false) {
                $offset++;
            }
            if ($offset === $nameStart) {
                $offset++;
                continue;
            }

            $name = strtolower(substr($tag, $nameStart, $offset - $nameStart));
            while ($offset < $length && ctype_space($tag[$offset])) {
                $offset++;
            }

            $value = null;
            if ($offset < $length && $tag[$offset] === '=') {
                $offset++;
                while ($offset < $length && ctype_space($tag[$offset])) {
                    $offset++;
                }

                if ($offset < $length && ($tag[$offset] === '"' || $tag[$offset] === "'")) {
                    $quote = $tag[$offset++];
                    $valueStart = $offset;
                    while ($offset < $length && $tag[$offset] !== $quote) {
                        $offset++;
                    }
                    $value = substr($tag, $valueStart, $offset - $valueStart);
                    if ($offset < $length) {
                        $offset++;
                    }
                } else {
                    $valueStart = $offset;
                    while ($offset < $length
                        && !ctype_space($tag[$offset])
                        && $tag[$offset] !== '>') {
                        $offset++;
                    }
                    $value = substr($tag, $valueStart, $offset - $valueStart);
                }
            }

            if (!array_key_exists($name, $attributes)) {
                $attributes[$name] = $value;
            }
        }

        return $attributes;
    }

    public static function hasAttribute($tag, $name)
    {
        $attributes = self::parseAttributes($tag);
        return array_key_exists(strtolower($name), $attributes);
    }

    public static function getAttribute($tag, $name)
    {
        $attributes = self::parseAttributes($tag);
        $key = strtolower($name);
        if (!array_key_exists($key, $attributes) || null === $attributes[$key]) {
            return null;
        }

        return html_entity_decode($attributes[$key], ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    private static function findClosingRawTextElement($content, $name, $offset)
    {
        $pattern = '/<\s*\/\s*' . preg_quote($name, '/') . '\s*>/i';
        if (!preg_match($pattern, $content, $matches, PREG_OFFSET_CAPTURE, $offset)) {
            return null;
        }

        $tagStart = $matches[0][1];
        return array($tagStart, $tagStart + strlen($matches[0][0]) - 1);
    }
}

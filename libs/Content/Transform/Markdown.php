<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class VOID_Content_Transform_Markdown
{
    public static function transform($text)
    {
        if (!is_string($text) || $text === '') {
            return $text;
        }

        $pattern = '/\[links.*?\](.*?)\[\/links\]/s';
        $text = preg_replace_callback($pattern, array(__CLASS__, 'flattenBoard'), $text);

        $pattern = '/<div class="board-list link-list">(.*?)<\/div>/s';
        $text = preg_replace_callback($pattern, array(__CLASS__, 'flattenBoard'), $text);

        $pattern = '/\[links.*?\](.*?)\[\/links\]/s';
        $text = preg_replace_callback($pattern, array(__CLASS__, 'renderBoard'), $text);

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

    public static function flattenBoard($matches)
    {
        $text = str_replace(array("\r\n", "\r", "\n"), "", $matches[1]);
        return '[links]' . $text . '[/links]';
    }

    public static function renderBoard($matches)
    {
        $text = "\n\n<div class=\"board-list link-list\">%boards%</div>\n\n";
        $pattern = '/\[(.*?)\]\((.*?)\)\+\((.*?)\)/s';
        $replacement = '<a target="_blank" href="$2" class="board-item link-item"><div class="board-thumb" data-thumb="$3"></div><div class="board-title">$1</div></a>';
        $boards = trim(preg_replace($pattern, $replacement, $matches[1]));

        return str_replace('%boards%', $boards, $text);
    }

    public static function parseRuby($string)
    {
        $pattern = '/\{\{(.+?):(.+?)\}\}/us';
        $replacement = '<ruby>$1<rp>(</rp><rt>$2</rt><rp>)</rp></ruby>';
        return preg_replace($pattern, $replacement, $string);
    }
}

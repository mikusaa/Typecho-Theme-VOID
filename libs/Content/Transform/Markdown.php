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

        // Typecho 只对 Markdown 内容调用该 Hook，且传入前已去掉 <!--markdown--> 标记。
        $text = str_replace("```objective-c", "```objectivec", $text);
        $text = str_replace("```c++", "```cpp", $text);
        $text = str_replace("```c#", "```csharp", $text);
        $text = str_replace("```f#", "```fsharp", $text);
        $text = str_replace("```F#", "```Fsharp", $text);

        return Markdown::convert($text);
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
        $boards = trim(preg_replace_callback($pattern, array(__CLASS__, 'renderBoardItem'), $matches[1]));

        return str_replace('%boards%', $boards, $text);
    }

    public static function renderBoardItem($matches)
    {
        $href = htmlspecialchars($matches[2], ENT_QUOTES, 'UTF-8', false);
        $thumb = htmlspecialchars($matches[3], ENT_QUOTES, 'UTF-8', false);
        return '<a target="_blank" href="' . $href . '" class="board-item link-item"><div class="board-thumb" data-thumb="'
            . $thumb . '"></div><div class="board-title">' . $matches[1] . '</div></a>';
    }

    public static function parseRuby($string)
    {
        $pattern = '/\{\{(.+?):(.+?)\}\}/us';
        $replacement = '<ruby>$1<rp>(</rp><rt>$2</rt><rp>)</rp></ruby>';
        return preg_replace($pattern, $replacement, $string);
    }
}

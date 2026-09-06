<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

require_once __DIR__ . '/Content/bootstrap.php';

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
    private static function contentSettings()
    {
        return isset($GLOBALS['VOIDSetting']) && is_array($GLOBALS['VOIDSetting'])
            ? $GLOBALS['VOIDSetting'] : array();
    }

    /**
     * 根据 cid 返回文章对象
     *
     * @return Widget_Abstract_Contents
     */
    public static function getPost($cid)
    {
        return VOID_Repository_ContentRepository::getPost($cid);
    }

    /**
     * 根据 cid 返回评论对象
     *
     * @return Widget_Abstract_Comments
     */
    public static function getComment($coid)
    {
        return VOID_Repository_ContentRepository::getComment($coid);
    }

    /**
     * 根据 mid 返回 meta 对象
     * 
     * @return Widget_Abstract_Metas
     */
    public static function getMeta($mid)
    {
        return VOID_Repository_ContentRepository::getMeta($mid);
    }

    /**
     * 获取完备标题的语义纯文本
     *
     * @return string
     */
    public static function titleText(Widget_Archive $archive)
    {
        ob_start();
        $archive->archiveTitle(array(
            'category'  =>  '分类 %s 下的文章',
            'search'    =>  '包含关键字 %s 的文章',
            'tag'       =>  '标签 %s 下的文章',
            'author'    =>  '%s 发布的文章'
        ), '', ' - ');
        $archiveTitle = ob_get_clean();

        ob_start();
        Helper::options()->title();
        $siteTitle = ob_get_clean();

        return Utils::decodeHtmlText($archiveTitle . $siteTitle);
    }

    /**
     * 输出完备的标题
     *
     * @return void
     */
    public static function title(Widget_Archive $archive)
    {
        echo Utils::escapeHtml(self::titleText($archive));
    }

    /**
     * 内容解析点钩子
     * 目录解析移至前端完成
     */
    static public function contentEx($data, $widget, $last)
    {
        return VOID_Content_Pipeline::contentEx($data, $widget, $last, self::contentSettings());
    }

    /**
     * 摘要解析点钩子
     */
    static public function excerptEx($data, $widget, $last)
    {
        return VOID_Content_Pipeline::excerptEx($data, $widget, $last, self::contentSettings());
    }

    /**
     * 解析文章内 h2 ~ h5 元素
     * 
     * @return string
     */
    static public function parseHeader($content)
    {
        return VOID_Content_Pipeline::parseHeader($content);
    }

    /**
     * 为内容中的 h2-h6 元素编号
     */
    static public function parseHeaderCallback($matchs)
    {
        return VOID_Content_Pipeline::parseHeaderCallback($matchs);
    }

    /**
     * 解析 GitHub Alerts 与单段旧版 notice 别名。
     *
     * @return string
     */
    static public function parseAlerts($content)
    {
        return VOID_Content_Transform_Alerts::transform($content);
    }

    /**
     * 保留旧公开入口。
     */
    static public function parseNotice($content)
    {
        return VOID_Content_Transform_Alerts::transform($content);
    }

    /**
     * 解析照片集
     *
     * @return string
     */
    static public function parsePhotoSet($content)
    {
        $settings = self::contentSettings();
        return VOID_Content_Transform_PhotoSets::transform($content, !empty($settings['largePhotoSet']));
    }

    /**
     * 解析表情
     *
     * @return string
     */
    static public function parseBiaoQing($content)
    {
        return VOID_Content_Transform_Emotes::transform($content);
    }

    /**
     * 将正文图片转换为主题语义结构；Feed 只保留静态 figure/img。
     */
    static public function parseImages($content, $feedMode = false, $galleryMode = false)
    {
        $settings = self::contentSettings();
        return VOID_Content_Transform_Images::transform(
            $content,
            (bool) $feedMode,
            (bool) $galleryMode,
            $settings
        );
    }

    /**
     * 从 bannerMeta 或封面 URL 中读取一组可信封面尺寸。
     */
    static public function getBannerDimensions($banner, $bannerMeta = null)
    {
        return VOID_Content_Transform_Images::getBannerDimensions($banner, $bannerMeta);
    }

    /**
     * 解析友情链接
     *
     * @return string
     */
    static public function markdown($text)
    {
        return VOID_Content_Pipeline::markdown($text);
    }

    /**
     * 主图来源是否应在当前布局中显示
     *
     * @return bool
     */
    static public function shouldShowBannerSource($archive, $displayMode = 'normal')
    {
        return VOID_Content_Transform_BannerSource::shouldShow($archive, $displayMode);
    }

    /**
     * 输出主图来源说明 HTML
     *
     * @return string
     */
    static public function getBannerSourceHtml($text)
    {
        return VOID_Content_Transform_BannerSource::render($text);
    }

    /**
     * 去除换行
     *
     * @return string
     */
    static function parseBoardCallback1($matchs)
    {
        return VOID_Content_Transform_Markdown::flattenBoard($matchs);
    }

    /**
     * 解析友链列表
     * 
     * @return string
     */
    static function parseBoardCallback2($matchs)
    {
        return VOID_Content_Transform_Markdown::renderBoard($matchs);
    }

    /**
     * 解析 ruby
     * 
     * @return string
     */
    static public function parseRuby($string)
    {
        return VOID_Content_Transform_Markdown::parseRuby($string);
    }

    /**
     * 最近评论，过滤引用通告，过滤博主评论
     *
     * @return array
     */
    public static function getRecentComments($num = 10)
    {
        return VOID_Repository_ContentRepository::getRecentComments($num);
    }

    /**
     * 文章上一篇
     */
    public static function thePrev($archive)
    {
        return VOID_Repository_ArchiveRepository::getPrevious($archive);
    }

    /**
     * 文章下一篇
     */
    public static function theNext($archive)
    {
        return VOID_Repository_ArchiveRepository::getNext($archive);
    }

    /**
     * 内容归档
     * 
     * @return array
     */
    public static function archives($widget, $excerpt = false)
    {
        return VOID_Repository_ArchiveRepository::getArchives(
            $widget,
            $excerpt,
            self::contentSettings()
        );
    }

    /**
     * 文章标签
     * 
     * @return array
     */
    public static function getTags($cid)
    {
        return VOID_Repository_ArchiveRepository::getTags($cid);
    }

    /**
     * 文章分类
     * 
     * @return array
     */
    public static function getCategories($cid)
    {
        return VOID_Repository_ArchiveRepository::getCategories($cid);
    }
}

<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

/**
 * The persisted theme setting contract.
 *
 * Form metadata lives beside the runtime definition so a new setting has one
 * place to describe its source, fallback and public surface.
 */
class VOID_Settings_Schema
{
    private static $definitions;

    private static function entry(
        $source,
        $default,
        $type,
        $normalizer,
        $allowedValues = null,
        $compatibilityFallback = null,
        $retired = false,
        $exposeToFrontend = false,
        $frontendKey = null,
        $form = null,
        $includeInRuntime = true,
        $documented = true
    ) {
        if ($type === 'boolean' && null === $allowedValues) {
            $allowedValues = array(false, true);
        }
        return array(
            'source' => $source,
            'default' => $default,
            'type' => $type,
            'normalizer' => $normalizer,
            'allowedValues' => $allowedValues,
            'compatibilityFallback' => $compatibilityFallback,
            'retired' => $retired,
            'exposeToFrontend' => $exposeToFrontend,
            'frontendKey' => $frontendKey,
            'form' => $form,
            'includeInRuntime' => $includeInRuntime,
            'documented' => $documented
        );
    }

    public static function all()
    {
        if (null !== self::$definitions) {
            return self::$definitions;
        }

        self::$definitions = array(
            // Theme options stored by Typecho.
            'defaultBanner' => self::entry(
                'theme', '', 'string', 'string', null, null, false, false, null,
                array('element' => 'Text', 'default' => '', 'title' => '首页顶部大图', 'description' => '可以填写随机图 API。')
            ),
            'indexBannerTitle' => self::entry(
                'theme', '', 'string', 'string', null, null, false, false, null,
                array('element' => 'Text', 'default' => '', 'title' => '首页顶部大标题', 'description' => '不要太长')
            ),
            'indexBannerSubtitle' => self::entry(
                'theme', '', 'string', 'string', null, null, false, false, null,
                array('element' => 'Text', 'default' => '', 'title' => '首页顶部小标题', 'description' => '')
            ),
            'colorScheme' => self::entry(
                'theme', 3, 'enum', 'colorScheme', array(1, 2, 3), 3, false, true, 'colorScheme',
                array(
                    'element' => 'Radio',
                    'options' => array('3' => '跟随设备', '1' => '日间模式', '2' => '夜间模式'),
                    'default' => '3',
                    'title' => '主题颜色模式',
                    'description' => '跟随设备会响应访客设备的深浅色设置，也可以固定使用日间或夜间模式。',
                    'rules' => array(
                        array('required', '请选择主题颜色模式。'),
                        array('enum', '主题颜色模式无效。', array('1', '2', '3'))
                    )
                )
            ),
            'indexStyle' => self::entry(
                'theme', 0, 'enum', 'integerEnum', array(0, 1), 0, false, true, 'indexStyle',
                array(
                    'element' => 'Radio',
                    'options' => array('0' => '双栏', '1' => '单栏'),
                    'default' => '0',
                    'title' => '首页版式',
                    'description' => '选择单栏或者双栏瀑布流'
                )
            ),
            'reward' => self::entry(
                'theme', '', 'string', 'string', null, null, false, false, null,
                array('element' => 'Text', 'default' => '', 'title' => '打赏二维码', 'description' => '图片链接，只允许一张图片，更多请自行合成。')
            ),
            'serifincontent' => self::entry(
                'theme', false, 'boolean', 'boolean', array(false, true), false, false, false, null,
                array('element' => 'Radio', 'options' => array('0' => '不启用', '1' => '启用'), 'default' => '0', 'title' => '文章内容使用衬线体', 'description' => '是否对文章内容启用衬线体（思源宋体）。字体由主题本地提供。')
            ),
            'lazyload' => self::entry(
                'theme', true, 'boolean', 'boolean', array(false, true), true, false, true, 'lazyload',
                array('element' => 'Radio', 'options' => array('1' => '启用', '0' => '不启用'), 'default' => '1', 'title' => '内容图片懒加载', 'description' => '启用后，普通正文图片与友链缩略图使用浏览器原生懒加载，Gallery 使用分批脚本加载；头图、首页与归档封面、表情由主题自动安排加载优先级。')
            ),
            'enableMath' => self::entry(
                'theme', false, 'boolean', 'boolean', array(false, true), false, false, true, 'enableMath',
                array('element' => 'Radio', 'options' => array('0' => '不启用', '1' => '启用'), 'default' => '0', 'title' => '启用数学公式解析', 'description' => '是否启用数学公式解析（MathJax 4）。启用后仅在检测到公式的页面加载相关资源。')
            ),
            'head' => self::entry(
                'theme', '', 'string', 'raw', null, null, false, false, null,
                array('element' => 'Textarea', 'default' => '', 'title' => 'head 标签输出内容', 'description' => '统计代码等。')
            ),
            'footer' => self::entry(
                'theme', '', 'string', 'raw', null, null, false, false, null,
                array('element' => 'Textarea', 'default' => '', 'title' => 'footer 标签输出内容', 'description' => '备案号等。')
            ),
            'pjax' => self::entry(
                'theme', true, 'boolean', 'boolean', array(false, true), false, false, true, 'PJAX',
                array('element' => 'Radio', 'options' => array('1' => '启用', '0' => '不启用'), 'default' => '1', 'title' => '启用 PJAX', 'description' => '使用 PJAX 进行站内页面的局部无刷新切换，通常建议开启；如与自定义脚本或插件不兼容，可关闭。')
            ),
            'pjaxreload' => self::entry(
                'theme', '', 'string', 'raw', null, null, false, false, null,
                array('element' => 'Textarea', 'default' => null, 'title' => 'PJAX 重载函数', 'description' => '仅在站点已有自定义脚本需要在 PJAX 切换后重新执行时填写；普通情况下留空。')
            ),
            'serviceworker' => self::entry(
                'theme', '', 'string', 'string', null, null, false, false, null,
                array('element' => 'Text', 'default' => null, 'title' => '自定义 Service Worker', 'description' => '如果你知道这是什么，请把你的 SW 文件（例如主题 assets 文件夹下的 VOIDCacheRule.js）复制一份到<b>站点根目录</b>，并在这里填写文件名（例如 VOIDCacheRule.js）。若不知道该选项含义，请留空此项。')
            ),
            'advance' => self::entry(
                'theme', '', 'json', 'raw', null, null, false, false, null,
                array('element' => 'Textarea', 'default' => null, 'title' => '超高级设置', 'description' => '请参阅<a href="https://github.com/mikusaa/Typecho-Theme-VOID/blob/master/docs/advanceSetting.md" target="_blank" rel="noopener noreferrer">超高级设置说明</a>，并从 advanceSetting.sample.json 选取所需配置。'),
                false
            ),

            // Free-form advanced settings. Unknown keys remain pass-through.
            'nav' => self::entry('advanced', array(), 'array', 'nav', null, null, false, false),
            'name' => self::entry('advanced', '', 'string', 'string'),
            'brandFont' => self::entry(
                'advanced', array('src' => '', 'style' => 'normal', 'weight' => 'normal'), 'object', 'brandFont'
            ),
            'desktopBannerHeight' => self::entry('advanced', '', 'number|string', 'height'),
            'mobileBannerHeight' => self::entry('advanced', '', 'number|string', 'height'),
            'twitterId' => self::entry('advanced', '', 'string', 'string'),
            'weiboId' => self::entry('advanced', '', 'string', 'string'),
            'headerMode' => self::entry('advanced', 1, 'enum', 'integerEnum', array(0, 1, 2), 1, false, true, 'headerMode'),
            'headerModeMobile' => self::entry('advanced', null, 'enum|null', 'optionalIntegerEnum', array(0, 1, 2), 'headerMode', false, false, null, null, true, true),
            'defaultFontSize' => self::entry('advanced', 3, 'enum', 'integerEnum', array(1, 2, 3, 4, 5), 3),
            'useFiraCodeFont' => self::entry('advanced', false, 'boolean', 'boolean'),
            'largePhotoSet' => self::entry('advanced', true, 'boolean', 'boolean'),
            'macStyleCodeBlock' => self::entry('advanced', true, 'boolean', 'boolean'),
            'lineNumbers' => self::entry('advanced', true, 'boolean', 'boolean', array(false, true), true, false, true, 'lineNumbers'),
            'parseFigcaption' => self::entry('advanced', true, 'boolean', 'boolean'),
            'link' => self::entry('advanced', array(), 'array', 'link'),
            'commentFoldThreshold' => self::entry('advanced', array(5, 1.5), 'tuple', 'commentFoldThreshold'),
            'commentNotification' => self::entry('advanced', '', 'string', 'raw'),
            // Kept only for the legacy VOIDConfig background presence flags.
            'siteBg' => self::entry('advanced', null, 'string|null', 'nullableString', null, null, false, false, null, null, true, false),
            'siteBgVertical' => self::entry('advanced', null, 'string|null', 'nullableString', null, null, false, false, null, null, true, false),

            // Retired keys stay recognized so they can never re-enter runtime settings.
            'darkModeTime' => self::entry('advanced', null, 'retired', 'discard', null, null, true, false, null, null, false, false),
            'followSystemColorScheme' => self::entry('advanced', null, 'retired', 'discard', null, null, true, false, null, null, false, false),
            'bluredLazyload' => self::entry('advanced', null, 'retired', 'discard', null, null, true, false, null, null, false, false),
            'CDNType' => self::entry('advanced', null, 'retired', 'discard', null, null, true, false, null, null, false, false),
            'browserLevelLoadingLazy' => self::entry('advanced', null, 'retired', 'discard', null, null, true, false, null, null, false, false),
            'feedContentMode' => self::entry('advanced', null, 'retired', 'discard', null, null, true, false, null, null, false, false),

            // Derived runtime capabilities are never persisted.
            'VOIDPlugin' => self::entry('derived', false, 'boolean', 'boolean', array(false, true), false, false, true, 'VOIDPlugin', null, true, false),

            // Typecho custom fields.
            'excerpt' => self::entry('field', null, 'string|null', 'nullableString', null, null, false, false, null, array('element' => 'Textarea', 'default' => null, 'title' => '文章摘要', 'description' => '输入自定义摘要。留空自动从文章截取。')),
            'banner' => self::entry('field', null, 'string|null', 'nullableString', null, null, false, false, null, array('element' => 'Text', 'default' => null, 'title' => '文章主图', 'description' => '输入图片URL，该图片会用于主页文章列表的显示。')),
            'bannerMeta' => self::entry('field', null, 'string|null', 'nullableString', null, null, false, false, null, array('element' => 'Hidden', 'default' => null, 'title' => '封面尺寸元数据')),
            'bannerSource' => self::entry('field', null, 'string|null', 'nullableString', null, null, false, false, null, array('element' => 'Text', 'default' => null, 'title' => '主图来源', 'description' => '输入来源信息，该信息会显示在题图标题区元信息下方。支持 markdown 格式。')),
            'bannerStyle' => self::entry('field', 0, 'enum', 'integerEnum', array(0, 1, 2), 0, false, false, null, array('element' => 'Select', 'options' => array(0 => '显示在顶部', 1 => '显示在顶部并添加模糊效果', 2 => '不显示'), 'default' => 0, 'title' => '文章主图样式', 'description' => '')),
            'bannerascover' => self::entry('field', 1, 'enum', 'integerEnum', array(0, 1, 2), 1, false, false, null, array('element' => 'Select', 'options' => array('1' => '主图显示在标题上方', '2' => '主图作为标题背景', '0' => '不显示'), 'default' => '1', 'title' => '首页主图样式', 'description' => '主图作为标题背景时会添加暗色遮罩，但仍然建议仅对暗色的主图采用该方式展示。否则请选择「主图显示在标题上方」。')),
            'posttype' => self::entry('field', 0, 'enum', 'integerEnum', array(0, 1), 0, false, false, null, array('element' => 'Select', 'options' => array('0' => '一般文章', '1' => '封面文章'), 'default' => '0', 'title' => '文章类型', 'description' => '选择展示方式')),
            'showfullcontent' => self::entry('field', 0, 'enum', 'integerEnum', array(0, 1), 0, false, false, null, array('element' => 'Select', 'options' => array('0' => '否', '1' => '是'), 'default' => '0', 'title' => '在首页显示完整内容', 'description' => '是否在首页展示完整内容。适合比较短的文章。')),
            'showTOC' => self::entry('field', 0, 'enum', 'integerEnum', array(0, 1), 0, false, false, null, array('element' => 'Select', 'options' => array('0' => '不显示目录', '1' => '显示目录'), 'default' => '0', 'title' => '文章目录', 'description' => '是否显示文章目录。')),
            'showOutdated' => self::entry('field', 0, 'enum', 'integerEnum', array(0, 1), 0, false, false, null, array('element' => 'Select', 'options' => array('0' => '不显示', '1' => '显示'), 'default' => '0', 'title' => '显示内容时效提醒', 'description' => '启用后，当文章最后更新时间超过 90 天时，在正文顶部显示时效提醒。'))
        );

        return self::$definitions;
    }

    public static function forSource($source, $includeRetired = true)
    {
        $result = array();
        foreach (self::all() as $key => $definition) {
            if ($definition['source'] !== $source) {
                continue;
            }
            if (!$includeRetired && $definition['retired']) {
                continue;
            }
            $result[$key] = $definition;
        }
        return $result;
    }

    public static function definition($key)
    {
        $all = self::all();
        return array_key_exists($key, $all) ? $all[$key] : null;
    }

    public static function retiredKeys()
    {
        $keys = array();
        foreach (self::all() as $key => $definition) {
            if ($definition['retired']) {
                $keys[] = $key;
            }
        }
        return $keys;
    }

    public static function documentedAdvancedKeys()
    {
        $keys = array();
        foreach (self::forSource('advanced', false) as $key => $definition) {
            if ($definition['documented']) {
                $keys[] = $key;
            }
        }
        return $keys;
    }
}

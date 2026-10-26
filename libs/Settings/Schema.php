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

    private static function entry($source, $default, $type, $normalizer, $options = array())
    {
        $definition = array(
            'source' => $source,
            'default' => $default,
            'type' => $type,
            'normalizer' => $normalizer,
            'allowedValues' => $type === 'boolean' ? array(false, true) : null,
            'compatibilityFallback' => null,
            'retired' => false,
            'exposeToFrontend' => false,
            'frontendKey' => null,
            'form' => null,
            'includeInRuntime' => true,
            'documented' => true
        );
        $unknown = array_diff_key($options, $definition);
        if (!empty($unknown)) {
            throw new InvalidArgumentException('Unknown setting option: ' . implode(', ', array_keys($unknown)));
        }
        $definition = array_merge($definition, $options);
        $definition['exposeToFrontend'] = null !== $definition['frontendKey'];
        return $definition;
    }

    /**
     * A retired advanced key stays recognized only so it is discarded instead of re-entering runtime settings.
     */
    private static function retired()
    {
        return self::entry('advanced', null, 'retired', 'discard', array(
            'retired' => true,
            'includeInRuntime' => false,
            'documented' => false
        ));
    }

    public static function all()
    {
        if (null !== self::$definitions) {
            return self::$definitions;
        }

        self::$definitions = array(
            // Theme options stored by Typecho.
            'defaultBanner' => self::entry('theme', '', 'string', 'string', array(
                'form' => array('element' => 'Text', 'default' => '', 'title' => '首页顶部大图', 'description' => '可以填写随机图 API。')
            )),
            'indexBannerTitle' => self::entry('theme', '', 'string', 'string', array(
                'form' => array('element' => 'Text', 'default' => '', 'title' => '首页顶部大标题', 'description' => '不要太长')
            )),
            'indexBannerSubtitle' => self::entry('theme', '', 'string', 'string', array(
                'form' => array('element' => 'Text', 'default' => '', 'title' => '首页顶部小标题', 'description' => '')
            )),
            'colorScheme' => self::entry('theme', 3, 'enum', 'colorScheme', array(
                'allowedValues' => array(1, 2, 3),
                'compatibilityFallback' => 3,
                'frontendKey' => 'colorScheme',
                'form' => array(
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
            )),
            'indexStyle' => self::entry('theme', 0, 'enum', 'integerEnum', array(
                'allowedValues' => array(0, 1),
                'compatibilityFallback' => 0,
                'frontendKey' => 'indexStyle',
                'form' => array(
                    'element' => 'Radio',
                    'options' => array('0' => '双栏', '1' => '单栏'),
                    'default' => '0',
                    'title' => '首页版式',
                    'description' => '选择单栏或者双栏瀑布流'
                )
            )),
            'reward' => self::entry('theme', '', 'string', 'string', array(
                'form' => array('element' => 'Text', 'default' => '', 'title' => '打赏二维码', 'description' => '图片链接，只允许一张图片，更多请自行合成。')
            )),
            'serifincontent' => self::entry('theme', false, 'boolean', 'boolean', array(
                'compatibilityFallback' => false,
                'form' => array('element' => 'Radio', 'options' => array('0' => '不启用', '1' => '启用'), 'default' => '0', 'title' => '文章内容使用衬线体', 'description' => '是否对文章内容启用衬线体（思源宋体）。字体由主题本地提供。')
            )),
            'lazyload' => self::entry('theme', true, 'boolean', 'boolean', array(
                'compatibilityFallback' => true,
                'frontendKey' => 'lazyload',
                'form' => array('element' => 'Radio', 'options' => array('1' => '启用', '0' => '不启用'), 'default' => '1', 'title' => '内容图片懒加载', 'description' => '启用后，普通正文图片与友链缩略图使用浏览器原生懒加载，Gallery 使用分批脚本加载；头图、首页与归档封面、表情由主题自动安排加载优先级。')
            )),
            'enableMath' => self::entry('theme', false, 'boolean', 'boolean', array(
                'compatibilityFallback' => false,
                'frontendKey' => 'enableMath',
                'form' => array('element' => 'Radio', 'options' => array('0' => '不启用', '1' => '启用'), 'default' => '0', 'title' => '启用数学公式解析', 'description' => '是否启用数学公式解析（MathJax 4）。启用后仅在检测到公式的页面加载相关资源。')
            )),
            'head' => self::entry('theme', '', 'string', 'raw', array(
                'form' => array('element' => 'Textarea', 'default' => '', 'title' => 'head 标签输出内容', 'description' => '统计代码等。')
            )),
            'footer' => self::entry('theme', '', 'string', 'raw', array(
                'form' => array('element' => 'Textarea', 'default' => '', 'title' => 'footer 标签输出内容', 'description' => '备案号等。')
            )),
            // A missing setting enables PJAX; an invalid stored value falls back to disabled.
            'pjax' => self::entry('theme', true, 'boolean', 'boolean', array(
                'compatibilityFallback' => false,
                'frontendKey' => 'PJAX',
                'form' => array('element' => 'Radio', 'options' => array('1' => '启用', '0' => '不启用'), 'default' => '1', 'title' => '启用 PJAX', 'description' => '使用 PJAX 进行站内页面的局部无刷新切换，通常建议开启；如与自定义脚本或插件不兼容，可关闭。')
            )),
            'pjaxreload' => self::entry('theme', '', 'string', 'raw', array(
                'form' => array('element' => 'Textarea', 'default' => null, 'title' => 'PJAX 重载函数', 'description' => '仅在站点已有自定义脚本需要在 PJAX 切换后重新执行时填写；普通情况下留空。')
            )),
            'serviceworker' => self::entry('theme', '', 'string', 'string', array(
                'form' => array('element' => 'Text', 'default' => null, 'title' => '自定义 Service Worker', 'description' => '如果你知道这是什么，请把你的 SW 文件（例如主题 assets 文件夹下的 VOIDCacheRule.js）复制一份到<b>站点根目录</b>，并在这里填写文件名（例如 VOIDCacheRule.js）；Typecho 安装在子目录时，请放在 Typecho 所在目录并填写含子目录的路径（例如 blog/VOIDCacheRule.js）。若不知道该选项含义，请留空此项。')
            )),
            'advance' => self::entry('theme', '', 'json', 'raw', array(
                'form' => array('element' => 'Textarea', 'default' => null, 'title' => '超高级设置', 'description' => '请参阅<a href="https://github.com/mikusaa/Typecho-Theme-VOID/blob/master/docs/advanceSetting.md" target="_blank" rel="noopener noreferrer">超高级设置说明</a>，并从 advanceSetting.sample.json 选取所需配置。'),
                'includeInRuntime' => false
            )),

            // Free-form advanced settings. Unknown keys remain pass-through.
            'nav' => self::entry('advanced', array(), 'array', 'nav'),
            'name' => self::entry('advanced', '', 'string', 'string'),
            'brandFont' => self::entry(
                'advanced', array('src' => '', 'style' => 'normal', 'weight' => 'normal'), 'object', 'brandFont'
            ),
            'desktopBannerHeight' => self::entry('advanced', '', 'number|string', 'height'),
            'mobileBannerHeight' => self::entry('advanced', '', 'number|string', 'height'),
            'twitterId' => self::entry('advanced', '', 'string', 'string'),
            'weiboId' => self::entry('advanced', '', 'string', 'string'),
            'headerMode' => self::entry('advanced', 1, 'enum', 'integerEnum', array(
                'allowedValues' => array(0, 1, 2),
                'compatibilityFallback' => 1,
                'frontendKey' => 'headerMode'
            )),
            // null means "inherit headerMode"; the fallback names the setting to inherit.
            'headerModeMobile' => self::entry('advanced', null, 'enum|null', 'optionalIntegerEnum', array(
                'allowedValues' => array(0, 1, 2),
                'compatibilityFallback' => 'headerMode'
            )),
            'defaultFontSize' => self::entry('advanced', 3, 'enum', 'integerEnum', array(
                'allowedValues' => array(1, 2, 3, 4, 5),
                'compatibilityFallback' => 3
            )),
            'useFiraCodeFont' => self::entry('advanced', false, 'boolean', 'boolean'),
            'largePhotoSet' => self::entry('advanced', true, 'boolean', 'boolean'),
            'macStyleCodeBlock' => self::entry('advanced', true, 'boolean', 'boolean'),
            'lineNumbers' => self::entry('advanced', true, 'boolean', 'boolean', array(
                'compatibilityFallback' => true,
                'frontendKey' => 'lineNumbers'
            )),
            'parseFigcaption' => self::entry('advanced', true, 'boolean', 'boolean'),
            'link' => self::entry('advanced', array(), 'array', 'link'),
            'commentFoldThreshold' => self::entry('advanced', array(5, 1.5), 'tuple', 'commentFoldThreshold'),
            'commentNotification' => self::entry('advanced', '', 'string', 'raw'),

            // Retired keys stay recognized so they can never re-enter runtime settings.
            'darkModeTime' => self::retired(),
            'followSystemColorScheme' => self::retired(),
            'bluredLazyload' => self::retired(),
            'CDNType' => self::retired(),
            'browserLevelLoadingLazy' => self::retired(),
            'feedContentMode' => self::retired(),
            'siteBg' => self::retired(),
            'siteBgVertical' => self::retired(),

            // Derived runtime capabilities are never persisted.
            'VOIDPlugin' => self::entry('derived', false, 'boolean', 'boolean', array(
                'compatibilityFallback' => false,
                'frontendKey' => 'VOIDPlugin',
                'documented' => false
            )),

            // Typecho custom fields.
            'excerpt' => self::entry('field', null, 'string|null', 'nullableString', array(
                'form' => array('element' => 'Textarea', 'default' => null, 'title' => '文章摘要', 'description' => '输入自定义摘要。留空自动从文章截取。')
            )),
            'banner' => self::entry('field', null, 'string|null', 'nullableString', array(
                'form' => array('element' => 'Text', 'default' => null, 'title' => '文章主图', 'description' => '输入图片URL，该图片会用于主页文章列表的显示。')
            )),
            'bannerMeta' => self::entry('field', null, 'string|null', 'nullableString', array(
                'form' => array('element' => 'Hidden', 'default' => null, 'title' => '封面尺寸元数据')
            )),
            'bannerSource' => self::entry('field', null, 'string|null', 'nullableString', array(
                'form' => array('element' => 'Text', 'default' => null, 'title' => '主图来源', 'description' => '输入来源信息，该信息会显示在题图标题区元信息下方。支持 markdown 格式。')
            )),
            'bannerStyle' => self::entry('field', 0, 'enum', 'integerEnum', array(
                'allowedValues' => array(0, 1, 2),
                'compatibilityFallback' => 0,
                'form' => array('element' => 'Select', 'options' => array(0 => '显示在顶部', 1 => '显示在顶部并添加模糊效果', 2 => '不显示'), 'default' => 0, 'title' => '文章主图样式', 'description' => '')
            )),
            'bannerascover' => self::entry('field', 1, 'enum', 'integerEnum', array(
                'allowedValues' => array(0, 1, 2),
                'compatibilityFallback' => 1,
                'form' => array('element' => 'Select', 'options' => array('1' => '主图显示在标题上方', '2' => '主图作为标题背景', '0' => '不显示'), 'default' => '1', 'title' => '首页主图样式', 'description' => '主图作为标题背景时会添加暗色遮罩，但仍然建议仅对暗色的主图采用该方式展示。否则请选择「主图显示在标题上方」。')
            )),
            'posttype' => self::entry('field', 0, 'enum', 'integerEnum', array(
                'allowedValues' => array(0, 1),
                'compatibilityFallback' => 0,
                'form' => array('element' => 'Select', 'options' => array('0' => '一般文章', '1' => '封面文章'), 'default' => '0', 'title' => '文章类型', 'description' => '选择展示方式')
            )),
            'showfullcontent' => self::entry('field', 0, 'enum', 'integerEnum', array(
                'allowedValues' => array(0, 1),
                'compatibilityFallback' => 0,
                'form' => array('element' => 'Select', 'options' => array('0' => '否', '1' => '是'), 'default' => '0', 'title' => '在首页显示完整内容', 'description' => '是否在首页展示完整内容。适合比较短的文章。')
            )),
            'showTOC' => self::entry('field', 0, 'enum', 'integerEnum', array(
                'allowedValues' => array(0, 1),
                'compatibilityFallback' => 0,
                'form' => array('element' => 'Select', 'options' => array('0' => '不显示目录', '1' => '显示目录'), 'default' => '0', 'title' => '文章目录', 'description' => '是否显示文章目录。')
            )),
            'showOutdated' => self::entry('field', 0, 'enum', 'integerEnum', array(
                'allowedValues' => array(0, 1),
                'compatibilityFallback' => 0,
                'form' => array('element' => 'Select', 'options' => array('0' => '不显示', '1' => '显示'), 'default' => '0', 'title' => '显示内容时效提醒', 'description' => '启用后，当文章最后更新时间超过 90 天时，在正文顶部显示时效提醒。')
            ))
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

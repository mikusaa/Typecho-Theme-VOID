<?php
/**
 * functions.php
 *
 * 初始化主题
 *
 * @author      熊猫小A
 * @version     2019-01-15 1.0
 */
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

require_once __DIR__ . '/libs/Utils.php';
require_once __DIR__ . '/libs/Contents.php';
require_once __DIR__ . '/libs/Comments.php';

/**
 * 统一 Typecho 1.2 / 1.3 的插件句柄格式，避免别名导致重复注册。
 */
function VOID_normalizePluginHandle($handle)
{
    if (defined('__TYPECHO_CLASS_ALIASES__')) {
        $alias = array_search('\\' . ltrim($handle, '\\'), __TYPECHO_CLASS_ALIASES__, true);
        if (false !== $alias) {
            $handle = $alias;
        }
    }

    if (class_exists('Typecho\\Common')) {
        return Typecho\Common::nativeClassName($handle);
    }

    return trim(str_replace('\\', '_', $handle), '_');
}

/**
 * 为内容解析相关 hook 同时兼容旧版别名和 1.3 命名空间类。
 */
function VOID_registerContentsHook($component, $callback)
{
    $targets = array('Widget_Abstract_Contents');
    if (class_exists('Widget\Base\Contents')) {
        $targets[] = 'Widget\Base\Contents';
    }

    $registered = array();
    foreach ($targets as $target) {
        $normalized = VOID_normalizePluginHandle($target);
        if (isset($registered[$normalized])) {
            continue;
        }

        Typecho_Plugin::factory($target)->{$component} = $callback;
        $registered[$normalized] = true;
    }
}

/**
 * 清理当前文章已缓存的计算字段，避免 Typecho 1.3 在主题 hook 注册前缓存旧内容。
 */
function VOID_refreshArchiveComputedFields($archive)
{
    if (!($archive instanceof Widget_Archive) || !$archive->have()) {
        return;
    }

    try {
        $reflection = new ReflectionObject($archive);
        while ($reflection && !$reflection->hasProperty('row')) {
            $reflection = $reflection->getParentClass();
        }

        if ($reflection && $reflection->hasProperty('row')) {
            $rowProperty = $reflection->getProperty('row');
            if (PHP_VERSION_ID < 80100) {
                $rowProperty->setAccessible(true);
            }
            $row = $rowProperty->getValue($archive);

            if (is_array($row)) {
                unset($row['#content'], $row['#excerpt'], $row['#plainExcerpt']);
                $rowProperty->setValue($archive, $row);
            }
        }
    } catch (Exception $e) {
    }

    $archive->archiveDescription = $archive->plainExcerpt;
}

Typecho_Plugin::factory('admin/write-post.php')->bottom = array('Utils', 'addButton');
Typecho_Plugin::factory('admin/write-page.php')->bottom = array('Utils', 'addButton');
// 为防止友链解析与 Markdown 冲突，重写 Markdown 函数
VOID_registerContentsHook('markdown', array('Contents', 'markdown'));
VOID_registerContentsHook('contentEx', array('Contents', 'contentEx'));
VOID_registerContentsHook('excerptEx', array('Contents', 'excerptEx'));

/**
 * 主题启用
 */
function themeInit($archive = null)
{
    VOID_refreshArchiveComputedFields($archive);
}

$GLOBALS['VOIDPluginREQ'] = '1.4.0';
$GLOBALS['VOIDVersion'] = '4.0.0-beta.1';

/**
 * Build Typecho form elements from the shared settings schema.
 */
function VOID_addSchemaFormElements($container, $source, $method)
{
    require_once __DIR__ . '/libs/Settings/bootstrap.php';
    foreach (VOID_Settings_Schema::forSource($source, false) as $key => $definition) {
        if (empty($definition['form']) || !is_array($definition['form'])) {
            continue;
        }

        $form = $definition['form'];
        $elementClass = 'Typecho_Widget_Helper_Form_Element_' . $form['element'];
        $options = isset($form['options']) ? $form['options'] : null;
        $default = array_key_exists('default', $form) ? $form['default'] : $definition['default'];
        $title = isset($form['title']) ? $form['title'] : '';
        $description = isset($form['description']) ? $form['description'] : '';
        $element = new $elementClass($key, $options, $default, $title, $description);

        if (!empty($form['rules'])) {
            foreach ($form['rules'] as $rule) {
                call_user_func_array(array($element, 'addRule'), $rule);
            }
        }

        $container->{$method}($element);
    }
}

/**
 * 主题设置
 */
function themeConfig($form)
{
    $options = Helper::options();
    if ($options->colorScheme !== null) {
        $options->colorScheme = (string) Utils::normalizeColorScheme($options->colorScheme);
    }

    echo '<style>
        p.notice {
        line-height: 1.75;
        padding: .5rem;
        padding-left: .75rem;
        border-left: solid 4px #fbbc05;
        background: rgba(0,0,25,.025);
    }</style>';

    if (!Utils::hasVOIDPlugin($GLOBALS['VOIDPluginREQ'])) {
        echo '<p class="notice">未检测到合适的 VOID 插件！主题部分功能依赖插件支持，推荐安装以获得最佳体验。VOID 插件一般会随主题包发布，开发版主题请前往 https://github.com/AlanDecode/VOID-Plugin 获取。</p>';
    }

    echo '<p id="void-check-update" class="notice">正在检查更新……</p>';
    echo '<script>var VOIDVersion=' . Utils::encodeJsonForHtml($GLOBALS['VOIDVersion']) . '</script>';
    echo '<script src="' . Utils::escapeHtml(Helper::options()->themeUrl . '/assets/check_update-9fc641bc91.js') . '"></script>';

    VOID_addSchemaFormElements($form, 'theme', 'addInput');
}

/**
 * 文章自定义字段
 */
function themeFields(Typecho_Widget_Helper_Layout $layout)
{
    VOID_addSchemaFormElements($layout, 'field', 'addItem');
}

$GLOBALS['VOIDSetting'] = Utils::getVOIDSettings();

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
 * 清理当前文章已缓存的计算字段。
 *
 * Typecho 1.3 先执行文章 handle（其中读取 plainExcerpt，会把 content、excerpt 缓存进
 * 私有 row），之后才加载 functions.php，主题内容 Hook 因此错过这次计算；核心没有公开的
 * 清除途径，只能在组件作用域内删除这三个缓存键。
 */
function VOID_refreshArchiveComputedFields($archive)
{
    if (!($archive instanceof \Widget\Archive) || !$archive->have()) {
        return;
    }

    (function () {
        unset($this->row['#content'], $this->row['#excerpt'], $this->row['#plainExcerpt']);
    })->call($archive);
}

\Typecho\Plugin::factory('admin/write-post.php')->bottom = array('Utils', 'addButton');
\Typecho\Plugin::factory('admin/write-page.php')->bottom = array('Utils', 'addButton');
// 为防止友链解析与 Markdown 冲突，重写 Markdown 函数
\Typecho\Plugin::factory(\Widget\Base\Contents::class)->markdown = array('Contents', 'markdown');
\Typecho\Plugin::factory(\Widget\Base\Contents::class)->contentEx = array('Contents', 'contentEx');
\Typecho\Plugin::factory(\Widget\Base\Contents::class)->excerptEx = array('Contents', 'excerptEx');

/**
 * 主题启用
 */
function themeInit($archive = null)
{
    Utils::applyPjaxCacheHeaders(Typecho\Response::getInstance());
    VOID_refreshArchiveComputedFields($archive);
}

$GLOBALS['VOIDPluginREQ'] = '1.4.0';
$GLOBALS['VOIDVersion'] = '4.0.0';

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
        $elementClass = '\\Typecho\\Widget\\Helper\\Form\\Element\\' . $form['element'];
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
    echo '<script src="' . Utils::escapeHtml(Helper::options()->themeUrl . '/assets/check_update-164da64e55.js') . '"></script>';

    VOID_addSchemaFormElements($form, 'theme', 'addInput');
}

/**
 * 文章自定义字段
 */
function themeFields(\Typecho\Widget\Helper\Layout $layout)
{
    VOID_addSchemaFormElements($layout, 'field', 'addItem');
}

$GLOBALS['VOIDSetting'] = Utils::getVOIDSettings();

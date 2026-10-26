<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class SettingsFormOptions
{
    public $colorScheme = '0';
    public $themeUrl = 'https://example.test/usr/themes/VOID';

    public function __get($name)
    {
        return null;
    }
}

class Helper
{
    public static $options;

    public static function options()
    {
        return self::$options;
    }
}

class SettingsFormPluginHandle
{
    public $bottom;
    public $contentEx;
    public $excerptEx;
    public $markdown;
}

class Typecho_Plugin
{
    public static function factory($handle)
    {
        return new SettingsFormPluginHandle();
    }

    public static function export()
    {
        return array('activated' => array());
    }
}

class Widget_Abstract_Comments
{
}

class Widget_Archive
{
}

class Typecho_Widget_Helper_Layout
{
    public $items = array();

    public function addItem($item)
    {
        $this->items[] = $item;
    }
}

class SettingsFormElement
{
    public $default;
    public $description;
    public $name;
    public $options;
    public $rules = array();
    public $title;

    public function __construct($name, $options, $default, $title, $description = '')
    {
        $this->name = $name;
        $this->options = $options;
        $this->default = $default;
        $this->title = $title;
        $this->description = $description;
    }

    public function addRule()
    {
        $this->rules[] = func_get_args();
    }
}

class Typecho_Widget_Helper_Form_Element_Text extends SettingsFormElement
{
}

class Typecho_Widget_Helper_Form_Element_Textarea extends SettingsFormElement
{
}

class Typecho_Widget_Helper_Form_Element_Radio extends SettingsFormElement
{
}

class Typecho_Widget_Helper_Form_Element_Select extends SettingsFormElement
{
}

class Typecho_Widget_Helper_Form_Element_Hidden extends SettingsFormElement
{
}

class SettingsFormContainer
{
    public $items = array();

    public function addInput($item)
    {
        $this->items[] = $item;
    }
}

// 主题源码使用 Typecho 1.3 命名空间类名；替身按下划线名声明，再像核心一样建立别名。
class_alias('Typecho_Plugin', 'Typecho\Plugin');
class_alias('Widget_Abstract_Comments', 'Widget\Base\Comments');
class_alias('Widget_Archive', 'Widget\Archive');
class_alias('Typecho_Widget_Helper_Layout', 'Typecho\Widget\Helper\Layout');
class_alias('Typecho_Widget_Helper_Form_Element_Text', 'Typecho\Widget\Helper\Form\Element\Text');
class_alias('Typecho_Widget_Helper_Form_Element_Textarea', 'Typecho\Widget\Helper\Form\Element\Textarea');
class_alias('Typecho_Widget_Helper_Form_Element_Radio', 'Typecho\Widget\Helper\Form\Element\Radio');
class_alias('Typecho_Widget_Helper_Form_Element_Select', 'Typecho\Widget\Helper\Form\Element\Select');
class_alias('Typecho_Widget_Helper_Form_Element_Hidden', 'Typecho\Widget\Helper\Form\Element\Hidden');

Helper::$options = new SettingsFormOptions();
ob_start();
require_once dirname(__DIR__, 2) . '/functions.php';
ob_end_clean();

$failures = 0;

function settingsFormAssertSame($expected, $actual, $message)
{
    global $failures;
    if ($expected === $actual) {
        echo "ok - {$message}\n";
        return;
    }

    ++$failures;
    echo "not ok - {$message}\n";
    echo '  expected: ' . var_export($expected, true) . "\n";
    echo '  actual:   ' . var_export($actual, true) . "\n";
}

$themeForm = new SettingsFormContainer();
ob_start();
themeConfig($themeForm);
ob_end_clean();
$fieldForm = new Typecho_Widget_Helper_Layout();
themeFields($fieldForm);

foreach (array('theme' => $themeForm->items, 'field' => $fieldForm->items) as $source => $elements) {
    $definitions = VOID_Settings_Schema::forSource($source, false);
    $formDefinitions = array();
    foreach ($definitions as $key => $definition) {
        if (!empty($definition['form'])) {
            $formDefinitions[$key] = $definition;
        }
    }

    settingsFormAssertSame(array_keys($formDefinitions), array_map(function ($element) {
        return $element->name;
    }, $elements), $source . ' 表单完全由 schema 生成且顺序稳定');

    foreach ($elements as $element) {
        $form = $formDefinitions[$element->name]['form'];
        settingsFormAssertSame($form['element'], substr(get_class($element), strrpos(get_class($element), '_') + 1), $element->name . ' 表单控件类型与 schema 一致');
        settingsFormAssertSame(isset($form['options']) ? $form['options'] : null, $element->options, $element->name . ' 表单选项与 schema 一致');
        settingsFormAssertSame(array_key_exists('default', $form) ? $form['default'] : $formDefinitions[$element->name]['default'], $element->default, $element->name . ' 表单默认值与 schema 一致');
        settingsFormAssertSame(
            $formDefinitions[$element->name]['default'],
            VOID_Settings_Resolver::normalize($element->default, $formDefinitions[$element->name]),
            $element->name . ' 表单默认值解析后与运行时默认值一致'
        );
        settingsFormAssertSame(isset($form['rules']) ? $form['rules'] : array(), $element->rules, $element->name . ' 表单校验规则与 schema 一致');
    }
}

settingsFormAssertSame('3', Helper::options()->colorScheme, 'themeConfig 使用 schema 兼容回退更新旧颜色选项');

$functionsSource = file_get_contents(dirname(__DIR__, 2) . '/functions.php');
settingsFormAssertSame(true, strpos($functionsSource, 'function themeConfig($form)') !== false, '保留 Typecho themeConfig 全局入口');
settingsFormAssertSame(true, strpos($functionsSource, 'function themeFields(\\Typecho\\Widget\\Helper\\Layout $layout)') !== false, '保留 Typecho themeFields 全局入口');
settingsFormAssertSame(true, strpos($functionsSource, 'function themeInit($archive = null)') !== false, '保留 Typecho themeInit 全局入口');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} settings form contract test(s) failed.\n");
    exit(1);
}

echo "All settings form contract tests passed.\n";

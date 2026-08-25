<?php

class PluginVersionTestOptions
{
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

class Typecho_Plugin
{
    public static $activated = array();

    public static function export()
    {
        return array('activated' => self::$activated);
    }
}

require_once dirname(__DIR__, 2) . '/libs/Utils.php';

$failures = 0;

function pluginVersionAssertSame($expected, $actual, $message)
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

Typecho_Plugin::$activated = array('VOID' => array());
pluginVersionAssertSame(false, Utils::hasVOIDPlugin('1.4.0'), '激活记录残留但插件类缺失时安全降级');

$autoloadCalls = 0;
$pluginAutoloader = function ($className) use (&$autoloadCalls) {
    if ($className === 'VOID_Plugin') {
        ++$autoloadCalls;
        eval('class VOID_Plugin { public static $VERSION = "1.4.1"; }');
    }
};
spl_autoload_register($pluginAutoloader);
pluginVersionAssertSame(true, Utils::hasVOIDPlugin('1.4.0'), '激活插件类按 Typecho 运行时顺序自动加载');
pluginVersionAssertSame(1, $autoloadCalls, '兼容判断只触发一次插件类自动加载');
spl_autoload_unregister($pluginAutoloader);

VOID_Plugin::$VERSION = '1.4.1';
Typecho_Plugin::$activated = array();
pluginVersionAssertSame(false, Utils::hasVOIDPlugin('1.4.0'), '插件未启用时不读取版本能力');

Typecho_Plugin::$activated = array('VOID' => array());
$versionCases = array(
    array(null, false, '空版本'),
    array('', false, '空字符串版本'),
    array(false, false, '布尔版本'),
    array(array('1.4.1'), false, '数组版本'),
    array(new stdClass(), false, '对象版本'),
    array('invalid', false, '非版本字符串'),
    array('1..4', false, '缺失版本段'),
    array('1.3.9', false, '低版本'),
    array('1.4.0-beta', false, '预发布版本'),
    array('1.4.0-RC1', false, '候选发布版本'),
    array('1.4.0', true, '最低稳定版本'),
    array('1.4.1', true, '更高补丁版本'),
    array('1.10.0', true, '多位次版本')
);

foreach ($versionCases as $case) {
    VOID_Plugin::$VERSION = $case[0];
    pluginVersionAssertSame($case[1], Utils::hasVOIDPlugin('1.4.0'), $case[2]);
}

VOID_Plugin::$VERSION = 1.2;
pluginVersionAssertSame(true, Utils::hasVOIDPlugin('1.1.0'), '历史浮点版本受控参与比较');
pluginVersionAssertSame(false, Utils::hasVOIDPlugin('1.4.0'), '历史低版本不能通过当前门槛');

VOID_Plugin::$VERSION = '1.4.1';
foreach (array(null, '', false, array('1.4.0'), 'invalid', '1..4') as $required) {
    pluginVersionAssertSame(
        false,
        Utils::hasVOIDPlugin($required),
        '非法最低版本 ' . var_export($required, true)
    );
}

$functionsSource = file_get_contents(dirname(__DIR__, 2) . '/functions.php');
pluginVersionAssertSame(
    true,
    strpos($functionsSource, "\$GLOBALS['VOIDPluginREQ'] = '1.4.0';") !== false,
    '主题最低版本使用完整点分字符串'
);

$GLOBALS['VOIDPluginREQ'] = '1.4.0';
Helper::$options = new PluginVersionTestOptions();
$settings = Utils::getVOIDSettings();
pluginVersionAssertSame(true, $settings['VOIDPlugin'], '运行时设置使用统一兼容判断');

VOID_Plugin::$VERSION = '1.4.0-beta';
$settings = Utils::getVOIDSettings();
pluginVersionAssertSame(false, $settings['VOIDPlugin'], '预发布插件不会启用稳定版能力');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} plugin version contract test(s) failed.\n");
    exit(1);
}

echo "All plugin version contract tests passed.\n";

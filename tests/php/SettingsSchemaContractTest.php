<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

class SettingsContractOptions
{
    private $values;

    public function __construct($values)
    {
        $this->values = $values;
    }

    public function __get($name)
    {
        return array_key_exists($name, $this->values) ? $this->values[$name] : null;
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
    public static function export()
    {
        return array('activated' => array());
    }
}

require_once dirname(__DIR__, 2) . '/libs/Utils.php';
require_once dirname(__DIR__, 2) . '/libs/Settings/bootstrap.php';

$failures = 0;

function settingsContractAssertSame($expected, $actual, $message)
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

function settingsContractKeys($source, $includeRetired = true)
{
    return array_keys(VOID_Settings_Schema::forSource($source, $includeRetired));
}

function settingsContractDefaultToken($value)
{
    if (null === $value) {
        return '未设置';
    }
    return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

$expectedThemeKeys = array(
    'defaultBanner', 'indexBannerTitle', 'indexBannerSubtitle', 'colorScheme', 'indexStyle',
    'reward', 'serifincontent', 'lazyload', 'enableMath', 'head', 'footer', 'pjax',
    'pjaxreload', 'serviceworker', 'advance'
);
$expectedAdvancedKeys = array(
    'nav', 'name', 'brandFont', 'desktopBannerHeight', 'mobileBannerHeight', 'twitterId',
    'weiboId', 'headerMode', 'headerModeMobile', 'defaultFontSize', 'useFiraCodeFont',
    'largePhotoSet', 'macStyleCodeBlock', 'lineNumbers', 'parseFigcaption', 'link',
    'commentFoldThreshold', 'commentNotification', 'siteBg', 'siteBgVertical'
);
$expectedFieldKeys = array(
    'excerpt', 'banner', 'bannerMeta', 'bannerSource', 'bannerStyle', 'bannerascover',
    'posttype', 'showfullcontent', 'showTOC', 'showOutdated'
);
$expectedRetiredKeys = array(
    'darkModeTime', 'followSystemColorScheme', 'bluredLazyload', 'CDNType',
    'browserLevelLoadingLazy', 'feedContentMode'
);

settingsContractAssertSame($expectedThemeKeys, settingsContractKeys('theme', false), 'schema 保留全部主题设置键和持久化名称');
settingsContractAssertSame($expectedAdvancedKeys, settingsContractKeys('advanced', false), 'schema 保留全部公开高级设置键');
settingsContractAssertSame($expectedFieldKeys, settingsContractKeys('field', false), 'schema 保留全部文章字段键和持久化名称');
settingsContractAssertSame($expectedRetiredKeys, VOID_Settings_Schema::retiredKeys(), 'schema 集中维护全部当前废弃键');

$requiredDefinitionKeys = array(
    'source', 'default', 'type', 'normalizer', 'allowedValues', 'exposeToFrontend',
    'retired', 'compatibilityFallback', 'form', 'includeInRuntime', 'documented'
);
foreach (VOID_Settings_Schema::all() as $key => $definition) {
    settingsContractAssertSame(
        array(),
        array_values(array_diff($requiredDefinitionKeys, array_keys($definition))),
        $key . ' 声明完整 schema 元数据'
    );
}

$runtimeSettingKeys = array();
$runtimeFieldKeys = array();
$repositoryRoot = dirname(__DIR__, 2);
$runtimeFiles = glob($repositoryRoot . '/*.php');
foreach (array($repositoryRoot . '/includes', $repositoryRoot . '/libs') as $directory) {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory));
    foreach ($iterator as $entry) {
        if ($entry->isFile() && substr($entry->getFilename(), -4) === '.php') {
            $runtimeFiles[] = $entry->getPathname();
        }
    }
}
foreach ($runtimeFiles as $runtimeFile) {
        if (!is_file($runtimeFile)) {
            continue;
        }
        $source = file_get_contents($runtimeFile);
        if (preg_match_all('/\$(?:setting|settings)\[[\'\"]([A-Za-z][A-Za-z0-9_]*)[\'\"]\]/', $source, $matches)) {
            $runtimeSettingKeys = array_merge($runtimeSettingKeys, $matches[1]);
        }
        if (preg_match_all('/->fields->([A-Za-z][A-Za-z0-9_]*)/', $source, $matches)) {
            $runtimeFieldKeys = array_merge($runtimeFieldKeys, $matches[1]);
        }
}
$runtimeSettingKeys = array_values(array_unique($runtimeSettingKeys));
$runtimeFieldKeys = array_values(array_unique($runtimeFieldKeys));
sort($runtimeSettingKeys);
sort($runtimeFieldKeys);
foreach ($runtimeSettingKeys as $key) {
    $definition = VOID_Settings_Schema::definition($key);
    settingsContractAssertSame(true, is_array($definition) && !$definition['retired'], '运行时设置调用 ' . $key . ' 已登记且未废弃');
}
foreach ($runtimeFieldKeys as $key) {
    $definition = VOID_Settings_Schema::definition($key);
    settingsContractAssertSame(true, is_array($definition) && $definition['source'] === 'field', '模板文章字段调用 ' . $key . ' 由 field schema 覆盖');
}

$advancedInput = array(
    'lazyload' => true,
    'head' => '<script>advanced override</script>',
    'headerMode' => '2',
    'headerModeMobile' => '0',
    'defaultFontSize' => '5',
    'useFiraCodeFont' => 'true',
    'commentFoldThreshold' => array('7', '2.5'),
    'unknownCustomSetting' => array('kept' => true),
    'darkModeTime' => array('start' => 22, 'end' => 7),
    'feedContentMode' => 1
);
Helper::$options = new SettingsContractOptions(array(
    'colorScheme' => '0',
    'lazyload' => '0',
    'head' => '<script>theme extension</script>',
    'advance' => json_encode($advancedInput)
));
$GLOBALS['VOIDPluginREQ'] = '1.4.0';

$desktop = VOID_Settings_Resolver::resolve(Helper::$options, array('isMobile' => false));
settingsContractAssertSame(3, $desktop['colorScheme'], '旧颜色模式通过 compatibility fallback 归一为跟随设备');
settingsContractAssertSame(false, $desktop['lazyload'], '公开主题设置优先于同名高级设置');
settingsContractAssertSame(true, $desktop['pjax'], '缺少 PJAX 设置时默认启用');
settingsContractAssertSame('<script>theme extension</script>', $desktop['head'], 'head 自由格式扩展内容原样保留');
settingsContractAssertSame(2, $desktop['headerMode'], '已知高级枚举归一为整数');
settingsContractAssertSame(0, $desktop['headerModeMobile'], '桌面运行时继续保留移动端覆盖键');
settingsContractAssertSame(5, $desktop['defaultFontSize'], '已知字号枚举归一为整数');
settingsContractAssertSame(true, $desktop['useFiraCodeFont'], '已知布尔高级设置归一为布尔值');
settingsContractAssertSame(array(7, 2.5), $desktop['commentFoldThreshold'], '评论折叠二元组归一为数值');
settingsContractAssertSame(array('kept' => true), $desktop['unknownCustomSetting'], '未知高级设置继续原样透传');
foreach ($expectedRetiredKeys as $retiredKey) {
    settingsContractAssertSame(false, array_key_exists($retiredKey, $desktop), $retiredKey . ' 不进入运行时');
}

$mobile = VOID_Settings_Resolver::resolve(Helper::$options, array('isMobile' => true));
settingsContractAssertSame(0, $mobile['headerMode'], '移动端使用已规范化的 headerModeMobile 覆盖');

Helper::$options = new SettingsContractOptions(array('pjax' => '0'));
$pjaxDisabled = VOID_Settings_Resolver::resolve(Helper::$options, array('isMobile' => false));
settingsContractAssertSame(false, $pjaxDisabled['pjax'], '显式关闭 PJAX 时保留用户选择');

Helper::$options = new SettingsContractOptions(array('advance' => '{invalid json'));
$invalidJson = VOID_Settings_Resolver::resolve(Helper::$options, array('isMobile' => false));
settingsContractAssertSame(1, $invalidJson['headerMode'], '高级 JSON 解析失败时使用 schema 默认值');
settingsContractAssertSame(array(), $invalidJson['link'], '高级 JSON 解析失败时提供安全数组默认值');
settingsContractAssertSame('', $invalidJson['head'], '缺少主题自由格式扩展点时使用空字符串');

$samplePath = dirname(__DIR__, 2) . '/advanceSetting.sample.json';
$sample = json_decode(file_get_contents($samplePath), true);
settingsContractAssertSame(true, is_array($sample), '高级设置示例是 JSON 对象');
if (is_array($sample)) {
    $sampleKeys = array_keys($sample);
    $documentedKeys = VOID_Settings_Schema::documentedAdvancedKeys();
    sort($sampleKeys);
    sort($documentedKeys);
    settingsContractAssertSame($documentedKeys, $sampleKeys, 'JSON 示例完整覆盖且仅覆盖公开高级设置');

    foreach ($sample as $key => $value) {
        $definition = VOID_Settings_Schema::definition($key);
        settingsContractAssertSame(
            $value,
            VOID_Settings_Resolver::normalize($value, $definition),
            'JSON 示例的 ' . $key . ' 符合 schema 类型与枚举'
        );
    }
}

$documentationPath = dirname(__DIR__, 2) . '/docs/advanceSetting.md';
$documentation = file_get_contents($documentationPath);
$documentedRows = array();
if (preg_match_all('/^\| `([^`]+)` \|.*$/m', $documentation, $matches, PREG_SET_ORDER)) {
    foreach ($matches as $match) {
        $documentedRows[$match[1]] = $match[0];
    }
}
$documentedRowKeys = array_keys($documentedRows);
$schemaDocumentedKeys = VOID_Settings_Schema::documentedAdvancedKeys();
sort($documentedRowKeys);
sort($schemaDocumentedKeys);
settingsContractAssertSame($schemaDocumentedKeys, $documentedRowKeys, '高级设置文档表格完整覆盖且仅覆盖公开高级设置');
foreach (VOID_Settings_Schema::forSource('advanced', false) as $key => $definition) {
    if (!$definition['documented'] || !isset($documentedRows[$key])) {
        continue;
    }
    $token = settingsContractDefaultToken($definition['default']);
    $needle = $token === '未设置' ? '未设置' : '`' . $token . '`';
    settingsContractAssertSame(true, strpos($documentedRows[$key], '`' . $definition['type'] . '`，') !== false, $key . ' 文档类型与 schema 一致');
    settingsContractAssertSame(true, strpos($documentedRows[$key], $needle) !== false, $key . ' 文档默认值与 schema 一致');

    if (strpos($definition['type'], 'enum') !== false) {
        foreach ($definition['allowedValues'] as $allowedValue) {
            settingsContractAssertSame(
                true,
                strpos($documentedRows[$key], '`' . $allowedValue . '`') !== false,
                $key . ' 文档列出枚举值 ' . $allowedValue
            );
        }
    }
}

$frontendSettings = $desktop;
$frontendSettings['VOIDPlugin'] = true;
$frontend = VOID_Settings_FrontendConfig::build($frontendSettings, array(
    'searchBase' => '/search/',
    'home' => '/',
    'buildTime' => '2021-01-01T00:00',
    'mathJaxUrl' => '/math.js',
    'emotesBase' => '/emotes/',
    'votePath' => '/action/void?',
    'lightBg' => '',
    'darkBg' => '',
    'horizontalBg' => 1,
    'verticalBg' => 0,
    'fontStylesheets' => array('serif' => '/serif.css'),
    'version' => 4,
    'isDev' => 1,
    'unknownRuntimeValue' => 'must not leak'
));
$expectedFrontendKeys = array(
    'colorScheme', 'indexStyle', 'lazyload', 'enableMath', 'PJAX', 'headerMode',
    'lineNumbers', 'VOIDPlugin', 'searchBase', 'home', 'buildTime', 'mathJaxUrl',
    'emotesBase', 'votePath', 'lightBg', 'darkBg', 'horizontalBg', 'verticalBg',
    'fontStylesheets', 'version', 'isDev'
);
settingsContractAssertSame($expectedFrontendKeys, array_keys($frontend), 'FrontendConfig 只投影显式公开字段');
settingsContractAssertSame(true, $frontend['horizontalBg'], 'FrontendConfig 统一派生布尔类型');
settingsContractAssertSame('4', $frontend['version'], 'FrontendConfig 统一版本字符串类型');
settingsContractAssertSame(false, array_key_exists('head', $frontend), '自由格式 head 不公开到 VOIDConfig');
settingsContractAssertSame(false, array_key_exists('unknownCustomSetting', $frontend), '未知高级设置不公开到 VOIDConfig');
settingsContractAssertSame(false, array_key_exists('unknownRuntimeValue', $frontend), '未知运行时值不公开到 VOIDConfig');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} settings schema contract test(s) failed.\n");
    exit(1);
}

echo "All settings schema contract tests passed.\n";

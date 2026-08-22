<?php

class ThemeColorTestOptions
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

    public function __isset($name)
    {
        return isset($this->values[$name]);
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

$failures = 0;

function themeColorAssertSame($expected, $actual, $message)
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

foreach (array(1, 2, 3, '1', '2', '3') as $mode) {
    themeColorAssertSame((int) $mode, Utils::normalizeColorScheme($mode), 'valid mode ' . var_export($mode, true));
}

foreach (array(0, '0', null, false, true, '', 'invalid', '1foo', 1.0, 4, '4') as $mode) {
    themeColorAssertSame(3, Utils::normalizeColorScheme($mode), 'legacy or invalid mode ' . var_export($mode, true));
}

$GLOBALS['VOIDPluginREQ'] = 1.4;
Helper::$options = new ThemeColorTestOptions(array(
    'colorScheme' => '0',
    'advance' => json_encode(array(
        'darkModeTime' => array('start' => 21, 'end' => 6),
        'followSystemColorScheme' => true,
        'headerMode' => 2
    ))
));

$settings = Utils::getVOIDSettings();
themeColorAssertSame(3, $settings['colorScheme'], 'saved scheduled mode migrates to device-following');
themeColorAssertSame(false, array_key_exists('darkModeTime', $settings), 'darkModeTime is filtered from runtime settings');
themeColorAssertSame(false, array_key_exists('followSystemColorScheme', $settings), 'legacy device flag is filtered from runtime settings');
themeColorAssertSame(2, $settings['headerMode'], 'unrelated advanced settings remain available');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} theme color contract test(s) failed.\n");
    exit(1);
}

echo "All theme color mode contract tests passed.\n";

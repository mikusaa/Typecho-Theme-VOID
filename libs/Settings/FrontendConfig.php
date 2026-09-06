<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

require_once __DIR__ . '/Schema.php';
require_once __DIR__ . '/Resolver.php';

/**
 * Projects resolved settings into the intentionally small browser contract.
 */
class VOID_Settings_FrontendConfig
{
    public static function runtimeDefinitions()
    {
        return array(
            'searchBase' => array('type' => 'string', 'default' => ''),
            'home' => array('type' => 'string', 'default' => ''),
            'buildTime' => array('type' => 'string', 'default' => ''),
            'mathJaxUrl' => array('type' => 'string', 'default' => ''),
            'emotesBase' => array('type' => 'string', 'default' => ''),
            'votePath' => array('type' => 'string', 'default' => ''),
            'lightBg' => array('type' => 'string', 'default' => ''),
            'darkBg' => array('type' => 'string', 'default' => ''),
            'horizontalBg' => array('type' => 'boolean', 'default' => false),
            'verticalBg' => array('type' => 'boolean', 'default' => false),
            'fontStylesheets' => array('type' => 'object', 'default' => array()),
            'version' => array('type' => 'string', 'default' => ''),
            'isDev' => array('type' => 'boolean', 'default' => false)
        );
    }

    public static function project($settings)
    {
        $config = array();
        if (!is_array($settings)) {
            return $config;
        }

        foreach (VOID_Settings_Schema::all() as $key => $definition) {
            if (!$definition['exposeToFrontend'] || null === $definition['frontendKey']) {
                continue;
            }
            if (!array_key_exists($key, $settings)) {
                continue;
            }
            $config[$definition['frontendKey']] = self::normalizePublicValue(
                $settings[$key],
                $definition
            );
        }
        return $config;
    }

    public static function build($settings, $runtime = array())
    {
        $config = self::project($settings);
        if (!is_array($runtime)) {
            $runtime = array();
        }
        foreach (self::runtimeDefinitions() as $key => $definition) {
            $value = array_key_exists($key, $runtime) ? $runtime[$key] : $definition['default'];
            $config[$key] = self::normalizeRuntimeValue($value, $definition);
        }
        return $config;
    }

    private static function normalizePublicValue($value, $definition)
    {
        return VOID_Settings_Resolver::normalize($value, $definition);
    }

    private static function normalizeRuntimeValue($value, $definition)
    {
        if ($definition['type'] === 'boolean') {
            return (bool) $value;
        }
        if ($definition['type'] === 'object') {
            return is_array($value) ? $value : $definition['default'];
        }
        return is_scalar($value) ? (string) $value : $definition['default'];
    }
}

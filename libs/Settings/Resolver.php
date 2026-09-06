<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

require_once __DIR__ . '/Schema.php';

/**
 * Reads Typecho options and resolves the persisted setting contract.
 */
class VOID_Settings_Resolver
{
    public static function resolve($options = null, $context = array())
    {
        if (null === $options) {
            $options = Helper::options();
        }

        $theme = self::resolveTheme($options);
        $advanced = self::resolveAdvanced($options);
        $settings = $theme;

        foreach ($advanced as $key => $value) {
            // A Typecho theme option is the public source of truth for its key.
            if (VOID_Settings_Schema::definition($key)
                && VOID_Settings_Schema::definition($key)['source'] === 'theme') {
                continue;
            }
            $settings[$key] = $value;
        }

        if (self::isMobile($context) && array_key_exists('headerModeMobile', $advanced)) {
            $settings['headerMode'] = $advanced['headerModeMobile'];
        }

        $pluginRequirement = isset($GLOBALS['VOIDPluginREQ']) ? $GLOBALS['VOIDPluginREQ'] : '';
        $settings['VOIDPlugin'] = class_exists('Utils') && $pluginRequirement !== ''
            ? Utils::hasVOIDPlugin($pluginRequirement)
            : false;

        return $settings;
    }

    public static function get($options = null, $context = array())
    {
        return self::resolve($options, $context);
    }

    private static function resolveTheme($options)
    {
        $settings = array();
        foreach (VOID_Settings_Schema::forSource('theme', false) as $key => $definition) {
            if (!$definition['includeInRuntime']) {
                continue;
            }

            $value = self::optionValue($options, $key);
            if (null === $value || $value === '') {
                $value = $definition['default'];
            }
            $settings[$key] = self::normalize($value, $definition);
        }
        return $settings;
    }

    private static function resolveAdvanced($options)
    {
        $definitions = VOID_Settings_Schema::forSource('advanced');
        $settings = array();
        foreach ($definitions as $key => $definition) {
            if (!$definition['retired'] && $definition['includeInRuntime'] && null !== $definition['default']) {
                $settings[$key] = self::normalize($definition['default'], $definition);
            }
        }

        $raw = self::optionValue($options, 'advance');
        $decoded = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($decoded)) {
            return $settings;
        }

        foreach ($decoded as $key => $value) {
            $definition = VOID_Settings_Schema::definition($key);
            if (is_array($definition) && $definition['source'] === 'theme') {
                continue;
            }
            if (is_array($definition) && $definition['retired']) {
                continue;
            }
            if (is_array($definition) && $definition['source'] === 'advanced') {
                if (!$definition['includeInRuntime']) {
                    continue;
                }
                $normalized = self::normalize($value, $definition);
                if ($definition['normalizer'] === 'optionalIntegerEnum' && null === $normalized) {
                    unset($settings[$key]);
                } else {
                    $settings[$key] = $normalized;
                }
                continue;
            }

            // Advanced settings are intentionally extensible for custom templates.
            $settings[$key] = $value;
        }

        return $settings;
    }

    private static function optionValue($options, $key)
    {
        if (!is_object($options)) {
            return null;
        }
        return $options->{$key};
    }

    public static function normalize($value, $definition)
    {
        $normalizer = isset($definition['normalizer']) ? $definition['normalizer'] : 'string';
        $fallback = array_key_exists('default', $definition) ? $definition['default'] : null;
        if (array_key_exists('compatibilityFallback', $definition)
            && null !== $definition['compatibilityFallback']
            && !is_string($definition['compatibilityFallback'])) {
            $fallback = $definition['compatibilityFallback'];
        }

        switch ($normalizer) {
            case 'boolean':
                return self::normalizeBoolean($value, $fallback);
            case 'colorScheme':
                return self::normalizeColorScheme($value);
            case 'integerEnum':
                return self::normalizeIntegerEnum($value, $definition['allowedValues'], $fallback);
            case 'optionalIntegerEnum':
                return self::normalizeIntegerEnum($value, $definition['allowedValues'], null);
            case 'height':
                return self::normalizeHeight($value, $fallback);
            case 'brandFont':
                return self::normalizeBrandFont($value, $fallback);
            case 'link':
                return self::normalizeLinks($value);
            case 'nav':
                return self::normalizeNav($value);
            case 'commentFoldThreshold':
                return self::normalizeCommentFoldThreshold($value, $fallback);
            case 'nullableString':
                return null === $value ? null : self::normalizeString($value, null);
            case 'discard':
                return null;
            case 'raw':
                return self::normalizeString($value, $fallback);
            case 'string':
            default:
                return self::normalizeString($value, $fallback);
        }
    }

    public static function normalizeColorScheme($value)
    {
        if (is_int($value)) {
            $mode = $value;
        } elseif (is_string($value) && preg_match('/^[123]$/D', $value)) {
            $mode = intval($value);
        } else {
            return 3;
        }

        return in_array($mode, array(1, 2, 3), true) ? $mode : 3;
    }

    private static function normalizeBoolean($value, $fallback)
    {
        if (is_bool($value)) {
            return $value;
        }
        if (is_int($value) && ($value === 0 || $value === 1)) {
            return $value === 1;
        }
        if (is_string($value)) {
            $normalized = strtolower(trim($value));
            if (in_array($normalized, array('1', 'true', 'on', 'yes'), true)) {
                return true;
            }
            if (in_array($normalized, array('0', 'false', 'off', 'no', ''), true)) {
                return false;
            }
        }
        return is_bool($fallback) ? $fallback : false;
    }

    private static function normalizeIntegerEnum($value, $allowedValues, $fallback)
    {
        if (is_int($value)) {
            $candidate = $value;
        } elseif (is_string($value) && preg_match('/^-?[0-9]+$/D', $value)) {
            $candidate = intval($value);
        } else {
            return $fallback;
        }

        return in_array($candidate, $allowedValues, true) ? $candidate : $fallback;
    }

    private static function normalizeString($value, $fallback)
    {
        if (is_string($value)) {
            return $value;
        }
        if (is_scalar($value)) {
            return (string) $value;
        }
        return is_string($fallback) ? $fallback : '';
    }

    private static function normalizeHeight($value, $fallback)
    {
        if (is_int($value) && $value >= 0) {
            return $value;
        }
        if (is_float($value) && is_finite($value) && $value >= 0) {
            return $value;
        }
        if (is_string($value) && preg_match('/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/D', trim($value))) {
            return strpos($value, '.') === false ? intval($value) : (float) $value;
        }
        return is_string($fallback) || is_numeric($fallback) ? $fallback : '';
    }

    private static function normalizeBrandFont($value, $fallback)
    {
        $defaults = is_array($fallback) ? $fallback : array('src' => '', 'style' => 'normal', 'weight' => 'normal');
        if (!is_array($value)) {
            return $defaults;
        }

        $src = array_key_exists('src', $value) ? $value['src'] : $defaults['src'];
        $style = array_key_exists('style', $value) ? $value['style'] : $defaults['style'];
        $weight = array_key_exists('weight', $value) ? $value['weight'] : $defaults['weight'];
        $src = self::normalizeString($src, $defaults['src']);
        if ($src !== '' && class_exists('Utils')) {
            $safeSrc = Utils::getSafeHttpUrl($src);
            $src = null === $safeSrc || preg_match('/["<>]/', $safeSrc) ? '' : $safeSrc;
        }
        $style = self::normalizeString($style, $defaults['style']);
        if (!in_array(strtolower($style), array('normal', 'italic', 'oblique'), true)) {
            $style = $defaults['style'];
        }
        $weight = self::normalizeString($weight, $defaults['weight']);
        if (!preg_match('/^(?:normal|bold|bolder|lighter|[1-9][0-9]{2})$/D', $weight)) {
            $weight = $defaults['weight'];
        }

        $normalized = $value;
        $normalized['src'] = $src;
        $normalized['style'] = strtolower($style);
        $normalized['weight'] = $weight;
        return $normalized;
    }

    private static function normalizeLinks($value)
    {
        return is_array($value) ? $value : array();
    }

    private static function normalizeNav($value)
    {
        return is_array($value) ? $value : array();
    }

    private static function normalizeCommentFoldThreshold($value, $fallback)
    {
        if (!is_array($value) || count($value) < 2 || !is_numeric($value[0]) || !is_numeric($value[1])) {
            return $fallback;
        }
        $minimum = (float) $value[0];
        $ratio = (float) $value[1];
        if ($minimum < 0 || $ratio < 0 || !is_finite($minimum) || !is_finite($ratio)) {
            return $fallback;
        }
        return array($minimum == (int) $minimum ? (int) $minimum : $minimum, $ratio);
    }

    private static function isMobile($context)
    {
        if (is_array($context) && array_key_exists('isMobile', $context)) {
            return (bool) $context['isMobile'];
        }
        return class_exists('Utils') ? Utils::isMobile() : false;
    }
}

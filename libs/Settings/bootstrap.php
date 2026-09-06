<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

require_once __DIR__ . '/Schema.php';
require_once __DIR__ . '/Resolver.php';
require_once __DIR__ . '/FrontendConfig.php';

// Keep both the repository naming style and the architectural names callable.
if (!class_exists('VOID\\Settings\\Schema', false)) {
    class_alias('VOID_Settings_Schema', 'VOID\\Settings\\Schema');
}
if (!class_exists('VOID\\Settings\\Resolver', false)) {
    class_alias('VOID_Settings_Resolver', 'VOID\\Settings\\Resolver');
}
if (!class_exists('VOID\\Settings\\FrontendConfig', false)) {
    class_alias('VOID_Settings_FrontendConfig', 'VOID\\Settings\\FrontendConfig');
}

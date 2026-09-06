<?php

if (!defined('__TYPECHO_ROOT_DIR__')) {
    define('__TYPECHO_ROOT_DIR__', dirname(__DIR__, 2));
}

require_once dirname(__DIR__, 2) . '/libs/Contents.php';

$failures = 0;

function architectureAssertSame($expected, $actual, $message)
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

$expectedMethods = array(
    'archives', 'contentEx', 'excerptEx', 'getBannerDimensions', 'getBannerSourceHtml',
    'getCategories', 'getComment', 'getMeta', 'getPost', 'getRecentComments', 'getTags',
    'markdown', 'parseAlerts', 'parseBiaoQing', 'parseBoardCallback1', 'parseBoardCallback2',
    'parseHeader', 'parseHeaderCallback', 'parseImages', 'parseNotice', 'parsePhotoSet',
    'parseRuby', 'shouldShowBannerSource', 'theNext', 'thePrev', 'title', 'titleText'
);
$reflection = new ReflectionClass('Contents');
$actualMethods = array();
foreach ($reflection->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
    if ($method->getDeclaringClass()->getName() === 'Contents') {
        $actualMethods[] = $method->getName();
    }
}
sort($expectedMethods);
sort($actualMethods);
architectureAssertSame($expectedMethods, $actualMethods, 'Contents 保留完整公开兼容 API');

$root = dirname(__DIR__, 2);
$contentsSource = file_get_contents($root . '/libs/Contents.php');
$functionsSource = file_get_contents($root . '/functions.php');
$bootstrapSource = file_get_contents($root . '/libs/Content/bootstrap.php');

architectureAssertSame(false, strpos($contentsSource, 'Typecho_Db') !== false, 'facade 不再直接访问数据库');
architectureAssertSame(false, strpos($contentsSource, 'preg_replace') !== false, 'facade 不再保存转换实现');
architectureAssertSame(true, strpos($contentsSource, "require_once __DIR__ . '/Content/bootstrap.php'") !== false, 'facade 通过确定路径加载内部组件');
foreach (array('Utils.php', 'Contents.php', 'Comments.php') as $library) {
    architectureAssertSame(
        true,
        strpos($functionsSource, "require_once __DIR__ . '/libs/" . $library . "'") !== false,
        'functions.php 以 __DIR__ 加载 ' . $library
    );
}

$requiredClasses = array(
    'VOID_Content_HtmlScanner', 'VOID_Content_Transform_Alerts',
    'VOID_Content_Transform_PhotoSets', 'VOID_Content_Transform_Emotes',
    'VOID_Content_Transform_Images', 'VOID_Content_Transform_BannerSource',
    'VOID_Content_Transform_Markdown', 'VOID_Content_Pipeline',
    'VOID_Repository_ContentRepository', 'VOID_Repository_ArchiveRepository'
);
foreach ($requiredClasses as $className) {
    architectureAssertSame(true, class_exists($className, false), '加载入口提供 ' . $className);
}

architectureAssertSame(
    true,
    strpos($functionsSource, "VOID_registerContentsHook('markdown', array('Contents', 'markdown'))") !== false,
    'markdown Hook 继续指向 Contents facade'
);
architectureAssertSame(
    true,
    strpos($functionsSource, "VOID_registerContentsHook('contentEx', array('Contents', 'contentEx'))") !== false,
    'contentEx Hook 继续指向 Contents facade'
);
architectureAssertSame(
    true,
    strpos($functionsSource, "VOID_registerContentsHook('excerptEx', array('Contents', 'excerptEx'))") !== false,
    'excerptEx Hook 继续指向 Contents facade'
);

$runtimeSources = $functionsSource . $contentsSource . $bootstrapSource;
$directories = array($root . '/libs/Content', $root . '/libs/Repository');
foreach ($directories as $directory) {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory));
    foreach ($iterator as $file) {
        if ($file->isFile() && substr($file->getFilename(), -4) === '.php') {
            $source = file_get_contents($file->getPathname());
            $runtimeSources .= $source;
            architectureAssertSame(
                true,
                strpos($source, "if (!defined('__TYPECHO_ROOT_DIR__'))") !== false,
                $file->getFilename() . ' 保留直接访问保护'
            );
        }
    }
}

foreach (array('contentEx_999', 'excerptEx_999', 'shouldTruncateFeed', 'renderFeedTeaser', 'feedFullText', 'feedContentMode') as $retired) {
    architectureAssertSame(false, strpos($runtimeSources, $retired) !== false, '运行时不恢复退役 Feed 符号 ' . $retired);
}

if ($failures > 0) {
    fwrite(STDERR, "{$failures} architecture contract test(s) failed.\n");
    exit(1);
}

echo "All Contents architecture contract tests passed.\n";

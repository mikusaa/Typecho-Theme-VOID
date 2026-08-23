<?php

$failures = 0;

function galleryTemplateAssertSame($expected, $actual, $message)
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

function galleryTemplateAssertContains($needle, $haystack, $message)
{
    galleryTemplateAssertSame(true, strpos($haystack, $needle) !== false, $message);
}

function galleryTemplateAssertNotContains($needle, $haystack, $message)
{
    galleryTemplateAssertSame(false, stripos($haystack, $needle) !== false, $message);
}

$template = file_get_contents(dirname(__DIR__, 2) . '/Gallery.php');

galleryTemplateAssertContains('@package custom', $template, 'Gallery is registered as a custom page template');
galleryTemplateAssertContains("if (!defined('__TYPECHO_ROOT_DIR__')) exit;", $template, 'direct access remains guarded');
galleryTemplateAssertSame(2, substr_count($template, 'if (!Utils::isPjax())'), 'head and footer are omitted only for PJAX');
galleryTemplateAssertContains('<main id="pjax-container">', $template, 'template owns the main PJAX container');
galleryTemplateAssertContains("\$this->need('includes/ldjson.php')", $template, 'template keeps structured metadata');
galleryTemplateAssertContains("\$this->need('includes/banner.php')", $template, 'template keeps the page banner');
galleryTemplateAssertContains("\$this->need('includes/banner-source.php')", $template, 'template keeps banner attribution');
galleryTemplateAssertContains('data-void-gallery', $template, 'template exposes the Gallery controller root');
galleryTemplateAssertContains('<?php $this->content(); ?>', $template, 'content continues through the shared Contents pipeline');
galleryTemplateAssertContains("\$this->need('includes/comments.php')", $template, 'page comments preserve the normal template behavior');
galleryTemplateAssertNotContains('data-fancybox', $template, 'template does not restore Fancybox attributes');
galleryTemplateAssertNotContains('fancybox', $template, 'template does not depend on Fancybox code');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} Gallery template contract test(s) failed.\n");
    exit(1);
}

echo "All Gallery template contract tests passed.\n";

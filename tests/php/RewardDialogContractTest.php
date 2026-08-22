<?php

require_once dirname(__DIR__, 2) . '/libs/Utils.php';

$failures = 0;

function rewardUrlAssertSame($expected, $actual, $message)
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

function rewardUrlAssertContains($needle, $haystack, $message)
{
    rewardUrlAssertSame(true, strpos($haystack, $needle) !== false, $message);
}

function rewardUrlAssertNotContains($needle, $haystack, $message)
{
    rewardUrlAssertSame(false, strpos($haystack, $needle) !== false, $message);
}

$validUrls = array(
    'https://cdn.example/reward.png' => 'HTTPS URL',
    'http://cdn.example:8080/reward.png?size=2#qr' => 'HTTP URL with port, query and fragment',
    '//cdn.example/reward.png' => 'protocol-relative URL',
    '/images/reward.png' => 'root-relative path',
    'images/reward.png' => 'ordinary relative path',
    './images/reward.png' => 'current-directory relative path',
    '../images/reward.png' => 'parent-directory relative path',
    '?reward=qr' => 'query-relative URL'
);

foreach ($validUrls as $url => $message) {
    rewardUrlAssertSame($url, Utils::getSafeRewardUrl($url), 'allows ' . $message);
}

rewardUrlAssertSame(
    'https://cdn.example/reward.png?a=1&b=2',
    Utils::getSafeRewardUrl('  https://cdn.example/reward.png?a=1&amp;b=2  '),
    'decodes HTML entities and trims surrounding spaces'
);

$invalidUrls = array(
    '' => 'empty input',
    "https://cdn.example/reward.png\n" => 'raw control character',
    'https://cdn.example/reward.png&#10;javascript:alert(1)' => 'entity-encoded control character',
    'java&#x73;cript:alert(1)' => 'entity-obfuscated javascript scheme',
    'java&amp;#x73;cript:alert(1)' => 'nested entity-obfuscated javascript scheme',
    'javascript&colon;alert(1)' => 'named-entity-obfuscated javascript scheme',
    'javascript:alert(1)' => 'javascript scheme',
    'data:image/png;base64,AAAA' => 'data scheme',
    'blob:https://example.test/id' => 'blob scheme',
    'file:///tmp/reward.png' => 'file scheme',
    'ftp://example.test/reward.png' => 'other explicit scheme',
    'mailto:test@example.test' => 'mailto scheme',
    'https:///reward.png' => 'HTTP URL without host',
    'https://example.test:invalid/reward.png' => 'HTTP URL with invalid port',
    '//' => 'protocol-relative URL without host',
    '///reward.png' => 'malformed protocol-relative URL',
    ':not-a-relative-url' => 'invalid relative URL',
    'images/reward%ZZ.png' => 'malformed percent escape',
    'https:\\example.test\\reward.png' => 'absolute URL with backslashes',
    'images\\reward.png' => 'relative path with backslashes',
    'images&bsol;reward.png' => 'entity-encoded backslash path',
    'images/with space/reward.png' => 'URL containing whitespace'
);

foreach ($invalidUrls as $url => $message) {
    rewardUrlAssertSame(null, Utils::getSafeRewardUrl($url), 'rejects ' . $message);
}

foreach (array(null, false, true, 123, array('reward.png'), new stdClass()) as $value) {
    rewardUrlAssertSame(null, Utils::getSafeRewardUrl($value), 'rejects non-string ' . gettype($value));
}

$template = file_get_contents(dirname(__DIR__, 2) . '/includes/main.php');
rewardUrlAssertContains('Utils::getSafeRewardUrl', $template, 'template validates the configured reward URL');
rewardUrlAssertContains('data-void-reward-link', $template, 'template exposes the dialog trigger contract');
rewardUrlAssertContains('no-pjax', $template, 'fallback link bypasses PJAX');
rewardUrlAssertContains('target="_blank"', $template, 'fallback link opens the QR image separately');
rewardUrlAssertContains('rel="noopener noreferrer"', $template, 'fallback link isolates the opener');
rewardUrlAssertContains('href="<?php echo $rewardUrlHtml; ?>"', $template, 'reward trigger uses the validated real URL');
rewardUrlAssertContains('data-void-reward-dialog', $template, 'template exposes the native dialog contract');
rewardUrlAssertNotContains('data-fancybox', $template, 'reward markup no longer depends on Fancybox');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} reward URL contract test(s) failed.\n");
    exit(1);
}

echo "All reward URL contract tests passed.\n";

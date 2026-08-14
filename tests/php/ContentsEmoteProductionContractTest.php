<?php

class Utils
{
    public static function indexTheme($path)
    {
        echo 'https://example.test/custom/theme' . $path;
    }
}

require_once dirname(__DIR__, 2) . '/libs/Contents.php';

$manifestDir = dirname(__DIR__, 2) . '/assets/libs/emotes/packs';
$packages = array(
    'aru' => ':@(',
    'quyin' => ':&(',
    'bilibili' => ':$(',
    'mihoyo' => ':!(',
    'bangumi' => ':bgm('
);
$expectedCounts = array(
    'aru' => 62,
    'quyin' => 20,
    'bilibili' => 15,
    'mihoyo' => 60,
    'bangumi' => 97
);
$failures = array();

function productionAssert($condition, $message)
{
    global $failures;
    if (!$condition) {
        $failures[] = $message;
    }
}

foreach ($packages as $packageId => $tokenPrefix) {
    $manifestPath = $manifestDir . '/' . $packageId . '.json';
    $manifest = json_decode(file_get_contents($manifestPath), true);
    productionAssert(is_array($manifest), $packageId . ': manifest must be valid JSON');
    productionAssert(isset($manifest['id']) && $manifest['id'] === $packageId, $packageId . ': manifest ID mismatch');
    productionAssert(
        isset($manifest['items']) && count($manifest['items']) === $expectedCounts[$packageId],
        $packageId . ': unexpected item count'
    );

    if (!isset($manifest['items']) || !is_array($manifest['items'])) {
        continue;
    }

    foreach ($manifest['items'] as $item) {
        $token = isset($item['token']) ? $item['token'] : '';
        productionAssert(strpos($token, $tokenPrefix) === 0, $packageId . ': invalid token ' . $token);
        $html = Contents::parseBiaoQing($token);
        productionAssert($html !== $token, $packageId . ': token was not parsed: ' . $token);
        productionAssert(strpos($html, 'https://example.test/custom/theme/assets/libs/') !== false, $packageId . ': wrong theme URL');
        productionAssert(strpos($html, 'loading="lazy"') !== false, $packageId . ': missing lazy loading');
        productionAssert(strpos($html, 'decoding="async"') !== false, $packageId . ': missing async decoding');

        if ($packageId === 'bangumi') {
            productionAssert(strpos($html, 'class="biaoqing biaoqing--bangumi"') !== false, $token . ': wrong class');
            productionAssert(strpos($html, '/bangumi/poster/' . $item['id'] . '.webp"') !== false, $token . ': wrong poster');
            productionAssert(strpos($html, 'data-animated-src="') !== false, $token . ': missing animation URL');
            productionAssert(strpos($html, '/bangumi/animated/' . $item['id'] . '.gif"') !== false, $token . ': wrong animation URL');
            productionAssert(strpos($html, 'width="240" height="240"') !== false, $token . ': wrong original dimensions');
            productionAssert(
                strpos($html, 'alt="' . htmlspecialchars('Bangumi 娘：' . $item['label'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '"') !== false,
                $token . ': wrong accessible label'
            );
        } else {
            productionAssert(strpos($html, '/assets/libs/owo/biaoqing/') !== false, $token . ': legacy path not normalized');
        }
    }
}

productionAssert(Contents::parseBiaoQing(':bgm(000)') === ':bgm(000)', 'unknown Bangumi token must remain unchanged');
productionAssert(Contents::parseBiaoQing(':bgm(98)') === ':bgm(98)', 'malformed Bangumi token must remain unchanged');
productionAssert(Contents::parseBiaoQing(':@(不存在)') === ':@(不存在)', 'unknown legacy token must remain unchanged');
productionAssert(Contents::parseBiaoQing('::(滑稽)') === '::(滑稽)', 'removed Paopao token must remain unchanged');
productionAssert(
    Contents::parseBiaoQing('<code>:bgm(053)</code>') === '<code>:bgm(053)</code>',
    'tokens inside code must remain unchanged'
);
productionAssert(
    Contents::parseBiaoQing('<a href="/:bgm(053)">x</a>') === '<a href="/:bgm(053)">x</a>',
    'tokens inside HTML attributes must remain unchanged'
);

if (!empty($failures)) {
    foreach ($failures as $failure) {
        fwrite(STDERR, 'not ok - ' . $failure . "\n");
    }
    fwrite(STDERR, count($failures) . " production contract test(s) failed.\n");
    exit(1);
}

echo "Parsed all 254 production image emotes from manifest allowlists.\n";

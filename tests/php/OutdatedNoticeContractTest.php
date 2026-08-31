<?php

require_once dirname(__DIR__, 2) . '/libs/Utils.php';

$failures = 0;

function outdatedNoticeAssertSame($expected, $actual, $message)
{
    global $failures;
    if ($expected === $actual) {
        echo "ok - {$message}\n";
        return;
    }

    ++$failures;
    echo 'not ok - ' . $message . ' (expected ' . var_export($expected, true)
        . ', got ' . var_export($actual, true) . ")\n";
}

function outdatedNoticeArchive($created, $modified, $showOutdated = '1')
{
    $archive = new stdClass();
    $archive->created = $created;
    $archive->modified = $modified;
    $archive->fields = new stdClass();
    $archive->fields->showOutdated = $showOutdated;
    return $archive;
}

$now = 2000000000;
$oldTimestamp = $now - (91 * 24 * 3600);
$recentTimestamp = $now - (10 * 24 * 3600);
$exactThreshold = $now - (90 * 24 * 3600);
$justOverThreshold = $exactThreshold - 1;

$old = Utils::isOutdated(outdatedNoticeArchive($oldTimestamp, $oldTimestamp), $now);
outdatedNoticeAssertSame(true, $old['is'], '最后更新时间超过 90 天时判定为过时');
outdatedNoticeAssertSame($oldTimestamp, $old['updatedAt'], '有效修改时间作为提醒日期基准');

$atThreshold = Utils::isOutdated(outdatedNoticeArchive($exactThreshold, $exactThreshold), $now);
outdatedNoticeAssertSame(false, $atThreshold['is'], '最后更新时间恰好 90 天时不判定为过时');

$overThreshold = Utils::isOutdated(outdatedNoticeArchive($justOverThreshold, $justOverThreshold), $now);
outdatedNoticeAssertSame(true, $overThreshold['is'], '最后更新时间超过 90 天一秒时判定为过时');

$recentUpdate = Utils::isOutdated(outdatedNoticeArchive($oldTimestamp, $recentTimestamp), $now);
outdatedNoticeAssertSame(false, $recentUpdate['is'], '创建时间很久但最近更新的文章不判定为过时');
outdatedNoticeAssertSame($recentTimestamp, $recentUpdate['updatedAt'], '有效修改时间优先于创建时间');

$disabled = outdatedNoticeArchive($oldTimestamp, $oldTimestamp, '0');
outdatedNoticeAssertSame(false, Utils::shouldShowOutdatedNotice($disabled), '关闭开关时不显示文章时效提醒');

$invalidModified = outdatedNoticeArchive($oldTimestamp, 'invalid');
$fallback = Utils::isOutdated($invalidModified, $now);
outdatedNoticeAssertSame(true, $fallback['is'], '修改时间无效时回退到创建时间判断');
outdatedNoticeAssertSame($oldTimestamp, $fallback['updatedAt'], '修改时间无效时使用创建时间作为提醒日期');
outdatedNoticeAssertSame(91.0, $fallback['updated'], '修改时间无效时更新天数同步回退到创建时间');

$invalidDates = outdatedNoticeArchive('invalid', null);
$invalidResult = Utils::isOutdated($invalidDates, $now);
outdatedNoticeAssertSame(false, $invalidResult['is'], '创建和修改时间都无效时安全地不显示');
outdatedNoticeAssertSame(0, $invalidResult['updatedAt'], '创建和修改时间都无效时返回空日期基准');

$missingDates = Utils::isOutdated(new stdClass(), $now);
outdatedNoticeAssertSame(false, $missingDates['is'], '缺少时间属性时安全地不显示');
outdatedNoticeAssertSame(false, Utils::shouldShowOutdatedNotice(new stdClass()), '缺少字段对象时安全地不显示');

if ($failures > 0) {
    fwrite(STDERR, "{$failures} outdated notice contract test(s) failed.\n");
    exit(1);
}

echo "All outdated notice contract tests passed.\n";

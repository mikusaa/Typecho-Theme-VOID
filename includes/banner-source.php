<?php
/**
 * banner-source.php
 *
 * 主图来源说明
 *
 * @author      熊猫小A
 * @version     2026-03-20 0.1
 */
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

$bannerSourceTheme = isset($bannerSourceTheme) && 'dark' === $bannerSourceTheme ? 'dark' : 'light';
$bannerSourceDisplayMode = isset($bannerSourceDisplayMode) ? $bannerSourceDisplayMode : 'normal';
$bannerSourceUseContainer = !isset($bannerSourceUseContainer) || false !== $bannerSourceUseContainer;

if (!Contents::shouldShowBannerSource($this, $bannerSourceDisplayMode)) {
    return;
}

$bannerSourceHtml = Contents::getBannerSourceHtml($this->fields->bannerSource);
if ($bannerSourceHtml === '') {
    return;
}

$bannerSourceClass = 'banner-source';
if ('dark' === $bannerSourceTheme) {
    $bannerSourceClass .= ' banner-source--dark';
}

$bannerSourceInnerClass = 'banner-source__inner';
if ($bannerSourceUseContainer) {
    $bannerSourceInnerClass .= ' container';
}
?>
<div class="<?php echo $bannerSourceClass; ?>">
    <div class="<?php echo $bannerSourceInnerClass; ?>">
        <p class="banner-source__text"><?php echo $bannerSourceHtml; ?></p>
    </div>
</div>

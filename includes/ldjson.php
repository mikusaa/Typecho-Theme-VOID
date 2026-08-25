<?php
/**
 * main.php
 * 
 * 内容页面主要区域，PJAX 作用区域
 * 
 * @author      熊猫小A
 * @version     2019-01-15 0.1
 */
if (!defined('__TYPECHO_ROOT_DIR__')) exit;
$setting = $GLOBALS['VOIDSetting'];
$siteName = Utils::decodeHtmlText(Utils::captureOutput(Helper::options(), 'title'));
ob_start();
Utils::index('/');
$homeUrl = ob_get_clean();

$publisher = array(
    '@type' => 'Organization',
    'name' => $siteName
);
$isContentPage = $this->have() && ($this->is('post') || $this->is('page'));
$contentAuthor = $isContentPage ? $this->author : null;
$hasAuthor = is_object($contentAuthor);
if ($hasAuthor && !empty($contentAuthor->mail)) {
    ob_start();
    Utils::gravatar($contentAuthor->mail, 200);
    $publisher['logo'] = array(
        '@type' => 'ImageObject',
        'url' => Utils::decodeHtmlEntities(ob_get_clean())
    );
}

$structuredData = null;
if ($this->is('post') && $hasAuthor) {
    $canonicalUrl = Utils::decodeHtmlEntities(Utils::captureOutput($this, 'permalink'));
    $author = array(
        '@type' => 'Person',
        'name' => Utils::decodeHtmlText(Utils::captureOutput($contentAuthor, 'screenName'))
    );
    if (!empty($contentAuthor->mail)) {
        ob_start();
        Utils::gravatar($contentAuthor->mail, 400);
        $author['image'] = array(
            '@type' => 'ImageObject',
            'url' => Utils::decodeHtmlEntities(ob_get_clean()),
            'width' => 400,
            'height' => 400
        );
    }
    $authorUrl = Utils::decodeHtmlEntities(Utils::captureOutput($contentAuthor, 'permalink'));
    if ($authorUrl !== '') {
        $author['url'] = $authorUrl;
    }

    $structuredData = array(
        '@context' => 'https://schema.org',
        '@type' => 'Article',
        'publisher' => $publisher,
        'author' => $author,
        'headline' => Utils::decodeHtmlText(Utils::captureOutput($this, 'title')),
        'url' => $canonicalUrl,
        'datePublished' => date('c', $this->created),
        'dateModified' => date('c', $this->modified),
        'mainEntityOfPage' => array(
            '@type' => 'WebPage',
            '@id' => $canonicalUrl
        )
    );
    $banner = !empty($this->fields->banner) ? $this->fields->banner : $setting['defaultBanner'];
    if (!empty($banner)) {
        $structuredData['image'] = array('@type' => 'ImageObject', 'url' => (string) $banner);
    }
    $description = Utils::decodeHtmlText($this->fields->excerpt);
    if ($description !== '') {
        $structuredData['description'] = $description;
    }
} elseif ($this->is('page') && $hasAuthor) {
    $canonicalUrl = Utils::decodeHtmlEntities(Utils::captureOutput($this, 'permalink'));
    $structuredData = array(
        '@context' => 'https://schema.org',
        '@type' => 'WebPage',
        'name' => Utils::decodeHtmlText(Utils::captureOutput($this, 'title')),
        'url' => $canonicalUrl,
        'publisher' => $publisher,
        'mainEntityOfPage' => array(
            '@type' => 'WebPage',
            '@id' => $canonicalUrl
        )
    );
    $description = Utils::decodeHtmlText($this->fields->excerpt);
    if ($description !== '') {
        $structuredData['description'] = $description;
    }
} elseif ($this->is('index')) {
    $structuredData = array(
        '@context' => 'https://schema.org',
        '@type' => 'WebSite',
        'publisher' => $publisher,
        'url' => $homeUrl,
        'mainEntityOfPage' => array(
            '@type' => 'WebPage',
            '@id' => $homeUrl
        )
    );
    if (!empty($setting['defaultBanner'])) {
        $structuredData['image'] = array(
            '@type' => 'ImageObject',
            'url' => (string) $setting['defaultBanner']
        );
    }
    $description = Utils::decodeHtmlText(Helper::options()->description);
    if ($description !== '') {
        $structuredData['description'] = $description;
    }
} elseif ($this->is('archive')) {
    $archiveUrl = (string) $this->getArchiveUrl();
    $structuredData = array(
        '@context' => 'https://schema.org',
        '@type' => 'Series',
        'url' => $archiveUrl,
        'name' => Contents::titleText($this),
        'mainEntityOfPage' => array(
            '@type' => 'WebPage',
            '@id' => $archiveUrl
        )
    );
}

$structuredJson = null === $structuredData ? '' : Utils::encodeJsonForHtml($structuredData, '');
?>
<?php if ($structuredJson !== ''): ?>
<script type="application/ld+json"><?php echo $structuredJson; ?></script>
<?php endif; ?>

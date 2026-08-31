<?php
/**
 * head.php
 * 
 * <head>
 * 
 * @author      熊猫小A
 * @version     2019-01-15 0.1
 */
if (!defined('__TYPECHO_ROOT_DIR__')) exit;
$setting = $GLOBALS['VOIDSetting']; 

if (isset($_POST['void_action'])) {
    if ($_POST['void_action'] == 'getLoginAction') {
        if ($this->request->isPost()) {
            echo $this->options->loginAction;
        }
        exit;
    }
}
?>
<!DOCTYPE HTML>
<html>
    <head>
    <meta charset="<?php $this->options->charset(); ?>">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="renderer" content="webkit">
    <meta name="HandheldFriendly" content="true">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <script>
    (function () {
        var mode = <?php echo intval($setting['colorScheme']); ?>;
        var override = document.cookie.match(/(?:^|; )void_theme_override=(light|dark)(?:;|$)/);
        var isDark = false;

        if (override) {
            isDark = override[1] === 'dark';
        } else if (mode === 2) {
            isDark = true;
        } else if (mode === 3) {
            isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        }

        document.documentElement.classList.toggle('theme-dark', isDark);
        document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    })();
    </script>
    <?php 
    $banner = '';
    $description = '';
    $isContentPage = $this->have() && ($this->is('post') || $this->is('page'));
    $pageUrl = $isContentPage
        ? Utils::decodeHtmlEntities(Utils::captureOutput($this, 'permalink'))
        : rtrim($this->options->rootUrl, '/') . '/' . ltrim($this->request->getRequestUri(), '/');
    if($isContentPage){
        if($this->fields->banner != '')
            $banner=$this->fields->banner;
        if($this->fields->excerpt != '')
            $description = $this->fields->excerpt;
        if($description == '') {
            ob_start();
            $this->excerpt(50);
            $description = ob_get_clean();
        }
    }else{
        $description = Helper::options()->description;
    }
    $pageTitle = Contents::titleText($this);
    $siteTitle = Utils::decodeHtmlText(Utils::captureOutput($this->options, 'title'));
    $authorName = $isContentPage ? Utils::decodeHtmlText(Utils::captureOutput($this, 'author')) : '';
    $description = Utils::decodeHtmlText($description);

    ob_start();
    Utils::index('/search/');
    $searchBase = ob_get_clean();
    ob_start();
    Utils::index('/');
    $homeUrl = ob_get_clean();
    ob_start();
    Utils::getBuildTime();
    $buildTime = ob_get_clean();
    ob_start();
    Utils::indexTheme('/assets/libs/emotes/');
    $emotesBase = ob_get_clean();
    $mathJaxUrl = '';
    if ($setting['enableMath']) {
        ob_start();
        Utils::indexTheme('/assets/libs/mathjax/4.1.3/tex-svg.js');
        $mathJaxUrl = ob_get_clean();
    }
    ob_start();
    Utils::index('/action/void?');
    $votePath = ob_get_clean();
    ob_start();
    Utils::indexTheme('/assets/fonts/fontsource/noto-serif-sc/5.3.0-r1/wght.css');
    $serifFontStylesheet = ob_get_clean();

    $voidConfig = array(
        'PJAX' => (bool) $setting['pjax'],
        'searchBase' => $searchBase,
        'home' => $homeUrl,
        'buildTime' => $buildTime,
        'enableMath' => (bool) $setting['enableMath'],
        'mathJaxUrl' => $mathJaxUrl,
        'lazyload' => (bool) $setting['lazyload'],
        'colorScheme' => (int) $setting['colorScheme'],
        'headerMode' => (int) $setting['headerMode'],
        'emotesBase' => $emotesBase,
        'VOIDPlugin' => (bool) $setting['VOIDPlugin'],
        'votePath' => $votePath,
        'lightBg' => '',
        'darkBg' => '',
        'lineNumbers' => (bool) $setting['lineNumbers'],
        'horizontalBg' => !empty($setting['siteBg']),
        'verticalBg' => !empty($setting['siteBgVertical']),
        'indexStyle' => (int) $setting['indexStyle'],
        'fontStylesheets' => array(
            'serif' => $serifFontStylesheet
        ),
        'version' => (string) $GLOBALS['VOIDVersion'],
        'isDev' => true
    );
    ?>
    <title><?php echo Utils::escapeHtml($pageTitle); ?></title>
    <?php if($isContentPage): ?>
    <meta name="author" content="<?php echo Utils::escapeHtml($authorName); ?>" />
    <?php endif; ?>
    <meta name="description" content="<?php echo Utils::escapeHtml($description); ?>" />
    <meta property="og:title" content="<?php echo Utils::escapeHtml($pageTitle); ?>" />
    <meta property="og:description" content="<?php echo Utils::escapeHtml($description); ?>" />
    <meta property="og:site_name" content="<?php echo Utils::escapeHtml($siteTitle); ?>" />
    <meta property="og:type" content="<?php echo $isContentPage ? 'article' : 'website'; ?>" />
    <meta property="og:url" content="<?php echo Utils::escapeHtml($pageUrl); ?>" />
    <meta property="og:image" content="<?php echo Utils::escapeHtml($banner); ?>" />
    <?php if($isContentPage): ?>
    <meta property="article:published_time" content="<?php echo date('c', $this->created); ?>" />
    <meta property="article:modified_time" content="<?php echo date('c', $this->modified); ?>" />
    <?php endif; ?>
    <meta name="twitter:title" content="<?php echo Utils::escapeHtml($pageTitle); ?>" />
    <meta name="twitter:description" content="<?php echo Utils::escapeHtml($description); ?>" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:site" content="<?php echo Utils::escapeHtml('@' . $setting['twitterId']); ?>" />
    <meta name="twitter:creator" content="<?php echo Utils::escapeHtml('@' . $setting['twitterId']); ?>" />
    <meta name="twitter:image" content="<?php echo Utils::escapeHtml($banner); ?>" />
    <?php $this->header('commentReply=&description=&social=0'); ?>

    <!--CSS-->
    <link rel="preload" href="<?php Utils::indexTheme('/assets/fonts/fontsource/open-sans/5.3.0-r1/files/open-sans-latin-wght-normal.woff2'); ?>" as="font" type="font/woff2" crossorigin="anonymous">
    <link rel="stylesheet" href="<?php Utils::indexTheme('/assets/fonts/fontsource/open-sans/5.3.0-r1/wght.css'); ?>">
    <?php if(Utils::isSerif($setting)): ?>
        <link id="stylesheet_noto" href="<?php echo Utils::escapeHtml($serifFontStylesheet); ?>" rel="stylesheet">
    <?php endif; ?>
    <?php if($setting['useFiraCodeFont']): ?>
        <link href="<?php Utils::indexTheme('/assets/fonts/fontsource/fira-code/5.3.0-r1/400.css'); ?>" rel="stylesheet">
    <?php endif; ?>
    <link rel="stylesheet" href="<?php Utils::indexTheme('/assets/bundle-322b12e845.css');?>">
    <link rel="stylesheet" href="<?php Utils::indexTheme('/assets/VOID-3eeafbfdad.css');?>">

    <!--JS-->
    <script src="<?php Utils::indexTheme('/assets/bundle-header-1c2d9f3c9f.js'); ?>"></script>
    <script>
    window.VOIDConfig = <?php echo Utils::encodeJsonForHtml($voidConfig, '{}'); ?>;
    </script>
    <script src="<?php Utils::indexTheme('/assets/header-b1fc49e91a.js'); ?>"></script>
    
    <?php echo $setting['head']; ?>
    <style>
        <?php if(!empty($setting['desktopBannerHeight'])): ?>
        @media screen and (min-width: 768px){
            main>.lazy-wrap{min-height: <?php echo $setting['desktopBannerHeight']; ?>vh;}
        }
        <?php endif; ?>

        <?php if(!empty($setting['mobileBannerHeight'])): ?>
        @media screen and (max-width: 768px){
            main>.lazy-wrap{min-height: <?php echo $setting['mobileBannerHeight']; ?>vh;}
        }
        <?php endif; ?>
    </style>

    <?php if (array_key_exists('src', $setting['brandFont']) && !empty($setting['brandFont']['src'])): ?>
    <style>
    @font-face {
        font-family: "BrandFont";
        src: url("<?php echo $setting['brandFont']['src']; ?>");
        font-display: swap;
    }
    .brand {
        font-family: BrandFont, sans-serif;
        font-style: <?php echo $setting['brandFont']['style']; ?>!important;
        font-weight: <?php echo $setting['brandFont']['weight']; ?>!important;
    }
    </style>
    <?php endif; ?>

    <?php if($setting['useFiraCodeFont']): ?>
        <style>.yue code, .yue tt {font-family: "Fira Code", Menlo, Monaco, Consolas, "Courier New", monospace}</style>
    <?php endif; ?>

    </head>

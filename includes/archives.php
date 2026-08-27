<?php
/**
 * archives.php
 * 
 * 搜索、分类、标签等页面
 * 
 * @author      熊猫小A
 * @version     2019-01-15 0.1
 */
if (!defined('__TYPECHO_ROOT_DIR__')) exit;
$setting = $GLOBALS['VOIDSetting'];
?>

<main id="pjax-container">
    <title hidden>
        <?php Contents::title($this); ?>
    </title>

    <?php $this->need('includes/ldjson.php'); ?>
    <?php $this->need('includes/banner.php'); ?>

    <div class="wrapper container <?php if($setting['indexStyle'] == 1) echo 'narrow'; else echo 'wide'; ?>">
        <section id="index-list" class="float-up">
            <?php $hasPosts = $this->have(); ?>
            <h1 hidden class="post-title"><?php $this->archiveTitle(array(
                'category'  =>  _t('分类 "%s" 下的文章'),
                'search'    =>  _t('包含关键字 "%s" 的文章'),
                'tag'       =>  _t('包含标签 "%s" 的文章'),
                'author'    =>  _t('"%s" 发布的文章')
            ), '', '');  ?></h1>
            <?php if($hasPosts): ?>
            <ul id="masonry">
            <?php $priorityBannerCount = 0; ?>
            <?php while($this->next()): ?>
                <?php
                    $postId = (int) Utils::captureOutput($this, 'cid');
                    $postPermalink = Utils::decodeHtmlEntities(Utils::captureOutput($this, 'permalink'));
                    $postTitle = Utils::decodeHtmlText(Utils::captureOutput($this, 'title'));
                    $bannerUrl = trim((string) $this->fields->banner);
                    $bannerDimensions = Contents::getBannerDimensions($bannerUrl, $this->fields->bannerMeta);
                    $bannerDimensionAttributes = null === $bannerDimensions
                        ? ''
                        : ' width="' . $bannerDimensions[0] . '" height="' . $bannerDimensions[1] . '"';
                    $bannerAsCover = (string) $this->fields->bannerascover;
                    if($bannerUrl == '' || !in_array($bannerAsCover, array('0', '1', '2'), true)) $bannerAsCover='0';
                    $renderBanner = $bannerUrl !== '' && $bannerAsCover !== '0';
                ?>
                <li id="p-<?php echo $postId; ?>"  class="masonry-item style-<?php echo $bannerAsCover; ?>">
                    <a href="<?php echo Utils::escapeHtml($postPermalink); ?>">
                        <article class="yue">
                            <?php if($renderBanner): ?>
                                <div class="banner">
                                    <?php $priorityBannerCount++; ?>
                                    <?php if ($priorityBannerCount == 1): ?>
                                        <img src="<?php echo Utils::escapeHtml($bannerUrl); ?>" alt=""<?php echo $bannerDimensionAttributes; ?> loading="eager" fetchpriority="high" decoding="async" data-void-card-cover>
                                    <?php elseif ($priorityBannerCount == 2): ?>
                                        <img src="<?php echo Utils::escapeHtml($bannerUrl); ?>" alt=""<?php echo $bannerDimensionAttributes; ?> loading="eager" decoding="async" data-void-card-cover>
                                    <?php else: ?>
                                        <img src="<?php echo Utils::escapeHtml($bannerUrl); ?>" alt=""<?php echo $bannerDimensionAttributes; ?> loading="lazy" decoding="async" data-void-card-cover>
                                    <?php endif; ?>
                                </div>
                            <?php endif; ?>
                            <div class="content-wrap">
                                <div class="post-meta-index">
                                    <time datetime="<?php echo date('c', $this->created); ?>"><?php echo date('M d, Y', $this->created); ?></time>
                                    <?php if($setting['VOIDPlugin']): ?>
                                        <span class="word-count">+ <?php echo (int) $this->wordCount; ?> 字</span>
                                    <?php endif; ?>
                                </div>

                                <h1 class="title"><?php echo Utils::escapeHtml($postTitle); ?></h1>
                                <?php if($this->fields->excerpt != ''): ?> 
                                    <p class="headline single"><?php echo Utils::escapeHtml(Utils::decodeHtmlText($this->fields->excerpt)); ?></p>
                                <?php else: ?>
                                    <p class="excerpt"><?php if(Utils::isMobile()) $this->excerpt(60); else $this->excerpt(100); ?><?php if($this->is('index')) echo ' | <a class="full-link" href="' . Utils::escapeHtml($postPermalink) . '">阅读全文</a>'; ?></p>
                                <?php endif; ?>
                            </div>
                        </article>
                    </a>
                </li>
                <script>VOID_Ui.MasonryCtrler.watch("p-<?php echo $postId; ?>");</script>
            <?php endwhile; ?>
            </ul>
            <?php else: ?>
                <div class="archive-empty" role="status">
                    <p>暂时没有找到文章</p>
                </div>
            <?php endif; ?>
        </section>
        
        <?php if($hasPosts) $this->pageNav('<span aria-label="上一页">←</span>', '<span aria-label="下一页">→</span>', 1, '...', 'wrapClass=pager&prevClass=prev&nextClass=next'); ?>
    </div>
</main>

<?php
/**
 * VOID：无类型
 * 
 * 作者：<a href="https://www.imalan.cn">熊猫小A</a>
 * 
 * @package     Typecho-Theme-VOID
 * @author      熊猫小A
 * @version     3.5.4
 * @link        https://blog.imalan.cn/archives/247/
 */
if (!defined('__TYPECHO_ROOT_DIR__')) exit;
$setting = $GLOBALS['VOIDSetting']; 

if(!Utils::isPjax()){
    $this->need('includes/head.php');
    $this->need('includes/header.php');
} 
?>

<main id="pjax-container">
    <title hidden>
        <?php Contents::title($this); ?>
    </title>

    <?php $this->need('includes/ldjson.php'); ?>
    <?php $this->need('includes/banner.php'); ?>

    <div class="wrapper container <?php if($setting['indexStyle'] == 1) echo 'narrow'; else echo 'wide'; ?>">
        <section id="index-list" class="float-up">
            <ul id="masonry">
            <?php $priorityBannerCount = 0; ?>
            <?php while($this->next()): ?>
                <?php
                    $postId = (int) Utils::captureOutput($this, 'cid');
                    $postPermalink = Utils::decodeHtmlEntities(Utils::captureOutput($this, 'permalink'));
                    $postTitle = Utils::decodeHtmlText(Utils::captureOutput($this, 'title'));
                    $bannerAsCover = (string) $this->fields->bannerascover;
                    if($this->fields->banner == '' || !in_array($bannerAsCover, array('0', '1', '2'), true)) $bannerAsCover='0';
                ?>
                <li id="p-<?php echo $postId; ?>" class="masonry-item style-<?php
                        if($this->fields->showfullcontent=='1') {
                            if($bannerAsCover == '2')
                                echo '1';
                            echo ' full-content';                        
                        } else {
                            echo $bannerAsCover;
                        }
                    ?>">
                
                    <?php if($this->fields->showfullcontent != '1'): ?>
                        <a href="<?php echo Utils::escapeHtml($postPermalink); ?>">
                    <?php endif; ?>
                        <article class="yue">
                            <?php if($this->fields->banner != ''): ?>
                            <?php if($this->fields->showfullcontent == '1'): ?>
                                <a href="<?php echo Utils::escapeHtml($postPermalink); ?>">
                            <?php endif; ?>
                                <div class="banner">
                                    <?php $priorityBannerCount++; ?>
                                    <?php if ($priorityBannerCount == 1): ?>
                                        <img src="<?php echo Utils::escapeHtml($this->fields->banner); ?>" alt="" loading="eager" fetchpriority="high" decoding="async">
                                    <?php elseif ($priorityBannerCount == 2): ?>
                                        <img src="<?php echo Utils::escapeHtml($this->fields->banner); ?>" alt="" loading="eager" decoding="async">
                                    <?php else: ?>
                                        <img src="<?php echo Utils::escapeHtml($this->fields->banner); ?>" alt="" loading="lazy" decoding="async">
                                    <?php endif; ?>
                                </div>
                            <?php if($this->fields->showfullcontent == '1'): ?>
                                </a>
                            <?php endif; ?>
                            <?php endif; ?>
                            <div class="content-wrap">
                                <div class="post-meta-index">
                                    <time datetime="<?php echo date('c', $this->created); ?>"><?php echo date('M d, Y', $this->created); ?></time>
                                    <?php if($setting['VOIDPlugin']): ?>
                                        <span class="word-count">+ <?php echo (int) $this->wordCount; ?> 字</span>
                                    <?php endif; ?>
                                </div>

                                <?php if($this->fields->showfullcontent == '1'): ?>
                                    <a href="<?php echo Utils::escapeHtml($postPermalink); ?>">
                                <?php endif; ?>
                                <h1 class="title"><?php echo Utils::escapeHtml($postTitle); ?></h1>
                                <?php if($this->fields->showfullcontent == '1'): ?>
                                    </a>
                                <?php endif; ?>
                                
                                <?php if($this->fields->excerpt != '') echo '<p class="headline content">' . Utils::escapeHtml(Utils::decodeHtmlText($this->fields->excerpt)) . '</p>'; ?>

                                <div class="articleBody">
                                <?php if($this->fields->showfullcontent != '1'): ?>
                                    <?php if($this->fields->excerpt == ''): ?>
                                        <p><?php if(Utils::isMobile()) $this->excerpt(60); else $this->excerpt(80); ?></p>
                                    <?php endif; ?>
                                <?php else: ?>
                                    <?php $this->content(); ?>
                                <?php endif; ?>
                                </div>

                            </div>
                        </article>
                    <?php if($this->fields->showfullcontent != '1'): ?>
                        </a>
                    <?php endif; ?>
                </li>
                <script>VOID_Ui.MasonryCtrler.watch("p-<?php echo $postId; ?>");</script>
            <?php endwhile; ?>
            </ul>
        </section>
        <?php $this->pageNav('<span aria-label="上一页">←</span>', '<span aria-label="下一页">→</span>', 1, '...', 'wrapClass=pager&prevClass=prev&nextClass=next'); ?>
    </div>
</main>

<?php
if(!Utils::isPjax()){
    $this->need('includes/footer.php');
} 
?>

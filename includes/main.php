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
$rewardUrl = Utils::getSafeRewardUrl(isset($setting['reward']) ? $setting['reward'] : '');
$rewardUrlHtml = null === $rewardUrl ? '' : htmlspecialchars($rewardUrl, ENT_QUOTES, 'UTF-8');
$socialUrl = Utils::decodeHtmlEntities(Utils::captureOutput($this, 'permalink'));
$socialTitle = Contents::titleText($this);
$socialExcerpt = Utils::decodeHtmlText($this->fields->excerpt);
$socialImage = (string) $this->fields->banner;
$socialAuthor = Utils::decodeHtmlText(Utils::captureOutput($this, 'author'));
$socialTwitter = $setting['twitterId'] !== '' ? $setting['twitterId'] : $socialAuthor;
$socialWeibo = $setting['weiboId'] !== '' ? $setting['weiboId'] : $socialAuthor;
?>

<main id="pjax-container">
    <title hidden>
        <?php Contents::title($this); ?>
    </title>

    <?php $this->need('includes/ldjson.php'); ?>
    <?php $this->need('includes/banner.php'); ?>
    <?php $this->need('includes/banner-source.php'); ?>

    <div class="wrapper container">
        <div class="contents-wrap"> <!--start .contents-wrap-->
            <section id="post" class="float-up">
                <article class="post yue">

                    <?php if($this->is('post')): ?>
                        <?php $postCheck = Utils::isOutdated($this); if($postCheck["is"] && Utils::shouldShowOutdatedNotice($this)): ?>
                            <?php $outdatedDate = date('Y-m-d', (int) $postCheck['updatedAt']); ?>
                            <aside class="article-outdated-notice" aria-labelledby="article-outdated-notice-title">
                                <p class="article-outdated-notice__title" id="article-outdated-notice-title">
                                    <svg class="article-outdated-notice__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                                        <circle cx="8" cy="8" r="6.5"></circle>
                                        <path d="M8 4.4v3.9l2.5 1.5"></path>
                                    </svg>
                                    <span>内容时效提醒</span>
                                </p>
                                <p class="article-outdated-notice__body">本文最后更新于 <time datetime="<?php echo Utils::escapeHtml($outdatedDate); ?>"><?php echo Utils::escapeHtml($outdatedDate); ?></time>。文中涉及的方法、版本、链接或操作步骤可能已经变化，请在参考或操作前确认其是否仍然适用。</p>
                            </aside>
                        <?php endif; ?>
                    <?php endif; ?>

                    <div class="articleBody" class="full">
                        <?php $this->content(); ?>
                    </div>
                    
                    <?php $tags = Contents::getTags($this->cid); if (count($tags) > 0) { 
                        echo '<section class="tags">';
                        foreach ($tags as $tag) {
                            echo '<a href="' . Utils::escapeHtml($tag['permalink'])
                                . '" rel="tag" class="tag-item">'
                                . Utils::escapeHtml(Utils::decodeHtmlText($tag['name'])) . '</a>';
                        }
                        echo '</section>';
                    } ?>

                    <div class="social-button" 
                        data-url="<?php echo Utils::escapeHtml($socialUrl); ?>"
                        data-title="<?php echo Utils::escapeHtml($socialTitle); ?>"
                        data-excerpt="<?php echo Utils::escapeHtml($socialExcerpt); ?>"
                        data-img="<?php echo Utils::escapeHtml($socialImage); ?>"
                        data-twitter="<?php echo Utils::escapeHtml($socialTwitter); ?>"
                        data-weibo="<?php echo Utils::escapeHtml($socialWeibo); ?>"
                        <?php if($socialImage !== '') echo 'data-image="' . Utils::escapeHtml($socialImage) . '"'; ?>>
                        <?php if(null !== $rewardUrl):?>
                            <a
                                class="btn btn-normal btn-highlight"
                                data-void-reward-link
                                no-pjax
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="查看赞赏二维码"
                                href="<?php echo $rewardUrlHtml; ?>"
                            >赏杯咖啡</a>
                            <dialog class="void-reward-dialog" data-void-reward-dialog aria-label="赞赏二维码">
                                <div class="void-reward-dialog__content">
                                    <button
                                        class="void-reward-dialog__image-button"
                                        data-void-reward-close
                                        type="button"
                                        aria-label="关闭赞赏二维码"
                                    >
                                        <img src="<?php echo $rewardUrlHtml; ?>" alt="" decoding="async">
                                    </button>
                                </div>
                            </dialog>
                        <?php endif; ?>
                        <?php if($setting['VOIDPlugin']):?>
                            <a role=button 
                                aria-label="为文章点赞" 
                                id="social" 
                                href="javascript:void(0);" onclick="VOID_Vote.vote(this);" 
                                data-item-id="<?php echo (int) $this->cid;?>"
                                data-type="up"
                                data-table="content"
                                class="btn btn-normal post-like vote-button"
                            >ENJOY <span class="value"><?php echo (int) $this->likes; ?></span>
                            </a>
                        <?php endif; ?>
                        
                        <a aria-label="分享到微博" href="javascript:void(0);" onclick="Share.toWeibo(this);" class="social-button-icon"><i class="voidicon-weibo"></i></a>
                        <a aria-label="分享到Twitter" href="javascript:void(0);" onclick="Share.toTwitter(this);" class="social-button-icon"><i class="voidicon-twitter"></i></a>
                    </div>
                </article>

                <script>
                (function () {
                    $.each($('iframe'), function(i, item){
                        var src = $(item).attr('src');
                        if (typeof src === 'string' && src.indexOf('player.bilibili.com') > -1) {
                            // $(item).addClass('bili-player');
                            // if (src.indexOf('&high_quality') < 0) {
                            //     src += '&high_quality=1'; // 启用高质量
                            //     $(item).attr('src', src);
                            // }
                            $(item).wrap('<div class="bili-player"></div>');
                        }
                    });
                })();
                </script>

                <!--分页-->
                <?php if(!$this->is('page')): ?>
                <div class="post-pager"><?php $prev = Contents::thePrev($this); ?>
                    <?php if($prev): ?>
                        <?php
                            $prevPermalink = Utils::decodeHtmlEntities(Utils::captureOutput($prev, 'permalink'));
                            $prevTitle = Utils::decodeHtmlText(Utils::captureOutput($prev, 'title'));
                        ?>
                        <div class="prev">
                            <a href="<?php echo Utils::escapeHtml($prevPermalink); ?>"><h2><?php echo Utils::escapeHtml($prevTitle); ?></h2></a>
                            <?php echo $prev->fields->excerpt != '' ? '<p>' . Utils::escapeHtml(Utils::decodeHtmlText($prev->fields->excerpt)) . '</p>' : ''; ?>
                        </div>
                    <?php else: ?>
                        <div class="prev">
                            <h2>没有了</h2>
                        </div>
                    <?php endif; ?>
                    <?php $next = Contents::theNext($this); ?>
                    <?php if($next): ?>
                        <?php
                            $nextPermalink = Utils::decodeHtmlEntities(Utils::captureOutput($next, 'permalink'));
                            $nextTitle = Utils::decodeHtmlText(Utils::captureOutput($next, 'title'));
                        ?>
                        <div class="next">
                            <a href="<?php echo Utils::escapeHtml($nextPermalink); ?>"><h2><?php echo Utils::escapeHtml($nextTitle); ?></h2></a>
                            <?php echo $next->fields->excerpt != '' ? '<p>' . Utils::escapeHtml(Utils::decodeHtmlText($next->fields->excerpt)) . '</p>' : ''; ?>
                        </div>
                    <?php else: ?>
                        <div class="next">
                            <h2>没有了</h2>
                        </div>
                    <?php endif; ?>
                </div>
                <?php endif; ?>
            </section>
        </div> <!--end .contents-wrap-->
        <!--目录，可选-->
        <?php if($this->fields->showTOC == '1'): ?>
            <div class="toc-mask" onclick="TOC.close();"></div>
            <div aria-label="文章目录" class="TOC"></div>
            <style>
            #toggle-toc { display: block; }
            </style>
        <?php endif;?>
    </div>
    <!--评论区，可选-->
    <?php $this->need('includes/comments.php'); ?>
</main>

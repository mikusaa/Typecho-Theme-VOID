<?php
/**
 * Gallery
 *
 * @package custom
 *
 * @author      mikusa
 * @version     2026-08-23 0.2
 */
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

if (!Utils::isPjax()) {
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

    <div class="void-gallery-page">
        <article class="void-gallery yue float-up" data-void-gallery>
            <?php $this->content(); ?>
        </article>
    </div>

    <?php $this->need('includes/comments.php'); ?>
</main>

<?php
if (!Utils::isPjax()) {
    $this->need('includes/footer.php');
}
?>

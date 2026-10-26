<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;

/**
 * VOID 评论组件
 *
 * 查询、嵌套、排序、分页与永久链接沿用 Typecho 1.3 核心评论归档组件；
 * 主题只负责评论节点渲染、父评论标签和 Ajax 评论使用的回复链接。
 */
class VOID_Widget_Comments_Archive extends \Widget\Comments\Archive
{
    /**
     * 本文评论作者名，按 coid 索引，用于父评论标签
     *
     * @var array
     */
    private $commentAuthors = array();

    /**
     * 将每行的值压入堆栈
     *
     * @param array $value 每行的值
     * @return array
     */
    public function push(array $value): array
    {
        // 超过最大嵌套层级时核心会把 parent 改挂到上上层，父评论标签仍指向实际回复的评论。
        $value['realParent'] = $value['parent'];
        $value = parent::push($value);
        $this->commentAuthors[$value['coid']] = $value['author'];

        return $value;
    }

    /**
     * 输出单条评论；由全局 threadedComments() 回调调用
     *
     * @param \Widget\Comments\Archive $comments
     * @param \Typecho\Config $singleCommentOptions
     * @return void
     */
    public static function renderComment($comments, $singleCommentOptions)
    {
        $setting = $GLOBALS['VOIDSetting'];

        $avatarClass = '';
        $commentClass = '';
        if ($comments->authorId) {
            if ($comments->authorId == $comments->ownerId) {
                $avatarClass .= ' star';
            }
        }

        $isFolded = false;
        if ($setting['VOIDPlugin']) {
            $metaArr = self::getLikesAndDislikes($comments);
            $isFolded = $metaArr['dislikes'] >= $setting['commentFoldThreshold'][0]
                && ($metaArr['dislikes'] >= $metaArr['likes']*$setting['commentFoldThreshold'][1]);
            if ($isFolded) {
                $commentClass .= ' fold';
            }
        }
        $parentLabel = $comments instanceof self ? $comments->getParentLabel() : '';
?>
<div id="<?php $comments->theId(); ?>"
    data-comment-parent="<?php echo (int)$comments->parent; ?>"
    data-comment-depth="<?php echo (int)$comments->levels; ?>"
    class="comment-body<?php
    if ($comments->levels > 0) {
        echo ' comment-child';
        $comments->levelsAlt(' comment-level-odd', ' comment-level-even');
    } else {
        echo ' comment-parent';
    }
    $comments->alt(' comment-odd', ' comment-even');
    echo $commentClass;
?>">
    <div class="comment-content-wrap">
        <div class="comment-meta">
            <div class="comment-author">
                <span class="comment-avatar<?php echo $avatarClass; ?>"><?php $comments->gravatar($singleCommentOptions->avatarSize, $singleCommentOptions->defaultAvatar); ?></span>
                <b><cite class="fn"><?php $singleCommentOptions->beforeAuthor();
                $comments->author();
                $singleCommentOptions->afterAuthor(); ?></cite></b><span><?php echo $parentLabel; ?></span>
            </div>
        </div>
        <div class="comment-content yue">
            <?php if ($isFolded) { ?>
                <span class="fold">[该评论已被自动折叠 | <a no-pjax target="_self" href="javascript:void(0)"
                onclick="VOID_Vote.toggleFoldComment(<?php echo $comments->coid; ?>, this)">点击展开</a>]</span>
            <?php }?>
            <div class="comment-content-inner"><?php echo Contents::parseBiaoQing($comments->content); ?></div>
        </div>
        <div class="comment-actions">
            <a href="<?php $comments->permalink(); ?>"><time datetime="<?php $comments->date('c'); ?>"><?php $singleCommentOptions->beforeDate();
            echo date('Y-m-d H:i', $comments->created);
            $singleCommentOptions->afterDate(); ?></time></a>
            <?php if ('waiting' == $comments->status) { ?>
            <em class="comment-awaiting-moderation"><?php $singleCommentOptions->commentStatus(); ?></em>
            <?php } ?>
            <?php if ($setting['VOIDPlugin']) { ?>
            <a no-pjax target="_self" class="comment-vote vote-button"
                href="javascript:void(0)"
                onclick="VOID_Vote.vote(this)"
                data-item-id="<?php echo $comments->coid;?>"
                data-type="up"
                data-table="comment"
            ><i class="voidicon-thumbs-up"></i> <span class="value"><?php echo $metaArr['likes']?></span>
            </a>
            <a no-pjax target="_self" class="comment-vote vote-button"
                href="javascript:void(0)"
                onclick="VOID_Vote.vote(this)"
                data-item-id="<?php echo $comments->coid;?>"
                data-type="down"
                data-table="comment"
            ><i class="voidicon-thumbs-down"></i> <span class="value"><?php echo $metaArr['dislikes']?></span>
            </a>
            <?php } ?>
            <span class="comment-reply">
                <?php $comments->reply($singleCommentOptions->replyWord); ?>
            </span>
        </div>
    </div>
    <?php if ($comments->children) { ?>
    <div class="comment-children">
        <?php $comments->threadedComments(); ?>
    </div>
    <?php } ?>
</div>
<?php
    }

    /**
     * 第二层及更深的回复显示被回复者；更浅的层级从缩进即可看出
     *
     * @return string
     */
    private function getParentLabel()
    {
        if ($this->levels <= 1) {
            return '';
        }

        // levels 大于 0 说明父评论在本次查询结果中，作者名已由 push() 记录。
        $parentId = (int) $this->realParent;
        $author = isset($this->commentAuthors[$parentId]) ? trim((string) $this->commentAuthors[$parentId]) : '';
        if ($author === '') {
            $author = '已删除的评论';
        }

        $safeAuthor = htmlspecialchars($author, ENT_QUOTES, 'UTF-8');
        return ' <span class="comment-parent-label">回复</span> <b class="comment-parent-author">@' . $safeAuthor . '</b> ';
    }

    /**
     * 获取评论赞踩
     *
     * @param \Widget\Comments\Archive $comments
     * @return array
     */
    private static function getLikesAndDislikes($comments)
    {
        // 评论列表按整行查询，VOID 插件的赞踩列已在当前行中，无需逐条再查。
        return array(
            'likes' => (int) $comments->likes,
            'dislikes' => (int) $comments->dislikes
        );
    }

    /**
     * 评论回复链接
     *
     * @param string $word 回复链接文字
     * @return void
     */
    public function reply(string $word = '')
    {
        if ($this->options->commentsThreaded && !$this->isTopLevel && $this->parameter->allowComment) {
            $word = empty($word) ? '回复' : $word;
            $cancelWord = '取消回复';
            self::pluginHandle()->trigger($plugged)->call('reply', $word, $this);

            if (!$plugged) {
                echo '<a no-pjax href="' . substr($this->permalink, 0, - strlen($this->theId) - 1) . '?replyTo=' . $this->coid .
                    '#' . $this->parameter->respondId . '" rel="nofollow" data-comment-id="' . $this->theId .
                    '" data-comment-coid="' . $this->coid .
                    '" data-reply-word="' . htmlspecialchars((string)$word, ENT_QUOTES, 'UTF-8') .
                    '" data-cancel-word="' . htmlspecialchars($cancelWord, ENT_QUOTES, 'UTF-8') .
                    '" data-reply-state="idle" aria-pressed="false" onclick="return AjaxComment.handleReplyClick(\'' .
                    $this->theId . '\', ' . $this->coid . ', this);">' . $word . '</a>';
            }
        }
    }

    /**
     * 取消评论回复链接
     *
     * @param string $word 取消回复链接文字
     * @return void
     */
    public function cancelReply(string $word = '')
    {
        if ($this->options->commentsThreaded) {
            $word = empty($word) ? '取消回复' : $word;
            self::pluginHandle()->trigger($plugged)->call('cancelReply', $word, $this);

            if (!$plugged) {
                $replyId = $this->request->filter('int')->get('replyTo');
                echo '<a id="cancel-comment-reply-link" href="' . $this->parentContent->permalink . '#' . $this->parameter->respondId .
                '" rel="nofollow"' . ($replyId ? '' : ' style="display:none"') . ' onclick="return AjaxComment.cancelActiveReply();">' . $word . '</a>';
            }
        }
    }
}

if (!function_exists('threadedComments')) {
    /**
     * Typecho 1.3 评论组件渲染每条评论时调用的主题回调
     *
     * @param \Widget\Comments\Archive $comments
     * @param \Typecho\Config $singleCommentOptions
     * @return void
     */
    function threadedComments($comments, $singleCommentOptions)
    {
        VOID_Widget_Comments_Archive::renderComment($comments, $singleCommentOptions);
    }
}

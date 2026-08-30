<?php
/**
 * comments.php
 * 
 * 评论区
 * 
 * @author      熊猫小A
 * @version     2019-01-15 0.1
 */
if (!defined('__TYPECHO_ROOT_DIR__')) exit;
$setting = $GLOBALS['VOIDSetting'];
// 兼容 Typecho 1.3：优先新键 commentsRequireUrl，旧键 commentsRequireURL 兜底
$commentsRequireUrl = Helper::options()->commentsRequireUrl;
if ($commentsRequireUrl === null) {
    $commentsRequireUrl = Helper::options()->commentsRequireURL;
}
$commentsRequireUrl = !empty($commentsRequireUrl);
$commentsOrder = strtoupper((string)Helper::options()->commentsOrder) === 'ASC' ? 'ASC' : 'DESC';
$commentSecurityTokenExpression = null;
if (!empty(Helper::options()->commentsAntiSpam)) {
    Typecho_Widget::widget('Widget_Security')->to($commentSecurity);
    $commentSecurityTokenExpression = Typecho_Common::shuffleScriptVar(
        $commentSecurity->getToken($this->request->getRequestUrl())
    );
}
$parameter = array(
    'parentId'      => $this->hidden ? 0 : $this->cid,
    // 对齐 Typecho 1.3：传递当前 Archive Widget，保证 path/permalink 等字段可用
    'parentContent' => $this,
    'respondId'     => $this->respondId,
    // 兼容 Typecho 1.3 CommentPage 路由：从 Archive 参数读取当前评论页码
    'commentPage'   => (int)$this->parameter->commentPage,
    'allowComment'  => $this->allow('comment')
);
$this->widget('VOID_Widget_Comments_Archive', $parameter)->to($comments);
?>

<div class="comments-container">
    <section id="comments" class="container float-up" data-comments-order="<?php echo $commentsOrder; ?>">
        <!--评论框-->
        <?php if($this->allow('comment')): ?>
            <div id="<?php $this->respondId(); ?>" class="respond">
                <div class="cancel-comment-reply" role=button>
                    <?php $comments->cancelReply(); ?>
                </div>
                <h3 id="response" class="widget-title text-left">添加新评论</h3>
                <?php if(!empty($setting['commentNotification'])): ?>
                    <p class="comment-notification notice"><?php echo Utils::formatCommentNotification($setting['commentNotification']); ?></p>
                <?php endif; ?>
                <?php $commentUrl = Utils::decodeHtmlEntities(Utils::captureOutput($this, 'commentUrl')); ?>
                <form method="post" action="<?php echo Utils::escapeHtml($commentUrl); ?>" id="comment-form">
                    <?php if($this->user->hasLogin()): ?>
                    <?php
                        $userName = Utils::decodeHtmlText(Utils::captureOutput($this->user, 'screenName'));
                        $userUrl = Utils::decodeHtmlEntities(Utils::captureOutput($this->user, 'url'));
                        $userMail = Utils::decodeHtmlText(Utils::captureOutput($this->user, 'mail'));
                        $profileUrl = Utils::decodeHtmlEntities(Utils::captureOutput($this->options, 'profileUrl'));
                        $logoutUrl = Utils::decodeHtmlEntities(Utils::captureOutput($this->options, 'logoutUrl'));
                    ?>
                    <p id="logged-in"
                        data-name="<?php echo Utils::escapeHtml($userName); ?>"
                        data-url="<?php echo Utils::escapeHtml($userUrl); ?>"
                        data-email="<?php echo Utils::escapeHtml($userMail); ?>" ><?php _e('登录身份: '); ?>
                        <a href="<?php echo Utils::escapeHtml($profileUrl); ?>"><?php echo Utils::escapeHtml($userName); ?></a>
                        . <a no-pjax href="<?php echo Utils::escapeHtml($logoutUrl); ?>" title="Logout"><?php _e('退出'); ?> &raquo;</a>
                    </p>
                    <?php else: ?>
                        <div class="comment-info-input">
                        <input aria-label="称呼(必填)" type="text" name="author" id="author" required placeholder="称呼(必填)" value="<?php $this->remember('author'); ?>" />
                        <input aria-label="电子邮件<?php echo Helper::options()->commentsRequireMail? '(必填，将保密)' : '(选填)' ?>" 
                            type="email" name="mail" id="mail" 
                            placeholder="电子邮件<?php echo Helper::options()->commentsRequireMail? '(必填，将保密)' : '(选填)' ?>" 
                            <?php echo Helper::options()->commentsRequireMail? 'required' : '' ?>
                            value="<?php $this->remember('mail'); ?>" />
                        <input aria-label="网站<?php echo $commentsRequireUrl ? '(必填)' : '(选填)' ?>" type="url" name="url" id="url" 
                            <?php echo $commentsRequireUrl ? 'required' : '' ?>
                            placeholder="网站<?php echo $commentsRequireUrl ? '(必填)' : '(选填)' ?>"  
                            value="<?php $this->remember('url'); ?>" />
                        </div>
                    <?php endif; ?>
                    <p class="comment-textarea-wrap">
                        <textarea aria-label="评论输入框" class="input-area" rows="5" name="text" id="textarea" 
                            placeholder="在这里输入你的评论..." 
                            style="resize:none;"><?php $this->remember('text'); ?></textarea>
                    </p>
                    <div id="void-comment-emotes" class="comment-emotes" data-trigger="void-comment-emotes-trigger"></div>
                    <p class="comment-buttons">
                        <button id="void-comment-emotes-trigger" class="void-emotes-trigger" type="button" aria-label="打开表情选择器" title="表情">
                            <!-- BDC/emoji_circle_line/1 -->
                            <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6.14978 9.5497C5.911519999999999 9.618533333333332 5.77148 9.876833333333334 5.8369800000000005 10.126666666666665C6.010859999999999 10.792133333333332 6.458333333333333 11.221066666666667 6.9891000000000005 11.3022C7.358466666666666 11.371699999999999 7.7259 11.253699999999998 8 10.9912C8.2289 11.203199999999999 8.517266666666666 11.320733333333333 8.822433333333333 11.322099999999999C9.428333333333333 11.324366666666666 9.968266666666667 10.8752 10.163466666666666 10.126666666666665C10.228933333333334 9.876833333333334 10.088899999999999 9.6185 9.850633333333333 9.549733333333332C9.612366666666667 9.480899999999998 9.3661 9.627666666666666 9.300633333333334 9.8775C9.194333333333333 10.287166666666666 8.959666666666667 10.39 8.8136 10.385066666666667C8.6771 10.381133333333333 8.507366666666666 10.289066666666667 8.426033333333333 10.021666666666667C8.366433333333333 9.828 8.1944 9.696733333333333 8.0002 9.696766666666665C7.805999999999999 9.696766666666665 7.634 9.828 7.574399999999999 10.0217C7.479933333333333 10.332566666666665 7.2652 10.411999999999999 7.106766666666666 10.376533333333333C6.978133333333333 10.348466666666666 6.791413333333333 10.229966666666666 6.699806666666666 9.877466666666667C6.640386666666666 9.650866666666667 6.432313333333333 9.5091 6.2164399999999995 9.536166666666666L6.14978 9.5497z" fill="currentColor"></path>
                                <path d="M4.17582 6.281926666666667C4.34018 6.060033333333333 4.653313333333333 6.013393333333333 4.875206666666666 6.177766666666667L6.575206666666666 7.437033333333333C6.709806666666666 7.536733333333332 6.7855 7.697166666666666 6.776933333333333 7.8644333333333325C6.768366666666666 8.031699999999999 6.676566666666666 8.183566666666667 6.5325 8.268966666666667L4.8325 9.276333333333334C4.5949333333333335 9.417133333333333 4.288226666666667 9.3387 4.147446666666666 9.101099999999999C4.0066733333333335 8.863533333333333 4.085133333333333 8.556833333333333 4.3226933333333335 8.416066666666667L5.37502 7.792466666666667L4.27998 6.981299999999999C4.058086666666666 6.81696 4.011446666666666 6.503826666666666 4.17582 6.281926666666667z" fill="currentColor"></path>
                                <path d="M11.8223 6.281926666666667C11.657933333333332 6.060033333333333 11.3448 6.013393333333333 11.122899999999998 6.177766666666667L9.422899999999998 7.437033333333333C9.288333333333332 7.536733333333332 9.212599999999998 7.697166666666666 9.221166666666665 7.8644333333333325C9.229766666666666 8.031699999999999 9.321533333333333 8.183566666666667 9.465633333333333 8.268966666666667L11.165633333333332 9.276333333333334C11.403166666666666 9.417133333333333 11.7099 9.3387 11.850666666666665 9.101099999999999C11.991433333333333 8.863533333333333 11.912966666666666 8.556833333333334 11.675433333333332 8.416066666666667L10.623099999999999 7.792466666666667L11.718133333333334 6.981299999999999C11.940033333333332 6.81696 11.986666666666666 6.503826666666666 11.8223 6.281926666666667z" fill="currentColor"></path>
                                <path d="M8.000233333333332 2.333333333333333C4.870613333333333 2.333333333333333 2.33356 4.870386666666667 2.33356 8C2.33356 11.129633333333333 4.870613333333333 13.666666666666666 8.000233333333332 13.666666666666666C11.129833333333332 13.666666666666666 13.6669 11.129633333333333 13.6669 8C13.6669 4.870386666666667 11.129833333333332 2.333333333333333 8.000233333333332 2.333333333333333zM1.3335533333333331 8C1.3335533333333331 4.318099999999999 4.318326666666667 1.3333333333333333 8.000233333333332 1.3333333333333333C11.6821 1.3333333333333333 14.6669 4.318099999999999 14.6669 8C14.6669 11.681866666666666 11.6821 14.666666666666666 8.000233333333332 14.666666666666666C4.318326666666667 14.666666666666666 1.3335533333333331 11.681866666666666 1.3335533333333331 8z" fill="currentColor"></path>
                            </svg>
                        </button>
                        <?php if(Utils::isPluginAvailable('CommentToMail') || Utils::isPluginAvailable('Mailer')): ?>
                        <span class="comment-mail-me">
                            <input aria-label="有回复时通知我" name="receiveMail" type="checkbox" value="yes" id="receiveMail" checked />
                            <label for="receiveMail">有回复时通知我</label>
                        </span>
                        <?php endif; ?>
                        <button id="comment-submit-button" type="submit" class="submit btn btn-normal">提交评论</button>
                    </p>
                </form>
                <?php if ($commentSecurityTokenExpression !== null): ?>
                <script>
                (function() {
                    if (document.readyState === 'loading'
                        || typeof AjaxComment === 'undefined'
                        || typeof AjaxComment.installAntiSpamToken !== 'function') {
                        return;
                    }
                    var token = <?php echo $commentSecurityTokenExpression; ?>
                    AjaxComment.installAntiSpamToken(
                        document.getElementById('comment-form'),
                        token
                    );
                })();
                </script>
                <?php endif; ?>
            </div>
        <?php endif; ?>
        
        <!--历史评论-->
        <h3 class="comment-separator">
            <div class="comment-tab-current">
                <?php if($this->allow('comment')): ?>
                    <span class="comment-num">
                        <?php $this->commentsNum('评论列表', '已有 1 条评论', '已有 <span class="num">%d</span> 条评论'); ?>
                    </span>
                <?php else :?>
                    <span class="comment-num">此处评论已关闭</span>
                <?php endif;?>
            </div>
        </h3>
        <?php if ($comments->have()): ?>
            <?php $comments->listComments(array(
            'before'        =>  '<div class="comment-list">',
            'after'         =>  '</div>',
            'avatarSize'    =>  64,
            'dateFormat'    =>  'Y-m-d H:i'
            )); ?>
            <?php $comments->pageNav('<span aria-label="评论上一页">←</span>', '<span aria-label="评论下一页">→</span>', 1, '...', 'wrapClass=pager&prevClass=prev&nextClass=next'); ?>
        <?php endif; ?>
    </section>
</div>

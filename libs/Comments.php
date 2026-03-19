<?php
if (!defined('__TYPECHO_ROOT_DIR__')) exit;
/**
 * 评论归档
 *
 * @category typecho
 * @package Widget
 * @copyright Copyright (c) 2008 Typecho team (http://www.typecho.org)
 * @license GNU General Public License 2.0
 * @version $Id$
 */

/**
 * 评论归档组件
 *
 * @category typecho
 * @package Widget
 * @copyright Copyright (c) 2008 Typecho team (http://www.typecho.org)
 * @license GNU General Public License 2.0
 */
class VOID_Widget_Comments_Archive extends Widget_Abstract_Comments
{
     /**
     * 当前页
     *
     * @access private
     * @var integer
     */
    private $_currentPage;

    /**
     * 所有文章个数
     *
     * @access private
     * @var integer
     */
    private $_total = false;

    /**
     * 子父级评论关系
     *
     * @access private
     * @var array
     */
    private $_threadedComments = array();

    /**
     * 多级评论回调函数
     * 
     * @access private
     * @var mixed
     */
    private $_customThreadedCommentsCallback = false;

    /**
     * _singleCommentOptions  
     * 
     * @var mixed
     * @access private
     */
    private $_singleCommentOptions = NULL;


    private $_commentAuthors = array();

    /**
     * 安全组件
     */
    private $_security = NULL;

    /**
     * 从 parentContent 读取字段（兼容 array / object）
     *
     * @access private
     * @param string $key
     * @param mixed $default
     * @return mixed
     */
    private function getParentContentField($key, $default = '')
    {
        $parentContent = $this->parameter->parentContent;
        if (is_array($parentContent)) {
            return isset($parentContent[$key]) ? $parentContent[$key] : $default;
        }
        if (is_object($parentContent)) {
            // 兼容 Typecho Widget 的 __get
            if (isset($parentContent->$key)) {
                return $parentContent->$key;
            }
            if (property_exists($parentContent, $key)) {
                return $parentContent->$key;
            }
            try {
                $value = $parentContent->$key;
                return ($value === NULL || $value === '') ? $default : $value;
            } catch (Exception $e) {
                return $default;
            } catch (Throwable $e) {
                return $default;
            }
        }
        return $default;
    }

    /**
     * 获取评论分页路由所需 permalink path（避免出现 /{permalink}/...）
     *
     * @access private
     * @return string
     */
    private function getParentPath()
    {
        $path = trim((string)$this->getParentContentField('path', ''));

        if ($path === '') {
            $path = trim((string)$this->getParentContentField('pathinfo', ''));
        }

        if ($path === '' || strpos($path, '{') !== false) {
            $permalink = trim((string)$this->getParentContentField('permalink', ''));
            if ($permalink !== '') {
                $parsedPath = parse_url($permalink, PHP_URL_PATH);
                if (is_string($parsedPath) && $parsedPath !== '') {
                    $path = $parsedPath;
                }
            }
        }

        $path = ltrim($path, '/');
        return $path;
    }

    /**
     * 构造函数,初始化组件
     *
     * @access public
     * @param mixed $request request对象
     * @param mixed $response response对象
     * @param mixed $params 参数列表
     * @return void
     */
    public function __construct($request, $response, $params = NULL)
    {
        parent::__construct($request, $response, $params);
        $this->parameter->setDefault('parentId=0&commentPage=0&commentsNum=0&allowComment=1');
        
        Typecho_Widget::widget('Widget_Security')->to($this->_security);

        /** 初始化回调函数 */
        if (function_exists('threadedComments')) {
            $this->_customThreadedCommentsCallback = true;
        }
    }

    /**
     * 评论回调函数
     * 
     * @access private
     * @return void
     */
    private function threadedCommentsCallback()
    {
        $singleCommentOptions = $this->_singleCommentOptions;
        if (function_exists('threadedComments')) {
            return threadedComments($this, $singleCommentOptions);
        }

        $setting = $GLOBALS['VOIDSetting'];
        
        $avatarClass = '';
        if ($this->authorId) {
            if ($this->authorId == $this->ownerId) {
                $avatarClass .= ' star';
            }
        }

        if ($setting['VOIDPlugin']) {
            $metaArr = $this->getLikesAndDislikes();
            if ($metaArr['dislikes'] >= $setting['commentFoldThreshold'][0]
            && ($metaArr['dislikes'] >= $metaArr['likes']*$setting['commentFoldThreshold'][1])) {
                $commentClass .= ' fold';
            }
        }
?>
<div id="<?php $this->theId(); ?>" class="comment-body<?php
    if ($this->levels > 0) {
        echo ' comment-child';
        $this->levelsAlt(' comment-level-odd', ' comment-level-even');
    } else {
        echo ' comment-parent';
    }
    $this->alt(' comment-odd', ' comment-even');
    echo $commentClass;
?>">
    <div class="comment-content-wrap">
        <div class="comment-meta">
            <div class="comment-author">
                <span class="comment-avatar<?php echo $avatarClass; ?>"><?php $this->gravatar($singleCommentOptions->avatarSize, $singleCommentOptions->defaultAvatar); ?></span>
                <b><cite class="fn"><?php $singleCommentOptions->beforeAuthor();
                $this->author();
                $singleCommentOptions->afterAuthor(); ?></cite></b><span><?php echo $this->getParent(); ?></span>
            </div>
        </div>
        <div class="comment-content yue">
            <?php if ($setting['VOIDPlugin'] && $metaArr['dislikes'] >= $setting['commentFoldThreshold'][0]
            && ($metaArr['dislikes'] >= $metaArr['likes']*$setting['commentFoldThreshold'][1])) { ?>
                <span class="fold">[该评论已被自动折叠 | <a no-pjax target="_self" href="javascript:void(0)" 
                onclick="VOID_Vote.toggleFoldComment(<?php echo $this->coid; ?>, this)">点击展开</a>]</span>
            <?php }?>
            <div class="comment-content-inner"><?php echo Contents::parseBiaoQing($this->content); ?></div>
        </div>
        <div class="comment-actions">
            <a href="<?php $this->permalink(); ?>"><timedatetime="<?php $this->date('c'); ?>"><?php $singleCommentOptions->beforeDate();
            echo date('Y-m-d H:i', $this->created);
            $singleCommentOptions->afterDate(); ?></time></a>
            <?php if ('waiting' == $this->status) { ?>
            <em class="comment-awaiting-moderation"><?php $singleCommentOptions->commentStatus(); ?></em>
            <?php } ?>
            <?php if ($setting['VOIDPlugin']) { ?>
            <a no-pjax target="_self" class="comment-vote vote-button" 
                href="javascript:void(0)" 
                onclick="VOID_Vote.vote(this)"
                data-item-id="<?php echo $this->coid;?>" 
                data-type="up"
                data-table="comment"
            ><i class="voidicon-thumbs-up"></i> <span class="value"><?php echo $metaArr['likes']?></span>
            </a>
            <a no-pjax target="_self" class="comment-vote vote-button" 
                href="javascript:void(0)" 
                onclick="VOID_Vote.vote(this)"
                data-item-id="<?php echo $this->coid;?>" 
                data-type="down"
                data-table="comment"
            ><i class="voidicon-thumbs-down"></i> <span class="value"><?php echo $metaArr['dislikes']?></span>
            </a>
            <?php } ?>
            <span class="comment-reply">
                <?php $this->reply($singleCommentOptions->replyWord); ?>
            </span>
        </div>
    </div>
    <?php if ($this->children) { ?>
    <div class="comment-children">
        <?php $this->threadedComments(); ?>
    </div>
    <?php } ?>
</div>
<?php
    }
  
    private function getParent(){
        if ($this->levels <= 1) {
            return '';
        }

        $parentId = 0;
        if (is_array($this->row) && isset($this->row['realParent'])) {
            $parentId = (int)$this->row['realParent'];
        } elseif (is_array($this->row) && isset($this->row['parent'])) {
            $parentId = (int)$this->row['parent'];
        }

        if ($parentId <= 0) {
            return '';
        }

        $author = '';
        if (isset($this->_commentAuthors[$parentId])) {
            $author = trim((string)$this->_commentAuthors[$parentId]);
        }

        if ($author === '') {
            $db = Typecho_Db::get();
            $parentRow = $db->fetchRow($db->select('author')->from('table.comments')->where('coid = ?', $parentId));
            if (is_array($parentRow) && !empty($parentRow['author'])) {
                $author = trim((string)$parentRow['author']);
            }
            $this->_commentAuthors[$parentId] = $author;
        }

        if ($author === '') {
            $author = '已删除的评论';
        }

        $safeAuthor = htmlspecialchars($author, ENT_QUOTES, 'UTF-8');
        return ' <span class="comment-parent-label">回复</span> <b class="comment-parent-author">@' . $safeAuthor . '</b> ';
    }

    /**
     * 获取评论赞踩
     */
    private function getLikesAndDislikes() {
        $db = Typecho_Db::get();
        $row = $db->fetchRow($db->select('likes, dislikes')
            ->from('table.comments')
            ->where('coid = ?', $this->coid));
        return array('likes' => $row['likes'], 'dislikes' => $row['dislikes']);
    }
    
    /**
     * 获取当前评论链接
     *
     * @access protected
     * @return string
     */
    protected function ___permalink() : string
    {

        if ($this->options->commentsPageBreak) {            
            $parentPath = $this->getParentPath();
            if (!empty($parentPath)) {
                $pageRow = array('permalink' => $parentPath, 'commentPage' => $this->_currentPage);
                return Typecho_Router::url('comment_page', $pageRow, $this->options->index) . '#' . $this->theId;
            }
        }

        return (string)$this->getParentContentField('permalink', '') . '#' . $this->theId;
    }

    /**
     * 子评论
     *
     * @access protected
     * @return array
     */
    protected function ___children(): array
    {
        return $this->options->commentsThreaded && !$this->isTopLevel && isset($this->_threadedComments[$this->coid]) 
            ? $this->_threadedComments[$this->coid] : array();
    }

    /**
     * 是否到达顶层
     *
     * @access protected
     * @return boolean
     */
    protected function ___isTopLevel(): bool
    {
        // 对齐 Typecho 1.3：顶层判定语义与核心一致
        return $this->levels > $this->options->commentsMaxNestingLevels - 2;
    }



    /**
     * 输出文章评论数
     *
     * @access public
     * @param string $string 评论数格式化数据
     * @return void
     */
    public function num()
    {
        $args = func_get_args();
        if (!$args) {
            $args[] = '%d';
        }

        $num = intval($this->_total);

        echo sprintf(isset($args[$num]) ? $args[$num] : array_pop($args), $num);
    }

    /**
     * 执行函数
     *
     * @access public
     * @return void
     */
    public function execute()
    {
        if (!$this->parameter->parentId) {
            return;
        }

        // 对齐 Typecho 1.3：仅显示已审核评论 + 当前访客自己的待审核评论
        $unapprovedCommentId = intval(Typecho_Cookie::get('__typecho_unapproved_comment', 0));
        $select = $this->select()->where('table.comments.cid = ?', $this->parameter->parentId)
            ->where(
                'table.comments.status = ? OR (table.comments.coid = ? AND table.comments.status <> ?)',
                'approved',
                $unapprovedCommentId,
                'approved'
            );

        $threadedSelect = NULL;
        
        if ($this->options->commentsShowCommentOnly) {
            $select->where('table.comments.type = ?', 'comment');
        }
        
        $select->order('table.comments.coid', 'ASC');
        $this->db->fetchAll($select, array($this, 'push'));
        
        /** 需要输出的评论列表 */
        $outputComments = array();
        
        /** 如果开启评论回复 */
        if ($this->options->commentsThreaded) {
        
            foreach ($this->stack as $coid => &$comment) {
                
                /** 取出父节点 */
                $parent = $comment['parent'];
            
                /** 如果存在父节点 */
                if (0 != $parent && isset($this->stack[$parent])) {
                
                    /** 如果当前节点深度大于最大深度, 则将其挂接在父节点上 */
                    // 对齐 Typecho 1.3：遵循 commentsMaxNestingLevels 配置，不再硬编码层级
                    if ($comment['levels'] >= (int)$this->options->commentsMaxNestingLevels) {
                        $comment['levels'] = $this->stack[$parent]['levels'];
                        $parent = $this->stack[$parent]['parent'];     // 上上层节点
                        $comment['parent'] = $parent;
                    }
                
                    /** 计算子节点顺序 */
                    $comment['order'] = isset($this->_threadedComments[$parent]) 
                        ? count($this->_threadedComments[$parent]) + 1 : 1;
                
                    /** 如果是子节点 */
                    $this->_threadedComments[$parent][$coid] = $comment;
                } else {
                    $outputComments[$coid] = $comment;
                }
                
            }
        
            $this->stack = $outputComments;
        }
        
        /** 评论排序 */
        if ('DESC' == $this->options->commentsOrder) {
            $this->stack = array_reverse($this->stack, true);
        }
        
        /** 评论总数 */
        $this->_total = count($this->stack);
        
        /** 对评论进行分页 */
        if ($this->options->commentsPageBreak) {
            if ('last' == $this->options->commentsPageDisplay && !$this->parameter->commentPage) {
                $this->_currentPage = ceil($this->_total / $this->options->commentsPageSize);
            } else {
                $this->_currentPage = $this->parameter->commentPage ? $this->parameter->commentPage : 1;
            }
            
            /** 截取评论 */
            $this->stack = array_slice($this->stack,
                ($this->_currentPage - 1) * $this->options->commentsPageSize, $this->options->commentsPageSize);
        }
        
        /** 评论置位 */
        $this->length = count($this->stack);
        $this->row = $this->length > 0 ? current($this->stack) : array();
        
        reset($this->stack);
    }

    /**
     * 将每行的值压入堆栈
     *
     * @access public
     * @param array $value 每行的值
     * @return array
     */
    public function push(array $value) : array
    {
        $value = $this->filter($value);
        
        /** 计算深度 */
        if (0 != $value['parent'] && isset($this->stack[$value['parent']]['levels'])) {
            $value['levels'] = $this->stack[$value['parent']]['levels'] + 1;
        } else {
            $value['levels'] = 0;
        }

        $value['realParent'] = $value['parent'];

        /** 重载push函数,使用coid作为数组键值,便于索引 */
        $this->stack[$value['coid']] = $value;
        $this->_commentAuthors[$value['coid']] = $value['author'];
        $this->length ++;
        
        return $value;
    }

    /**
     * 输出分页
     *
     * @access public
     * @param string $prev 上一页文字
     * @param string $next 下一页文字
     * @param int $splitPage 分割范围
     * @param string $splitWord 分割字符
     * @param string $template 展现配置信息
     * @return void
     */
    public function pageNav($prev = '&laquo;', $next = '&raquo;', $splitPage = 3, $splitWord = '...', $template = '')
    {
        if ($this->options->commentsPageBreak && $this->_total > $this->options->commentsPageSize) {
            $default = array(
                'wrapTag'       =>  'ol',
                'wrapClass'     =>  'page-navigator'
            );

            if (is_string($template)) {
                parse_str($template, $config);
            } else {
                $config = $template;
            }

            $template = array_merge($default, $config);
            $parentPath = $this->getParentPath();
            if (empty($parentPath)) {
                return;
            }
            $query = Typecho_Router::url('comment_page', array(
                'permalink' => $parentPath,
                'commentPage' => '{commentPage}'
            ), $this->options->index);

            /** 使用盒状分页 */
            $nav = new Typecho_Widget_Helper_PageNavigator_Box($this->_total,
                $this->_currentPage, $this->options->commentsPageSize, $query);
            $nav->setPageHolder('commentPage');
            $nav->setAnchor('comments');
            
            echo '<' . $template['wrapTag'] . (empty($template['wrapClass']) 
                    ? '' : ' class="' . $template['wrapClass'] . '"') . '>';
            $nav->render($prev, $next, $splitPage, $splitWord, $template);
            echo '</' . $template['wrapTag'] . '>';
        }
    }

    /**
     * 递归输出评论
     *
     * @access protected
     * @return void
     */
    public function threadedComments()
    {
        $children = $this->children;
        if ($children) {
            //缓存变量便于还原
            $tmp = $this->row;
            $this->sequence ++;

            //在子评论之前输出
            echo $this->_singleCommentOptions->before;

            foreach ($children as $child) {
                $this->row = $child;
                $this->threadedCommentsCallback();
                $this->row = $tmp;
            }

            //在子评论之后输出
            echo $this->_singleCommentOptions->after;

            $this->sequence --;
        }
    }
    
    /**
     * 列出评论
     * 
     * @access private
     * @param mixed $singleCommentOptions 单个评论自定义选项
     * @return void
     */
    public function listComments($singleCommentOptions = NULL)
    {
        //初始化一些变量
        $this->_singleCommentOptions = Typecho_Config::factory($singleCommentOptions);
        $this->_singleCommentOptions->setDefault(array(
            'before'        =>  '<ol class="comment-list">',
            'after'         =>  '</ol>',
            'beforeAuthor'  =>  '',
            'afterAuthor'   =>  '',
            'beforeDate'    =>  '',
            'afterDate'     =>  '',
            'dateFormat'    =>  $this->options->commentDateFormat,
            'replyWord'     =>  '回复',
            'commentStatus' =>  '评论正等待审核!',
            'avatarSize'    =>  32,
            'defaultAvatar' =>  NULL
        ));
        $this->pluginHandle()->trigger($plugged)->listComments($this->_singleCommentOptions, $this);

        if (!$plugged) {
            if ($this->have()) { 
                echo $this->_singleCommentOptions->before;
            
                while ($this->next()) {
                    $this->threadedCommentsCallback();
                }
            
                echo $this->_singleCommentOptions->after;
            }
        }
    }
    
    /**
     * 重载alt函数,以适应多级评论
     * 
     * @access public
     * @return void
     */
    public function alt(...$args)
    {
        $args = func_get_args();
        $num = func_num_args();
        
        $sequence = $this->levels <= 0 ? $this->sequence : $this->order;
        
        $split = $sequence % $num;
        echo $args[(0 == $split ? $num : $split) -1];
    }

    /**
     * 根据深度余数输出
     *
     * @access public
     * @param string $param 需要输出的值
     * @return void
     */
    public function levelsAlt()
    {
        $args = func_get_args();
        $num = func_num_args();
        $split = $this->levels % $num;
        echo $args[(0 == $split ? $num : $split) -1];
    }
    
    /**
     * 评论回复链接
     * 
     * @access public
     * @param string $word 回复链接文字
     * @return void
     */
    public function reply($word = '')
    {
        // 对齐 Typecho 1.3：达到顶层时不再显示回复入口
        if ($this->options->commentsThreaded && !$this->isTopLevel && $this->parameter->allowComment) {
            $word = empty($word) ? '回复' : $word;
            $cancelWord = '取消回复';
            $this->pluginHandle()->trigger($plugged)->reply($word, $this);
            
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
     * @access public
     * @param string $word 取消回复链接文字
     * @return void
     */
    public function cancelReply($word = '')
    {
        if ($this->options->commentsThreaded) {
            $word = empty($word) ? '取消回复' : $word;
            $this->pluginHandle()->trigger($plugged)->cancelReply($word, $this);
            
            if (!$plugged) {
                // 兼容 Typecho 1.3：改为 get() 读取，避免使用已弃用的 request magic 属性
                $replyId = $this->request->filter('int')->get('replyTo');
                echo '<a id="cancel-comment-reply-link" href="' . (string)$this->getParentContentField('permalink', '') . '#' . $this->parameter->respondId .
                '" rel="nofollow"' . ($replyId ? '' : ' style="display:none"') . ' onclick="return AjaxComment.cancelActiveReply();">' . $word . '</a>';
            }
        }
    }
}

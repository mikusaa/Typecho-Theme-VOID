<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class VOID_Repository_ContentRepository
{
    public static function getPost($cid)
    {
        $db = Typecho_Db::get();
        $post = Widget_Abstract_Contents::alloc();
        $db->fetchRow(
            $post->select()->where('cid = ?', $cid)->limit(1),
            array($post, 'push')
        );
        return $post;
    }

    public static function getComment($coid)
    {
        $db = Typecho_Db::get();
        $comment = Widget_Abstract_Comments::alloc();
        $db->fetchRow(
            $comment->select()->where('coid = ?', $coid)->limit(1),
            array($comment, 'push')
        );
        return $comment;
    }

    public static function getMeta($mid)
    {
        $db = Typecho_Db::get();
        $meta = Widget_Abstract_Metas::alloc();
        $db->fetchRow(
            $meta->select()->where('mid = ?', $mid)->limit(1),
            array($meta, 'push')
        );
        return $meta;
    }

    public static function getRecentComments($num)
    {
        $output = array();
        $db = Typecho_Db::get();
        $rows = $db->fetchAll($db->select()->from('table.comments')
            ->where('table.comments.status = ?', 'approved')
            ->where('type = ?', 'comment')
            ->where('ownerId <> authorId')
            ->order('table.comments.created', Typecho_Db::SORT_DESC)
            ->limit($num));

        foreach ($rows as $row) {
            $comment = self::getComment($row['coid']);
            $output[] = array(
                'permalink' => $comment->permalink,
                'mail' => $row['mail'],
                'author' => $row['author'],
            );
        }

        return $output;
    }
}

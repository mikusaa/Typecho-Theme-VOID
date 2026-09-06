<?php
if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class VOID_Repository_ArchiveRepository
{
    public static function getPrevious($archive)
    {
        $db = Typecho_Db::get();
        $content = $db->fetchRow($db->select()->from('table.contents')
            ->where('table.contents.created < ?', $archive->created)
            ->where('table.contents.status = ?', 'publish')
            ->where('table.contents.type = ?', $archive->type)
            ->where('table.contents.password IS NULL')
            ->order('table.contents.created', Typecho_Db::SORT_DESC)
            ->limit(1));

        return $content
            ? VOID_Repository_ContentRepository::getPost($content['cid'])
            : null;
    }

    public static function getNext($archive)
    {
        $db = Typecho_Db::get();
        $currentTime = (class_exists('Typecho_Date') && method_exists('Typecho_Date', 'time'))
            ? Typecho_Date::time()
            : time();

        $content = $db->fetchRow($db->select()->from('table.contents')
            ->where(
                'table.contents.created > ? AND table.contents.created < ?',
                $archive->created,
                $currentTime
            )
            ->where('table.contents.status = ?', 'publish')
            ->where('table.contents.type = ?', $archive->type)
            ->where('table.contents.password IS NULL')
            ->order('table.contents.created', Typecho_Db::SORT_ASC)
            ->limit(1));

        return $content
            ? VOID_Repository_ContentRepository::getPost($content['cid'])
            : null;
    }

    public static function getArchives($widget, $excerpt, $settings)
    {
        $db = Typecho_Db::get();
        $currentTime = (int) Helper::options()->time;
        $rows = $db->fetchAll($db->select()
            ->from('table.contents')
            ->order('table.contents.created', Typecho_Db::SORT_DESC)
            ->order('table.contents.cid', Typecho_Db::SORT_DESC)
            ->where('table.contents.type = ?', 'post')
            ->where('table.contents.status = ?', 'publish')
            ->where('table.contents.created < ?', $currentTime));

        if (empty($rows)) {
            return array();
        }

        $supportsComputedCategoryCache = version_compare(Typecho_Common::VERSION, '1.3.0', '>=');
        $hasVOIDPlugin = !empty($settings['VOIDPlugin']);
        $categoriesByPostId = array();

        if ($supportsComputedCategoryCache) {
            $postIds = array();
            foreach ($rows as $row) {
                $postIds[(int) $row['cid']] = true;
            }

            $categoryRows = array();
            $categoriesByMid = array();
            $categoryWidget = Widget_Metas_Category_List::alloc();
            while ($categoryWidget->next()) {
                $category = array(
                    'mid' => (int) $categoryWidget->mid,
                    'name' => $categoryWidget->name,
                    'slug' => $categoryWidget->slug,
                    'description' => $categoryWidget->description,
                    'order' => (int) $categoryWidget->order,
                    'parent' => (int) $categoryWidget->parent,
                    'count' => (int) $categoryWidget->count,
                    'permalink' => $categoryWidget->permalink
                );
                $categoryRows[] = $category;
                $categoriesByMid[$category['mid']] = $category;
            }

            $relationshipRows = $db->fetchAll($db->select(
                'table.relationships.cid',
                'table.relationships.mid'
            )->from('table.relationships')
                ->where('table.relationships.cid IN ?', array_keys($postIds)));
            $relatedPostIdsByMid = array();
            foreach ($relationshipRows as $relationship) {
                $cid = (int) $relationship['cid'];
                $mid = (int) $relationship['mid'];
                if (isset($postIds[$cid]) && isset($categoriesByMid[$mid])) {
                    $relatedPostIdsByMid[$mid][] = $cid;
                }
            }

            foreach ($categoryRows as $category) {
                $mid = $category['mid'];
                if (empty($relatedPostIdsByMid[$mid])) {
                    continue;
                }

                foreach ($relatedPostIdsByMid[$mid] as $cid) {
                    $categoriesByPostId[$cid][] = $category;
                }
            }
        }

        $archives = array();
        foreach ($rows as $row) {
            $cid = (int) $row['cid'];
            $created = (int) $row['created'];
            $categories = isset($categoriesByPostId[$cid])
                ? $categoriesByPostId[$cid] : array();

            $post = Widget_Abstract_Contents::alloc();
            if ($supportsComputedCategoryCache) {
                $row['#categories'] = $categories;
            }
            $row = $post->push($row);
            if (!$supportsComputedCategoryCache) {
                $categories = isset($row['categories']) && is_array($row['categories'])
                    ? $row['categories'] : array();
            }
            $date = new Typecho_Date($created);
            $item = array(
                'cid' => $cid,
                'created' => $created,
                'dateLabel' => $date->format('m-d'),
                'title' => $post->title,
                'permalink' => $post->permalink,
                'categories' => $categories
            );

            if ($hasVOIDPlugin && array_key_exists('wordCount', $row)) {
                $item['words'] = (int) $row['wordCount'];
            }

            if ($excerpt) {
                $item['excerpt'] = substr($row['content'], 30);
            }
            $archives[$date->format('Y')][] = $item;
        }
        return $archives;
    }

    public static function getTags($cid)
    {
        $db = Typecho_Db::get();
        $rows = $db->fetchAll($db->select('mid')
            ->from('table.relationships')
            ->where('cid = ?', $cid));

        $metas = array();
        foreach ($rows as $row) {
            $meta = VOID_Repository_ContentRepository::getMeta($row['mid']);
            if ($meta->type == 'tag') {
                $metas[] = array(
                    'name' => $meta->name,
                    'permalink' => $meta->permalink
                );
            }
        }

        return $metas;
    }

    public static function getCategories($cid)
    {
        $rows = Widget_Metas_Category_Related::allocWithAlias($cid, array('cid' => $cid))
            ->toArray(array('name', 'permalink'));

        $metas = array();
        foreach ($rows as $row) {
            $metas[] = array(
                'name' => $row['name'],
                'permalink' => $row['permalink']
            );
        }
        return $metas;
    }
}

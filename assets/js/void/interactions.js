var VOID_Vote = {
    pendingItems: new WeakSet(),

    vote: function (item) {
        var type = item.getAttribute('data-type');
        var id = item.getAttribute('data-item-id');
        var table = item.getAttribute('data-table');

        var cookieName = 'void_vote_' + table + '_' + type;
        var voted = VOID_Util.getCookie(cookieName);
        if (voted == null) voted = ',';

        // 首先检查本地 cookie
        if (voted.indexOf(',' + id + ',') != -1) {
            item.classList.add('done');
            VOID.alert('您已经投过票了~');
            return;
        }

        // 当是评论投票时检查是否已经投过另一个选项
        if (item.classList.contains('comment-vote')) {
            var type_2 = type == 'up' ? 'down' : 'up';
            if (VOID_Vote.checkVoted(type_2, id, table)) {
                VOID.alert('暂不支持更改投票哦～');
                return;
            }
        }

        if (VOID_Vote.pendingItems.has(item)) {
            return;
        }
        VOID_Vote.pendingItems.add(item);

        return window.fetch(VOIDConfig.votePath + table, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                'id': parseInt(id),
                'type': type
            })
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('Vote request failed');
            }
            return response.json();
        }).then(function (data) {
            if (!data || typeof data.code !== 'number') {
                throw new Error('Invalid vote response');
            }
            if (data.code >= 200 && data.code < 400) {
                item.classList.add('done');
                voted += id + ',';
                VOID_Util.setCookie(cookieName, voted, 3600 * 24 * 90);
            }
            switch (data.code) {
                case 200:
                    var value = item.querySelector('.value');
                    if (value) {
                        value.textContent = parseInt(value.textContent) + 1;
                    }
                    break;
                case 302:
                    VOID.alert('您好像已经投过票了呢～');
                    break;
                case 403:
                    VOID.alert('暂不支持更改投票哦～');
                    break;
                default:
                    break;
            }
        }).catch(function () {
            VOID.alert('投票失败 o(╥﹏╥)o，请稍后重试');
        }).then(function () {
            VOID_Vote.pendingItems.delete(item);
        });
    },

    checkVoted: function (type, id, table) {
        var cookieName = 'void_vote_' + table + '_' + type;
        var voted = VOID_Util.getCookie(cookieName);
        if (voted == null) voted = ',';
        return voted.indexOf(',' + id + ',') != -1;
    },

    reload: function () {
        // 高亮已记录的
        var items = document.querySelectorAll('.vote-button');
        for (var index = 0; index < items.length; index++) {
            var item = items[index];
            var type = item.getAttribute('data-type');
            var id = item.getAttribute('data-item-id');
            var table = item.getAttribute('data-table');

            if (VOID_Vote.checkVoted(type, id, table)) {
                item.classList.add('done');
            }
        }
    },

    toggleFoldComment: function (coid, item) {
        var comment = document.getElementById('comment-' + String(coid));
        if (!comment) {
            return;
        }

        comment.classList.toggle('fold');
        if (comment.classList.contains('fold')) {
            item.textContent = '点击展开';
        } else {
            item.textContent = '还是叠上吧';
        }
    },
};

var Share = {
    parseItem: function (item) {
        item = item ? item.parentElement : null;
        return {
            url: item ? item.getAttribute('data-url') : null,
            title: item ? item.getAttribute('data-title') : null,
            excerpt: item ? item.getAttribute('data-excerpt') : null,
            img: item ? item.getAttribute('data-img') : null,
            twitter: item ? item.getAttribute('data-twitter') : null,
            weibo: item ? item.getAttribute('data-weibo') : null,
        };
    },

    toWeibo: function (item) {
        var content = Share.parseItem(item);
        var title = '分享《' + content.title + '》 @' + content.weibo + '\n\n' + content.excerpt;
        var url = new URL('http://service.weibo.com/share/share.php');
        url.searchParams.set('appkey', '');
        url.searchParams.set('title', title);
        url.searchParams.set('url', content.url);
        url.searchParams.set('pic', content.img);
        url.searchParams.set('searchPic', 'false');
        url.searchParams.set('style', 'simple');
        window.open(url.toString());
    },

    toTwitter: function (item) {
        var content = Share.parseItem(item);
        var text = '分享《' + content.title + '》 @' + content.twitter + '\n\n' + content.excerpt + ' ' + content.url;
        var url = new URL('https://twitter.com/intent/tweet');
        url.searchParams.set('text', text);
        window.open(url.toString());
    }
};

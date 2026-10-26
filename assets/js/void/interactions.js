var VOID_Vote = {
    // 每个按钮对应当前请求的标识，用于识别超时后迟到的旧响应。
    pendingItems: new WeakMap(),
    timeout: 10000,

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
        var request = {};
        var controller = typeof window.AbortController === 'function'
            ? new window.AbortController()
            : null;
        var options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                'id': parseInt(id),
                'type': type
            })
        };
        var isCurrent = function () {
            return VOID_Vote.pendingItems.get(item) === request;
        };
        // 按钮已被 PJAX 替换时不再提示；投票结果本身仍按响应写入 Cookie。
        var notify = function (message) {
            if (item.isConnected !== false) {
                VOID.alert(message);
            }
        };
        var timer;

        if (controller) options.signal = controller.signal;
        VOID_Vote.pendingItems.set(item, request);
        // 超时只解锁按钮：写请求结果未知，不自动重发，迟到的响应也不再改动计数或 Cookie。
        timer = window.setTimeout(function () {
            if (!isCurrent()) return;
            VOID_Vote.pendingItems.delete(item);
            if (controller) controller.abort();
            notify('投票等待超时，结果尚未确认，请刷新页面后再操作。');
        }, VOID_Vote.timeout);

        return window.fetch(VOIDConfig.votePath + table, options).then(function (response) {
            if (!response.ok) {
                throw new Error('Vote request failed');
            }
            return response.json();
        }).then(function (data) {
            if (!isCurrent()) return;
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
                    notify('您好像已经投过票了呢～');
                    break;
                case 403:
                    notify('暂不支持更改投票哦～');
                    break;
                default:
                    break;
            }
        }).catch(function () {
            if (isCurrent()) {
                notify('投票失败 o(╥﹏╥)o，请稍后重试');
            }
        }).then(function () {
            window.clearTimeout(timer);
            if (isCurrent()) {
                VOID_Vote.pendingItems.delete(item);
            }
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

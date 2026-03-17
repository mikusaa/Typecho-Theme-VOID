/* eslint-disable no-unused-vars */
/* eslint-disable linebreak-style */
/* eslint-disable no-undef */
/* eslint-disable no-console */
// VOID
// Author: 熊猫小A
// Link: https://blog.imalan.cn/archives/247/

console.log(' %c Theme VOID %c https://blog.imalan.cn/archives/247/ ', 'color: #fadfa3; background: #23b7e5; padding:5px;', 'background: #1c2b36; padding:5px;');

var VOID_Content = {
    littlefootInstance: null,
    littlefootTouchClickGuardBound: false,
    littlefootLastTouchAt: 0,

    countWords: function () {
        if ($('#totalWordCount').length) {
            var total = 0;
            $.each($('a.archive-title'), function (i, item) {
                total += parseInt($(item).attr('data-words'));
            });
            $('#totalWordCount').html(total);
        }
    },

    // 解析文章目录
    parseTOC: function () {
        if ($('.TOC').length > 0) {
            var toc_option = {
                // Where to render the table of contents.
                tocSelector: '.TOC',
                // Where to grab the headings to build the table of contents.
                contentSelector: 'div.articleBody',
                // Which headings to grab inside of the contentSelector element.
                headingSelector: 'h2, h3, h4, h5',
                // 收缩深度
                collapseDepth: 6
            };
            tocbot.init(toc_option);
            $.each($('.toc-link'), function (i, item) {
                $(item).click(function () {
                    VOID_Ui.scrollToWithHeader($(this).attr('href'));
                    if (window.innerWidth < 1200) {
                        TOC.close();
                    }
                    return false;
                });
            });
            // 检查目录
            if (window.innerWidth >= 1200) {
                TOC.open();
            }
        }
    },

    getFigureImage: function (item) {
        var $images = $(item).find('img').not('.blured-placeholder');
        if (!$images.length) {
            return null;
        }

        return $images.get($images.length - 1);
    },

    getFigureImageSrc: function (item) {
        var image = this.getFigureImage(item);
        if (!image) {
            return '';
        }

        var $image = $(image);
        return image.currentSrc || $image.attr('data-src') || $image.attr('src') || '';
    },

    applyFigureSize: function (item, width, height) {
        if (!(width > 0 && height > 0)) {
            return;
        }

        $(item).addClass('size-parsed');
        $(item).css('width', width + 'px');
        $(item).css('flex-grow', width * 50 / height);
        $(item).find('a[data-fancybox="gallery"]').css('padding-top', height / width * 100 + '%');
    },

    // 解析照片集
    parsePhotos: function () {
        $.each($('div.articleBody figure:not(.size-parsed)'), function (i, item) {
            var sourceImage = VOID_Content.getFigureImage(item);
            if (!sourceImage) {
                return;
            }

            if (sourceImage.complete && sourceImage.naturalWidth > 0 && sourceImage.naturalHeight > 0) {
                VOID_Content.applyFigureSize(item, parseFloat(sourceImage.naturalWidth), parseFloat(sourceImage.naturalHeight));
                return;
            }

            var src = VOID_Content.getFigureImageSrc(item);
            if (!src) {
                return;
            }

            var img = new Image();
            img.onload = function () {
                VOID_Content.applyFigureSize(item, parseFloat(img.width), parseFloat(img.height));
            };
            img.src = src;
        });
    },

    // 处理友链列表
    parseBoardThumbs: function () {
        $.each($('.board-thumb'), function (i, item) {
            if (VOIDConfig.lazyload) {
                if (VOIDConfig.browserLevelLoadingLazy) {
                    $(item).html('<img class="lazyload browserlevel-lazy" src="' + $(item).attr('data-thumb') + '" loading="lazy">');
                } else {
                    $(item).html('<img class="lazyload" data-src="' + $(item).attr('data-thumb') + '">');
                }
            } else {
                $(item).html('<img src="' + $(item).attr('data-thumb') + '">');
            }
        });
    },

    // 解析URL
    parseUrl: function () {
        var domain = document.domain;
        $('a:not(a[href^="#"]):not(".post-like")').each(function (i, item) {
            if ((!$(item).attr('target') || (!$(item).attr('target') == '' && !$(item).attr('target') == '_self'))) {
                if (item.hostname != domain) {
                    $(item).attr('target', '_blank');
                }
            }
        });

        if (VOIDConfig.PJAX) {
            $.each($('a:not(a[target="_blank"], a[no-pjax])'), function (i, item) {
                var $item = $(item);

                if (item.hostname == domain) {
                    if ($item.is('.comments-container .pager a')) {
                        $item.removeClass('pjax');
                        return;
                    }

                    $item.addClass('pjax');
                }
            });
            if (window.VoidPjax && typeof window.VoidPjax.bind === 'function') {
                window.VoidPjax.bind('a.pjax', {
                    container: '#pjax-container',
                    fragment: '#pjax-container',
                    timeout: 8000
                });
            }
        }
    },

    highlight: function () {
        $.each($('.yue pre code'), function (i, item) {
            var classStr = $(item).attr('class');

            if (typeof (classStr) == 'undefined') {
                classStr = 'language-none';
            }

            if (classStr.indexOf('lang') == -1) {
                classStr += ' language-none';
            }

            $(item).attr('class', classStr);
        });

        Prism.highlightAll();
    },

    restoreLittlefootReferenceIds: function () {
        $.each($('[data-lf-original-id]'), function (i, item) {
            var originalId = $(item).attr('data-lf-original-id');
            if (typeof originalId !== 'undefined' && originalId !== '') {
                $(item).attr('id', originalId);
            }
            $(item).removeAttr('data-lf-original-id');
        });
    },

    bridgeLittlefootBacklinks: function () {
        $.each($('.littlefoot__button[id^="lf-"]'), function (i, item) {
            var originalId = item.id.replace(/^lf-/, '');
            if (originalId === '') {
                return;
            }

            var printRef = document.getElementById(originalId);
            if (printRef && printRef.classList.contains('littlefoot--print')) {
                $(printRef).attr('data-lf-original-id', originalId);
                $(printRef).attr('id', 'lf-print-' + originalId);
            }

            $(item).attr('id', originalId);
        });
    },

    isPanguSpaceElement: function (node) {
        if (!node || node.nodeType !== 1 || !node.tagName) {
            return false;
        }

        if (node.tagName.toLowerCase() !== 'pangu') {
            return false;
        }

        return /^\s*$/.test(node.textContent || '');
    },

    cleanupPanguAroundNode: function (node) {
        if (!node || !node.parentNode) {
            return;
        }

        var previousNode = node.previousSibling;
        if (this.isPanguSpaceElement(previousNode)) {
            previousNode.parentNode.removeChild(previousNode);
        }

        var nextNode = node.nextSibling;
        if (this.isPanguSpaceElement(nextNode)) {
            nextNode.parentNode.removeChild(nextNode);
        }
    },

    cleanupLittlefootPanguSpacing: function () {
        var self = this;

        $.each($('.littlefoot'), function (i, item) {
            self.cleanupPanguAroundNode(item);
        });

        $.each($('sup.littlefoot--print, a.littlefoot--print'), function (i, item) {
            self.cleanupPanguAroundNode(item);
        });
    },

    setLittlefootActiveState: function (button, isActive) {
        if (!button || typeof button.closest !== 'function') {
            return;
        }

        var footnoteHost = button.closest('.littlefoot');
        if (!footnoteHost) {
            return;
        }

        if (isActive) {
            footnoteHost.classList.add('littlefoot--active');
        } else {
            footnoteHost.classList.remove('littlefoot--active');
        }
    },

    clearLittlefootActiveState: function () {
        $.each($('.littlefoot.littlefoot--active'), function (i, item) {
            item.classList.remove('littlefoot--active');
        });
    },

    prepareLittlefootMobileCompat: function () {
        if (typeof window.AbortController !== 'function') {
            window.AbortController = function () {
                this.signal = undefined;
                this.abort = function () {};
            };
        }

        if (this.littlefootTouchClickGuardBound || !('ontouchstart' in window)) {
            return;
        }

        this.littlefootTouchClickGuardBound = true;

        document.addEventListener('touchend', function (event) {
            var target = event.target;
            if (!target || typeof target.closest !== 'function') {
                return;
            }
            if (!target.closest('[data-footnote-button]')) {
                return;
            }
            VOID_Content.littlefootLastTouchAt = Date.now();
        }, true);

        document.addEventListener('click', function (event) {
            var target = event.target;
            if (!target || typeof target.closest !== 'function') {
                return;
            }
            if (!target.closest('[data-footnote-button]')) {
                return;
            }
            if (Date.now() - VOID_Content.littlefootLastTouchAt > 600) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }
        }, true);
    },

    bigfoot: function () {
        this.restoreLittlefootReferenceIds();
        this.clearLittlefootActiveState();

        if (this.littlefootInstance && typeof this.littlefootInstance.unmount === 'function') {
            this.littlefootInstance.unmount();
            this.littlefootInstance = null;
        }

        this.prepareLittlefootMobileCompat();

        if (typeof littlefoot === 'undefined' || typeof littlefoot.littlefoot !== 'function') {
            return;
        }

        this.littlefootInstance = littlefoot.littlefoot({
            allowDuplicates: true,
            activateCallback: function (popover, button) {
                VOID_Content.setLittlefootActiveState(button, true);
            },
            dismissCallback: function (popover, button) {
                VOID_Content.setLittlefootActiveState(button, false);
            }
        });

        this.bridgeLittlefootBacklinks();
        this.cleanupLittlefootPanguSpacing();
    },

    pangu: function () {
        if (typeof pangu === 'undefined' || typeof pangu.spacingNode !== 'function') {
            return;
        }

        var footnoteAnchorPattern = /(fn|footnote|note)[:\-_\d]/i;
        $.each($('a[href*="#"]'), function (index, item) {
            var hrefAttr = item.getAttribute('href') || '';
            var relAttr = item.getAttribute('rel') || '';
            if (!(hrefAttr + relAttr).match(footnoteAnchorPattern)) {
                return;
            }

            item.classList.add('no-pangu-spacing');
            if (typeof item.closest === 'function') {
                var supNode = item.closest('sup');
                if (supNode) {
                    supNode.classList.add('no-pangu-spacing');
                }
            }
        });

        $.each($('p'), function (index, item) {
            pangu.spacingNode(item);
        });
    },

    math: function () {
        if (!VOIDConfig.enableMath || typeof MathJax === 'undefined') {
            return;
        }

        var container = document.getElementById('pjax-container') || document.body;
        if (!MathJax.startup || !MathJax.startup.promise || typeof MathJax.typesetPromise !== 'function') {
            return;
        }

        MathJax.startup.promise = MathJax.startup.promise
            .then(function () {
                if (typeof MathJax.typesetClear === 'function') {
                    MathJax.typesetClear([container]);
                }
                return MathJax.typesetPromise([container]);
            })
            .catch(function (err) {
                console.error('MathJax typeset failed:', err);
            });
    },

    hyphenate: function () {
        $.each($('div.articleBody p, div.articleBody blockquote'), function (index, item) {
            var text = item.textContent || '';

            // 避免在 MathJax 解析前把 TeX 命令打断（如 \begin 被插入软连字符）
            if (/\\begin\{|\\\(|\\\[|(^|[^\\])\$\$|(^|[^\\])\$/.test(text)) {
                return;
            }

            $(item).hyphenate('en-us');
        });
    }
};

var VOID = {
    configureFancybox: function () {
        // fancybox 的 hash/history 会和 VoidPjax 的 popstate 处理冲突
        if (window.jQuery && window.jQuery.fancybox && window.jQuery.fancybox.defaults) {
            window.jQuery.fancybox.defaults.hash = false;
        }
    },

    // 初始化单页应用
    init: function () {
        VOID.configureFancybox();

        /* 初始化 UI */
        VOID_Ui.checkHeader();
        VOID_Ui.MasonryCtrler.init();
        VOID_Ui.DarkModeSwitcher.checkColorScheme();
        VOID_Ui.checkScrollTop();
        VOID_Content.parseBoardThumbs();
        VOID_Ui.lazyload();
        VOID_Ui.headroom();

        VOID_Content.countWords();
        VOID_Content.parseTOC();
        VOID_Content.parsePhotos();
        VOID_Content.highlight();
        VOID_Content.parseUrl();
        VOID_Content.pangu();
        VOID_Content.bigfoot();
        VOID_Content.math();
        VOID_Content.hyphenate();

        VOID_Vote.reload();
        VOID.initOwO();
        AjaxComment.init();

        $('body').on('click', function (e) {
            if (!VOID_Util.clickIn(e, '.mobile-search-form') && !VOID_Util.clickIn(e, '#toggle-mobile-search')) {
                if ($('.mobile-search-form').hasClass('opened')) {
                    $('.mobile-search-form').removeClass('opened');
                    return false;
                }
            }
            if (!VOID_Util.clickIn(e, '#toggle-setting-pc') && !VOID_Util.clickIn(e, '#toggle-setting')) {
                if ($('body').hasClass('setting-panel-show') && !VOID_Util.clickIn(e, '#setting-panel')) {
                    $('body').removeClass('setting-panel-show');
                    setTimeout(function () {
                        $('#setting-panel').hide();
                    }, 300);
                    return false;
                }
            }
        });
    },

    initOwO: function () {
        var container = document.getElementsByClassName('OwO')[0];
        var target = document.getElementsByClassName('input-area')[0];

        if (!container || !target || container.querySelector('.OwO-logo')) {
            return;
        }

        new OwO({
            logo: 'OωO',
            container: container,
            target: target,
            api: '/usr/themes/VOID/assets/libs/owo/OwO_01.json',
            position: 'down',
            width: '400px',
            maxHeight: '250px'
        });
    },

    isMainPjaxRequest: function (options) {
        return !options || options.container === '#pjax-container';
    },

    // PJAX 开始前
    beforePjax: function () {
        NProgress.start();
        VOID_Ui.reset();
    },

    // PJAX 结束后
    afterPjax: function () {
        VOID.configureFancybox();

        NProgress.done();
	
        VOID_Content.parseBoardThumbs();

        if ($('#loggin-form').length) {
            $('#loggin-form').addClass('need-refresh');
        }

        VOID_Ui.MasonryCtrler.init();
        VOID_Ui.lazyload();

        VOID_Ui.checkScrollTop();
        VOID_Content.countWords();
        VOID_Content.parseTOC();
        VOID_Content.parsePhotos();
        VOID_Content.parseUrl();
        VOID_Content.highlight();
        VOID_Content.math();
        VOID_Content.hyphenate();
        VOID_Content.pangu();
        VOID_Content.bigfoot();
        loadClipboard();

        VOID_Vote.reload();
        VOID.initOwO();
        AjaxComment.init();
    },

    endPjax: function () {
        if ($('.TOC').length < 1) {
            TOC.close();
        }
    },

    alert: function (content, time) {
        var errTemplate = '<div class="msg" id="msg{id}">{Text}</div>';
        var id = new Date().getTime();
        $('body').prepend(errTemplate.replace('{Text}', content).replace('{id}', id));
        $.each($('.msg'), function (i, item) {
            if ($(item).attr('id') != 'msg' + id) {
                $(item).css('top', $(item).offset().top - $(document).scrollTop() + $('.msg#msg' + id).outerHeight() + 20 + 'px');
            }
        });
        $('.msg#msg' + id).addClass('show');
        var t = time;
        if (typeof (t) != 'number') {
            t = 2500;
        }
        setTimeout(function () {
            $('.msg#msg' + id).addClass('hide');
            setTimeout(function () {
                $('.msg#msg' + id).remove();
            }, 1000);
        }, t);
    },

    startSearch: function (item) {
        var c = $(item).val();
        $(item).val('');
        $(item).blur();
        if (!c || c == '') {
            $(item).attr('placeholder', '你还没有输入任何信息');
            return;
        }
        var t = VOIDConfig.searchBase + c;
        if (VOIDConfig.PJAX && window.VoidPjax && typeof window.VoidPjax.visit === 'function') {
            window.VoidPjax.visit({
                url: t,
                container: '#pjax-container',
                fragment: '#pjax-container',
                timeout: 8000
            });
        } else {
            window.open(t, '_self');
        }
    },

    enterSearch: function (item) {
        var event = window.event || arguments.callee.caller.arguments[0];
        if (event.keyCode == 13) {
            VOID.startSearch(item);
        }
    }
};

var VOID_Vote = {
    vote: function (item) {
        var type = $(item).attr('data-type');
        var id = $(item).attr('data-item-id');
        var table = $(item).attr('data-table');

        var cookieName = 'void_vote_' + table + '_' + type;
        var voted = VOID_Util.getCookie(cookieName);
        if (voted == null) voted = ',';

        // 首先检查本地 cookie
        if (voted.indexOf(',' + id + ',') != -1) {
            $(item).addClass('done');
            VOID.alert('您已经投过票了~');
            return;
        }

        // 当是评论投票时检查是否已经投过另一个选项
        if ($(item).hasClass('comment-vote')) {
            var type_2 = '';
            if (type == 'up') type_2 = 'down';
            else type_2 = 'up';
            if (VOID_Vote.checkVoted(type_2, id, table)) {
                VOID.alert('暂不支持更改投票哦～');
                return;
            }
        }

        $.ajax({
            url: VOIDConfig.votePath + table,
            type: 'POST',
            data: JSON.stringify({
                'id': parseInt(id),
                'type': type
            }),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            success: function (data) {
                if (data.code >= 200 && data.code < 400) {
                    $(item).addClass('done');
                    voted += id + ',';
                    VOID_Util.setCookie(cookieName, voted, 3600 * 24 * 90);
                }
                switch (data.code) {
                    case 200:
                        var prev = parseInt($(item).find('.value').text());
                        $(item).find('.value').text(prev + 1);
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
            },
            error: function () {
                VOID.alert('投票失败 o(╥﹏╥)o，请稍后重试');
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
        $.each($('.vote-button'), function (i, item) {
            var type = $(item).attr('data-type');
            var id = $(item).attr('data-item-id');
            var table = $(item).attr('data-table');

            if (VOID_Vote.checkVoted(type, id, table)) {
                $(item).addClass('done');
            }
        });
    },

    toggleFoldComment: function (coid, item) {
        var sel = '#comment-' + String(coid);
        $(sel).toggleClass('fold');
        if ($(sel).hasClass('fold')) {
            $(item).text('点击展开');
        } else {
            $(item).text('还是叠上吧');
        }
    },
};

var Share = {
    parseItem: function (item) {
        item = $(item).parent();
        return {
            url: $(item).attr('data-url'),
            title: $(item).attr('data-title'),
            excerpt: $(item).attr('data-excerpt'),
            img: $(item).attr('data-img'),
            twitter: $(item).attr('data-twitter'),
            weibo: $(item).attr('data-weibo'),
        };
    },

    toWeibo: function (item) {
        var content = Share.parseItem(item);
        var url = 'http://service.weibo.com/share/share.php?appkey=&title=分享《' + content.title + '》 @' + content.weibo + '%0a%0a' + content.excerpt
            + '&url=' + content.url
            + '&pic=' + content.img + '&searchPic=false&style=simple';
        window.open(url);
    },

    toTwitter: function (item) {
        var content = Share.parseItem(item);
        var url = 'https://twitter.com/intent/tweet?text=分享《' + content.title + '》 @' + content.twitter + '%0a%0a' + content.excerpt
            + '%20' + content.url;
        window.open(url);
    }
};

var AjaxComment = {
    noName: '必须填写用户名',
    noMail: '必须填写电子邮箱地址',
    noUrl: '必须填写 URL',
    noContent: '必须填写评论内容',
    invalidMail: '邮箱地址不合法',
    commentsOrder: 'DESC',
    commentList: '.comment-list',
    comments: '#comments .comments-title',
    commentReply: '.comment-reply',
    commentForm: '#comment-form',
    respond: '.respond',
    commentPager: '.comments-container .pager a',
    textarea: '#textarea',
    submitBtn: '#comment-submit-button',
    newID: '',
    parentID: '',
    threadPreviewSize: 1,
    threadPageSize: 8,
    threadPaginationThreshold: 8,
    threadPagerWindow: 5,
    threadFocusPendingId: '',

    isCommentPjaxRequest: function (options) {
        return !!(options && options.container === '#comments');
    },

    setCommentPageLoading: function (isLoading) {
        var $comments = $('#comments');
        var $container = $comments.closest('.comments-container');

        if ($comments.length === 0 || $container.length === 0) {
            return;
        }

        $container.toggleClass('is-loading', isLoading);
        $comments.toggleClass('is-loading', isLoading);
        $(AjaxComment.commentPager)
            .toggleClass('is-disabled', isLoading)
            .attr('aria-disabled', isLoading ? 'true' : null);
    },

    bindPager: function () {
        $(document).off('click', AjaxComment.commentPager);
        $(document).on('click', AjaxComment.commentPager, function (event) {
            var href = this.href || $(this).attr('href');

            if (!window.VoidPjax || typeof window.VoidPjax.visit !== 'function' || !href) {
                return true;
            }

            event.preventDefault();
            window.VoidPjax.visit({
                url: href,
                container: '#comments',
                fragment: '#comments',
                timeout: 8000,
                scrollTop: false,
                push: true,
                target: this
            });
            return false;
        });
    },

    afterPagePjax: function () {
        VOID_Content.parseUrl();
        VOID_Content.highlight();
        VOID_Vote.reload();
        VOID.initOwO();
        AjaxComment.init();
    },

    endPagePjax: function () {
        AjaxComment.setCommentPageLoading(false);
    },

    resolveCommentTarget: function ($trigger) {
        var $comment = $trigger.closest('[data-comment-id], .comment-body[id]');
        if ($comment.length === 0) {
            return '';
        }

        return $comment.attr('data-comment-id') || $comment.attr('id') || '';
    },

    bindClick: function () {
        $(AjaxComment.commentReply + ' a, #cancel-comment-reply-link').off('click');
        $(AjaxComment.commentReply + ' a').on('click', function () { // 回复
            AjaxComment.parentID = AjaxComment.resolveCommentTarget($(this));
            $(AjaxComment.textarea).focus();
        });
        $('#cancel-comment-reply-link').on('click', function () { // 取消
            AjaxComment.parentID = '';
        });
    },

    collectThreadItems: function ($children) {
        var items = [];

        var walk = function ($container) {
            var $list = $container.children('.comment-list');
            if ($list.length === 0) {
                return;
            }

            $list.children('.comment-body').each(function () {
                var $comment = $(this);
                var $nested = $comment.children('.comment-children').detach();
                items.push($comment);

                if ($nested.length > 0) {
                    walk($nested);
                }
            });
        };

        walk($children);
        return items;
    },

    ensureThreadPanel: function ($children) {
        var $list = $children.children('.comment-list');

        if (!$children.hasClass('comment-thread-panel')) {
            var items = AjaxComment.collectThreadItems($children);
            if (items.length === 0) {
                return $();
            }

            $children.empty().addClass('comment-thread-panel');
            $list = $('<div class="comment-list comment-thread-list"></div>');

            $.each(items, function (index, $comment) {
                $comment
                    .addClass('comment-thread-item')
                    .attr('data-thread-index', index);
                $list.append($comment);
            });

            $children.append($list);
            return $list;
        }

        if ($list.length === 0) {
            $list = $('<div class="comment-list comment-thread-list"></div>');
            $children.append($list);
        }

        $list.addClass('comment-thread-list');
        $list.children('.comment-body').each(function (index) {
            $(this)
                .addClass('comment-thread-item')
                .attr('data-thread-index', index);
        });

        return $list;
    },

    buildThreadPages: function (currentPage, totalPages) {
        var pages = [];
        var windowSize = AjaxComment.threadPagerWindow;
        var start;
        var end;
        var page;

        if (totalPages <= windowSize + 1) {
            for (page = 1; page <= totalPages; page++) {
                pages.push(page);
            }
            return pages;
        }

        pages.push(1);
        start = Math.max(2, currentPage - 1);
        end = Math.min(totalPages - 1, currentPage + 2);

        if (start > 2) {
            pages.push('ellipsis');
        }

        for (page = start; page <= end; page++) {
            pages.push(page);
        }

        if (end < totalPages - 1) {
            pages.push('ellipsis');
        }

        pages.push(totalPages);
        return pages;
    },

    renderThreadFooter: function ($children, totalItems, currentPage, totalPages, shouldPaginate) {
        var $list = $children.children('.comment-thread-list');
        var $footer = $list.children('.comment-thread-footer');
        var $pagination;
        var pages;
        var isExpanded = $children.attr('data-thread-expanded') === 'true';

        if ($footer.length === 0) {
            $footer = $('<div class="comment-thread-footer"></div>');
            $list.append($footer);
        }

        $footer.empty();
        if (!isExpanded) {
            $footer
                .addClass('is-collapsed')
                .append('<button type="button" class="comment-thread-expand">查看全部 ' + totalItems + ' 条回复</button>');

            $footer.find('.comment-thread-expand').on('click', function () {
                $children.attr('data-thread-expanded', 'true');
                AjaxComment.renderThreadPage($children, currentPage);
            });
            return;
        }

        $footer.removeClass('is-collapsed');
        $footer.append('<span class="comment-thread-total">共 ' + totalItems + ' 条回复</span>');
        $pagination = $('<div class="comment-thread-pagination"></div>');

        if (shouldPaginate) {
            pages = AjaxComment.buildThreadPages(currentPage, totalPages);

            $.each(pages, function (_, page) {
                var $button;

                if (page === 'ellipsis') {
                    $pagination.append('<span class="comment-thread-ellipsis">...</span>');
                    return;
                }

                $button = $('<button type="button" class="comment-thread-page"></button>');
                $button.text(page);
                $button.attr('data-thread-page', page);

                if (page === currentPage) {
                    $button.addClass('is-active').attr('aria-current', 'page');
                }

                $pagination.append($button);
            });

            if (currentPage < totalPages) {
                $pagination.append('<button type="button" class="comment-thread-next" data-thread-page="' + (currentPage + 1) + '">下一页</button>');
            }
        }

        $pagination.append('<button type="button" class="comment-thread-collapse">收起</button>');
        $footer.append($pagination);

        $footer.find('button[data-thread-page]').on('click', function () {
            AjaxComment.renderThreadPage($children, parseInt($(this).attr('data-thread-page'), 10));
        });

        $footer.find('.comment-thread-collapse').on('click', function () {
            $children.attr('data-thread-expanded', 'false');
            AjaxComment.renderThreadPage($children, 1);
            if ($children.parent().attr('id')) {
                VOID_Ui.scrollToWithHeader('#' + $children.parent().attr('id'));
            }
        });
    },

    renderThreadPage: function ($children, targetPage) {
        var $list = $children.children('.comment-thread-list');
        var $items = $list.children('.comment-thread-item');
        var $newComment = AjaxComment.threadFocusPendingId ? $children.find('#comment-' + AjaxComment.threadFocusPendingId).first() : $();
        var totalItems = $items.length;
        var previewSize = AjaxComment.threadPreviewSize;
        var pageSize = AjaxComment.threadPageSize;
        var paginationThreshold = AjaxComment.threadPaginationThreshold;
        var shouldPaginate = totalItems > paginationThreshold;
        var totalPages = shouldPaginate ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
        var shouldShowThreadFooter = totalItems > previewSize;
        var currentPage = targetPage || parseInt($children.attr('data-thread-page'), 10) || 1;
        var preferredPage = 0;
        var isExpanded = $children.attr('data-thread-expanded') === 'true';
        var startIndex;
        var endIndex;

        if ($newComment.length > 0) {
            preferredPage = shouldPaginate ? Math.ceil(($items.index($newComment) + 1) / pageSize) : 1;
            isExpanded = true;
            AjaxComment.threadFocusPendingId = '';
        }

        if (preferredPage > 0) {
            currentPage = preferredPage;
        }

        if (totalPages > 1 && !$children.attr('data-thread-expanded')) {
            isExpanded = false;
        }

        if (!isExpanded) {
            currentPage = 1;
            startIndex = 0;
            endIndex = previewSize;
        } else if (!shouldPaginate) {
            currentPage = 1;
            startIndex = 0;
            endIndex = totalItems;
        } else {
            currentPage = Math.max(1, Math.min(currentPage, totalPages));
            startIndex = (currentPage - 1) * pageSize;
            endIndex = startIndex + pageSize;
        }

        $children.attr('data-thread-page', currentPage);
        $children.attr('data-thread-expanded', isExpanded ? 'true' : 'false');
        $children
            .toggleClass('is-thread-expanded', isExpanded)
            .toggleClass('is-thread-collapsed', !isExpanded)
            .toggleClass('no-thread-footer', !shouldShowThreadFooter);

        $items.each(function (index) {
            $(this)
                .attr('data-thread-index', index)
                .toggleClass('is-thread-hidden', index < startIndex || index >= endIndex);
        });

        if (!shouldShowThreadFooter) {
            $list.children('.comment-thread-footer').remove();
            return;
        }

        AjaxComment.renderThreadFooter($children, totalItems, currentPage, totalPages, shouldPaginate);
    },

    applyThreadPanels: function () {
        $('#comments > .comment-list > .comment-body.comment-parent').each(function () {
            var $parent = $(this);
            var $children = $parent.children('.comment-children');
            var $list;

            if ($children.length === 0) {
                return;
            }

            $list = AjaxComment.ensureThreadPanel($children);
            if ($list.length === 0) {
                return;
            }

            if (!$children.attr('data-thread-expanded')) {
                $children.attr('data-thread-expanded', 'false');
            }
            AjaxComment.renderThreadPage($children);
        });
    },

    err: function () {
        $(AjaxComment.submitBtn).attr('disabled', false);
        AjaxComment.newID = '';
    },

    finish: function () {
        TypechoComment.cancelReply();
        $(AjaxComment.submitBtn).html('提交评论');
        $(AjaxComment.textarea).val('');
        $(AjaxComment.submitBtn).attr('disabled', false);
        if ($('#comment-' + AjaxComment.newID).length > 0) {
            VOID_Ui.scrollToWithHeader('#comment-' + AjaxComment.newID);
            $('#comment-' + AjaxComment.newID).fadeTo(500, 1);
        }
        $('.comment-num .num').html(parseInt($('.comment-num .num').html()) + 1);
        AjaxComment.threadFocusPendingId = AjaxComment.newID;
        AjaxComment.bindClick();
        AjaxComment.applyThreadPanels();
        VOID_Content.highlight();
    },

    init: function () {
        AjaxComment.bindPager();
        AjaxComment.bindClick();
        AjaxComment.applyThreadPanels();
        $(AjaxComment.commentForm).off('submit').on('submit', function () { // 提交事件
            $(AjaxComment.submitBtn).attr('disabled', true);

            /* 检查 */
            if ($(AjaxComment.commentForm).find('#author')[0]) {
                if ($(AjaxComment.commentForm).find('#author').val() == '') {
                    VOID.alert(AjaxComment.noName);
                    AjaxComment.err();
                    return false;
                }

                if (typeof $(AjaxComment.commentForm).find('#mail').attr('required') != 'undefined') {
                    // 需要邮箱
                    if ($(AjaxComment.commentForm).find('#mail').val() == '') {
                        VOID.alert(AjaxComment.noMail);
                        AjaxComment.err();
                        return false;
                    }
                }

                if ($(AjaxComment.commentForm).find('#mail').val() != '') {
                    var filter = /^[^@\s<&>]+@([a-z0-9]+\.)+[a-z]{2,4}$/i;
                    if (!filter.test($(AjaxComment.commentForm).find('#mail').val())) {
                        VOID.alert(AjaxComment.invalidMail);
                        AjaxComment.err();
                        return false;
                    }
                }

                if ($(AjaxComment.commentForm).find('#url').val() == ''
                    && typeof $(AjaxComment.commentForm).find('#url').attr('required') != 'undefined') {
                    VOID.alert(AjaxComment.noUrl);
                    AjaxComment.err();
                    return false;
                }
            }

            var textValue = $(AjaxComment.commentForm).find(AjaxComment.textarea).val().replace(/(^\s*)|(\s*$)/g, '');//检查空格信息
            if (textValue == null || textValue == '') {
                VOID.alert(AjaxComment.noContent);
                AjaxComment.err();
                return false;
            }
            $(AjaxComment.submitBtn).html('提交中');
            $.ajax({
                url: $(AjaxComment.commentForm).attr('action'),
                type: $(AjaxComment.commentForm).attr('method'),
                data: $(AjaxComment.commentForm).serializeArray(),
                error: function () {
                    VOID.alert('提交失败！请重试。');
                    $(AjaxComment.submitBtn).html('提交评论');
                    AjaxComment.err();
                    return false;
                },
                success: function (data) { //成功取到数据
                    try {
                        if (!$(AjaxComment.commentList, data).length) {
                            var msg = '提交失败！请重试。' + $($(data)[7]).text();
                            VOID.alert(msg);
                            $(AjaxComment.submitBtn).html('提交评论');
                            AjaxComment.err();
                            return false;
                        } else {
                            AjaxComment.newID = $(AjaxComment.commentList, data).html().match(/id="?comment-\d+/g).join().match(/\d+/g).sort(function (a, b) {
                                return a - b;
                            }).pop();

                            if ($('.pager .prev').length && AjaxComment.parentID == '') {
                                // 在分页对文章发表评论，无法取得最新评论内容
                                VOID.alert('评论成功！请回到评论第一页查看。');
                                AjaxComment.newID = '';
                                AjaxComment.parentID = '';
                                AjaxComment.finish();
                                return false;
                            }

                            var newCommentType = AjaxComment.parentID == '' ? 'comment-parent' : 'comment-child';
                            var newCommentData = '<div id="comment-' + AjaxComment.newID + '" style="opacity:0" class="comment-body ' + newCommentType + '">' + $(data).find('#comment-' + AjaxComment.newID).html() + '</div>';

                            // 当页面无评论，先添加一个评论容器
                            if ($(AjaxComment.commentList).length <= 0) {
                                $('#comments').append('<h3 class="comment-separator"><div class="comment-tab-current"><span class="comment-num">已有 <span class="num">0</span> 条评论</span></div></h3>')
                                    .append('<div class="comment-list"></div>');
                            }

                            if (AjaxComment.parentID == '') {
                                // 无父 id，直接对文章评论，插入到第一个 comment-list 头部
                                $('#comments>.comment-list').prepend(newCommentData);
                                VOID.alert('评论成功！');
                                AjaxComment.finish();
                                AjaxComment.newID = '';
                                return false;
                            } else {
                                if ($('#' + AjaxComment.parentID).hasClass('comment-parent')) {
                                    // 父评论是母评论
                                    if ($('#' + AjaxComment.parentID + ' > .comment-children').length > 0) {
                                        // 父评论已有子评论，插入到子评论列表头部
                                        $('#' + AjaxComment.parentID + ' > .comment-children > .comment-list').prepend(newCommentData);
                                    }
                                    else {
                                        // 父评论没有子评论，新建一层包裹
                                        newCommentData = '<div class="comment-children"><div class="comment-list">' + newCommentData + '</div></div>';
                                        $('#' + AjaxComment.parentID).append(newCommentData);
                                    }
                                } else {
                                    // 父评论是子评论，与父评论平级，并放在后面
                                    $('#' + AjaxComment.parentID).after(newCommentData);
                                }
                                VOID.alert('评论成功！');
                                AjaxComment.finish();
                                AjaxComment.parentID = '';
                                AjaxComment.newID = '';
                                return false;
                            }
                        }
                    } catch (e) {
                        window.location.reload();
                    }
                } // end success()
            }); // end ajax()
            return false;
        }); // end submit()
    }
};

(function () {
    var resolvePjaxOptions = function (args) {
        var index;

        for (index = args.length - 1; index >= 0; index--) {
            if (args[index] && typeof args[index] === 'object' && args[index].container) {
                return args[index];
            }
        }

        return null;
    };

    $(document).ready(function () {
        VOID.init();
        if (VOIDConfig.PJAX) {
            $(document).on('pjax:send', function () {
                var options = resolvePjaxOptions(arguments);

                if (AjaxComment.isCommentPjaxRequest(options)) {
                    AjaxComment.setCommentPageLoading(true);
                    return;
                }

                if (VOID.isMainPjaxRequest(options)) {
                    VOID.beforePjax();
                }
            });

            $(document).on('pjax:complete', function () {
                var options = resolvePjaxOptions(arguments);

                if (AjaxComment.isCommentPjaxRequest(options)) {
                    AjaxComment.afterPagePjax();
                    return;
                }

                if (VOID.isMainPjaxRequest(options)) {
                    VOID.afterPjax();
                }
            });

            $(document).on('pjax:end', function () {
                var options = resolvePjaxOptions(arguments);

                if (AjaxComment.isCommentPjaxRequest(options)) {
                    AjaxComment.endPagePjax();
                    return;
                }

                if (VOID.isMainPjaxRequest(options)) {
                    VOID.endPjax();
                }
            });
        }
    });

    window.setInterval(function () {
        var times = new Date().getTime() - Date.parse(VOIDConfig.buildTime);
        times = Math.floor(times / 1000); // convert total milliseconds into total seconds
        var days = Math.floor(times / (60 * 60 * 24)); //separate days
        times %= 60 * 60 * 24; //subtract entire days
        var hours = Math.floor(times / (60 * 60)); //separate hours
        times %= 60 * 60; //subtract entire hours
        var minutes = Math.floor(times / 60); //separate minutes
        times %= 60; //subtract entire minutes
        var seconds = Math.floor(times / 1); // remainder is seconds
        $('#uptime').html(days + ' 天 ' + hours + ' 小时 ' + minutes + ' 分 ' + seconds + ' 秒 ');
    }, 1000);
})();

// 复制到剪贴板（带 fallback）
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    // fallback for non-HTTPS or older browsers
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(textarea);
    // 兼容早期 iOS
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try {
        var success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success ? Promise.resolve() : Promise.reject(new Error('Copy failed'));
    } catch (e) {
        document.body.removeChild(textarea);
        return Promise.reject(e);
    }
}

var clipboardCopyIcon = '<svg aria-hidden="true" role="img" class="clipboard-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="display: inline-block; user-select: none; vertical-align: text-bottom;"><path fill-rule="evenodd" d="M5.75 1a.75.75 0 00-.75.75v3c0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75v-3a.75.75 0 00-.75-.75h-4.5zm.75 3V2.5h3V4h-3zm-2.874-.467a.75.75 0 00-.752-1.298A1.75 1.75 0 002 3.75v9.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 13.25v-9.5a1.75 1.75 0 00-.874-1.515.75.75 0 10-.752 1.298.25.25 0 01.126.217v9.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-9.5a.25.25 0 01.126-.217z"></path></svg>';

function loadClipboard() {
    $('pre').each(function () {
        if (!$(this).find('.clipboard').length) {
            $(this).prepend('<div class="clipboard" title="复制代码">' + clipboardCopyIcon + '</div>');
        }
    });
}

// 事件委托只绑定一次，PJAX 安全
$(document).ready(function () {
    loadClipboard();

    $('body').on('click', '.clipboard', function () {
        var btn = $(this);
        var code = btn.closest('pre').find('code').text() || btn.closest('pre').text();
        copyToClipboard(code).then(function () {
            VOID.alert("复制成功");
        }).catch(function () {
            VOID.alert("复制失败");
        });
    });
});

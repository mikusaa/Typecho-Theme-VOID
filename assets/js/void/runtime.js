var VOID = {
    pjaxLifecycleBound: false,
    pjaxLifecycleHandlers: null,
    emotePicker: null,
    emoteContentObserver: null,
    typographyGeneration: 0,

    safeRunPangu: function () {
        try {
            VOID_Content.pangu();
        } catch (err) {
            console.error('Pangu init failed:', err);
        }
    },

    cancelScheduledTypography: function () {
        this.typographyGeneration += 1;
    },

    isTypographyReady: function () {
        if (typeof document.querySelectorAll !== 'function'
            || typeof window.getComputedStyle !== 'function') {
            return true;
        }

        var enteringContent = document.querySelectorAll('.float-up');
        for (var index = 0; index < enteringContent.length; index++) {
            if (parseFloat(window.getComputedStyle(enteringContent[index]).opacity) === 0) {
                return false;
            }
        }

        return true;
    },

    scheduleTypography: function () {
        var generation = ++this.typographyGeneration;
        var container = VOID_Content.getMathContainer();
        var mathJaxLoadPromise = VOID_Content.prepareMath(container);
        var visibilityChecksRemaining = 120;
        var scheduleFrame = typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame.bind(window)
            : function (callback) {
                window.setTimeout(callback, 34);
            };
        var run = function () {
            if (generation !== VOID.typographyGeneration) {
                return;
            }

            VOID.safeRunPangu();
            VOID_Content.bigfoot();
            VOID_Content.math(container, generation, mathJaxLoadPromise);
            VOID_Content.hyphenate();
        };
        var runWhenVisible = function () {
            if (generation !== VOID.typographyGeneration) {
                return;
            }

            if (VOID.isTypographyReady() || visibilityChecksRemaining <= 0) {
                run();
                return;
            }

            visibilityChecksRemaining -= 1;
            scheduleFrame(runWhenVisible);
        };

        scheduleFrame(function () {
            scheduleFrame(runWhenVisible);
        });
    },

    resolvePjaxOptions: function (args) {
        var index;
        var event = args && args[0];
        var originalEvent = event && event.originalEvent ? event.originalEvent : event;
        var detail = originalEvent && originalEvent.detail;

        if (detail && detail.options && typeof detail.options === 'object') {
            return detail.options;
        }

        for (index = detail && detail.args && typeof detail.args.length === 'number'
            ? detail.args.length - 1 : -1; index >= 0; index--) {
            if (detail.args[index]
                && typeof detail.args[index] === 'object'
                && detail.args[index].container) {
                return detail.args[index];
            }
        }

        for (index = args ? args.length - 1 : -1; index >= 0; index--) {
            if (args[index] && typeof args[index] === 'object' && args[index].container) {
                return args[index];
            }
        }

        return null;
    },

    bindPjaxLifecycle: function () {
        if (!VOIDConfig.PJAX || this.pjaxLifecycleBound) {
            return;
        }

        this.pjaxLifecycleHandlers = {
            send: function () {
                var options = VOID.resolvePjaxOptions(arguments);

                if (AjaxComment.isCommentPjaxRequest(options)) {
                    AjaxComment.cancelSubmit();
                    VOID.destroyEmotes();
                    AjaxComment.setCommentPageLoading(true);
                    return;
                }

                if (VOID.isMainPjaxRequest(options)) {
                    AjaxComment.cancelSubmit();
                    VOID.beforePjax();
                }
            },
            beforeReplace: function () {
                var options = VOID.resolvePjaxOptions(arguments);

                if (AjaxComment.isCommentPjaxRequest(options)) {
                    AjaxComment.beforePjaxReplace();
                    return;
                }

                if (VOID.isMainPjaxRequest(options)) {
                    AjaxComment.beforePjaxReplace();
                    VOID.beforePjaxReplace();
                }
            },
            complete: function () {
                var options = VOID.resolvePjaxOptions(arguments);

                if (AjaxComment.isCommentPjaxRequest(options)) {
                    AjaxComment.afterPagePjax(options);
                    return;
                }

                if (VOID.isMainPjaxRequest(options)) {
                    VOID.afterPjax(options);
                }
            },
            abort: function () {
                var options = VOID.resolvePjaxOptions(arguments);

                if (VOID.isMainPjaxRequest(options)) {
                    VOID.afterPjax();
                }
            },
            end: function () {
                var options = VOID.resolvePjaxOptions(arguments);

                if (AjaxComment.isCommentPjaxRequest(options)) {
                    AjaxComment.endPagePjax();
                    return;
                }

                if (VOID.isMainPjaxRequest(options)) {
                    VOID.endPjax();
                }
            }
        };

        document.addEventListener('pjax:send', this.pjaxLifecycleHandlers.send);
        document.addEventListener('pjax:beforeReplace', this.pjaxLifecycleHandlers.beforeReplace);
        document.addEventListener('pjax:complete', this.pjaxLifecycleHandlers.complete);
        document.addEventListener('pjax:abort', this.pjaxLifecycleHandlers.abort);
        document.addEventListener('pjax:end', this.pjaxLifecycleHandlers.end);
        this.pjaxLifecycleBound = true;
    },

    unbindPjaxLifecycle: function () {
        var handlers = this.pjaxLifecycleHandlers;

        if (!handlers) {
            this.pjaxLifecycleBound = false;
            return;
        }

        document.removeEventListener('pjax:send', handlers.send);
        document.removeEventListener('pjax:beforeReplace', handlers.beforeReplace);
        document.removeEventListener('pjax:complete', handlers.complete);
        document.removeEventListener('pjax:abort', handlers.abort);
        document.removeEventListener('pjax:end', handlers.end);
        this.pjaxLifecycleHandlers = null;
        this.pjaxLifecycleBound = false;
    },

    // 初始化单页应用
    init: function () {
        /* 初始化 UI */
        VOID_Ui.checkHeader();
        if (typeof VOID_CardCover !== 'undefined') {
            VOID_CardCover.init(document.getElementById('pjax-container'));
        }
        VOID_Ui.MasonryCtrler.init();
        VOID_Ui.DarkModeSwitcher.checkColorScheme();
        VOID_Content.parseBoardThumbs();
        VOID_Gallery.init();
        VOID_PhotoSets.init();
        VOID_PhotoSwipe.init();
        VOID_RewardDialog.init();
        VOID_Ui.lazyload();
        VOID_Ui.headroom();

        VOID_Content.countWords();
        VOID_Content.parseDetails();
        VOID_Content.parseTables(document.getElementById('pjax-container') || document);
        VOID_Content.parseTOC();
        if (typeof VOID_ControllerPanel !== 'undefined') {
            VOID_ControllerPanel.init();
        }
        VOID_Content.highlight();
        VOID_Content.parseUrl();
        VOID.scheduleTypography();

        VOID_Vote.reload();
        VOID.initEmotes();
        AjaxComment.init();
        VOID_Ui.checkScrollTop();

        VOID_Ui.bindDismissEvents();
    },

    initEmotes: function () {
        var container = document.getElementById('void-comment-emotes');
        var target = document.getElementById('textarea');

        if (window.VoidEmotes && container && target) {
            this.emotePicker = window.VoidEmotes.mount({
                container: container,
                target: target,
                mode: 'inline'
            });
        }

        this.initEmoteContent();
    },

    initEmoteContent: function () {
        if (this.emoteContentObserver && typeof this.emoteContentObserver.destroy === 'function') {
            this.emoteContentObserver.destroy();
        }
        this.emoteContentObserver = window.VoidEmotes
            ? window.VoidEmotes.observeContent(document.getElementById('pjax-container') || document)
            : null;
    },

    destroyEmotes: function () {
        if (this.emotePicker && typeof this.emotePicker.destroy === 'function') {
            this.emotePicker.destroy();
        }
        if (this.emoteContentObserver && typeof this.emoteContentObserver.destroy === 'function') {
            this.emoteContentObserver.destroy();
        }
        this.emotePicker = null;
        this.emoteContentObserver = null;
    },

    isMainPjaxRequest: function (options) {
        return !options || options.container === '#pjax-container';
    },

    // PJAX 开始前
    beforePjax: function () {
        VOID.cancelScheduledTypography();
        if (typeof VOID_AnchorScroller !== 'undefined') {
            VOID_AnchorScroller.stop();
        }
        NProgress.start();
        VOID_RewardDialog.destroy();
        VOID_PhotoSwipe.destroy();
        VOID_Gallery.suspend();
        VOID_PhotoSets.destroy();
        VOID.destroyEmotes();
        VOID_Ui.reset();
    },

    beforePjaxReplace: function () {
        VOID_Content.clearMath(VOID_Content.getMathContainer());
        VOID_Ui.MasonryCtrler.destroy();
    },

    // PJAX 结束后
    afterPjax: function () {
        NProgress.done();

        VOID_Content.parseBoardThumbs();

        VOID_Gallery.init();
        VOID_PhotoSets.init();
        VOID_PhotoSwipe.init();
        VOID_RewardDialog.init();

        VOID_Ui.invalidateLoginAction();

        if (typeof VOID_CardCover !== 'undefined') {
            VOID_CardCover.init(document.getElementById('pjax-container'));
        }
        VOID_Ui.MasonryCtrler.init();
        VOID_Ui.lazyload();

        VOID_Content.countWords();
        VOID_Content.parseDetails();
        VOID_Content.parseTables(document.getElementById('pjax-container') || document);
        VOID_Content.parseTOC();
        if (typeof VOID_ControllerPanel !== 'undefined') {
            VOID_ControllerPanel.refresh();
        }
        VOID_Content.parseUrl();
        VOID_Content.highlight();
        VOID.scheduleTypography();
        loadClipboard();

        VOID_Vote.reload();
        VOID.initEmotes();
        AjaxComment.init();
        VOID_Ui.checkScrollTop();
    },

    endPjax: function () {
        if (!document.querySelector('.TOC')) {
            TOC.close();
        }
    },

    alert: function (content, time) {
        var id = new Date().getTime();
        var message = document.createElement('div');
        var messages;
        var messageHeight;
        message.className = 'msg';
        message.id = 'msg' + id;
        message.textContent = content == null ? '' : String(content);
        document.body.insertBefore(message, document.body.firstChild);
        messages = document.querySelectorAll('.msg');
        messageHeight = message.offsetHeight;
        for (var index = 0; index < messages.length; index++) {
            if (messages[index] !== message) {
                messages[index].style.top = messages[index].getBoundingClientRect().top
                    + messageHeight + 20 + 'px';
            }
        }
        message.classList.add('show');
        var t = time;
        if (typeof (t) != 'number') {
            t = 2500;
        }
        setTimeout(function () {
            message.classList.add('hide');
            setTimeout(function () {
                message.remove();
            }, 1000);
        }, t);
    },

    startSearch: function (item) {
        item = typeof item === 'string' ? document.querySelector(item) : item;
        if (!item) {
            return;
        }

        var c = item.value;
        item.value = '';
        item.blur();
        if (!c || c == '') {
            item.setAttribute('placeholder', '你还没有输入任何信息');
            return;
        }
        var t = VOIDConfig.searchBase + encodeURIComponent(c);
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

    enterSearch: function (item, event) {
        event = event || window.event;
        if (event && (event.key === 'Enter' || event.keyCode == 13)) {
            VOID.startSearch(item);
        }
    }
};

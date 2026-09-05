var AjaxComment = {
    noName: '必须填写用户名',
    noMail: '必须填写电子邮箱地址',
    noUrl: '必须填写 URL',
    noContent: '必须填写评论内容',
    invalidMail: '邮箱地址不合法',
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
    activeReplyCommentId: '',
    activeReplyCoid: '',
    replyWord: '回复',
    cancelReplyWord: '取消回复',
    threadPreviewSize: 1,
    threadPageSize: 8,
    threadPaginationThreshold: 8,
    threadPagerWindow: 5,
    threadFocusPendingId: '',
    antiSpamCleanup: null,
    pagerHandler: null,
    hashChangeHandler: null,
    submitForm: null,
    submitHandler: null,
    submitController: null,
    submitToken: null,
    submitGeneration: 0,

    isCommentPjaxRequest: function (options) {
        return !!(options && options.container === '#comments');
    },

    getCommentsOrder: function () {
        var comments = document.querySelector('#comments');
        var order = comments ? String(comments.getAttribute('data-comments-order') || '').toUpperCase() : '';

        return order === 'ASC' ? 'ASC' : 'DESC';
    },

    isNewestCommentPage: function () {
        var pagerSelector = AjaxComment.getCommentsOrder() === 'ASC'
            ? '#comments .pager .next'
            : '#comments .pager .prev';

        return !document.querySelector(pagerSelector);
    },

    insertNewestComment: function (list, comment) {
        var footer;

        if (!list || !comment) {
            return;
        }

        if (AjaxComment.getCommentsOrder() === 'DESC') {
            list.insertBefore(comment, list.firstChild);
            return;
        }

        footer = AjaxComment.getDirectElement(list, '.comment-thread-footer');
        if (footer) {
            list.insertBefore(comment, footer);
        } else {
            list.appendChild(comment);
        }
    },

    getCommentDepth: function (comment) {
        var depth = comment ? parseInt(comment.getAttribute('data-comment-depth'), 10) : 0;

        return isNaN(depth) ? 0 : depth;
    },

    installAntiSpamToken: function (form, token) {
        var events = ['scroll', 'mousemove', 'keyup', 'touchstart'];
        var input = document.createElement('input');
        var listening = true;

        AjaxComment.destroyAntiSpamToken();
        if (!form) {
            return;
        }

        input.type = 'hidden';
        input.name = '_';
        input.value = token;

        function cleanup() {
            if (!listening) {
                return;
            }
            listening = false;
            for (var i = 0; i < events.length; i++) {
                window.removeEventListener(events[i], append);
            }
            if (AjaxComment.antiSpamCleanup === cleanup) {
                AjaxComment.antiSpamCleanup = null;
            }
        }

        function append() {
            if (!document.documentElement.contains(form)) {
                cleanup();
                return;
            }
            if (!form.querySelector('input[name="_"]')) {
                form.appendChild(input);
            }
            cleanup();
        }

        for (var i = 0; i < events.length; i++) {
            window.addEventListener(events[i], append);
        }
        AjaxComment.antiSpamCleanup = cleanup;
    },

    destroyAntiSpamToken: function () {
        if (typeof AjaxComment.antiSpamCleanup === 'function') {
            AjaxComment.antiSpamCleanup();
        }
        AjaxComment.antiSpamCleanup = null;
    },

    beforePjaxReplace: function () {
        AjaxComment.destroyAntiSpamToken();
        AjaxComment.unbindSubmit();
    },

    getDirectChild: function (root, node) {
        if (!node || !node.parentNode) {
            return null;
        }
        if (node.parentNode === root) {
            return node;
        }
        return AjaxComment.getDirectChild(root, node.parentNode);
    },

    getDirectElement: function (root, selector) {
        var child = root ? root.firstElementChild : null;

        while (child) {
            if (child.matches(selector)) {
                return child;
            }
            child = child.nextElementSibling;
        }
        return null;
    },

    getDirectElements: function (root, selector) {
        var elements = [];
        var child = root ? root.firstElementChild : null;

        while (child) {
            if (child.matches(selector)) {
                elements.push(child);
            }
            child = child.nextElementSibling;
        }
        return elements;
    },

    focusWithoutScroll: function (element) {
        var scrollLeft;
        var scrollTop;

        if (!element || typeof element.focus !== 'function') {
            return;
        }

        try {
            element.focus({ preventScroll: true });
        } catch (err) {
            scrollLeft = window.pageXOffset || 0;
            scrollTop = window.pageYOffset || 0;
            element.focus();
            if (typeof window.scrollTo === 'function') {
                window.scrollTo(scrollLeft, scrollTop);
            }
        }
    },

    preserveLayout: function (element, callback, options) {
        if (typeof VOID_AnchorScroller !== 'undefined'
            && typeof VOID_AnchorScroller.preserveElement === 'function') {
            VOID_AnchorScroller.preserveElement(element, callback, options);
            return;
        }
        callback();
    },

    moveReplyForm: function (commentId, coid, trigger) {
        var comment = document.getElementById(commentId);
        var response = document.querySelector(AjaxComment.respond);
        var form;
        var input;
        var holder;
        var child;
        var cancel;
        var textarea;

        if (!comment || !response) {
            return true;
        }

        form = response.tagName === 'FORM' ? response : response.querySelector('form');
        if (!form) {
            return true;
        }

        input = form.querySelector('input[name="parent"]');
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'parent';
            input.id = 'comment-parent';
            form.appendChild(input);
        }

        holder = document.getElementById('void-comment-form-place-holder');
        if (!holder) {
            holder = document.createElement('div');
            holder.id = 'void-comment-form-place-holder';
            response.parentNode.insertBefore(holder, response);
        }

        AjaxComment.preserveLayout(comment, function () {
            child = AjaxComment.getDirectChild(comment, trigger);
            if (child) {
                comment.insertBefore(response, child.nextSibling);
            } else {
                comment.appendChild(response);
            }

            input.value = String(coid);
            input.setAttribute('value', String(coid));

            cancel = document.getElementById('cancel-comment-reply-link');
            if (cancel) {
                cancel.style.display = '';
            }
        });

        textarea = response.querySelector('textarea[name="text"]');
        if (textarea) {
            AjaxComment.focusWithoutScroll(textarea);
        }
        return false;
    },

    restoreReplyForm: function () {
        var response = document.querySelector(AjaxComment.respond);
        var holder = document.getElementById('void-comment-form-place-holder');
        var input = response ? response.querySelector('input[name="parent"]') : null;
        var cancel = document.getElementById('cancel-comment-reply-link');
        var anchor = response ? response.parentElement : null;

        AjaxComment.preserveLayout(anchor, function () {
            if (input && input.parentNode) {
                input.parentNode.removeChild(input);
            }
            if (response && holder && holder.parentNode) {
                holder.parentNode.insertBefore(response, holder);
            }
            if (cancel) {
                cancel.style.display = 'none';
            }
        });
        return false;
    },

    ensureTypechoCommentFacade: function () {
        if (window.TypechoComment) {
            return;
        }

        window.TypechoComment = {
            reply: function (commentId, coid, trigger) {
                return AjaxComment.moveReplyForm(commentId, coid, trigger);
            },
            cancelReply: function () {
                return AjaxComment.restoreReplyForm();
            }
        };
    },

    setCommentPageLoading: function (isLoading) {
        var comments = document.querySelector('#comments');
        var container = comments ? comments.closest('.comments-container') : null;
        var pagers;

        if (!comments || !container) {
            return;
        }

        container.classList.toggle('is-loading', isLoading);
        comments.classList.toggle('is-loading', isLoading);
        pagers = document.querySelectorAll(AjaxComment.commentPager);
        for (var i = 0; i < pagers.length; i++) {
            pagers[i].classList.toggle('is-disabled', isLoading);
            if (isLoading) {
                pagers[i].setAttribute('aria-disabled', 'true');
            } else {
                pagers[i].removeAttribute('aria-disabled');
            }
        }
    },

    bindPager: function () {
        if (AjaxComment.pagerHandler) {
            return;
        }

        AjaxComment.pagerHandler = function (event) {
            var target = event.target && event.target.nodeType === 3
                ? event.target.parentElement : event.target;
            var pager = target && typeof target.closest === 'function'
                ? target.closest(AjaxComment.commentPager) : null;
            var href;

            if (!pager || (document.documentElement
                && typeof document.documentElement.contains === 'function'
                && !document.documentElement.contains(pager))) {
                return;
            }

            if (event.defaultPrevented
                || (typeof event.button === 'number' && event.button !== 0)
                || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            href = pager.href || pager.getAttribute('href');

            if (!window.VoidPjax || typeof window.VoidPjax.visit !== 'function' || !href) {
                return;
            }

            event.preventDefault();
            if (pager.getAttribute('aria-disabled') === 'true') {
                return;
            }
            window.VoidPjax.visit({
                url: href,
                container: '#comments',
                fragment: '#comments',
                timeout: 8000,
                scrollTop: false,
                push: true,
                target: pager
            });
        };
        document.addEventListener('click', AjaxComment.pagerHandler);
    },

    unbindPager: function () {
        if (!AjaxComment.pagerHandler) {
            return;
        }
        document.removeEventListener('click', AjaxComment.pagerHandler);
        AjaxComment.pagerHandler = null;
    },

    afterPagePjax: function (options) {
        VOID_Content.parseUrl();
        VOID_Content.highlight();
        VOID_Vote.reload();
        VOID.initEmotes();
        AjaxComment.init();
        if (options && options.fromPopstate && AjaxComment.getHashCommentSelector()) {
            VOID_Ui.checkScrollTop({ ignoreSavedPosition: true });
        }
    },

    endPagePjax: function () {
        AjaxComment.setCommentPageLoading(false);
    },

    resolveCommentTarget: function (trigger) {
        var comment = trigger && typeof trigger.closest === 'function'
            ? trigger.closest('[data-comment-id], .comment-body[id]') : null;
        if (!comment) {
            return '';
        }

        return comment.getAttribute('data-comment-id') || comment.id || '';
    },

    getReplyText: function (trigger, attrName, fallback) {
        var value;

        if (!trigger) {
            return fallback;
        }

        value = String(trigger.getAttribute(attrName) || '').trim();
        return value || fallback;
    },

    resolveReplyTrigger: function (matcher) {
        var triggers = document.querySelectorAll(AjaxComment.commentReply + ' a');

        if (typeof matcher !== 'function') {
            return null;
        }

        for (var i = 0; i < triggers.length; i++) {
            if (matcher(triggers[i])) {
                return triggers[i];
            }
        }
        return null;
    },

    findReplyTriggerByCommentId: function (commentId) {
        commentId = String(commentId || '');
        if (!commentId) {
            return null;
        }

        return AjaxComment.resolveReplyTrigger(function (trigger) {
            return String(trigger.getAttribute('data-comment-id') || '') === commentId;
        });
    },

    findReplyTriggerByCoid: function (coid) {
        coid = String(coid || '');
        if (!coid) {
            return null;
        }

        return AjaxComment.resolveReplyTrigger(function (trigger) {
            return String(trigger.getAttribute('data-comment-coid') || '') === coid;
        });
    },

    setReplyTriggerState: function (trigger, isActive) {
        var replyWord;
        var cancelWord;

        if (!trigger) {
            return;
        }

        replyWord = AjaxComment.getReplyText(trigger, 'data-reply-word', AjaxComment.replyWord);
        cancelWord = AjaxComment.getReplyText(trigger, 'data-cancel-word', AjaxComment.cancelReplyWord);

        trigger.textContent = isActive ? cancelWord : replyWord;
        trigger.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        trigger.setAttribute('data-reply-state', isActive ? 'active' : 'idle');
        trigger.classList.toggle('is-reply-active', isActive);
    },

    resetReplyTriggerState: function () {
        var activeTrigger = AjaxComment.findReplyTriggerByCommentId(AjaxComment.activeReplyCommentId);

        if (activeTrigger) {
            AjaxComment.setReplyTriggerState(activeTrigger, false);
        }

        AjaxComment.activeReplyCommentId = '';
        AjaxComment.activeReplyCoid = '';
        AjaxComment.parentID = '';
    },

    activateReplyTrigger: function (trigger, commentId, coid) {
        if (!trigger) {
            AjaxComment.resetReplyTriggerState();
            return;
        }

        if (AjaxComment.activeReplyCommentId && AjaxComment.activeReplyCommentId !== String(commentId || '')) {
            AjaxComment.setReplyTriggerState(
                AjaxComment.findReplyTriggerByCommentId(AjaxComment.activeReplyCommentId),
                false
            );
        }

        commentId = String(commentId || '');
        coid = String(coid || '');

        AjaxComment.setReplyTriggerState(trigger, true);
        AjaxComment.activeReplyCommentId = commentId;
        AjaxComment.activeReplyCoid = coid;
        AjaxComment.parentID = commentId;
    },

    getHashCommentSelector: function () {
        var hash = window.location.hash || '';

        if (!/^#comment-\d+$/.test(hash)) {
            return '';
        }

        return hash;
    },

    getHashCommentId: function () {
        var selector = AjaxComment.getHashCommentSelector();

        return selector ? selector.replace(/^#comment-/, '') : '';
    },

    syncThreadFocusFromHash: function () {
        var hashCommentId = AjaxComment.getHashCommentId();

        if (hashCommentId) {
            AjaxComment.threadFocusPendingId = hashCommentId;
        }

        AjaxComment.applyThreadPanels();
    },

    bindHashChange: function () {
        if (AjaxComment.hashChangeHandler) {
            return;
        }

        AjaxComment.hashChangeHandler = function () {
            AjaxComment.syncThreadFocusFromHash();
            VOID_Ui.checkScrollTop({ ignoreSavedPosition: true });
        };
        window.addEventListener('hashchange', AjaxComment.hashChangeHandler);
    },

    unbindHashChange: function () {
        if (!AjaxComment.hashChangeHandler) {
            return;
        }
        window.removeEventListener('hashchange', AjaxComment.hashChangeHandler);
        AjaxComment.hashChangeHandler = null;
    },

    getReplyToFromLocation: function () {
        var query = window.location.search || '';
        var matched = query.match(/[?&]replyTo=(\d+)/);

        return matched ? matched[1] : '';
    },

    getCurrentReplyCoid: function () {
        var form = document.querySelector(AjaxComment.commentForm);
        var parent = form ? form.querySelector('input[name="parent"]') : null;
        var parentValue = parent ? String(parent.value || '').trim() : '';
        var cancel;

        if (parentValue) {
            return parentValue;
        }

        cancel = document.getElementById('cancel-comment-reply-link');
        if (AjaxComment.isElementVisible(cancel)) {
            return AjaxComment.getReplyToFromLocation();
        }

        return '';
    },

    isElementVisible: function (element) {
        if (!element || element.hidden || (element.style && element.style.display === 'none')) {
            return false;
        }
        if (typeof element.getClientRects === 'function') {
            return element.getClientRects().length > 0;
        }
        return true;
    },

    syncReplyTriggerState: function () {
        var coid = AjaxComment.getCurrentReplyCoid();
        var trigger;
        var commentId;

        if (!coid) {
            AjaxComment.resetReplyTriggerState();
            return;
        }

        trigger = AjaxComment.findReplyTriggerByCoid(coid);
        if (!trigger) {
            AjaxComment.resetReplyTriggerState();
            return;
        }

        commentId = String(trigger.getAttribute('data-comment-id') || AjaxComment.resolveCommentTarget(trigger));
        AjaxComment.activateReplyTrigger(trigger, commentId, coid);
    },

    handleReplyClick: function (commentId, coid, trigger) {
        var nextCommentId = String(commentId || AjaxComment.resolveCommentTarget(trigger));
        var nextCoid = String(coid || (trigger ? trigger.getAttribute('data-comment-coid') : '') || '');
        var currentCoid = AjaxComment.getCurrentReplyCoid();

        if (AjaxComment.activeReplyCommentId === nextCommentId && currentCoid === nextCoid) {
            return AjaxComment.cancelActiveReply();
        }

        if (AjaxComment.moveReplyForm(nextCommentId, nextCoid, trigger)) {
            return true;
        }
        AjaxComment.activateReplyTrigger(trigger, nextCommentId, nextCoid);
        return false;
    },

    cancelActiveReply: function () {
        var activeTrigger = AjaxComment.findReplyTriggerByCommentId(AjaxComment.activeReplyCommentId);

        AjaxComment.restoreReplyForm();
        AjaxComment.resetReplyTriggerState();
        if (activeTrigger) {
            AjaxComment.focusWithoutScroll(activeTrigger);
        }
        return false;
    },

    bindClick: function () {
        var triggers = document.querySelectorAll(AjaxComment.commentReply + ' a');
        var trigger;

        for (var i = 0; i < triggers.length; i++) {
            trigger = triggers[i];
            if (!trigger.getAttribute('data-reply-word')) {
                trigger.setAttribute('data-reply-word', String(trigger.textContent || '').trim() || AjaxComment.replyWord);
            }

            if (!trigger.getAttribute('data-cancel-word')) {
                trigger.setAttribute('data-cancel-word', AjaxComment.cancelReplyWord);
            }

            AjaxComment.setReplyTriggerState(trigger, false);
        }

        AjaxComment.syncReplyTriggerState();
    },

    collectThreadItems: function (children) {
        var items = [];

        var walk = function (container) {
            var list = AjaxComment.getDirectElement(container, '.comment-list');
            var comments;
            var nested;

            if (!list) {
                return;
            }

            comments = AjaxComment.getDirectElements(list, '.comment-body');
            for (var i = 0; i < comments.length; i++) {
                nested = AjaxComment.getDirectElement(comments[i], '.comment-children');
                if (nested) {
                    comments[i].removeChild(nested);
                }
                items.push(comments[i]);

                if (nested) {
                    walk(nested);
                }
            }
        };

        walk(children);
        return items;
    },

    ensureThreadPanel: function (children) {
        var list;
        var items;

        if (!children) {
            return null;
        }

        list = AjaxComment.getDirectElement(children, '.comment-list');
        if (!children.classList.contains('comment-thread-panel')) {
            items = AjaxComment.collectThreadItems(children);
            if (items.length === 0) {
                return null;
            }

            while (children.firstChild) {
                children.removeChild(children.firstChild);
            }
            children.classList.add('comment-thread-panel');
            list = document.createElement('div');
            list.className = 'comment-list comment-thread-list';

            for (var i = 0; i < items.length; i++) {
                items[i].classList.add('comment-thread-item');
                items[i].setAttribute('data-thread-index', i);
                list.appendChild(items[i]);
            }

            children.appendChild(list);
            AjaxComment.bindThreadPanel(children);
            return list;
        }

        if (!list) {
            list = document.createElement('div');
            list.className = 'comment-list comment-thread-list';
            children.appendChild(list);
        }

        list.classList.add('comment-thread-list');
        items = AjaxComment.getDirectElements(list, '.comment-body');
        for (var index = 0; index < items.length; index++) {
            items[index].classList.add('comment-thread-item');
            items[index].setAttribute('data-thread-index', index);
        }

        AjaxComment.bindThreadPanel(children);
        return list;
    },

    insertReplyComment: function (comment) {
        var parentCoid = comment ? String(comment.getAttribute('data-comment-parent') || '') : '';
        var parent = parentCoid ? document.getElementById('comment-' + parentCoid) : null;
        var root;
        var children;
        var list;
        var cursor;
        var next;
        var parentDepth;

        if (!parent) {
            return false;
        }

        root = parent.classList.contains('comment-parent') ? parent : parent.closest('.comment-parent');
        if (!root) {
            return false;
        }

        children = AjaxComment.getDirectElement(root, '.comment-children');
        if (!children) {
            children = document.createElement('div');
            children.className = 'comment-children comment-thread-panel';
            children.setAttribute('data-thread-expanded', 'false');
            list = document.createElement('div');
            list.className = 'comment-list comment-thread-list';
            children.appendChild(list);
            root.appendChild(children);
            AjaxComment.bindThreadPanel(children);
        } else {
            list = AjaxComment.ensureThreadPanel(children);
        }

        if (!list) {
            return false;
        }

        if (parent.classList.contains('comment-parent')) {
            AjaxComment.insertNewestComment(list, comment);
            return true;
        }

        if (AjaxComment.getCommentsOrder() === 'DESC') {
            parent.parentNode.insertBefore(comment, parent.nextSibling);
            return true;
        }

        parentDepth = AjaxComment.getCommentDepth(parent);
        cursor = parent;
        next = cursor.nextElementSibling;
        while (next && next.matches('.comment-body') && AjaxComment.getCommentDepth(next) > parentDepth) {
            cursor = next;
            next = cursor.nextElementSibling;
        }
        cursor.parentNode.insertBefore(comment, cursor.nextSibling);
        return true;
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

    resolveThreadFocusState: function (totalItems, currentPage, isExpanded, focusIndex, isParentFocus) {
        var canCollapse = totalItems > AjaxComment.threadPreviewSize;
        var shouldPaginate = totalItems > AjaxComment.threadPaginationThreshold;
        var preferredPage = focusIndex >= 0 && shouldPaginate
            ? Math.ceil((focusIndex + 1) / AjaxComment.threadPageSize)
            : 1;

        if (!canCollapse) {
            isExpanded = true;
        } else if (isParentFocus) {
            isExpanded = false;
            currentPage = 1;
        } else if (focusIndex >= 0) {
            if (focusIndex >= AjaxComment.threadPreviewSize) {
                isExpanded = true;
            }
            if (isExpanded) {
                currentPage = preferredPage;
            } else {
                currentPage = 1;
            }
        }

        return {
            currentPage: currentPage,
            handled: isParentFocus || focusIndex >= 0,
            isExpanded: isExpanded
        };
    },

    getThreadPanelId: function (children) {
        var parentId = children && children.parentElement
            ? String(children.parentElement.id || '').replace(/^comment-/, '') : '';
        var panelId = parentId ? 'comment-thread-' + parentId : '';

        if (panelId) {
            children.setAttribute('id', panelId);
        }
        return panelId;
    },

    focusThreadControl: function (children, selector) {
        var control = children ? children.querySelector(selector) : null;

        AjaxComment.focusWithoutScroll(control);
    },

    updateThreadLayout: function (children, callback, options) {
        var root = children ? children.parentElement : null;
        AjaxComment.preserveLayout(root, callback, options);
    },

    createThreadButton: function (className, text, page) {
        var button = document.createElement('button');

        button.type = 'button';
        button.className = className;
        button.textContent = text;
        if (page !== undefined) {
            button.setAttribute('data-thread-page', page);
        }
        return button;
    },

    bindThreadPanel: function (children) {
        if (!children || children.__voidThreadHandler) {
            return;
        }

        children.__voidThreadHandler = function (event) {
            var target = event.target && event.target.nodeType === 3
                ? event.target.parentElement : event.target;
            var button = target && typeof target.closest === 'function'
                ? target.closest('button') : null;
            var targetPage;
            var currentPage;

            if (!button || !children.contains(button)) {
                return;
            }

            if (button.classList.contains('comment-thread-expand')) {
                currentPage = parseInt(children.getAttribute('data-thread-page'), 10) || 1;
                AjaxComment.updateThreadLayout(children, function () {
                    children.setAttribute('data-thread-expanded', 'true');
                    AjaxComment.renderThreadPage(children, currentPage);
                    AjaxComment.focusThreadControl(children, '.comment-thread-collapse');
                });
                return;
            }

            if (button.hasAttribute('data-thread-page')) {
                targetPage = parseInt(button.getAttribute('data-thread-page'), 10);
                AjaxComment.updateThreadLayout(children, function () {
                    AjaxComment.renderThreadPage(children, targetPage);
                    AjaxComment.focusThreadControl(children, '.comment-thread-page.is-active');
                });
                return;
            }

            if (button.classList.contains('comment-thread-collapse')) {
                AjaxComment.updateThreadLayout(children, function () {
                    children.setAttribute('data-thread-expanded', 'false');
                    AjaxComment.renderThreadPage(children, 1);
                    AjaxComment.focusThreadControl(children, '.comment-thread-expand');
                }, { trackFrames: false });
            }
        };
        children.addEventListener('click', children.__voidThreadHandler);
    },

    renderThreadFooter: function (children, totalItems, currentPage, totalPages, shouldPaginate) {
        var list = AjaxComment.getDirectElement(children, '.comment-thread-list');
        var footer = AjaxComment.getDirectElement(list, '.comment-thread-footer');
        var pagination;
        var pages;
        var button;
        var isExpanded = children.getAttribute('data-thread-expanded') === 'true';
        var panelId = AjaxComment.getThreadPanelId(children);

        if (!footer) {
            footer = document.createElement('div');
            footer.className = 'comment-thread-footer';
            list.appendChild(footer);
        }

        while (footer.firstChild) {
            footer.removeChild(footer.firstChild);
        }
        if (!isExpanded) {
            button = AjaxComment.createThreadButton(
                'comment-thread-expand',
                '查看全部 ' + totalItems + ' 条回复'
            );
            button.setAttribute('aria-expanded', 'false');
            if (panelId) button.setAttribute('aria-controls', panelId);
            footer.classList.remove('is-collapsed');
            footer.classList.add('is-thread-footer-collapsed');
            footer.appendChild(button);
            return;
        }

        footer.classList.remove('is-collapsed', 'is-thread-footer-collapsed');
        var total = document.createElement('span');
        total.className = 'comment-thread-total';
        total.textContent = '共 ' + totalItems + ' 条回复';
        footer.appendChild(total);
        pagination = document.createElement('div');
        pagination.className = 'comment-thread-pagination';

        if (shouldPaginate) {
            pages = AjaxComment.buildThreadPages(currentPage, totalPages);

            if (currentPage > 1) {
                pagination.appendChild(AjaxComment.createThreadButton(
                    'comment-thread-prev', '上一页', currentPage - 1
                ));
            }

            for (var i = 0; i < pages.length; i++) {
                var page = pages[i];
                if (page === 'ellipsis') {
                    var ellipsis = document.createElement('span');
                    ellipsis.className = 'comment-thread-ellipsis';
                    ellipsis.textContent = '...';
                    pagination.appendChild(ellipsis);
                    continue;
                }

                button = AjaxComment.createThreadButton('comment-thread-page', page, page);

                if (page === currentPage) {
                    button.classList.add('is-active');
                    button.setAttribute('aria-current', 'page');
                }

                pagination.appendChild(button);
            }

            if (currentPage < totalPages) {
                pagination.appendChild(AjaxComment.createThreadButton(
                    'comment-thread-next', '下一页', currentPage + 1
                ));
            }
        }

        button = AjaxComment.createThreadButton('comment-thread-collapse', '收起');
        button.setAttribute('aria-expanded', 'true');
        if (panelId) button.setAttribute('aria-controls', panelId);
        pagination.appendChild(button);
        footer.appendChild(pagination);
    },

    renderThreadPage: function (children, targetPage) {
        var list = AjaxComment.getDirectElement(children, '.comment-thread-list');
        var items = AjaxComment.getDirectElements(list, '.comment-thread-item');
        var focusCommentId = String(AjaxComment.threadFocusPendingId || '');
        var parentCommentId = children.parentElement
            ? String(children.parentElement.id || '').replace(/^comment-/, '') : '';
        var focusComment = focusCommentId && document.getElementById
            ? document.getElementById('comment-' + focusCommentId) : null;
        var totalItems = items.length;
        var previewSize = AjaxComment.threadPreviewSize;
        var pageSize = AjaxComment.threadPageSize;
        var paginationThreshold = AjaxComment.threadPaginationThreshold;
        var canCollapseThread = totalItems > previewSize;
        var shouldPaginate = totalItems > paginationThreshold;
        var totalPages = shouldPaginate ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
        var shouldShowThreadFooter = canCollapseThread;
        var currentPage = targetPage || parseInt(children.getAttribute('data-thread-page'), 10) || 1;
        var isExpanded = children.getAttribute('data-thread-expanded') === 'true';
        var isParentFocus = !!focusCommentId && focusCommentId === parentCommentId;
        var focusIndex = focusComment && children.contains(focusComment) ? items.indexOf(focusComment) : -1;
        var focusState = AjaxComment.resolveThreadFocusState(
            totalItems,
            currentPage,
            isExpanded,
            focusIndex,
            isParentFocus
        );
        var startIndex;
        var endIndex;

        isExpanded = focusState.isExpanded;
        currentPage = focusState.currentPage;
        if (focusState.handled) {
            AjaxComment.threadFocusPendingId = '';
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

        children.setAttribute('data-thread-page', currentPage);
        children.setAttribute('data-thread-expanded', isExpanded ? 'true' : 'false');
        children.classList.toggle('is-thread-expanded', isExpanded);
        children.classList.toggle('is-thread-collapsed', canCollapseThread && !isExpanded);
        children.classList.toggle('no-thread-footer', !shouldShowThreadFooter);

        for (var i = 0; i < items.length; i++) {
            items[i].setAttribute('data-thread-index', i);
            items[i].classList.toggle('is-thread-hidden', i < startIndex || i >= endIndex);
        }

        if (!shouldShowThreadFooter) {
            var footer = AjaxComment.getDirectElement(list, '.comment-thread-footer');
            if (footer) {
                list.removeChild(footer);
            }
            return;
        }

        AjaxComment.renderThreadFooter(children, totalItems, currentPage, totalPages, shouldPaginate);
    },

    applyThreadPanels: function () {
        var parents = document.querySelectorAll('#comments > .comment-list > .comment-body.comment-parent');
        var children;
        var list;

        for (var i = 0; i < parents.length; i++) {
            children = AjaxComment.getDirectElement(parents[i], '.comment-children');
            if (!children) {
                continue;
            }

            list = AjaxComment.ensureThreadPanel(children);
            if (!list) {
                continue;
            }

            if (!children.getAttribute('data-thread-expanded')) {
                children.setAttribute('data-thread-expanded', 'false');
            }
            AjaxComment.renderThreadPage(children);
        }

        AjaxComment.threadFocusPendingId = '';
    },

    getSubmitButton: function (form) {
        return form ? form.querySelector(AjaxComment.submitBtn) : null;
    },

    setSubmitState: function (form, isSubmitting) {
        var submit = AjaxComment.getSubmitButton(form);

        if (!submit) {
            return;
        }
        submit.textContent = isSubmitting ? '提交中' : '提交评论';
        submit.disabled = isSubmitting;
    },

    validateCommentForm: function (form) {
        var author = form ? form.querySelector('#author') : null;
        var mail = form ? form.querySelector('#mail') : null;
        var url = form ? form.querySelector('#url') : null;
        var textarea = form ? form.querySelector(AjaxComment.textarea) : null;
        var filter = /^[^@\s<&>]+@([a-z0-9]+\.)+[a-z]{2,4}$/i;

        if (author) {
            if (String(author.value || '').trim() === '') {
                return AjaxComment.noName;
            }
            if (mail && mail.hasAttribute('required') && String(mail.value || '').trim() === '') {
                return AjaxComment.noMail;
            }
            if (mail && String(mail.value || '').trim() !== '' && !filter.test(String(mail.value).trim())) {
                return AjaxComment.invalidMail;
            }
            if (url && url.hasAttribute('required') && String(url.value || '').trim() === '') {
                return AjaxComment.noUrl;
            }
        }

        if (!textarea || String(textarea.value || '').trim() === '') {
            return AjaxComment.noContent;
        }
        return '';
    },

    buildSubmitBody: function (form) {
        var formData = new FormData(form);
        var body = new URLSearchParams();

        formData.forEach(function (value, name) {
            body.append(name, typeof value === 'string' ? value : value.name);
        });
        return body;
    },

    parseCommentResponse: function (html) {
        var parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');

        if (!parsed || typeof parsed.querySelector !== 'function'
            || parsed.querySelector('parsererror')) {
            throw new Error('Invalid comment response');
        }
        return parsed;
    },

    normalizeResponseText: function (value) {
        return String(value || '').replace(/\r/g, '').split('\n').map(function (line) {
            return line.trim();
        }).filter(function (line) {
            return line !== '';
        }).join('\n').slice(0, 500);
    },

    getResponseError: function (parsed) {
        var selectors = ['body .container', 'body [role="alert"]', 'body main', 'body'];
        var target;

        for (var i = 0; i < selectors.length; i++) {
            target = parsed.querySelector(selectors[i]);
            if (target) {
                var message = AjaxComment.normalizeResponseText(target.textContent);
                if (message) {
                    return message;
                }
            }
        }
        return '';
    },

    getCurrentCommentIds: function () {
        var nodes = document.querySelectorAll('#comments [id^="comment-"]');
        var ids = [];

        for (var i = 0; i < nodes.length; i++) {
            if (/^comment-\d+$/.test(String(nodes[i].id || ''))) {
                ids.push(nodes[i].id);
            }
        }
        return ids;
    },

    getResponseCommentId: function (parsed, responseUrl, existingIds) {
        var matched = String(responseUrl || '').match(/#comment-(\d+)$/);
        var comments;
        var newest = 0;
        var known = {};

        for (var knownIndex = 0; existingIds && knownIndex < existingIds.length; knownIndex++) {
            known[String(existingIds[knownIndex])] = true;
        }

        if (matched && parsed.getElementById('comment-' + matched[1])
            && !known['comment-' + matched[1]]) {
            return matched[1];
        }

        comments = parsed.querySelectorAll('#comments [id^="comment-"]');
        for (var i = 0; i < comments.length; i++) {
            matched = String(comments[i].id || '').match(/^comment-(\d+)$/);
            if (matched && !known[comments[i].id]) {
                newest = Math.max(newest, parseInt(matched[1], 10));
            }
        }
        return newest ? String(newest) : '';
    },

    ensureCommentList: function () {
        var comments = document.querySelector('#comments');
        var list = document.querySelector('#comments > .comment-list');
        var separator;
        var tab;
        var count;
        var number;

        if (list || !comments) {
            return list;
        }

        separator = comments.querySelector('.comment-separator');
        if (!separator) {
            separator = document.createElement('h3');
            separator.className = 'comment-separator';
            tab = document.createElement('div');
            tab.className = 'comment-tab-current';
            count = document.createElement('span');
            count.className = 'comment-num';
            count.appendChild(document.createTextNode('已有 '));
            number = document.createElement('span');
            number.className = 'num';
            number.textContent = '0';
            count.appendChild(number);
            count.appendChild(document.createTextNode(' 条评论'));
            tab.appendChild(count);
            separator.appendChild(tab);
            comments.appendChild(separator);
        }

        count = separator.querySelector('.comment-num');
        number = count ? count.querySelector('.num') : null;
        if (count && !number) {
            while (count.firstChild) {
                count.removeChild(count.firstChild);
            }
            count.appendChild(document.createTextNode('已有 '));
            number = document.createElement('span');
            number.className = 'num';
            number.textContent = '0';
            count.appendChild(number);
            count.appendChild(document.createTextNode(' 条评论'));
        }

        list = document.createElement('div');
        list.className = 'comment-list';
        comments.appendChild(list);
        return list;
    },

    revealComment: function (comment) {
        var reducedMotion = window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!comment || !comment.style) {
            return;
        }
        if (reducedMotion || typeof window.requestAnimationFrame !== 'function') {
            comment.style.opacity = '1';
            return;
        }

        comment.style.transition = 'opacity 500ms';
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                comment.style.opacity = '1';
            });
        });
    },

    isCurrentSubmit: function (form, token, generation) {
        return AjaxComment.submitForm === form
            && AjaxComment.submitToken === token
            && AjaxComment.submitGeneration === generation
            && (!document.documentElement
                || typeof document.documentElement.contains !== 'function'
                || document.documentElement.contains(form));
    },

    releaseSubmit: function (token, generation) {
        if (AjaxComment.submitToken !== token || AjaxComment.submitGeneration !== generation) {
            return;
        }
        AjaxComment.submitToken = null;
        AjaxComment.submitController = null;
    },

    cancelSubmit: function () {
        var form = AjaxComment.submitForm;
        var controller = AjaxComment.submitController;

        AjaxComment.submitGeneration += 1;
        AjaxComment.submitToken = null;
        AjaxComment.submitController = null;
        if (controller && typeof controller.abort === 'function') {
            controller.abort();
        }
        AjaxComment.setSubmitState(form, false);
    },

    unbindSubmit: function () {
        var form = AjaxComment.submitForm;

        AjaxComment.cancelSubmit();
        if (form && AjaxComment.submitHandler) {
            form.removeEventListener('submit', AjaxComment.submitHandler);
        }
        AjaxComment.submitForm = null;
        AjaxComment.submitHandler = null;
    },

    err: function (form) {
        var submit = AjaxComment.getSubmitButton(form || AjaxComment.submitForm);

        if (submit) {
            submit.textContent = '提交评论';
            submit.disabled = false;
        }
        AjaxComment.newID = '';
    },

    finish: function (form, token) {
        var newCommentId = AjaxComment.newID;
        var submit = AjaxComment.getSubmitButton(form || AjaxComment.submitForm);
        var textarea = form ? form.querySelector(AjaxComment.textarea) : document.querySelector(AjaxComment.textarea);
        var commentCount = document.querySelector('.comment-num .num');
        var newComment = newCommentId ? document.getElementById('comment-' + newCommentId) : null;
        var submittedParentCoid = token ? String(token.parentCoid || '') : '';
        var submittedText = token ? String(token.text || '') : '';
        var currentParentCoid = AjaxComment.getCurrentReplyCoid();
        var canResetComposer = !!textarea
            && String(textarea.value || '') === submittedText
            && currentParentCoid === submittedParentCoid;
        var count;

        if (submit) {
            submit.textContent = '提交评论';
            submit.disabled = false;
        }
        if (canResetComposer) {
            textarea.value = '';
            if (submittedParentCoid) {
                AjaxComment.cancelActiveReply();
            }
        }
        if (commentCount) {
            count = parseInt(commentCount.textContent, 10);
            if (!isNaN(count)) {
                commentCount.textContent = count + 1;
            }
        }
        AjaxComment.threadFocusPendingId = newCommentId;
        AjaxComment.bindClick();
        AjaxComment.applyThreadPanels();
        if (newComment) {
            VOID_Ui.scrollToWithHeader('#comment-' + newCommentId, 0, {
                behavior: 'smooth',
                stabilize: true
            });
        }
        VOID_Content.highlight();
        VOID.initEmoteContent();
    },

    failSubmit: function (form, message) {
        VOID.alert('提交失败！请重试。' + (message ? '\n' + message : ''));
        AjaxComment.err(form);
    },

    applySubmitResponse: function (response, html, form, token, generation) {
        var parsed = AjaxComment.parseCommentResponse(html);
        var responseList;
        var newCommentId;
        var responseComment;
        var newComment;
        var currentList;

        if (!AjaxComment.isCurrentSubmit(form, token, generation)) {
            return;
        }
        if (!response.ok) {
            AjaxComment.failSubmit(form, AjaxComment.getResponseError(parsed));
            return;
        }

        responseList = parsed.querySelector('#comments .comment-list');
        if (!responseList) {
            AjaxComment.failSubmit(form, '');
            return;
        }

        newCommentId = AjaxComment.getResponseCommentId(parsed, response.url, token.commentIds);
        responseComment = newCommentId ? parsed.getElementById('comment-' + newCommentId) : null;
        if (!newCommentId || !responseComment) {
            AjaxComment.failSubmit(form, '');
            return;
        }
        AjaxComment.newID = newCommentId;

        if (!AjaxComment.isNewestCommentPage() && !token.parentCoid) {
            VOID.alert(AjaxComment.getCommentsOrder() === 'ASC'
                ? '评论成功！请前往评论最后一页查看。'
                : '评论成功！请回到评论第一页查看。');
            AjaxComment.newID = '';
            AjaxComment.finish(form, token);
            return;
        }

        newComment = typeof document.importNode === 'function'
            ? document.importNode(responseComment, true) : responseComment;
        newComment.style.opacity = '0';
        if (!token.parentCoid) {
            currentList = AjaxComment.ensureCommentList();
            if (!currentList) {
                AjaxComment.failSubmit(form, '');
                return;
            }
            AjaxComment.insertNewestComment(currentList, newComment);
        } else if (!AjaxComment.insertReplyComment(newComment)) {
            AjaxComment.failSubmit(form, '');
            return;
        }

        AjaxComment.revealComment(newComment);
        VOID.alert('评论成功！');
        AjaxComment.finish(form, token);
        AjaxComment.newID = '';
    },

    submitComment: function (form) {
        var validationMessage;
        var body;
        var token;
        var generation;
        var controller;
        var requestOptions;

        if (!form || AjaxComment.submitToken) {
            return false;
        }

        AjaxComment.setSubmitState(form, true);
        validationMessage = AjaxComment.validateCommentForm(form);
        if (validationMessage) {
            VOID.alert(validationMessage);
            AjaxComment.err(form);
            return false;
        }

        try {
            body = AjaxComment.buildSubmitBody(form);
        } catch (error) {
            AjaxComment.failSubmit(form, '');
            return false;
        }

        token = {
            commentIds: AjaxComment.getCurrentCommentIds(),
            parentCoid: String(body.get('parent') || '').trim(),
            text: String((form.querySelector(AjaxComment.textarea) || {}).value || '')
        };
        generation = AjaxComment.submitGeneration + 1;
        controller = typeof AbortController === 'function' ? new AbortController() : null;
        AjaxComment.submitGeneration = generation;
        AjaxComment.submitToken = token;
        AjaxComment.submitController = controller;
        requestOptions = {
            method: String(form.getAttribute('method') || 'post').toUpperCase(),
            body: body,
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            }
        };
        if (controller) {
            requestOptions.signal = controller.signal;
        }

        fetch(form.getAttribute('action'), requestOptions).then(function (response) {
            return response.text().then(function (html) {
                return { response: response, html: html };
            });
        }).then(function (result) {
            if (!AjaxComment.isCurrentSubmit(form, token, generation)) {
                AjaxComment.releaseSubmit(token, generation);
                return;
            }
            try {
                AjaxComment.applySubmitResponse(result.response, result.html, form, token, generation);
            } catch (error) {
                AjaxComment.failSubmit(form, '');
            }
            AjaxComment.releaseSubmit(token, generation);
        }).catch(function (error) {
            if (!AjaxComment.isCurrentSubmit(form, token, generation)) {
                AjaxComment.releaseSubmit(token, generation);
                return;
            }
            if (!error || error.name !== 'AbortError') {
                AjaxComment.failSubmit(form, '');
            } else {
                AjaxComment.err(form);
            }
            AjaxComment.releaseSubmit(token, generation);
        });
        return false;
    },

    bindSubmit: function () {
        var form = document.querySelector(AjaxComment.commentForm);

        if (AjaxComment.submitForm === form && AjaxComment.submitHandler) {
            return;
        }
        if (AjaxComment.submitForm || AjaxComment.submitHandler) {
            AjaxComment.unbindSubmit();
        }
        if (!form) {
            return;
        }

        AjaxComment.submitForm = form;
        AjaxComment.submitHandler = function (event) {
            event.preventDefault();
            AjaxComment.submitComment(form);
        };
        form.addEventListener('submit', AjaxComment.submitHandler);
    },

    init: function () {
        AjaxComment.ensureTypechoCommentFacade();
        AjaxComment.bindPager();
        AjaxComment.bindHashChange();
        AjaxComment.bindClick();
        AjaxComment.syncThreadFocusFromHash();
        AjaxComment.bindSubmit();
    }
};

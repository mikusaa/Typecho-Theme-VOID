/* eslint-disable no-undef */

TOC = {
    toggle: function () {
        if (document.body) {
            document.body.classList.toggle('sidebar-show');
        }
    },

    close: function () {
        if (document.body) {
            document.body.classList.remove('sidebar-show');
        }
    },

    open: function () {
        if (document.body) {
            document.body.classList.add('sidebar-show');
        }
    }
};

VOID_Util = {
    throttle: function (fn, delay, atleast) {
        var timer = null;
        var previous = null;
    
        return function () {
            var now = +new Date();
    
            if ( !previous ) previous = now;
    
            if ( now - previous > atleast ) {
                fn();
                // 重置上一次开始时间为本次结束时间
                previous = now;
            } else {
                clearTimeout(timer);
                timer = setTimeout(function() {
                    fn();
                }, delay);
            }
        };
    },

    clickIn: function (e, el) {
        var element = typeof el === 'string' ? document.querySelector(el) : el;

        if (!element || !e) return false;
        return element === e.target || element.contains(e.target);
    },

    getContentHeight: function (element) {
        var height;
        var style;

        if (!element || typeof element.getBoundingClientRect !== 'function') return 0;
        height = element.getBoundingClientRect().height || 0;
        if (typeof window.getComputedStyle !== 'function') return height;
        style = window.getComputedStyle(element);
        return Math.max(0, height
            - (parseFloat(style.paddingTop) || 0)
            - (parseFloat(style.paddingBottom) || 0)
            - (parseFloat(style.borderTopWidth) || 0)
            - (parseFloat(style.borderBottomWidth) || 0));
    },

    getHashTarget: function (hash) {
        if (typeof(hash) != 'string' || hash == '' || hash == '#') return null;
        var id = hash.charAt(0) == '#' ? hash.slice(1) : hash;
        if (id == '') return null;
        try {
            id = decodeURIComponent(id);
        } catch (err) {
            console.log(err);
        }
        return document.getElementById(id);
    },

    setCookie: function (name, value, time) {
        if (time > 0) {
            document.cookie = name + '=' + escape(value) + ';max-age=' + String(time) + ';path=/';
        } else {
            // session
            document.cookie = name + '=' + escape(value) + ';path=/';
        }
    },

    removeCookie: function (name) {
        document.cookie = name + '=;max-age=0;path=/';
    },

    getCookie: function (name) {
        var reg = new RegExp('(^| )' + name + '=([^;]*)(;|$)');
        var arr = document.cookie.match(reg);
        if (arr)
            return unescape(arr[2]);
        else
            return null;
    }
};

VOID_CardCover = {
    marker: 'data-void-card-cover',
    bound: false,
    nextToken: 0,

    isCover: function (image) {
        return image
            && image.hasAttribute
            && image.hasAttribute(VOID_CardCover.marker);
    },

    canWrite: function (image, token) {
        return VOID_CardCover.isCover(image)
            && image.isConnected !== false
            && image.__voidCardCoverToken === token;
    },

    reducedMotion: function () {
        return window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    fail: function (image) {
        var token;

        if (!VOID_CardCover.isCover(image) || image.isConnected === false) {
            return;
        }

        token = ++VOID_CardCover.nextToken;
        image.__voidCardCoverToken = token;
        image.__voidCardCoverPending = false;
        image.classList.remove('loaded');
        image.classList.add('error');
    },

    reveal: function (image, token) {
        var finish = function () {
            if (!VOID_CardCover.canWrite(image, token)) {
                return;
            }
            image.__voidCardCoverPending = false;
            image.classList.add('loaded');
        };

        if (!VOID_CardCover.canWrite(image, token)) {
            return;
        }

        if (VOID_CardCover.reducedMotion() || typeof window.requestAnimationFrame !== 'function') {
            finish();
            return;
        }

        window.requestAnimationFrame(function () {
            if (!VOID_CardCover.canWrite(image, token)) {
                return;
            }
            window.requestAnimationFrame(finish);
        });
    },

    decode: function (image) {
        var decodeResult;
        var token;
        var settle;

        if (!VOID_CardCover.isCover(image)
            || image.isConnected === false
            || image.classList.contains('loaded')
            || image.classList.contains('error')
            || image.__voidCardCoverPending) {
            return;
        }

        if (!(image.naturalWidth > 0)) {
            VOID_CardCover.fail(image);
            return;
        }

        token = ++VOID_CardCover.nextToken;
        image.__voidCardCoverToken = token;
        image.__voidCardCoverPending = true;
        settle = function () {
            if (!VOID_CardCover.canWrite(image, token)) {
                return;
            }
            if (image.naturalWidth > 0) {
                VOID_CardCover.reveal(image, token);
            } else {
                VOID_CardCover.fail(image);
            }
        };

        if (typeof image.decode !== 'function') {
            settle();
            return;
        }

        try {
            decodeResult = image.decode();
        } catch (err) {
            settle(err);
            return;
        }

        if (decodeResult && typeof decodeResult.then === 'function') {
            decodeResult.then(settle, settle);
        } else {
            settle();
        }
    },

    handleLoad: function (event) {
        if (VOID_CardCover.isCover(event.target)) {
            VOID_CardCover.decode(event.target);
        }
    },

    handleError: function (event) {
        if (VOID_CardCover.isCover(event.target)) {
            VOID_CardCover.fail(event.target);
        }
    },

    bind: function () {
        if (VOID_CardCover.bound
            || !document.addEventListener
            || !document.documentElement
            || !document.documentElement.classList) {
            return;
        }

        document.addEventListener('load', VOID_CardCover.handleLoad, true);
        document.addEventListener('error', VOID_CardCover.handleError, true);
        VOID_CardCover.bound = true;
        document.documentElement.classList.add('void-card-cover-transition');
    },

    init: function (root) {
        var images;
        var i;

        if (!root || !root.querySelectorAll) {
            return;
        }

        images = root.querySelectorAll('img[' + VOID_CardCover.marker + ']');
        for (i = 0; i < images.length; i++) {
            if (!images[i].complete) {
                continue;
            }
            if (images[i].naturalWidth > 0) {
                VOID_CardCover.decode(images[i]);
            } else {
                VOID_CardCover.fail(images[i]);
            }
        }
    }
};

VOID_CardCover.bind();

VOID_GalleryLazyload = {
    eventHandler: null,

    finish: function () {
        var items = document.querySelectorAll('[data-void-gallery] img.lazyload:not(.loaded):not(.error)');
        var pending = false;
        var i;

        for (i = 0; i < items.length; i++) {
            if (!VOID_GalleryLazyload.isHidden(items[i])) {
                pending = true;
                break;
            }
        }
        return !pending;
    },

    addEventListener: function () {
        if (!VOID_GalleryLazyload.finish()) {
            window.addEventListener('scroll', VOID_GalleryLazyload.eventHandler, { passive: true });
        }
    },

    removeEventListener: function () {
        if (VOID_GalleryLazyload.finish())
            window.removeEventListener('scroll', VOID_GalleryLazyload.eventHandler);
    },

    isHidden: function (item) {
        return !!(item && item.closest && item.closest('[hidden]'));
    },

    inViewport: function (item) {
        var rect;
        var viewPortHeight = document.documentElement.clientHeight; //可见区域高度
        var offset = 300; // 提前 200 px 加载
        if (VOID_GalleryLazyload.isHidden(item)) {
            return false;
        }
        rect = item.getBoundingClientRect();
        return rect.top - offset < viewPortHeight
            && rect.top + VOID_Util.getContentHeight(item) + offset > 0;
    },

    load: function (item) {
        var img = new Image();
        var fetchPriority = item.getAttribute && item.getAttribute('fetchpriority');

        item.__voidLazyLoading = true;
        if (fetchPriority) {
            img.setAttribute('fetchpriority', fetchPriority);
        }
        img.onload = function () {
            item.__voidLazyLoading = false;
            item.setAttribute('src', item.getAttribute('data-src'));
            item.classList.add('loaded');
            if (item.parentElement) {
                item.parentElement.classList.add('loaded');
            }
            VOID_GalleryLazyload.removeEventListener();
        };
        img.onerror = function () {
            item.__voidLazyLoading = false;
            item.classList.add('error');
            if (item.parentElement) {
                item.parentElement.classList.add('error');
            }
            VOID_GalleryLazyload.removeEventListener();
        };
        img.src = item.getAttribute('data-src');
    },

    callback: function () {
        var items = document.querySelectorAll('[data-void-gallery] img.lazyload:not(.loaded):not(.error)');
        var i;

        for (i = 0; i < items.length; i++) {
            var item = items[i];
            if (VOID_GalleryLazyload.isHidden(item)) {
                continue;
            }
            if (item.__voidLazyLoading) {
                continue;
            }
            var eager = item.getAttribute && item.getAttribute('loading') === 'eager';
            if (eager || VOID_GalleryLazyload.inViewport(item)) {
                VOID_GalleryLazyload.load(item);
            }
        }
        VOID_GalleryLazyload.removeEventListener();
    },

    init: function () {
        window.removeEventListener('scroll', VOID_GalleryLazyload.eventHandler);
        if (VOID_GalleryLazyload.eventHandler == null)
            VOID_GalleryLazyload.eventHandler = VOID_Util.throttle(VOID_GalleryLazyload.callback, 200, 500);
        VOID_GalleryLazyload.callback();
        VOID_GalleryLazyload.addEventListener();
    }
};

VOID_SmoothScroller = {
    target: null,
    SMOOTH: 15,
    raf: null,
    callback: null,

    finish: function (completed) {
        var callback = VOID_SmoothScroller.callback;

        if (VOID_SmoothScroller.raf !== null) {
            cancelAnimationFrame(VOID_SmoothScroller.raf);
        }
        VOID_SmoothScroller.removeEventListener();
        VOID_SmoothScroller.target = null;
        VOID_SmoothScroller.raf = null;
        VOID_SmoothScroller.callback = null;

        if (typeof callback === 'function') {
            callback(completed);
        }
    },

    move: function () {
        if (VOID_SmoothScroller.target === null) return;

        var cur = document.documentElement.scrollTop;
        var step = Math.ceil(Math.abs(VOID_SmoothScroller.target - cur) / VOID_SmoothScroller.SMOOTH);

        if (Math.abs(VOID_SmoothScroller.target - cur) < 1) {
            document.documentElement.scrollTop = VOID_SmoothScroller.target;
            VOID_SmoothScroller.finish(true);
            return;
        }

        cur >= VOID_SmoothScroller.target ? cur -= step : cur += step;
        document.documentElement.scrollTop = cur;
        VOID_SmoothScroller.raf = requestAnimationFrame(VOID_SmoothScroller.move);
    },

    addEventListener: function () {
        // 需要特别阻止滚轮事件
        var passiveSupported = false;
        try {
            var options = Object.defineProperty({}, 'passive', {
                get: function () {
                    passiveSupported = true;
                    return null;
                }
            });

            window.addEventListener('test', null, options);
        } catch (err) {
            console.log(err);
        }
        window.addEventListener('wheel', VOID_SmoothScroller.stop, 
            passiveSupported ? { passive: false } : false);
        
        window.addEventListener('mousedown', VOID_SmoothScroller.stop);
        window.addEventListener('touchstart', VOID_SmoothScroller.stop);
    },

    removeEventListener: function () {
        window.removeEventListener('wheel', VOID_SmoothScroller.stop);
        window.removeEventListener('mousedown', VOID_SmoothScroller.stop);
        window.removeEventListener('touchstart', VOID_SmoothScroller.stop);
    },

    scrollTo: function (target, offset, callback) {
        if (target === null) return;
        if (typeof(target) == 'object') {
            target = target.getBoundingClientRect().top + document.documentElement.scrollTop;
        } else if (typeof(target) == 'string') {
            var element = document.querySelector(target);
            if (!element) return;
            target = element.getBoundingClientRect().top + document.documentElement.scrollTop;
        }
        if (typeof(offset) == 'number') {
            target += offset;
        }
        // 若超出顶部或无法到达
        target = Math.max(target, 0);
        target = Math.min(target, 
            document.documentElement.getBoundingClientRect().height - document.documentElement.clientHeight);

        VOID_SmoothScroller.stop();
        VOID_SmoothScroller.target = target;
        VOID_SmoothScroller.callback = callback || null;
        VOID_SmoothScroller.addEventListener();
        VOID_SmoothScroller.move();
    },

    stop: function () {
        if (VOID_SmoothScroller.target === null && VOID_SmoothScroller.raf === null) {
            VOID_SmoothScroller.removeEventListener();
            return;
        }
        VOID_SmoothScroller.finish(false);
    }
};

VOID_AnchorScroller = {
    task: null,
    nextToken: 0,
    layoutLocks: 0,
    interactionEvents: ['wheel', 'touchstart', 'pointerdown'],

    now: function () {
        return window.performance && typeof window.performance.now === 'function'
            ? window.performance.now()
            : Date.now();
    },

    reducedMotion: function () {
        return !!(window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    },

    getScrollTop: function () {
        var scrollingElement = document.scrollingElement || document.documentElement;
        return scrollingElement ? scrollingElement.scrollTop || 0 : 0;
    },

    setScrollTop: function (value) {
        var scrollingElement = document.scrollingElement || document.documentElement;
        var documentElement = document.documentElement;
        var max = documentElement
            ? Math.max(0, (documentElement.scrollHeight || documentElement.getBoundingClientRect().height || 0)
                - (documentElement.clientHeight || 0))
            : value;
        var next = Math.max(0, Math.min(value, max));

        if (typeof window.scrollTo === 'function') {
            window.scrollTo(0, next);
        } else if (scrollingElement) {
            scrollingElement.scrollTop = next;
        }
    },

    resolveTarget: function (target) {
        if (typeof target === 'number') return target;
        if (target && typeof target.getBoundingClientRect === 'function') return target;
        if (typeof target !== 'string') return null;

        try {
            return document.querySelector(target);
        } catch (err) {
            if (err) return null;
            return null;
        }
    },

    updateLockClass: function () {
        var root = document.documentElement;
        if (!root || !root.classList) return;
        root.classList.toggle('void-anchor-scrolling', !!VOID_AnchorScroller.task || VOID_AnchorScroller.layoutLocks > 0);
    },

    isScrollKey: function (event) {
        var key = event && event.key;
        return key === 'ArrowUp' || key === 'ArrowDown'
            || key === 'PageUp' || key === 'PageDown'
            || key === 'Home' || key === 'End'
            || key === ' ' || key === 'Spacebar';
    },

    handleInteraction: function (event) {
        if (!event || event.type !== 'keydown' || VOID_AnchorScroller.isScrollKey(event)) {
            VOID_AnchorScroller.stop();
        }
    },

    bindInteraction: function () {
        var i;

        for (i = 0; i < VOID_AnchorScroller.interactionEvents.length; i++) {
            window.addEventListener(
                VOID_AnchorScroller.interactionEvents[i],
                VOID_AnchorScroller.handleInteraction,
                { passive: true }
            );
        }
        window.addEventListener('keydown', VOID_AnchorScroller.handleInteraction, false);
    },

    unbindInteraction: function () {
        var i;

        for (i = 0; i < VOID_AnchorScroller.interactionEvents.length; i++) {
            window.removeEventListener(
                VOID_AnchorScroller.interactionEvents[i],
                VOID_AnchorScroller.handleInteraction
            );
        }
        window.removeEventListener('keydown', VOID_AnchorScroller.handleInteraction);
    },

    stop: function (token) {
        var task = VOID_AnchorScroller.task;
        if (token && (!task || task.token !== token)) return;

        VOID_AnchorScroller.task = null;
        if (task) {
            if (task.raf !== null) window.cancelAnimationFrame(task.raf);
            if (task.timer !== null) window.clearTimeout(task.timer);
            if (task.observer) task.observer.disconnect();
        }
        VOID_AnchorScroller.unbindInteraction();
        VOID_SmoothScroller.stop();
        VOID_AnchorScroller.updateLockClass();
    },

    getDesiredTop: function (element, extraOffset) {
        var targetTop = element.getBoundingClientRect().top + VOID_AnchorScroller.getScrollTop();
        return VOID_Ui.getHeaderOffset(targetTop) - extraOffset;
    },

    align: function (task) {
        var element = task.target;
        if (!element || element.isConnected === false || typeof element.getBoundingClientRect !== 'function') {
            VOID_AnchorScroller.stop(task.token);
            return false;
        }

        var delta = element.getBoundingClientRect().top
            - VOID_AnchorScroller.getDesiredTop(element, task.extraOffset);
        if (Math.abs(delta) >= 0.5) {
            VOID_AnchorScroller.setScrollTop(VOID_AnchorScroller.getScrollTop() + delta);
            task.quietUntil = Math.min(task.maxUntil, VOID_AnchorScroller.now() + 500);
        }
        return true;
    },

    scheduleFrame: function (task) {
        if (VOID_AnchorScroller.task !== task || task.raf !== null) return;
        if (task.timer !== null) {
            window.clearTimeout(task.timer);
            task.timer = null;
        }
        task.raf = window.requestAnimationFrame(function () {
            task.raf = null;
            VOID_AnchorScroller.tick(task);
        });
    },

    scheduleFinish: function (task) {
        var now = VOID_AnchorScroller.now();
        var finishAt = Math.min(task.maxUntil, Math.max(task.minUntil, task.quietUntil));
        if (now >= finishAt) {
            VOID_AnchorScroller.stop(task.token);
            return;
        }
        if (task.timer !== null) window.clearTimeout(task.timer);
        task.timer = window.setTimeout(function () {
            task.timer = null;
            VOID_AnchorScroller.scheduleFinish(task);
        }, Math.max(1, finishAt - now));
    },

    tick: function (task) {
        if (VOID_AnchorScroller.task !== task) return;
        var now = VOID_AnchorScroller.now();
        if (now >= task.maxUntil) {
            VOID_AnchorScroller.stop(task.token);
            return;
        }

        task.needsMeasure = false;
        if (!VOID_AnchorScroller.align(task)) return;

        if (now < task.continuousUntil || !task.observer) {
            VOID_AnchorScroller.scheduleFrame(task);
            return;
        }
        VOID_AnchorScroller.scheduleFinish(task);
    },

    startTracking: function (task) {
        if (VOID_AnchorScroller.task !== task) return;
        var now = VOID_AnchorScroller.now();
        task.continuousUntil = now + 700;
        task.minUntil = now + 3000;
        task.maxUntil = now + 5000;
        task.quietUntil = task.minUntil;
        task.needsMeasure = true;

        if (typeof window.ResizeObserver === 'function') {
            task.observer = new window.ResizeObserver(function () {
                if (VOID_AnchorScroller.task !== task) return;
                task.needsMeasure = true;
                task.quietUntil = Math.min(task.maxUntil, VOID_AnchorScroller.now() + 500);
                VOID_AnchorScroller.scheduleFrame(task);
            });
            var container = document.getElementById('pjax-container');
            var header = document.querySelector('body>header');
            if (container) task.observer.observe(container);
            if (header) task.observer.observe(header);
        }

        VOID_AnchorScroller.scheduleFrame(task);
    },

    start: function (target, extraOffset, options) {
        VOID_AnchorScroller.stop();
        var resolvedTarget = VOID_AnchorScroller.resolveTarget(target);
        var settings = options || {};
        if (resolvedTarget === null) return false;

        var task = {
            token: ++VOID_AnchorScroller.nextToken,
            target: resolvedTarget,
            extraOffset: typeof extraOffset === 'number' ? extraOffset : 0,
            stabilize: !!settings.stabilize,
            raf: null,
            timer: null,
            observer: null
        };
        VOID_AnchorScroller.task = task;
        VOID_AnchorScroller.bindInteraction();
        VOID_AnchorScroller.updateLockClass();

        if (typeof resolvedTarget === 'number') {
            VOID_AnchorScroller.setScrollTop(resolvedTarget);
            VOID_AnchorScroller.stop(task.token);
            return true;
        }

        var behavior = VOID_AnchorScroller.reducedMotion() ? 'auto' : (settings.behavior || 'smooth');
        if (behavior === 'auto') {
            if (!VOID_AnchorScroller.align(task)) return false;
            if (task.stabilize) {
                VOID_AnchorScroller.startTracking(task);
            } else {
                VOID_AnchorScroller.stop(task.token);
            }
            return true;
        }

        var targetTop = resolvedTarget.getBoundingClientRect().top + VOID_AnchorScroller.getScrollTop();
        var offset = -VOID_Ui.getHeaderOffset(targetTop) + task.extraOffset;
        VOID_SmoothScroller.scrollTo(targetTop, offset, function (completed) {
            if (VOID_AnchorScroller.task !== task) return;
            if (!completed) {
                VOID_AnchorScroller.stop(task.token);
            } else if (task.stabilize) {
                VOID_AnchorScroller.startTracking(task);
            } else {
                VOID_AnchorScroller.stop(task.token);
            }
        });
        return true;
    },

    preserveElement: function (element, callback, options) {
        VOID_AnchorScroller.stop();
        if (!element || typeof element.getBoundingClientRect !== 'function') {
            callback();
            return;
        }

        VOID_AnchorScroller.layoutLocks += 1;
        VOID_AnchorScroller.updateLockClass();
        var beforeTop = element.getBoundingClientRect().top;
        var restorePosition = function () {
            if (element.isConnected === false) return;
            var afterTop = element.getBoundingClientRect().top;
            if (Math.abs(afterTop - beforeTop) >= 0.5) {
                VOID_AnchorScroller.setScrollTop(
                    VOID_AnchorScroller.getScrollTop() + afterTop - beforeTop
                );
            }
        };
        callback();
        restorePosition();

        var release = function () {
            VOID_AnchorScroller.layoutLocks = Math.max(0, VOID_AnchorScroller.layoutLocks - 1);
            VOID_AnchorScroller.updateLockClass();
        };
        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(function () {
                if (!options || options.trackFrames !== false) restorePosition();
                window.requestAnimationFrame(function () {
                    if (!options || options.trackFrames !== false) restorePosition();
                    release();
                });
            });
        } else {
            window.setTimeout(release, 34);
        }
    }
};

VOID_ControllerPanel = {
    cssProperty: '--void-footer-overlap',
    eventHandler: null,
    frame: null,
    initialized: false,
    lastOverlap: null,
    resizeObserver: null,

    isDesktop: function () {
        if (typeof window.matchMedia === 'function') {
            return window.matchMedia('(min-width: 768px)').matches;
        }
        return (window.innerWidth || document.documentElement.clientWidth || 0) >= 768;
    },

    getViewportHeight: function () {
        return document.documentElement.clientHeight || window.innerHeight || 0;
    },

    getBaseGap: function () {
        var rootStyle = typeof window.getComputedStyle === 'function'
            ? window.getComputedStyle(document.documentElement)
            : null;
        var rootFontSize = rootStyle ? parseFloat(rootStyle.fontSize) : 16;

        if (!isFinite(rootFontSize) || rootFontSize <= 0) {
            rootFontSize = 16;
        }
        return rootFontSize * 1.5;
    },

    calculateOverlap: function (footerTop, viewportHeight, panelHeight, baseGap) {
        var overlap = Math.max(0, viewportHeight - footerTop);
        var maxOverlap = Math.max(0, viewportHeight - panelHeight - baseGap * 2);

        return Math.min(overlap, maxOverlap);
    },

    setOverlap: function (overlap) {
        var root = document.documentElement;
        var rounded = Math.max(0, Math.round(overlap));

        if (!root || !root.style || typeof root.style.setProperty !== 'function') {
            return;
        }
        if (this.lastOverlap === rounded) {
            return;
        }
        root.style.setProperty(this.cssProperty, rounded + 'px');
        this.lastOverlap = rounded;
    },

    update: function () {
        var footer;
        var footerRect;
        var panel;
        var overlap = 0;

        if (this.isDesktop()) {
            footer = document.querySelector('body>footer');
            panel = document.getElementById('ctrler-panel');
            if (footer && panel) {
                footerRect = footer.getBoundingClientRect();
                if (footerRect && footerRect.height > 0) {
                    overlap = this.calculateOverlap(
                        footerRect.top,
                        this.getViewportHeight(),
                        panel.offsetHeight || 0,
                        this.getBaseGap()
                    );
                }
            }
        }
        this.setOverlap(overlap);
    },

    schedule: function () {
        var self = this;

        if (this.frame !== null) {
            return;
        }
        if (typeof window.requestAnimationFrame !== 'function') {
            this.update();
            return;
        }
        this.frame = window.requestAnimationFrame(function () {
            self.frame = null;
            self.update();
        });
    },

    observeLayout: function () {
        var footer;
        var panel;
        var content;
        var self = this;

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (typeof window.ResizeObserver !== 'function') {
            return;
        }
        if (!this.resizeObserver) {
            this.resizeObserver = new window.ResizeObserver(function () {
                self.schedule();
            });
        }

        footer = document.querySelector('body>footer');
        panel = document.getElementById('ctrler-panel');
        content = document.getElementById('pjax-container');
        if (footer) {
            this.resizeObserver.observe(footer);
        }
        if (panel) {
            this.resizeObserver.observe(panel);
        }
        if (content) {
            this.resizeObserver.observe(content);
        }
    },

    init: function () {
        var self = this;

        if (this.initialized) {
            this.refresh();
            return;
        }
        this.initialized = true;
        this.eventHandler = function () {
            self.schedule();
        };
        window.addEventListener('scroll', this.eventHandler);
        window.addEventListener('resize', this.eventHandler);
        this.observeLayout();
        this.schedule();
    },

    refresh: function () {
        if (!this.initialized) {
            this.init();
            return;
        }
        this.observeLayout();
        this.schedule();
    },

    destroy: function () {
        var root = document.documentElement;

        if (this.eventHandler) {
            window.removeEventListener('scroll', this.eventHandler);
            window.removeEventListener('resize', this.eventHandler);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.frame !== null && typeof window.cancelAnimationFrame === 'function') {
            window.cancelAnimationFrame(this.frame);
        }
        if (root && root.style && typeof root.style.removeProperty === 'function') {
            root.style.removeProperty(this.cssProperty);
        }
        this.eventHandler = null;
        this.frame = null;
        this.initialized = false;
        this.lastOverlap = null;
        this.resizeObserver = null;
    }
};

VOID_Ui = {
    dismissHandler: null,
    dismissRoot: null,
    globalEventsBound: false,
    loginActionController: null,
    loginActionGeneration: 0,
    loginActionRequest: null,
    scrollHandler: null,
    settingPanelActive: false,
    settingPanelTimer: null,
    touchEndHandler: null,
    touchStartHandler: null,

    checkGoTop: function () {
        var control = document.getElementById('go-top');
        var scrollingElement = document.scrollingElement || document.documentElement;

        if (!control || !scrollingElement) return;
        control.classList.toggle('show', scrollingElement.scrollTop > window.innerHeight);
    },

    checkHeader: function () {
        if (VOIDConfig.headerMode == 2) return;
        var banner = document.querySelector('.lazy-wrap');
        var header = document.querySelector('body>header');
        var scrollingElement = document.scrollingElement || document.documentElement;

        if (!banner || !header || !scrollingElement) return;
        header.classList.toggle(
            'pull-up',
            scrollingElement.scrollTop > VOID_Util.getContentHeight(banner)
        );
    },

    resolveScrollTarget: function (target) {
        if (target === null) return null;
        if (typeof(target) == 'number') return target;
        if (typeof(target) == 'object') {
            return target.getBoundingClientRect().top + document.documentElement.scrollTop;
        }
        if (typeof(target) == 'string') {
            var el = document.querySelector(target);
            if (!el) return null;
            return el.getBoundingClientRect().top + document.documentElement.scrollTop;
        }
        return null;
    },

    getHeaderOffset: function (targetTop) {
        var header = document.querySelector('body>header');
        if (!header) return 0;
        if (VOIDConfig.headerMode == 2) return 0;

        var offset = header.getBoundingClientRect().height || 0;
        var mobileSearchForm = header.querySelector('.mobile-search-form.opened');
        if (mobileSearchForm) {
            offset += mobileSearchForm.getBoundingClientRect().height || 0;
        }

        if (VOIDConfig.headerMode == 0) {
            var currentTop = document.documentElement.scrollTop || document.body.scrollTop;
            if (typeof(targetTop) == 'number' && targetTop < currentTop) {
                return Math.ceil(offset);
            }
            if (header.classList.contains('headroom--unpinned')) {
                return 0;
            }
        }

        return Math.ceil(offset);
    },

    scrollToWithHeader: function (target, extraOffset, options) {
        return VOID_AnchorScroller.start(target, extraOffset, options);
    },

    checkScrollTop: function (options) {
        var savedPosition = VOID_Util.getCookie('void_pos');
        var parsedPosition = parseFloat(savedPosition);

        if (!(options && options.ignoreSavedPosition)
            && savedPosition !== null && !isNaN(parsedPosition) && parsedPosition !== -1) {
            VOID_Util.setCookie('void_pos', -1);
            VOID_AnchorScroller.start(parsedPosition, 0, { behavior: 'auto' });
        } else if (window.location.hash) {
            var hashTarget = VOID_Util.getHashTarget(window.location.hash);
            if (hashTarget) {
                VOID_Ui.scrollToWithHeader(hashTarget, 0, {
                    behavior: 'auto',
                    stabilize: true
                });
            } else {
                VOID_AnchorScroller.stop();
            }
        } else {
            VOID_AnchorScroller.stop();
        }
    },

    toggleSearch: function () {
        var form = document.querySelector('.mobile-search-form');
        var input;

        if (!form) return;
        form.classList.toggle('opened');
        input = form.querySelector('input');
        if (input) input.focus();
    },

    toggleNav: function (item) {
        var header = document.querySelector('header');

        if (!item || !header) return;
        item.classList.toggle('pushed');
        header.classList.toggle('opened');
        TOC.close();
        if (item.classList.contains('pushed')) {
            VOID_Ui.openModal();
        } else {
            VOID_Ui.closeModal();
        }
    },

    toggleSettingPanel: function () {
        var body = document.body;
        var loginPanel = document.getElementById('login-panel');
        var settingPanel = document.getElementById('setting-panel');

        if (!body || !settingPanel) return;
        if (!VOID_Ui.settingPanelActive) {
            if (VOID_Ui.settingPanelTimer !== null) {
                window.clearTimeout(VOID_Ui.settingPanelTimer);
            }
            if (loginPanel) loginPanel.classList.remove('show');
            settingPanel.hidden = false;
            VOID_Ui.settingPanelActive = true;
            VOID_Ui.settingPanelTimer = window.setTimeout(function () {
                VOID_Ui.settingPanelTimer = null;
                if (VOID_Ui.settingPanelActive) {
                    body.classList.add('setting-panel-show');
                }
            }, 50); // 改变 display 时 transition 总是失效，需要延迟一下
        } else {
            VOID_Ui.closeSettingPanel();
        }
    },

    closeSettingPanel: function (immediate) {
        var settingPanel = document.getElementById('setting-panel');

        VOID_Ui.settingPanelActive = false;
        if (VOID_Ui.settingPanelTimer !== null) {
            window.clearTimeout(VOID_Ui.settingPanelTimer);
            VOID_Ui.settingPanelTimer = null;
        }
        if (document.body) {
            document.body.classList.remove('setting-panel-show');
        }
        if (!settingPanel) return;
        if (immediate) {
            settingPanel.hidden = true;
            return;
        }
        VOID_Ui.settingPanelTimer = window.setTimeout(function () {
            VOID_Ui.settingPanelTimer = null;
            if (!VOID_Ui.settingPanelActive) {
                settingPanel.hidden = true;
            }
        }, 300);
    },

    toggleSerif: function (item, serif) {
        var indicators = document.querySelectorAll('.font-indicator');
        var stylesheet;
        var i;

        for (i = 0; i < indicators.length; i++) {
            indicators[i].classList.remove('checked');
        }
        if (item) item.classList.add('checked');
        if (serif) {
            if (!document.getElementById('stylesheet_noto') &&
                VOIDConfig.fontStylesheets && VOIDConfig.fontStylesheets.serif) {
                stylesheet = document.createElement('link');
                stylesheet.id = 'stylesheet_noto';
                stylesheet.rel = 'stylesheet';
                stylesheet.href = VOIDConfig.fontStylesheets.serif;
                document.head.appendChild(stylesheet);
            }
            document.body.classList.add('serif');
            VOID_Util.setCookie('serif', '1', 2592000); // 一个月
        } else {
            document.body.classList.remove('serif');
            VOID_Util.setCookie('serif', '0', 2592000);
        }
    },

    adjustTextsize: function (up) {
        var current = parseInt(document.body.getAttribute('fontsize'), 10);

        if (up) {
            if (current >= 5) {
                VOID.alert('已经是最大了！');
                return;
            }
            document.body.setAttribute('fontsize', String(current + 1));
        } else {
            if (current <= 1) {
                VOID.alert('已经是最小了！');
                return;
            }
            document.body.setAttribute('fontsize', String(current - 1));
        }

        VOID_Util.setCookie('textsize', document.body.getAttribute('fontsize'), 2592000);
    },

    toggleLoginForm: function () {
        var form = document.getElementById('loggin-form');
        var loginPanel = document.getElementById('login-panel');
        var referer;

        if (!loginPanel) return;
        loginPanel.classList.toggle('show');
        referer = loginPanel.querySelector('input[name=referer]');
        if (referer) referer.value = window.location.href;

        if (form && form.classList.contains('need-refresh')
            && loginPanel.classList.contains('show')) {
            VOID_Ui.refreshLoginAction(form);
        }
    },

    refreshLoginAction: function (form) {
        var controller = typeof window.AbortController === 'function'
            ? new window.AbortController()
            : null;
        var generation;
        var options;
        var requestUrl;

        if (!form || VOID_Ui.loginActionRequest) return VOID_Ui.loginActionRequest;
        if (typeof window.fetch !== 'function') {
            VOID_Ui.handleLoginActionError();
            return null;
        }

        generation = ++VOID_Ui.loginActionGeneration;
        requestUrl = window.location.href;
        options = {
            body: 'void_action=getLoginAction',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            },
            method: 'POST'
        };
        if (controller) options.signal = controller.signal;
        VOID_Ui.loginActionController = controller;
        VOID_Ui.loginActionRequest = window.fetch(requestUrl, options).then(function (response) {
            if (!response || !response.ok) {
                throw new Error('Login action request failed.');
            }
            return response.text();
        }).then(function (data) {
            if (generation !== VOID_Ui.loginActionGeneration) return;
            VOID_Ui.loginActionRequest = null;
            VOID_Ui.loginActionController = null;
            if (form.isConnected === false || requestUrl !== window.location.href) return;
            if (typeof data === 'string' && data.trim() !== '') {
                form.setAttribute('action', data.trim());
                form.classList.remove('need-refresh');
            }
        }, function (error) {
            if (generation !== VOID_Ui.loginActionGeneration
                || (error && error.name === 'AbortError')) {
                return;
            }
            VOID_Ui.loginActionRequest = null;
            VOID_Ui.loginActionController = null;
            VOID_Ui.handleLoginActionError();
        });
        return VOID_Ui.loginActionRequest;
    },

    handleLoginActionError: function () {
        VOID.alert('请求登陆参数错误。请在刷新后尝试登陆。');
        window.setTimeout(function () {
            window.location.reload();
        }, 1000);
    },

    invalidateLoginAction: function () {
        var form = document.getElementById('loggin-form');

        VOID_Ui.loginActionGeneration += 1;
        if (VOID_Ui.loginActionController) {
            VOID_Ui.loginActionController.abort();
        }
        VOID_Ui.loginActionController = null;
        VOID_Ui.loginActionRequest = null;
        if (form) form.classList.add('need-refresh');
    },

    lazyload: function () {
        VOID_GalleryLazyload.init();
    },

    headroom: function () {
        if (VOIDConfig.headerMode == 0) {
            var header = document.querySelector('body>header');
            var headroom = new Headroom(header, { offset: 60 });
            headroom.init();
        }
    },

    toggleArchive: function (item) {
        var year = item
            ? document.getElementById('year-' + item.getAttribute('data-year'))
            : null;

        if (!item || !year) return;
        if (year.classList.contains('shrink')) {
            item.textContent = '-';
            year.classList.remove('shrink');
            var num = parseInt(item.getAttribute('data-num'), 10);
            year.style.maxHeight = num * 49 + 'px';
        } else {
            item.textContent = '+';
            year.classList.add('shrink');
            year.style.maxHeight = '0';
        }
    },

    rememberPos: function () {
        var scrollingElement = document.scrollingElement || document.documentElement;
        VOID_Util.setCookie('void_pos', String(scrollingElement ? scrollingElement.scrollTop : 0));
    },

    scrollTop: 0,

    // 开启模态框
    openModal: function () {
        VOID_Ui.scrollTop = document.scrollingElement.scrollTop;
        document.body.classList.add('modal-open');
        document.body.style.top = -VOID_Ui.scrollTop + 'px';
    },

    // 关闭模态框
    closeModal: function () {
        document.body.classList.remove('modal-open');
        document.scrollingElement.scrollTop = VOID_Ui.scrollTop;
    },

    reset: function () {
        var toggles = document.querySelectorAll('.toggle');
        var searchForms = document.querySelectorAll('.mobile-search-form');
        var headers = document.querySelectorAll('header');
        var i;

        for (i = 0; i < toggles.length; i++) toggles[i].classList.remove('pushed');
        for (i = 0; i < searchForms.length; i++) searchForms[i].classList.remove('opened');
        for (i = 0; i < headers.length; i++) headers[i].classList.remove('opened');
        VOID_Ui.closeSettingPanel();
        if (document.body.classList.contains('modal-open')) {
            VOID_Ui.closeModal();
        }
        TOC.close();
        if (document.querySelector('.TOC')) {
            tocbot.destroy();
        }
    },

    bindDismissEvents: function () {
        var root = document.body;

        if (!root || !root.addEventListener) return;
        if (VOID_Ui.dismissRoot === root && VOID_Ui.dismissHandler) return;
        VOID_Ui.unbindDismissEvents();
        VOID_Ui.dismissHandler = function (event) {
            var searchForm;

            if (!VOID_Util.clickIn(event, '.mobile-search-form')
                && !VOID_Util.clickIn(event, '#toggle-mobile-search')) {
                searchForm = document.querySelector('.mobile-search-form.opened');
                if (searchForm) {
                    searchForm.classList.remove('opened');
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }
            }
            if (!VOID_Util.clickIn(event, '#toggle-setting-pc')
                && !VOID_Util.clickIn(event, '#toggle-setting')
                && document.body.classList.contains('setting-panel-show')
                && !VOID_Util.clickIn(event, '#setting-panel')) {
                VOID_Ui.closeSettingPanel();
                event.preventDefault();
                event.stopPropagation();
            }
        };
        VOID_Ui.dismissRoot = root;
        root.addEventListener('click', VOID_Ui.dismissHandler);
    },

    unbindDismissEvents: function () {
        if (VOID_Ui.dismissRoot && VOID_Ui.dismissHandler) {
            VOID_Ui.dismissRoot.removeEventListener('click', VOID_Ui.dismissHandler);
        }
        VOID_Ui.dismissRoot = null;
        VOID_Ui.dismissHandler = null;
    },

    bindGlobalEvents: function () {
        if (VOID_Ui.globalEventsBound || !document.addEventListener) return;
        if ('ontouchstart' in document) {
            VOID_Ui.touchStartHandler = function (event) {
                VOID_Ui.Swiper.start(event);
            };
            VOID_Ui.touchEndHandler = function (event) {
                VOID_Ui.Swiper.end(event);
            };
            document.addEventListener('touchstart', VOID_Ui.touchStartHandler, { passive: true });
            document.addEventListener('touchend', VOID_Ui.touchEndHandler, { passive: true });
        }
        VOID_Ui.scrollHandler = function () {
            VOID_Ui.checkGoTop();
            VOID_Ui.checkHeader();
            if (!('ontouchstart' in document)) {
                VOID_Ui.closeSettingPanel();
            }
        };
        document.addEventListener('scroll', VOID_Ui.scrollHandler, { passive: true });
        VOID_Ui.globalEventsBound = true;
    },

    unbindGlobalEvents: function () {
        if (!VOID_Ui.globalEventsBound || !document.removeEventListener) return;
        if (VOID_Ui.touchStartHandler) {
            document.removeEventListener('touchstart', VOID_Ui.touchStartHandler);
        }
        if (VOID_Ui.touchEndHandler) {
            document.removeEventListener('touchend', VOID_Ui.touchEndHandler);
        }
        if (VOID_Ui.scrollHandler) {
            document.removeEventListener('scroll', VOID_Ui.scrollHandler);
        }
        VOID_Ui.touchStartHandler = null;
        VOID_Ui.touchEndHandler = null;
        VOID_Ui.scrollHandler = null;
        VOID_Ui.globalEventsBound = false;
    },

    loadBackgroundImage: function (element, url) {
        if (!element || typeof url !== 'string' || url === '') {
            return null;
        }

        var image = new Image();
        var settled = false;
        var finish = function (success) {
            var source;

            if (settled) {
                return;
            }

            settled = true;
            image.onload = null;
            image.onerror = null;

            if (!success || element.isConnected === false) {
                return;
            }

            source = String(image.currentSrc || image.src || url);
            element.style.backgroundImage = 'url(' + JSON.stringify(source) + ')';
            element.classList.add('loaded');
        };

        image.onload = function () {
            finish(true);
        };
        image.onerror = function () {
            finish(false);
        };
        image.src = url;

        if (image.complete) {
            finish(image.naturalWidth > 0);
        }

        return image;
    },

    MasonryCtrler: {
        container: null,
        instance: null,
        watchedItems: [],
        resizeObserver: null,
        active: false,
        resizeHandler: null,
        layoutScheduled: false,
        layoutFrame: null,
        layoutUsesAnimationFrame: false,
        getItems: function () {
            var items = [];
            var nodes;
            var i;

            if (!this.container || !this.container.querySelectorAll) {
                return items;
            }

            nodes = this.container.querySelectorAll('.masonry-item');
            for (i = 0; i < nodes.length; i++) {
                items.push(nodes[i]);
            }
            return items;
        },
        layout: function () {
            if (!this.active || !this.instance || !this.check()) {
                return;
            }
            this.instance.layout();
        },
        scheduleLayout: function () {
            var controller = this;
            var callback;

            if (this.layoutScheduled || !this.active || !this.instance || !this.check()) {
                return;
            }

            callback = function () {
                controller.layoutScheduled = false;
                controller.layoutFrame = null;
                controller.layoutUsesAnimationFrame = false;
                controller.layout();
            };
            this.layoutScheduled = true;
            if (typeof window.requestAnimationFrame === 'function') {
                this.layoutUsesAnimationFrame = true;
                this.layoutFrame = window.requestAnimationFrame(callback);
            } else {
                this.layoutFrame = window.setTimeout(callback, 16);
            }
        },
        cancelScheduledLayout: function () {
            if (!this.layoutScheduled) {
                return;
            }

            if (this.layoutUsesAnimationFrame && typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(this.layoutFrame);
            } else {
                window.clearTimeout(this.layoutFrame);
            }
            this.layoutScheduled = false;
            this.layoutFrame = null;
            this.layoutUsesAnimationFrame = false;
        },
        enable: function () {
            var items;
            var i;

            if (this.instance || !this.check() || VOIDConfig.indexStyle != 0) {
                return;
            }

            items = this.getItems();
            this.container.classList.add('masonry');
            for (i = 0; i < items.length; i++) {
                items[i].classList.add('masonry-ready');
            }
            this.instance = new Masonry(this.container, {
                itemSelector: '.masonry-item',
                gutter: 30,
                isAnimated: false,
                transitionDuration: 0,
                resize: false
            });
            this.active = true;
        },
        disable: function () {
            var items = this.getItems();
            var i;

            this.cancelScheduledLayout();
            if (this.instance) {
                this.instance.destroy();
                this.instance = null;
            }

            if (this.container) {
                this.container.classList.remove('masonry');
            }
            for (i = 0; i < items.length; i++) {
                items[i].classList.remove('masonry-ready');
            }
            this.active = false;
        },
        sync: function () {
            if (this.check() && VOIDConfig.indexStyle == 0) {
                this.enable();
            } else {
                this.disable();
            }
        },
        bindResize: function () {
            if (this.resizeHandler) {
                return;
            }

            this.resizeHandler = function () {
                var controller = VOID_Ui.MasonryCtrler;
                var wasActive = controller.active;

                controller.sync();
                if (wasActive && controller.active) {
                    controller.scheduleLayout();
                }
            };
            window.addEventListener('resize', this.resizeHandler);
        },
        unbindResize: function () {
            if (!this.resizeHandler) {
                return;
            }

            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        },
        init: function () {
            var container = document.getElementById('masonry');

            if (!container || VOIDConfig.indexStyle != 0) {
                this.destroy();
                return;
            }

            if (this.container && this.container !== container) {
                this.destroy();
            }
            this.container = container;
            this.syncWatches();
            this.bindResize();
            this.sync();
        },
        check: function () {
            return !!this.container
                && this.container === document.getElementById('masonry')
                && window.innerWidth >= 768;
        },
        destroy: function () {
            this.disable();
            this.clearWatches();
            this.unbindResize();
            this.container = null;
        },
        ensureResizeObserver: function () {
            if (this.resizeObserver || typeof window.ResizeObserver !== 'function') {
                return;
            }

            this.resizeObserver = new window.ResizeObserver(function (entries) {
                var controller = VOID_Ui.MasonryCtrler;
                var i;

                for (i = 0; i < entries.length; i++) {
                    if (controller.isWatched(entries[i].target)) {
                        controller.scheduleLayout();
                        return;
                    }
                }
            });
        },
        isWatched: function (element) {
            var i;

            for (i = 0; i < this.watchedItems.length; i++) {
                if (this.watchedItems[i].element === element) {
                    return true;
                }
            }
            return false;
        },
        watchImages: function (entry) {
            var images;
            var i;
            var j;
            var image;
            var alreadyWatched;
            var controller = this;

            if (!entry.element.querySelectorAll) {
                return;
            }

            images = entry.element.querySelectorAll('img');
            for (i = 0; i < images.length; i++) {
                image = images[i];
                alreadyWatched = false;
                for (j = 0; j < entry.imageListeners.length; j++) {
                    if (entry.imageListeners[j].element === image) {
                        alreadyWatched = true;
                        break;
                    }
                }
                if (alreadyWatched || image.complete || !image.addEventListener) {
                    continue;
                }

                (function (targetImage) {
                    var settled = false;
                    var handler = function () {
                        if (settled) {
                            return;
                        }
                        settled = true;
                        targetImage.removeEventListener('load', handler);
                        targetImage.removeEventListener('error', handler);
                        if (controller.isWatched(entry.element)) {
                            controller.scheduleLayout();
                        }
                    };

                    targetImage.addEventListener('load', handler);
                    targetImage.addEventListener('error', handler);
                    entry.imageListeners.push({
                        element: targetImage,
                        handler: handler
                    });
                }(image));
            }
        },
        unwatch: function (entry) {
            var i;

            if (this.resizeObserver) {
                this.resizeObserver.unobserve(entry.element);
            }
            for (i = 0; i < entry.imageListeners.length; i++) {
                entry.imageListeners[i].element.removeEventListener(
                    'load', entry.imageListeners[i].handler
                );
                entry.imageListeners[i].element.removeEventListener(
                    'error', entry.imageListeners[i].handler
                );
            }
            entry.imageListeners = [];
        },
        clearWatches: function () {
            var i;

            for (i = 0; i < this.watchedItems.length; i++) {
                this.unwatch(this.watchedItems[i]);
            }
            this.watchedItems = [];
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
        },
        syncWatches: function () {
            var items = this.getItems();
            var i;

            for (i = this.watchedItems.length - 1; i >= 0; i--) {
                if (items.indexOf(this.watchedItems[i].element) === -1) {
                    this.unwatch(this.watchedItems[i]);
                    this.watchedItems.splice(i, 1);
                }
            }
            for (i = 0; i < items.length; i++) {
                this.watch(items[i].id);
            }
        },
        watch: function (id) {
            var el = document.getElementById(id);
            var entry;
            var i;

            if (!el || VOIDConfig.indexStyle != 0) {
                return;
            }

            for (i = 0; i < this.watchedItems.length; i++) {
                if (this.watchedItems[i].id !== id) {
                    continue;
                }
                if (this.watchedItems[i].element === el) {
                    this.watchImages(this.watchedItems[i]);
                    return;
                }
                this.unwatch(this.watchedItems[i]);
                this.watchedItems.splice(i, 1);
                break;
            }

            entry = {
                id: id,
                element: el,
                imageListeners: []
            };
            this.ensureResizeObserver();
            if (this.resizeObserver) {
                this.resizeObserver.observe(el);
            }
            this.watchImages(entry);
            this.watchedItems.push(entry);
        }
    },

    DarkModeSwitcher: {
        mediaQuery: null,
        mediaListener: null,

        getOverride: function () {
            var value = VOID_Util.getCookie('void_theme_override');
            return value === 'light' || value === 'dark' ? value : null;
        },

        getMode: function () {
            var mode = parseInt(VOIDConfig.colorScheme, 10);
            return mode >= 1 && mode <= 3 ? mode : 3;
        },

        getConfiguredState: function () {
            var mode = this.getMode();

            if (mode === 2) {
                return true;
            }
            if (mode === 3) {
                return window.matchMedia
                    ? window.matchMedia('(prefers-color-scheme: dark)').matches
                    : false;
            }
            return false;
        },

        apply: function (isDark) {
            document.documentElement.classList.toggle('theme-dark', isDark);
            if (document.body) {
                document.body.classList.toggle('theme-dark', isDark);
            }
            document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
            this.updateControl(isDark);
        },

        updateControl: function (isDark) {
            var control = document.querySelector('#toggle-night button');
            var state = this.getOverride() || 'auto';
            var label;

            if (!control) {
                return;
            }

            if (state === 'light') {
                label = '日间模式；切换至夜间模式';
            } else if (state === 'dark') {
                label = '夜间模式；恢复跟随主题设置';
            } else {
                label = '跟随主题设置，当前为' + (isDark ? '夜间' : '日间') + '模式；切换至日间模式';
            }

            control.setAttribute('data-theme-state', state);
            control.setAttribute('aria-label', label);
            control.setAttribute('title', label);
        },

        stopDeviceListener: function () {
            if (this.mediaQuery && this.mediaListener) {
                if (this.mediaQuery.removeEventListener) {
                    this.mediaQuery.removeEventListener('change', this.mediaListener);
                } else if (this.mediaQuery.removeListener) {
                    this.mediaQuery.removeListener(this.mediaListener);
                }
            }
            this.mediaQuery = null;
            this.mediaListener = null;
        },

        startDeviceListener: function () {
            var self = this;

            if (!window.matchMedia) {
                return;
            }

            this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            this.mediaListener = function (event) {
                if (!self.getOverride() && self.getMode() === 3) {
                    self.apply(event.matches);
                }
            };

            if (this.mediaQuery.addEventListener) {
                this.mediaQuery.addEventListener('change', this.mediaListener);
            } else if (this.mediaQuery.addListener) {
                this.mediaQuery.addListener(this.mediaListener);
            }
        },

        checkColorScheme: function () {
            var override = this.getOverride();
            var mode = this.getMode();

            this.stopDeviceListener();
            this.apply(override ? override === 'dark' : this.getConfiguredState());

            if (override) {
                return;
            }
            if (mode === 3) {
                this.startDeviceListener();
            }
        },

        toggleByHand: function () {
            var self = this;
            var override = self.getOverride();
            var reducedMotion = window.matchMedia
                && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            var rotate = !reducedMotion;
            var toggle = document.getElementById('toggle-night');

            if (rotate && toggle) toggle.classList.add('switching');
            window.setTimeout(function () {
                if (!override) {
                    VOID_Util.setCookie('void_theme_override', 'light', 0);
                    self.stopDeviceListener();
                    self.apply(false);
                } else if (override === 'light') {
                    VOID_Util.setCookie('void_theme_override', 'dark', 0);
                    self.stopDeviceListener();
                    self.apply(true);
                } else {
                    VOID_Util.removeCookie('void_theme_override');
                    self.checkColorScheme();
                }

                if (rotate && toggle) {
                    window.setTimeout(function () {
                        toggle.classList.remove('switching');
                    }, 1000);
                }
            }, rotate ? 600 : 0);
        }
    },

    Swiper: {
        clientX: null,
        clientY: null,
        // move: function (e) {
        //     return;
        // },

        start: function(e) {
            if (!e.changedTouches || !e.changedTouches[0]) return;
            this.clientX = e.changedTouches[0].clientX;
            this.clientY = e.changedTouches[0].clientY;
        },

        end: function (e) {
            if (this.clientY === null || !e.changedTouches || !e.changedTouches[0]) return;
            // 垂直滚动距离
            if (Math.abs(this.clientY - e.changedTouches[0].clientY) > 30) {
                VOID_Ui.closeSettingPanel();
            }
            this.clientX = null;
            this.clientY = null;
        }
    }
};

VOID_Ui.bindGlobalEvents();

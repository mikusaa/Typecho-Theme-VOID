VOID_GalleryLazyload = {
    eventHandler: null,
    generation: 0,
    nextToken: 0,
    pendingLoads: [],

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
        var entry = {
            generation: VOID_GalleryLazyload.generation,
            image: img,
            item: item,
            token: ++VOID_GalleryLazyload.nextToken
        };
        var settle = function (success) {
            var pendingIndex = VOID_GalleryLazyload.pendingLoads.indexOf(entry);

            if (pendingIndex !== -1) {
                VOID_GalleryLazyload.pendingLoads.splice(pendingIndex, 1);
            }
            img.onload = null;
            img.onerror = null;
            if (entry.generation !== VOID_GalleryLazyload.generation
                || item.__voidLazyToken !== entry.token
                || item.isConnected === false) {
                return;
            }

            item.__voidLazyLoading = false;
            if (success) {
                item.setAttribute('src', item.getAttribute('data-src'));
                item.classList.add('loaded');
                if (item.parentElement) {
                    item.parentElement.classList.add('loaded');
                }
            } else {
                item.classList.add('error');
                if (item.parentElement) {
                    item.parentElement.classList.add('error');
                }
            }
            VOID_GalleryLazyload.removeEventListener();
        };

        item.__voidLazyLoading = true;
        item.__voidLazyToken = entry.token;
        VOID_GalleryLazyload.pendingLoads.push(entry);
        if (fetchPriority) {
            img.setAttribute('fetchpriority', fetchPriority);
        }
        img.onload = function () {
            settle(true);
        };
        img.onerror = function () {
            settle(false);
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
        var generation;

        window.removeEventListener('scroll', VOID_GalleryLazyload.eventHandler);
        if (VOID_GalleryLazyload.eventHandler == null) {
            generation = VOID_GalleryLazyload.generation;
            VOID_GalleryLazyload.eventHandler = VOID_Util.throttle(function () {
                if (generation === VOID_GalleryLazyload.generation) {
                    VOID_GalleryLazyload.callback();
                }
            }, 200, 500);
        }
        VOID_GalleryLazyload.callback();
        VOID_GalleryLazyload.addEventListener();
    },

    destroy: function () {
        var entry;
        var i;

        VOID_GalleryLazyload.generation += 1;
        window.removeEventListener('scroll', VOID_GalleryLazyload.eventHandler);
        VOID_GalleryLazyload.eventHandler = null;
        for (i = 0; i < VOID_GalleryLazyload.pendingLoads.length; i++) {
            entry = VOID_GalleryLazyload.pendingLoads[i];
            entry.image.onload = null;
            entry.image.onerror = null;
            if (entry.item.__voidLazyToken === entry.token) {
                entry.item.__voidLazyToken = ++VOID_GalleryLazyload.nextToken;
                entry.item.__voidLazyLoading = false;
            }
        }
        VOID_GalleryLazyload.pendingLoads = [];
    }
};

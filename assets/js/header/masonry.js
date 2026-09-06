VOID_Ui.MasonryCtrler = {
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
};

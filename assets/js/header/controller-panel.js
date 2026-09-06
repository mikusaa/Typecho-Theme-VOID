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

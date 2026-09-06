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

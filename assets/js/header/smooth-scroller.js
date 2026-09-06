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

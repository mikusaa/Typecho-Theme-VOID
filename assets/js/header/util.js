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

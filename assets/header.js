/* eslint-disable no-undef */

TOC = {
    toggle: function () {
        $('body').toggleClass('sidebar-show');
    },

    close: function () {
        $('body').removeClass('sidebar-show');
    },

    open: function () {
        $('body').addClass('sidebar-show');
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
        if (!$(el).length) return false;
        return $(el).has(e.target).length || $(el).get(0) === e.target;
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
        var pending = false;

        $.each($('[data-void-gallery] img.lazyload:not(.loaded):not(.error)'), function (i, item) {
            if (!VOID_GalleryLazyload.isHidden(item)) {
                pending = true;
            }
        });
        return !pending;
    },

    addEventListener: function () {
        if (!VOID_GalleryLazyload.finish()) {
            window.addEventListener('scroll',VOID_GalleryLazyload.eventHandler);
        }
    },

    removeEventListener: function () {
        if (VOID_GalleryLazyload.finish())
            window.removeEventListener('scroll', VOID_GalleryLazyload.eventHandler);
    },

    isHidden: function (item) {
        return $(item).closest('[hidden]').length > 0;
    },

    inViewport: function (item) {
        var viewPortHeight = document.documentElement.clientHeight; //可见区域高度
        var scrollTop = document.documentElement.scrollTop || document.body.scrollTop; //滚动条距离顶部高度
        var offset = 300; // 提前 200 px 加载
        if (VOID_GalleryLazyload.isHidden(item)) {
            return false;
        }
        return $(item).offset().top - offset < viewPortHeight + scrollTop 
                    && $(item).offset().top + $(item).height() + offset > scrollTop;
    },

    callback: function () {
        $.each($('[data-void-gallery] img.lazyload:not(.loaded):not(.error)'), function (i, item) {
            if (VOID_GalleryLazyload.isHidden(item)) {
                return;
            }
            if (item.__voidLazyLoading) {
                return;
            }
            var eager = item.getAttribute && item.getAttribute('loading') === 'eager';
            if (eager || VOID_GalleryLazyload.inViewport(item)) {
                var img = new Image();
                var fetchPriority = item.getAttribute && item.getAttribute('fetchpriority');
                item.__voidLazyLoading = true;
                if (fetchPriority) {
                    img.setAttribute('fetchpriority', fetchPriority);
                }
                img.onload = function () {
                    item.__voidLazyLoading = false;
                    $(item).attr('src', $(item).attr('data-src'));
                    $(item).addClass('loaded');
                    $(item).parent().addClass('loaded');
                    VOID_GalleryLazyload.removeEventListener();
                };
                img.onerror = function () {
                    item.__voidLazyLoading = false;
                    $(item).addClass('error');
                    $(item).parent().addClass('error');
                    VOID_GalleryLazyload.removeEventListener();
                };
                img.src = $(item).attr('data-src');
            }
        });
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

    move: function () {
        var cur = document.documentElement.scrollTop;
        var step = Math.ceil(Math.abs(VOID_SmoothScroller.target - cur) / VOID_SmoothScroller.SMOOTH);

        if (Math.abs(VOID_SmoothScroller.target - cur) < 1) {
            VOID_SmoothScroller.removeEventListener();
            cancelAnimationFrame(VOID_SmoothScroller.raf);
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

    scrollTo: function (target, offset) {
        if (target === null) return;
        if (typeof(target) == 'object') {
            target = target.getBoundingClientRect().top + document.documentElement.scrollTop;
        } else if (typeof(target) == 'string') {
            target = document.querySelector(target).getBoundingClientRect().top 
                + document.documentElement.scrollTop;
        }
        if (typeof(offset) == 'number') {
            target += offset;
        }
        // 若超出顶部或无法到达
        target = Math.max(target, 0);
        target = Math.min(target, 
            document.documentElement.getBoundingClientRect().height - document.documentElement.clientHeight);

        VOID_SmoothScroller.addEventListener();
        VOID_SmoothScroller.target = target;
        VOID_SmoothScroller.move();
    },

    stop: function (event) {
        if (typeof(event) != 'undefined')
            event.preventDefault();
        VOID_SmoothScroller.scrollTo(document.documentElement.scrollTop);
    }
};

VOID_Ui = {
    checkGoTop: function () {
        if ($(document).scrollTop() > window.innerHeight) {
            $('#go-top').addClass('show');
        } else {
            $('#go-top').removeClass('show');
        }
    },

    checkHeader: function () {
        if (VOIDConfig.headerMode == 2) return;
        var tr = $('.lazy-wrap').height();
        if ($(document).scrollTop() > tr) {
            $('body>header').addClass('pull-up');
        } else {
            $('body>header').removeClass('pull-up');
        }
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

    scrollToWithHeader: function (target, extraOffset) {
        var targetTop = VOID_Ui.resolveScrollTarget(target);
        if (targetTop === null) return;

        var offset = -VOID_Ui.getHeaderOffset(targetTop);
        if (typeof(extraOffset) == 'number') {
            offset += extraOffset;
        }
        VOID_SmoothScroller.scrollTo(targetTop, offset);
    },

    checkScrollTop: function () {
        if (VOID_Util.getCookie('void_pos') != null && parseFloat(VOID_Util.getCookie('void_pos')) != -1) {
            VOID_SmoothScroller.scrollTo(parseFloat(VOID_Util.getCookie('void_pos')));
            VOID_Util.setCookie('void_pos', -1);
        } else if (window.location.hash) {
            var hashTarget = VOID_Util.getHashTarget(window.location.hash);
            if (hashTarget) {
                setTimeout(function () {
                    VOID_Ui.scrollToWithHeader(hashTarget);
                }, 50);
            } else {
                VOID_SmoothScroller.stop();
            }
        } else {
            VOID_SmoothScroller.stop();
        }
    },

    toggleSearch: function () {
        $('.mobile-search-form').toggleClass('opened');
        $('.mobile-search-form input').focus();
    },

    toggleNav: function (item) {
        $(item).toggleClass('pushed');
        $('header').toggleClass('opened');
        TOC.close();
        if ($(item).hasClass('pushed')) {
            $('#nav-mobile').fadeIn(200);
            VOID_Ui.openModal();
        }
        else {
            VOID_Ui.closeModal();
            $('#nav-mobile').fadeOut(200);
        }
    },

    toggleSettingPanel: function () {
        if(!$('body').hasClass('setting-panel-show')) {
            if ($('#login-panel').length)
                $('#login-panel').removeClass('show');
            $('#setting-panel').show();
            setTimeout(function () {
                $('body').addClass('setting-panel-show');
            }, 50); // 改变 display 时 transition 总是失效，需要延迟一下
        } else {
            $('body').removeClass('setting-panel-show');
            setTimeout(function () {
                $('#setting-panel').hide();
            }, 300);
        }
    },

    toggleSerif: function (item, serif) {
        var stylesheet;

        $('.font-indicator').removeClass('checked');
        $(item).addClass('checked');
        if (serif) {
            if (!document.getElementById('stylesheet_noto') &&
                VOIDConfig.fontStylesheets && VOIDConfig.fontStylesheets.serif) {
                stylesheet = document.createElement('link');
                stylesheet.id = 'stylesheet_noto';
                stylesheet.rel = 'stylesheet';
                stylesheet.href = VOIDConfig.fontStylesheets.serif;
                document.head.appendChild(stylesheet);
            }
            $('body').addClass('serif');
            VOID_Util.setCookie('serif', '1', 2592000); // 一个月
        } else {
            $('body').removeClass('serif');
            VOID_Util.setCookie('serif', '0', 2592000);
        }
    },

    adjustTextsize: function (up) {
        var current = parseInt($('body').attr('fontsize'));

        if (up) {
            if (current >= 5) {
                VOID.alert('已经是最大了！');
                return;
            }
            $('body').attr('fontsize', String(current + 1));
        } else {
            if (current <= 1) {
                VOID.alert('已经是最小了！');
                return;
            }
            $('body').attr('fontsize', String(current - 1));
        }

        VOID_Util.setCookie('textsize', $('body').attr('fontsize'), 2592000);
    },

    toggleLoginForm: function () {
        $('#login-panel').toggleClass('show');
        $('#login-panel input[name=referer]').val(window.location.href);

        if ($('#loggin-form').hasClass('need-refresh') && $('#login-panel').hasClass('show')) {
            $.ajax({
                type: 'POST',
                url: window.location.href,
                data: {void_action: 'getLoginAction'},
                success: function (data) {
                    if (typeof data == 'string' && data.trim() != '') {
                        $('form#loggin-form').attr('action', data.trim());
                        $('#loggin-form').removeClass('need-refresh');
                    }
                },
                error: function () {
                    VOID.alert('请求登陆参数错误。请在刷新后尝试登陆。');
                    setTimeout(function () {
                        location.reload();
                    }, 1000);
                }
            });
        }
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
        var year = '#year-' + $(item).attr('data-year');
        if ($(year).hasClass('shrink')) {
            $(item).html('-');
            $(year).removeClass('shrink');
            var num = parseInt($(item).attr('data-num'));
            $(year).css('max-height',  num * 49 + 'px');
        }
        else {
            $(item).html('+');
            $(year).addClass('shrink');
            $(year).css('max-height', '0');
        }
    },

    rememberPos: function () {
        VOID_Util.setCookie('void_pos', String($(document).scrollTop()));
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
        $('.toggle').removeClass('pushed');
        $('.mobile-search').removeClass('opened');
        $('header').removeClass('opened');
        $('#setting-panel').removeClass('show');
        if ($('body').hasClass('modal-open')) {
            VOID_Ui.closeModal();
        }
        $('#nav-mobile').fadeOut(200);
        TOC.close();
        if ($('.TOC').length > 0) {
            tocbot.destroy();
        }
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
        sensors: [],
        active: false,
        resizeHandler: null,
        masonry: function () {
            $('#masonry').addClass('masonry').masonry({
                itemSelector: '.masonry-item',
                gutter: 30,
                isAnimated: false,
                transitionDuration: 0
            });
        },
        enable: function () {
            if (this.active || !this.check() || VOIDConfig.indexStyle != 0) {
                return;
            }

            $('.masonry-item').addClass('masonry-ready');
            this.masonry();
            this.active = true;
        },
        disable: function () {
            var $masonry = $('#masonry');

            if (this.active && $masonry.length) {
                $masonry.masonry('destroy');
            }

            $masonry.removeClass('masonry');
            $('.masonry-item').removeClass('masonry-ready');
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
                VOID_Ui.MasonryCtrler.sync();
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
            $.each($('.masonry-item'), function (i, item) {
                VOID_Ui.MasonryCtrler.watch(item.id);
            });
            if ($('#masonry').length > 0 && VOIDConfig.indexStyle == 0) {
                this.bindResize();
            } else {
                this.unbindResize();
            }
            this.sync();
        },
        check: function () {
            return $('#masonry').length > 0 && window.innerWidth >= 768;
        },
        destroy: function () {
            this.disable();
            $.each(this.sensors, function (i, entry) {
                entry.sensor.detach(entry.callback);
            });
            this.sensors = [];
            this.unbindResize();
        },
        watch: function (id) {
            var el = document.getElementById(id);
            var callback;
            var i;

            for (i = 0; i < this.sensors.length; i++) {
                if (this.sensors[i].id !== id) {
                    continue;
                }
                if (this.sensors[i].element === el) {
                    return;
                }
                this.sensors[i].sensor.detach(this.sensors[i].callback);
                this.sensors.splice(i, 1);
                break;
            }

            if (!el) {
                return;
            }

            callback = function () {
                if (VOID_Ui.MasonryCtrler.active && VOID_Ui.MasonryCtrler.check()) {
                    VOID_Ui.MasonryCtrler.masonry();
                }
            };
            this.sensors.push({
                id: id,
                element: el,
                callback: callback,
                sensor: new ResizeSensor(el, callback)
            });
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

            if (rotate) {
                $('#toggle-night').addClass('switching');
            }
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

                if (rotate) {
                    window.setTimeout(function () {
                        $('#toggle-night').removeClass('switching');
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
            this.clientX = e.originalEvent.changedTouches[0].clientX;
            this.clientY = e.originalEvent.changedTouches[0].clientY;
        },

        end: function (e) {
            // 垂直滚动距离
            if (Math.abs(this.clientY - e.originalEvent.changedTouches[0].clientY) > 30) {
                $('body').removeClass('setting-panel-show');
                setTimeout(function () {
                    $('#setting-panel').hide();
                }, 300);
            }
            this.clientX = null;
            this.clientY = null;
        }
    }
};

(function () {
    if ('ontouchstart' in document) {
        $(document).on('touchstart', function (e) {
            VOID_Ui.Swiper.start(e);
        });
        // $(document).on('touchmove', function () {
        //     VOID_Ui.checkHeader();
        // });
        $(document).on('touchend', function (e) {
            VOID_Ui.Swiper.end(e);
        });
    }
    $(document).on('scroll', function () {
        VOID_Ui.checkGoTop();
        VOID_Ui.checkHeader();
        if (!('ontouchstart' in document)) {
            $('body').removeClass('setting-panel-show');
            setTimeout(function () {
                $('#setting-panel').hide();
            }, 300);
        }
    });
})();

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

VOID_Lazyload = {
    eventHandler: null,

    finish: function () {
        var pending = false;

        $.each($('img.lazyload:not(.browserlevel-lazy):not(.loaded):not(.error)'), function (i, item) {
            if (!VOID_Lazyload.isHidden(item)) {
                pending = true;
            }
        });
        return !pending;
    },

    addEventListener: function () {
        if (!VOID_Lazyload.finish()) {
            window.addEventListener('scroll',VOID_Lazyload.eventHandler);
        }
    },

    removeEventListener: function () {
        if (VOID_Lazyload.finish())
            window.removeEventListener('scroll', VOID_Lazyload.eventHandler);
    },

    isHidden: function (item) {
        return $(item).closest('[hidden]').length > 0;
    },

    inViewport: function (item) {
        var viewPortHeight = document.documentElement.clientHeight; //可见区域高度
        var scrollTop = document.documentElement.scrollTop || document.body.scrollTop; //滚动条距离顶部高度
        var offset = 300; // 提前 200 px 加载
        if (VOID_Lazyload.isHidden(item)) {
            return false;
        }
        return $(item).offset().top - offset < viewPortHeight + scrollTop 
                    && $(item).offset().top + $(item).height() + offset > scrollTop;
    },

    callback: function () {
        $.each($('img.lazyload:not(.browserlevel-lazy):not(.loaded):not(.error)'), function (i, item) {
            if (VOID_Lazyload.isHidden(item)) {
                return;
            }
            if (item.__voidLazyLoading) {
                return;
            }
            var eager = item.getAttribute && item.getAttribute('loading') === 'eager';
            if (eager || VOID_Lazyload.inViewport(item)) {
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
                    $(item).siblings('.blured-placeholder').addClass('loaded');
                    $(item).parent().addClass('loaded');
                    VOID_Lazyload.removeEventListener();
                    setTimeout(function () {
                        $(item).siblings('.remove-after').remove();
                    }, 1000);
                };
                img.onerror = function () {
                    item.__voidLazyLoading = false;
                    $(item).addClass('error');
                    $(item).parent().addClass('error');
                    VOID_Lazyload.removeEventListener();
                };
                img.src = $(item).attr('data-src');
            }
        });
        VOID_Lazyload.removeEventListener();
    },

    init: function () {
        window.removeEventListener('scroll', VOID_Lazyload.eventHandler);
        if (VOID_Lazyload.eventHandler == null)
            VOID_Lazyload.eventHandler = VOID_Util.throttle(VOID_Lazyload.callback, 200, 500);
        VOID_Lazyload.callback();
        VOID_Lazyload.addEventListener();
    }
};

VOID_BrowserLoadingLazy = {
    loadedCallback: function (item) {
        $(item).addClass('loaded');
        $(item).parent().addClass('loaded');
        setTimeout(function() {
            $(item).siblings('.remove-after').remove();
        }, 1000);
    },

    init: function () {
        $.each($('img.lazyload.browserlevel-lazy:not(.loaded):not(.error)'), function (i, item) {
            if (item.complete && item.naturalWidth !== 0) {
                VOID_BrowserLoadingLazy.loadedCallback(item);
            } else {
                item.onload = function () {
                    VOID_BrowserLoadingLazy.loadedCallback(item);
                };
                item.onerror = function () {
                    $(item).addClass('error');
                    $(item).parent().addClass('error');
                };
            }
        });
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
        $('.font-indicator').removeClass('checked');
        $(item).addClass('checked');
        if (serif) {
            if ($('#stylesheet_noto').length < 1)
                $('body').append('<link id="stylesheet_noto" href="https://fonts.googleapis.cn/css?family=Noto+Serif+SC:400,700&amp;display=swap&amp;subset=chinese-simplified" rel="stylesheet">');
            $('body').addClass('serif');
            VOID_Util.setCookie('serif', '1', 2592000); // 一个月
        } else {
            if ($('#stylesheet_droid').length < 1)
                $('body').append('<link id="stylesheet_droid" href="https://fonts.googleapis.cn/css?family=Droid+Serif:400,700&amp;display=swap" rel="stylesheet">');
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
        VOID_Lazyload.init();
        VOID_BrowserLoadingLazy.init();
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

    MasonryCtrler: {
        masonry: function () {
            $('#masonry').addClass('masonry').masonry({
                itemSelector: '.masonry-item',
                gutter: 30,
                isAnimated: false,
                transitionDuration: 0
            });
        },
        init: function () {
            if (VOID_Ui.MasonryCtrler.check() && VOIDConfig.indexStyle == 0) {
                $('.masonry-item').addClass('masonry-ready');
                VOID_Ui.MasonryCtrler.masonry();
            }
            $('.masonry-item').addClass('done');
        },
        check: function () {
            return $('#masonry').length && window.innerWidth >= 768;
        },
        watch: function (id) {
            var el = document.getElementById(id);
            new ResizeSensor(el, function () {
                if (VOID_Ui.MasonryCtrler.check() && $('#masonry').hasClass('masonry')) {
                    VOID_Ui.MasonryCtrler.masonry();
                }
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

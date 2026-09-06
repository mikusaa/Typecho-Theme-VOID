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
    headroomElement: null,
    headroomInstance: null,

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

    lazyload: function () {
        VOID_GalleryLazyload.init();
    },

    headroom: function () {
        var header = document.querySelector('body>header');

        if (VOIDConfig.headerMode != 0 || !header) {
            VOID_Ui.destroyHeadroom();
            return;
        }
        if (VOID_Ui.headroomElement === header && VOID_Ui.headroomInstance) {
            return;
        }

        VOID_Ui.destroyHeadroom();
        VOID_Ui.headroomElement = header;
        VOID_Ui.headroomInstance = new Headroom(header, { offset: 60 });
        VOID_Ui.headroomInstance.init();
    },

    destroyHeadroom: function () {
        if (VOID_Ui.headroomInstance
            && typeof VOID_Ui.headroomInstance.destroy === 'function') {
            VOID_Ui.headroomInstance.destroy();
        }
        VOID_Ui.headroomElement = null;
        VOID_Ui.headroomInstance = null;
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
    }
};

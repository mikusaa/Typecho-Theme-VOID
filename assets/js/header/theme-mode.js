VOID_Ui.DarkModeSwitcher = {
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
};

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class FakeClassList {
    constructor() {
        this.values = new Set();
    }

    contains(name) {
        return this.values.has(name);
    }

    toggle(name, force) {
        const enabled = force === undefined ? !this.values.has(name) : !!force;
        if (enabled) {
            this.values.add(name);
        } else {
            this.values.delete(name);
        }
        return enabled;
    }
}

class FakeMediaQuery {
    constructor(matches) {
        this.matches = matches;
        this.listeners = new Set();
        this.addCount = 0;
        this.removeCount = 0;
    }

    addEventListener(name, listener) {
        if (name === 'change') {
            this.addCount += 1;
            this.listeners.add(listener);
        }
    }

    removeEventListener(name, listener) {
        if (name === 'change') {
            this.removeCount += 1;
            this.listeners.delete(listener);
        }
    }

    emit(matches) {
        this.matches = matches;
        this.listeners.forEach((listener) => listener({ matches }));
    }
}

function loadThemeEnvironment(mode, prefersDark = false) {
    const cookies = new Map();
    const colorQuery = new FakeMediaQuery(prefersDark);
    const reducedMotionQuery = new FakeMediaQuery(true);
    const html = { classList: new FakeClassList(), style: {} };
    const body = { classList: new FakeClassList() };
    const controlAttributes = new Map();
    const control = {
        setAttribute(name, value) {
            controlAttributes.set(name, String(value));
        }
    };
    const document = {
        body,
        documentElement: html,
        querySelector(selector) {
            return selector === '#toggle-night button' ? control : null;
        }
    };

    Object.defineProperty(document, 'cookie', {
        get() {
            return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
        },
        set(serialized) {
            const parts = serialized.split(';');
            const separator = parts[0].indexOf('=');
            const name = parts[0].slice(0, separator);
            const value = parts[0].slice(separator + 1);
            if (parts.some((part) => part.trim().toLowerCase() === 'max-age=0')) {
                cookies.delete(name);
            } else {
                cookies.set(name, value);
            }
        }
    });

    function jQuery() {
        const api = {
            addClass() { return api; },
            removeClass() { return api; },
            on() { return api; }
        };
        return api;
    }

    const window = {
        clearTimeout() {},
        matchMedia(query) {
            return query === '(prefers-color-scheme: dark)' ? colorQuery : reducedMotionQuery;
        },
        setTimeout(callback) {
            callback();
            return 1;
        }
    };
    window.window = window;

    const context = {
        $: jQuery,
        VOIDConfig: { colorScheme: mode },
        console,
        document,
        jQuery,
        window
    };

    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/header.js'), 'utf8'),
        context
    );

    return {
        body,
        colorQuery,
        context,
        controlAttributes,
        cookies,
        html,
        switcher: context.VOID_Ui.DarkModeSwitcher
    };
}

test('only modes 1, 2 and 3 remain valid at runtime', () => {
    const environment = loadThemeEnvironment(3);

    for (const [configured, expected] of [[1, 1], ['2', 2], [3, 3], [0, 3], ['0', 3], [4, 3], ['invalid', 3]]) {
        environment.context.VOIDConfig.colorScheme = configured;
        assert.equal(environment.switcher.getMode(), expected);
    }
});

test('device mode applies and tracks the media preference without duplicate listeners', () => {
    const { body, colorQuery, html, switcher } = loadThemeEnvironment(3, true);

    switcher.checkColorScheme();
    assert.equal(html.classList.contains('theme-dark'), true);
    assert.equal(body.classList.contains('theme-dark'), true);
    assert.equal(html.style.colorScheme, 'dark');
    assert.equal(colorQuery.listeners.size, 1);

    colorQuery.emit(false);
    assert.equal(html.classList.contains('theme-dark'), false);
    assert.equal(body.classList.contains('theme-dark'), false);
    assert.equal(html.style.colorScheme, 'light');

    switcher.checkColorScheme();
    assert.equal(colorQuery.listeners.size, 1);
    assert.equal(colorQuery.addCount, 2);
    assert.equal(colorQuery.removeCount, 1);
});

test('fixed modes do not subscribe to device changes', () => {
    const light = loadThemeEnvironment(1, true);
    light.switcher.checkColorScheme();
    assert.equal(light.html.classList.contains('theme-dark'), false);
    assert.equal(light.colorQuery.listeners.size, 0);

    const dark = loadThemeEnvironment(2, false);
    dark.switcher.checkColorScheme();
    assert.equal(dark.html.classList.contains('theme-dark'), true);
    assert.equal(dark.colorQuery.listeners.size, 0);
});

test('manual cycle overrides device mode and restores live device following', () => {
    const environment = loadThemeEnvironment(3, true);
    const { colorQuery, controlAttributes, cookies, html, switcher } = environment;

    switcher.checkColorScheme();
    switcher.toggleByHand();
    assert.equal(cookies.get('void_theme_override'), 'light');
    assert.equal(html.classList.contains('theme-dark'), false);
    assert.equal(colorQuery.listeners.size, 0);
    assert.equal(controlAttributes.get('data-theme-state'), 'light');

    switcher.toggleByHand();
    assert.equal(cookies.get('void_theme_override'), 'dark');
    assert.equal(html.classList.contains('theme-dark'), true);
    assert.equal(controlAttributes.get('data-theme-state'), 'dark');

    colorQuery.matches = false;
    switcher.toggleByHand();
    assert.equal(cookies.has('void_theme_override'), false);
    assert.equal(html.classList.contains('theme-dark'), false);
    assert.equal(colorQuery.listeners.size, 1);
    assert.equal(controlAttributes.get('data-theme-state'), 'auto');
});

test('time-based configuration and scheduling are absent from runtime sources', () => {
    const headerSource = fs.readFileSync(path.resolve(__dirname, '../../assets/header.js'), 'utf8');
    const headTemplate = fs.readFileSync(path.resolve(__dirname, '../../includes/head.php'), 'utf8');
    const advancedSample = fs.readFileSync(path.resolve(__dirname, '../../advanceSetting.sample.json'), 'utf8');

    for (const source of [headerSource, headTemplate, advancedSample]) {
        assert.doesNotMatch(source, /darkModeTime|scheduleTimeChange|isTimeDark/);
    }
});

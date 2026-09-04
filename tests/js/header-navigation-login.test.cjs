const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class FakeClassList {
    constructor(initial = []) {
        this.values = new Set(initial);
    }

    add(name) {
        this.values.add(name);
    }

    contains(name) {
        return this.values.has(name);
    }

    remove(name) {
        this.values.delete(name);
    }

    toggle(name) {
        if (this.values.has(name)) {
            this.values.delete(name);
            return false;
        }
        this.values.add(name);
        return true;
    }
}

function createElement(options = {}) {
    return {
        attributes: new Map(Object.entries(options.attributes || {})),
        classList: new FakeClassList(options.classes),
        focused: false,
        style: {},
        visible: options.visible !== false
    };
}

function loadHeaderEnvironment() {
    const body = createElement();
    const form = createElement({ attributes: { action: '/old-login' } });
    const goTop = createElement();
    const header = createElement();
    const loginPanel = createElement({ classes: ['show'] });
    const lazyWrap = createElement();
    lazyWrap.height = 320;
    const nav = createElement({ visible: false });
    const referer = createElement({ attributes: { value: '' } });
    const searchForm = createElement();
    const searchInput = createElement();
    const settingPanel = createElement({ visible: false });
    const toggle = createElement();
    const alerts = [];
    const ajaxCalls = [];
    const timers = [];
    let reloadCount = 0;

    const selectors = new Map([
        ['body', [body]],
        ['form#loggin-form', [form]],
        ['#go-top', [goTop]],
        ['header', [header]],
        ['body>header', [header]],
        ['#login-panel', [loginPanel]],
        ['#login-panel input[name=referer]', [referer]],
        ['#loggin-form', [form]],
        ['.lazy-wrap', [lazyWrap]],
        ['#nav-mobile', [nav]],
        ['.mobile-search', [searchForm]],
        ['.mobile-search-form', [searchForm]],
        ['.mobile-search-form input', [searchInput]],
        ['#setting-panel', [settingPanel]],
        ['.toggle', [toggle]],
        ['.TOC', []]
    ]);

    function itemsFor(selector) {
        if (typeof selector === 'string') {
            return selectors.get(selector) || [];
        }
        return selector ? [selector] : [];
    }

    function jQuery(selector) {
        const items = itemsFor(selector);
        const api = {
            length: items.length,
            addClass(name) {
                items.forEach((item) => item.classList.add(name));
                return api;
            },
            attr(name, value) {
                if (value === undefined) {
                    return items[0] ? items[0].attributes.get(name) : undefined;
                }
                items.forEach((item) => item.attributes.set(name, String(value)));
                return api;
            },
            fadeIn() {
                items.forEach((item) => { item.visible = true; });
                return api;
            },
            fadeOut() {
                items.forEach((item) => { item.visible = false; });
                return api;
            },
            focus() {
                items.forEach((item) => { item.focused = true; });
                return api;
            },
            get(index) {
                return items[index];
            },
            has() {
                return { length: 0 };
            },
            hasClass(name) {
                return !!items[0] && items[0].classList.contains(name);
            },
            height() {
                return items[0] ? items[0].height : 0;
            },
            hide() {
                items.forEach((item) => { item.visible = false; });
                return api;
            },
            on() {
                return api;
            },
            removeClass(name) {
                items.forEach((item) => item.classList.remove(name));
                return api;
            },
            scrollTop() {
                return document.scrollingElement.scrollTop;
            },
            show() {
                items.forEach((item) => { item.visible = true; });
                return api;
            },
            toggleClass(name) {
                items.forEach((item) => item.classList.toggle(name));
                return api;
            },
            val(value) {
                if (value === undefined) {
                    return items[0] ? items[0].attributes.get('value') : undefined;
                }
                items.forEach((item) => item.attributes.set('value', String(value)));
                return api;
            }
        };
        return api;
    }

    jQuery.ajax = (options) => ajaxCalls.push(options);
    jQuery.each = (collection, callback) => {
        const items = collection.items || collection;
        for (let index = 0; index < items.length; index += 1) {
            callback(index, items[index]);
        }
    };

    const document = {
        body,
        cookie: '',
        documentElement: createElement(),
        getElementById() {
            return null;
        },
        head: { appendChild() {} },
        querySelector() {
            return null;
        },
        scrollingElement: { scrollTop: 240 }
    };
    const location = {
        href: 'https://example.test/archives/245.html',
        reload() {
            reloadCount += 1;
        }
    };
    const window = {
        clearTimeout() {},
        innerHeight: 844,
        innerWidth: 390,
        location,
        setTimeout(callback, delay) {
            timers.push({ callback, delay });
            return timers.length;
        }
    };
    window.window = window;

    const context = {
        $: jQuery,
        Image: function Image() {},
        ResizeSensor: function ResizeSensor() {},
        VOID: {
            alert(message) {
                alerts.push(message);
            }
        },
        VOIDConfig: { indexStyle: 1 },
        console,
        document,
        jQuery,
        location,
        setTimeout: window.setTimeout,
        tocbot: { destroy() {} },
        window
    };

    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/header.js'), 'utf8'),
        context
    );

    return {
        ajaxCalls,
        alerts,
        body,
        context,
        document,
        flushTimer(delay) {
            const timer = timers.find((candidate) => candidate.delay === delay);
            assert.ok(timer, `expected a ${delay}ms timer`);
            timers.splice(timers.indexOf(timer), 1);
            timer.callback();
        },
        form,
        goTop,
        header,
        lazyWrap,
        loginPanel,
        nav,
        referer,
        reloadCount: () => reloadCount,
        searchForm,
        searchInput,
        settingPanel,
        toggle
    };
}

test('mobile search toggles without replacing the input and focuses it', () => {
    const environment = loadHeaderEnvironment();

    environment.context.VOID_Ui.toggleSearch();
    assert.equal(environment.searchForm.classList.contains('opened'), true);
    assert.equal(environment.searchInput.focused, true);

    environment.context.VOID_Ui.toggleSearch();
    assert.equal(environment.searchForm.classList.contains('opened'), false);
});

test('scroll state toggles the return control and pull-up header at their existing thresholds', () => {
    const environment = loadHeaderEnvironment();

    environment.document.scrollingElement.scrollTop = 900;
    environment.context.VOID_Ui.checkGoTop();
    environment.context.VOID_Ui.checkHeader();
    assert.equal(environment.goTop.classList.contains('show'), true);
    assert.equal(environment.header.classList.contains('pull-up'), true);

    environment.document.scrollingElement.scrollTop = 100;
    environment.context.VOID_Ui.checkGoTop();
    environment.context.VOID_Ui.checkHeader();
    assert.equal(environment.goTop.classList.contains('show'), false);
    assert.equal(environment.header.classList.contains('pull-up'), false);
});

test('mobile navigation preserves modal scroll lock and reset cleanup', () => {
    const environment = loadHeaderEnvironment();

    environment.body.classList.add('sidebar-show');
    environment.context.VOID_Ui.toggleNav(environment.toggle);

    assert.equal(environment.toggle.classList.contains('pushed'), true);
    assert.equal(environment.header.classList.contains('opened'), true);
    assert.equal(environment.nav.visible, true);
    assert.equal(environment.body.classList.contains('modal-open'), true);
    assert.equal(environment.body.classList.contains('sidebar-show'), false);
    assert.equal(environment.body.style.top, '-240px');

    environment.context.VOID_Ui.reset();

    assert.equal(environment.toggle.classList.contains('pushed'), false);
    assert.equal(environment.header.classList.contains('opened'), false);
    assert.equal(environment.nav.visible, false);
    assert.equal(environment.body.classList.contains('modal-open'), false);
    assert.equal(environment.document.scrollingElement.scrollTop, 240);
});

test('setting panel keeps its delayed open and close transition contract', () => {
    const environment = loadHeaderEnvironment();

    environment.context.VOID_Ui.toggleSettingPanel();
    assert.equal(environment.settingPanel.visible, true);
    assert.equal(environment.loginPanel.classList.contains('show'), false);
    assert.equal(environment.body.classList.contains('setting-panel-show'), false);

    environment.flushTimer(50);
    assert.equal(environment.body.classList.contains('setting-panel-show'), true);

    environment.context.VOID_Ui.toggleSettingPanel();
    assert.equal(environment.body.classList.contains('setting-panel-show'), false);
    assert.equal(environment.settingPanel.visible, true);

    environment.flushTimer(300);
    assert.equal(environment.settingPanel.visible, false);
});

test('login action refresh accepts a trimmed non-empty response', () => {
    const environment = loadHeaderEnvironment();

    environment.loginPanel.classList.remove('show');
    environment.form.classList.add('need-refresh');
    environment.context.VOID_Ui.toggleLoginForm();

    assert.equal(environment.ajaxCalls.length, 1);
    assert.equal(environment.ajaxCalls[0].type, 'POST');
    assert.equal(environment.ajaxCalls[0].url, environment.context.window.location.href);
    assert.equal(environment.ajaxCalls[0].data.void_action, 'getLoginAction');
    assert.equal(environment.referer.attributes.get('value'), environment.context.window.location.href);

    environment.ajaxCalls[0].success('  /admin/login.php  ');
    assert.equal(environment.form.attributes.get('action'), '/admin/login.php');
    assert.equal(environment.form.classList.contains('need-refresh'), false);
});

test('empty login action keeps the old action stale for a later retry', () => {
    const environment = loadHeaderEnvironment();

    environment.loginPanel.classList.remove('show');
    environment.form.classList.add('need-refresh');
    environment.context.VOID_Ui.toggleLoginForm();
    environment.ajaxCalls[0].success('  ');

    assert.equal(environment.form.attributes.get('action'), '/old-login');
    assert.equal(environment.form.classList.contains('need-refresh'), true);
});

test('login action failure warns and reloads after the existing delay', () => {
    const environment = loadHeaderEnvironment();

    environment.loginPanel.classList.remove('show');
    environment.form.classList.add('need-refresh');
    environment.context.VOID_Ui.toggleLoginForm();
    environment.ajaxCalls[0].error();

    assert.deepEqual(environment.alerts, ['请求登陆参数错误。请在刷新后尝试登陆。']);
    assert.equal(environment.reloadCount(), 0);

    environment.flushTimer(1000);
    assert.equal(environment.reloadCount(), 1);
});

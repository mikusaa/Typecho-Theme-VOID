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

function createElement(options = {}) {
    const listeners = new Map();
    const queries = new Map();
    const element = {
        attributes: new Map(Object.entries(options.attributes || {})),
        classList: new FakeClassList(options.classes),
        focused: false,
        hidden: options.hidden === true,
        isConnected: true,
        style: {},
        textContent: options.textContent || '',
        value: options.value || '',
        addEventListener(name, listener) {
            const current = listeners.get(name) || new Set();
            current.add(listener);
            listeners.set(name, current);
        },
        contains(target) {
            if (target === element) return true;
            return Array.from(queries.values()).some((items) => items.includes(target));
        },
        dispatch(name, event) {
            Array.from(listeners.get(name) || []).forEach((listener) => listener(event));
        },
        focus() {
            this.focused = true;
        },
        getAttribute(name) {
            return this.attributes.has(name) ? this.attributes.get(name) : null;
        },
        getBoundingClientRect() {
            return { height: options.height || 0 };
        },
        listenerCount(name) {
            return (listeners.get(name) || new Set()).size;
        },
        querySelector(selector) {
            return (queries.get(selector) || [])[0] || null;
        },
        querySelectorAll(selector) {
            return queries.get(selector) || [];
        },
        removeEventListener(name, listener) {
            if (listeners.has(name)) listeners.get(name).delete(listener);
        },
        setAttribute(name, value) {
            this.attributes.set(name, String(value));
        },
        setQuery(selector, items) {
            queries.set(selector, items);
        }
    };
    return element;
}

function loadHeaderEnvironment() {
    const body = createElement({ attributes: { fontsize: '3' } });
    const form = createElement({ attributes: { action: '/old-login' } });
    const goTop = createElement();
    const header = createElement();
    const loginPanel = createElement({ classes: ['show'] });
    const lazyWrap = createElement({ height: 370 });
    const nav = createElement();
    const referer = createElement();
    const searchForm = createElement();
    const searchInput = createElement();
    const settingPanel = createElement({ hidden: true });
    const toggle = createElement();
    const year = createElement({ classes: ['shrink'] });
    const archiveToggle = createElement({ attributes: { 'data-num': '4', 'data-year': '2026' }, textContent: '+' });
    const alerts = [];
    const fetchCalls = [];
    const documentListeners = new Map();
    const timers = [];
    let nextTimerId = 1;
    let reloadCount = 0;

    loginPanel.setQuery('input[name=referer]', [referer]);
    searchForm.setQuery('input', [searchInput]);
    header.setQuery('.mobile-search-form.opened', [searchForm]);

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
        ['.font-indicator', []],
        ['.TOC', []]
    ]);

    function itemsFor(selector) {
        if (typeof selector === 'string') {
            const items = selectors.get(selector.replace('.opened', '')) || [];
            return selector.includes('.opened')
                ? items.filter((item) => item.classList.contains('opened'))
                : items;
        }
        return selector ? [selector] : [];
    }

    const document = {
        body,
        cookie: '',
        documentElement: createElement(),
        addEventListener(name, listener) {
            const current = documentListeners.get(name) || new Set();
            current.add(listener);
            documentListeners.set(name, current);
        },
        createElement() {
            return createElement();
        },
        getElementById(id) {
            const byId = {
                'go-top': goTop,
                'login-panel': loginPanel,
                'loggin-form': form,
                'nav-mobile': nav,
                'setting-panel': settingPanel,
                'year-2026': year
            };
            return byId[id] || null;
        },
        head: { appendChild() {} },
        querySelector(selector) {
            return itemsFor(selector)[0] || null;
        },
        querySelectorAll: itemsFor,
        removeEventListener(name, listener) {
            if (documentListeners.has(name)) documentListeners.get(name).delete(listener);
        },
        scrollingElement: { scrollTop: 240 }
    };
    document.documentElement.clientHeight = 844;
    const location = {
        href: 'https://example.test/archives/245.html',
        reload() {
            reloadCount += 1;
        }
    };
    const window = {
        fetch(url, options) {
            let rejectRequest;
            let resolveRequest;
            const promise = new Promise((resolve, reject) => {
                rejectRequest = reject;
                resolveRequest = resolve;
            });
            const call = {
                options,
                promise,
                reject: rejectRequest,
                resolveText(text, ok = true) {
                    resolveRequest({
                        ok,
                        text() {
                            return Promise.resolve(text);
                        }
                    });
                },
                url
            };
            fetchCalls.push(call);
            return promise;
        },
        innerHeight: 844,
        innerWidth: 390,
        location,
        getComputedStyle(element) {
            return element === lazyWrap
                ? {
                    borderBottomWidth: '0px',
                    borderTopWidth: '0px',
                    paddingBottom: '0px',
                    paddingTop: '50px'
                }
                : {};
        },
        setTimeout(callback, delay) {
            const id = nextTimerId++;
            timers.push({ callback, delay, id });
            return id;
        },
        clearTimeout(id) {
            const timer = timers.find((candidate) => candidate.id === id);
            if (timer) timers.splice(timers.indexOf(timer), 1);
        }
    };
    window.window = window;

    const context = {
        Image: function Image() {},
        VOID: {
            alert(message) {
                alerts.push(message);
            }
        },
        VOIDConfig: { indexStyle: 1 },
        clearTimeout: window.clearTimeout,
        console,
        document,
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
        archiveToggle,
        alerts,
        body,
        context,
        document,
        documentListenerCount(name) {
            return (documentListeners.get(name) || new Set()).size;
        },
        fetchCalls,
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
        toggle,
        year
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

    environment.document.scrollingElement.scrollTop = 321;
    environment.context.VOID_Ui.checkHeader();
    assert.equal(environment.header.classList.contains('pull-up'), true);

    environment.document.scrollingElement.scrollTop = 320;
    environment.context.VOID_Ui.checkHeader();
    assert.equal(environment.header.classList.contains('pull-up'), false);

    environment.document.scrollingElement.scrollTop = 845;
    environment.context.VOID_Ui.checkGoTop();
    assert.equal(environment.goTop.classList.contains('show'), true);
    environment.document.scrollingElement.scrollTop = 844;
    environment.context.VOID_Ui.checkGoTop();
    assert.equal(environment.goTop.classList.contains('show'), false);
});

test('mobile navigation preserves modal scroll lock and reset cleanup', () => {
    const environment = loadHeaderEnvironment();

    environment.body.classList.add('sidebar-show');
    environment.context.VOID_Ui.toggleNav(environment.toggle);

    assert.equal(environment.toggle.classList.contains('pushed'), true);
    assert.equal(environment.header.classList.contains('opened'), true);
    assert.equal(environment.body.classList.contains('modal-open'), true);
    assert.equal(environment.body.classList.contains('sidebar-show'), false);
    assert.equal(environment.body.style.top, '-240px');

    environment.context.VOID_Ui.reset();

    assert.equal(environment.toggle.classList.contains('pushed'), false);
    assert.equal(environment.header.classList.contains('opened'), false);
    assert.equal(environment.body.classList.contains('modal-open'), false);
    assert.equal(environment.document.scrollingElement.scrollTop, 240);
});

test('setting panel keeps its delayed open and close transition contract', () => {
    const environment = loadHeaderEnvironment();

    environment.context.VOID_Ui.toggleSettingPanel();
    assert.equal(environment.settingPanel.hidden, false);
    assert.equal(environment.loginPanel.classList.contains('show'), false);
    assert.equal(environment.body.classList.contains('setting-panel-show'), false);

    environment.flushTimer(50);
    assert.equal(environment.body.classList.contains('setting-panel-show'), true);

    environment.context.VOID_Ui.toggleSettingPanel();
    assert.equal(environment.body.classList.contains('setting-panel-show'), false);
    assert.equal(environment.settingPanel.hidden, false);

    environment.flushTimer(300);
    assert.equal(environment.settingPanel.hidden, true);
});

test('login action refresh accepts a trimmed non-empty response', async () => {
    const environment = loadHeaderEnvironment();

    environment.loginPanel.classList.remove('show');
    environment.form.classList.add('need-refresh');
    environment.context.VOID_Ui.toggleLoginForm();

    assert.equal(environment.fetchCalls.length, 1);
    assert.equal(environment.fetchCalls[0].options.method, 'POST');
    assert.equal(environment.fetchCalls[0].url, environment.context.window.location.href);
    assert.equal(environment.fetchCalls[0].options.body, 'void_action=getLoginAction');
    assert.equal(environment.fetchCalls[0].options.credentials, 'same-origin');
    assert.equal(environment.referer.value, environment.context.window.location.href);

    const actionRequest = environment.context.VOID_Ui.loginActionRequest;
    environment.fetchCalls[0].resolveText('  /admin/login.php  ');
    await actionRequest;
    assert.equal(environment.form.getAttribute('action'), '/admin/login.php');
    assert.equal(environment.form.classList.contains('need-refresh'), false);
});

test('empty login action keeps the old action stale for a later retry', async () => {
    const environment = loadHeaderEnvironment();

    environment.loginPanel.classList.remove('show');
    environment.form.classList.add('need-refresh');
    environment.context.VOID_Ui.toggleLoginForm();
    const actionRequest = environment.context.VOID_Ui.loginActionRequest;
    environment.fetchCalls[0].resolveText('  ');
    await actionRequest;

    assert.equal(environment.form.getAttribute('action'), '/old-login');
    assert.equal(environment.form.classList.contains('need-refresh'), true);
});

test('login action failure warns and reloads after the existing delay', async () => {
    const environment = loadHeaderEnvironment();

    environment.loginPanel.classList.remove('show');
    environment.form.classList.add('need-refresh');
    environment.context.VOID_Ui.toggleLoginForm();
    const actionRequest = environment.context.VOID_Ui.loginActionRequest;
    environment.fetchCalls[0].reject(new Error('network'));
    await actionRequest;

    assert.deepEqual(environment.alerts, ['请求登陆参数错误。请在刷新后尝试登陆。']);
    assert.equal(environment.reloadCount(), 0);

    environment.flushTimer(1000);
    assert.equal(environment.reloadCount(), 1);
});

test('login action HTTP errors use the same warning and reload fallback', async () => {
    const environment = loadHeaderEnvironment();

    environment.loginPanel.classList.remove('show');
    environment.form.classList.add('need-refresh');
    environment.context.VOID_Ui.toggleLoginForm();
    const actionRequest = environment.context.VOID_Ui.loginActionRequest;
    environment.fetchCalls[0].resolveText('unavailable', false);
    await actionRequest;

    assert.deepEqual(environment.alerts, ['请求登陆参数错误。请在刷新后尝试登陆。']);
    environment.flushTimer(1000);
    assert.equal(environment.reloadCount(), 1);
});

test('PJAX invalidation ignores stale login work and fetches the new action', async () => {
    const environment = loadHeaderEnvironment();

    environment.loginPanel.classList.remove('show');
    environment.form.classList.add('need-refresh');
    environment.context.VOID_Ui.toggleLoginForm();
    assert.equal(environment.fetchCalls.length, 1);

    const staleRequest = environment.context.VOID_Ui.loginActionRequest;
    environment.context.VOID_Ui.invalidateLoginAction();
    environment.context.window.location.href = 'https://example.test/archives/246.html';
    environment.fetchCalls[0].resolveText('/stale-login');
    await staleRequest;

    assert.equal(environment.form.getAttribute('action'), '/old-login');
    assert.equal(environment.form.classList.contains('need-refresh'), true);

    environment.context.VOID_Ui.toggleLoginForm();
    environment.context.VOID_Ui.toggleLoginForm();
    assert.equal(environment.fetchCalls.length, 2);
    assert.equal(environment.fetchCalls[1].url, 'https://example.test/archives/246.html');
});

test('TOC, click containment, archive toggles, and global listeners use native state', () => {
    const environment = loadHeaderEnvironment();
    const child = environment.searchInput;

    environment.context.TOC.open();
    assert.equal(environment.body.classList.contains('sidebar-show'), true);
    environment.context.TOC.toggle();
    assert.equal(environment.body.classList.contains('sidebar-show'), false);
    assert.equal(environment.context.VOID_Util.clickIn({ target: child }, '.mobile-search-form'), true);
    assert.equal(environment.context.VOID_Util.clickIn({ target: child }, '#setting-panel'), false);

    environment.context.VOID_Ui.toggleArchive(environment.archiveToggle);
    assert.equal(environment.archiveToggle.textContent, '-');
    assert.equal(environment.year.classList.contains('shrink'), false);
    assert.equal(environment.year.style.maxHeight, '196px');
    environment.context.VOID_Ui.toggleArchive(environment.archiveToggle);
    assert.equal(environment.archiveToggle.textContent, '+');
    assert.equal(environment.year.style.maxHeight, '0');

    environment.context.VOID_Ui.adjustTextsize(true);
    assert.equal(environment.body.getAttribute('fontsize'), '4');
    assert.match(environment.document.cookie, /^textsize=4;/);

    assert.equal(environment.documentListenerCount('scroll'), 1);
    environment.context.VOID_Ui.bindGlobalEvents();
    environment.context.VOID_Ui.bindGlobalEvents();
    assert.equal(environment.documentListenerCount('scroll'), 1);
    environment.context.VOID_Ui.unbindGlobalEvents();
    assert.equal(environment.documentListenerCount('scroll'), 0);
    assert.equal(environment.context.VOID_Ui.globalEventsBound, false);

    environment.context.VOID_Ui.bindDismissEvents();
    environment.context.VOID_Ui.bindDismissEvents();
    assert.equal(environment.body.listenerCount('click'), 1);
    environment.searchForm.classList.add('opened');
    const event = {
        prevented: false,
        stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; },
        target: createElement()
    };
    environment.body.dispatch('click', event);
    assert.equal(environment.searchForm.classList.contains('opened'), false);
    assert.equal(event.prevented, true);
    assert.equal(event.stopped, true);
});

test('stage 6 removes jQuery from the frontend build boundary', () => {
    const headerSource = fs.readFileSync(path.resolve(__dirname, '../../assets/header.js'), 'utf8');
    const bannerTemplate = fs.readFileSync(path.resolve(__dirname, '../../includes/banner.php'), 'utf8');
    const footerTemplate = fs.readFileSync(path.resolve(__dirname, '../../includes/footer.php'), 'utf8');
    const headerStyles = fs.readFileSync(path.resolve(__dirname, '../../assets/parts/_header.scss'), 'utf8');
    const gulpfile = fs.readFileSync(path.resolve(__dirname, '../../gulpfile.js'), 'utf8');
    const jQueryReference = /\$\s*\(|\$\s*\.|\bjQuery\b/;

    assert.doesNotMatch(headerSource, jQueryReference);
    assert.doesNotMatch(headerSource, /\bResizeSensor\b/);
    assert.match(headerSource, /new Masonry\(this\.container,/);
    assert.doesNotMatch(gulpfile, /ResizeSensor/);
    assert.equal(fs.existsSync(path.resolve(__dirname, '../../assets/libs/header/ResizeSensor')), false);
    assert.doesNotMatch(gulpfile, /assets\/libs\/header\/jquery\/jquery\.min\.js/);
    assert.equal(fs.existsSync(path.resolve(__dirname, '../../assets/libs/header/jquery/jquery.min.js')), false);
    assert.equal(fs.existsSync(path.resolve(__dirname, '../../assets/libs/header/masonry/masonry.min.js')), true);
    assert.doesNotMatch(bannerTemplate, jQueryReference);
    assert.doesNotMatch(footerTemplate, jQueryReference);
    assert.match(headerStyles, /transition: opacity 0\.2s[^;]+visibility 0s linear 0\.2s/);
    assert.match(headerStyles, /#nav-mobile\{[\s\S]*?display: block;/);
    assert.match(headerStyles, /header\.opened \+ #nav-mobile/);
    assert.match(headerStyles, /prefers-reduced-motion: reduce/);
});

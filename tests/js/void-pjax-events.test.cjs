const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { readVoidModule, readVoidSource } = require('./helpers/void-source.cjs');

class FakeEventTarget {
    constructor(parentNode = null) {
        this.parentNode = parentNode;
        this.listeners = new Map();
    }

    addEventListener(name, listener) {
        const listeners = this.listeners.get(name) || [];
        listeners.push(listener);
        this.listeners.set(name, listeners);
    }

    removeEventListener(name, listener) {
        const listeners = this.listeners.get(name) || [];
        this.listeners.set(name, listeners.filter((candidate) => candidate !== listener));
    }

    dispatchEvent(event) {
        if (!event.target) {
            event.target = this;
        }
        event.currentTarget = this;
        (this.listeners.get(event.type) || []).slice().forEach((listener) => listener.call(this, event));
        if (event.bubbles && this.parentNode) {
            this.parentNode.dispatchEvent(event);
        }
        return !event.defaultPrevented;
    }

    listenerCount(name) {
        return (this.listeners.get(name) || []).length;
    }
}

class FakeCustomEvent {
    constructor(type, init = {}) {
        this.type = type;
        this.bubbles = !!init.bubbles;
        this.cancelable = !!init.cancelable;
        this.detail = init.detail;
        this.defaultPrevented = false;
        this.target = null;
        this.currentTarget = null;
    }

    preventDefault() {
        if (this.cancelable) {
            this.defaultPrevented = true;
        }
    }
}

function createPjaxContainer(parentNode = null) {
    const container = new FakeEventTarget(parentNode);
    container.querySelector = () => null;
    container.querySelectorAll = () => [];
    return container;
}

function createPjaxResponse(url = 'https://example.test/next') {
    return {
        ok: true,
        text: () => Promise.resolve('<main id="pjax-container"></main>'),
        url
    };
}

function loadPjaxEnvironment(options = {}) {
    const document = new FakeEventTarget();
    const initialContainer = createPjaxContainer(document);
    const commentContainer = createPjaxContainer(document);
    const nextContainer = createPjaxContainer();
    const adoptedContainer = createPjaxContainer();
    let currentContainer = initialContainer;
    let jqueryTriggerCount = 0;
    let replaceObserver = () => {};
    let replacementCount = 0;

    document.importNode = (node) => {
        assert.equal(node, nextContainer);
        return adoptedContainer;
    };
    document.querySelector = (selector) => {
        if (selector === '#pjax-container') {
            return currentContainer;
        }
        return selector === '#comments' ? commentContainer : null;
    };
    document.replaceChild = (next, current) => {
        assert.equal(current, currentContainer);
        replaceObserver();
        replacementCount += 1;
        current.parentNode = null;
        next.parentNode = document;
        currentContainer = next;
    };
    document.title = 'Start';

    function DOMParser() {}
    DOMParser.prototype.parseFromString = () => ({
        querySelector: () => options.invalidFragment ? null : nextContainer,
        title: 'Next'
    });

    const jQuery = (target) => ({
        on(name, listener) {
            target.addEventListener(name, (event) => listener.call(target, {
                type: event.type,
                originalEvent: event
            }));
            return this;
        },
        trigger() {
            jqueryTriggerCount += 1;
            return this;
        }
    });
    const window = Object.assign(new FakeEventTarget(), {
        AbortController: options.AbortController,
        CustomEvent: FakeCustomEvent,
        DOMParser,
        Promise,
        URL,
        clearTimeout,
        console,
        document,
        fetch: () => Promise.reject(new Error('expected test failure')),
        history: {
            pushState() {},
            replaceState() {}
        },
        jQuery,
        location: {
            href: 'https://example.test/start',
            origin: 'https://example.test'
        },
        scrollTo() {},
        setTimeout
    });
    window.window = window;

    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/libs/pjax/void-pjax.js'), 'utf8'),
        {
            AbortController: options.AbortController,
            DOMParser,
            document,
            Promise,
            URL,
            window
        }
    );

    return {
        adoptedContainer,
        commentContainer,
        document,
        getCurrentContainer: () => currentContainer,
        getJqueryTriggerCount: () => jqueryTriggerCount,
        getReplacementCount: () => replacementCount,
        initialContainer,
        jQuery,
        setReplaceObserver: (observer) => {
            replaceObserver = observer;
        },
        window
    };
}

function loadVoidEnvironment(options = {}) {
    const bindingCounts = new Map();
    const jqueryBindingCounts = new Map();
    const loginFormClasses = new Set();
    const animationFrames = new Map();
    const mainContainer = {
        isConnected: true,
        querySelectorAll: () => []
    };
    const document = Object.assign(new FakeEventTarget(), {
        body: mainContainer,
        readyState: 'loading',
        getElementById(id) {
            return id === 'pjax-container' ? mainContainer : null;
        },
        querySelectorAll: () => []
    });
    const addEventListener = document.addEventListener.bind(document);
    document.addEventListener = (name, listener) => {
        if (name.indexOf('pjax:') === 0) {
            bindingCounts.set(name, (bindingCounts.get(name) || 0) + 1);
        }
        addEventListener(name, listener);
    };
    let nextAnimationFrameId = 1;
    const jQuery = (selector) => {
        const api = {
            length: selector === '#loggin-form' && options.loginForm ? 1 : 0,
            addClass(name) {
                if (selector === '#loggin-form' && options.loginForm) {
                    loginFormClasses.add(name);
                }
                return api;
            },
            on(name, listener) {
                jqueryBindingCounts.set(name, (jqueryBindingCounts.get(name) || 0) + 1);
                addEventListener(name, (event) => listener.call(document, {
                    type: event.type,
                    originalEvent: event
                }));
                return api;
            },
            ready() {
                return api;
            }
        };
        return api;
    };
    jQuery.each = () => {};
    jQuery.trim = (value) => String(value).trim();

    const window = {
        cancelAnimationFrame(id) {
            animationFrames.delete(id);
        },
        clearTimeout() {},
        requestAnimationFrame(callback) {
            const id = nextAnimationFrameId++;
            animationFrames.set(id, callback);
            return id;
        },
        setInterval() {},
        setTimeout() {}
    };
    window.window = window;
    const context = {
        $: jQuery,
        console: { error() {}, log() {} },
        document,
        jQuery,
        VOIDConfig: {
            enableMath: false,
            mathJaxUrl: ''
        },
        window
    };

    vm.runInNewContext(
        readVoidSource(),
        context
    );

    return {
        bindingCounts,
        context,
        flushAnimationFrame() {
            const callbacks = Array.from(animationFrames.values());
            animationFrames.clear();
            callbacks.forEach((callback) => callback());
        },
        jqueryBindingCounts,
        loginFormClasses
    };
}

function wrappedPjaxEvent(options) {
    return {
        originalEvent: {
            detail: { options }
        }
    };
}

function nativePjaxEvent(name, options, args) {
    return new FakeCustomEvent(name, {
        bubbles: true,
        cancelable: true,
        detail: {
            args: args || [null, options],
            options
        }
    });
}

function loadFooterPjaxReloadHandler(context) {
    const footer = fs.readFileSync(path.resolve(__dirname, '../../includes/footer.php'), 'utf8');
    const start = footer.indexOf('if (VOID.pjaxReloadHandler)');
    const end = footer.indexOf("<?php if(Utils::isPluginAvailable('ExSearch'))", start);
    const reloadContainers = [];
    const document = new FakeEventTarget();

    assert.notEqual(start, -1, 'footer PJAX complete handler should exist');
    assert.notEqual(end, -1, 'footer PJAX complete handler should end before ExSearch');

    const source = footer.slice(start, end).replace(
        "<?php echo $setting['pjaxreload']; ?>",
        "reloadContainers.push(options ? options.container : null);"
    );

    vm.runInNewContext(source, {
        VOID: context.VOID,
        document,
        reloadContainers
    });
    vm.runInNewContext(source, {
        VOID: context.VOID,
        document,
        reloadContainers
    });

    return {
        document,
        handler: context.VOID.pjaxReloadHandler,
        reloadContainers
    };
}

test('native and jQuery listeners receive one complete event with event detail', async () => {
    const {
        document,
        getCurrentContainer,
        getJqueryTriggerCount,
        getReplacementCount,
        initialContainer,
        jQuery,
        window
    } = loadPjaxEnvironment();
    let beforeReplaceCount = 0;
    let nativeCount = 0;
    let jqueryCount = 0;
    let nativeEvent;
    let jqueryEvent;

    document.addEventListener('pjax:complete', (event) => {
        nativeCount += 1;
        nativeEvent = event;
    });
    jQuery(document).on('pjax:complete', (event) => {
        jqueryCount += 1;
        jqueryEvent = event;
    });
    document.addEventListener('pjax:beforeReplace', () => {
        beforeReplaceCount += 1;
    });

    await window.VoidPjax.visit({
        container: '#pjax-container',
        timeout: 0,
        url: 'https://example.test/next'
    });

    assert.equal(nativeCount, 1);
    assert.equal(jqueryCount, 1);
    assert.equal(beforeReplaceCount, 0);
    assert.equal(getReplacementCount(), 0);
    assert.equal(getCurrentContainer(), initialContainer);
    assert.equal(initialContainer.parentNode, document);
    assert.equal(getJqueryTriggerCount(), 0);
    assert.equal(nativeEvent.bubbles, true);
    assert.equal(nativeEvent.cancelable, true);
    assert.equal(nativeEvent.detail.args[1], 'error');
    assert.equal(nativeEvent.detail.args[2], nativeEvent.detail.options);
    assert.equal(nativeEvent.detail.options.container, '#pjax-container');
    assert.equal(jqueryEvent.originalEvent, nativeEvent);
});

test('main and comment lifecycle events stay targeted to their own containers', async () => {
    const {
        commentContainer,
        document,
        initialContainer,
        window
    } = loadPjaxEnvironment();
    const deliveries = [];

    initialContainer.addEventListener('pjax:complete', (event) => {
        deliveries.push(`main:${event.target === initialContainer}`);
    });
    commentContainer.addEventListener('pjax:complete', (event) => {
        deliveries.push(`comments:${event.target === commentContainer}`);
    });
    document.addEventListener('pjax:complete', (event) => {
        deliveries.push(`document:${event.detail.options.container}`);
    });
    window.fetch = () => Promise.reject(new Error('expected request failure'));

    await window.VoidPjax.visit({
        container: '#pjax-container',
        timeout: 0,
        url: 'https://example.test/main'
    });
    await window.VoidPjax.visit({
        container: '#comments',
        fragment: '#comments',
        timeout: 0,
        url: 'https://example.test/comments'
    });

    assert.deepEqual(deliveries, [
        'main:true',
        'document:#pjax-container',
        'comments:true',
        'document:#comments'
    ]);
});

test('successful replacement emits one beforeReplace event while the old container is attached', async () => {
    const {
        adoptedContainer,
        document,
        getCurrentContainer,
        getJqueryTriggerCount,
        getReplacementCount,
        initialContainer,
        jQuery,
        setReplaceObserver,
        window
    } = loadPjaxEnvironment();
    const events = [];
    let resolveFetch;
    let jqueryEvent;
    let nativeEvent;
    let oldContainerAttached = false;

    window.fetch = () => new Promise((resolve) => {
        resolveFetch = resolve;
    });
    [
        'pjax:start',
        'pjax:send',
        'pjax:beforeReplace',
        'pjax:success',
        'pjax:complete',
        'pjax:end'
    ].forEach((name) => {
        document.addEventListener(name, () => events.push(name));
    });
    setReplaceObserver(() => events.push('replace'));
    document.addEventListener('pjax:beforeReplace', (event) => {
        nativeEvent = event;
        oldContainerAttached = event.target === initialContainer
            && event.target.parentNode === document
            && getCurrentContainer() === initialContainer;
    });
    jQuery(document).on('pjax:beforeReplace', (event) => {
        jqueryEvent = event;
    });

    const visit = window.VoidPjax.visit({
        container: '#pjax-container',
        timeout: 0,
        url: 'https://example.test/next'
    });

    assert.deepEqual(events, ['pjax:start', 'pjax:send']);
    assert.equal(getCurrentContainer(), initialContainer);
    assert.equal(initialContainer.parentNode, document);
    assert.equal(getReplacementCount(), 0);

    resolveFetch(createPjaxResponse());
    const replaced = await visit;

    assert.equal(replaced, true);
    assert.deepEqual(events, [
        'pjax:start',
        'pjax:send',
        'pjax:beforeReplace',
        'replace',
        'pjax:success',
        'pjax:complete',
        'pjax:end'
    ]);
    assert.equal(oldContainerAttached, true);
    assert.equal(nativeEvent.detail.args[0], adoptedContainer);
    assert.equal(nativeEvent.detail.args[1], nativeEvent.detail.options);
    assert.equal(nativeEvent.detail.options.container, '#pjax-container');
    assert.equal(jqueryEvent.originalEvent, nativeEvent);
    assert.equal(getJqueryTriggerCount(), 0);
    assert.equal(getCurrentContainer(), adoptedContainer);
    assert.equal(getReplacementCount(), 1);
    assert.equal(initialContainer.parentNode, null);
});

test('a superseded request emits abort before the replacement send', () => {
    const { document, window } = loadPjaxEnvironment();
    const events = [];

    window.fetch = () => new Promise(() => {});
    document.addEventListener('pjax:send', (event) => {
        events.push(`send:${event.detail.options.container}`);
    });
    document.addEventListener('pjax:abort', (event) => {
        events.push(`abort:${event.detail.options.container}`);
    });
    document.addEventListener('pjax:beforeReplace', (event) => {
        events.push(`beforeReplace:${event.detail.options.container}`);
    });

    window.VoidPjax.visit({
        container: '#pjax-container',
        timeout: 0,
        url: 'https://example.test/main'
    });
    window.VoidPjax.visit({
        container: '#comments',
        timeout: 0,
        url: 'https://example.test/comments'
    });

    assert.deepEqual(events, [
        'send:#pjax-container',
        'abort:#pjax-container',
        'send:#comments'
    ]);
});

test('popstate restores the recorded main-container request through PJAX', async () => {
    const { document, window } = loadPjaxEnvironment();
    let sendOptions;
    let resolveEnd;
    const ended = new Promise((resolve) => {
        resolveEnd = resolve;
    });

    window.fetch = () => Promise.resolve(createPjaxResponse('https://example.test/history'));
    document.addEventListener('pjax:send', (event) => {
        sendOptions = event.detail.options;
    });
    document.addEventListener('pjax:end', (event) => {
        if (event.detail.options.fromPopstate) {
            resolveEnd();
        }
    });
    window.VoidPjax.bind({
        container: '#pjax-container',
        fragment: '#pjax-container',
        timeout: 0
    });

    window.dispatchEvent({
        type: 'popstate',
        bubbles: false,
        state: {
            __voidPjax: true,
            url: 'https://example.test/history',
            container: '#pjax-container',
            fragment: '#pjax-container',
            scrollTop: true
        }
    });
    await ended;

    assert.equal(sendOptions.container, '#pjax-container');
    assert.equal(sendOptions.fragment, '#pjax-container');
    assert.equal(sendOptions.fromPopstate, true);
    assert.equal(sendOptions.push, false);
    assert.equal(sendOptions.scrollTop, false);
});

test('popstate preserves comment-container targeting', async () => {
    const { commentContainer, document, window } = loadPjaxEnvironment();
    let sendEvent;
    let resolveEnd;
    const ended = new Promise((resolve) => {
        resolveEnd = resolve;
    });

    window.fetch = () => Promise.reject(new Error('expected request failure'));
    commentContainer.addEventListener('pjax:send', (event) => {
        sendEvent = event;
    });
    document.addEventListener('pjax:end', (event) => {
        if (event.detail.options.fromPopstate) {
            resolveEnd();
        }
    });
    window.VoidPjax.bind({
        container: '#pjax-container',
        fragment: '#pjax-container',
        timeout: 0
    });

    window.dispatchEvent({
        type: 'popstate',
        bubbles: false,
        state: {
            __voidPjax: true,
            url: 'https://example.test/comments-history',
            container: '#comments',
            fragment: '#comments',
            scrollTop: false
        }
    });
    await ended;

    assert.equal(sendEvent.target, commentContainer);
    assert.equal(sendEvent.detail.options.container, '#comments');
    assert.equal(sendEvent.detail.options.fragment, '#comments');
    assert.equal(sendEvent.detail.options.fromPopstate, true);
});

test('only the current successful request emits beforeReplace', async () => {
    const {
        document,
        getCurrentContainer,
        getReplacementCount,
        initialContainer,
        window
    } = loadPjaxEnvironment();
    const resolvers = [];
    let beforeReplaceCount = 0;

    window.fetch = () => new Promise((resolve) => resolvers.push(resolve));
    document.addEventListener('pjax:beforeReplace', () => {
        beforeReplaceCount += 1;
    });

    const staleVisit = window.VoidPjax.visit({
        container: '#pjax-container',
        timeout: 0,
        url: 'https://example.test/stale'
    });
    const currentVisit = window.VoidPjax.visit({
        container: '#pjax-container',
        timeout: 0,
        url: 'https://example.test/current'
    });

    resolvers[0](createPjaxResponse('https://example.test/stale'));
    assert.equal(await staleVisit, false);
    assert.equal(beforeReplaceCount, 0);
    assert.equal(getReplacementCount(), 0);
    assert.equal(getCurrentContainer(), initialContainer);
    assert.equal(initialContainer.parentNode, document);

    resolvers[1](createPjaxResponse('https://example.test/current'));
    assert.equal(await currentVisit, true);
    assert.equal(beforeReplaceCount, 1);
    assert.equal(getReplacementCount(), 1);
});

test('invalid replacement fragments do not emit beforeReplace', async () => {
    const {
        document,
        getCurrentContainer,
        getReplacementCount,
        initialContainer,
        window
    } = loadPjaxEnvironment({ invalidFragment: true });
    let beforeReplaceCount = 0;

    window.fetch = () => Promise.resolve(createPjaxResponse());
    document.addEventListener('pjax:beforeReplace', () => {
        beforeReplaceCount += 1;
    });

    const replaced = await window.VoidPjax.visit({
        container: '#pjax-container',
        timeout: 0,
        url: 'https://example.test/missing-fragment'
    });

    assert.equal(replaced, false);
    assert.equal(beforeReplaceCount, 0);
    assert.equal(getReplacementCount(), 0);
    assert.equal(getCurrentContainer(), initialContainer);
    assert.equal(initialContainer.parentNode, document);
});

test('timed out requests do not emit beforeReplace', async () => {
    class AbortController {
        constructor() {
            const listeners = [];
            this.signal = {
                addEventListener(name, listener) {
                    if (name === 'abort') {
                        listeners.push(listener);
                    }
                }
            };
            this.abort = () => listeners.forEach((listener) => listener());
        }
    }

    const {
        document,
        getCurrentContainer,
        getReplacementCount,
        initialContainer,
        window
    } = loadPjaxEnvironment({ AbortController });
    let beforeReplaceCount = 0;
    const events = [];

    window.fetch = (url, options) => new Promise((resolve, reject) => {
        assert.equal(url, 'https://example.test/timeout');
        assert.equal(typeof resolve, 'function');
        options.signal.addEventListener('abort', () => {
            const error = new Error('timed out');
            error.name = 'AbortError';
            reject(error);
        });
    });
    document.addEventListener('pjax:beforeReplace', () => {
        beforeReplaceCount += 1;
    });
    ['pjax:send', 'pjax:abort', 'pjax:error', 'pjax:complete', 'pjax:end'].forEach((name) => {
        document.addEventListener(name, (event) => {
            events.push(`${name}:${event.detail.options.container}`);
        });
    });

    const replaced = await window.VoidPjax.visit({
        container: '#pjax-container',
        timeout: 1,
        url: 'https://example.test/timeout'
    });

    assert.equal(replaced, false);
    assert.equal(beforeReplaceCount, 0);
    assert.equal(getReplacementCount(), 0);
    assert.equal(getCurrentContainer(), initialContainer);
    assert.equal(initialContainer.parentNode, document);
    assert.deepEqual(events, [
        'pjax:send:#pjax-container',
        'pjax:error:#pjax-container',
        'pjax:complete:#pjax-container',
        'pjax:end:#pjax-container'
    ]);
});

test('resolvePjaxOptions prefers native detail and supports legacy jQuery arguments', () => {
    const { context } = loadVoidEnvironment();
    const detailOptions = { container: '#comments' };
    const detailArgsOptions = { container: '#detail-args' };
    const legacyOptions = { container: '#pjax-container' };

    assert.equal(
        context.VOID.resolvePjaxOptions([{ detail: { options: detailOptions } }]),
        detailOptions
    );
    assert.equal(
        context.VOID.resolvePjaxOptions([wrappedPjaxEvent(detailOptions)]),
        detailOptions
    );
    assert.equal(
        context.VOID.resolvePjaxOptions([wrappedPjaxEvent(detailOptions), legacyOptions]),
        detailOptions
    );
    assert.equal(
        context.VOID.resolvePjaxOptions([{
            detail: { args: [null, 'success', detailArgsOptions] }
        }]),
        detailArgsOptions
    );
    assert.equal(
        context.VOID.resolvePjaxOptions([{
            originalEvent: { detail: { args: [null, detailArgsOptions] } }
        }]),
        detailArgsOptions
    );
    assert.equal(context.VOID.resolvePjaxOptions([{}, null, legacyOptions]), legacyOptions);
    assert.equal(context.VOID.resolvePjaxOptions([]), null);
});

test('footer pjaxreload filters native and legacy comment replacements', () => {
    const { context } = loadVoidEnvironment();
    const { document, handler, reloadContainers } = loadFooterPjaxReloadHandler(context);

    assert.equal(typeof handler, 'function');
    assert.equal(document.listenerCount('pjax:complete'), 1);

    document.dispatchEvent(nativePjaxEvent('pjax:complete', { container: '#comments' }));
    document.dispatchEvent(nativePjaxEvent('pjax:complete', { container: '#pjax-container' }));
    handler(wrappedPjaxEvent({ container: '#comments' }));
    handler(wrappedPjaxEvent({ container: '#pjax-container' }));
    handler({}, null, 'success', { container: '#comments' });
    handler({}, null, 'success', { container: '#pjax-container' });
    handler({});

    assert.deepEqual(reloadContainers, [
        '#pjax-container',
        '#pjax-container',
        '#pjax-container',
        null
    ]);
});

test('theme-owned PJAX consumers use native event listeners', () => {
    const voidSource = readVoidModule('runtime');
    const footer = fs.readFileSync(path.resolve(__dirname, '../../includes/footer.php'), 'utf8');
    const lifecycleStart = voidSource.indexOf('    bindPjaxLifecycle: function () {');
    const lifecycleEnd = voidSource.indexOf('    // 初始化单页应用', lifecycleStart);
    const reloadStart = footer.indexOf('if (VOID.pjaxReloadHandler)');
    const reloadEnd = footer.indexOf("<?php if(Utils::isPluginAvailable('ExSearch'))", reloadStart);
    const jQueryReference = /\$\s*\(|\$\s*\.|\bjQuery\b/;

    assert.ok(lifecycleStart > -1);
    assert.ok(lifecycleEnd > lifecycleStart);
    assert.ok(reloadStart > -1);
    assert.ok(reloadEnd > reloadStart);
    assert.doesNotMatch(voidSource.slice(lifecycleStart, lifecycleEnd), jQueryReference);
    assert.doesNotMatch(footer.slice(reloadStart, reloadEnd), jQueryReference);
    assert.match(voidSource.slice(lifecycleStart, lifecycleEnd), /document\.addEventListener\('pjax:send'/);
    assert.match(voidSource.slice(lifecycleStart, lifecycleEnd), /document\.removeEventListener\('pjax:send'/);
    assert.match(footer.slice(reloadStart, reloadEnd), /document\.addEventListener\('pjax:complete'/);
});

test('comment PJAX events do not run the main-container lifecycle', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];

    context.VOID.destroyEmotes = () => calls.push('destroyEmotes');
    context.VOID.beforePjax = () => calls.push('beforePjax');
    context.VOID.beforePjaxReplace = () => calls.push('beforePjaxReplace');
    context.VOID.afterPjax = () => calls.push('afterPjax');
    context.VOID.endPjax = () => calls.push('endPjax');
    context.VOID_Gallery.init = () => calls.push('gallery');
    context.VOID_PhotoSets.init = () => calls.push('photoSets');
    context.VOID_PhotoSwipe.init = () => calls.push('photoSwipe');
    context.AjaxComment.cancelSubmit = () => calls.push('cancelSubmit');
    context.AjaxComment.beforePjaxReplace = () => calls.push('commentBeforeReplace');
    context.AjaxComment.setCommentPageLoading = () => calls.push('commentLoading');
    context.AjaxComment.afterPagePjax = () => calls.push('afterPagePjax');
    context.AjaxComment.endPagePjax = () => calls.push('endPagePjax');
    context.VOIDConfig = { PJAX: true };

    context.VOID.bindPjaxLifecycle();
    context.document.dispatchEvent(nativePjaxEvent('pjax:send', { container: '#comments' }));
    assert.deepEqual(calls, [
        'cancelSubmit',
        'destroyEmotes',
        'commentLoading'
    ]);
    context.document.dispatchEvent(nativePjaxEvent('pjax:beforeReplace', { container: '#comments' }));
    context.document.dispatchEvent(nativePjaxEvent('pjax:complete', { container: '#comments' }));
    context.document.dispatchEvent(nativePjaxEvent('pjax:end', { container: '#comments' }));

    assert.deepEqual(calls, [
        'cancelSubmit',
        'destroyEmotes',
        'commentLoading',
        'commentBeforeReplace',
        'afterPagePjax',
        'endPagePjax'
    ]);
});

test('unrelated PJAX containers cannot cancel or tear down comment state', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];

    context.AjaxComment.cancelSubmit = () => calls.push('cancelSubmit');
    context.AjaxComment.beforePjaxReplace = () => calls.push('commentBeforeReplace');
    context.VOID.beforePjax = () => calls.push('beforePjax');
    context.VOID.beforePjaxReplace = () => calls.push('beforePjaxReplace');
    context.VOID.afterPjax = () => calls.push('afterPjax');
    context.VOID.endPjax = () => calls.push('endPjax');
    context.VOIDConfig = { PJAX: true };

    context.VOID.bindPjaxLifecycle();
    context.document.dispatchEvent(nativePjaxEvent('pjax:send', { container: '#external' }));
    context.document.dispatchEvent(nativePjaxEvent('pjax:beforeReplace', { container: '#external' }));
    context.document.dispatchEvent(nativePjaxEvent('pjax:complete', { container: '#external' }));
    context.document.dispatchEvent(nativePjaxEvent('pjax:end', { container: '#external' }));

    assert.deepEqual(calls, []);
});

test('PJAX lifecycle binding stays idempotent across repeated initialization', () => {
    const { bindingCounts, context, jqueryBindingCounts } = loadVoidEnvironment();

    context.VOIDConfig = { PJAX: true };
    context.VOID.bindPjaxLifecycle();
    context.VOID.bindPjaxLifecycle();

    assert.deepEqual(
        Object.fromEntries(bindingCounts),
        {
            'pjax:abort': 1,
            'pjax:beforeReplace': 1,
            'pjax:complete': 1,
            'pjax:end': 1,
            'pjax:send': 1
        }
    );
    assert.deepEqual(Object.fromEntries(jqueryBindingCounts), {});
    assert.equal(context.document.listenerCount('pjax:send'), 1);

    context.VOID.unbindPjaxLifecycle();
    context.VOID.unbindPjaxLifecycle();
    assert.equal(context.document.listenerCount('pjax:send'), 0);
    assert.equal(context.VOID.pjaxLifecycleBound, false);
    assert.equal(context.VOID.pjaxLifecycleHandlers, null);

    context.VOID.bindPjaxLifecycle();
    assert.equal(context.document.listenerCount('pjax:send'), 1);
    assert.equal(bindingCounts.get('pjax:send'), 2);
});

test('comment PJAX restores a comment anchor only for history navigation', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];

    context.VOID_Content.parseUrl = () => {};
    context.VOID_Content.highlight = () => {};
    context.VOID_Vote.reload = () => {};
    context.VOID.initEmotes = () => {};
    context.AjaxComment.init = () => calls.push('comments');
    context.AjaxComment.getHashCommentSelector = () => '#comment-12';
    context.VOID_Ui = {
        checkScrollTop: () => calls.push('scroll')
    };

    context.AjaxComment.afterPagePjax({ fromPopstate: false });
    assert.deepEqual(calls, ['comments']);

    calls.length = 0;
    context.AjaxComment.afterPagePjax({ fromPopstate: true });
    assert.deepEqual(calls, ['comments', 'scroll']);
});

test('main-container PJAX events do not run the comment lifecycle', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];

    context.VOID.destroyEmotes = () => calls.push('destroyEmotes');
    context.VOID.beforePjax = () => calls.push('beforePjax');
    context.VOID.beforePjaxReplace = () => calls.push('beforePjaxReplace');
    context.VOID.afterPjax = () => calls.push('afterPjax');
    context.VOID.endPjax = () => calls.push('endPjax');
    context.AjaxComment.cancelSubmit = () => calls.push('cancelSubmit');
    context.AjaxComment.beforePjaxReplace = () => calls.push('commentBeforeReplace');
    context.AjaxComment.setCommentPageLoading = () => calls.push('commentLoading');
    context.AjaxComment.afterPagePjax = () => calls.push('afterPagePjax');
    context.AjaxComment.endPagePjax = () => calls.push('endPagePjax');
    context.VOIDConfig = { PJAX: true };

    context.VOID.bindPjaxLifecycle();
    context.document.dispatchEvent(nativePjaxEvent('pjax:send', { container: '#pjax-container' }));
    context.document.dispatchEvent(nativePjaxEvent('pjax:beforeReplace', { container: '#pjax-container' }));
    context.document.dispatchEvent(nativePjaxEvent('pjax:complete', { container: '#pjax-container' }));
    context.document.dispatchEvent(nativePjaxEvent('pjax:end', { container: '#pjax-container' }));

    assert.deepEqual(calls, [
        'cancelSubmit',
        'beforePjax',
        'commentBeforeReplace',
        'beforePjaxReplace',
        'afterPjax',
        'endPjax'
    ]);
});

test('main PJAX teardown suspends the Gallery before photo-set and UI cleanup', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];

    context.NProgress = { start: () => calls.push('progress') };
    context.VOID_RewardDialog.destroy = () => calls.push('reward');
    context.VOID_PhotoSwipe.destroy = () => calls.push('photoSwipe');
    context.VOID_Gallery.suspend = () => calls.push('gallery');
    context.VOID_PhotoSets.destroy = () => calls.push('photoSets');
    context.VOID.destroyEmotes = () => calls.push('emotes');
    context.VOID_Ui = { reset: () => calls.push('ui') };

    context.VOID.beforePjax();
    assert.deepEqual(calls, ['progress', 'reward', 'photoSwipe', 'gallery', 'photoSets', 'emotes', 'ui']);
});

test('main before-replace teardown clears MathJax before destroying Masonry', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];

    context.VOID_Ui = {
        MasonryCtrler: {
            destroy: () => calls.push('masonry')
        }
    };
    context.VOID_Content.clearMath = () => calls.push('math');

    context.VOID.beforePjaxReplace();
    assert.deepEqual(calls, ['math', 'masonry']);
});

test('main PJAX completion reinitializes Masonry once on the replaced DOM', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];

    context.NProgress = { done() {} };
    context.VOID_Content.clearMath = () => calls.push('clear-math');
    context.VOID_Content.parseBoardThumbs = () => {};
    context.VOID_Content.countWords = () => {};
    context.VOID_Content.parseDetails = () => {};
    context.VOID_Content.parseTOC = () => {};
    context.VOID_Content.parseUrl = () => {};
    context.VOID_Content.highlight = () => {};
    context.VOID_Gallery.init = () => {};
    context.VOID_PhotoSets.init = () => {};
    context.VOID_PhotoSwipe.init = () => {};
    context.VOID_RewardDialog.init = () => {};
    context.VOID_Ui = {
        MasonryCtrler: {
            destroy: () => calls.push('destroy-masonry'),
            init: () => calls.push('init-masonry')
        },
        checkScrollTop() {},
        invalidateLoginAction() {},
        lazyload() {}
    };
    context.VOID.scheduleTypography = () => {};
    context.VOID_Vote.reload = () => {};
    context.VOID.initEmotes = () => {};
    context.AjaxComment.init = () => {};
    context.loadClipboard = () => {};

    context.VOID.beforePjaxReplace();
    context.VOID.afterPjax();

    assert.deepEqual(calls, ['clear-math', 'destroy-masonry', 'init-masonry']);
});

test('initialization defers typography until the entering animation is visible', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];

    context.VOID_Ui = {
        DarkModeSwitcher: { checkColorScheme() {} },
        MasonryCtrler: { init() {} },
        bindDismissEvents() {},
        checkHeader() {},
        checkScrollTop() { calls.push('scroll'); },
        headroom() {},
        lazyload() {}
    };
    context.VOID_Content.parseBoardThumbs = () => {};
    context.VOID_Gallery.init = () => {};
    context.VOID_PhotoSets.init = () => {};
    context.VOID_PhotoSwipe.init = () => {};
    context.VOID_RewardDialog.init = () => {};
    context.VOID_Content.countWords = () => {};
    context.VOID_Content.parseDetails = () => {};
    context.VOID_Content.parseTOC = () => {};
    context.VOID_Content.highlight = () => {};
    context.VOID_Content.parseUrl = () => {};
    context.VOID.scheduleTypography = () => calls.push('typography');
    context.VOID.safeRunPangu = () => calls.push('pangu');
    context.VOID_Content.bigfoot = () => calls.push('littlefoot');
    context.VOID_Content.math = () => calls.push('math');
    context.VOID_Content.hyphenate = () => calls.push('hyphenate');
    context.VOID_Vote.reload = () => {};
    context.VOID.initEmotes = () => {};
    context.AjaxComment.init = () => calls.push('comments');

    context.VOID.init();

    assert.deepEqual(calls, ['typography', 'comments', 'scroll']);
});

test('typography readiness follows the opacity of entering content', () => {
    const { context } = loadVoidEnvironment();
    const enteringContent = {};
    let opacity = '0';

    context.document.querySelectorAll = (selector) => {
        assert.equal(selector, '.float-up');
        return [enteringContent];
    };
    context.window.getComputedStyle = (node) => {
        assert.equal(node, enteringContent);
        return { opacity };
    };

    assert.equal(context.VOID.isTypographyReady(), false);
    opacity = '0.01';
    assert.equal(context.VOID.isTypographyReady(), true);
});

test('PJAX rebuild marks login action stale while typography drops stale work', () => {
    const { context, flushAnimationFrame, loginFormClasses } = loadVoidEnvironment({ loginForm: true });
    const calls = [];
    let typographyReady = false;

    context.VOID.safeRunPangu = () => calls.push('pangu');
    context.VOID_Content.prepareMath = () => {
        calls.push('prepareMath');
        return null;
    };
    context.VOID_Content.bigfoot = () => calls.push('littlefoot');
    context.VOID_Content.math = () => calls.push('math');
    context.VOID_Content.hyphenate = () => calls.push('hyphenate');
    context.VOID.isTypographyReady = () => typographyReady;

    context.NProgress = { done() {} };
    context.VOID_Gallery.init = () => {};
    context.VOID_PhotoSets.init = () => {};
    context.VOID_PhotoSwipe.init = () => {};
    context.VOID_RewardDialog.init = () => {};
    context.VOID_Ui = {
        MasonryCtrler: { init() {} },
        checkScrollTop() { calls.push('scroll'); },
        invalidateLoginAction() { loginFormClasses.add('need-refresh'); },
        lazyload() {}
    };
    context.VOID_Content.parseBoardThumbs = () => {};
    context.VOID_Content.countWords = () => {};
    context.VOID_Content.parseDetails = () => {};
    context.VOID_Content.parseTOC = () => {};
    context.VOID_Content.parseUrl = () => {};
    context.VOID_Content.highlight = () => {};
    context.loadClipboard = () => {};
    context.VOID_Vote.reload = () => {};
    context.VOID.initEmotes = () => {};
    context.AjaxComment.init = () => calls.push('comments');

    context.VOID.afterPjax();
    assert.deepEqual(calls, ['prepareMath', 'comments', 'scroll']);
    assert.equal(loginFormClasses.has('need-refresh'), true);

    flushAnimationFrame();
    assert.deepEqual(calls, ['prepareMath', 'comments', 'scroll']);

    flushAnimationFrame();
    assert.deepEqual(calls, ['prepareMath', 'comments', 'scroll']);

    typographyReady = true;
    flushAnimationFrame();
    assert.deepEqual(calls, ['prepareMath', 'comments', 'scroll', 'pangu', 'littlefoot', 'math', 'hyphenate']);

    calls.length = 0;
    context.VOID.scheduleTypography();
    assert.deepEqual(calls, ['prepareMath']);
    flushAnimationFrame();
    context.VOID.cancelScheduledTypography();
    flushAnimationFrame();
    assert.deepEqual(calls, ['prepareMath']);
});

test('typography uses a two-frame timeout fallback without requestAnimationFrame', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];
    let fallbackDelay = null;

    context.window.requestAnimationFrame = undefined;
    context.window.setTimeout = (callback, delay) => {
        fallbackDelay = delay;
        callback();
    };
    context.VOID.safeRunPangu = () => calls.push('pangu');
    context.VOID_Content.bigfoot = () => calls.push('littlefoot');
    context.VOID_Content.math = () => calls.push('math');
    context.VOID_Content.hyphenate = () => calls.push('hyphenate');

    context.VOID.scheduleTypography();

    assert.equal(fallbackDelay, 34);
    assert.deepEqual(calls, ['pangu', 'littlefoot', 'math', 'hyphenate']);
});

test('only an aborted main request restores the main-container lifecycle', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];

    context.VOID.afterPjax = () => calls.push('afterPjax');
    context.AjaxComment.afterPagePjax = () => calls.push('afterPagePjax');
    context.VOIDConfig = { PJAX: true };

    context.VOID.bindPjaxLifecycle();
    context.document.dispatchEvent(nativePjaxEvent('pjax:abort', { container: '#pjax-container' }));
    context.document.dispatchEvent(nativePjaxEvent('pjax:abort', { container: '#comments' }));

    assert.deepEqual(calls, ['afterPjax']);
});

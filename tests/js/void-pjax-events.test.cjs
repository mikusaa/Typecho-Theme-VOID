const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

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
    document.querySelector = (selector) => selector === '#pjax-container' ? currentContainer : null;
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
    const window = {
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
    };
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

function loadVoidEnvironment() {
    const handlers = new Map();
    const animationFrames = new Map();
    const document = {};
    let nextAnimationFrameId = 1;
    const jQuery = () => {
        const api = {
            on(name, listener) {
                handlers.set(name, listener);
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
        window
    };

    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.js'), 'utf8'),
        context
    );

    return {
        context,
        flushAnimationFrame() {
            const callbacks = Array.from(animationFrames.values());
            animationFrames.clear();
            callbacks.forEach((callback) => callback());
        },
        handlers
    };
}

function wrappedPjaxEvent(options) {
    return {
        originalEvent: {
            detail: { options }
        }
    };
}

function loadFooterPjaxReloadHandler(context) {
    const footer = fs.readFileSync(path.resolve(__dirname, '../../includes/footer.php'), 'utf8');
    const start = footer.indexOf("$(document).on('pjax:complete'");
    const end = footer.indexOf("<?php if(Utils::isPluginAvailable('ExSearch'))", start);
    const reloadContainers = [];
    const handlers = new Map();
    const document = {};
    const jQuery = () => {
        const api = {
            on(name, listener) {
                handlers.set(name, listener);
                return api;
            }
        };
        return api;
    };

    assert.notEqual(start, -1, 'footer PJAX complete handler should exist');
    assert.notEqual(end, -1, 'footer PJAX complete handler should end before ExSearch');

    const source = footer.slice(start, end).replace(
        "<?php echo $setting['pjaxreload']; ?>",
        "reloadContainers.push(options ? options.container : null);"
    );

    vm.runInNewContext(source, {
        $: jQuery,
        VOID: context.VOID,
        document,
        reloadContainers
    });

    return {
        handler: handlers.get('pjax:complete'),
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
    assert.equal(nativeEvent.detail.options.container, '#pjax-container');
    assert.equal(jqueryEvent.originalEvent, nativeEvent);
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
});

test('resolvePjaxOptions prefers native detail and supports legacy jQuery arguments', () => {
    const { context } = loadVoidEnvironment();
    const detailOptions = { container: '#comments' };
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
    assert.equal(context.VOID.resolvePjaxOptions([{}, null, legacyOptions]), legacyOptions);
    assert.equal(context.VOID.resolvePjaxOptions([]), null);
});

test('footer pjaxreload filters native and legacy comment replacements', () => {
    const { context } = loadVoidEnvironment();
    const { handler, reloadContainers } = loadFooterPjaxReloadHandler(context);

    assert.equal(typeof handler, 'function');

    handler(wrappedPjaxEvent({ container: '#comments' }));
    handler(wrappedPjaxEvent({ container: '#pjax-container' }));
    handler({}, null, 'success', { container: '#comments' });
    handler({}, null, 'success', { container: '#pjax-container' });
    handler({});

    assert.deepEqual(reloadContainers, [
        '#pjax-container',
        '#pjax-container',
        null
    ]);
});

test('comment PJAX events do not run the main-container lifecycle', () => {
    const { context, handlers } = loadVoidEnvironment();
    const calls = [];

    context.VOID.destroyEmotes = () => calls.push('destroyEmotes');
    context.VOID.beforePjax = () => calls.push('beforePjax');
    context.VOID.beforePjaxReplace = () => calls.push('beforePjaxReplace');
    context.VOID.afterPjax = () => calls.push('afterPjax');
    context.VOID.endPjax = () => calls.push('endPjax');
    context.VOID_Gallery.init = () => calls.push('gallery');
    context.VOID_PhotoSets.init = () => calls.push('photoSets');
    context.VOID_ImageZoom.init = () => calls.push('imageZoom');
    context.AjaxComment.setCommentPageLoading = () => calls.push('commentLoading');
    context.AjaxComment.afterPagePjax = () => calls.push('afterPagePjax');
    context.AjaxComment.endPagePjax = () => calls.push('endPagePjax');
    context.VOIDConfig = { PJAX: true };

    context.VOID.bindPjaxLifecycle();
    handlers.get('pjax:send')(wrappedPjaxEvent({ container: '#comments' }));
    handlers.get('pjax:beforeReplace')(wrappedPjaxEvent({ container: '#comments' }));
    handlers.get('pjax:complete')(wrappedPjaxEvent({ container: '#comments' }));
    handlers.get('pjax:end')(wrappedPjaxEvent({ container: '#comments' }));

    assert.deepEqual(calls, [
        'destroyEmotes',
        'commentLoading',
        'afterPagePjax',
        'endPagePjax'
    ]);
});

test('main-container PJAX events do not run the comment lifecycle', () => {
    const { context, handlers } = loadVoidEnvironment();
    const calls = [];

    context.VOID.destroyEmotes = () => calls.push('destroyEmotes');
    context.VOID.beforePjax = () => calls.push('beforePjax');
    context.VOID.beforePjaxReplace = () => calls.push('beforePjaxReplace');
    context.VOID.afterPjax = () => calls.push('afterPjax');
    context.VOID.endPjax = () => calls.push('endPjax');
    context.AjaxComment.setCommentPageLoading = () => calls.push('commentLoading');
    context.AjaxComment.afterPagePjax = () => calls.push('afterPagePjax');
    context.AjaxComment.endPagePjax = () => calls.push('endPagePjax');
    context.VOIDConfig = { PJAX: true };

    context.VOID.bindPjaxLifecycle();
    handlers.get('pjax:send')(wrappedPjaxEvent({ container: '#pjax-container' }));
    handlers.get('pjax:beforeReplace')(wrappedPjaxEvent({ container: '#pjax-container' }));
    handlers.get('pjax:complete')(wrappedPjaxEvent({ container: '#pjax-container' }));
    handlers.get('pjax:end')(wrappedPjaxEvent({ container: '#pjax-container' }));

    assert.deepEqual(calls, ['beforePjax', 'beforePjaxReplace', 'afterPjax', 'endPjax']);
});

test('main PJAX teardown suspends the Gallery before photo-set and UI cleanup', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];

    context.NProgress = { start: () => calls.push('progress') };
    context.VOID_RewardDialog.destroy = () => calls.push('reward');
    context.VOID_ImageZoom.destroy = () => calls.push('zoom');
    context.VOID_Gallery.suspend = () => calls.push('gallery');
    context.VOID_PhotoSets.destroy = () => calls.push('photoSets');
    context.VOID.destroyEmotes = () => calls.push('emotes');
    context.VOID_Ui = { reset: () => calls.push('ui') };

    context.VOID.beforePjax();
    assert.deepEqual(calls, ['progress', 'reward', 'zoom', 'gallery', 'photoSets', 'emotes', 'ui']);
});

test('main before-replace teardown destroys Masonry synchronously', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];

    context.VOID_Ui = {
        MasonryCtrler: {
            destroy: () => calls.push('masonry')
        }
    };

    context.VOID.beforePjaxReplace();
    assert.deepEqual(calls, ['masonry']);
});

test('initialization defers typography until the entering animation is visible', () => {
    const { context } = loadVoidEnvironment();
    const calls = [];

    context.VOID_Ui = {
        DarkModeSwitcher: { checkColorScheme() {} },
        MasonryCtrler: { init() {} },
        checkHeader() {},
        checkScrollTop() {},
        headroom() {},
        lazyload() {}
    };
    context.VOID_Content.parseBoardThumbs = () => {};
    context.VOID_Gallery.init = () => {};
    context.VOID_PhotoSets.init = () => {};
    context.VOID_ImageZoom.init = () => {};
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
    context.AjaxComment.init = () => {};

    context.VOID.init();

    assert.deepEqual(calls, ['typography']);
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

test('typography waits for the entering animation and drops stale work', () => {
    const { context, flushAnimationFrame } = loadVoidEnvironment();
    const calls = [];
    let typographyReady = false;

    context.VOID.safeRunPangu = () => calls.push('pangu');
    context.VOID_Content.bigfoot = () => calls.push('littlefoot');
    context.VOID_Content.math = () => calls.push('math');
    context.VOID_Content.hyphenate = () => calls.push('hyphenate');
    context.VOID.isTypographyReady = () => typographyReady;

    context.NProgress = { done() {} };
    context.VOID_Gallery.init = () => {};
    context.VOID_PhotoSets.init = () => {};
    context.VOID_ImageZoom.init = () => {};
    context.VOID_RewardDialog.init = () => {};
    context.VOID_Ui = {
        MasonryCtrler: { init() {} },
        checkScrollTop() {},
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
    context.AjaxComment.init = () => {};

    context.VOID.afterPjax();
    assert.deepEqual(calls, []);

    flushAnimationFrame();
    assert.deepEqual(calls, []);

    flushAnimationFrame();
    assert.deepEqual(calls, []);

    typographyReady = true;
    flushAnimationFrame();
    assert.deepEqual(calls, ['pangu', 'littlefoot', 'math', 'hyphenate']);

    calls.length = 0;
    context.VOID.scheduleTypography();
    flushAnimationFrame();
    context.VOID.cancelScheduledTypography();
    flushAnimationFrame();
    assert.deepEqual(calls, []);
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
    const { context, handlers } = loadVoidEnvironment();
    const calls = [];

    context.VOID.afterPjax = () => calls.push('afterPjax');
    context.AjaxComment.afterPagePjax = () => calls.push('afterPagePjax');
    context.VOIDConfig = { PJAX: true };

    context.VOID.bindPjaxLifecycle();
    handlers.get('pjax:abort')(wrappedPjaxEvent({ container: '#pjax-container' }));
    handlers.get('pjax:abort')(wrappedPjaxEvent({ container: '#comments' }));

    assert.deepEqual(calls, ['afterPjax']);
});

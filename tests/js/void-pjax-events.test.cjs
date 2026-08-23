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

function loadPjaxEnvironment() {
    const document = new FakeEventTarget();
    const container = new FakeEventTarget(document);
    let jqueryTriggerCount = 0;

    document.querySelector = (selector) => selector === '#pjax-container' ? container : null;
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
        CustomEvent: FakeCustomEvent,
        DOMParser: function () {},
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
        setTimeout
    };
    window.window = window;

    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/libs/pjax/void-pjax.js'), 'utf8'),
        {
            document,
            Promise,
            URL,
            window
        }
    );

    return {
        document,
        getJqueryTriggerCount: () => jqueryTriggerCount,
        jQuery,
        window
    };
}

function loadVoidEnvironment() {
    const handlers = new Map();
    const document = {};
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
        clearTimeout() {},
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

    return { context, handlers };
}

function wrappedPjaxEvent(options) {
    return {
        originalEvent: {
            detail: { options }
        }
    };
}

test('native and jQuery listeners receive one complete event with event detail', async () => {
    const { document, getJqueryTriggerCount, jQuery, window } = loadPjaxEnvironment();
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

    await window.VoidPjax.visit({
        container: '#pjax-container',
        timeout: 0,
        url: 'https://example.test/next'
    });

    assert.equal(nativeCount, 1);
    assert.equal(jqueryCount, 1);
    assert.equal(getJqueryTriggerCount(), 0);
    assert.equal(nativeEvent.bubbles, true);
    assert.equal(nativeEvent.cancelable, true);
    assert.equal(nativeEvent.detail.args[1], 'error');
    assert.equal(nativeEvent.detail.options.container, '#pjax-container');
    assert.equal(jqueryEvent.originalEvent, nativeEvent);
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

test('comment PJAX events do not run the main-container lifecycle', () => {
    const { context, handlers } = loadVoidEnvironment();
    const calls = [];

    context.VOID.destroyEmotes = () => calls.push('destroyEmotes');
    context.VOID.beforePjax = () => calls.push('beforePjax');
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
    context.VOID.afterPjax = () => calls.push('afterPjax');
    context.VOID.endPjax = () => calls.push('endPjax');
    context.AjaxComment.setCommentPageLoading = () => calls.push('commentLoading');
    context.AjaxComment.afterPagePjax = () => calls.push('afterPagePjax');
    context.AjaxComment.endPagePjax = () => calls.push('endPagePjax');
    context.VOIDConfig = { PJAX: true };

    context.VOID.bindPjaxLifecycle();
    handlers.get('pjax:send')(wrappedPjaxEvent({ container: '#pjax-container' }));
    handlers.get('pjax:complete')(wrappedPjaxEvent({ container: '#pjax-container' }));
    handlers.get('pjax:end')(wrappedPjaxEvent({ container: '#pjax-container' }));

    assert.deepEqual(calls, ['beforePjax', 'afterPjax', 'endPjax']);
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

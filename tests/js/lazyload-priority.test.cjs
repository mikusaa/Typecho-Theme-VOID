const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createItem(attributes, options = {}) {
    const classes = new Set(['lazyload']);
    const parentClasses = new Set();
    const parentElement = {
        classList: {
            add(name) {
                parentClasses.add(name);
            }
        }
    };

    return {
        attributes: new Map(Object.entries(attributes)),
        classList: {
            add(name) {
                classes.add(name);
            },
            contains(name) {
                return classes.has(name);
            }
        },
        classes,
        closest(selector) {
            return selector === '[hidden]' && this.hiddenAncestor ? {} : null;
        },
        getBoundingClientRect() {
            return { bottom: 200, top: 100 };
        },
        hiddenAncestor: options.hiddenAncestor === true,
        parentClasses,
        parentElement,
        getAttribute(name) {
            return this.attributes.has(name) ? this.attributes.get(name) : null;
        },
        setAttribute(name, value) {
            this.attributes.set(name, String(value));
        }
    };
}

function loadLazyload(items, isVisible) {
    const preloadImages = [];
    const requestLog = [];
    const scrollListeners = new Set();
    const document = {
        body: { scrollTop: 0 },
        documentElement: { clientHeight: 800, scrollTop: 0 },
        querySelectorAll(selector) {
            if (selector === '[data-void-gallery] img.lazyload:not(.loaded):not(.error)') {
                return items.filter((item) => (
                    !item.classes.has('loaded') && !item.classes.has('error')
                ));
            }
            return [];
        }
    };

    class FakePreloadImage {
        constructor() {
            this.attributes = new Map();
            this.operations = [];
            preloadImages.push(this);
        }

        setAttribute(name, value) {
            this.attributes.set(name, String(value));
            this.operations.push(`attribute:${name}:${value}`);
        }

        set src(value) {
            this.operations.push(`src:${value}`);
            requestLog.push({
                priority: this.attributes.get('fetchpriority') || null,
                url: value
            });
        }
    }

    const runImmediately = (callback) => {
        callback();
        return 1;
    };
    const window = {
        addEventListener(name, listener) {
            if (name === 'scroll') {
                scrollListeners.add(listener);
            }
        },
        clearTimeout() {},
        removeEventListener(name, listener) {
            if (name === 'scroll') {
                scrollListeners.delete(listener);
            }
        },
        setTimeout: runImmediately
    };
    window.window = window;
    const context = {
        Image: FakePreloadImage,
        clearTimeout() {},
        console: { log() {} },
        document,
        escape,
        setTimeout: runImmediately,
        unescape,
        window
    };

    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/header.js'), 'utf8'),
        context
    );
    context.VOID_GalleryLazyload.inViewport = isVisible;

    return { context, preloadImages, requestLog, scrollListeners };
}

test('an eager Gallery image starts outside the viewport with propagated priority', () => {
    const item = createItem({
        'data-src': 'https://example.test/gallery-first.jpg',
        fetchpriority: 'high',
        loading: 'eager'
    });
    const fixture = loadLazyload([item], () => false);

    fixture.context.VOID_GalleryLazyload.callback();
    fixture.context.VOID_GalleryLazyload.callback();

    assert.deepEqual(fixture.requestLog, [{
        priority: 'high',
        url: 'https://example.test/gallery-first.jpg'
    }]);
    assert.deepEqual(fixture.preloadImages[0].operations, [
        'attribute:fetchpriority:high',
        'src:https://example.test/gallery-first.jpg'
    ]);

    fixture.preloadImages[0].onload();
    assert.equal(item.getAttribute('src'), 'https://example.test/gallery-first.jpg');
    assert.equal(item.classes.has('loaded'), true);
    assert.equal(item.parentClasses.has('loaded'), true);
});

test('an eager image waits while a hidden ancestor conceals it', () => {
    const item = createItem({
        'data-src': 'https://example.test/gallery-hidden-first.jpg',
        fetchpriority: 'high',
        loading: 'eager'
    }, { hiddenAncestor: true });
    const fixture = loadLazyload([item], () => false);

    fixture.context.VOID_GalleryLazyload.callback();

    assert.deepEqual(fixture.requestLog, []);
    assert.equal(fixture.preloadImages.length, 0);
    assert.equal(fixture.context.VOID_GalleryLazyload.finish(), true);

    item.hiddenAncestor = false;
    assert.equal(fixture.context.VOID_GalleryLazyload.finish(), false);
    fixture.context.VOID_GalleryLazyload.callback();

    assert.deepEqual(fixture.requestLog, [{
        priority: 'high',
        url: 'https://example.test/gallery-hidden-first.jpg'
    }]);
    assert.deepEqual(fixture.preloadImages[0].operations, [
        'attribute:fetchpriority:high',
        'src:https://example.test/gallery-hidden-first.jpg'
    ]);
});

test('visible Gallery images keep viewport gating and default request priority', () => {
    const outside = createItem({ 'data-src': 'https://example.test/outside.jpg' });
    const visible = createItem({ 'data-src': 'https://example.test/visible.jpg' });
    const fixture = loadLazyload([outside, visible], (item) => item === visible);

    fixture.context.VOID_GalleryLazyload.callback();

    assert.deepEqual(fixture.requestLog, [{
        priority: null,
        url: 'https://example.test/visible.jpg'
    }]);
    assert.deepEqual(fixture.preloadImages[0].operations, [
        'src:https://example.test/visible.jpg'
    ]);
});

test('concurrent Gallery preloads update only their own image and parent', () => {
    const first = createItem({
        'data-src': 'https://example.test/first.jpg',
        loading: 'eager'
    });
    const second = createItem({
        'data-src': 'https://example.test/second.jpg',
        loading: 'eager'
    });
    const fixture = loadLazyload([first, second], () => false);

    fixture.context.VOID_GalleryLazyload.callback();
    assert.equal(fixture.preloadImages.length, 2);

    fixture.preloadImages[0].onload();
    assert.equal(first.getAttribute('src'), 'https://example.test/first.jpg');
    assert.equal(second.getAttribute('src'), null);
    assert.equal(first.parentClasses.has('loaded'), true);
    assert.equal(second.parentClasses.has('loaded'), false);

    fixture.preloadImages[1].onload();
    assert.equal(second.getAttribute('src'), 'https://example.test/second.jpg');
    assert.equal(second.parentClasses.has('loaded'), true);
});

test('Gallery lazy-load initialization retains only one scroll listener', () => {
    const outside = createItem({ 'data-src': 'https://example.test/outside.jpg' });
    const fixture = loadLazyload([outside], () => false);

    fixture.context.VOID_GalleryLazyload.init();
    fixture.context.VOID_GalleryLazyload.init();

    assert.equal(fixture.scrollListeners.size, 1);
});

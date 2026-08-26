const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createItem(attributes, options = {}) {
    return {
        attributes: new Map(Object.entries(attributes)),
        classes: new Set(['lazyload']),
        hiddenAncestor: options.hiddenAncestor === true,
        parentClasses: new Set(),
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
    const document = {
        body: { scrollTop: 0 },
        documentElement: { clientHeight: 800, scrollTop: 0 }
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

    function jQuery(target) {
        if (typeof target === 'string') {
            if (target === 'img.lazyload:not(.browserlevel-lazy):not(.loaded):not(.error)') {
                return items;
            }
            return { length: 0 };
        }
        if (target === document) {
            return { on() { return this; } };
        }

        return {
            addClass(name) {
                target.classes.add(name);
                return this;
            },
            attr(name, value) {
                if (arguments.length === 1) {
                    return target.getAttribute(name);
                }
                target.setAttribute(name, value);
                return this;
            },
            closest(selector) {
                return {
                    length: selector === '[hidden]' && target.hiddenAncestor ? 1 : 0
                };
            },
            parent() {
                return {
                    addClass(name) {
                        target.parentClasses.add(name);
                        return this;
                    }
                };
            },
        };
    }
    jQuery.each = (collection, callback) => collection.forEach((item, index) => callback(index, item));

    const runImmediately = (callback) => {
        callback();
        return 1;
    };
    const window = {
        addEventListener() {},
        clearTimeout() {},
        removeEventListener() {},
        setTimeout: runImmediately
    };
    window.window = window;
    const context = {
        $: jQuery,
        Image: FakePreloadImage,
        clearTimeout() {},
        console: { log() {} },
        document,
        escape,
        jQuery,
        setTimeout: runImmediately,
        unescape,
        window
    };

    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/header.js'), 'utf8'),
        context
    );
    context.VOID_Lazyload.inViewport = isVisible;
    context.VOID_Lazyload.removeEventListener = () => {};

    return { context, preloadImages, requestLog };
}

test('an eager Gallery image starts outside the viewport with propagated priority', () => {
    const item = createItem({
        'data-src': 'https://example.test/gallery-first.jpg',
        fetchpriority: 'high',
        loading: 'eager'
    });
    const fixture = loadLazyload([item], () => false);

    fixture.context.VOID_Lazyload.callback();
    fixture.context.VOID_Lazyload.callback();

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

    fixture.context.VOID_Lazyload.callback();

    assert.deepEqual(fixture.requestLog, []);
    assert.equal(fixture.preloadImages.length, 0);
    assert.equal(fixture.context.VOID_Lazyload.finish(), true);

    item.hiddenAncestor = false;
    assert.equal(fixture.context.VOID_Lazyload.finish(), false);
    fixture.context.VOID_Lazyload.callback();

    assert.deepEqual(fixture.requestLog, [{
        priority: 'high',
        url: 'https://example.test/gallery-hidden-first.jpg'
    }]);
    assert.deepEqual(fixture.preloadImages[0].operations, [
        'attribute:fetchpriority:high',
        'src:https://example.test/gallery-hidden-first.jpg'
    ]);
});

test('ordinary lazy images keep viewport gating and default request priority', () => {
    const outside = createItem({ 'data-src': 'https://example.test/outside.jpg' });
    const visible = createItem({ 'data-src': 'https://example.test/visible.jpg' });
    const fixture = loadLazyload([outside, visible], (item) => item === visible);

    fixture.context.VOID_Lazyload.callback();

    assert.deepEqual(fixture.requestLog, [{
        priority: null,
        url: 'https://example.test/visible.jpg'
    }]);
    assert.deepEqual(fixture.preloadImages[0].operations, [
        'src:https://example.test/visible.jpg'
    ]);
});

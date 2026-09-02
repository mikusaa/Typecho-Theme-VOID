const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const sass = require('sass');

class FakeClassList {
    constructor() {
        this.names = new Set();
    }

    add(name) {
        this.names.add(name);
    }

    contains(name) {
        return this.names.has(name);
    }

    remove(name) {
        this.names.delete(name);
    }
}

class FakeElement {
    constructor(tagName = 'div') {
        this.attributes = new Map();
        this.children = [];
        this.classList = new FakeClassList();
        this.className = '';
        this.clientWidth = 320;
        this.focusCount = 0;
        this.focusCalls = [];
        this.hidden = false;
        this.listenerOptions = new Map();
        this.listeners = new Map();
        this.offsetLeft = 0;
        this.offsetWidth = 100;
        this.open = false;
        this.ownerDocument = null;
        this.parentNode = null;
        this.rect = { left: 0, top: 0, width: 100, height: 100 };
        this.rectProvider = null;
        this.releasePointerCaptureCalls = [];
        this.scrollLeft = 0;
        this.scrollWidth = 320;
        this.scrollToCalls = [];
        this.setPointerCaptureCalls = [];
        this.styleValues = new Map();
        this.styleAssignments = [];
        const style = {
            getPropertyValue: (name) => this.styleValues.get(name) || '',
            removeProperty: (name) => this.styleValues.delete(name),
            setProperty: (name, value) => this.styleValues.set(name, String(value))
        };
        this.style = new Proxy(style, {
            set: (target, name, value) => {
                this.styleAssignments.push({ name: String(name), value: String(value) });
                target[name] = value;
                return true;
            }
        });
        this.tagName = tagName.toUpperCase();
    }

    addEventListener(name, listener, options) {
        const listeners = this.listeners.get(name) || [];
        const listenerOptions = this.listenerOptions.get(name) || [];
        listeners.push(listener);
        listenerOptions.push({ listener, options });
        this.listeners.set(name, listeners);
        this.listenerOptions.set(name, listenerOptions);
    }

    assignOwnerDocument(document) {
        this.ownerDocument = document;
        this.children.forEach((child) => child.assignOwnerDocument(document));
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        child.parentNode = this;
        child.assignOwnerDocument(this.ownerDocument || (this.tagName === 'DOCUMENT' ? this : null));
        this.children.push(child);
        return child;
    }

    insertBefore(child, reference) {
        let index;

        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        index = this.children.indexOf(reference);
        child.parentNode = this;
        child.assignOwnerDocument(this.ownerDocument || (this.tagName === 'DOCUMENT' ? this : null));
        if (index < 0) {
            this.children.push(child);
        } else {
            this.children.splice(index, 0, child);
        }
        return child;
    }

    contains(candidate) {
        if (candidate === this) {
            return true;
        }
        return this.children.some((child) => child.contains(candidate));
    }

    dispatch(name, event = {}) {
        event.type = name;
        if (!event.target) {
            event.target = this;
        }
        (this.listeners.get(name) || []).slice().forEach((listener) => listener.call(this, event));
    }

    focus(options) {
        this.focusCount += 1;
        this.focusCalls.push(options);
        if (this.ownerDocument) {
            this.ownerDocument.activeElement = this;
        }
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    getBoundingClientRect() {
        const rect = this.rectProvider ? this.rectProvider() : this.rect;
        return {
            ...rect,
            right: rect.left + rect.width,
            bottom: rect.top + rect.height
        };
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    listenerCount(name) {
        return (this.listeners.get(name) || []).length;
    }

    listenerOptionsFor(name) {
        return (this.listenerOptions.get(name) || []).map((record) => record.options);
    }

    keyboardActivate(key) {
        if (this.tagName === 'BUTTON' && (key === 'Enter' || key === ' ')) {
            this.dispatch('click', preventableEvent({ detail: 0, key, target: this }));
        }
    }

    matchesSelector(selector) {
        if (selector === 'img[data-void-image-content]') {
            return this.tagName === 'IMG' && this.hasAttribute('data-void-image-content');
        }
        if (selector === 'a[data-void-image-zoom]') {
            return this.tagName === 'A' && this.hasAttribute('data-void-image-zoom');
        }
        if (selector === 'figure[data-void-image-item]') {
            return this.tagName === 'FIGURE' && this.hasAttribute('data-void-image-item');
        }
        if (selector === '[data-void-gallery-set]') {
            return this.hasAttribute('data-void-gallery-set');
        }
        if (selector === '[data-void-reward-link]') {
            return this.hasAttribute('data-void-reward-link');
        }
        if (selector === 'dialog[data-void-reward-dialog]') {
            return this.tagName === 'DIALOG' && this.hasAttribute('data-void-reward-dialog');
        }
        if (selector === '[data-void-reward-close]') {
            return this.hasAttribute('data-void-reward-close');
        }
        if (selector === '[data-void-photo-prev]') {
            return this.hasAttribute('data-void-photo-prev');
        }
        if (selector === '[data-void-photo-next]') {
            return this.hasAttribute('data-void-photo-next');
        }
        return false;
    }

    querySelector(selector) {
        const visit = (node) => {
            for (const child of node.children) {
                if (child.matchesSelector(selector)) {
                    return child;
                }
                const nested = visit(child);
                if (nested) {
                    return nested;
                }
            }
            return null;
        };
        return visit(this);
    }

    querySelectorAll(selector) {
        const matches = [];
        const visit = (node) => {
            for (const child of node.children) {
                if (child.matchesSelector(selector)) {
                    matches.push(child);
                }
                visit(child);
            }
        };
        visit(this);
        return matches;
    }

    releasePointerCapture(pointerId) {
        this.releasePointerCaptureCalls.push(pointerId);
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    removeChild(child) {
        this.children = this.children.filter((candidate) => candidate !== child);
        if (this.ownerDocument && child.contains(this.ownerDocument.activeElement)) {
            this.ownerDocument.activeElement = this.ownerDocument.body;
        }
        child.parentNode = null;
        return child;
    }

    removeEventListener(name, listener) {
        const listeners = this.listeners.get(name) || [];
        const listenerOptions = this.listenerOptions.get(name) || [];
        this.listeners.set(name, listeners.filter((candidate) => candidate !== listener));
        this.listenerOptions.set(
            name,
            listenerOptions.filter((record) => record.listener !== listener)
        );
    }

    scrollTo(options) {
        this.scrollToCalls.push(options);
        this.scrollLeft = options.left;
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    setPointerCapture(pointerId) {
        this.setPointerCaptureCalls.push(pointerId);
    }
}

class FakeDocument extends FakeElement {
    constructor(dialogMode = 'supported') {
        super('document');
        this.ownerDocument = this;
        this.activeElement = null;
        this.documentElement = new FakeElement('html');
        this.documentElement.parentNode = this;
        this.documentElement.assignOwnerDocument(this);
        this.body = new FakeElement('body');
        this.body.assignOwnerDocument(this);
        this.documentElement.appendChild(this.body);
        this.createdTags = [];
        this.dialogMode = dialogMode;
        this.root = null;
    }

    get root() {
        return this._root;
    }

    set root(value) {
        this._root = value;
        if (value) {
            value.assignOwnerDocument(this);
        }
    }

    createElement(tagName) {
        const element = new FakeElement(tagName);
        this.createdTags.push(tagName.toUpperCase());
        element.assignOwnerDocument(this);
        if (tagName.toLowerCase() === 'dialog' && this.dialogMode !== 'unsupported') {
            element.showModal = () => {
                if (this.dialogMode === 'throw') {
                    throw new Error('showModal failed');
                }
                element.open = true;
                element.setAttribute('open', '');
            };
            element.close = () => {
                element.open = false;
                element.removeAttribute('open');
                element.dispatch('close', { target: element });
            };
        }
        return element;
    }

    getElementById(id) {
        return id === 'pjax-container' ? this.root : null;
    }
}

class FakeWindow extends FakeElement {
    constructor(document, reducedMotion = false) {
        super('window');
        this.animationFrames = new Map();
        this.cancelAnimationFrameCalls = [];
        this.document = document;
        this.innerHeight = 800;
        this.innerWidth = 1280;
        this.nextAnimationFrameId = 1;
        this.nextTimerId = 1;
        this.now = 0;
        this.pageYOffset = 0;
        this.pageXOffset = 0;
        this.reducedMotion = reducedMotion;
        this.scrollToCalls = [];
        this.scrollX = 0;
        this.scrollY = 0;
        this.timers = new Map();
        this.window = this;
    }

    advanceTime(milliseconds) {
        const targetTime = this.now + milliseconds;
        let nextTimer;

        while (true) {
            nextTimer = Array.from(this.timers.entries())
                .filter(([, timer]) => timer.runAt <= targetTime)
                .sort((first, second) => first[1].runAt - second[1].runAt || first[0] - second[0])[0];
            if (!nextTimer) {
                break;
            }

            this.now = nextTimer[1].runAt;
            this.timers.delete(nextTimer[0]);
            nextTimer[1].callback();
        }

        this.now = targetTime;
    }

    cancelAnimationFrame(id) {
        this.cancelAnimationFrameCalls.push(id);
        this.animationFrames.delete(id);
    }

    clearInterval() {}

    clearTimeout(id) {
        this.timers.delete(id);
    }

    flushAnimationFrames() {
        const frames = Array.from(this.animationFrames.values());
        this.animationFrames.clear();
        frames.forEach((callback) => callback(this.now));
    }

    matchMedia() {
        return { matches: this.reducedMotion };
    }

    getComputedStyle(element) {
        const computedStyle = {
            paddingTop: '24px',
            paddingRight: '24px',
            paddingBottom: '24px',
            paddingLeft: '24px',
            ...(element.computedStyle || {})
        };
        computedStyle.getPropertyValue = (name) => computedStyle[name] || '';
        return computedStyle;
    }

    pendingTimerCount() {
        return this.timers.size;
    }

    requestAnimationFrame(callback) {
        const id = this.nextAnimationFrameId++;
        this.animationFrames.set(id, callback);
        return id;
    }

    setInterval() {
        return 1;
    }

    setScrollY(value, dispatch = true) {
        let event = null;
        this.scrollY = value;
        this.pageYOffset = value;
        if (dispatch) {
            event = preventableEvent({ target: this });
            this.dispatch('scroll', event);
        }
        return event;
    }

    scrollTo(first, second) {
        const options = typeof first === 'object' ? first : { left: first, top: second };
        this.scrollToCalls.push(options);
        this.scrollX = options.left || 0;
        this.pageXOffset = this.scrollX;
        this.setScrollY(options.top || 0, false);
    }

    setTimeout(callback, delay) {
        const id = this.nextTimerId++;
        this.timers.set(id, {
            callback,
            delay,
            runAt: this.now + delay
        });
        return id;
    }
}

class FakePhotoSwipeLightbox {
    constructor(options) {
        this.destroyCount = 0;
        this.initCount = 0;
        this.listeners = new Map();
        this.openCalls = [];
        this.options = options;
        FakePhotoSwipeLightbox.instances.push(this);
    }

    destroy() {
        this.destroyCount += 1;
    }

    init() {
        this.initCount += 1;
    }

    on(name, listener) {
        const listeners = this.listeners.get(name) || [];
        listeners.push(listener);
        this.listeners.set(name, listeners);
    }

    emit(name, event) {
        (this.listeners.get(name) || []).forEach((listener) => listener(event));
    }

    loadAndOpen(index, dataSource, initialPoint) {
        this.openCalls.push({ dataSource, index, initialPoint });
        return true;
    }
}
FakePhotoSwipeLightbox.instances = [];

function loadVoid(options = {}) {
    const document = new FakeDocument(options.dialogMode || 'supported');
    const window = new FakeWindow(document, options.reducedMotion || false);
    const PhotoSwipeCore = options.photoSwipeCore === false
        ? undefined : (options.photoSwipeCore || function PhotoSwipe() {});
    const PhotoSwipeLightbox = options.photoSwipeLightbox === false
        ? undefined : (options.photoSwipeLightbox || FakePhotoSwipeLightbox);
    const ContextDate = options.now ? class extends Date {
        static now() {
            return options.now();
        }
    } : Date;
    const jQuery = () => {
        const api = {
            on() { return api; },
            ready() { return api; }
        };
        return api;
    };
    jQuery.each = () => {};
    jQuery.trim = (value) => String(value).trim();
    FakePhotoSwipeLightbox.instances = [];
    window.PhotoSwipe = PhotoSwipeCore;
    window.PhotoSwipeLightbox = PhotoSwipeLightbox;

    const context = {
        $: jQuery,
        Date: ContextDate,
        Promise,
        console: { error() {}, log() {} },
        document,
        jQuery,
        window
    };
    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.js'), 'utf8'),
        context
    );
    return { context, document, PhotoSwipeLightbox, window };
}

function preventableEvent(properties = {}) {
    return {
        altKey: false,
        button: 0,
        ctrlKey: false,
        defaultPrevented: false,
        metaKey: false,
        shiftKey: false,
        preventDefault() {
            this.defaultPrevented = true;
        },
        ...properties
    };
}

function createSource(root, options = {}) {
    const figure = new FakeElement('figure');
    const link = new FakeElement('a');
    const image = new FakeElement('img');
    figure.setAttribute('data-void-image-item', '');
    if (options.dimensions !== false) {
        figure.setAttribute('data-void-image-width', String(options.width || 1600));
        figure.setAttribute('data-void-image-height', String(options.height || 900));
    }
    link.setAttribute('data-void-image-zoom', '');
    link.setAttribute('href', options.href || '/original.jpg');
    image.setAttribute('data-void-image-content', '');
    image.setAttribute('alt', options.alt || '测试图片');
    image.setAttribute('src', options.previewSource === undefined ? '/display.jpg' : options.previewSource);
    if (options.lazySource) {
        image.setAttribute('data-src', options.lazySource);
    }
    image.complete = options.complete !== false;
    image.currentSrc = options.previewSource === undefined ? '/display.jpg' : options.previewSource;
    image.naturalWidth = options.naturalWidth === undefined ? 1600 : options.naturalWidth;
    image.naturalHeight = options.naturalHeight === undefined ? 900 : options.naturalHeight;
    image.rect = options.rect || { left: 20, top: 30, width: 320, height: 180 };
    if (options.objectFit) {
        image.computedStyle = { objectFit: options.objectFit };
    }
    link.appendChild(image);
    figure.appendChild(link);
    root.appendChild(figure);
    return { figure, image, link };
}

function createRewardSource(root, document) {
    const trigger = new FakeElement('a');
    const dialog = document.createElement('dialog');
    const content = new FakeElement('div');
    const closeButton = new FakeElement('button');
    const rewardImage = new FakeElement('img');
    trigger.setAttribute('data-void-reward-link', '');
    trigger.setAttribute('href', '/reward.png');
    trigger.setAttribute('target', '_blank');
    dialog.setAttribute('data-void-reward-dialog', '');
    closeButton.setAttribute('data-void-reward-close', '');
    closeButton.setAttribute('type', 'button');
    closeButton.setAttribute('aria-label', '关闭赞赏二维码');
    closeButton.appendChild(rewardImage);
    content.appendChild(closeButton);
    dialog.appendChild(content);
    root.appendChild(trigger);
    root.appendChild(dialog);
    return { closeButton, content, dialog, rewardImage, trigger };
}

function createStripFixture(options = {}) {
    const { context } = loadVoid(options);
    const root = new FakeElement('main');
    const set = new FakeElement('div');
    const link = new FakeElement('a');
    set.setAttribute('data-void-photo-layout', 'strip');
    link.setAttribute('data-void-image-zoom', '');
    set.appendChild(link);
    root.appendChild(set);
    root.querySelectorAll = (selector) => selector === '[data-void-photo-set]' ? [set] : [];
    context.VOID_PhotoSets.init(root);
    return { context, link, root, set };
}

function createStripControlFixture(options = {}) {
    const { context } = loadVoid(options);
    const root = new FakeElement('main');
    const set = new FakeElement('div');
    const figures = [];
    const itemWidth = 220;
    const gap = 8;
    const padding = 24;

    set.setAttribute('data-void-photo-layout', 'strip');
    set.clientWidth = 320;
    set.scrollWidth = padding * 2 + itemWidth * 4 + gap * 3;
    set.rect = { left: 0, top: 0, width: set.clientWidth, height: 300 };
    for (let index = 0; index < 4; index++) {
        const figure = new FakeElement('figure');
        figure.setAttribute('data-void-image-item', '');
        figure.rectProvider = () => ({
            left: set.rect.left + padding + index * (itemWidth + gap) - set.scrollLeft,
            top: 0,
            width: itemWidth,
            height: 260
        });
        figures.push(figure);
    }
    set.querySelectorAll = (selector) => selector === 'figure[data-void-image-item]' ? figures : [];
    root.appendChild(set);
    root.querySelectorAll = (selector) => selector === '[data-void-photo-set]' ? [set] : [];
    context.VOID_PhotoSets.init(root);

    return { context, figures, root, set };
}

test('photo layout classification and dimension priority are deterministic', () => {
    const { context } = loadVoid();
    const figure = new FakeElement('figure');
    const image = new FakeElement('img');
    figure.setAttribute('data-void-image-width', '1920');
    figure.setAttribute('data-void-image-height', '1080');
    image.complete = true;
    image.naturalWidth = 800;
    image.naturalHeight = 600;

    assert.equal(context.VOID_PhotoSets.__test.classifyLayout(0), 'single');
    assert.equal(context.VOID_PhotoSets.__test.classifyLayout(1), 'single');
    assert.equal(context.VOID_PhotoSets.__test.classifyLayout(2), 'pair');
    assert.equal(context.VOID_PhotoSets.__test.classifyLayout(3), 'strip');
    assert.equal(context.VOID_PhotoSets.resolveDimensions(figure, image).source, 'semantic');

    figure.removeAttribute('data-void-image-width');
    figure.removeAttribute('data-void-image-height');
    assert.equal(context.VOID_PhotoSets.resolveDimensions(figure, image).source, 'natural');
    image.complete = false;
    assert.equal(context.VOID_PhotoSets.resolveDimensions(figure, image), null);
});

test('unknown image dimensions hydrate from the real load and stale callbacks are ignored', () => {
    const { context } = loadVoid();
    const firstRoot = new FakeElement('main');
    const secondRoot = new FakeElement('main');
    const figure = new FakeElement('figure');
    const image = new FakeElement('img');
    image.setAttribute('data-void-image-content', '');
    image.complete = false;
    image.naturalWidth = 0;
    image.naturalHeight = 0;
    figure.appendChild(image);
    firstRoot.appendChild(figure);
    firstRoot.querySelectorAll = (selector) => selector === 'figure[data-void-image-item]' ? [figure] : [];
    secondRoot.querySelectorAll = () => [];

    context.VOID_PhotoSets.init(firstRoot);
    const staleLoad = image.listeners.get('load')[0];
    context.VOID_PhotoSets.init(secondRoot);
    image.complete = true;
    image.naturalWidth = 1200;
    image.naturalHeight = 800;
    staleLoad();
    assert.equal(figure.hasAttribute('data-void-image-width'), false);

    context.VOID_PhotoSets.init(firstRoot);
    image.dispatch('load');
    assert.equal(figure.getAttribute('data-void-image-width'), '1200');
    assert.equal(figure.getAttribute('data-void-image-height'), '800');
    assert.equal(image.getAttribute('width'), '1200');
    assert.equal(figure.styleValues.get('--void-image-ratio'), '1.5');
});

test('an early lazyload error does not discard later dimension hydration', () => {
    const { context } = loadVoid();
    const root = new FakeElement('main');
    const figure = new FakeElement('figure');
    const image = new FakeElement('img');
    image.setAttribute('data-void-image-content', '');
    image.complete = false;
    image.naturalWidth = 0;
    image.naturalHeight = 0;
    figure.appendChild(image);
    root.appendChild(figure);
    root.querySelectorAll = (selector) => selector === 'figure[data-void-image-item]' ? [figure] : [];

    context.VOID_PhotoSets.init(root);
    image.dispatch('error');
    assert.equal(image.listenerCount('load'), 1);

    image.complete = true;
    image.naturalWidth = 900;
    image.naturalHeight = 1200;
    image.dispatch('load');
    assert.equal(figure.getAttribute('data-void-image-width'), '900');
    assert.equal(figure.getAttribute('data-void-image-height'), '1200');
    assert.equal(image.listenerCount('load'), 0);
});

test('strip drag uses a threshold, suppresses only the resulting click, and never binds wheel', () => {
    const { context, link, root, set } = createStripFixture({ now: () => 1000 });

    context.VOID_PhotoSets.init(root);
    assert.equal(set.listenerCount('pointerdown'), 1);
    assert.equal(set.listenerCount('pointerleave'), 1);
    assert.equal(set.listenerCount('lostpointercapture'), 1);
    assert.equal(set.listenerCount('wheel'), 0);

    set.dispatch('pointerdown', { button: 0, clientX: 100, pointerId: 1, pointerType: 'mouse' });
    assert.deepEqual(set.setPointerCaptureCalls, []);
    const smallMove = preventableEvent({ clientX: 96, pointerId: 1 });
    set.dispatch('pointermove', smallMove);
    assert.equal(smallMove.defaultPrevented, false);
    assert.equal(set.scrollLeft, 0);
    assert.deepEqual(set.setPointerCaptureCalls, []);

    set.dispatch('pointerup', { pointerId: 1 });
    const ordinaryClick = preventableEvent({ target: link });
    set.dispatch('click', ordinaryClick);
    assert.equal(ordinaryClick.defaultPrevented, false);

    set.dispatch('pointerdown', { button: 0, clientX: 100, pointerId: 1, pointerType: 'mouse' });
    const dragMove = preventableEvent({ clientX: 78, pointerId: 1 });
    set.dispatch('pointermove', dragMove);
    assert.equal(dragMove.defaultPrevented, true);
    assert.equal(set.scrollLeft, 22);
    assert.equal(set.classList.contains('is-dragging'), true);
    assert.deepEqual(set.setPointerCaptureCalls, [1]);
    set.dispatch('pointerup', { pointerId: 1 });
    assert.equal(set.classList.contains('is-dragging'), false);
    assert.deepEqual(set.releasePointerCaptureCalls, [1]);

    const suppressedClick = preventableEvent({ target: link });
    suppressedClick.stopImmediatePropagation = () => { suppressedClick.stopped = true; };
    set.dispatch('click', suppressedClick);
    assert.equal(suppressedClick.defaultPrevented, true);
    assert.equal(suppressedClick.stopped, true);

    const nextClick = preventableEvent({ target: link });
    set.dispatch('click', nextClick);
    assert.equal(nextClick.defaultPrevented, false);

    const touchMove = preventableEvent({ clientX: 20, pointerId: 2 });
    set.dispatch('pointerdown', { button: 0, clientX: 100, pointerId: 2, pointerType: 'touch' });
    set.dispatch('pointermove', touchMove);
    assert.equal(touchMove.defaultPrevented, false);

    context.VOID_PhotoSets.destroy();
    context.VOID_PhotoSets.destroy();
    assert.equal(set.listenerCount('pointerdown'), 0);
});

test('strip pointerleave clears pending drags but leaves captured drags active', () => {
    const { context, set } = createStripFixture({ now: () => 1000 });

    set.dispatch('pointerdown', { button: 0, clientX: 100, pointerId: 11, pointerType: 'mouse' });
    set.dispatch('pointermove', preventableEvent({ clientX: 96, pointerId: 11 }));
    set.dispatch('pointerleave', { pointerId: 11 });

    const staleMove = preventableEvent({ clientX: 70, pointerId: 11 });
    set.dispatch('pointermove', staleMove);
    assert.equal(staleMove.defaultPrevented, false);
    assert.equal(set.scrollLeft, 0);
    assert.deepEqual(set.setPointerCaptureCalls, []);
    assert.equal(set.classList.contains('is-dragging'), false);

    set.dispatch('pointerdown', { button: 0, clientX: 100, pointerId: 12, pointerType: 'mouse' });
    set.dispatch('pointermove', preventableEvent({ clientX: 80, pointerId: 12 }));
    assert.equal(set.scrollLeft, 20);
    assert.deepEqual(set.setPointerCaptureCalls, [12]);
    assert.equal(set.classList.contains('is-dragging'), true);

    set.dispatch('pointerleave', { pointerId: 12 });
    const capturedMove = preventableEvent({ clientX: 70, pointerId: 12 });
    set.dispatch('pointermove', capturedMove);
    assert.equal(capturedMove.defaultPrevented, true);
    assert.equal(set.scrollLeft, 30);
    assert.equal(set.classList.contains('is-dragging'), true);

    set.dispatch('pointerup', { pointerId: 12 });
    assert.deepEqual(set.releasePointerCaptureCalls, [12]);
    context.VOID_PhotoSets.destroy();
});

test('strip pointerleave clears a drag when pointer capture fails', () => {
    const { context, set } = createStripFixture({ now: () => 1000 });
    set.setPointerCapture = () => {
        throw new Error('capture failed');
    };

    set.dispatch('pointerdown', { button: 0, clientX: 100, pointerId: 13, pointerType: 'mouse' });
    set.dispatch('pointermove', preventableEvent({ clientX: 80, pointerId: 13 }));
    assert.equal(set.scrollLeft, 20);
    assert.equal(set.classList.contains('is-dragging'), true);

    set.dispatch('pointerleave', { pointerId: 13 });
    const staleMove = preventableEvent({ clientX: 60, pointerId: 13 });
    set.dispatch('pointermove', staleMove);
    assert.equal(staleMove.defaultPrevented, false);
    assert.equal(set.scrollLeft, 20);
    assert.equal(set.classList.contains('is-dragging'), false);
    assert.deepEqual(set.releasePointerCaptureCalls, []);
    context.VOID_PhotoSets.destroy();
});

test('strip lostpointercapture clears only the matching drag without suppressing clicks', () => {
    const { context, link, set } = createStripFixture({ now: () => 1000 });

    set.dispatch('pointerdown', { button: 0, clientX: 100, pointerId: 21, pointerType: 'mouse' });
    set.dispatch('pointermove', preventableEvent({ clientX: 80, pointerId: 21 }));
    set.dispatch('lostpointercapture', { pointerId: 99 });
    assert.equal(set.classList.contains('is-dragging'), true);

    set.dispatch('lostpointercapture', { pointerId: 21 });
    const staleMove = preventableEvent({ clientX: 60, pointerId: 21 });
    set.dispatch('pointermove', staleMove);
    assert.equal(staleMove.defaultPrevented, false);
    assert.equal(set.scrollLeft, 20);
    assert.equal(set.classList.contains('is-dragging'), false);
    assert.deepEqual(set.releasePointerCaptureCalls, []);

    const click = preventableEvent({ target: link });
    set.dispatch('click', click);
    assert.equal(click.defaultPrevented, false);
    context.VOID_PhotoSets.destroy();
});

test('strip pointercancel releases capture without suppressing the next click', () => {
    const { context, link, set } = createStripFixture({ now: () => 1000 });

    set.dispatch('pointerdown', { button: 0, clientX: 100, pointerId: 22, pointerType: 'mouse' });
    set.dispatch('pointermove', preventableEvent({ clientX: 80, pointerId: 22 }));
    set.dispatch('pointercancel', { pointerId: 22 });
    assert.equal(set.classList.contains('is-dragging'), false);
    assert.deepEqual(set.releasePointerCaptureCalls, [22]);

    const staleMove = preventableEvent({ clientX: 60, pointerId: 22 });
    set.dispatch('pointermove', staleMove);
    assert.equal(staleMove.defaultPrevented, false);
    assert.equal(set.scrollLeft, 20);

    const click = preventableEvent({ target: link });
    set.dispatch('click', click);
    assert.equal(click.defaultPrevented, false);
    context.VOID_PhotoSets.destroy();
});

test('strip controls progressively expose adjacent photos and restore the source DOM on destroy', () => {
    const { context, root, set } = createStripControlFixture({ now: () => 1000 });
    const frame = set.parentNode;
    const controls = frame.children[0];
    const previous = controls.querySelector('[data-void-photo-prev]');
    const next = controls.querySelector('[data-void-photo-next]');

    assert.equal(frame.getAttribute('data-void-photo-strip-frame'), '');
    assert.equal(previous.hidden, true);
    assert.equal(next.hidden, false);
    assert.equal(previous.disabled, true);
    assert.equal(next.disabled, false);

    next.dispatch('click', preventableEvent({ target: next }));
    assert.equal(set.scrollToCalls.length, 1);
    assert.equal(set.scrollToCalls[0].behavior, 'smooth');
    assert.ok(set.scrollLeft > 0);

    set.dispatch('scroll');
    assert.equal(previous.hidden, false);
    assert.equal(previous.disabled, false);

    set.scrollLeft = set.scrollWidth - set.clientWidth;
    set.dispatch('scroll');
    assert.equal(next.hidden, true);
    assert.equal(next.disabled, true);

    context.VOID_PhotoSets.destroy();
    assert.equal(set.parentNode, root);
    assert.equal(root.children.includes(frame), false);
    assert.equal(previous.listenerCount('click'), 0);
    assert.equal(next.listenerCount('click'), 0);
});

test('strip controls use instant scrolling when reduced motion is enabled', () => {
    const { context, set } = createStripControlFixture({ reducedMotion: true });
    const controls = set.parentNode.children[0];
    const next = controls.querySelector('[data-void-photo-next]');

    next.dispatch('click', preventableEvent({ target: next }));
    assert.equal(set.scrollToCalls[0].behavior, 'auto');
    context.VOID_PhotoSets.destroy();
});

test('pair and single photo sets do not receive strip controls', () => {
    const { context } = loadVoid();
    const root = new FakeElement('main');
    const pair = new FakeElement('div');
    pair.setAttribute('data-void-photo-layout', 'pair');
    root.appendChild(pair);
    root.querySelectorAll = (selector) => selector === '[data-void-photo-set]' ? [pair] : [];

    context.VOID_PhotoSets.init(root);
    assert.equal(pair.parentNode, root);
    assert.equal(root.children.length, 1);
    context.VOID_PhotoSets.destroy();
});

test('strip destroy releases active capture once and removes lifecycle listeners', () => {
    const { context, set } = createStripFixture({ now: () => 1000 });
    const lifecycleEvents = [
        'pointerdown',
        'pointermove',
        'pointerup',
        'pointercancel',
        'pointerleave',
        'lostpointercapture',
        'click',
        'focusin',
        'dragstart'
    ];
    set.releasePointerCapture = function (pointerId) {
        this.releasePointerCaptureCalls.push(pointerId);
        assert.equal(this.listenerCount('lostpointercapture'), 1);
        this.dispatch('lostpointercapture', { pointerId });
    };

    set.dispatch('pointerdown', { button: 0, clientX: 100, pointerId: 23, pointerType: 'mouse' });
    set.dispatch('pointermove', preventableEvent({ clientX: 80, pointerId: 23 }));
    assert.equal(set.classList.contains('is-dragging'), true);

    context.VOID_PhotoSets.destroy();
    context.VOID_PhotoSets.destroy();
    assert.deepEqual(set.releasePointerCaptureCalls, [23]);
    assert.equal(set.classList.contains('is-dragging'), false);
    lifecycleEvents.forEach((eventName) => assert.equal(set.listenerCount(eventName), 0));
});

test('keyboard focus scrolls an off-screen strip item into view', () => {
    const { context } = loadVoid({ reducedMotion: true });
    const root = new FakeElement('main');
    const set = new FakeElement('div');
    const figure = new FakeElement('figure');
    const link = new FakeElement('a');
    set.setAttribute('data-void-photo-layout', 'strip');
    figure.setAttribute('data-void-image-item', '');
    figure.offsetLeft = 420;
    figure.offsetWidth = 160;
    figure.rect = { left: 420, top: 0, width: 160, height: 260 };
    set.rect = { left: 0, top: 0, width: 320, height: 300 };
    link.setAttribute('data-void-image-zoom', '');
    figure.appendChild(link);
    set.appendChild(figure);
    root.appendChild(set);
    root.querySelectorAll = (selector) => selector === '[data-void-photo-set]' ? [set] : [];

    context.VOID_PhotoSets.init(root);
    set.dispatch('focusin', { target: link });
    assert.equal(set.scrollToCalls.length, 1);
    assert.equal(set.scrollToCalls[0].left, 280);
    assert.equal(set.scrollToCalls[0].behavior, 'auto');
});

test('theme external-link parsing excludes generated image links', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.js'), 'utf8');
    assert.match(source, /:not\(\.void-image-link\)/);
});

test('photo-set styles keep pair ratios, native strip scrolling, and responsive row heights', () => {
    const styles = fs.readFileSync(path.resolve(__dirname, '../../assets/parts/_article.scss'), 'utf8');
    const script = fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.js'), 'utf8');
    const photoSetsSource = script.slice(
        script.indexOf('var VOID_PhotoSets'),
        script.indexOf('var VOID_PhotoSwipe')
    );

    assert.match(styles, /gap: 8px;/);
    assert.match(styles, /--void-photo-gap: 6px;/);
    assert.match(styles, /--void-photo-gap: 4px;/);
    assert.match(styles, /\.void-photo-strip-frame/);
    assert.doesNotMatch(styles, /data-void-photo-position/);
    assert.match(styles, /flex: var\(--void-image-ratio, 1\.3333\) 1 0;/);
    assert.match(styles, /min-width: 0;/);
    assert.match(styles, /overflow-x: auto;/);
    assert.match(styles, /scroll-snap-type: x mandatory;/);
    assert.match(styles, /scroll-snap-align: start;/);
    assert.match(styles, /scroll-snap-stop: normal;/);
    assert.doesNotMatch(photoSetsSource, /addEventListener\(['"](?:wheel|mousewheel)/);
    assert.match(styles, /\.void-photo-strip-control[\s\S]*width: 44px;[\s\S]*height: 44px;/);
    assert.match(styles, /\.void-photo-strip-control[\s\S]*border-radius: 50%;/);
    assert.match(styles, /&::before \{[\s\S]*inset: 4px;[\s\S]*backdrop-filter: blur\(4px\);/);
    assert.match(styles, /\.voidicon-left,[\s\S]*\.voidicon-right \{[\s\S]*color: #fff;[\s\S]*font-style: normal;/);
    assert.match(styles, /\.void-photo-strip-control[\s\S]*box-shadow: none;/);
    assert.match(
        styles,
        /&\[data-void-photo-layout="strip"\][\s\S]*&:focus-visible[\s\S]*outline-offset: -2px;/
    );
    assert.match(
        styles,
        /&\[data-void-photo-layout="strip"\][\s\S]*\[data-void-image-zoom\]:focus-visible[\s\S]*outline-offset: -3px;/
    );
    assert.match(
        styles,
        /figure \{\s+flex: 0 0 auto;\s+(?:\/\/[^\n]+\s+)?width: min-content;/
    );
    assert.doesNotMatch(
        styles,
        /figure \{\s+flex: 0 0 auto;\s+(?:\/\/[^\n]+\s+)?width: fit-content;/
    );
    assert.match(styles, /width: 0;\s+min-width: 100%;\s+max-width: none;/);
    assert.doesNotMatch(styles, /width: max-content;/);
    assert.match(styles, /--void-photo-row-height: 480px;/);
    assert.match(styles, /--void-photo-row-height: 400px;/);
    assert.match(styles, /--void-photo-row-height: 260px;/);
    assert.match(
        fs.readFileSync(path.resolve(__dirname, '../../assets/parts/_image-experience.scss'), 'utf8'),
        /\.void-image-link\[data-void-image-zoom\][\s\S]*&:focus-visible[\s\S]*outline: 2px solid \$highlightColor;/
    );
});

test('large photo-set width remains limited to single and pair layouts', () => {
    const styles = fs.readFileSync(path.resolve(__dirname, '../../assets/parts/_article.scss'), 'utf8');
    const compiled = sass.compile(path.resolve(__dirname, '../../assets/VOID.scss'), {
        loadPaths: [path.resolve(__dirname, '../../assets')],
        style: 'expanded'
    }).css;

    assert.match(
        styles,
        /&\.large\s*\{[\s\S]*?&\[data-void-photo-layout="strip"\][\s\S]*?width: 100%;[\s\S]*?margin-left: 0;/
    );
    assert.match(
        compiled,
        /article \.photos\.large\[data-void-photo-layout=strip\] \{\s+width: 100%;\s+margin-left: 0;\s+\}/
    );
});

test('PhotoSwipe adapter only overrides explicit VOID integration options', () => {
    const regular = loadVoid();
    const options = regular.context.VOID_PhotoSwipe.__test.getOptions();
    const nativeOptionNames = [
        'allowPanToNext',
        'closeOnVerticalDrag',
        'pinchToClose',
        'wheelToZoom',
        'loop',
        'imageClickAction',
        'tapAction',
        'doubleTapAction',
        'bgClickAction',
        'clickToCloseNonZoomable',
        'secondaryZoomLevel',
        'showAnimationDuration',
        'hideAnimationDuration',
        'zoomAnimationDuration',
        'easing'
    ];

    assert.equal(options.pswpModule, regular.window.PhotoSwipe);
    assert.equal(options.mainClass, 'void-photoswipe');
    assert.equal(options.bgOpacity, 1);
    assert.equal(options.returnFocus, false);
    assert.equal(typeof options.paddingFn, 'function');
    assert.equal(options.closeTitle, '关闭图片预览');
    assert.equal(options.zoomTitle, '切换图片缩放');
    assert.equal(options.arrowPrevTitle, '上一张图片');
    assert.equal(options.arrowNextTitle, '下一张图片');
    assert.equal(options.errorMsg, '图片加载失败');
    nativeOptionNames.forEach((name) => {
        assert.equal(Object.prototype.hasOwnProperty.call(options, name), false, name);
    });
});

test('PhotoSwipe padding combines responsive spacing with valid safe-area insets', () => {
    const { context, window } = loadVoid();
    const photoSwipeRoot = new FakeElement('div');
    window.pswp = { element: photoSwipeRoot };

    assert.deepEqual(
        { ...context.VOID_PhotoSwipe.__test.getPadding({ x: 1280, y: 800 }) },
        { top: 24, right: 24, bottom: 24, left: 24 }
    );
    assert.deepEqual(
        { ...context.VOID_PhotoSwipe.__test.getPadding({ x: 390, y: 844 }) },
        { top: 16, right: 12, bottom: 16, left: 12 }
    );

    photoSwipeRoot.computedStyle = {
        '--void-pswp-safe-top': '47px',
        '--void-pswp-safe-right': '21.5px',
        '--void-pswp-safe-bottom': '34px',
        '--void-pswp-safe-left': 'invalid'
    };
    assert.deepEqual(
        { ...context.VOID_PhotoSwipe.__test.getPadding({ x: 390, y: 844 }) },
        { top: 47, right: 21.5, bottom: 34, left: 12 }
    );

    photoSwipeRoot.computedStyle = {
        '--void-pswp-safe-top': '-10px',
        '--void-pswp-safe-right': 'NaN',
        '--void-pswp-safe-bottom': '',
        '--void-pswp-safe-left': '-0.5px'
    };
    assert.deepEqual(
        { ...context.VOID_PhotoSwipe.__test.getPadding({ x: 390, y: 844 }) },
        { top: 16, right: 12, bottom: 16, left: 12 }
    );
});

test('PhotoSwipe keeps VOID Space and Enter closing without overriding viewer controls', () => {
    const { context, document } = loadVoid();
    const root = new FakeElement('main');
    const article = new FakeElement('article');
    const source = createSource(article);
    const viewer = new FakeElement('div');
    const viewerImage = new FakeElement('img');
    const closeButton = new FakeElement('button');
    root.appendChild(article);
    viewer.appendChild(viewerImage);
    viewer.appendChild(closeButton);
    document.body.appendChild(viewer);
    document.root = root;
    context.VOID_PhotoSwipe.init(root);

    const lightbox = FakePhotoSwipeLightbox.instances[0];
    let closeCount = 0;
    lightbox.pswp = {
        close() {
            closeCount += 1;
        },
        element: viewer
    };

    for (const [key, target] of [[' ', source.link], ['Spacebar', viewerImage], ['Enter', viewer]]) {
        const originalEvent = preventableEvent({ key, target });
        const photoSwipeEvent = preventableEvent({ originalEvent });
        lightbox.emit('keydown', photoSwipeEvent);
        assert.equal(originalEvent.defaultPrevented, true, key);
        assert.equal(photoSwipeEvent.defaultPrevented, true, key);
    }
    assert.equal(closeCount, 3);

    for (const key of [' ', 'Enter']) {
        const originalEvent = preventableEvent({ key, target: closeButton });
        const photoSwipeEvent = preventableEvent({ originalEvent });
        lightbox.emit('keydown', photoSwipeEvent);
        assert.equal(originalEvent.defaultPrevented, false, key);
        assert.equal(photoSwipeEvent.defaultPrevented, false, key);
    }
    assert.equal(closeCount, 3);

    const modifiedEvent = preventableEvent({ ctrlKey: true, key: ' ', target: viewerImage });
    lightbox.emit('keydown', preventableEvent({ originalEvent: modifiedEvent }));
    assert.equal(modifiedEvent.defaultPrevented, false);
    assert.equal(closeCount, 3);
});

test('PhotoSwipe adapter groups article images and preserves item dimensions, alt, and crop data', () => {
    const { context, document } = loadVoid();
    const root = new FakeElement('main');
    const firstArticle = new FakeElement('article');
    const secondArticle = new FakeElement('article');
    const first = createSource(firstArticle, {
        alt: '第一张',
        height: 900,
        href: '/first.jpg',
        objectFit: 'cover',
        width: 1600
    });
    const hidden = createSource(firstArticle, {
        alt: '隐藏图片',
        height: 1600,
        href: '/hidden.jpg',
        lazySource: '/hidden-thumb.jpg',
        previewSource: '',
        width: 900
    });
    const other = createSource(secondArticle, { href: '/other-article.jpg' });
    root.appendChild(firstArticle);
    root.appendChild(secondArticle);
    document.root = root;
    context.VOID_PhotoSwipe.init(root);

    const dataSource = context.VOID_PhotoSwipe.__test.getDataSource(first.link);
    assert.equal(context.VOID_PhotoSwipe.__test.getGroupElement(first.link), firstArticle);
    assert.equal(dataSource.index, 0);
    assert.equal(dataSource.items.length, 2);
    assert.equal(dataSource.items[0].src, '/first.jpg');
    assert.equal(dataSource.items[0].width, 1600);
    assert.equal(dataSource.items[0].height, 900);
    assert.equal(dataSource.items[0].alt, '第一张');
    assert.equal(dataSource.items[0].element, first.link);
    assert.equal(dataSource.items[0].thumbCropped, true);
    assert.equal(dataSource.items[1].src, '/hidden.jpg');
    assert.equal(dataSource.items[1].msrc, undefined);
    assert.equal(hidden.image.getAttribute('src'), '');
    assert.equal(hidden.image.getAttribute('data-src'), '/hidden-thumb.jpg');
    assert.equal(dataSource.items.some((item) => item.element === other.link), false);
});

test('PhotoSwipe adapter keeps Gallery sets separate inside one article', () => {
    const { context, document } = loadVoid();
    const root = new FakeElement('main');
    const article = new FakeElement('article');
    const firstSet = new FakeElement('div');
    const secondSet = new FakeElement('div');
    firstSet.setAttribute('data-void-gallery-set', '');
    secondSet.setAttribute('data-void-gallery-set', '');
    const first = createSource(firstSet, { href: '/gallery-1.jpg' });
    const second = createSource(firstSet, { href: '/gallery-2.jpg' });
    const third = createSource(secondSet, { href: '/gallery-3.jpg' });
    article.appendChild(firstSet);
    article.appendChild(secondSet);
    root.appendChild(article);
    document.root = root;
    context.VOID_PhotoSwipe.init(root);

    const firstDataSource = context.VOID_PhotoSwipe.__test.getDataSource(second.link);
    const secondDataSource = context.VOID_PhotoSwipe.__test.getDataSource(third.link);
    assert.equal(context.VOID_PhotoSwipe.__test.getGroupElement(first.link), firstSet);
    assert.equal(firstDataSource.index, 1);
    assert.deepEqual(Array.from(firstDataSource.items, (item) => item.src), [
        '/gallery-1.jpg',
        '/gallery-2.jpg'
    ]);
    assert.deepEqual(Array.from(secondDataSource.items, (item) => item.src), ['/gallery-3.jpg']);
});

test('PhotoSwipe adapter init and destroy are idempotent across PJAX reconstruction', () => {
    const { context, document } = loadVoid();
    const root = new FakeElement('main');
    const article = new FakeElement('article');
    const source = createSource(article);
    root.appendChild(article);
    document.root = root;

    context.VOID_PhotoSwipe.init(root);
    const firstLightbox = FakePhotoSwipeLightbox.instances[0];
    context.VOID_PhotoSwipe.init(root);
    const secondLightbox = FakePhotoSwipeLightbox.instances[1];
    assert.equal(firstLightbox.destroyCount, 1);
    assert.equal(secondLightbox.initCount, 1);
    assert.equal(root.listenerCount('click'), 1);

    const click = preventableEvent({ clientX: 120, clientY: 80, target: source.image });
    root.dispatch('click', click);
    assert.equal(click.defaultPrevented, true);
    assert.equal(secondLightbox.openCalls.length, 1);
    assert.equal(secondLightbox.openCalls[0].index, 0);
    assert.equal(secondLightbox.openCalls[0].initialPoint.x, 120);
    assert.equal(secondLightbox.openCalls[0].initialPoint.y, 80);

    document.activeElement = document.body;
    secondLightbox.emit('destroy');
    secondLightbox.emit('destroy');
    assert.equal(document.activeElement, source.link);
    assert.equal(source.link.focusCount, 1);

    context.VOID_PhotoSwipe.destroy();
    context.VOID_PhotoSwipe.destroy();
    assert.equal(secondLightbox.destroyCount, 1);
    assert.equal(root.listenerCount('click'), 0);
});

test('PhotoSwipe adapter leaves modified, alternate-target, and invalid image links native', () => {
    const { context, document } = loadVoid();
    const root = new FakeElement('main');
    const article = new FakeElement('article');
    const source = createSource(article);
    root.appendChild(article);
    document.root = root;
    context.VOID_PhotoSwipe.init(root);
    const lightbox = FakePhotoSwipeLightbox.instances[0];

    for (const eventOptions of [
        { ctrlKey: true },
        { metaKey: true },
        { shiftKey: true },
        { altKey: true },
        { button: 1 }
    ]) {
        const click = preventableEvent({ ...eventOptions, target: source.image });
        root.dispatch('click', click);
        assert.equal(click.defaultPrevented, false);
    }

    source.link.setAttribute('target', '_blank');
    const blankClick = preventableEvent({ target: source.image });
    root.dispatch('click', blankClick);
    assert.equal(blankClick.defaultPrevented, false);
    source.link.removeAttribute('target');

    source.figure.removeAttribute('data-void-image-width');
    source.figure.removeAttribute('data-void-image-height');
    const missingDimensionsClick = preventableEvent({ target: source.image });
    root.dispatch('click', missingDimensionsClick);
    assert.equal(missingDimensionsClick.defaultPrevented, false);
    assert.equal(lightbox.openCalls.length, 0);
});

test('reward image button closes by click or keyboard while preserving its scroll lock', () => {
    const { context, document, window } = loadVoid();
    const root = new FakeElement('main');
    const { closeButton, content, dialog, rewardImage, trigger } = createRewardSource(root, document);
    document.root = root;
    document.body.classList.add('sidebar-show');

    context.VOID_RewardDialog.init(root);
    context.VOID_RewardDialog.init(root);
    assert.equal(trigger.listenerCount('click'), 1);
    assert.equal(closeButton.listenerCount('click'), 1);
    assert.equal(closeButton.listenerCount('keydown'), 0);
    assert.equal(closeButton.contains(rewardImage), true);
    assert.equal(closeButton.getAttribute('data-void-reward-close'), '');
    assert.equal(closeButton.getAttribute('aria-label'), '关闭赞赏二维码');

    const modifiedClick = preventableEvent({ ctrlKey: true, target: trigger });
    trigger.dispatch('click', modifiedClick);
    assert.equal(modifiedClick.defaultPrevented, false);
    assert.equal(dialog.open, false);

    const openClick = preventableEvent({ target: trigger });
    trigger.dispatch('click', openClick);
    assert.equal(openClick.defaultPrevented, true);
    assert.equal(dialog.open, true);
    assert.equal(closeButton.focusCount, 1);
    assert.equal(closeButton.focusCalls[0] && closeButton.focusCalls[0].preventScroll, true);
    assert.equal(document.activeElement, closeButton);
    assert.equal(document.body.classList.contains('void-dialog-open'), true);
    assert.equal(document.body.classList.contains('sidebar-show'), true);

    window.setScrollY(120);
    window.advanceTime(500);
    assert.equal(dialog.open, true);
    assert.equal(document.body.classList.contains('void-dialog-open'), true);

    dialog.dispatch('click', { target: content });
    assert.equal(dialog.open, false);

    trigger.dispatch('click', preventableEvent({ target: trigger }));
    closeButton.dispatch('click', { target: rewardImage });
    assert.equal(dialog.open, false);
    assert.equal(trigger.focusCount, 2);
    assert.equal(trigger.focusCalls[0].preventScroll, true);
    assert.equal(document.activeElement, trigger);
    assert.equal(document.body.classList.contains('void-dialog-open'), false);
    assert.equal(document.body.classList.contains('sidebar-show'), true);

    for (const key of ['Enter', ' ']) {
        trigger.dispatch('click', preventableEvent({ target: trigger }));
        closeButton.keyboardActivate(key);
        assert.equal(dialog.open, false);
    }

    trigger.dispatch('click', preventableEvent({ target: trigger }));
    dialog.dispatch('click', { target: dialog });
    assert.equal(dialog.open, false);

    trigger.dispatch('click', preventableEvent({ target: trigger }));
    const cancelEvent = preventableEvent({ target: dialog });
    dialog.dispatch('cancel', cancelEvent);
    assert.equal(cancelEvent.defaultPrevented, true);
    assert.equal(dialog.open, false);
    assert.equal(trigger.focusCount, 6);
    assert.equal(document.body.classList.contains('sidebar-show'), true);
});

test('reward dialog fallback preserves the real target-blank link', () => {
    for (const dialogMode of ['unsupported', 'throw']) {
        const { context, document } = loadVoid({ dialogMode });
        const root = new FakeElement('main');
        const { trigger } = createRewardSource(root, document);
        document.root = root;
        context.VOID_RewardDialog.init(root);

        const click = preventableEvent({ target: trigger });
        trigger.dispatch('click', click);
        assert.equal(click.defaultPrevented, false);
        assert.equal(trigger.getAttribute('target'), '_blank');
        assert.equal(document.body.classList.contains('void-dialog-open'), false);
    }
});

test('reward template makes the QR image the semantic close button', () => {
    const template = fs.readFileSync(path.resolve(__dirname, '../../includes/main.php'), 'utf8');
    const dialogStart = template.indexOf('<dialog class="void-reward-dialog"');
    const dialogEnd = template.indexOf('</dialog>', dialogStart);
    const rewardMarkup = template.slice(dialogStart, dialogEnd + '</dialog>'.length);

    assert.match(
        rewardMarkup,
        /<button(?=[^>]*data-void-reward-close)[^>]*>[\s\S]*?<img[\s\S]*?alt=""[\s\S]*?>[\s\S]*?<\/button>/
    );
    assert.doesNotMatch(rewardMarkup, /void-dialog-close/);
});

test('reward dialog has independent scroll ownership and PJAX-safe teardown', () => {
    const { context, document } = loadVoid();
    const root = new FakeElement('main');
    const { closeButton, dialog, trigger } = createRewardSource(root, document);
    document.root = root;
    context.VOID_RewardDialog.init(root);

    context.VOID_DialogScrollLock.lock('other-dialog');
    trigger.dispatch('click', preventableEvent({ target: trigger }));
    context.VOID_RewardDialog.destroy();
    context.VOID_RewardDialog.destroy();
    assert.equal(trigger.focusCount, 0);
    assert.equal(trigger.listenerCount('click'), 0);
    assert.equal(closeButton.listenerCount('click'), 0);
    assert.equal(dialog.listenerCount('click'), 0);
    assert.equal(dialog.listenerCount('cancel'), 0);
    assert.equal(dialog.listenerCount('close'), 0);
    assert.equal(document.body.classList.contains('void-dialog-open'), true);

    context.VOID_DialogScrollLock.unlock('other-dialog');
    assert.equal(document.body.classList.contains('void-dialog-open'), false);
});

test('PhotoSwipe 5.4.4 assets, license, build order, and adapter boundary are fixed', () => {
    const repositoryRoot = path.resolve(__dirname, '../..');
    const runtimeSource = fs.readFileSync(path.join(repositoryRoot, 'assets/VOID.js'), 'utf8');
    const packageSource = fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8');
    const gulpSource = fs.readFileSync(path.join(repositoryRoot, 'gulpfile.js'), 'utf8');
    const viewerStyles = fs.readFileSync(
        path.join(repositoryRoot, 'assets/parts/_image-experience.scss'),
        'utf8'
    );
    const photoSwipeRoot = path.join(repositoryRoot, 'assets/libs/photoswipe');
    const coreSource = fs.readFileSync(path.join(photoSwipeRoot, 'photoswipe.umd.min.js'), 'utf8');
    const lightboxSource = fs.readFileSync(
        path.join(photoSwipeRoot, 'photoswipe-lightbox.umd.min.js'),
        'utf8'
    );
    const cssSource = fs.readFileSync(path.join(photoSwipeRoot, 'photoswipe.css'), 'utf8');
    const licenseSource = fs.readFileSync(path.join(photoSwipeRoot, 'LICENSE'), 'utf8');
    const vendorDocument = new FakeDocument();
    const vendorWindow = new FakeWindow(vendorDocument);
    const vendorNavigator = { maxTouchPoints: 2, userAgent: '', vendor: '' };
    const vendorContext = {
        document: vendorDocument,
        navigator: vendorNavigator,
        window: vendorWindow
    };
    vendorWindow.navigator = vendorNavigator;
    vendorWindow.PointerEvent = function PointerEvent() {};

    assert.equal(fs.existsSync(path.join(repositoryRoot, 'assets/libs/fancybox')), false);
    assert.doesNotMatch(runtimeSource, /configureFancybox|data-fancybox|jQuery\.fancybox/);
    assert.doesNotMatch(runtimeSource, /VOID_ImageZoom|scrollThreshold|requestScrollClose/);
    assert.match(runtimeSource, /var VOID_PhotoSwipe/);
    assert.doesNotMatch(packageSource, /photoswipe|zoom\.js|fancybox/i);
    assert.match(coreSource, /PhotoSwipe 5\.4\.4/);
    assert.match(lightboxSource, /PhotoSwipe Lightbox 5\.4\.4/);
    assert.match(cssSource, /PhotoSwipe main CSS/);
    assert.match(licenseSource, /MIT License/);
    vm.runInNewContext(coreSource, vendorContext);
    vm.runInNewContext(lightboxSource, vendorContext);
    assert.equal(typeof vendorContext.PhotoSwipe, 'function');
    assert.equal(typeof vendorContext.PhotoSwipeLightbox, 'function');
    const photoSwipe = new vendorContext.PhotoSwipe();
    assert.equal(photoSwipe.options.allowPanToNext, true);
    assert.equal(photoSwipe.options.pinchToClose, true);
    assert.equal(photoSwipe.options.loop, true);
    assert.equal(photoSwipe.options.imageClickAction, 'zoom-or-close');
    assert.equal(photoSwipe.options.tapAction, 'toggle-controls');
    assert.equal(photoSwipe.options.doubleTapAction, 'zoom');
    assert.equal(photoSwipe.options.clickToCloseNonZoomable, true);
    assert.equal(photoSwipe.options.showAnimationDuration, 333);
    assert.equal(photoSwipe.options.hideAnimationDuration, 333);
    assert.equal(photoSwipe.options.zoomAnimationDuration, 333);
    assert.equal(new vendorContext.PhotoSwipe({ dataSource: [{}, {}] }).canLoop(), false);
    assert.equal(new vendorContext.PhotoSwipe({ dataSource: [{}, {}, {}] }).canLoop(), true);
    vendorWindow.reducedMotion = true;
    const reducedPhotoSwipe = new vendorContext.PhotoSwipe();
    assert.equal(reducedPhotoSwipe.options.showHideAnimationType, 'none');
    assert.equal(reducedPhotoSwipe.options.zoomAnimationDuration, 0);
    assert.match(
        coreSource,
        /allowPanToNext:!0[\s\S]*loop:!0[\s\S]*pinchToClose:!0[\s\S]*hideAnimationDuration:333[\s\S]*showAnimationDuration:333[\s\S]*zoomAnimationDuration:333/
    );
    assert.match(
        coreSource,
        /clickToCloseNonZoomable:!0[\s\S]*imageClickAction:"zoom-or-close"[\s\S]*bgClickAction:"close"[\s\S]*tapAction:"toggle-controls"[\s\S]*doubleTapAction:"zoom"/
    );
    assert.match(coreSource, /Math\.min\(1,3\*this\.fit\)/);
    assert.match(coreSource, />4e3/);
    assert.match(coreSource, /canLoop\(\)\{return this\.options\.loop&&this\.getNumItems\(\)>2\}/);
    assert.ok(
        gulpSource.indexOf("'./assets/libs/photoswipe/photoswipe.umd.min.js'")
            < gulpSource.indexOf("'./assets/libs/photoswipe/photoswipe-lightbox.umd.min.js'"),
        'PhotoSwipe core must be bundled before PhotoSwipeLightbox'
    );
    assert.match(gulpSource, /\.\/assets\/libs\/photoswipe\/LICENSE/);
    assert.match(viewerStyles, /\.void-photoswipe\s*\{/);
    assert.match(viewerStyles, /\.theme-dark \.void-photoswipe\s*\{/);
    assert.doesNotMatch(viewerStyles, /--pswp-root-z-index/);
    assert.match(viewerStyles, /--void-pswp-safe-top: env\(safe-area-inset-top, 0px\);/);
    assert.match(viewerStyles, /--void-pswp-safe-right: env\(safe-area-inset-right, 0px\);/);
    assert.match(viewerStyles, /--void-pswp-safe-bottom: env\(safe-area-inset-bottom, 0px\);/);
    assert.match(viewerStyles, /--void-pswp-safe-left: env\(safe-area-inset-left, 0px\);/);
    assert.match(viewerStyles, /\.pswp__top-bar[\s\S]*top: var\(--void-pswp-safe-top\);/);
    assert.match(viewerStyles, /\.pswp__button--arrow--prev[\s\S]*left: var\(--void-pswp-safe-left\);/);
    assert.match(viewerStyles, /\.pswp__button--arrow--next[\s\S]*right: var\(--void-pswp-safe-right\);/);
    assert.doesNotMatch(viewerStyles, /void-image-zoom-(?:overlay|stage|source)/);
});

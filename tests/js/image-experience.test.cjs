const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

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

    querySelector(selector) {
        const matches = (node) => {
            if (selector === 'img[data-void-image-content]') {
                return node.tagName === 'IMG' && node.hasAttribute('data-void-image-content');
            }
            if (selector === 'a[data-void-image-zoom]') {
                return node.tagName === 'A' && node.hasAttribute('data-void-image-zoom');
            }
            if (selector === '[data-void-reward-link]') {
                return node.hasAttribute('data-void-reward-link');
            }
            if (selector === 'dialog[data-void-reward-dialog]') {
                return node.tagName === 'DIALOG' && node.hasAttribute('data-void-reward-dialog');
            }
            if (selector === '[data-void-reward-close]') {
                return node.hasAttribute('data-void-reward-close');
            }
            return false;
        };
        const visit = (node) => {
            for (const child of node.children) {
                if (matches(child)) {
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

    querySelectorAll() {
        return [];
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
        return {
            paddingTop: '24px',
            paddingRight: '24px',
            paddingBottom: '24px',
            paddingLeft: '24px',
            ...(element.computedStyle || {})
        };
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

function loadVoid(options = {}) {
    const document = new FakeDocument(options.dialogMode || 'supported');
    const window = new FakeWindow(document, options.reducedMotion || false);
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
    return { context, document, window };
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

function createSource(root) {
    const link = new FakeElement('a');
    const image = new FakeElement('img');
    link.setAttribute('data-void-image-zoom', '');
    link.setAttribute('href', '/original.jpg');
    image.setAttribute('data-void-image-content', '');
    image.setAttribute('alt', '测试图片');
    image.setAttribute('src', '/display.jpg');
    image.complete = true;
    image.currentSrc = '/display.jpg';
    image.naturalWidth = 1600;
    image.naturalHeight = 900;
    image.rect = { left: 20, top: 30, width: 320, height: 180 };
    link.appendChild(image);
    root.appendChild(link);
    return { image, link };
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

function createZoomFixture(options = {}) {
    const { context, document, window } = loadVoid(options);
    const root = new FakeElement('main');
    window.setScrollY(options.scrollY || 0, false);
    const { image, link } = createSource(root);
    const sourceDocumentRect = {
        left: image.rect.left + window.scrollX,
        top: image.rect.top + window.scrollY,
        width: image.rect.width,
        height: image.rect.height
    };
    image.rectProvider = () => ({
        left: sourceDocumentRect.left - window.scrollX,
        top: sourceDocumentRect.top - window.scrollY,
        width: sourceDocumentRect.width,
        height: sourceDocumentRect.height
    });
    document.root = root;
    document.body.appendChild(root);
    if (options.sidebarOpen) {
        document.body.classList.add('sidebar-show');
    }
    context.VOID_ImageZoom.init(root);
    const stage = context.VOID_ImageZoom.stage;
    if (stage) {
        stage.rectProvider = () => {
            const left = parseFloat(stage.style.left) || 0;
            const top = parseFloat(stage.style.top) || 0;
            const width = parseFloat(stage.style.width) || 0;
            const height = parseFloat(stage.style.height) || 0;
            const transform = stage.style.transform || 'none';
            const match = transform.match(
                /translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0\)\s*scale\(([-\d.]+),\s*([-\d.]+)\)/
            );
            const translateX = match ? Number(match[1]) : 0;
            const translateY = match ? Number(match[2]) : 0;
            const scaleX = match ? Number(match[3]) : 1;
            const scaleY = match ? Number(match[4]) : 1;
            const scaledWidth = width * scaleX;
            const scaledHeight = height * scaleY;
            return {
                left: left - window.scrollX + translateX + (width - scaledWidth) / 2,
                top: top - window.scrollY + translateY + (height - scaledHeight) / 2,
                width: scaledWidth,
                height: scaledHeight
            };
        };
    }
    return { context, document, image, link, root, sourceDocumentRect, stage, window };
}

function openZoom(fixture) {
    const click = preventableEvent({ target: fixture.image });
    fixture.document.dispatch('click', click);
    return click;
}

function finishZoomOpening(fixture) {
    fixture.window.flushAnimationFrames();
    fixture.context.VOID_ImageZoom.stage.dispatch('transitionend', {
        propertyName: 'transform',
        target: fixture.context.VOID_ImageZoom.stage
    });
}

function finishZoomClosing(fixture, propertyName = 'transform') {
    fixture.window.flushAnimationFrames();
    fixture.context.VOID_ImageZoom.stage.dispatch('transitionend', {
        propertyName,
        target: fixture.context.VOID_ImageZoom.stage
    });
}

function assertSinglePassiveListener(target, eventName) {
    const options = target.listenerOptionsFor(eventName);
    assert.equal(options.length, 1);
    assert.equal(options[0] && options[0].passive, true);
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
        script.indexOf('var VOID_ImageZoom')
    );

    assert.match(styles, /gap: 8px;/);
    assert.match(styles, /flex: var\(--void-image-ratio, 1\.3333\) 1 0;/);
    assert.match(styles, /min-width: 0;/);
    assert.match(styles, /overflow-x: auto;/);
    assert.match(styles, /scroll-snap-type: x proximity;/);
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
    assert.match(
        fs.readFileSync(path.resolve(__dirname, '../../assets/parts/_image-experience.scss'), 'utf8'),
        /touch-action: pan-y pinch-zoom;/
    );
    assert.doesNotMatch(photoSetsSource, /addEventListener\(['"](?:wheel|mousewheel)/);
});

test('image zoom creates body overlay and document stage without a dialog or scroll lock', () => {
    const fixture = createZoomFixture({ reducedMotion: true, scrollY: 200, sidebarOpen: true });
    const { context, document, image, link, sourceDocumentRect, stage, window } = fixture;
    const zoom = context.VOID_ImageZoom;

    assert.deepEqual(document.createdTags, ['DIV', 'DIV', 'BUTTON', 'IMG']);
    assert.equal(document.createdTags.includes('DIALOG'), false);
    assert.equal(document.body.children.length, 3);
    assert.equal(fixture.root.parentNode, document.body);
    assert.equal(zoom.overlay.parentNode, document.body);
    assert.equal(stage.parentNode, document.body);
    assert.equal(zoom.overlay.className, 'void-image-zoom-overlay');
    assert.equal(stage.className, 'void-image-zoom-stage');
    assert.equal(stage.getAttribute('role'), 'dialog');
    assert.equal(stage.getAttribute('aria-modal'), 'true');
    assert.equal(stage.getAttribute('aria-label'), '图片放大预览');
    assert.equal(zoom.overlay.hidden, true);
    assert.equal(stage.hidden, true);
    assert.equal(document.documentElement.classList.contains('void-image-zoom-active'), false);
    assert.equal(zoom.previewButton.tagName, 'BUTTON');
    assert.equal(zoom.previewButton.getAttribute('type'), 'button');
    assert.equal(zoom.previewButton.getAttribute('aria-label'), '关闭图片预览');
    assert.equal(zoom.previewButton.contains(zoom.previewImage), true);
    assert.equal(zoom.previewImage.getAttribute('alt'), '');
    assertSinglePassiveListener(window, 'scroll');
    ['wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel']
        .forEach((eventName) => assertSinglePassiveListener(window, eventName));

    const openClick = openZoom(fixture);
    assert.equal(openClick.defaultPrevented, true);
    assert.equal(zoom.isOpen, true);
    assert.equal(zoom.overlay.hidden, false);
    assert.equal(stage.hidden, false);
    assert.equal(document.documentElement.classList.contains('void-image-zoom-active'), true);
    assert.equal(stage.style.left, sourceDocumentRect.left + 'px');
    assert.equal(stage.style.top, sourceDocumentRect.top + 'px');
    assert.equal(stage.style.width, sourceDocumentRect.width + 'px');
    assert.equal(stage.style.height, sourceDocumentRect.height + 'px');
    assert.equal(link.classList.contains('void-image-zoom-source'), true);
    assert.equal(image.classList.contains('void-image-zoom-source'), false);
    assert.equal(zoom.previewImage.getAttribute('src'), '/display.jpg');
    assert.notEqual(zoom.previewImage.getAttribute('src'), link.getAttribute('href'));
    assert.equal(zoom.previewButton.getAttribute('aria-label'), '关闭图片预览：测试图片');
    assert.equal(zoom.previewButton.focusCalls[0].preventScroll, true);
    assert.equal(document.activeElement, zoom.previewButton);
    assert.equal(document.body.classList.contains('void-dialog-open'), false);
    assert.equal(document.body.classList.contains('sidebar-show'), true);

    const emptyAlt = createZoomFixture({ reducedMotion: true });
    emptyAlt.image.setAttribute('alt', '');
    openZoom(emptyAlt);
    assert.equal(emptyAlt.context.VOID_ImageZoom.previewButton.getAttribute('aria-label'), '关闭图片预览');
});

test('image zoom closes through its image button, Escape, blank overlay, and traps Tab', () => {
    for (const closeMode of ['click', 'Enter', 'Space', 'Escape', 'overlay']) {
        const fixture = createZoomFixture({ reducedMotion: true, sidebarOpen: true });
        const { context, document, link } = fixture;
        const zoom = context.VOID_ImageZoom;
        openZoom(fixture);

        const tabEvent = preventableEvent({ key: 'Tab', target: link });
        document.dispatch('keydown', tabEvent);
        assert.equal(tabEvent.defaultPrevented, true);
        assert.equal(document.activeElement, zoom.previewButton);

        if (closeMode === 'click') {
            zoom.previewButton.dispatch('click', { target: zoom.previewImage });
        } else if (closeMode === 'Enter') {
            zoom.previewButton.keyboardActivate('Enter');
        } else if (closeMode === 'Space') {
            zoom.previewButton.keyboardActivate(' ');
        } else if (closeMode === 'Escape') {
            const escapeEvent = preventableEvent({ key: 'Escape', target: zoom.previewButton });
            document.dispatch('keydown', escapeEvent);
            assert.equal(escapeEvent.defaultPrevented, true);
        } else {
            zoom.overlay.dispatch('click', { target: zoom.overlay });
        }

        assert.equal(zoom.isOpen, false);
        assert.equal(zoom.overlay.hidden, true);
        assert.equal(zoom.stage.hidden, true);
        assert.equal(link.classList.contains('void-image-zoom-source'), false);
        assert.equal(document.documentElement.classList.contains('void-image-zoom-active'), false);
        assert.equal(link.focusCalls[0].preventScroll, true);
        assert.equal(document.activeElement, link);
        assert.equal(document.body.classList.contains('sidebar-show'), true);
    }
});

test('image zoom blocks opening input without changing scrollbar ownership', () => {
    const fixture = createZoomFixture({ scrollY: 100, sidebarOpen: true });
    const { context, document, stage, window } = fixture;
    const zoom = context.VOID_ImageZoom;
    openZoom(fixture);

    assert.equal(zoom.inputLocked, true);
    assert.equal(zoom.scrollArmed, false);
    assert.equal(stage.classList.contains('is-preparing'), true);
    assert.equal(document.body.classList.contains('void-dialog-open'), false);
    assert.equal(document.body.classList.contains('sidebar-show'), true);
    assert.deepEqual(
        window.listenerOptionsFor('wheel').map((options) => options && options.passive),
        [true, false]
    );
    assert.deepEqual(
        window.listenerOptionsFor('touchmove').map((options) => options && options.passive),
        [true, false]
    );

    const wheelEvent = preventableEvent({ deltaY: 40, target: stage });
    const touchEvent = preventableEvent({ target: stage, touches: [{ clientY: 40 }] });
    const keyEvent = preventableEvent({ key: 'ArrowDown', target: stage });
    window.dispatch('wheel', wheelEvent);
    window.dispatch('touchmove', touchEvent);
    document.dispatch('keydown', keyEvent);
    assert.equal(wheelEvent.defaultPrevented, true);
    assert.equal(touchEvent.defaultPrevented, true);
    assert.equal(keyEvent.defaultPrevented, true);
    assert.equal(window.scrollY, 100);

    window.flushAnimationFrames();
    stage.dispatch('transitionend', { propertyName: 'opacity', target: stage });
    assert.equal(zoom.inputLocked, true);
    finishZoomOpening(fixture);
    assert.equal(zoom.inputLocked, false);
    assert.equal(zoom.scrollArmed, true);
    assertSinglePassiveListener(window, 'wheel');
    assertSinglePassiveListener(window, 'touchmove');
});

test('image zoom opening uses a 360ms watchdog and cancels a delayed frame', () => {
    const fixture = createZoomFixture({ scrollY: 100 });
    const { context, stage, window } = fixture;
    openZoom(fixture);
    const staleFrames = Array.from(window.animationFrames.values());

    window.advanceTime(359);
    assert.equal(context.VOID_ImageZoom.inputLocked, true);
    assert.equal(context.VOID_ImageZoom.scrollArmed, false);
    window.advanceTime(1);
    assert.equal(context.VOID_ImageZoom.inputLocked, false);
    assert.equal(context.VOID_ImageZoom.scrollArmed, true);
    assert.equal(window.animationFrames.size, 0);
    assert.equal(stage.classList.contains('is-preparing'), false);
    assert.equal(stage.style.transform, context.VOID_ImageZoom.openTransform);
    assert.equal(context.VOID_ImageZoom.overlay.classList.contains('is-visible'), true);

    staleFrames.forEach((callback) => callback(window.now));
    assert.equal(context.VOID_ImageZoom.scrollArmed, true);
    assert.equal(window.pendingTimerCount(), 0);
});

test('image zoom stage follows document scrolling from the first pixel through close inertia', () => {
    const fixture = createZoomFixture({ scrollY: 200, sidebarOpen: true });
    const { context, document, image, link, stage, window } = fixture;
    const zoom = context.VOID_ImageZoom;
    openZoom(fixture);
    finishZoomOpening(fixture);
    const initialTop = stage.getBoundingClientRect().top;

    window.setScrollY(201);
    assert.equal(stage.getBoundingClientRect().top, initialTop - 1);
    window.setScrollY(220);
    assert.equal(stage.getBoundingClientRect().top, initialTop - 20);
    window.setScrollY(239);
    window.advanceTime(150);
    assert.equal(zoom.isOpen, true);
    assert.equal(zoom.isClosing, false);

    window.setScrollY(240);
    assert.equal(zoom.scrollCloseTimer !== null, true);
    const thresholdTop = stage.getBoundingClientRect().top;
    window.advanceTime(100);
    window.setScrollY(250);
    assert.equal(stage.getBoundingClientRect().top, thresholdTop - 10);
    window.advanceTime(49);
    assert.equal(zoom.isClosing, false);
    const sourceRect = image.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const expectedCompensation = zoom.__test.calculateTransform(
        zoom.__test.rectToDocument(sourceRect),
        zoom.__test.rectToDocument(stageRect)
    ).transform;
    const assignmentStart = stage.styleAssignments.length;
    window.advanceTime(1);
    assert.equal(zoom.isOpen, true);
    assert.equal(zoom.isClosing, true);
    const closeTransforms = stage.styleAssignments.slice(assignmentStart)
        .filter((assignment) => assignment.name === 'transform')
        .map((assignment) => assignment.value);
    assert.equal(closeTransforms.length, 2);
    assert.equal(closeTransforms[0], expectedCompensation);
    assert.equal(closeTransforms[1], 'none');
    assert.equal(context.VOID_ImageZoom.overlay.classList.contains('is-closing'), true);
    assert.equal(link.classList.contains('void-image-zoom-source'), true);
    const closingTop = stage.getBoundingClientRect().top;
    window.setScrollY(260);
    assert.equal(stage.getBoundingClientRect().top, closingTop - 10);

    window.advanceTime(299);
    assert.equal(zoom.isOpen, true);
    window.advanceTime(1);
    finishZoomClosing(fixture);
    assert.equal(zoom.isOpen, false);
    assert.equal(window.scrollY, 260);
    assert.equal(link.focusCalls[0].preventScroll, true);
    assert.equal(document.body.classList.contains('sidebar-show'), true);
});

test('image zoom uses 40px net displacement in either direction and after reversals', () => {
    for (const direction of [1, -1]) {
        const fixture = createZoomFixture({ scrollY: 200 });
        const { context, window } = fixture;
        openZoom(fixture);
        finishZoomOpening(fixture);
        window.setScrollY(200 + direction * 39);
        window.advanceTime(150);
        assert.equal(context.VOID_ImageZoom.isClosing, false);
        window.setScrollY(200 + direction * 40);
        window.advanceTime(149);
        assert.equal(context.VOID_ImageZoom.isClosing, false);
        window.advanceTime(1);
        assert.equal(context.VOID_ImageZoom.isClosing, true);
    }

    const fixture = createZoomFixture({ scrollY: 200 });
    openZoom(fixture);
    finishZoomOpening(fixture);
    fixture.window.setScrollY(230);
    fixture.window.setScrollY(180);
    fixture.window.setScrollY(161);
    fixture.window.advanceTime(150);
    assert.equal(fixture.context.VOID_ImageZoom.isClosing, false);
    fixture.window.setScrollY(160);
    fixture.window.advanceTime(150);
    assert.equal(fixture.context.VOID_ImageZoom.isClosing, true);
});

test('image zoom restores focus without losing the new reading position', () => {
    const fixture = createZoomFixture({ reducedMotion: true, scrollY: 200 });
    const originalFocus = fixture.link.focus.bind(fixture.link);
    fixture.link.focus = (options) => {
        originalFocus(options);
        fixture.window.setScrollY(0, false);
    };

    openZoom(fixture);
    fixture.window.setScrollY(240);

    assert.equal(fixture.context.VOID_ImageZoom.isOpen, false);
    assert.equal(fixture.window.scrollY, 240);
    assert.equal(fixture.window.scrollToCalls.length, 1);
    assert.equal(fixture.window.scrollToCalls[0].left, 0);
    assert.equal(fixture.window.scrollToCalls[0].top, 240);
    assert.equal(fixture.window.scrollToCalls[0].behavior, 'auto');
    assert.equal(fixture.link.focusCalls[0].preventScroll, true);
});

test('image zoom uses passive wheel and touch intent at page boundaries', () => {
    const wheelFixture = createZoomFixture({ scrollY: 0 });
    openZoom(wheelFixture);
    finishZoomOpening(wheelFixture);
    const wheelEvent = preventableEvent({ deltaY: -40, target: wheelFixture.stage });
    wheelFixture.window.dispatch('wheel', wheelEvent);
    wheelFixture.window.flushAnimationFrames();
    wheelFixture.window.advanceTime(149);
    assert.equal(wheelFixture.context.VOID_ImageZoom.isClosing, false);
    wheelFixture.window.advanceTime(1);
    assert.equal(wheelEvent.defaultPrevented, false);
    assert.equal(wheelFixture.window.scrollY, 0);
    assert.equal(wheelFixture.context.VOID_ImageZoom.isClosing, true);

    const touchFixture = createZoomFixture({ scrollY: 1000 });
    openZoom(touchFixture);
    finishZoomOpening(touchFixture);
    const firstMove = preventableEvent({ target: touchFixture.stage, touches: [{ clientY: 140 }] });
    touchFixture.window.dispatch('touchstart', {
        target: touchFixture.stage,
        touches: [{ clientY: 100 }]
    });
    touchFixture.window.dispatch('touchmove', firstMove);
    touchFixture.window.dispatch('touchcancel', { target: touchFixture.stage, touches: [] });
    touchFixture.window.flushAnimationFrames();
    touchFixture.window.advanceTime(150);
    assert.equal(touchFixture.context.VOID_ImageZoom.isClosing, false);

    touchFixture.window.dispatch('touchstart', {
        target: touchFixture.stage,
        touches: [{ clientY: 100 }]
    });
    const thresholdMove = preventableEvent({
        target: touchFixture.stage,
        touches: [{ clientY: 60 }]
    });
    touchFixture.window.dispatch('touchmove', thresholdMove);
    touchFixture.window.dispatch('touchend', { target: touchFixture.stage, touches: [] });
    touchFixture.window.flushAnimationFrames();
    touchFixture.window.advanceTime(150);
    assert.equal(firstMove.defaultPrevented, false);
    assert.equal(thresholdMove.defaultPrevented, false);
    assert.equal(touchFixture.window.scrollY, 1000);
    assert.equal(touchFixture.context.VOID_ImageZoom.isClosing, true);
});

test('image zoom combines partial real scroll with only the unconsumed input intent', () => {
    const fixture = createZoomFixture({ scrollY: 980 });
    openZoom(fixture);
    finishZoomOpening(fixture);

    const wheelEvent = preventableEvent({ deltaY: 40, target: fixture.stage });
    fixture.window.dispatch('wheel', wheelEvent);
    fixture.window.setScrollY(1000);
    assert.equal(fixture.context.VOID_ImageZoom.isClosing, false);
    fixture.window.flushAnimationFrames();
    fixture.window.advanceTime(150);

    assert.equal(wheelEvent.defaultPrevented, false);
    assert.equal(fixture.window.scrollY, 1000);
    assert.equal(fixture.context.VOID_ImageZoom.isClosing, true);
});

test('image zoom ignores touchcancel, ctrl-wheel, and multi-touch gestures', () => {
    const fixture = createZoomFixture({ scrollY: 100 });
    openZoom(fixture);
    finishZoomOpening(fixture);

    fixture.window.dispatch('touchstart', {
        target: fixture.stage,
        touches: [{ clientY: 100 }]
    });
    fixture.window.dispatch('touchmove', {
        target: fixture.stage,
        touches: [{ clientY: 50 }]
    });
    fixture.window.dispatch('touchcancel', { target: fixture.stage, touches: [] });
    fixture.window.flushAnimationFrames();
    fixture.window.dispatch('wheel', preventableEvent({
        ctrlKey: true,
        deltaY: 100,
        target: fixture.stage
    }));
    fixture.window.dispatch('touchstart', {
        target: fixture.stage,
        touches: [{ clientY: 100 }, { clientY: 120 }]
    });
    fixture.window.dispatch('touchmove', {
        target: fixture.stage,
        touches: [{ clientY: 20 }, { clientY: 200 }]
    });
    fixture.window.flushAnimationFrames();
    fixture.window.advanceTime(300);
    assert.equal(fixture.context.VOID_ImageZoom.isOpen, true);
    assert.equal(fixture.context.VOID_ImageZoom.isClosing, false);
});

test('image zoom ignores height-only resize and closes on width or orientation changes', () => {
    const heightFixture = createZoomFixture({ reducedMotion: true, scrollY: 100 });
    openZoom(heightFixture);
    heightFixture.window.innerHeight = 700;
    heightFixture.window.dispatch('resize', { target: heightFixture.window });
    assert.equal(heightFixture.context.VOID_ImageZoom.isOpen, true);

    heightFixture.window.innerWidth = 900;
    heightFixture.window.dispatch('resize', { target: heightFixture.window });
    assert.equal(heightFixture.context.VOID_ImageZoom.isOpen, false);

    const orientationFixture = createZoomFixture({ reducedMotion: true, scrollY: 100 });
    openZoom(orientationFixture);
    orientationFixture.window.dispatch('orientationchange', { target: orientationFixture.window });
    assert.equal(orientationFixture.context.VOID_ImageZoom.isOpen, false);
});

test('image zoom keeps overlay and stage alive for the synchronized 300ms close', () => {
    const fixture = createZoomFixture({ scrollY: 200, sidebarOpen: true });
    const { context, document, link, stage, window } = fixture;
    const zoom = context.VOID_ImageZoom;
    openZoom(fixture);
    finishZoomOpening(fixture);

    zoom.previewButton.dispatch('click', { target: zoom.previewImage });
    const transitionTimer = zoom.transitionTimer;
    assert.equal(zoom.isOpen, true);
    assert.equal(zoom.isClosing, true);
    assert.equal(zoom.overlay.hidden, false);
    assert.equal(stage.hidden, false);
    assert.equal(zoom.overlay.classList.contains('is-visible'), false);
    assert.equal(zoom.overlay.classList.contains('is-closing'), true);
    assert.equal(stage.classList.contains('is-closing'), true);
    assert.equal(stage.style.opacity, '1');
    assert.equal(link.classList.contains('void-image-zoom-source'), true);

    zoom.previewButton.dispatch('click', { target: zoom.previewImage });
    document.dispatch('keydown', preventableEvent({ key: 'Escape', target: stage }));
    window.dispatch('wheel', preventableEvent({ deltaY: 80, target: stage }));
    assert.equal(zoom.transitionTimer, transitionTimer);
    window.advanceTime(299);
    assert.equal(zoom.isOpen, true);
    window.advanceTime(1);
    finishZoomClosing(fixture);
    assert.equal(zoom.isOpen, false);
    assert.equal(zoom.overlay.hidden, true);
    assert.equal(stage.hidden, true);
    assert.equal(link.classList.contains('void-image-zoom-source'), false);
    assert.equal(document.body.classList.contains('sidebar-show'), true);
});

test('image zoom ignores a queued opening transitionend after close starts', () => {
    const fixture = createZoomFixture({ scrollY: 200 });
    openZoom(fixture);
    fixture.window.flushAnimationFrames();
    fixture.context.VOID_ImageZoom.previewButton.dispatch('click', {
        target: fixture.context.VOID_ImageZoom.previewImage
    });
    assert.equal(fixture.context.VOID_ImageZoom.isClosing, true);
    assert.equal(fixture.context.VOID_ImageZoom.transitionReady, false);

    fixture.stage.dispatch('transitionend', {
        propertyName: 'transform',
        target: fixture.stage
    });
    assert.equal(fixture.context.VOID_ImageZoom.isOpen, true);
    assert.equal(fixture.context.VOID_ImageZoom.isClosing, true);

    fixture.window.flushAnimationFrames();
    assert.equal(fixture.context.VOID_ImageZoom.transitionReady, true);
    fixture.window.advanceTime(300);
    finishZoomClosing(fixture);
    assert.equal(fixture.context.VOID_ImageZoom.isOpen, false);
});

test('image zoom close watchdog finishes after 360ms without transitionend', () => {
    const fixture = createZoomFixture({ scrollY: 200 });
    openZoom(fixture);
    finishZoomOpening(fixture);
    fixture.context.VOID_ImageZoom.previewButton.dispatch('click', {
        target: fixture.context.VOID_ImageZoom.previewImage
    });

    fixture.window.advanceTime(359);
    assert.equal(fixture.context.VOID_ImageZoom.isOpen, true);
    fixture.window.advanceTime(1);
    assert.equal(fixture.context.VOID_ImageZoom.isOpen, false);
    assert.equal(fixture.context.VOID_ImageZoom.overlay.hidden, true);
    assert.equal(fixture.stage.hidden, true);
});

test('image zoom styles define an opaque fixed overlay and absolute 300ms stage', () => {
    const styles = fs.readFileSync(
        path.resolve(__dirname, '../../assets/parts/_image-experience.scss'),
        'utf8'
    );
    assert.doesNotMatch(styles, /dialog\.void-image-zoom/);
    assert.match(styles, /html\.void-image-zoom-active\s*\{[\s\S]*overflow-x: clip;/);
    assert.match(styles, /\.void-image-zoom-overlay\s*\{[\s\S]*position: fixed;[\s\S]*z-index: 4000;/);
    assert.match(styles, /\.void-image-zoom-overlay\s*\{[\s\S]*background: \$bgColor;/);
    assert.match(styles, /\.theme-dark &[\s\S]*background: \$td-bgColor;/);
    assert.match(styles, /\.void-image-zoom-stage\s*\{[\s\S]*position: absolute;[\s\S]*z-index: 4001;/);
    assert.match(styles, /transition: opacity 300ms \$animationTimingFunc;/);
    assert.match(styles, /transition: transform 300ms \$animationTimingFunc, opacity 300ms \$animationTimingFunc;/);
    assert.match(styles, /&\.is-preparing\s*\{\s*transition: none;/);
    assert.match(styles, /\.void-image-zoom-source\s*\{\s*visibility: hidden;/);
});

test('image zoom destroy cancels a pending opening frame and fallback', () => {
    const fixture = createZoomFixture({ scrollY: 200, sidebarOpen: true });
    const { context, document, link, window } = fixture;
    openZoom(fixture);
    const staleFrames = Array.from(window.animationFrames.values());
    const staleTimers = Array.from(window.timers.values()).map((timer) => timer.callback);

    assert.equal(staleFrames.length, 1);
    assert.equal(window.pendingTimerCount(), 1);
    assert.equal(context.VOID_ImageZoom.inputLocked, true);

    context.VOID_ImageZoom.destroy();
    context.VOID_ImageZoom.destroy();
    assert.equal(window.animationFrames.size, 0);
    assert.equal(window.pendingTimerCount(), 0);
    assert.equal(document.body.classList.contains('void-dialog-open'), false);
    assert.equal(document.body.classList.contains('sidebar-show'), true);
    assert.equal(link.classList.contains('void-image-zoom-source'), false);
    assert.equal(link.focusCount, 0);
    assert.equal(document.body.children.length, 1);
    assert.equal(fixture.root.parentNode, document.body);
    assert.equal(document.documentElement.classList.contains('void-image-zoom-active'), false);

    staleFrames.forEach((callback) => callback(window.now));
    staleTimers.forEach((callback) => callback());
    window.advanceTime(500);
    assert.equal(document.body.classList.contains('void-dialog-open'), false);
    assert.equal(document.body.classList.contains('sidebar-show'), true);
    assert.equal(link.focusCount, 0);
});

test('image zoom destroy cancels asynchronous work and removes every listener idempotently', () => {
    for (const phase of ['scroll-delay', 'closing']) {
        const fixture = createZoomFixture({ scrollY: 200, sidebarOpen: true });
        const { context, document, link, stage, window } = fixture;
        const overlay = context.VOID_ImageZoom.overlay;
        const previewButton = context.VOID_ImageZoom.previewButton;
        const previewImage = context.VOID_ImageZoom.previewImage;
        openZoom(fixture);
        finishZoomOpening(fixture);
        if (phase === 'scroll-delay') {
            window.setScrollY(240);
        } else {
            context.VOID_ImageZoom.previewButton.dispatch('click', {
                target: context.VOID_ImageZoom.previewImage
            });
        }
        const staleTimers = Array.from(window.timers.values()).map((timer) => timer.callback);

        context.VOID_ImageZoom.destroy();
        context.VOID_ImageZoom.destroy();
        assert.equal(document.listenerCount('click'), 0);
        assert.equal(document.listenerCount('keydown'), 0);
        ['scroll', 'wheel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'resize',
            'orientationchange'].forEach((eventName) => assert.equal(window.listenerCount(eventName), 0));
        assert.equal(overlay.listenerCount('click'), 0);
        assert.equal(stage.listenerCount('transitionend'), 0);
        assert.equal(previewButton.listenerCount('click'), 0);
        assert.equal(previewImage.listenerCount('error'), 0);
        assert.equal(window.animationFrames.size, 0);
        assert.equal(window.pendingTimerCount(), 0);
        assert.equal(document.body.children.length, 1);
        assert.equal(fixture.root.parentNode, document.body);
        assert.equal(document.body.classList.contains('sidebar-show'), true);
        assert.equal(document.body.classList.contains('void-dialog-open'), false);
        assert.equal(document.documentElement.classList.contains('void-image-zoom-active'), false);
        assert.equal(link.classList.contains('void-image-zoom-source'), false);
        assert.equal(link.focusCount, 0);

        assert.doesNotThrow(() => {
            staleTimers.forEach((callback) => callback());
            stage.dispatch('transitionend', { propertyName: 'transform', target: stage });
            window.advanceTime(500);
            window.flushAnimationFrames();
        });
        assert.equal(document.body.classList.contains('sidebar-show'), true);
        assert.equal(link.focusCount, 0);
    }
});

test('image zoom preserves browser behavior for modified, middle, download, blank, and failed images', () => {
    const { context } = loadVoid();
    const root = new FakeElement('main');
    const { image, link } = createSource(root);
    context.VOID_ImageZoom.root = root;

    assert.equal(context.VOID_ImageZoom.canActivate(link, preventableEvent({ ctrlKey: true })), false);
    assert.equal(context.VOID_ImageZoom.canActivate(link, preventableEvent({ metaKey: true })), false);
    assert.equal(context.VOID_ImageZoom.canActivate(link, preventableEvent({ shiftKey: true })), false);
    assert.equal(context.VOID_ImageZoom.canActivate(link, preventableEvent({ altKey: true })), false);
    assert.equal(context.VOID_ImageZoom.canActivate(link, preventableEvent({ button: 1 })), false);
    link.setAttribute('download', '');
    assert.equal(context.VOID_ImageZoom.canActivate(link, preventableEvent()), false);
    link.removeAttribute('download');
    link.setAttribute('target', '_blank');
    assert.equal(context.VOID_ImageZoom.canActivate(link, preventableEvent()), false);
    link.removeAttribute('target');
    image.complete = false;
    image.naturalWidth = 0;
    assert.equal(context.VOID_ImageZoom.canActivate(link, preventableEvent()), false);
});

test('image zoom rolls back setup failures and preserves the real link fallback', () => {
    const invalidGeometry = createZoomFixture({ reducedMotion: true });
    invalidGeometry.sourceDocumentRect.width = 0;
    const geometryClick = openZoom(invalidGeometry);
    assert.equal(geometryClick.defaultPrevented, false);
    assert.equal(invalidGeometry.context.VOID_ImageZoom.isOpen, false);

    const missingResource = createZoomFixture({ reducedMotion: true });
    missingResource.image.currentSrc = '';
    missingResource.image.removeAttribute('src');
    const missingClick = openZoom(missingResource);
    assert.equal(missingClick.defaultPrevented, false);
    assert.equal(missingResource.context.VOID_ImageZoom.isOpen, false);

    const failingSetup = createZoomFixture({ reducedMotion: true, sidebarOpen: true });
    const originalSetAttribute = failingSetup.context.VOID_ImageZoom.previewImage.setAttribute.bind(
        failingSetup.context.VOID_ImageZoom.previewImage
    );
    failingSetup.context.VOID_ImageZoom.previewImage.setAttribute = (name, value) => {
        if (name === 'src') {
            throw new Error('preview setup failed');
        }
        originalSetAttribute(name, value);
    };
    const failingClick = openZoom(failingSetup);
    assert.equal(failingClick.defaultPrevented, false);
    assert.equal(failingSetup.context.VOID_ImageZoom.isOpen, false);
    assert.equal(failingSetup.context.VOID_ImageZoom.overlay.hidden, true);
    assert.equal(failingSetup.stage.hidden, true);
    assert.equal(failingSetup.link.classList.contains('void-image-zoom-source'), false);
    assert.equal(failingSetup.document.body.classList.contains('sidebar-show'), true);

    const failingLate = createZoomFixture({ sidebarOpen: true });
    failingLate.stage.rectProvider = () => {
        throw new Error('layout failed after side effects');
    };
    const lateClick = openZoom(failingLate);
    assert.equal(lateClick.defaultPrevented, false);
    assert.equal(failingLate.context.VOID_ImageZoom.isOpen, false);
    assert.equal(failingLate.context.VOID_ImageZoom.inputLocked, false);
    assertSinglePassiveListener(failingLate.window, 'wheel');
    assertSinglePassiveListener(failingLate.window, 'touchmove');
    assert.equal(failingLate.link.classList.contains('void-image-zoom-source'), false);
    assert.equal(failingLate.document.documentElement.classList.contains('void-image-zoom-active'), false);
    assert.equal(failingLate.document.body.children.length, 3);
    assert.equal(failingLate.document.body.classList.contains('sidebar-show'), true);
});

test('image zoom preview errors restore and activate the real link exactly once', () => {
    const fixture = createZoomFixture({ reducedMotion: true, sidebarOpen: true });
    let fallbackClick = null;
    let fallbackCount = 0;
    fixture.link.click = () => {
        fallbackCount += 1;
        fallbackClick = preventableEvent({ target: fixture.link });
        fixture.document.dispatch('click', fallbackClick);
    };

    const openClick = openZoom(fixture);
    assert.equal(openClick.defaultPrevented, true);
    fixture.context.VOID_ImageZoom.previewImage.dispatch('error', {
        target: fixture.context.VOID_ImageZoom.previewImage
    });

    assert.equal(fallbackCount, 1);
    assert.equal(fallbackClick.defaultPrevented, false);
    assert.equal(fixture.context.VOID_ImageZoom.isOpen, false);
    assert.equal(fixture.context.VOID_ImageZoom.fallbackLink, null);
    assert.equal(fixture.link.classList.contains('void-image-zoom-source'), false);
    assert.equal(fixture.link.focusCount, 0);
    assert.equal(fixture.context.VOID_ImageZoom.overlay.hidden, true);
    assert.equal(fixture.stage.hidden, true);
    assert.equal(fixture.document.documentElement.classList.contains('void-image-zoom-active'), false);
    assert.equal(fixture.document.body.classList.contains('sidebar-show'), true);

    const detached = createZoomFixture({ reducedMotion: true });
    let detachedFallbackCount = 0;
    detached.link.click = () => {
        detachedFallbackCount += 1;
    };
    openZoom(detached);
    detached.root.removeChild(detached.link);
    detached.context.VOID_ImageZoom.previewImage.dispatch('error', {
        target: detached.context.VOID_ImageZoom.previewImage
    });
    assert.equal(detached.context.VOID_ImageZoom.isOpen, false);
    assert.equal(detachedFallbackCount, 0);
    assert.equal(detached.context.VOID_ImageZoom.overlay.hidden, true);
});

test('image zoom fades instead of shrinking toward a detached source', () => {
    const fixture = createZoomFixture({ scrollY: 200 });
    openZoom(fixture);
    finishZoomOpening(fixture);
    fixture.root.removeChild(fixture.link);
    fixture.context.VOID_ImageZoom.previewButton.dispatch('click', {
        target: fixture.context.VOID_ImageZoom.previewImage
    });

    assert.equal(fixture.context.VOID_ImageZoom.isClosing, true);
    assert.equal(fixture.context.VOID_ImageZoom.transitionProperty, 'opacity');
    assert.equal(fixture.stage.style.opacity, '0');
    assert.equal(fixture.context.VOID_ImageZoom.overlay.classList.contains('is-closing'), true);
    finishZoomClosing(fixture, 'opacity');
    assert.equal(fixture.context.VOID_ImageZoom.isOpen, false);
});

test('image zoom reduced motion opens and closes synchronously at the threshold', () => {
    const fixture = createZoomFixture({ reducedMotion: true, scrollY: 200 });
    openZoom(fixture);
    assert.equal(fixture.context.VOID_ImageZoom.scrollArmed, true);
    assert.equal(fixture.context.VOID_ImageZoom.inputLocked, false);
    assert.equal(fixture.window.animationFrames.size, 0);
    assert.equal(fixture.window.pendingTimerCount(), 0);
    fixture.window.setScrollY(239);
    assert.equal(fixture.context.VOID_ImageZoom.isOpen, true);
    fixture.window.setScrollY(240);
    assert.equal(fixture.context.VOID_ImageZoom.isOpen, false);
    assert.equal(fixture.window.pendingTimerCount(), 0);
    assert.equal(fixture.window.scrollY, 240);
});

test('zoom geometry fits without upscaling and maps source to target centers', () => {
    const { context } = loadVoid();
    const fit = context.VOID_ImageZoom.__test.calculateFit(1600, 900, 1000, 700, 20);
    assert.equal(fit.width, 960);
    assert.equal(fit.height, 540);
    assert.equal(fit.left, 20);
    assert.equal(fit.top, 80);

    const transition = context.VOID_ImageZoom.__test.calculateTransform(
        { left: 10, top: 20, width: 200, height: 100 },
        { left: 100, top: 100, width: 800, height: 400 }
    );
    assert.equal(transition.scaleX, 4);
    assert.equal(transition.scaleY, 4);
    assert.equal(transition.translateX, 390);
    assert.equal(transition.translateY, 230);

    context.window.scrollX = 7;
    context.window.pageXOffset = 7;
    context.window.setScrollY(11, false);
    const documentRect = context.VOID_ImageZoom.__test.rectToDocument({
        left: 3,
        top: 5,
        width: 20,
        height: 10
    });
    assert.equal(documentRect.left, 10);
    assert.equal(documentRect.top, 16);
    assert.equal(documentRect.width, 20);
    assert.equal(documentRect.height, 10);
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

test('legacy viewer assets and replacement viewer dependencies are absent', () => {
    const repositoryRoot = path.resolve(__dirname, '../..');
    const runtimeSource = fs.readFileSync(path.join(repositoryRoot, 'assets/VOID.js'), 'utf8');
    const packageSource = fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8');
    const gulpSource = fs.readFileSync(path.join(repositoryRoot, 'gulpfile.js'), 'utf8');

    assert.equal(fs.existsSync(path.join(repositoryRoot, 'assets/libs/fancybox')), false);
    assert.doesNotMatch(runtimeSource, /configureFancybox|data-fancybox|jQuery\.fancybox/);
    assert.doesNotMatch(packageSource, /photoswipe|zoom\.js|fancybox/i);
    assert.doesNotMatch(gulpSource, /photoswipe|zoom\.js|fancybox/i);
});

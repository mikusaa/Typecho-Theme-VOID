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
        this.listeners = new Map();
        this.offsetLeft = 0;
        this.offsetWidth = 100;
        this.open = false;
        this.parentNode = null;
        this.rect = { left: 0, top: 0, width: 100, height: 100 };
        this.releasePointerCaptureCalls = [];
        this.scrollLeft = 0;
        this.scrollToCalls = [];
        this.setPointerCaptureCalls = [];
        this.styleValues = new Map();
        this.style = {
            setProperty: (name, value) => this.styleValues.set(name, String(value))
        };
        this.tagName = tagName.toUpperCase();
    }

    addEventListener(name, listener) {
        const listeners = this.listeners.get(name) || [];
        listeners.push(listener);
        this.listeners.set(name, listeners);
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        child.parentNode = this;
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

    focus() {
        this.focusCount += 1;
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    getBoundingClientRect() {
        return {
            ...this.rect,
            right: this.rect.left + this.rect.width,
            bottom: this.rect.top + this.rect.height
        };
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    listenerCount(name) {
        return (this.listeners.get(name) || []).length;
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
        child.parentNode = null;
        return child;
    }

    removeEventListener(name, listener) {
        const listeners = this.listeners.get(name) || [];
        this.listeners.set(name, listeners.filter((candidate) => candidate !== listener));
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
        this.body = new FakeElement('body');
        this.body.parentNode = this;
        this.dialogMode = dialogMode;
        this.root = null;
    }

    createElement(tagName) {
        const element = new FakeElement(tagName);
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
        this.document = document;
        this.reducedMotion = reducedMotion;
        this.window = this;
    }

    cancelAnimationFrame() {}

    clearInterval() {}

    clearTimeout(id) {
        clearTimeout(id);
    }

    matchMedia() {
        return { matches: this.reducedMotion };
    }

    requestAnimationFrame() {
        return 1;
    }

    setInterval() {
        return 1;
    }

    setTimeout(callback, delay) {
        return setTimeout(callback, delay);
    }
}

function loadVoid(options = {}) {
    const document = new FakeDocument(options.dialogMode || 'supported');
    const window = new FakeWindow(document, options.reducedMotion || false);
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
        Date,
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
    image.complete = true;
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
    trigger.setAttribute('data-void-reward-link', '');
    trigger.setAttribute('href', '/reward.png');
    trigger.setAttribute('target', '_blank');
    dialog.setAttribute('data-void-reward-dialog', '');
    closeButton.setAttribute('data-void-reward-close', '');
    content.appendChild(closeButton);
    dialog.appendChild(content);
    root.appendChild(trigger);
    root.appendChild(dialog);
    return { closeButton, dialog, trigger };
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
    const { context } = loadVoid();
    const root = new FakeElement('main');
    const set = new FakeElement('div');
    const link = new FakeElement('a');
    set.setAttribute('data-void-photo-layout', 'strip');
    link.setAttribute('data-void-image-zoom', '');
    set.appendChild(link);
    root.appendChild(set);
    root.querySelectorAll = (selector) => selector === '[data-void-photo-set]' ? [set] : [];

    context.VOID_PhotoSets.init(root);
    context.VOID_PhotoSets.init(root);
    assert.equal(set.listenerCount('pointerdown'), 1);
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

    assert.match(styles, /gap: 8px;/);
    assert.match(styles, /flex: var\(--void-image-ratio, 1\.3333\) 1 0;/);
    assert.match(styles, /min-width: 0;/);
    assert.match(styles, /overflow-x: auto;/);
    assert.match(styles, /scroll-snap-type: x proximity;/);
    assert.match(styles, /width: fit-content;/);
    assert.match(styles, /width: 0;\s+min-width: 100%;\s+max-width: none;/);
    assert.doesNotMatch(styles, /width: max-content;/);
    assert.match(styles, /--void-photo-row-height: 480px;/);
    assert.match(styles, /--void-photo-row-height: 400px;/);
    assert.match(styles, /--void-photo-row-height: 260px;/);
    assert.match(
        fs.readFileSync(path.resolve(__dirname, '../../assets/parts/_image-experience.scss'), 'utf8'),
        /\.void-image-link\[data-void-image-zoom\][\s\S]*&:focus-visible[\s\S]*outline: 2px solid \$highlightColor;/
    );
    assert.doesNotMatch(script, /addEventListener\(['"](?:wheel|mousewheel)/);
});

test('image zoom opens only after showModal succeeds and restores focus on close', () => {
    const { context, document } = loadVoid({ reducedMotion: true });
    const root = new FakeElement('main');
    const { image, link } = createSource(root);
    document.root = root;

    context.VOID_ImageZoom.init(root);
    context.VOID_ImageZoom.init(root);
    assert.equal(document.listenerCount('click'), 1);
    assert.equal(document.body.children.length, 1);

    let animateCount = 0;
    context.VOID_ImageZoom.previewImage.animate = () => {
        animateCount += 1;
        return { cancel() {} };
    };
    const openClick = preventableEvent({ target: image });
    document.dispatch('click', openClick);
    assert.equal(openClick.defaultPrevented, true);
    assert.equal(context.VOID_ImageZoom.dialog.open, true);
    assert.equal(document.body.classList.contains('void-dialog-open'), true);
    assert.equal(context.VOID_ImageZoom.previewImage.getAttribute('src'), '/original.jpg');
    assert.equal(context.VOID_ImageZoom.closeButton.focusCount, 1);
    assert.equal(animateCount, 0);

    context.VOID_ImageZoom.dialog.dispatch('click', { target: context.VOID_ImageZoom.previewImage });
    assert.equal(context.VOID_ImageZoom.dialog.open, false);
    assert.equal(document.body.classList.contains('void-dialog-open'), false);
    assert.equal(link.focusCount, 1);
    assert.equal(image.classList.contains('void-image-zoom-source'), false);

    const reopenClick = preventableEvent({ target: image });
    document.dispatch('click', reopenClick);
    const cancelEvent = preventableEvent({ target: context.VOID_ImageZoom.dialog });
    context.VOID_ImageZoom.dialog.dispatch('cancel', cancelEvent);
    assert.equal(cancelEvent.defaultPrevented, true);
    assert.equal(link.focusCount, 2);

    document.dispatch('click', preventableEvent({ target: image }));
    context.VOID_ImageZoom.destroy();
    context.VOID_ImageZoom.destroy();
    assert.equal(document.body.classList.contains('void-dialog-open'), false);
    assert.equal(document.body.children.length, 0);
    assert.equal(link.focusCount, 2);
});

test('image zoom preserves browser behavior for modified, middle, download, blank, and failed images', () => {
    const { context } = loadVoid();
    const root = new FakeElement('main');
    const { image, link } = createSource(root);
    context.VOID_ImageZoom.root = root;

    assert.equal(context.VOID_ImageZoom.canActivate(link, preventableEvent({ ctrlKey: true })), false);
    assert.equal(context.VOID_ImageZoom.canActivate(link, preventableEvent({ metaKey: true })), false);
    assert.equal(context.VOID_ImageZoom.canActivate(link, preventableEvent({ shiftKey: true })), false);
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

test('unsupported or failing dialog leaves the real image link untouched', () => {
    for (const dialogMode of ['unsupported', 'throw']) {
        const { context, document } = loadVoid({ dialogMode, reducedMotion: true });
        const root = new FakeElement('main');
        const { image } = createSource(root);
        document.root = root;
        context.VOID_ImageZoom.init(root);

        const click = preventableEvent({ target: image });
        document.dispatch('click', click);
        assert.equal(click.defaultPrevented, false);
        assert.equal(document.body.classList.contains('void-dialog-open'), false);
    }
});

test('zoom geometry fits without upscaling and maps source to target centers', () => {
    const { context } = loadVoid();
    const fit = context.VOID_ImageZoom.__test.calculateFit(1600, 900, 1000, 700, 20);
    assert.equal(fit.width, 960);
    assert.equal(fit.height, 540);
    assert.equal(fit.left, 20);
    assert.equal(fit.top, 80);

    const transition = context.VOID_ImageZoom.__test.calculateTransition(
        { left: 10, top: 20, width: 200, height: 100 },
        { left: 100, top: 100, width: 800, height: 400 }
    );
    assert.equal(transition.scaleX, 0.25);
    assert.equal(transition.scaleY, 0.25);
    assert.equal(transition.translateX, -390);
    assert.equal(transition.translateY, -230);
});

test('reward dialog opens idempotently, closes by every control, and restores focus', () => {
    const { context, document } = loadVoid();
    const root = new FakeElement('main');
    const { closeButton, dialog, trigger } = createRewardSource(root, document);
    document.root = root;

    context.VOID_RewardDialog.init(root);
    context.VOID_RewardDialog.init(root);
    assert.equal(trigger.listenerCount('click'), 1);

    const modifiedClick = preventableEvent({ ctrlKey: true, target: trigger });
    trigger.dispatch('click', modifiedClick);
    assert.equal(modifiedClick.defaultPrevented, false);
    assert.equal(dialog.open, false);

    const openClick = preventableEvent({ target: trigger });
    trigger.dispatch('click', openClick);
    assert.equal(openClick.defaultPrevented, true);
    assert.equal(dialog.open, true);
    assert.equal(closeButton.focusCount, 1);
    assert.equal(document.body.classList.contains('void-dialog-open'), true);

    closeButton.dispatch('click', { target: closeButton });
    assert.equal(dialog.open, false);
    assert.equal(trigger.focusCount, 1);
    assert.equal(document.body.classList.contains('void-dialog-open'), false);

    trigger.dispatch('click', preventableEvent({ target: trigger }));
    dialog.dispatch('click', { target: dialog });
    assert.equal(trigger.focusCount, 2);

    trigger.dispatch('click', preventableEvent({ target: trigger }));
    const cancelEvent = preventableEvent({ target: dialog });
    dialog.dispatch('cancel', cancelEvent);
    assert.equal(cancelEvent.defaultPrevented, true);
    assert.equal(trigger.focusCount, 3);
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

test('reward dialog has independent scroll ownership and PJAX-safe teardown', () => {
    const { context, document } = loadVoid();
    const root = new FakeElement('main');
    const { trigger } = createRewardSource(root, document);
    document.root = root;
    context.VOID_RewardDialog.init(root);

    context.VOID_DialogScrollLock.lock('image-zoom');
    trigger.dispatch('click', preventableEvent({ target: trigger }));
    context.VOID_RewardDialog.destroy();
    context.VOID_RewardDialog.destroy();
    assert.equal(trigger.focusCount, 0);
    assert.equal(trigger.listenerCount('click'), 0);
    assert.equal(document.body.classList.contains('void-dialog-open'), true);

    context.VOID_DialogScrollLock.unlock('image-zoom');
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

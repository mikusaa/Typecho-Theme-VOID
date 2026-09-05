const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { readVoidModule, readVoidSource } = require('./helpers/void-source.cjs');

class FakeClassList {
    constructor() {
        this.names = new Set();
    }

    add(...names) {
        names.forEach((name) => this.names.add(name));
    }

    contains(name) {
        return this.names.has(name);
    }

    remove(...names) {
        names.forEach((name) => this.names.delete(name));
    }

    toggle(name, force) {
        const shouldAdd = force === undefined ? !this.contains(name) : !!force;
        if (shouldAdd) {
            this.add(name);
        } else {
            this.remove(name);
        }
        return shouldAdd;
    }
}

class FakeElement {
    constructor(tagName = 'div', ownerDocument = null) {
        this.attributes = new Map();
        this.children = [];
        this.classList = new FakeClassList();
        this.className = '';
        this.clientWidth = 1000;
        this.focusCalls = [];
        this.listeners = new Map();
        this.nodeType = 1;
        this.nodeValue = null;
        this.ownerDocument = ownerDocument;
        this.parentNode = null;
        this.styleValues = new Map();
        this.tagName = tagName.toUpperCase();
        this.textContent = '';
        this.style = {
            getPropertyValue: (name) => this.styleValues.get(name) || '',
            setProperty: (name, value) => this.styleValues.set(name, String(value))
        };
    }

    get childNodes() {
        return this.children;
    }

    get firstChild() {
        return this.children[0] || null;
    }

    get hidden() {
        return this.hasAttribute('hidden');
    }

    set hidden(value) {
        if (value) {
            this.setAttribute('hidden', '');
        } else {
            this.removeAttribute('hidden');
        }
    }

    get nextSibling() {
        if (!this.parentNode) {
            return null;
        }
        const index = this.parentNode.children.indexOf(this);
        return this.parentNode.children[index + 1] || null;
    }

    get previousSibling() {
        if (!this.parentNode) {
            return null;
        }
        const index = this.parentNode.children.indexOf(this);
        return index > 0 ? this.parentNode.children[index - 1] : null;
    }

    addEventListener(name, listener, options) {
        const listeners = this.listeners.get(name) || [];
        listeners.push({ listener, options });
        this.listeners.set(name, listeners);
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        child.parentNode = this;
        child.ownerDocument = this.ownerDocument;
        this.children.push(child);
        return child;
    }

    contains(candidate) {
        return candidate === this || this.children.some((child) => child.contains(candidate));
    }

    dispatch(name, event = {}) {
        const dispatchedEvent = Object.assign({
            currentTarget: this,
            preventDefault() {},
            target: this
        }, event);
        (this.listeners.get(name) || []).slice().forEach(({ listener }) => listener.call(this, dispatchedEvent));
    }

    click() {
        this.dispatch('click');
    }

    focus(options) {
        this.focusCalls.push(options);
        if (this.ownerDocument) {
            this.ownerDocument.activeElement = this;
        }
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    insertBefore(child, reference) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        const index = this.children.indexOf(reference);
        child.parentNode = this;
        child.ownerDocument = this.ownerDocument;
        this.children.splice(index < 0 ? this.children.length : index, 0, child);
        return child;
    }

    listenerCount(name) {
        return (this.listeners.get(name) || []).length;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        const matches = (element) => {
            const classNames = new Set([
                ...String(element.className || '').split(/\s+/).filter(Boolean),
                ...element.classList.names
            ]);
            if (selector === '.void-gallery-row') {
                return classNames.has('void-gallery-row');
            }
            if (selector === '.void-gallery-more') {
                return classNames.has('void-gallery-more');
            }
            if (selector === '[data-void-gallery-set]') {
                return element.hasAttribute('data-void-gallery-set');
            }
            if (selector === '[data-void-gallery-more]') {
                return element.hasAttribute('data-void-gallery-more');
            }
            if (selector === '[data-void-gallery-more-count]') {
                return element.hasAttribute('data-void-gallery-more-count');
            }
            if (selector === '[hidden]') {
                return element.hasAttribute('hidden');
            }
            if (selector === 'button[data-void-gallery-more]') {
                return element.tagName === 'BUTTON' && element.hasAttribute('data-void-gallery-more');
            }
            if (selector === '[data-void-photo-set]') {
                return element.hasAttribute('data-void-photo-set');
            }
            if (selector === 'figure[data-void-image-item]') {
                return element.tagName === 'FIGURE' && element.hasAttribute('data-void-image-item');
            }
            if (selector === 'img[data-void-image-content]') {
                return element.tagName === 'IMG' && element.hasAttribute('data-void-image-content');
            }
            if (selector === 'a[data-void-image-zoom]') {
                return element.tagName === 'A' && element.hasAttribute('data-void-image-zoom');
            }
            return false;
        };
        const results = [];
        const visit = (element) => {
            element.children.forEach((child) => {
                if (matches(child)) {
                    results.push(child);
                }
                visit(child);
            });
        };
        visit(this);
        return results;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index >= 0) {
            this.children.splice(index, 1);
        }
        if (this.ownerDocument && child.contains(this.ownerDocument.activeElement)) {
            this.ownerDocument.activeElement = this.ownerDocument.body;
        }
        child.parentNode = null;
        return child;
    }

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
    }

    removeEventListener(name, listener) {
        const listeners = this.listeners.get(name) || [];
        this.listeners.set(name, listeners.filter((record) => record.listener !== listener));
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }
}

class FakeDocument {
    constructor() {
        this.activeElement = null;
        this.bannerImage = null;
        this.body = new FakeElement('body', this);
        this.documentElement = { clientHeight: 800, clientWidth: 1280 };
        this.galleryRoot = null;
    }

    addEventListener() {}

    createDocumentFragment() {
        return new FakeElement('fragment', this);
    }

    createElement(tagName) {
        return new FakeElement(tagName, this);
    }

    getElementById(id) {
        return id === 'pjax-container' ? this.galleryRoot : null;
    }

    querySelector(selector) {
        if (selector === '[data-void-gallery]') {
            return this.galleryRoot;
        }
        if (selector === '#banner img') {
            return this.bannerImage;
        }
        return this.body.querySelector(selector);
    }
}

class FakeResizeObserver {
    static instances = [];

    constructor(callback) {
        this.callback = callback;
        this.disconnected = false;
        this.observed = null;
        FakeResizeObserver.instances.push(this);
    }

    disconnect() {
        this.disconnected = true;
    }

    observe(element) {
        this.observed = element;
    }
}

class FakeWindow {
    constructor() {
        this.ResizeObserver = FakeResizeObserver;
        this.animationFrames = new Map();
        this.innerHeight = 800;
        this.innerWidth = 1280;
        this.listeners = new Map();
        this.nextFrameId = 1;
        this.nextTimerId = 1;
        this.timers = new Map();
        this.window = this;
    }

    addEventListener(name, listener) {
        const listeners = this.listeners.get(name) || [];
        listeners.push(listener);
        this.listeners.set(name, listeners);
    }

    dispatch(name) {
        (this.listeners.get(name) || []).slice().forEach((listener) => listener());
    }

    cancelAnimationFrame(id) {
        this.animationFrames.delete(id);
    }

    clearInterval() {}

    clearTimeout(id) {
        this.timers.delete(id);
    }

    flushAnimationFrames() {
        const callbacks = Array.from(this.animationFrames.values());
        this.animationFrames.clear();
        callbacks.forEach((callback) => callback());
    }

    flushTimers() {
        const callbacks = Array.from(this.timers.values());
        this.timers.clear();
        callbacks.forEach((callback) => callback());
    }

    requestAnimationFrame(callback) {
        const id = this.nextFrameId++;
        this.animationFrames.set(id, callback);
        return id;
    }

    removeEventListener(name, listener) {
        const listeners = this.listeners.get(name) || [];
        this.listeners.set(name, listeners.filter((candidate) => candidate !== listener));
    }

    setInterval() {
        return 1;
    }

    setTimeout(callback) {
        const id = this.nextTimerId++;
        this.timers.set(id, callback);
        return id;
    }
}

function createImageFigure(document, options = {}) {
    const figure = new FakeElement('figure', document);
    const link = new FakeElement('a', document);
    const image = new FakeElement('img', document);
    figure.setAttribute('data-void-image-item', '');
    link.setAttribute('class', 'void-image-link');
    link.setAttribute('data-void-image-zoom', '');
    link.setAttribute('href', options.href || '/original.jpg');
    image.setAttribute('data-void-image-content', '');
    image.complete = options.complete !== false;
    image.naturalWidth = options.naturalWidth || 0;
    image.naturalHeight = options.naturalHeight || 0;
    if (options.width && options.height) {
        figure.setAttribute('data-void-image-width', options.width);
        figure.setAttribute('data-void-image-height', options.height);
    }
    link.appendChild(image);
    figure.appendChild(link);
    return { figure, image, link };
}

function loadGalleryEnvironment(root = null) {
    FakeResizeObserver.instances = [];
    const document = new FakeDocument();
    const window = new FakeWindow();
    document.readyState = 'loading';
    document.galleryRoot = root;
    if (root) {
        document.body.appendChild(root);
        const setOwnerDocument = (element) => {
            element.ownerDocument = document;
            element.children.forEach(setOwnerDocument);
        };
        setOwnerDocument(root);
        root.setAttribute('data-void-gallery', '');
    }
    const context = {
        console: { error() {}, log() {} },
        document,
        window
    };
    vm.runInNewContext(
        readVoidSource(),
        context
    );
    return { context, document, window };
}

function closeTo(actual, expected, precision = 0.000001) {
    assert.ok(Math.abs(actual - expected) < precision, `${actual} should be close to ${expected}`);
}

function createPanoramicGallery(count) {
    const root = new FakeElement('article');
    for (let index = 0; index < count; index++) {
        root.appendChild(createImageFigure(null, { width: 4000, height: 1000 }).figure);
    }
    return root;
}

function getElementText(element) {
    if (!element) {
        return '';
    }
    return [element.textContent]
        .concat(element.children.map((child) => getElementText(child)))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function getVisibleRows(root) {
    return root.querySelectorAll('.void-gallery-row').filter((row) => !row.hidden);
}

function getHiddenPhotoCount(root) {
    return root.querySelectorAll('.void-gallery-row').reduce((count, row) => {
        return count + (row.hidden
            ? row.querySelectorAll('figure[data-void-image-item]').length
            : 0);
    }, 0);
}

function getWallHeight(rows, gap = 16) {
    const heights = rows.map((row) => {
        const figure = row.querySelector('figure[data-void-image-item]');
        return figure ? parseFloat(figure.style.getPropertyValue('--void-gallery-item-height')) : 0;
    });
    return heights.reduce((total, height) => total + height, 0)
        + Math.max(0, heights.length - 1) * gap;
}

test('mobile rows keep very wide photos full-width and pair moderate ratios', () => {
    const { context } = loadGalleryEnvironment();
    const rows = context.VOID_Gallery.__test.calculateRows(
        [16 / 9, 3 / 2, 3 / 2],
        390,
        { gap: 14, targetHeight: 160, maxItems: 2, singleItemMinRatio: 1.6 }
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0].justified, true);
    assert.equal(rows[1].justified, true);
    closeTo(rows[0].height, 219.375);
    closeTo(rows[0].widths[0], 390);
    closeTo(rows[1].height, 376 / 3);
    closeTo(rows[1].widths[0], 188);
    closeTo(rows[1].widths[1], 188);
    closeTo(rows[1].widths[0] + rows[1].widths[1] + 14, 390);
});

test('mixed ratios preserve order and exactly justify a complete row', () => {
    const { context } = loadGalleryEnvironment();
    const rows = context.VOID_Gallery.__test.calculateRows(
        [2, 1, 1.5, 0.5],
        1000,
        { gap: 10, targetHeight: 200, maxItems: 5 }
    );

    assert.equal(rows.length, 1);
    assert.equal(rows[0].justified, true);
    closeTo(rows[0].height, 194);
    assert.deepEqual(JSON.parse(JSON.stringify(rows[0].widths)), [388, 194, 291, 97]);
});

test('the final incomplete row keeps natural widths and single photos are emphasized', () => {
    const { context } = loadGalleryEnvironment();
    const rows = context.VOID_Gallery.__test.calculateRows(
        [2, 1, 1.5, 0.5, 1, 1],
        1000,
        { gap: 10, targetHeight: 200, maxItems: 5 }
    );
    const single = context.VOID_Gallery.__test.calculateRows(
        [4 / 3],
        390,
        { gap: 14, targetHeight: 140, maxItems: 2 }
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0].justified, true);
    assert.equal(rows[1].justified, false);
    assert.equal(rows[1].height, 200);
    assert.deepEqual(JSON.parse(JSON.stringify(rows[1].widths)), [200, 200]);
    assert.equal(single[0].justified, false);
    closeTo(single[0].height, 245);
    closeTo(single[0].widths[0], 980 / 3);
});

test('invalid ratios use a stable fallback and zero-width containers are ignored', () => {
    const { context } = loadGalleryEnvironment();
    const rows = context.VOID_Gallery.__test.calculateRows(
        [0, 'bad'],
        400,
        { gap: 8, targetHeight: 200, maxItems: 2 }
    );

    assert.equal(context.VOID_Gallery.__test.calculateRows([1], 0, {}).length, 0);
    assert.equal(rows.length, 1);
    closeTo(rows[0].widths[0] + rows[0].widths[1] + 8, 400);
});

test('responsive options use hybrid mobile rows and roomier wider layouts', () => {
    const { context } = loadGalleryEnvironment();

    assert.deepEqual(
        JSON.parse(JSON.stringify(context.VOID_Gallery.__test.getLayoutOptions(639))),
        { gap: 14, targetHeight: 160, maxItems: 2, singleItemMinRatio: 1.6 }
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(context.VOID_Gallery.__test.getLayoutOptions(640))),
        { gap: 14, targetHeight: 240, maxItems: 2 }
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(context.VOID_Gallery.__test.getLayoutOptions(900, 959))),
        { gap: 14, targetHeight: 240, maxItems: 2 }
    );
    assert.deepEqual(
        JSON.parse(JSON.stringify(context.VOID_Gallery.__test.getLayoutOptions(912, 960))),
        { gap: 16, targetHeight: 320, maxItems: 4 }
    );
});

test('gallery ratios consume PhotoSets dimensions without hydrating figures', () => {
    const { context, document } = loadGalleryEnvironment();
    const { figure, image } = createImageFigure(document, {
        complete: true,
        height: 1080,
        naturalHeight: 1200,
        naturalWidth: 900,
        width: 1920
    });

    closeTo(context.VOID_Gallery.__test.getFigureRatio(figure), 16 / 9);
    figure.removeAttribute('data-void-image-width');
    figure.removeAttribute('data-void-image-height');
    closeTo(context.VOID_Gallery.__test.getFigureRatio(figure), 3 / 4);
    image.complete = false;
    closeTo(context.VOID_Gallery.__test.getFigureRatio(figure), 4 / 3);
    assert.equal(figure.hasAttribute('data-void-image-width'), false);
    assert.equal(figure.hasAttribute('data-void-image-height'), false);
});

test('only empty separators between semantic image figures are removed', () => {
    const { context, document } = loadGalleryEnvironment();
    const root = new FakeElement('article', document);
    const before = createImageFigure(document).figure;
    const lineBreak = new FakeElement('br', document);
    const emptyParagraph = new FakeElement('p', document);
    const after = createImageFigure(document).figure;
    root.appendChild(before);
    root.appendChild(lineBreak);
    root.appendChild(emptyParagraph);
    root.appendChild(after);

    context.VOID_Gallery.__test.removePhotoSeparators(root);
    assert.deepEqual(root.children, [before, after]);

    const otherRoot = new FakeElement('article', document);
    const ordinaryFigure = new FakeElement('figure', document);
    const separator = new FakeElement('br', document);
    otherRoot.appendChild(ordinaryFigure);
    otherRoot.appendChild(separator);
    otherRoot.appendChild(createImageFigure(document).figure);
    context.VOID_Gallery.__test.removePhotoSeparators(otherRoot);
    assert.equal(separator.parentNode, otherRoot);

    const embeddedRoot = new FakeElement('article', document);
    const embeddedParagraph = new FakeElement('p', document);
    embeddedParagraph.appendChild(new FakeElement('iframe', document));
    embeddedRoot.appendChild(createImageFigure(document).figure);
    embeddedRoot.appendChild(embeddedParagraph);
    embeddedRoot.appendChild(createImageFigure(document).figure);
    context.VOID_Gallery.__test.removePhotoSeparators(embeddedRoot);
    assert.equal(embeddedParagraph.parentNode, embeddedRoot);
});

test('init flattens current photo sets while preserving image links and focus', () => {
    const root = new FakeElement('article');
    const wrapper = new FakeElement('div');
    wrapper.setAttribute('data-void-photo-set', '');
    const first = createImageFigure(null, { width: 1600, height: 900, href: '/first-original.jpg' });
    const second = createImageFigure(null, { width: 800, height: 1200 });
    wrapper.appendChild(first.figure);
    wrapper.appendChild(second.figure);
    root.appendChild(wrapper);
    const { context, document } = loadGalleryEnvironment(root);

    context.VOID_Gallery.init();

    assert.equal(wrapper.parentNode, null);
    assert.equal(root.querySelectorAll('[data-void-gallery-set]').length, 1);
    assert.equal(first.figure.contains(first.link), true);
    assert.equal(first.link.getAttribute('href'), '/first-original.jpg');
    assert.equal(first.figure.getAttribute('data-void-image-width'), '1600');
    assert.equal(first.figure.getAttribute('data-void-image-height'), '900');

    context.VOID_PhotoSets.init(root);
    assert.equal(context.VOID_PhotoSets.setBindings.length, 0);
});

test('row relayout preserves the original anchor and restores its focus without scrolling', () => {
    const root = new FakeElement('article');
    const source = createImageFigure(null, { width: 1600, height: 900 });
    root.appendChild(source.figure);
    const { context, document } = loadGalleryEnvironment(root);
    context.VOID_Gallery.normalize(root);
    document.activeElement = source.link;

    context.VOID_Gallery.layout();

    assert.equal(source.figure.contains(source.link), true);
    assert.equal(source.link.focusCalls.length, 1);
    assert.equal(source.link.focusCalls[0].preventScroll, true);
});

test('repeated init restores a focused image link after DOM normalization', () => {
    const root = new FakeElement('article');
    const source = createImageFigure(null, { width: 1600, height: 900 });
    root.appendChild(source.figure);
    const { context, document } = loadGalleryEnvironment(root);
    context.VOID_Gallery.init();
    document.activeElement = source.link;

    context.VOID_Gallery.init();

    assert.equal(document.activeElement, source.link);
    assert.equal(source.link.focusCalls.length, 1);
    assert.equal(source.link.focusCalls[0].preventScroll, true);
});

test('progressive disclosure only activates when the gallery exceeds 4.5 viewports', () => {
    const shortRoot = createPanoramicGallery(10);
    const shortFixture = loadGalleryEnvironment(shortRoot);
    shortFixture.window.innerHeight = 600;
    shortFixture.document.documentElement.clientHeight = 600;

    shortFixture.context.VOID_Gallery.init();

    const shortRows = shortRoot.querySelectorAll('.void-gallery-row');
    assert.equal(shortRows.length, 10);
    assert.ok(getWallHeight(shortRows) < 600 * 4.5);
    assert.equal(shortRows.some((row) => row.hidden), false);
    assert.equal(shortFixture.document.body.querySelector('[data-void-gallery-more]'), null);

    const longRoot = createPanoramicGallery(11);
    const longFixture = loadGalleryEnvironment(longRoot);
    longFixture.window.innerHeight = 600;
    longFixture.document.documentElement.clientHeight = 600;

    longFixture.context.VOID_Gallery.init();

    const longRows = longRoot.querySelectorAll('.void-gallery-row');
    const visibleRows = getVisibleRows(longRoot);
    const rowAllowance = 266;
    assert.equal(longRows.length, 11);
    assert.equal(longFixture.context.VOID_Gallery.rows.length, longRows.length);
    assert.equal(longFixture.context.VOID_Gallery.rows[0].element, longRows[0]);
    assert.equal(longFixture.context.VOID_Gallery.rows[0].height, 250);
    assert.equal(longFixture.context.VOID_Gallery.rows[0].gap, 16);
    assert.equal(longFixture.context.VOID_Gallery.rows[0].itemCount, 1);
    assert.ok(getWallHeight(longRows) > 600 * 4.5);
    assert.ok(visibleRows.length > 0 && visibleRows.length < longRows.length);
    assert.ok(Math.abs(getWallHeight(visibleRows) - 600 * 2.75) <= rowAllowance);
});

test('load more control exposes an accessible remaining count and reveals complete rows', () => {
    const root = createPanoramicGallery(24);
    const { context, document, window } = loadGalleryEnvironment(root);
    window.innerHeight = 600;
    document.documentElement.clientHeight = 600;

    context.VOID_Gallery.init();

    const button = document.body.querySelector('button[data-void-gallery-more]');
    const initialVisibleRows = getVisibleRows(root);
    const initialVisibleHeight = getWallHeight(initialVisibleRows);
    const initialRemaining = getHiddenPhotoCount(root);
    assert.ok(button);
    assert.equal(button.getAttribute('type'), 'button');
    assert.match(getElementText(button), /显示更多照片/);
    assert.match(getElementText(button), new RegExp(`还剩\\s*${initialRemaining}\\s*张`));
    assert.equal(document.body.querySelectorAll('[data-void-gallery-more]').length, 1);
    assert.ok(initialRemaining > 0);

    button.click();

    const nextVisibleRows = getVisibleRows(root);
    const revealedHeight = getWallHeight(nextVisibleRows) - initialVisibleHeight;
    const nextRemaining = getHiddenPhotoCount(root);
    assert.ok(nextVisibleRows.length > initialVisibleRows.length);
    assert.ok(Math.abs(revealedHeight - 600 * 2) <= 266);
    assert.ok(nextRemaining < initialRemaining);
    assert.equal(
        root.querySelectorAll('figure[data-void-image-item]').some((figure) => figure.hidden),
        false
    );
    assert.match(getElementText(button), new RegExp(`还剩\\s*${nextRemaining}\\s*张`));

    while (document.body.querySelector('[data-void-gallery-more]')) {
        document.body.querySelector('[data-void-gallery-more]').click();
    }
    assert.equal(getHiddenPhotoCount(root), 0);
});

test('keyboard load-more activation focuses the first newly revealed photo', () => {
    const root = createPanoramicGallery(24);
    const { context, document, window } = loadGalleryEnvironment(root);
    window.innerHeight = 600;
    document.documentElement.clientHeight = 600;
    context.VOID_Gallery.init();
    const button = document.body.querySelector('[data-void-gallery-more]');
    const firstNewRow = root.querySelectorAll('.void-gallery-row')[getVisibleRows(root).length];
    const firstNewLink = firstNewRow.querySelector('a[data-void-image-zoom]');
    document.activeElement = button;

    button.dispatch('click', { detail: 0 });

    assert.equal(firstNewRow.hidden, false);
    assert.equal(document.activeElement, button);
    assert.equal(window.timers.size, 1);
    window.flushTimers();
    assert.equal(document.activeElement, firstNewLink);
    assert.equal(firstNewLink.focusCalls.length, 1);
});

test('pointer load-more activation does not force focus into newly revealed photos', () => {
    const root = createPanoramicGallery(24);
    const { context, document, window } = loadGalleryEnvironment(root);
    window.innerHeight = 600;
    document.documentElement.clientHeight = 600;
    context.VOID_Gallery.init();
    const button = document.body.querySelector('[data-void-gallery-more]');
    const firstNewRow = root.querySelectorAll('.void-gallery-row')[getVisibleRows(root).length];
    const firstNewLink = firstNewRow.querySelector('a[data-void-image-zoom]');
    document.activeElement = button;

    button.dispatch('click', { detail: 1 });
    window.flushTimers();

    assert.equal(firstNewRow.hidden, false);
    assert.equal(document.activeElement, button);
    assert.equal(firstNewLink.focusCalls.length, 0);
});

test('relayout keeps the revealed photo high-water mark', () => {
    const root = createPanoramicGallery(24);
    const { context, document, window } = loadGalleryEnvironment(root);
    window.innerHeight = 600;
    document.documentElement.clientHeight = 600;
    context.VOID_Gallery.init();
    document.body.querySelector('[data-void-gallery-more]').click();
    const visibleBeforeResize = root.querySelectorAll('.void-gallery-row').reduce((count, row) => {
        return count + (row.hidden ? 0 : row.querySelectorAll('figure[data-void-image-item]').length);
    }, 0);
    const set = root.querySelector('[data-void-gallery-set]');
    root.clientWidth = 900;
    set.clientWidth = 900;

    FakeResizeObserver.instances[0].callback([{ contentRect: { width: 900 } }]);
    window.flushAnimationFrames();

    const visibleAfterResize = root.querySelectorAll('.void-gallery-row').reduce((count, row) => {
        return count + (row.hidden ? 0 : row.querySelectorAll('figure[data-void-image-item]').length);
    }, 0);
    assert.ok(visibleAfterResize >= visibleBeforeResize);
});

test('viewport-height changes reveal to the new budget without hiding prior rows', () => {
    const root = createPanoramicGallery(24);
    const { context, document, window } = loadGalleryEnvironment(root);
    window.innerHeight = 400;
    document.documentElement.clientHeight = 400;
    context.VOID_Gallery.init();
    const visibleAtSmallHeight = getVisibleRows(root).length;

    window.innerHeight = 900;
    document.documentElement.clientHeight = 900;
    window.dispatch('resize');
    window.flushAnimationFrames();

    const visibleAtLargeHeight = getVisibleRows(root).length;
    assert.ok(visibleAtLargeHeight > visibleAtSmallHeight);
    assert.ok(document.body.querySelector('[data-void-gallery-more]'));

    window.innerHeight = 1600;
    document.documentElement.clientHeight = 1600;
    window.dispatch('resize');
    window.flushAnimationFrames();

    assert.equal(getVisibleRows(root).length, root.querySelectorAll('.void-gallery-row').length);
    assert.equal(document.body.querySelector('[data-void-gallery-more]'), null);
});

test('component visibility never exposes author-hidden lead content', () => {
    const root = new FakeElement('article');
    for (let index = 0; index < 7; index++) {
        root.appendChild(createImageFigure(null, { width: 4000, height: 1000 }).figure);
    }
    const heading = new FakeElement('h2');
    const authorHiddenNote = new FakeElement('p');
    authorHiddenNote.hidden = true;
    root.appendChild(heading);
    root.appendChild(authorHiddenNote);
    for (let index = 0; index < 10; index++) {
        root.appendChild(createImageFigure(null, { width: 4000, height: 1000 }).figure);
    }
    const { context, document, window } = loadGalleryEnvironment(root);
    window.innerHeight = 600;
    document.documentElement.clientHeight = 600;

    context.VOID_Gallery.init();
    assert.equal(heading.hidden, true);
    assert.equal(authorHiddenNote.hidden, true);

    context.VOID_Gallery.destroy();
    assert.equal(heading.hidden, false);
    assert.equal(authorHiddenNote.hidden, true);
});

test('PJAX suspension preserves the current wall until replacement or reinit', () => {
    const root = createPanoramicGallery(11);
    const { context, document, window } = loadGalleryEnvironment(root);
    window.innerHeight = 600;
    document.documentElement.clientHeight = 600;
    context.VOID_Gallery.init();
    const hiddenBefore = getHiddenPhotoCount(root);
    const button = document.body.querySelector('[data-void-gallery-more]');

    context.VOID_Gallery.suspend();

    assert.equal(getHiddenPhotoCount(root), hiddenBefore);
    assert.equal(document.body.querySelector('[data-void-gallery-more]'), button);
    assert.equal(button.hasAttribute('disabled'), true);
    assert.equal(button.getAttribute('aria-busy'), 'true');
    assert.equal(button.listenerCount('click'), 0);

    context.VOID_Gallery.init();
    assert.equal(document.body.querySelectorAll('[data-void-gallery-more]').length, 1);
    assert.equal(document.body.querySelector('[data-void-gallery-more]').hasAttribute('disabled'), false);
});

test('repeated init does not duplicate controls and destroy restores hidden rows', () => {
    const root = createPanoramicGallery(11);
    const { context, document, window } = loadGalleryEnvironment(root);
    window.innerHeight = 600;
    document.documentElement.clientHeight = 600;

    context.VOID_Gallery.init();
    assert.equal(document.body.querySelectorAll('[data-void-gallery-more]').length, 1);
    assert.ok(root.querySelectorAll('[hidden]').length > 0);
    context.VOID_Gallery.init();

    assert.equal(document.body.querySelectorAll('[data-void-gallery-more]').length, 1);
    assert.equal(document.body.querySelector('[data-void-gallery-more]').listenerCount('click'), 1);
    context.VOID_Gallery.destroy();

    assert.equal(document.body.querySelectorAll('[data-void-gallery-more]').length, 0);
    assert.equal(root.querySelectorAll('[hidden]').length, 0);
});

test('loads for images with semantic dimensions do not schedule a redundant relayout', () => {
    const root = new FakeElement('article');
    const source = createImageFigure(null, {
        complete: false,
        height: 1000,
        width: 2000
    });
    root.appendChild(source.figure);
    const { context, window } = loadGalleryEnvironment(root);

    context.VOID_Gallery.init();
    source.image.complete = true;
    source.image.naturalWidth = 2000;
    source.image.naturalHeight = 1000;
    root.dispatch('load', { target: source.image });
    root.dispatch('load', { target: source.image });

    assert.equal(window.animationFrames.size, 0);
});

test('loads without semantic dimensions still schedule one relayout without writing dimensions', () => {
    const root = new FakeElement('article');
    const source = createImageFigure(null, { complete: false });
    root.appendChild(source.figure);
    const { context, window } = loadGalleryEnvironment(root);

    context.VOID_Gallery.init();
    const initialWidth = source.figure.style.getPropertyValue('--void-gallery-item-width');
    source.image.complete = true;
    source.image.naturalWidth = 2000;
    source.image.naturalHeight = 1000;
    root.dispatch('load', { target: source.image });
    root.dispatch('load', { target: source.image });

    assert.equal(window.animationFrames.size, 1);
    window.flushAnimationFrames();
    assert.notEqual(source.figure.style.getPropertyValue('--void-gallery-item-width'), initialWidth);
    assert.equal(source.figure.hasAttribute('data-void-image-width'), false);
    assert.equal(source.figure.hasAttribute('data-void-image-height'), false);
});

test('init and destroy remain idempotent across observers, listeners and queued work', () => {
    const root = new FakeElement('article');
    root.appendChild(createImageFigure(null, { width: 1200, height: 800 }).figure);
    const { context } = loadGalleryEnvironment(root);

    context.VOID_Gallery.init();
    const firstObserver = FakeResizeObserver.instances[0];
    assert.equal(root.listenerCount('load'), 1);
    context.VOID_Gallery.init();

    assert.equal(firstObserver.disconnected, true);
    assert.equal(root.listenerCount('load'), 1);
    assert.equal(FakeResizeObserver.instances.length, 2);

    context.VOID_Gallery.destroy();
    context.VOID_Gallery.destroy();
    assert.equal(root.listenerCount('load'), 0);
    assert.equal(FakeResizeObserver.instances[1].disconnected, true);
    assert.equal(context.VOID_Gallery.root, null);
});

test('the first gallery image is promoted only when no banner is present', () => {
    const root = new FakeElement('article');
    const first = createImageFigure(null, { width: 1200, height: 800 });
    root.appendChild(first.figure);
    const fixture = loadGalleryEnvironment(root);

    fixture.context.VOID_Gallery.init();
    assert.equal(first.image.getAttribute('loading'), 'eager');
    assert.equal(first.image.getAttribute('fetchpriority'), 'high');
    assert.equal(first.image.getAttribute('decoding'), 'async');

    const bannerRoot = new FakeElement('article');
    const bannerFirst = createImageFigure(null, { width: 1200, height: 800 });
    bannerRoot.appendChild(bannerFirst.figure);
    const bannerFixture = loadGalleryEnvironment(bannerRoot);
    bannerFixture.document.bannerImage = new FakeElement('img', bannerFixture.document);
    bannerFixture.context.VOID_Gallery.init();
    assert.equal(bannerFirst.image.hasAttribute('fetchpriority'), false);
    assert.equal(bannerFirst.image.hasAttribute('loading'), false);
});

test('gallery sources use the current image contract without Fancybox fallbacks', () => {
    const script = readVoidSource();
    const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.scss'), 'utf8');
    const style = fs.readFileSync(path.resolve(__dirname, '../../assets/parts/_gallery.scss'), 'utf8');
    const template = fs.readFileSync(path.resolve(__dirname, '../../Gallery.php'), 'utf8');
    const gallerySource = readVoidModule('gallery');

    assert.match(gallerySource, /VOID_PhotoSets\.resolveDimensions\(figure, image\)/);
    assert.match(gallerySource, /\[data-void-photo-set\]/);
    assert.match(gallerySource, /figure\[data-void-image-item\]/);
    assert.match(style, />a\.void-image-link\[data-void-image-zoom\]/);
    assert.match(style, /img\[data-void-image-content\]/);
    assert.match(style, /width:\s*1440px;/);
    assert.match(style, /--void-gallery-gap:\s*16px;/);
    assert.match(style, /max-width:\s*959px[\s\S]*--void-gallery-gap:\s*14px;/);
    assert.match(style, /&\.is-last\s*\{\s*justify-content:\s*center;/);
    assert.match(style, /\.void-gallery \[hidden\]\s*\{\s*display:\s*none!important;/);
    assert.match(style, /@media \(hover:\s*none\)[\s\S]*figcaption\s*\{[^}]*opacity:\s*1;/);
    assert.match(
        style,
        /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*figure\[data-void-image-item\]:focus-within[^}]*\{\s*transform:\s*none;/
    );
    assert.doesNotMatch(style, /blured-placeholder/);
    assert.doesNotMatch(stylesheet, /blured-placeholder/);
    assert.match(gallerySource, /rowData\.widths\.length === 1 \? ' is-single' : ''/);
    assert.match(
        style,
        /\.photos\[data-void-photo-set\]\s*\{[^}]*width:\s*100%;[^}]*margin-right:\s*0;[^}]*margin-left:\s*0;/
    );
    assert.ok(
        stylesheet.indexOf('parts/gallery') > stylesheet.indexOf('parts/article'),
        'Gallery overrides must load after the shared article photo-set styles'
    );
    assert.match(template, /data-void-gallery/);
    assert.match(template, /<\?php \$this->content\(\); \?>/);
    assert.match(
        script,
        /VOID_Gallery\.init\(\);\s*VOID_PhotoSets\.init\(\);\s*VOID_PhotoSwipe\.init\(\);/
    );
    assert.match(
        script,
        /VOID_PhotoSwipe\.destroy\(\);\s*VOID_Gallery\.suspend\(\);\s*VOID_PhotoSets\.destroy\(\);/
    );
    assert.doesNotMatch(
        gallerySource,
        /data-fancybox|configureFancybox|ensureActive|getHrefRatio|URLSearchParams/i
    );
    assert.doesNotMatch(style, /fancybox/i);
    assert.doesNotMatch(template, /fancybox/i);
});

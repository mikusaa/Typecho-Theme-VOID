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
        (this.listeners.get(name) || []).slice().forEach(({ listener }) => listener.call(this, event));
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
            if (selector === '[data-void-gallery-set]') {
                return element.hasAttribute('data-void-gallery-set');
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
        this.documentElement = { clientWidth: 1280 };
        this.galleryRoot = null;
    }

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
        return null;
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
    const handlers = new Map();
    const document = new FakeDocument();
    const window = new FakeWindow();
    document.galleryRoot = root;
    if (root) {
        const setOwnerDocument = (element) => {
            element.ownerDocument = document;
            element.children.forEach(setOwnerDocument);
        };
        setOwnerDocument(root);
        root.setAttribute('data-void-gallery', '');
    }
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
    return { context, document, handlers, window };
}

function closeTo(actual, expected, precision = 0.000001) {
    assert.ok(Math.abs(actual - expected) < precision, `${actual} should be close to ${expected}`);
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

test('image load schedules one relayout and does not write intrinsic dimensions', () => {
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
    const script = fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.js'), 'utf8');
    const stylesheet = fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.scss'), 'utf8');
    const style = fs.readFileSync(path.resolve(__dirname, '../../assets/parts/_gallery.scss'), 'utf8');
    const template = fs.readFileSync(path.resolve(__dirname, '../../Gallery.php'), 'utf8');
    const gallerySource = script.slice(
        script.indexOf('var VOID_Gallery'),
        script.indexOf('var VOID_ImageZoom')
    );

    assert.match(gallerySource, /VOID_PhotoSets\.resolveDimensions\(figure, image\)/);
    assert.match(gallerySource, /\[data-void-photo-set\]/);
    assert.match(gallerySource, /figure\[data-void-image-item\]/);
    assert.match(style, />a\.void-image-link\[data-void-image-zoom\]/);
    assert.match(style, /img\[data-void-image-content\]/);
    assert.match(style, /width:\s*1440px;/);
    assert.match(style, /--void-gallery-gap:\s*16px;/);
    assert.match(style, /max-width:\s*959px[\s\S]*--void-gallery-gap:\s*14px;/);
    assert.match(style, /&\.is-last\s*\{\s*justify-content:\s*center;/);
    assert.match(style, /@media \(hover:\s*none\)[\s\S]*figcaption\s*\{[^}]*opacity:\s*1;/);
    assert.match(
        style,
        /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*figure\[data-void-image-item\]:focus-within[^}]*\{\s*transform:\s*none;/
    );
    assert.match(
        style,
        /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*img\.blured-placeholder\s*\{\s*transition:\s*none;/
    );
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
        /VOID_Gallery\.init\(\);\s*VOID_PhotoSets\.init\(\);\s*VOID_ImageZoom\.init\(\);/
    );
    assert.match(
        script,
        /VOID_ImageZoom\.destroy\(\);\s*VOID_Gallery\.destroy\(\);\s*VOID_PhotoSets\.destroy\(\);/
    );
    assert.doesNotMatch(
        gallerySource,
        /data-fancybox|configureFancybox|ensureActive|getHrefRatio|URLSearchParams/i
    );
    assert.doesNotMatch(style, /fancybox/i);
    assert.doesNotMatch(template, /fancybox/i);
});

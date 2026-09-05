/* global __dirname */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sass = require('sass');
const test = require('node:test');
const vm = require('node:vm');
const { readVoidSource } = require('./helpers/void-source.cjs');

const editorSource = fs.readFileSync(path.resolve(__dirname, '../../assets/editor.js'), 'utf8');
const editorAdminCssSource = fs.readFileSync(path.resolve(__dirname, '../../assets/editor-admin.css'), 'utf8');
const headerSource = fs.readFileSync(path.resolve(__dirname, '../../assets/header.js'), 'utf8');
const mainSource = readVoidSource();
const indexCssSource = fs.readFileSync(path.resolve(__dirname, '../../assets/parts/_index.scss'), 'utf8');
const functionsSource = fs.readFileSync(path.resolve(__dirname, '../../functions.php'), 'utf8');
const utilsSource = fs.readFileSync(path.resolve(__dirname, '../../libs/Utils.php'), 'utf8');
const indexTemplateSource = fs.readFileSync(path.resolve(__dirname, '../../index.php'), 'utf8');

function extract(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(start, -1, `missing ${startMarker}`);
    assert.notEqual(end, -1, `missing ${endMarker}`);
    return source.slice(start, end + endMarker.length);
}

function createControl(value = '') {
    return {
        length: 1,
        listeners: [],
        value,
        first() {
            return this;
        },
        val(next) {
            if (arguments.length) {
                this.value = String(next);
                return this;
            }
            return this.value;
        },
        on(names, listener) {
            this.listeners.push({ names, listener });
            return this;
        },
        off(namespace) {
            this.listeners = this.listeners.filter((entry) => !entry.names.includes(namespace));
            return this;
        },
        trigger(name) {
            for (const entry of this.listeners) {
                if (entry.names.split(/\s+/).some((event) => event.split('.')[0] === name)) {
                    entry.listener.call(this);
                }
            }
            return this;
        }
    };
}

function loadBannerMeta(initialBanner = '', initialMeta = '') {
    const banner = createControl(initialBanner);
    const meta = createControl(initialMeta);
    const images = [];
    const timers = new Map();
    let nextTimerId = 1;

    function jQuery(selector) {
        if (selector.includes('bannerMeta')) {
            return meta;
        }
        if (selector.includes('banner')) {
            return banner;
        }
        throw new Error(`Unexpected selector: ${selector}`);
    }

    function FakeImage() {
        this.complete = false;
        this.naturalWidth = 0;
        this.naturalHeight = 0;
        this.onload = null;
        this.onerror = null;
        this.src = '';
        images.push(this);
    }

    const window = {
        jQuery,
        Image: FakeImage,
        setTimeout(callback, delay) {
            const id = nextTimerId++;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout(id) {
            timers.delete(id);
        }
    };
    window.window = window;
    const context = { window };

    vm.runInNewContext(
        extract(editorSource, 'var VOID_BannerMeta =', '})(window.jQuery);'),
        context
    );

    return {
        api: context.VOID_BannerMeta,
        banner,
        meta,
        images,
        pendingTimers() {
            return Array.from(timers.values());
        },
        flushTimers() {
            while (timers.size) {
                const pending = Array.from(timers.values());
                timers.clear();
                for (const timer of pending) {
                    timer.callback();
                }
            }
        },
        resolveImage(index, width, height) {
            const image = images[index];
            image.complete = true;
            image.naturalWidth = width;
            image.naturalHeight = height;
            if (image.onload) {
                image.onload.call(image);
            }
        },
        rejectImage(index) {
            const image = images[index];
            image.complete = true;
            if (image.onerror) {
                image.onerror.call(image);
            }
        }
    };
}

class FakeClassList {
    constructor(onAdd) {
        this.values = new Set();
        this.onAdd = onAdd || null;
    }

    add(name) {
        this.values.add(name);
        if (this.onAdd) {
            this.onAdd(name);
        }
    }

    remove(name) {
        this.values.delete(name);
    }

    contains(name) {
        return this.values.has(name);
    }
}

function createDeferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, reject, resolve };
}

function createCoverImage(options = {}) {
    const attributes = new Set(['data-void-card-cover']);
    const image = {
        classList: new FakeClassList(),
        complete: options.complete === true,
        decodeCalls: 0,
        isConnected: options.isConnected !== false,
        naturalWidth: options.naturalWidth || 0,
        hasAttribute(name) {
            return attributes.has(name);
        },
        removeAttribute(name) {
            attributes.delete(name);
        }
    };

    if (options.decode !== null) {
        image.decode = function () {
            image.decodeCalls++;
            if (typeof options.decode === 'function') {
                return options.decode();
            }
            return Promise.resolve();
        };
    }

    return image;
}

function loadCardCover(options = {}) {
    const listeners = { error: [], load: [] };
    const operations = [];
    let rafCallbacks = [];
    const documentElement = {
        classList: new FakeClassList((name) => operations.push(`class:${name}`))
    };
    const document = {
        documentElement,
        addEventListener(type, listener, capture) {
            listeners[type].push({ capture, listener });
            operations.push(`listen:${type}`);
        }
    };
    const window = {
        matchMedia() {
            return { matches: options.reducedMotion === true };
        },
        requestAnimationFrame(callback) {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        }
    };
    const context = { document, window };

    vm.runInNewContext(
        extract(headerSource, 'VOID_CardCover =', 'VOID_CardCover.bind();'),
        context
    );

    return {
        api: context.VOID_CardCover,
        documentElement,
        listeners,
        operations,
        createRoot(images) {
            return {
                querySelectorAll(selector) {
                    assert.equal(selector, 'img[data-void-card-cover]');
                    return images;
                }
            };
        },
        dispatch(type, target) {
            for (const entry of listeners[type]) {
                entry.listener({ target });
            }
        },
        flushAnimationFrame() {
            const callbacks = rafCallbacks;
            rafCallbacks = [];
            for (const callback of callbacks) {
                callback();
            }
        },
        pendingAnimationFrames() {
            return rafCallbacks.length;
        }
    };
}

async function flushPromises() {
    await Promise.resolve();
    await Promise.resolve();
}

test('banner metadata uses strict versioned JSON tied to the current source', () => {
    const fixture = loadBannerMeta();
    const api = fixture.api.__test;
    const source = 'https://example.test/cover.jpg';
    const valid = api.serializeMeta(` ${source} `, 1920, 1080);

    assert.deepEqual(JSON.parse(valid), {
        version: 1,
        source,
        width: 1920,
        height: 1080
    });
    assert.deepEqual(Array.from(api.parseMeta(valid, source)), [1920, 1080]);
    assert.equal(api.parseMeta(valid, `${source}?changed=1`), null);
    assert.equal(api.parseMeta(JSON.stringify({
        version: 1,
        source: ` ${source}`,
        width: 1920,
        height: 1080
    }), source), null);
    assert.equal(api.parseMeta('{"version":2,"source":"x","width":1,"height":1}', 'x'), null);
    assert.equal(api.parseMeta('{"version":1,"source":"x","width":"1","height":1}', 'x'), null);
    assert.equal(api.parseMeta('{"version":1,"source":"x","width":100001,"height":1}', 'x'), null);
});

test('initialization keeps matching metadata and clears it as soon as the banner changes', () => {
    const source = 'https://example.test/old.jpg';
    const fixture = loadBannerMeta(source);
    fixture.meta.value = fixture.api.__test.serializeMeta(source, 1200, 800);

    fixture.api.init();
    assert.notEqual(fixture.meta.value, '', 'matching metadata survives initialization');
    assert.equal(fixture.pendingTimers().length, 0, 'matching metadata does not trigger a probe');

    fixture.banner.value = 'https://example.test/new.jpg';
    fixture.banner.trigger('input');
    assert.equal(fixture.meta.value, '', 'stale source metadata is cleared synchronously');

    fixture.meta.value = fixture.api.__test.serializeMeta(fixture.banner.value, 1000, 500);
    fixture.banner.value = '';
    fixture.banner.trigger('change');
    assert.equal(fixture.meta.value, '', 'clearing the banner also clears metadata');
});

test('a standalone image probe writes metadata for the current banner', () => {
    const source = 'https://example.test/cover.jpg';
    const fixture = loadBannerMeta(source);
    fixture.api.init();

    assert.equal(fixture.pendingTimers().length, 1);
    assert.equal(fixture.pendingTimers()[0].delay, 300);
    fixture.flushTimers();
    assert.equal(fixture.images.length, 1);
    assert.equal(fixture.images[0].src, source);

    fixture.resolveImage(0, 1600, 900);
    assert.deepEqual(JSON.parse(fixture.meta.value), {
        version: 1,
        source,
        width: 1600,
        height: 900
    });

    fixture.banner.value = 'https://example.test/new.jpg';
    fixture.banner.trigger('input');
    assert.equal(fixture.meta.value, '');
    fixture.flushTimers();
    fixture.rejectImage(1);
    assert.equal(fixture.meta.value, '', 'probe failures leave metadata empty');
});

test('banner probes ignore stale work and keep only the latest URL', () => {
    const fixture = loadBannerMeta('https://example.test/old.jpg');
    fixture.api.init();
    fixture.flushTimers();

    const staleImage = fixture.images[0];
    const staleLoad = staleImage.onload;
    fixture.banner.value = 'https://example.test/intermediate.jpg';
    fixture.banner.trigger('input');
    fixture.banner.value = 'https://example.test/final.jpg';
    fixture.banner.trigger('input');

    staleImage.naturalWidth = 800;
    staleImage.naturalHeight = 600;
    staleLoad.call(staleImage);
    assert.equal(fixture.meta.value, '', 'a late callback cannot write metadata for an old URL');
    assert.equal(fixture.pendingTimers().length, 1, 'rapid input keeps one pending probe');

    fixture.flushTimers();
    assert.equal(fixture.images.length, 2);
    assert.equal(fixture.images[1].src, 'https://example.test/final.jpg');
    fixture.resolveImage(1, 1200, 800);
    assert.deepEqual(JSON.parse(fixture.meta.value), {
        version: 1,
        source: 'https://example.test/final.jpg',
        width: 1200,
        height: 800
    });
});

test('destroying banner metadata collection cancels pending asynchronous work', () => {
    const fixture = loadBannerMeta('https://example.test/cover.jpg');
    const controller = fixture.api.init();

    fixture.flushTimers();
    assert.equal(fixture.images.length, 1);
    controller.destroy();
    assert.equal(fixture.images[0].onload, null);
    assert.equal(fixture.images[0].onerror, null);
    assert.equal(fixture.banner.listeners.length, 0);

    fixture.resolveImage(0, 1600, 900);
    assert.equal(fixture.meta.value, '');
});

test('banner dimension probing does not depend on the card preview', () => {
    const bannerMetaSource = extract(editorSource, 'var VOID_BannerMeta =', '})(window.jQuery);');

    assert.match(bannerMetaSource, /new window\.Image\(\)/);
    assert.match(bannerMetaSource, /window\.setTimeout/);
    assert.doesNotMatch(bannerMetaSource, /voidIndexPreview|void-post-preview|cardVariants/);
    assert.doesNotMatch(editorSource, /VOID_BannerMeta\.updateFromImage/);
});

test('editor removes both card and server-backed preview implementations', () => {
    const removedCardPreviewMarkers = new RegExp([
        'initPostCard' + 'Preview',
        'void-post-' + 'preview',
        'void-home-' + 'preview-card',
        'void-index-' + 'stage',
        'voidPost' + 'PreviewReady',
        'voidIndex' + 'Preview',
        'preview' + 'Controller',
        'card' + 'Variants',
        'void-preview-' + 'status',
        'void-admin-preview-' + 'bg'
    ].join('|'));
    const removedPreviewMarkers = new RegExp([
        'Home' + 'Preview',
        'VOIDHome' + 'Preview',
        'void_home_' + 'preview',
        'voidHome' + 'Preview',
        'void-home-' + 'preview',
        '首页' + '预览'
    ].join('|'));

    assert.doesNotMatch(editorSource, removedCardPreviewMarkers);
    assert.doesNotMatch(editorAdminCssSource, removedCardPreviewMarkers);
    for (const source of [editorSource, editorAdminCssSource, functionsSource, utilsSource, indexTemplateSource]) {
        assert.doesNotMatch(source, removedPreviewMarkers);
    }
    assert.equal(
        fs.existsSync(path.resolve(__dirname, '../../libs', ['Home', 'Preview.php'].join(''))),
        false
    );
    assert.match(editorSource, /initMediaFieldLayout\(\$panel\);/);
    assert.match(editorSource, /var VOID_BannerMeta =/);
    assert.match(editorSource, /window\.VOID_BannerMeta\.init\(\)/);
});

test('card cover listeners bind once before the root transition class is enabled', () => {
    const fixture = loadCardCover();

    assert.deepEqual(fixture.operations, [
        'listen:load',
        'listen:error',
        'class:void-card-cover-transition'
    ]);
    assert.equal(fixture.listeners.load[0].capture, true);
    assert.equal(fixture.listeners.error[0].capture, true);
    assert.equal(fixture.documentElement.classList.contains('void-card-cover-transition'), true);

    fixture.api.bind();
    assert.equal(fixture.listeners.load.length, 1);
    assert.equal(fixture.listeners.error.length, 1);
});

test('a delayed native load waits for decode and two rendered frames before fading in', async () => {
    const fixture = loadCardCover();
    const decoded = createDeferred();
    const image = createCoverImage({ decode: () => decoded.promise });
    const root = fixture.createRoot([image]);

    fixture.api.init(root);
    assert.equal(image.decodeCalls, 0, 'an unfinished native lazy image is not decoded early');

    image.complete = true;
    image.naturalWidth = 1600;
    fixture.dispatch('load', image);
    assert.equal(image.decodeCalls, 1);
    assert.equal(image.classList.contains('loaded'), false);

    decoded.resolve();
    await flushPromises();
    assert.equal(image.classList.contains('loaded'), false, 'decode alone does not reveal the cover');
    assert.equal(fixture.pendingAnimationFrames(), 1);

    fixture.flushAnimationFrame();
    assert.equal(image.classList.contains('loaded'), false, 'one complete transparent frame is retained');
    fixture.flushAnimationFrame();
    assert.equal(image.classList.contains('loaded'), true);
});

test('cached covers are supplemented by init and still receive the full fade sequence', async () => {
    const fixture = loadCardCover();
    const image = createCoverImage({ complete: true, naturalWidth: 1200 });

    fixture.api.init(fixture.createRoot([image]));
    assert.equal(image.decodeCalls, 1);
    await flushPromises();
    fixture.flushAnimationFrame();
    assert.equal(image.classList.contains('loaded'), false);
    fixture.flushAnimationFrame();
    assert.equal(image.classList.contains('loaded'), true);
});

test('missing, throwing, and rejected decode paths fail open for valid images', async () => {
    const missingFixture = loadCardCover();
    const missing = createCoverImage({ complete: true, decode: null, naturalWidth: 900 });
    missingFixture.api.init(missingFixture.createRoot([missing]));
    missingFixture.flushAnimationFrame();
    missingFixture.flushAnimationFrame();
    assert.equal(missing.classList.contains('loaded'), true);

    const throwingFixture = loadCardCover();
    const throwing = createCoverImage({
        complete: true,
        decode() {
            throw new Error('decode is unavailable');
        },
        naturalWidth: 900
    });
    throwingFixture.api.init(throwingFixture.createRoot([throwing]));
    throwingFixture.flushAnimationFrame();
    throwingFixture.flushAnimationFrame();
    assert.equal(throwing.classList.contains('loaded'), true);

    const rejectedFixture = loadCardCover();
    const rejected = createCoverImage({
        complete: true,
        decode: () => Promise.reject(new Error('decode failed')),
        naturalWidth: 900
    });
    rejectedFixture.api.init(rejectedFixture.createRoot([rejected]));
    await flushPromises();
    rejectedFixture.flushAnimationFrame();
    rejectedFixture.flushAnimationFrame();
    assert.equal(rejected.classList.contains('loaded'), true);
    assert.equal(rejected.classList.contains('error'), false);
});

test('real image failures become visible immediately and repeated init stays idempotent', async () => {
    const fixture = loadCardCover();
    const failed = createCoverImage();
    fixture.dispatch('error', failed);
    assert.equal(failed.classList.contains('error'), true);
    assert.equal(fixture.pendingAnimationFrames(), 0);

    const badCache = createCoverImage({ complete: true, naturalWidth: 0 });
    fixture.api.init(fixture.createRoot([badCache]));
    assert.equal(badCache.classList.contains('error'), true);

    const decoded = createDeferred();
    const valid = createCoverImage({
        complete: true,
        decode: () => decoded.promise,
        naturalWidth: 1000
    });
    const root = fixture.createRoot([valid]);
    fixture.api.init(root);
    fixture.api.init(root);
    assert.equal(valid.decodeCalls, 1, 'pending decode work is not duplicated');
    decoded.resolve();
    await flushPromises();
    fixture.flushAnimationFrame();
    fixture.flushAnimationFrame();
    fixture.api.init(root);
    assert.equal(valid.decodeCalls, 1, 'a revealed cover remains terminal');
});

test('late decode work cannot update a PJAX-removed cover', async () => {
    const fixture = loadCardCover();
    const decoded = createDeferred();
    const image = createCoverImage({
        complete: true,
        decode: () => decoded.promise,
        naturalWidth: 1200
    });

    fixture.api.init(fixture.createRoot([image]));
    image.isConnected = false;
    image.removeAttribute('data-void-card-cover');
    decoded.resolve();
    await flushPromises();
    fixture.flushAnimationFrame();
    fixture.flushAnimationFrame();
    assert.equal(image.classList.contains('loaded'), false);
    assert.equal(image.classList.contains('error'), false);
});

test('PJAX cache scanning is scoped to the new container', async () => {
    const fixture = loadCardCover();
    const oldImage = createCoverImage({ complete: true, naturalWidth: 800 });
    const newImage = createCoverImage({ complete: true, naturalWidth: 1600 });

    fixture.api.init(fixture.createRoot([newImage]));
    await flushPromises();
    fixture.flushAnimationFrame();
    fixture.flushAnimationFrame();
    assert.equal(oldImage.decodeCalls, 0);
    assert.equal(newImage.decodeCalls, 1);
    assert.equal(newImage.classList.contains('loaded'), true);
});

test('reduced motion reveals decoded covers without animation frames', async () => {
    const fixture = loadCardCover({ reducedMotion: true });
    const image = createCoverImage({ complete: true, naturalWidth: 1200 });

    fixture.api.init(fixture.createRoot([image]));
    await flushPromises();
    assert.equal(image.classList.contains('loaded'), true);
    assert.equal(fixture.pendingAnimationFrames(), 0);
});

test('templates and lifecycles expose the decoded card cover contract', () => {
    const indexTemplate = fs.readFileSync(path.resolve(__dirname, '../../index.php'), 'utf8');
    const archiveTemplate = fs.readFileSync(path.resolve(__dirname, '../../includes/archives.php'), 'utf8');
    const cardCoverSource = extract(headerSource, 'VOID_CardCover =', 'VOID_CardCover.bind();');

    for (const template of [indexTemplate, archiveTemplate]) {
        assert.match(template, /Contents::getBannerDimensions/);
        assert.match(template, /width=".*height="/s);
        assert.match(template, /loading="eager" fetchpriority="high" decoding="async" data-void-card-cover/);
        assert.match(template, /loading="eager" decoding="async" data-void-card-cover/);
        assert.match(template, /loading="lazy" decoding="async" data-void-card-cover/);
    }

    assert.match(editorSource, /preserveHiddenMetadataField\(\$customField, 'bannerMeta'\)/);
    assert.match(editorSource, /\$control\.detach\(\);[\s\S]*?\$customField\.before\(\$control\);[\s\S]*?\$row\.remove\(\);/);
    assert.doesNotMatch(cardCoverSource, /new Image\(|new window\.Image\(|data-src|lazyload/);
    assert.match(cardCoverSource, /document\.addEventListener\('load', VOID_CardCover\.handleLoad, true\)/);
    assert.match(cardCoverSource, /document\.addEventListener\('error', VOID_CardCover\.handleError, true\)/);
    assert.match(cardCoverSource, /document\.documentElement\.classList\.add\('void-card-cover-transition'\)/);
    assert.equal(
        (mainSource.match(/VOID_CardCover\.init\(document\.getElementById\('pjax-container'\)\);[\s\S]*?VOID_Ui\.MasonryCtrler\.init\(\);/g) || []).length,
        2
    );
    assert.match(indexCssSource, /html\.void-card-cover-transition[\s\S]*?img\[data-void-card-cover\]/);
    assert.match(indexCssSource, /\.banner\{[\s\S]*?background: #eeeff1;/);
    assert.match(indexCssSource, /\.style-2[\s\S]*?background-color: #12121c!important/);
    assert.doesNotMatch(headerSource, /\$\('\.masonry-item'\)\.addClass\('done'\)/);
    assert.doesNotMatch(indexCssSource, /transition:[^;]*opacity[^;]*border/);
    assert.doesNotMatch(indexCssSource, /\.single-col\s*&\s*\{[^}]*opacity/s);
});

test('compiled card cover CSS fades over 0.5s and fails open', () => {
    const css = sass.compile(path.resolve(__dirname, '../../assets/VOID.scss'), {
        loadPaths: [path.resolve(__dirname, '../../assets')],
        style: 'expanded'
    }).css;

    assert.match(css, /html\.void-card-cover-transition section#index-list \.banner img\[data-void-card-cover\] \{\s*opacity: 0;/);
    assert.match(css, /img\[data-void-card-cover\]\.loaded \{\s*opacity: 1;\s*transition: opacity 0\.5s cubic-bezier\(0\.25, 0\.46, 0\.45, 0\.94\);/);
    assert.match(css, /img\[data-void-card-cover\]\.error \{\s*opacity: 1;\s*transition: none;/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?section#index-list\.float-up \{\s*animation: none;/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?img\[data-void-card-cover\] \{\s*transition: none;/);
});

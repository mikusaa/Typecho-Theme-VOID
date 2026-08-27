/* global __dirname */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorSource = fs.readFileSync(path.resolve(__dirname, '../../assets/editor.js'), 'utf8');
const editorAdminCssSource = fs.readFileSync(path.resolve(__dirname, '../../assets/editor-admin.css'), 'utf8');
const headerSource = fs.readFileSync(path.resolve(__dirname, '../../assets/header.js'), 'utf8');
const mainSource = fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.js'), 'utf8');
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

test('templates keep intrinsic dimensions and native loading without a cover state machine', () => {
    const indexTemplate = fs.readFileSync(path.resolve(__dirname, '../../index.php'), 'utf8');
    const archiveTemplate = fs.readFileSync(path.resolve(__dirname, '../../includes/archives.php'), 'utf8');

    for (const template of [indexTemplate, archiveTemplate]) {
        assert.match(template, /Contents::getBannerDimensions/);
        assert.match(template, /width=".*height="/s);
        assert.match(template, /loading="eager" fetchpriority="high" decoding="async"/);
        assert.match(template, /loading="eager" decoding="async"/);
        assert.match(template, /loading="lazy" decoding="async"/);
        assert.doesNotMatch(template, /data-void-card-cover/);
    }

    assert.match(editorSource, /preserveHiddenMetadataField\(\$customField, 'bannerMeta'\)/);
    assert.match(editorSource, /\$control\.detach\(\);[\s\S]*?\$customField\.before\(\$control\);[\s\S]*?\$row\.remove\(\);/);
    assert.doesNotMatch(headerSource, /VOID_CardCover|void-card-cover-transition/);
    assert.doesNotMatch(mainSource, /VOID_CardCover/);
    assert.doesNotMatch(indexCssSource, /data-void-card-cover|void-card-cover-transition/);
    assert.match(indexCssSource, /\.banner\{[\s\S]*?background: #eeeff1;/);
    assert.match(indexCssSource, /\.style-2[\s\S]*?background-color: #12121c!important/);
});

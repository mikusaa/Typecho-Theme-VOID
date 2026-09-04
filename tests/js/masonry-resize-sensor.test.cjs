const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sass = require('sass');
const test = require('node:test');
const vm = require('node:vm');

function loadMasonryEnvironment(options = {}) {
    const elements = [];
    const masonryCalls = [];
    const sensorInstances = [];
    const windowListeners = new Map();
    const masonryContainer = createElement('masonry');

    function createElement(id) {
        const classes = new Set();
        return {
            id,
            classes,
            isConnected: true,
            style: {},
            classList: {
                add(className) { classes.add(className); },
                contains(className) { return classes.has(className); },
                remove(className) { classes.delete(className); }
            }
        };
    }

    function getClasses(element) {
        if (!element.classes) {
            element.classes = new Set();
        }
        return element.classes;
    }

    const document = {
        body: {},
        documentElement: {},
        getElementById(id) {
            return elements.find((element) => element.id === id) || null;
        },
        querySelector() {
            return null;
        }
    };

    function jQuery(selector) {
        let items = [];
        if (selector === '.masonry-item') {
            items = elements.slice();
        } else if (selector === '#masonry' && options.masonryContainer !== false) {
            items = [masonryContainer];
        }

        const api = {
            items,
            length: items.length,
            addClass(className) {
                items.forEach((item) => getClasses(item).add(className));
                return api;
            },
            css() { return api; },
            fadeOut() { return api; },
            has() { return api; },
            hasClass(className) {
                return items.length > 0 && getClasses(items[0]).has(className);
            },
            hide() { return api; },
            masonry(argument) {
                masonryCalls.push(argument);
                if (argument === 'destroy') {
                    masonryContainer.style = {};
                    elements.forEach((item) => { item.style = {}; });
                } else {
                    masonryContainer.style.height = '320px';
                    masonryContainer.style.position = 'relative';
                    elements.forEach((item) => { item.style.position = 'absolute'; });
                }
                return api;
            },
            on() { return api; },
            removeClass(className) {
                items.forEach((item) => getClasses(item).delete(className));
                return api;
            }
        };
        return api;
    }

    jQuery.each = (collection, callback) => {
        const items = collection.items || collection;
        for (let i = 0; i < items.length; i += 1) {
            callback(i, items[i]);
        }
    };

    function ResizeSensor(element, callback) {
        this.element = element;
        this.callback = callback;
        this.detachedCallback = null;
        this.detachCount = 0;
        this.detach = (detachedCallback) => {
            this.detachCount += 1;
            this.detachedCallback = detachedCallback;
        };
        sensorInstances.push(this);
    }

    function Image() {
        this.complete = false;
        this.currentSrc = '';
        this.naturalWidth = 0;
        Object.defineProperty(this, 'src', {
            get: () => this.source,
            set: (value) => {
                this.source = value;
                if (options.imageState === 'loaded') {
                    this.complete = true;
                    this.naturalWidth = 1200;
                } else if (options.imageState === 'failed') {
                    this.complete = true;
                    this.naturalWidth = 0;
                }
            }
        });
    }

    const window = {
        addEventListener(type, listener) {
            if (!windowListeners.has(type)) {
                windowListeners.set(type, new Set());
            }
            windowListeners.get(type).add(listener);
        },
        clearTimeout() {},
        innerWidth: options.innerWidth || 1024,
        removeEventListener(type, listener) {
            if (windowListeners.has(type)) {
                windowListeners.get(type).delete(listener);
            }
        },
        setTimeout() {}
    };
    window.window = window;

    const context = {
        $: jQuery,
        Image,
        ResizeSensor,
        VOIDConfig: { indexStyle: options.indexStyle === undefined ? 1 : options.indexStyle },
        console,
        document,
        jQuery,
        window
    };

    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/header.js'), 'utf8'),
        context
    );

    return {
        controller: context.VOID_Ui.MasonryCtrler,
        createElement,
        dispatchWindowEvent(type) {
            const listeners = windowListeners.get(type) || [];
            Array.from(listeners).forEach((listener) => listener());
        },
        elements,
        listenerCount(type) {
            return windowListeners.has(type) ? windowListeners.get(type).size : 0;
        },
        masonryCalls,
        masonryContainer,
        sensorInstances,
        ui: context.VOID_Ui,
        window
    };
}

test('Masonry has a visible desktop two-column fallback before JavaScript takes over', () => {
    const stylesheet = sass.compile(
        path.resolve(__dirname, '../../assets/VOID.scss'),
        { style: 'expanded', quietDeps: true }
    ).css;

    assert.match(stylesheet, /@media screen and \(min-width: 768px\) \{\s*\.wrapper\.wide section#index-list > ul:not\(\.masonry\) \{\s*display: grid;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);\s*gap: 30px;\s*\}\s*\.wrapper\.wide section#index-list > ul:not\(\.masonry\) > li \{\s*width: auto;\s*margin-bottom: 0;\s*\}\s*\}/);
});

test('Masonry resize sensors stay idempotent and follow replaced DOM nodes', () => {
    const environment = loadMasonryEnvironment();
    const firstElement = { id: 'p-1' };
    const replacementElement = { id: 'p-1' };

    environment.elements.push(firstElement);
    environment.controller.watch('p-1');
    environment.controller.watch('p-1');

    assert.equal(environment.sensorInstances.length, 1);
    assert.equal(environment.controller.sensors.length, 1);

    environment.elements[0] = replacementElement;
    environment.controller.watch('p-1');

    assert.equal(environment.sensorInstances.length, 2);
    assert.equal(environment.sensorInstances[0].detachCount, 1);
    assert.equal(
        environment.sensorInstances[0].detachedCallback,
        environment.sensorInstances[0].callback
    );
    assert.equal(environment.controller.sensors.length, 1);
    assert.equal(environment.controller.sensors[0].element, replacementElement);
});

test('Masonry stays active through UI reset and explicit teardown detaches it once', () => {
    const environment = loadMasonryEnvironment({ indexStyle: 0 });
    const element = environment.createElement('p-2');

    environment.elements.push(element);
    environment.controller.init();
    environment.controller.init();

    assert.equal(environment.sensorInstances.length, 1);
    assert.equal(environment.controller.sensors.length, 1);
    assert.equal(environment.controller.active, true);

    environment.ui.reset();
    environment.ui.reset();

    assert.equal(environment.masonryCalls.length, 1);
    assert.equal(environment.sensorInstances[0].detachCount, 0);
    assert.equal(environment.controller.sensors.length, 1);
    assert.equal(environment.listenerCount('resize'), 1);
    assert.equal(environment.controller.active, true);
    assert.equal(environment.masonryContainer.classes.has('masonry'), true);
    assert.equal(element.classes.has('masonry-ready'), true);
    assert.equal(element.style.position, 'absolute');

    environment.controller.destroy();
    environment.controller.destroy();

    assert.equal(environment.masonryCalls.length, 2);
    assert.equal(environment.masonryCalls[1], 'destroy');
    assert.equal(environment.sensorInstances[0].detachCount, 1);
    assert.equal(
        environment.sensorInstances[0].detachedCallback,
        environment.sensorInstances[0].callback
    );
    assert.equal(environment.controller.sensors.length, 0);
    assert.equal(environment.listenerCount('resize'), 0);
});

test('Masonry follows both directions across the mobile breakpoint', () => {
    const environment = loadMasonryEnvironment({ indexStyle: 0, innerWidth: 767 });
    const element = environment.createElement('p-3');

    environment.elements.push(element);
    environment.controller.init();

    assert.equal(environment.masonryCalls.length, 0);
    assert.equal(environment.listenerCount('resize'), 1);
    assert.equal(element.classes.has('masonry-ready'), false);

    environment.window.innerWidth = 768;
    environment.dispatchWindowEvent('resize');
    environment.dispatchWindowEvent('resize');

    assert.equal(environment.masonryCalls.length, 1);
    assert.equal(environment.masonryCalls[0].itemSelector, '.masonry-item');
    assert.equal(environment.controller.active, true);
    assert.equal(environment.masonryContainer.classes.has('masonry'), true);
    assert.equal(element.classes.has('masonry-ready'), true);
    assert.equal(element.style.position, 'absolute');

    environment.window.innerWidth = 767;
    environment.dispatchWindowEvent('resize');

    assert.equal(environment.masonryCalls.length, 2);
    assert.equal(environment.masonryCalls[1], 'destroy');
    assert.equal(environment.controller.active, false);
    assert.equal(environment.masonryContainer.classes.has('masonry'), false);
    assert.equal(element.classes.has('masonry-ready'), false);
    assert.equal(element.style.position, undefined);

    environment.window.innerWidth = 768;
    environment.dispatchWindowEvent('resize');

    assert.equal(environment.masonryCalls.length, 3);
    assert.equal(environment.masonryCalls[2].itemSelector, '.masonry-item');
    assert.equal(environment.controller.active, true);
});

test('Masonry teardown and PJAX DOM replacement rebuild the layout once', () => {
    const environment = loadMasonryEnvironment({ indexStyle: 0 });
    const element = environment.createElement('p-4');
    const replacementElement = environment.createElement('p-4');

    environment.elements.push(element);
    environment.controller.init();
    environment.controller.destroy();
    environment.controller.destroy();

    assert.deepEqual(environment.masonryCalls.map((argument) => (
        typeof argument === 'string' ? argument : 'init'
    )), ['init', 'destroy']);
    assert.equal(environment.listenerCount('resize'), 0);
    assert.equal(environment.sensorInstances[0].detachCount, 1);
    assert.equal(environment.controller.active, false);

    environment.elements[0] = replacementElement;
    environment.controller.init();

    assert.deepEqual(environment.masonryCalls.map((argument) => (
        typeof argument === 'string' ? argument : 'init'
    )), ['init', 'destroy', 'init']);
    assert.equal(environment.listenerCount('resize'), 1);
    assert.equal(environment.sensorInstances.length, 2);
    assert.equal(environment.controller.sensors.length, 1);
    assert.equal(environment.controller.sensors[0].element, replacementElement);
    assert.equal(environment.controller.active, true);
});

test('an observed item size change relayouts only an active desktop Masonry grid', () => {
    const environment = loadMasonryEnvironment({ indexStyle: 0 });
    const element = environment.createElement('p-5');

    environment.elements.push(element);
    environment.controller.init();
    assert.equal(environment.masonryCalls.length, 1);

    environment.sensorInstances[0].callback();
    assert.equal(environment.masonryCalls.length, 2);

    environment.window.innerWidth = 767;
    environment.sensorInstances[0].callback();
    assert.equal(environment.masonryCalls.length, 2);
});

test('large background waits for success and ignores failed or stale loads', () => {
    const environment = loadMasonryEnvironment();
    const background = environment.createElement('bg');
    const image = environment.ui.loadBackgroundImage(background, 'https://example.test/banner.jpg');
    const onload = image.onload;

    assert.equal(background.style.backgroundImage, undefined);
    assert.equal(background.classes.has('loaded'), false);

    onload();

    assert.equal(background.style.backgroundImage, 'url("https://example.test/banner.jpg")');
    assert.equal(background.classes.has('loaded'), true);
    assert.equal(image.onload, null);
    assert.equal(image.onerror, null);

    const failedBackground = environment.createElement('failed-bg');
    const failedImage = environment.ui.loadBackgroundImage(failedBackground, 'https://example.test/missing.jpg');
    failedImage.onerror();

    assert.equal(failedBackground.style.backgroundImage, undefined);
    assert.equal(failedBackground.classes.has('loaded'), false);

    const staleBackground = environment.createElement('stale-bg');
    const staleImage = environment.ui.loadBackgroundImage(staleBackground, 'https://example.test/stale.jpg');
    staleBackground.isConnected = false;
    staleImage.onload();

    assert.equal(staleBackground.style.backgroundImage, undefined);
    assert.equal(staleBackground.classes.has('loaded'), false);
});

test('large background handles cached success and cached failure immediately', () => {
    const loadedEnvironment = loadMasonryEnvironment({ imageState: 'loaded' });
    const loadedBackground = loadedEnvironment.createElement('cached-bg');

    loadedEnvironment.ui.loadBackgroundImage(loadedBackground, 'https://example.test/cached.jpg');

    assert.equal(loadedBackground.style.backgroundImage, 'url("https://example.test/cached.jpg")');
    assert.equal(loadedBackground.classes.has('loaded'), true);

    const failedEnvironment = loadMasonryEnvironment({ imageState: 'failed' });
    const failedBackground = failedEnvironment.createElement('cached-failed-bg');

    failedEnvironment.ui.loadBackgroundImage(failedBackground, 'https://example.test/cached-missing.jpg');

    assert.equal(failedBackground.style.backgroundImage, undefined);
    assert.equal(failedBackground.classes.has('loaded'), false);
});

test('large background template serializes its URL and uses the shared loader', () => {
    const template = fs.readFileSync(
        path.resolve(__dirname, '../../includes/main-large.php'),
        'utf8'
    );

    assert.match(template, /VOID_Ui\.loadBackgroundImage\(/);
    assert.match(template, /json_encode\([\s\S]*JSON_HEX_TAG[\s\S]*JSON_HEX_QUOT/);
    assert.doesNotMatch(template, /if\s*\(\s*!img_bg\.complete/);
});

test('ResizeSensor detach cancels an invisible-element animation frame', () => {
    const frameCallbacks = new Map();
    const cancelledFrames = [];
    let nextFrameId = 1;

    function createNode() {
        return {
            addEventListener() {},
            appendChild(child) {
                this.children.push(child);
            },
            children: [],
            contains(child) {
                return this.children.includes(child);
            },
            offsetHeight: 0,
            offsetWidth: 0,
            removeChild(child) {
                this.children.splice(this.children.indexOf(child), 1);
            },
            scrollLeft: 0,
            scrollTop: 0,
            style: {}
        };
    }

    const element = createNode();
    element[Symbol.toStringTag] = 'HTMLDivElement';
    element.getBoundingClientRect = () => ({ height: 0, width: 0 });

    const window = {
        Math,
        cancelAnimationFrame(id) {
            cancelledFrames.push(id);
            frameCallbacks.delete(id);
        },
        getComputedStyle() {
            return { getPropertyValue: () => 'static' };
        },
        requestAnimationFrame(callback) {
            const id = nextFrameId;
            nextFrameId += 1;
            frameCallbacks.set(id, callback);
            return id;
        }
    };
    const context = {
        Math,
        document: { createElement: createNode },
        exports: {},
        module: { exports: {} },
        window
    };
    window.window = window;

    vm.runInNewContext(
        fs.readFileSync(
            path.resolve(__dirname, '../../assets/libs/header/ResizeSensor/ResizeSensor.js'),
            'utf8'
        ),
        context
    );

    const callback = () => {};
    const sensor = new context.module.exports(element, callback);
    assert.equal(frameCallbacks.size, 1);

    sensor.detach(callback);

    assert.deepEqual(cancelledFrames, [1]);
    assert.equal(frameCallbacks.size, 0);
});

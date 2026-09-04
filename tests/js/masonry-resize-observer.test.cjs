const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sass = require('sass');
const test = require('node:test');
const vm = require('node:vm');

function loadMasonryEnvironment(options = {}) {
    const elements = [];
    const masonryInstances = [];
    const observerInstances = [];
    const windowListeners = new Map();
    const frameCallbacks = new Map();
    const cancelledFrames = [];
    let nextFrameId = 1;
    let masonryContainer = options.masonryContainer === false ? null : createElement('masonry');

    function createElement(id, images = []) {
        const classes = new Set();
        const listeners = new Map();
        return {
            id,
            classes,
            images,
            isConnected: true,
            style: {},
            addEventListener(type, listener) {
                if (!listeners.has(type)) {
                    listeners.set(type, new Set());
                }
                listeners.get(type).add(listener);
            },
            classList: {
                add(className) { classes.add(className); },
                contains(className) { return classes.has(className); },
                remove(className) { classes.delete(className); }
            },
            dispatch(type) {
                const handlers = listeners.get(type) || [];
                Array.from(handlers).forEach((handler) => handler({ target: this, type }));
            },
            listenerCount(type) {
                return listeners.has(type) ? listeners.get(type).size : 0;
            },
            querySelectorAll(selector) {
                if (id === 'masonry' && selector === '.masonry-item') {
                    return elements.slice();
                }
                return selector === 'img' ? images.slice() : [];
            },
            removeEventListener(type, listener) {
                if (listeners.has(type)) {
                    listeners.get(type).delete(listener);
                }
            }
        };
    }

    const bodyClasses = new Set();
    const document = {
        body: {
            classList: {
                add(name) { bodyClasses.add(name); },
                contains(name) { return bodyClasses.has(name); },
                remove(name) { bodyClasses.delete(name); },
                toggle(name) {
                    if (bodyClasses.has(name)) {
                        bodyClasses.delete(name);
                        return false;
                    }
                    bodyClasses.add(name);
                    return true;
                }
            }
        },
        documentElement: {},
        getElementById(id) {
            if (id === 'masonry') {
                return masonryContainer;
            }
            return elements.find((element) => element.id === id) || null;
        },
        querySelector() {
            return null;
        },
        querySelectorAll(selector) {
            return selector === '.masonry-item' ? elements.slice() : [];
        }
    };

    function Masonry(element, masonryOptions) {
        this.element = element;
        this.options = masonryOptions;
        this.destroyCount = 0;
        this.layoutCount = 1;
        element.style.height = '320px';
        element.style.position = 'relative';
        elements.forEach((item) => { item.style.position = 'absolute'; });
        this.destroy = () => {
            this.destroyCount += 1;
            element.style = {};
            elements.forEach((item) => { item.style = {}; });
        };
        this.layout = () => {
            this.layoutCount += 1;
        };
        masonryInstances.push(this);
    }

    class ResizeObserver {
        constructor(callback) {
            this.callback = callback;
            this.disconnectCount = 0;
            this.targets = new Set();
            observerInstances.push(this);
        }

        disconnect() {
            this.disconnectCount += 1;
            this.targets.clear();
        }

        observe(element) {
            this.targets.add(element);
        }

        unobserve(element) {
            this.targets.delete(element);
        }
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
        cancelAnimationFrame(id) {
            cancelledFrames.push(id);
            frameCallbacks.delete(id);
        },
        clearTimeout(id) {
            frameCallbacks.delete(id);
        },
        innerWidth: options.innerWidth || 1024,
        removeEventListener(type, listener) {
            if (windowListeners.has(type)) {
                windowListeners.get(type).delete(listener);
            }
        },
        requestAnimationFrame: options.withoutAnimationFrame ? undefined : function (callback) {
            const id = nextFrameId;
            nextFrameId += 1;
            frameCallbacks.set(id, callback);
            return id;
        },
        ResizeObserver: options.withoutResizeObserver ? undefined : ResizeObserver,
        setTimeout(callback) {
            const id = nextFrameId;
            nextFrameId += 1;
            frameCallbacks.set(id, callback);
            return id;
        }
    };
    window.window = window;

    const context = {
        Image,
        Masonry,
        VOIDConfig: { indexStyle: options.indexStyle === undefined ? 0 : options.indexStyle },
        console,
        document,
        window
    };

    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/header.js'), 'utf8'),
        context
    );

    return {
        controller: context.VOID_Ui.MasonryCtrler,
        createElement,
        createImage(complete = false) {
            const image = createElement('');
            image.complete = complete;
            return image;
        },
        cancelledFrames,
        dispatchWindowEvent(type) {
            const listeners = windowListeners.get(type) || [];
            Array.from(listeners).forEach((listener) => listener());
        },
        elements,
        flushFrames() {
            while (frameCallbacks.size > 0) {
                const callbacks = Array.from(frameCallbacks.values());
                frameCallbacks.clear();
                callbacks.forEach((callback) => callback());
            }
        },
        frameCount() {
            return frameCallbacks.size;
        },
        listenerCount(type) {
            return windowListeners.has(type) ? windowListeners.get(type).size : 0;
        },
        masonryInstances,
        get masonryContainer() {
            return masonryContainer;
        },
        observerInstances,
        replaceContainer() {
            masonryContainer = createElement('masonry');
            return masonryContainer;
        },
        triggerResize(element) {
            observerInstances.forEach((observer) => {
                if (observer.targets.has(element)) {
                    observer.callback([{ target: element }]);
                }
            });
        },
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

test('Masonry ResizeObserver watches stay idempotent and follow replaced DOM nodes', () => {
    const environment = loadMasonryEnvironment();
    const firstImage = environment.createImage();
    const replacementImage = environment.createImage();
    const firstElement = environment.createElement('p-1', [firstImage]);
    const replacementElement = environment.createElement('p-1', [replacementImage]);

    environment.elements.push(firstElement);
    environment.controller.watch('p-1');
    environment.controller.watch('p-1');

    assert.equal(environment.observerInstances.length, 1);
    assert.equal(environment.observerInstances[0].targets.size, 1);
    assert.equal(environment.controller.watchedItems.length, 1);
    assert.equal(firstImage.listenerCount('load'), 1);
    assert.equal(firstImage.listenerCount('error'), 1);

    environment.elements[0] = replacementElement;
    environment.controller.watch('p-1');

    assert.equal(environment.observerInstances.length, 1);
    assert.deepEqual(Array.from(environment.observerInstances[0].targets), [replacementElement]);
    assert.equal(firstImage.listenerCount('load'), 0);
    assert.equal(firstImage.listenerCount('error'), 0);
    assert.equal(environment.controller.watchedItems.length, 1);
    assert.equal(environment.controller.watchedItems[0].element, replacementElement);
});

test('Masonry initializes once and explicit teardown releases every resource', () => {
    const environment = loadMasonryEnvironment({ indexStyle: 0 });
    const image = environment.createImage();
    const element = environment.createElement('p-2', [image]);

    environment.elements.push(element);
    environment.controller.init();
    environment.controller.init();

    assert.equal(environment.masonryInstances.length, 1);
    assert.equal(environment.masonryInstances[0].options.resize, false);
    assert.equal(environment.observerInstances.length, 1);
    assert.equal(environment.controller.watchedItems.length, 1);
    assert.equal(environment.controller.active, true);

    environment.ui.reset();
    environment.ui.reset();

    assert.equal(environment.masonryInstances.length, 1);
    assert.equal(environment.masonryInstances[0].destroyCount, 0);
    assert.equal(environment.controller.watchedItems.length, 1);
    assert.equal(environment.listenerCount('resize'), 1);
    assert.equal(environment.controller.active, true);
    assert.equal(environment.masonryContainer.classes.has('masonry'), true);
    assert.equal(element.classes.has('masonry-ready'), true);
    assert.equal(element.style.position, 'absolute');

    environment.controller.destroy();
    environment.controller.destroy();

    assert.equal(environment.masonryInstances[0].destroyCount, 1);
    assert.equal(environment.observerInstances[0].disconnectCount, 1);
    assert.equal(environment.controller.instance, null);
    assert.equal(environment.controller.watchedItems.length, 0);
    assert.equal(environment.listenerCount('resize'), 0);
    assert.equal(image.listenerCount('load'), 0);
    assert.equal(image.listenerCount('error'), 0);
});

test('Masonry follows both directions across the mobile breakpoint', () => {
    const environment = loadMasonryEnvironment({ indexStyle: 0, innerWidth: 767 });
    const element = environment.createElement('p-3');

    environment.elements.push(element);
    environment.controller.init();

    assert.equal(environment.masonryInstances.length, 0);
    assert.equal(environment.listenerCount('resize'), 1);
    assert.equal(element.classes.has('masonry-ready'), false);

    environment.window.innerWidth = 768;
    environment.dispatchWindowEvent('resize');
    environment.dispatchWindowEvent('resize');

    assert.equal(environment.masonryInstances.length, 1);
    assert.equal(environment.masonryInstances[0].options.itemSelector, '.masonry-item');
    assert.equal(environment.controller.active, true);
    assert.equal(environment.masonryContainer.classes.has('masonry'), true);
    assert.equal(element.classes.has('masonry-ready'), true);
    assert.equal(element.style.position, 'absolute');

    environment.window.innerWidth = 767;
    environment.dispatchWindowEvent('resize');

    assert.equal(environment.masonryInstances[0].destroyCount, 1);
    assert.equal(environment.controller.active, false);
    assert.equal(environment.masonryContainer.classes.has('masonry'), false);
    assert.equal(element.classes.has('masonry-ready'), false);
    assert.equal(element.style.position, undefined);

    environment.window.innerWidth = 768;
    environment.dispatchWindowEvent('resize');

    assert.equal(environment.masonryInstances.length, 2);
    assert.equal(environment.masonryInstances[1].options.itemSelector, '.masonry-item');
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

    assert.equal(environment.masonryInstances.length, 1);
    assert.equal(environment.masonryInstances[0].destroyCount, 1);
    assert.equal(environment.listenerCount('resize'), 0);
    assert.equal(environment.observerInstances[0].disconnectCount, 1);
    assert.equal(environment.controller.active, false);

    environment.elements[0] = replacementElement;
    environment.replaceContainer();
    environment.controller.init();

    assert.equal(environment.masonryInstances.length, 2);
    assert.equal(environment.listenerCount('resize'), 1);
    assert.equal(environment.observerInstances.length, 2);
    assert.equal(environment.controller.watchedItems.length, 1);
    assert.equal(environment.controller.watchedItems[0].element, replacementElement);
    assert.equal(environment.controller.active, true);
});

test('observed size changes are coalesced and only relayout an active desktop grid', () => {
    const environment = loadMasonryEnvironment({ indexStyle: 0 });
    const element = environment.createElement('p-5');

    environment.elements.push(element);
    environment.controller.init();
    assert.equal(environment.masonryInstances[0].layoutCount, 1);

    environment.triggerResize(element);
    environment.triggerResize(element);
    assert.equal(environment.frameCount(), 1);
    environment.flushFrames();
    assert.equal(environment.masonryInstances[0].layoutCount, 2);

    environment.window.innerWidth = 767;
    environment.dispatchWindowEvent('resize');
    environment.triggerResize(element);
    environment.flushFrames();
    assert.equal(environment.masonryInstances[0].layoutCount, 2);
});

test('image load and error relayout once and teardown cancels stale work', () => {
    const environment = loadMasonryEnvironment({ withoutResizeObserver: true });
    const firstImage = environment.createImage();
    const secondImage = environment.createImage();
    const element = environment.createElement('p-6', [firstImage, secondImage]);

    environment.elements.push(element);
    environment.controller.init();

    assert.equal(environment.observerInstances.length, 0);
    assert.equal(firstImage.listenerCount('load'), 1);
    assert.equal(secondImage.listenerCount('error'), 1);

    firstImage.dispatch('load');
    secondImage.dispatch('error');
    assert.equal(environment.frameCount(), 1);
    assert.equal(firstImage.listenerCount('error'), 0);
    assert.equal(secondImage.listenerCount('load'), 0);

    environment.controller.destroy();

    assert.equal(environment.frameCount(), 0);
    assert.equal(environment.cancelledFrames.length, 1);
    assert.equal(environment.masonryInstances[0].layoutCount, 1);
    firstImage.dispatch('load');
    secondImage.dispatch('error');
    environment.flushFrames();
    assert.equal(environment.masonryInstances[0].layoutCount, 1);
});

test('window resize is the controlled fallback without ResizeObserver', () => {
    const environment = loadMasonryEnvironment({ withoutResizeObserver: true });
    const element = environment.createElement('p-7');

    environment.elements.push(element);
    environment.controller.init();
    environment.dispatchWindowEvent('resize');
    environment.dispatchWindowEvent('resize');

    assert.equal(environment.frameCount(), 1);
    environment.flushFrames();
    assert.equal(environment.masonryInstances[0].layoutCount, 2);
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

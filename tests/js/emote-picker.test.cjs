const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function loadHelpers(storage) {
    function Element() {}
    const context = {
        window: {
            localStorage: storage,
            navigator: {},
            matchMedia: () => ({ matches: false })
        },
        document: {
            querySelector: () => null
        },
        Element
    };
    context.window.window = context.window;
    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/libs/emotes/emote-picker.js'), 'utf8'),
        context
    );
    return context.window.VoidEmotes.__test;
}

function loadPickerEnvironment(windowOverrides = {}) {
    let document;
    const windowListeners = new Map();

    class ClassList {
        constructor(element) {
            this.element = element;
        }

        values() {
            return this.element.className.split(/\s+/).filter(Boolean);
        }

        write(values) {
            this.element.className = [...new Set(values)].join(' ');
        }

        add(...names) {
            this.write(this.values().concat(names));
        }

        remove(...names) {
            this.write(this.values().filter((name) => !names.includes(name)));
        }

        contains(name) {
            return this.values().includes(name);
        }

        toggle(name, force) {
            const enabled = force === undefined ? !this.contains(name) : force;
            if (enabled) {
                this.add(name);
            } else {
                this.remove(name);
            }
            return enabled;
        }
    }

    class Element {
        constructor(tagName = 'div') {
            this.tagName = tagName.toUpperCase();
            this.children = [];
            this.parentNode = null;
            this.attributes = new Map();
            this.listeners = new Map();
            this.className = '';
            this.classList = new ClassList(this);
            this.style = {};
            this.hidden = false;
            this.value = '';
            this.selectionStart = 0;
            this.selectionEnd = 0;
            this.scrollTop = 0;
            this._textContent = '';
        }

        appendChild(child) {
            if (child.tagName === '#FRAGMENT') {
                child.children.slice().forEach((fragmentChild) => this.appendChild(fragmentChild));
                child.children = [];
                return child;
            }
            child.parentNode = this;
            this.children.push(child);
            return child;
        }

        removeChild(child) {
            this.children.splice(this.children.indexOf(child), 1);
            child.parentNode = null;
            return child;
        }

        setAttribute(name, value) {
            this.attributes.set(name, String(value));
        }

        getAttribute(name) {
            return this.attributes.has(name) ? this.attributes.get(name) : null;
        }

        addEventListener(name, listener) {
            const listeners = this.listeners.get(name) || [];
            listeners.push(listener);
            this.listeners.set(name, listeners);
        }

        removeEventListener(name, listener) {
            const listeners = this.listeners.get(name) || [];
            this.listeners.set(name, listeners.filter((candidate) => candidate !== listener));
        }

        dispatchEvent(event) {
            event.target = event.target || this;
            event.preventDefault = event.preventDefault || function () {};
            (this.listeners.get(event.type) || []).slice().forEach((listener) => listener(event));
        }

        click() {
            this.dispatchEvent({ type: 'click' });
        }

        querySelectorAll() {
            return [];
        }

        contains(candidate) {
            while (candidate) {
                if (candidate === this) {
                    return true;
                }
                candidate = candidate.parentNode;
            }
            return false;
        }

        get textContent() {
            return this._textContent;
        }

        set textContent(value) {
            this._textContent = String(value);
            this.children.forEach((child) => { child.parentNode = null; });
            this.children = [];
        }

        setSelectionRange(start, end) {
            this.selectionStart = start;
            this.selectionEnd = end;
        }

        focus() {
            document.activeElement = this;
        }

        blur() {
            if (document.activeElement === this) {
                document.activeElement = null;
            }
        }

    }

    document = {
        activeElement: null,
        querySelector: () => null,
        createElement: (tagName) => new Element(tagName),
        createElementNS: (_, tagName) => new Element(tagName),
        createDocumentFragment: () => new Element('#fragment')
    };
    const window = {
        localStorage: null,
        navigator: {},
        innerWidth: 1024,
        innerHeight: 768,
        matchMedia: () => ({ matches: false }),
        addEventListener: (name, listener) => {
            const listeners = windowListeners.get(name) || [];
            listeners.push(listener);
            windowListeners.set(name, listeners);
        },
        removeEventListener: (name, listener) => {
            const listeners = windowListeners.get(name) || [];
            windowListeners.set(name, listeners.filter((candidate) => candidate !== listener));
        },
        dispatchEvent: (event) => {
            (windowListeners.get(event.type) || []).slice().forEach((listener) => listener(event));
        },
        ...windowOverrides
    };
    window.window = window;

    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/libs/emotes/emote-picker.js'), 'utf8'),
        { window, document, Element }
    );

    return { window, document, Element };
}

test('insertIntoText inserts at the caret', () => {
    const result = loadHelpers(null).insertIntoText('前后', 1, 1, ':bgm(053)');
    assert.deepEqual(
        JSON.parse(JSON.stringify(result)),
        { value: '前 :bgm(053) 后', start: 12, end: 12 }
    );
});

test('insertIntoText replaces the selected text', () => {
    const result = loadHelpers(null).insertIntoText('前旧内容后', 1, 4, ':@(高兴)');
    assert.equal(result.value, '前 :@(高兴) 后');
    assert.equal(result.start, result.value.length - 1);
    assert.equal(result.end, result.start);
});

test('manifest paths resolve inside their package directory', () => {
    const { packAssetPath } = loadHelpers(null);
    assert.equal(packAssetPath('bangumi', 'poster/053.webp'), 'bangumi/poster/053.webp');
    assert.equal(packAssetPath('bangumi', 'animated/053.gif'), 'bangumi/animated/053.gif');
    assert.equal(packAssetPath('quyin', 'peek.png'), 'quyin/peek.png');
    assert.equal(packAssetPath('bilibili', 'first.png'), 'bilibili/first.png');
    assert.equal(packAssetPath('mihoyo', 'butterfly.png'), 'mihoyo/butterfly.png');
    assert.equal(packAssetPath('aru', 'happy.png'), 'aru/happy.png');
    assert.equal(packAssetPath('bangumi', '../outside.gif'), '');
    assert.equal(packAssetPath('aru', '/usr/themes/VOID/assets/aru.png'), '');
    assert.equal(packAssetPath('../aru', 'happy.png'), '');
});

test('Bangumi tiles render package-relative poster and animated URLs', () => {
    const { window, Element } = loadPickerEnvironment({
        VOIDEmotesConfig: { baseUrl: '/assets/libs/emotes/' }
    });
    const item = {
        id: '001',
        label: '通知 提示 Bits',
        token: ':bgm(001)',
        poster: 'poster/001.webp',
        animated: 'animated/001.gif',
        width: 240,
        height: 240
    };
    const container = new Element('div');
    const target = new Element('textarea');
    const picker = window.VoidEmotes.mount({ container, target, mode: 'inline' });

    picker.currentPack = 'bangumi';
    picker.renderItems([item]);

    const directButton = picker.grid.children[0];
    const directImage = directButton.children[0];
    assert.equal(directButton.getAttribute('data-pack'), 'bangumi');
    assert.equal(directImage.getAttribute('data-poster-src'), '/assets/libs/emotes/bangumi/poster/001.webp');
    assert.equal(directImage.getAttribute('data-animated-src'), '/assets/libs/emotes/bangumi/animated/001.gif');

    picker.currentPack = 'recent';
    picker.renderItems([{ ...item, pack: 'bangumi' }]);

    const recentImage = picker.grid.children[0].children[0];
    assert.equal(recentImage.getAttribute('data-poster-src'), '/assets/libs/emotes/bangumi/poster/001.webp');
    assert.equal(recentImage.getAttribute('data-animated-src'), '/assets/libs/emotes/bangumi/animated/001.gif');
});

test('static image tiles render package-relative URLs directly and from recent items', () => {
    const { window, Element } = loadPickerEnvironment({
        VOIDEmotesConfig: { baseUrl: '/assets/libs/emotes/' }
    });
    const item = {
        id: '001',
        label: '高兴',
        token: ':@(高兴)',
        src: 'happy.png'
    };
    const picker = window.VoidEmotes.mount({
        container: new Element('div'),
        target: new Element('textarea'),
        mode: 'inline'
    });

    picker.currentPack = 'aru';
    picker.renderItems([item]);
    assert.equal(
        picker.grid.children[0].children[0].getAttribute('data-poster-src'),
        '/assets/libs/emotes/aru/happy.png'
    );

    picker.currentPack = 'recent';
    picker.renderItems([{ ...item, pack: 'aru' }]);
    assert.equal(
        picker.grid.children[0].children[0].getAttribute('data-poster-src'),
        '/assets/libs/emotes/aru/happy.png'
    );
});

test('restored Mihoyo emote is appended without shifting published IDs', () => {
    const manifest = JSON.parse(fs.readFileSync(
        path.resolve(__dirname, '../../assets/libs/emotes/packs/mihoyo.json'),
        'utf8'
    ));
    const tokensById = Object.fromEntries(manifest.items.map((item) => [item.id, item.token]));

    assert.equal(tokensById['001'], ':!(遐蝶_蝴蝶)');
    assert.equal(tokensById['030'], ':!(崩坏3_打架)');
    assert.equal(tokensById['031'], ':!(崩坏3_灵光一现)');
    assert.equal(tokensById['060'], ':!(原神_晚安)');
    assert.equal(tokensById['061'], ':!(崩坏3_点赞)');
});

test('navigation renders full-width text icons and a real history symbol', () => {
    const { window, Element } = loadPickerEnvironment();
    const picker = window.VoidEmotes.mount({
        container: new Element('div'),
        target: new Element('textarea'),
        mode: 'inline'
    });

    const kaomoji = picker.createIcon({ text: 'OωO' }, 'void-emotes-tab__icon');
    assert.equal(kaomoji.textContent, 'OωO');
    assert.equal(kaomoji.classList.contains('void-emotes-icon--text'), true);

    const history = picker.createIcon({ symbol: 'history' }, 'void-emotes-tab__icon');
    assert.equal(history.classList.contains('void-emotes-icon--svg'), true);
    assert.equal(history.children[0].tagName, 'SVG');
    assert.equal(history.children[0].getAttribute('viewBox'), '0 0 24 24');
    assert.equal(history.children[0].children.length, 3);
});

test('emoticon headers omit the duplicate text icon and restore image pack icons', () => {
    const { window, Element } = loadPickerEnvironment({
        VOIDEmotesConfig: { baseUrl: '/assets/libs/emotes/' }
    });
    const picker = window.VoidEmotes.mount({
        container: new Element('div'),
        target: new Element('textarea'),
        mode: 'inline'
    });

    picker.updateHeader({
        id: 'kaomoji',
        label: '颜文字',
        type: 'emoticon',
        count: 54,
        icon: { text: 'OωO' }
    }, 54);
    assert.equal(picker.header.classList.contains('void-emotes-header--without-icon'), true);
    assert.equal(picker.headerIcon.hidden, true);
    assert.equal(picker.headerIcon.children.length, 0);
    assert.equal(picker.headerTitle.textContent, '颜文字');
    assert.equal(picker.headerCount.textContent, '54 个');

    picker.updateHeader({
        id: 'aru',
        label: '阿鲁',
        type: 'image',
        count: 62,
        icon: { poster: 'aru/happy.png' }
    }, 62);
    assert.equal(picker.header.classList.contains('void-emotes-header--without-icon'), false);
    assert.equal(picker.headerIcon.hidden, false);
    assert.equal(picker.headerIcon.children.length, 1);
    assert.equal(picker.headerIcon.children[0].classList.contains('void-emotes-icon--image'), true);
});

test('emoticons and mixed recent entries use the wide text grid', () => {
    const { window, Element } = loadPickerEnvironment();
    const picker = window.VoidEmotes.mount({
        container: new Element('div'),
        target: new Element('textarea'),
        mode: 'inline'
    });
    const kaomoji = {
        id: '021',
        label: '去吧大师球',
        value: '(╯°A°)╯︵○○○'
    };
    const image = {
        id: '001',
        label: '高兴',
        token: ':@(高兴)',
        src: 'happy.png'
    };

    picker.index = {
        tabs: [
            { id: 'recent', type: 'virtual' },
            { id: 'kaomoji', type: 'emoticon' },
            { id: 'aru', type: 'image' }
        ]
    };

    picker.currentPack = 'kaomoji';
    picker.renderItems([kaomoji]);
    assert.equal(picker.grid.classList.contains('void-emotes-grid--emoticon'), true);
    assert.equal(picker.grid.children[0].children[0].textContent, kaomoji.value);

    picker.currentPack = 'aru';
    picker.renderItems([image]);
    assert.equal(picker.grid.classList.contains('void-emotes-grid--emoticon'), false);

    picker.currentPack = 'recent';
    picker.renderItems([{ ...image, pack: 'aru' }, { ...kaomoji, pack: 'kaomoji' }]);
    assert.equal(picker.grid.classList.contains('void-emotes-grid--emoticon'), true);

    picker.renderItems([{ ...image, pack: 'aru' }]);
    assert.equal(picker.grid.classList.contains('void-emotes-grid--emoticon'), false);
});

test('keyboard navigation follows the measured columns in the wide text grid', () => {
    const { window, document, Element } = loadPickerEnvironment();
    const picker = window.VoidEmotes.mount({
        container: new Element('div'),
        target: new Element('textarea'),
        mode: 'inline'
    });
    const items = Array.from({ length: 6 }, (_, index) => ({
        id: String(index + 1).padStart(3, '0'),
        label: `颜文字 ${index + 1}`,
        value: `(${index + 1})`
    }));
    let prevented = false;

    picker.currentPack = 'kaomoji';
    picker.renderItems(items);
    picker.tileButtons.forEach((button, index) => {
        button.offsetTop = Math.floor(index / 2) * 56;
    });

    picker.tileButtons[1].focus();
    picker.handleGridKeydown({
        key: 'ArrowDown',
        preventDefault: () => { prevented = true; }
    });
    assert.equal(prevented, true);
    assert.equal(document.activeElement, picker.tileButtons[3]);

    picker.handleGridKeydown({ key: 'ArrowUp', preventDefault: () => {} });
    assert.equal(document.activeElement, picker.tileButtons[1]);

    picker.handleGridKeydown({ key: 'ArrowRight', preventDefault: () => {} });
    assert.equal(document.activeElement, picker.tileButtons[2]);
});

test('emoticon CSS keeps wide tiles on a single line', () => {
    const css = fs.readFileSync(
        path.resolve(__dirname, '../../assets/libs/emotes/emote-picker.css'),
        'utf8'
    );

    assert.match(css, /\.void-emotes-grid\.void-emotes-grid--emoticon\s*\{[^}]*minmax\(156px, 1fr\)[^}]*grid-auto-rows:\s*56px/s);
    assert.match(css, /\.void-emotes-grid--emoticon \.void-emotes-tile--text span\s*\{[^}]*line-height:\s*1\.35[^}]*overflow-wrap:\s*normal[^}]*white-space:\s*nowrap/s);
});

test('recent entries are deduplicated by pack and id and capped at 20', () => {
    const stored = new Map();
    const storage = {
        getItem: (key) => stored.get(key) || null,
        setItem: (key, value) => stored.set(key, value)
    };
    const RecentStore = loadHelpers(storage).RecentStore;
    const recent = new RecentStore(storage);

    for (let index = 0; index < 22; index++) {
        recent.add(index % 2 ? 'aru' : 'bangumi', String(index));
    }
    recent.add('bangumi', '20');

    const entries = recent.read();
    assert.equal(entries.length, 20);
    assert.deepEqual(JSON.parse(JSON.stringify(entries[0])), { pack: 'bangumi', id: '20' });
    assert.equal(entries.filter((entry) => entry.pack === 'bangumi' && entry.id === '20').length, 1);
});

test('recent storage falls back to page memory when localStorage throws', () => {
    const storage = {
        getItem: () => { throw new Error('disabled'); },
        setItem: () => { throw new Error('disabled'); }
    };
    const RecentStore = loadHelpers(storage).RecentStore;
    const recent = new RecentStore(storage);
    recent.add('bangumi', '053');
    assert.deepEqual(JSON.parse(JSON.stringify(recent.read())), [{ pack: 'bangumi', id: '053' }]);
});

test('picker mount is idempotent and can remount after PJAX destruction', () => {
    const { window, Element } = loadPickerEnvironment();
    const container = new Element('div');
    const target = new Element('textarea');

    const first = window.VoidEmotes.mount({ container, target, mode: 'inline' });
    assert.ok(first);
    assert.equal(window.VoidEmotes.mount({ container, target, mode: 'inline' }), first);
    assert.equal(container.children.length, 2);
    assert.equal(first.panel.children[0].tagName, 'DIV');

    first.destroy();
    assert.equal(container.children.length, 0);
    assert.equal(container.__voidEmotesInstance, null);

    const second = window.VoidEmotes.mount({ container, target, mode: 'inline' });
    assert.ok(second);
    assert.notEqual(second, first);
    assert.equal(container.children.length, 2);
});

test('default trigger mode keeps component-owned click and ARIA behavior', () => {
    const { window, Element } = loadPickerEnvironment();
    const container = new Element('div');
    const target = new Element('textarea');
    const trigger = new Element('button');
    const picker = window.VoidEmotes.mount({ container, target, trigger, mode: 'inline' });

    picker.index = { defaultPack: 'recent', tabs: [] };
    picker.selectPack = function () {};
    assert.equal((trigger.listeners.get('click') || []).length, 1);
    assert.equal(trigger.getAttribute('aria-controls'), picker.panel.id);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');

    trigger.click();
    assert.equal(picker.isOpen, true);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    trigger.click();
    assert.equal(picker.isOpen, false);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
});

test('manual trigger mode preserves caller ARIA and reports open and close state', () => {
    const { window, document, Element } = loadPickerEnvironment();
    const container = new Element('div');
    const target = new Element('textarea');
    const trigger = new Element('button');
    const states = [];
    trigger.setAttribute('aria-label', '插入 VOID 扩展语法');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-controls', 'void-editor-menu');
    trigger.setAttribute('aria-expanded', 'false');
    const picker = window.VoidEmotes.mount({
        container,
        target,
        trigger,
        mode: 'inline',
        manualTrigger: true,
        onOpen: (instance) => states.push(['open', instance]),
        onClose: (instance) => states.push(['close', instance])
    });

    picker.index = { defaultPack: 'recent', tabs: [] };
    picker.selectPack = function () {};
    assert.equal((trigger.listeners.get('click') || []).length, 0);
    assert.equal(trigger.getAttribute('aria-controls'), 'void-editor-menu');
    assert.equal(trigger.getAttribute('aria-label'), '插入 VOID 扩展语法');

    trigger.click();
    assert.equal(picker.isOpen, false);
    picker.open();
    assert.equal(picker.isOpen, true);
    assert.deepEqual(states[0], ['open', picker]);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(trigger.getAttribute('aria-controls'), 'void-editor-menu');

    picker.closeButton.click();
    assert.equal(picker.isOpen, false);
    assert.deepEqual(states[1], ['close', picker]);
    assert.equal(document.activeElement, trigger);
    assert.equal(trigger.getAttribute('aria-label'), '插入 VOID 扩展语法');
});

test('manual popover uses the shared trigger for positioning and Escape focus restoration', () => {
    const { window, document, Element } = loadPickerEnvironment();
    const container = new Element('div');
    const target = new Element('textarea');
    const trigger = new Element('button');
    let closed = 0;
    trigger.getBoundingClientRect = () => ({ top: 100, right: 172, bottom: 126, left: 118 });
    const picker = window.VoidEmotes.mount({
        container,
        target,
        trigger,
        mode: 'popover',
        manualTrigger: true,
        onClose: () => { closed++; }
    });
    picker.index = { defaultPack: 'recent', tabs: [] };
    picker.selectPack = function () {};

    picker.open();
    assert.equal(container.style.left, '118px');
    assert.equal(container.style.top, '134px');
    assert.equal(container.style.width, '420px');

    window.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault() {} });
    assert.equal(picker.isOpen, false);
    assert.equal(closed, 1);
    assert.equal(document.activeElement, trigger);

    picker.destroy();
    assert.equal(picker.listeners.length, 0);
    assert.equal(container.__voidEmotesInstance, null);
});

test('Escape closes an open picker even when focus is outside the panel', () => {
    const { window, document, Element } = loadPickerEnvironment();
    const container = new Element('div');
    const target = new Element('textarea');
    const picker = window.VoidEmotes.mount({ container, target, mode: 'inline' });
    let prevented = false;

    picker.isOpen = true;
    picker.panel.hidden = false;
    window.dispatchEvent({
        type: 'keydown',
        key: 'Escape',
        preventDefault: () => { prevented = true; }
    });

    assert.equal(prevented, true);
    assert.equal(picker.isOpen, false);
    assert.equal(picker.panel.hidden, true);
    assert.equal(document.activeElement, picker.trigger);
});

test('batch rendering uses delegated clicks without retaining old tiles', () => {
    const { window, Element } = loadPickerEnvironment();
    const container = new Element('div');
    const target = new Element('textarea');
    const picker = window.VoidEmotes.mount({ container, target, mode: 'inline' });
    const listenerCount = picker.listeners.length;
    const items = Array.from({ length: 40 }, (_, index) => ({
        id: String(index + 1),
        label: `表情 ${index + 1}`,
        value: `(${index + 1})`
    }));

    picker.currentPack = 'kaomoji';
    picker.renderItems(items);
    assert.equal(picker.tileButtons.length, 32);
    assert.equal(picker.listeners.length, listenerCount);

    picker.renderMore();
    assert.equal(picker.tileButtons.length, 40);
    assert.equal(picker.listeners.length, listenerCount);

    picker.renderItems(items);
    assert.equal(picker.tileButtons.length, 32);
    assert.equal(picker.listeners.length, listenerCount);
});

test('closing invalidates a pending manifest render', async () => {
    const { window, Element } = loadPickerEnvironment();
    const picker = window.VoidEmotes.mount({
        container: new Element('div'),
        target: new Element('textarea'),
        mode: 'inline'
    });
    let resolveManifest;

    picker.index = {
        tabs: [{ id: 'bangumi', label: 'Bangumi 娘', count: 1, manifest: 'packs/bangumi.json' }]
    };
    picker.isOpen = true;
    picker.panel.hidden = false;
    picker.fetchJson = () => new Promise((resolve) => { resolveManifest = resolve; });

    const pending = picker.selectPack('bangumi');
    picker.close();
    resolveManifest({ items: [{ id: '053', label: '爱心 3', token: ':bgm(053)' }] });
    await pending;

    assert.equal(picker.panel.hidden, true);
    assert.equal(picker.currentItems.length, 0);
    assert.equal(picker.animationController, null);
});

function createAnimatedImage(Element, controller, id) {
    const image = new Element('img');
    image.src = `/poster/${id}.webp`;
    image.setAttribute('src', image.src);
    image.setAttribute('data-poster-src', image.src);
    image.setAttribute('data-animated-src', `/animated/${id}.gif`);
    controller.observe(image);
    return image;
}

test('animation loading is globally capped across controllers', () => {
    const loaders = [];
    const observers = [];

    class Loader {
        constructor() {
            loaders.push(this);
        }

        set src(value) {
            this.currentSrc = value;
        }

        get src() {
            return this.currentSrc;
        }
    }

    class IntersectionObserver {
        constructor(callback, options) {
            this.callback = callback;
            this.options = options;
            observers.push(this);
        }

        observe() {}
        disconnect() {}
    }

    const { window, Element } = loadPickerEnvironment({ Image: Loader, IntersectionObserver });
    const firstRoot = new Element('div');
    const secondRoot = new Element('div');
    const AnimatedImages = window.VoidEmotes.__test.AnimatedImages;
    const first = new AnimatedImages(firstRoot);
    const second = new AnimatedImages(secondRoot);
    const firstImages = Array.from({ length: 3 }, (_, index) =>
        createAnimatedImage(Element, first, `first-${index}`));
    const secondImages = Array.from({ length: 3 }, (_, index) =>
        createAnimatedImage(Element, second, `second-${index}`));

    first.handleEntries(firstImages.map((image) => ({ target: image, isIntersecting: true })));
    second.handleEntries(secondImages.map((image) => ({ target: image, isIntersecting: true })));

    assert.equal(loaders.length, 4);
    assert.equal(first.active + second.active, 4);
    assert.equal(first.active, 3);
    assert.equal(second.active, 1);
    assert.equal(observers[0].options.root, firstRoot);
    assert.equal(observers[1].options.root, secondRoot);

    first.handleEntries([{ target: firstImages[0], isIntersecting: false }]);
    first.handleEntries([{ target: firstImages[0], isIntersecting: true }]);
    assert.equal(first.tasks.filter((task) => task.image === firstImages[0]).length, 1);
    assert.equal(loaders.length, 4);

    loaders[0].onload();
    assert.equal(loaders.length, 5);
    assert.equal(first.active + second.active, 4);
});

test('destroying one animation controller releases global slots', () => {
    const loaders = [];

    class Loader {
        constructor() {
            loaders.push(this);
        }

        set src(value) {
            this.currentSrc = value;
        }

        get src() {
            return this.currentSrc;
        }
    }

    class IntersectionObserver {
        observe() {}
        disconnect() {}
    }

    const { window, Element } = loadPickerEnvironment({ Image: Loader, IntersectionObserver });
    const AnimatedImages = window.VoidEmotes.__test.AnimatedImages;
    const blocking = new AnimatedImages(new Element('div'));
    const waiting = new AnimatedImages(new Element('div'));
    const blockingImages = Array.from({ length: 6 }, (_, index) =>
        createAnimatedImage(Element, blocking, `blocking-${index}`));
    const waitingImages = Array.from({ length: 2 }, (_, index) =>
        createAnimatedImage(Element, waiting, `waiting-${index}`));

    blocking.handleEntries(blockingImages.map((image) => ({ target: image, isIntersecting: true })));
    waiting.handleEntries(waitingImages.map((image) => ({ target: image, isIntersecting: true })));
    assert.equal(loaders.length, 4);
    assert.equal(blocking.active, 4);
    assert.equal(waiting.active, 0);

    blocking.destroy();

    assert.equal(blocking.active, 0);
    assert.equal(blocking.tasks.length, 0);
    assert.equal(waiting.active, 2);
    assert.equal(loaders.length, 6);
    assert.equal(loaders.slice(0, 4).every((loader) => loader.onload === null), true);
    assert.equal(waitingImages.every((image) =>
        image.getAttribute('data-void-emote-animation') === 'loading'), true);
});

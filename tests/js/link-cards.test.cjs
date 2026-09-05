const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { readVoidSource } = require('./helpers/void-source.cjs');

class FakeClassList {
    constructor(element) {
        this.element = element;
    }

    add(name) {
        const names = this.element.className ? this.element.className.split(/\s+/) : [];
        if (!names.includes(name)) {
            names.push(name);
            this.element.className = names.join(' ');
        }
    }

    contains(name) {
        return this.element.className.split(/\s+/).includes(name);
    }

    remove(name) {
        this.element.className = this.element.className
            .split(/\s+/)
            .filter((candidate) => candidate && candidate !== name)
            .join(' ');
    }
}

class FakeNode {
    constructor(tagName = '', text = '') {
        this.attributes = new Map();
        this.children = [];
        this.className = '';
        this.classList = new FakeClassList(this);
        this.listeners = new Map();
        this.parentNode = null;
        this.tagName = tagName.toUpperCase();
        this.value = text;
    }

    get firstChild() {
        return this.children[0] || null;
    }

    get textContent() {
        if (!this.tagName) {
            return this.value;
        }
        return this.children.map((child) => child.textContent).join('');
    }

    addEventListener(name, listener) {
        this.listeners.set(name, listener);
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.children = child.parentNode.children.filter((candidate) => candidate !== child);
        }
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    dispatch(name) {
        const listener = this.listeners.get(name);
        if (listener) {
            listener.call(this);
        }
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    querySelector(selector) {
        const matches = (node) => {
            if (selector === 'img') {
                return node.tagName === 'IMG';
            }
            if (selector.charAt(0) === '.') {
                return node.className.split(/\s+/).includes(selector.slice(1));
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

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'src') {
            this.connectedWhenSrcAssigned = Boolean(this.parentNode);
        }
    }
}

function createCard(name = 'Velas电波站') {
    const card = new FakeNode('a');
    const thumb = new FakeNode('div');
    const title = new FakeNode('div');
    thumb.className = 'board-thumb';
    thumb.setAttribute('data-thumb', 'https://example.test/avatar.png');
    title.className = 'board-title';
    title.appendChild(new FakeNode('', name));
    card.appendChild(thumb);
    card.appendChild(title);
    return { card, thumb, title };
}

function loadVoid(card, config, options = {}) {
    let animationFrames = [];
    const document = {
        readyState: 'loading',
        addEventListener() {},
        createElement(tagName) {
            return new FakeNode(tagName);
        },
        querySelectorAll(selector) {
            return selector === '.board-thumb' ? [card.thumb] : [];
        }
    };
    const window = {
        clearTimeout() {},
        matchMedia() {
            return { matches: Boolean(options.reducedMotion) };
        },
        requestAnimationFrame(callback) {
            animationFrames.push(callback);
        },
        setInterval() {},
        setTimeout() {}
    };
    window.window = window;

    const context = {
        VOIDConfig: config,
        console: { error() {}, log() {} },
        document,
        window
    };

    vm.runInNewContext(
        readVoidSource(),
        context
    );

    return {
        content: context.VOID_Content,
        runAnimationFrame() {
            const callbacks = animationFrames;
            animationFrames = [];
            callbacks.forEach((callback) => callback());
        }
    };
}

test('friend cards render native lazy images and initialize only once', () => {
    const card = createCard();
    const { content } = loadVoid(card, { lazyload: true });

    content.parseBoardThumbs();
    content.parseBoardThumbs();

    const image = card.thumb.querySelector('img');
    assert.equal(card.thumb.getAttribute('data-fallback'), 'V');
    assert.equal(image.getAttribute('src'), 'https://example.test/avatar.png');
    assert.equal(image.getAttribute('loading'), 'lazy');
    assert.equal(image.getAttribute('data-src'), null);
    assert.equal(image.className, 'loading');
    assert.equal(image.getAttribute('alt'), '');
    assert.equal(image.connectedWhenSrcAssigned, true);
    assert.equal(card.thumb.children.filter((child) => child.tagName === 'IMG').length, 1);
    assert.equal(card.title.querySelector('.board-title-text').textContent, 'Velas电波站');
});

test('native lazy friend cards fade in after decoding and two animation frames', async () => {
    const card = createCard();
    const runtime = loadVoid(card, { lazyload: true });

    runtime.content.parseBoardThumbs();

    const image = card.thumb.querySelector('img');
    image.decode = () => Promise.resolve();
    image.dispatch('load');
    await Promise.resolve();

    assert.match(image.className, /\bloading\b/);
    runtime.runAnimationFrame();
    assert.match(image.className, /\bloading\b/);
    runtime.runAnimationFrame();
    assert.doesNotMatch(image.className, /\bloading\b/);
    assert.match(image.className, /\bloaded\b/);
});

test('reduced motion reveals decoded friend cards without animation frames', async () => {
    const card = createCard();
    const runtime = loadVoid(card, { lazyload: true }, { reducedMotion: true });

    runtime.content.parseBoardThumbs();

    const image = card.thumb.querySelector('img');
    image.decode = () => Promise.resolve();
    image.dispatch('load');
    await Promise.resolve();

    assert.doesNotMatch(image.className, /\bloading\b/);
    assert.match(image.className, /\bloaded\b/);
});

test('detached friend cards ignore late decode completion', async () => {
    const card = createCard();
    const runtime = loadVoid(card, { lazyload: true });
    let resolveDecode;

    runtime.content.parseBoardThumbs();

    const image = card.thumb.querySelector('img');
    image.decode = () => new Promise((resolve) => {
        resolveDecode = resolve;
    });
    image.dispatch('load');
    image.isConnected = false;
    resolveDecode();
    await Promise.resolve();
    runtime.runAnimationFrame();
    runtime.runAnimationFrame();

    assert.match(image.className, /\bloading\b/);
    assert.doesNotMatch(image.className, /\bloaded\b/);
});

test('native lazy friend cards expose image failures', () => {
    const card = createCard('秋枫微凉');
    const { content } = loadVoid(card, { lazyload: true });

    content.parseBoardThumbs();

    const image = card.thumb.querySelector('img');
    assert.equal(image.getAttribute('src'), 'https://example.test/avatar.png');
    assert.equal(image.getAttribute('loading'), 'lazy');
    image.dispatch('error');
    assert.doesNotMatch(image.className, /\bloading\b/);
    assert.doesNotMatch(image.className, /\bloaded\b/);
    assert.match(image.className, /\berror\b/);
    assert.match(card.thumb.className, /\berror\b/);
});

test('friend cards load immediately when lazy loading is disabled', () => {
    const card = createCard('9bie');
    const { content } = loadVoid(card, { lazyload: false });

    content.parseBoardThumbs();

    const image = card.thumb.querySelector('img');
    assert.equal(image.getAttribute('src'), 'https://example.test/avatar.png');
    assert.equal(image.getAttribute('loading'), null);
    assert.equal(image.getAttribute('data-src'), null);
    assert.equal(image.className, '');
});

test('friend card source includes the dark surface and two-line title contract', () => {
    const styles = fs.readFileSync(path.resolve(__dirname, '../../assets/parts/_article.scss'), 'utf8');
    const lazyload = fs.readFileSync(path.resolve(__dirname, '../../assets/header.js'), 'utf8');

    assert.match(styles, /\.theme-dark & \{\s*background: \$td-bgColor-light;/);
    assert.match(styles, /-webkit-line-clamp: 2;/);
    assert.match(styles, /&\.error::before \{\s*display: flex;/);
    assert.match(styles, /&\.loading \{\s*opacity: 0;/);
    assert.match(styles, /&\.loaded \{\s*opacity: 1;/);
    assert.equal((lazyload.match(/parentElement\.classList\.add\('error'\)/g) || []).length, 1);
    assert.doesNotMatch(lazyload, /\.parent\(\)\.addClass\('error'\)/);
});

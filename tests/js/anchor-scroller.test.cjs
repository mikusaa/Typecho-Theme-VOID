const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const headerSource = fs.readFileSync(path.resolve(__dirname, '../../assets/header.js'), 'utf8');
const voidSource = fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.js'), 'utf8');
const scrollerStart = headerSource.indexOf('VOID_SmoothScroller = {');
const scrollerEnd = headerSource.indexOf('\n\nVOID_ControllerPanel = {', scrollerStart);

assert.notEqual(scrollerStart, -1, 'smooth scroller source should exist');
assert.notEqual(scrollerEnd, -1, 'anchor scroller source should have a stable boundary');

test('TOC links enable delayed-layout stabilization', () => {
    assert.match(
        voidSource,
        /scrollToWithHeader\(\$\(this\)\.attr\('href'\), 0, \{\s*behavior: 'smooth',\s*stabilize: true\s*\}\)/
    );
});

function createEnvironment(options = {}) {
    const listeners = new Map();
    const frames = new Map();
    const timers = new Map();
    const observers = [];
    const classes = new Set();
    let clock = 0;
    let nextFrame = 1;
    let nextTimer = 1;
    let targetDocumentTop = 1000;

    const documentElement = {
        classList: {
            toggle(name, active) {
                if (active) classes.add(name);
                else classes.delete(name);
            }
        },
        clientHeight: 800,
        getBoundingClientRect() {
            return { height: 5000 };
        },
        scrollHeight: 5000,
        scrollTop: 0
    };
    const target = {
        isConnected: true,
        getBoundingClientRect() {
            return { top: targetDocumentTop - documentElement.scrollTop };
        }
    };
    const main = {};
    const header = {};
    const document = {
        documentElement,
        scrollingElement: documentElement,
        getElementById(id) {
            return id === 'pjax-container' ? main : null;
        },
        querySelector(selector) {
            if (selector === '#target') return target;
            if (selector === 'body>header') return header;
            return null;
        }
    };

    class FakeResizeObserver {
        constructor(callback) {
            this.callback = callback;
            this.observed = [];
            this.disconnected = false;
            observers.push(this);
        }

        observe(node) {
            this.observed.push(node);
        }

        disconnect() {
            this.disconnected = true;
        }
    }

    const window = {
        ResizeObserver: options.withoutResizeObserver ? undefined : FakeResizeObserver,
        addEventListener(name, listener) {
            const current = listeners.get(name) || [];
            if (!current.includes(listener)) current.push(listener);
            listeners.set(name, current);
        },
        cancelAnimationFrame(id) {
            frames.delete(id);
        },
        clearTimeout(id) {
            timers.delete(id);
        },
        matchMedia() {
            return { matches: !!options.reducedMotion };
        },
        performance: {
            now() {
                return clock;
            }
        },
        removeEventListener(name, listener) {
            const current = listeners.get(name) || [];
            listeners.set(name, current.filter((candidate) => candidate !== listener));
        },
        requestAnimationFrame(callback) {
            const id = nextFrame++;
            frames.set(id, callback);
            return id;
        },
        scrollTo(_x, y) {
            documentElement.scrollTop = y;
        },
        setTimeout(callback) {
            const id = nextTimer++;
            timers.set(id, callback);
            return id;
        }
    };
    window.window = window;
    const context = {
        Date,
        VOID_Ui: {
            getHeaderOffset() {
                return 60;
            }
        },
        cancelAnimationFrame: window.cancelAnimationFrame,
        console,
        document,
        requestAnimationFrame: window.requestAnimationFrame,
        window
    };

    vm.runInNewContext(headerSource.slice(scrollerStart, scrollerEnd), context);

    return {
        classes,
        context,
        dispatch(name, event = { type: name }) {
            (listeners.get(name) || []).slice().forEach((listener) => listener(event));
        },
        flushFrame(nextClock) {
            clock = nextClock;
            const callbacks = Array.from(frames.values());
            frames.clear();
            callbacks.forEach((callback) => callback(clock));
        },
        listenerCount(name) {
            return (listeners.get(name) || []).length;
        },
        observers,
        setTargetDocumentTop(value) {
            targetDocumentTop = value;
        },
        target,
        documentElement
    };
}

test('anchor positioning compensates delayed layout shifts until user input', () => {
    const fixture = createEnvironment();
    const scroller = fixture.context.VOID_AnchorScroller;

    assert.equal(scroller.start('#target', 0, { behavior: 'auto', stabilize: true }), true);
    assert.equal(fixture.documentElement.scrollTop, 940);
    assert.equal(fixture.classes.has('void-anchor-scrolling'), true);
    assert.equal(fixture.listenerCount('wheel'), 1);
    assert.deepEqual(fixture.observers[0].observed, [{}, {}]);

    fixture.setTargetDocumentTop(1200);
    fixture.flushFrame(16);
    assert.equal(fixture.documentElement.scrollTop, 1140);

    fixture.flushFrame(800);
    fixture.setTargetDocumentTop(1350);
    fixture.observers[0].callback();
    fixture.flushFrame(1000);
    assert.equal(fixture.documentElement.scrollTop, 1290);

    const wheelEvent = { defaultPrevented: false, type: 'wheel' };
    fixture.dispatch('wheel', wheelEvent);
    assert.equal(wheelEvent.defaultPrevented, false);
    assert.equal(scroller.task, null);
    assert.equal(fixture.listenerCount('wheel'), 0);
    assert.equal(fixture.classes.has('void-anchor-scrolling'), false);
    assert.equal(fixture.observers[0].disconnected, true);
});

test('new anchor requests replace old work without accumulating listeners', () => {
    const fixture = createEnvironment();
    const scroller = fixture.context.VOID_AnchorScroller;

    scroller.start('#target', 0, { behavior: 'auto', stabilize: true });
    const firstObserver = fixture.observers[0];
    scroller.start('#target', 0, { behavior: 'auto', stabilize: true });

    assert.equal(firstObserver.disconnected, true);
    assert.equal(fixture.listenerCount('wheel'), 1);
    assert.equal(fixture.listenerCount('touchstart'), 1);
    assert.equal(fixture.listenerCount('pointerdown'), 1);
    assert.equal(fixture.listenerCount('keydown'), 1);

    fixture.target.isConnected = false;
    fixture.flushFrame(16);
    assert.equal(scroller.task, null);
    assert.equal(fixture.listenerCount('keydown'), 0);
});

test('reduced motion turns requested smooth positioning into an immediate move', () => {
    const fixture = createEnvironment({ reducedMotion: true });
    const scroller = fixture.context.VOID_AnchorScroller;

    scroller.start('#target', 0, { behavior: 'smooth' });

    assert.equal(fixture.documentElement.scrollTop, 940);
    assert.equal(fixture.context.VOID_SmoothScroller.target, null);
    assert.equal(scroller.task, null);
});

test('scroll-key cancellation does not consume the keyboard event', () => {
    const fixture = createEnvironment();
    const scroller = fixture.context.VOID_AnchorScroller;
    const keyEvent = {
        defaultPrevented: false,
        key: 'PageDown',
        preventDefault() {
            this.defaultPrevented = true;
        },
        type: 'keydown'
    };

    scroller.start('#target', 0, { behavior: 'auto', stabilize: true });
    fixture.dispatch('keydown', keyEvent);

    assert.equal(keyEvent.defaultPrevented, false);
    assert.equal(scroller.task, null);
});

test('thread layout locks correct browser anchoring across two rendered frames', () => {
    const fixture = createEnvironment();
    const scroller = fixture.context.VOID_AnchorScroller;

    fixture.documentElement.scrollTop = 400;
    scroller.preserveElement(fixture.target, () => {});
    assert.equal(fixture.classes.has('void-anchor-scrolling'), true);

    fixture.documentElement.scrollTop += 12;
    fixture.flushFrame(16);
    assert.equal(fixture.documentElement.scrollTop, 400);
    assert.equal(fixture.classes.has('void-anchor-scrolling'), true);

    fixture.documentElement.scrollTop += 6;
    fixture.flushFrame(32);
    assert.equal(fixture.documentElement.scrollTop, 400);
    assert.equal(fixture.classes.has('void-anchor-scrolling'), false);
});

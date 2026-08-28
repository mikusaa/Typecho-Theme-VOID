const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sass = require('sass');
const test = require('node:test');
const vm = require('node:vm');

const HEADER_PATH = path.resolve(__dirname, '../../assets/header.js');
const VOID_PATH = path.resolve(__dirname, '../../assets/VOID.js');

function controllerSource() {
    const source = fs.readFileSync(HEADER_PATH, 'utf8');
    const start = source.indexOf('VOID_ControllerPanel = {');
    const end = source.indexOf('\n\nVOID_Ui = {', start);

    assert.notEqual(start, -1, 'controller panel implementation should exist');
    assert.notEqual(end, -1, 'controller panel implementation should end before VOID_Ui');
    return source.slice(start, end) + ';';
}

function createEnvironment(options = {}) {
    const animationFrames = new Map();
    const listeners = new Map();
    const observed = [];
    const properties = new Map();
    const footerRect = {
        height: options.footerHeight === undefined ? 120 : options.footerHeight,
        top: options.footerTop === undefined ? 680 : options.footerTop
    };
    const footer = {
        getBoundingClientRect() {
            return footerRect;
        }
    };
    const panel = { offsetHeight: options.panelHeight || 160 };
    const content = {};
    const root = {
        clientHeight: options.viewportHeight || 800,
        clientWidth: options.viewportWidth || 1280,
        style: {
            removeProperty(name) {
                properties.delete(name);
            },
            setProperty(name, value) {
                properties.set(name, value);
            }
        }
    };
    let nextFrame = 1;

    function ResizeObserver(callback) {
        this.callback = callback;
        this.disconnectCount = 0;
        this.disconnect = () => {
            this.disconnectCount += 1;
        };
        this.observe = (element) => {
            observed.push(element);
        };
    }

    const document = {
        documentElement: root,
        getElementById(id) {
            if (id === 'ctrler-panel') return panel;
            if (id === 'pjax-container') return content;
            return null;
        },
        querySelector(selector) {
            return selector === 'body>footer' ? footer : null;
        }
    };
    const window = {
        ResizeObserver,
        addEventListener(name, listener) {
            if (!listeners.has(name)) listeners.set(name, new Set());
            listeners.get(name).add(listener);
        },
        cancelAnimationFrame(id) {
            animationFrames.delete(id);
        },
        getComputedStyle(element) {
            return element === root ? { fontSize: '16px' } : {};
        },
        innerHeight: root.clientHeight,
        innerWidth: root.clientWidth,
        matchMedia() {
            return { matches: options.desktop !== false };
        },
        removeEventListener(name, listener) {
            if (listeners.has(name)) listeners.get(name).delete(listener);
        },
        requestAnimationFrame(callback) {
            const id = nextFrame++;
            animationFrames.set(id, callback);
            return id;
        }
    };
    window.window = window;
    const context = vm.createContext({ document, isFinite, window });

    vm.runInContext(controllerSource(), context);

    return {
        controller: context.VOID_ControllerPanel,
        dispatch(name) {
            Array.from(listeners.get(name) || []).forEach((listener) => listener());
        },
        flushFrame() {
            const callbacks = Array.from(animationFrames.values());
            animationFrames.clear();
            callbacks.forEach((callback) => callback());
        },
        footerRect,
        listenerCount(name) {
            return (listeners.get(name) || new Set()).size;
        },
        observed,
        panel,
        properties,
        root
    };
}

test('controller and desktop setting panel share the footer overlap variable', () => {
    const stylesheet = sass.compile(
        path.resolve(__dirname, '../../assets/VOID.scss'),
        { style: 'expanded', quietDeps: true }
    ).css;

    assert.match(
        stylesheet,
        /#ctrler-panel\s*\{[^}]*bottom: calc\(1\.5rem \+ var\(--void-footer-overlap, 0px\)\)/s
    );
    assert.match(
        stylesheet,
        /#setting-panel\s*\{[^}]*bottom: calc\(1\.5rem \+ var\(--void-footer-overlap, 0px\)\)/s
    );
    assert.match(
        stylesheet,
        /@media screen and \(max-width: 767\.5px\)[^{]*\{[^}]*#setting-panel\s*\{[^}]*bottom: unset/s
    );
});

test('controller follows the visible footer and clamps inside a short viewport', () => {
    const environment = createEnvironment();
    const controller = environment.controller;

    assert.equal(controller.calculateOverlap(900, 800, 160, 24), 0);
    assert.equal(controller.calculateOverlap(680, 800, 160, 24), 120);
    assert.equal(controller.calculateOverlap(0, 500, 160, 24), 292);

    controller.init();
    environment.flushFrame();
    assert.equal(environment.properties.get('--void-footer-overlap'), '120px');

    environment.footerRect.top = 620;
    environment.dispatch('scroll');
    environment.dispatch('scroll');
    environment.flushFrame();
    assert.equal(environment.properties.get('--void-footer-overlap'), '180px');
});

test('controller lifecycle is idempotent and observes replaced layout nodes', () => {
    const environment = createEnvironment();
    const controller = environment.controller;

    controller.init();
    controller.init();
    assert.equal(environment.listenerCount('scroll'), 1);
    assert.equal(environment.listenerCount('resize'), 1);
    assert.equal(environment.observed.length, 6);

    environment.flushFrame();
    controller.destroy();
    assert.equal(environment.listenerCount('scroll'), 0);
    assert.equal(environment.listenerCount('resize'), 0);
    assert.equal(environment.properties.has('--void-footer-overlap'), false);
});

test('mobile and hidden footer states reset the desktop overlap', () => {
    const mobile = createEnvironment({ desktop: false });
    const hiddenFooter = createEnvironment({ footerHeight: 0 });

    mobile.controller.init();
    mobile.flushFrame();
    assert.equal(mobile.properties.get('--void-footer-overlap'), '0px');

    hiddenFooter.controller.init();
    hiddenFooter.flushFrame();
    assert.equal(hiddenFooter.properties.get('--void-footer-overlap'), '0px');
});

test('VOID lifecycle initializes and refreshes the controller panel', () => {
    const source = fs.readFileSync(VOID_PATH, 'utf8');

    assert.match(source, /VOID_Content\.parseTOC\(\);\s*if \(typeof VOID_ControllerPanel[^}]*VOID_ControllerPanel\.init\(\);/);
    assert.match(source, /VOID_Content\.parseTOC\(\);\s*if \(typeof VOID_ControllerPanel[^}]*VOID_ControllerPanel\.refresh\(\);/);
});

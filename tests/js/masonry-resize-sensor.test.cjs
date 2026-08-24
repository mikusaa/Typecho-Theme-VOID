const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadMasonryEnvironment() {
    const elements = [];
    const sensorInstances = [];
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
        const items = selector === '.masonry-item' ? elements.slice() : [];
        const api = {
            items,
            length: items.length,
            addClass() { return api; },
            css() { return api; },
            fadeOut() { return api; },
            has() { return api; },
            hasClass() { return false; },
            hide() { return api; },
            masonry() { return api; },
            on() { return api; },
            removeClass() { return api; }
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

    const window = {
        clearTimeout() {},
        innerWidth: 1024,
        setTimeout() {}
    };
    window.window = window;

    const context = {
        $: jQuery,
        ResizeSensor,
        VOIDConfig: { indexStyle: 1 },
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
        elements,
        sensorInstances,
        ui: context.VOID_Ui
    };
}

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

test('Masonry init restores sensors and UI reset detaches them once', () => {
    const environment = loadMasonryEnvironment();
    const element = { id: 'p-2' };

    environment.elements.push(element);
    environment.controller.init();
    environment.controller.init();

    assert.equal(environment.sensorInstances.length, 1);
    assert.equal(environment.controller.sensors.length, 1);

    environment.ui.reset();
    environment.ui.reset();

    assert.equal(environment.sensorInstances[0].detachCount, 1);
    assert.equal(
        environment.sensorInstances[0].detachedCallback,
        environment.sensorInstances[0].callback
    );
    assert.equal(environment.controller.sensors.length, 0);
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

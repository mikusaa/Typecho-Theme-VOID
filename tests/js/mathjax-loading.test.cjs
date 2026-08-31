const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.resolve(__dirname, '../../assets/VOID.js'),
    'utf8'
);

class FakeNode {
    constructor(nodeType, nodeName) {
        this.nodeName = nodeName;
        this.nodeType = nodeType;
        this.nodes = [];
        this.parentNode = null;
    }

    get firstChild() {
        return this.nodes[0] || null;
    }

    get isConnected() {
        if (this.nodeType === 9) {
            return true;
        }
        return !!this.parentNode && this.parentNode.isConnected;
    }

    get nextSibling() {
        if (!this.parentNode) {
            return null;
        }
        const index = this.parentNode.nodes.indexOf(this);
        return this.parentNode.nodes[index + 1] || null;
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        child.parentNode = this;
        this.nodes.push(child);
        return child;
    }

    removeChild(child) {
        const index = this.nodes.indexOf(child);
        if (index >= 0) {
            this.nodes.splice(index, 1);
            child.parentNode = null;
        }
        return child;
    }
}

class FakeText extends FakeNode {
    constructor(value) {
        super(3, '#text');
        this.nodeValue = String(value);
        this.textContent = this.nodeValue;
    }
}

class FakeElement extends FakeNode {
    constructor(tagName, id = '') {
        super(1, tagName.toUpperCase());
        this.attributes = new Map();
        this.async = false;
        this.id = id;
        this.src = '';
        this.tagName = this.nodeName;
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }

    querySelectorAll() {
        return [];
    }
}

class FakeDocument extends FakeNode {
    constructor() {
        super(9, '#document');
        this.documentElement = new FakeElement('html');
        this.head = new FakeElement('head');
        this.body = new FakeElement('body');
        this.appendChild(this.documentElement);
        this.documentElement.appendChild(this.head);
        this.documentElement.appendChild(this.body);
        this.currentContainer = null;
    }

    createElement(tagName) {
        return new FakeElement(tagName);
    }

    getElementById(id) {
        if (id === 'pjax-container') {
            return this.currentContainer;
        }

        function find(node) {
            if (node.id === id) {
                return node;
            }
            for (const child of node.nodes) {
                const match = find(child);
                if (match) {
                    return match;
                }
            }
            return null;
        }

        return find(this);
    }

    querySelectorAll() {
        return [];
    }

    setContainer(container) {
        if (this.currentContainer && this.currentContainer.parentNode) {
            this.currentContainer.parentNode.removeChild(this.currentContainer);
        }
        this.currentContainer = container;
        this.body.appendChild(container);
    }
}

function element(tagName, ...children) {
    const node = new FakeElement(tagName);
    for (const child of children) {
        node.appendChild(typeof child === 'string' ? new FakeText(child) : child);
    }
    return node;
}

function loadEnvironment({ enabled = true } = {}) {
    const document = new FakeDocument();
    const errors = [];
    const jQuery = () => {
        const api = {
            on() { return api; },
            ready() { return api; }
        };
        return api;
    };
    jQuery.each = () => {};
    jQuery.trim = (value) => String(value).trim();

    const window = {
        cancelAnimationFrame() {},
        clearTimeout,
        requestAnimationFrame() { return 1; },
        setInterval() {},
        setTimeout
    };
    window.window = window;

    const context = {
        $: jQuery,
        Promise,
        VOIDConfig: {
            enableMath: enabled,
            mathJaxUrl: enabled ? '/assets/libs/mathjax/4.1.3/tex-svg.js' : ''
        },
        console: {
            error(...args) { errors.push(args); },
            log() {}
        },
        document,
        jQuery,
        window
    };

    vm.runInNewContext(source, context);

    return {
        completeLoad(mathJax) {
            const script = document.getElementById('MathJax-script');
            assert.ok(script, 'MathJax script should exist before load completion');
            window.MathJax = mathJax;
            script.onload();
            return script;
        },
        context,
        document,
        errors,
        scripts() {
            return document.head.nodes.filter((node) => node.id === 'MathJax-script');
        }
    };
}

function createMathJax() {
    const clearCalls = [];
    const typesetCalls = [];
    const mathJax = {
        startup: { promise: Promise.resolve() },
        typesetClear(containers) {
            clearCalls.push(containers);
        },
        typesetPromise(containers) {
            typesetCalls.push(containers);
            return Promise.resolve();
        }
    };

    return { clearCalls, mathJax, typesetCalls };
}

test('disabled math support bypasses detection and never creates a script', () => {
    const { context, document, scripts } = loadEnvironment({ enabled: false });
    const container = element('main', '$x$');
    document.setContainer(container);
    context.VOID_Content.hasMath = () => {
        throw new Error('disabled math should not scan the page');
    };

    assert.equal(context.VOID_Content.prepareMath(container), null);
    context.VOID_Content.math(container, 1, null);
    assert.equal(scripts().length, 0);
});

test('ordinary text, currency, escaped dollars, and ignored elements do not load MathJax', () => {
    const { context, document, scripts } = loadEnvironment();
    const cases = [
        element('main', 'No formulas on this page.'),
        element('main', 'Plans cost $5 and $10 per month.'),
        element('main', String.raw`Escaped prices \$5 and \$10 stay literal.`),
        element(
            'main',
            element('pre', '$x$'),
            element('code', String.raw`\(x\)`),
            element('script', '$y$'),
            element('style', '$z$'),
            element('textarea', '$a$'),
            element('noscript', '$b$'),
            element('template', '$c$'),
            element('mjx-container', '$d$')
        )
    ];

    for (const container of cases) {
        document.setContainer(container);
        assert.equal(context.VOID_Content.prepareMath(container), null);
    }
    assert.equal(scripts().length, 0);
});

test('every supported formula form starts the MathJax request', () => {
    const formulas = [
        '$x + 1$',
        '$$x + 1$$',
        String.raw`\(x + 1\)`,
        String.raw`\[x + 1\]`,
        String.raw`\begin{align}x + 1\end{align}`
    ];

    for (const formula of formulas) {
        const { context, document, scripts } = loadEnvironment();
        const container = element('main', formula);
        document.setContainer(container);

        const promise = context.VOID_Content.prepareMath(container);
        assert.equal(typeof promise.then, 'function', formula);
        assert.equal(scripts().length, 1, formula);
    }
});

test('concurrent and repeated initialization shares one configured request and typesets once', async () => {
    const { context, document, completeLoad, scripts } = loadEnvironment();
    const container = element('main', '$x + 1$');
    document.setContainer(container);

    const first = context.VOID_Content.prepareMath(container);
    const second = context.VOID_Content.prepareMath(container);
    assert.equal(first, second);
    assert.equal(scripts().length, 1);
    assert.deepEqual(Array.from(context.window.MathJax.tex.inlineMath, (pair) => Array.from(pair)), [
        ['$', '$'],
        ['\\(', '\\)']
    ]);
    assert.deepEqual(Array.from(context.window.MathJax.tex.displayMath, (pair) => Array.from(pair)), [
        ['$$', '$$'],
        ['\\[', '\\]']
    ]);
    assert.equal(context.window.MathJax.tex.processEscapes, true);
    assert.equal(context.window.MathJax.svg.fontCache, 'global');
    assert.equal(context.window.MathJax.startup.typeset, false);

    const { clearCalls, mathJax, typesetCalls } = createMathJax();
    completeLoad(mathJax);
    assert.equal(await first, mathJax);
    assert.equal(await second, mathJax);
    assert.equal(context.VOID_Content.loadMathJax() instanceof Promise, true);
    assert.equal(scripts().length, 1);

    context.VOID.typographyGeneration = 4;
    context.VOID_Content.math(container, 4, first);
    await Promise.resolve();
    await mathJax.startup.promise;
    assert.equal(clearCalls.length, 1);
    assert.equal(clearCalls[0][0], container);
    assert.equal(typesetCalls.length, 1);
    assert.equal(typesetCalls[0][0], container);
});

test('an async load never typesets a detached PJAX container', async () => {
    const { context, document, completeLoad } = loadEnvironment();
    const oldContainer = element('main', '$old$');
    document.setContainer(oldContainer);
    context.VOID.typographyGeneration = 2;

    const loadPromise = context.VOID_Content.prepareMath(oldContainer);
    context.VOID_Content.math(oldContainer, 2, loadPromise);
    const currentContainer = element('main', 'Current page');
    document.setContainer(currentContainer);
    context.VOID.typographyGeneration = 3;

    const { mathJax, typesetCalls } = createMathJax();
    completeLoad(mathJax);
    await loadPromise;
    await Promise.resolve();
    assert.equal(oldContainer.isConnected, false);
    assert.deepEqual(typesetCalls, []);
});

test('PJAX formula transitions download once, clear old records, and re-typeset current content', async () => {
    const { context, document, completeLoad, scripts } = loadEnvironment();
    const plain = element('main', 'Plain page');
    document.setContainer(plain);
    assert.equal(context.VOID_Content.prepareMath(plain), null);

    const firstFormula = element('main', '$first$');
    document.setContainer(firstFormula);
    const firstLoad = context.VOID_Content.prepareMath(firstFormula);
    const { clearCalls, mathJax, typesetCalls } = createMathJax();
    completeLoad(mathJax);
    context.VOID.typographyGeneration = 1;
    context.VOID_Content.math(firstFormula, 1, firstLoad);
    await Promise.resolve();
    await mathJax.startup.promise;

    context.VOID_Content.clearMath(firstFormula);
    const secondPlain = element('main', 'Still plain');
    document.setContainer(secondPlain);
    assert.equal(context.VOID_Content.prepareMath(secondPlain), null);

    const secondFormula = element('main', String.raw`\[second\]`);
    document.setContainer(secondFormula);
    const secondLoad = context.VOID_Content.prepareMath(secondFormula);
    context.VOID.typographyGeneration = 2;
    context.VOID_Content.math(secondFormula, 2, secondLoad);
    await Promise.resolve();
    await mathJax.startup.promise;

    assert.equal(scripts().length, 1);
    assert.equal(typesetCalls.length, 2);
    assert.equal(typesetCalls[0][0], firstFormula);
    assert.equal(typesetCalls[1][0], secondFormula);
    assert.equal(clearCalls.length, 3);
    assert.equal(clearCalls[0][0], firstFormula);
    assert.equal(clearCalls[1][0], firstFormula);
    assert.equal(clearCalls[2][0], secondFormula);
});

test('failed loads resolve safely, remove the script, and allow a later retry', async () => {
    const { context, document, errors, scripts } = loadEnvironment();
    const container = element('main', '$retry$');
    document.setContainer(container);

    const failed = context.VOID_Content.prepareMath(container);
    const failedScript = scripts()[0];
    failedScript.onerror();
    assert.equal(await failed, null);
    assert.equal(context.VOID_Content.mathJaxLoadPromise, null);
    assert.equal(scripts().length, 0);
    assert.equal(errors.length, 1);

    const retry = context.VOID_Content.prepareMath(container);
    assert.notEqual(retry, failed);
    assert.equal(scripts().length, 1);
});

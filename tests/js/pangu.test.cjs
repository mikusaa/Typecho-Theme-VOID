const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { readVoidModule } = require('./helpers/void-source.cjs');

const source = fs.readFileSync(
    path.resolve(__dirname, '../../assets/libs/pangu/pangu.js'),
    'utf8'
);
const themeSource = readVoidModule('content');

class FakeNode {
    constructor(nodeType, nodeName) {
        this.nodeName = nodeName;
        this.nodeType = nodeType;
        this.parentNode = null;
    }

    get childNodes() {
        return [];
    }

    get nextSibling() {
        if (!this.parentNode) {
            return null;
        }
        const index = this.parentNode.childNodes.indexOf(this);
        return this.parentNode.childNodes[index + 1] || null;
    }

    get parentElement() {
        return this.parentNode instanceof FakeElement ? this.parentNode : null;
    }

    get previousElementSibling() {
        let sibling = this.previousSibling;
        while (sibling && sibling.nodeType !== FakeNode.ELEMENT_NODE) {
            sibling = sibling.previousSibling;
        }
        return sibling;
    }

    get previousSibling() {
        if (!this.parentNode) {
            return null;
        }
        const index = this.parentNode.childNodes.indexOf(this);
        return index > 0 ? this.parentNode.childNodes[index - 1] : null;
    }

    contains(candidate) {
        return candidate === this || this.childNodes.some((child) => child.contains(candidate));
    }
}

FakeNode.ELEMENT_NODE = 1;
FakeNode.TEXT_NODE = 3;
FakeNode.COMMENT_NODE = 8;
FakeNode.DOCUMENT_FRAGMENT_NODE = 11;
FakeNode.DOCUMENT_POSITION_FOLLOWING = 4;

class FakeText extends FakeNode {
    constructor(data) {
        super(FakeNode.TEXT_NODE, '#text');
        this.data = data;
    }

    get nodeValue() {
        return this.data;
    }

    set nodeValue(value) {
        this.data = String(value);
    }

    get textContent() {
        return this.data;
    }

    set textContent(value) {
        this.data = String(value);
    }
}

class FakeClassList {
    constructor() {
        this.names = new Set();
    }

    add(...names) {
        names.forEach((name) => this.names.add(name));
    }

    contains(name) {
        return this.names.has(name);
    }
}

class FakeElement extends FakeNode {
    constructor(tagName) {
        super(FakeNode.ELEMENT_NODE, tagName.toUpperCase());
        this.attributes = new Map();
        this.classList = new FakeClassList();
        this.isContentEditable = false;
        this.nodes = [];
        this.style = {};
        this.tagName = this.nodeName;
    }

    get childNodes() {
        return this.nodes;
    }

    get children() {
        return this.nodes.filter((node) => node.nodeType === FakeNode.ELEMENT_NODE);
    }

    get firstChild() {
        return this.nodes[0] || null;
    }

    get innerHTML() {
        return this.nodes.map(serialize).join('');
    }

    set innerHTML(value) {
        this.textContent = value;
    }

    get textContent() {
        return this.nodes.map((node) => node.textContent).join('');
    }

    set textContent(value) {
        this.nodes.forEach((node) => {
            node.parentNode = null;
        });
        this.nodes = [];
        if (String(value) !== '') {
            this.appendChild(new FakeText(String(value)));
        }
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        child.parentNode = this;
        this.nodes.push(child);
        return child;
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    insertBefore(child, reference) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        const index = this.nodes.indexOf(reference);
        child.parentNode = this;
        this.nodes.splice(index < 0 ? this.nodes.length : index, 0, child);
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

class FakeDocumentFragment extends FakeNode {
    constructor() {
        super(FakeNode.DOCUMENT_FRAGMENT_NODE, '#document-fragment');
    }
}

class FakeDocument {
    constructor() {
        this.body = new FakeElement('body');
        this.head = new FakeElement('head');
    }

    createElement(tagName) {
        return new FakeElement(tagName);
    }

    createTreeWalker(root, _whatToShow, filter) {
        const textNodes = [];

        function visit(node) {
            for (const child of node.childNodes) {
                if (child.nodeType === FakeNode.TEXT_NODE) {
                    if (!filter || filter.acceptNode(child) === 1) {
                        textNodes.push(child);
                    }
                } else {
                    visit(child);
                }
            }
        }

        visit(root);
        let index = -1;
        return {
            currentNode: root,
            nextNode() {
                index += 1;
                if (index >= textNodes.length) {
                    return false;
                }
                this.currentNode = textNodes[index];
                return true;
            }
        };
    }
}

function computedStyle(element) {
    return {
        clip: 'auto',
        display: element.style.display || 'inline',
        height: 'auto',
        opacity: element.style.opacity || '1',
        overflow: 'visible',
        position: 'static',
        visibility: 'visible',
        width: 'auto'
    };
}

function element(tagName, ...children) {
    const node = new FakeElement(tagName);
    for (const child of children) {
        node.appendChild(typeof child === 'string' ? new FakeText(child) : child);
    }
    return node;
}

function serialize(node) {
    if (node instanceof FakeText) {
        return node.data;
    }
    return `<${node.nodeName.toLowerCase()}>${node.childNodes.map(serialize).join('')}</${node.nodeName.toLowerCase()}>`;
}

function loadPangu({ idleCallback = false } = {}) {
    const document = new FakeDocument();
    let idleCalls = 0;
    const window = {
        getComputedStyle: computedStyle,
        setTimeout(callback) {
            callback();
            return 1;
        }
    };
    window.window = window;

    const context = {
        DocumentFragment: FakeDocumentFragment,
        Element: FakeElement,
        HTMLElement: FakeElement,
        Node: FakeNode,
        NodeFilter: {
            FILTER_ACCEPT: 1,
            FILTER_REJECT: 2,
            SHOW_TEXT: 4
        },
        Text: FakeText,
        clearTimeout() {},
        console,
        document,
        getComputedStyle: computedStyle,
        setTimeout: window.setTimeout,
        window
    };

    if (idleCallback) {
        context.requestIdleCallback = (callback) => {
            idleCalls += 1;
            callback({
                didTimeout: false,
                timeRemaining: () => 50
            });
            return idleCalls;
        };
    }

    vm.runInNewContext(source, context);
    return {
        get idleCalls() {
            return idleCalls;
        },
        pangu: context.pangu
    };
}

test('pangu 9.1.0 keeps the expected text-spacing rules', () => {
    const { pangu } = loadPangu();

    assert.equal(pangu.version, '9.1.0');
    assert.equal(pangu.spacingText('中文English日文123'), '中文 English 日文 123');
    assert.equal(pangu.spacingText('中文A+B中文'), '中文 A+B 中文');
    assert.equal(pangu.spacingText('標題|網站名稱'), '標題 | 網站名稱');
    assert.equal(pangu.spacingText('公式$E=mc^2$English'), '公式 $E=mc^2$English');
});

test('the theme leaves idle fallback selection to pangu', () => {
    assert.doesNotMatch(themeSource, /requestIdleCallback|cancelIdleCallback/);
});

test('spacingNode works without requestIdleCallback and preserves ignored footnotes', () => {
    const { pangu } = loadPangu();
    const footnoteLink = element('a', '1');
    const footnote = element('sup', footnoteLink);
    footnoteLink.classList.add('no-pangu-spacing');
    footnote.classList.add('no-pangu-spacing');
    const paragraph = element('p', '中文', footnote, 'English');

    assert.doesNotThrow(() => pangu.spacingNode(paragraph));
    assert.equal(paragraph.textContent, '中文1 English');
    assert.equal(footnoteLink.textContent, '1');

    const ignoredParagraph = element('p', '中文English');
    ignoredParagraph.classList.add('no-pangu-spacing');
    pangu.spacingNode(ignoredParagraph);
    assert.equal(ignoredParagraph.textContent, '中文English');

    const firstPass = serialize(paragraph);
    pangu.spacingNode(paragraph);
    assert.equal(serialize(paragraph), firstPass);
});

test('spacingNode fixes inline and wbr boundaries through the idle queue', () => {
    const environment = loadPangu({ idleCallback: true });
    const linkedParagraph = element('p', '中文', element('a', 'English'), '中文');
    const wbrParagraph = element('p', '蒸馏/', element('wbr'), '训练');

    environment.pangu.spacingNode(linkedParagraph);
    environment.pangu.spacingNode(wbrParagraph);

    assert.equal(linkedParagraph.textContent, '中文 English 中文');
    assert.equal(wbrParagraph.textContent, '蒸馏 / 训练');
    assert.equal(environment.idleCalls, 2);

    const firstPass = serialize(linkedParagraph) + serialize(wbrParagraph);
    environment.pangu.spacingNode(linkedParagraph);
    environment.pangu.spacingNode(wbrParagraph);
    assert.equal(serialize(linkedParagraph) + serialize(wbrParagraph), firstPass);
});

test('spacingNode completes a link boundary after an animated ancestor becomes visible', () => {
    const { pangu } = loadPangu();
    const paragraph = element('p', '中文', element('a', 'English'), '中文');
    const animatedContainer = element('section', paragraph);

    animatedContainer.style.opacity = '0';
    pangu.spacingNode(paragraph);
    assert.equal(paragraph.textContent, '中文English 中文');

    animatedContainer.style.opacity = '0.5';
    pangu.spacingNode(paragraph);
    assert.equal(paragraph.textContent, '中文 English 中文');

    const firstVisiblePass = serialize(paragraph);
    pangu.spacingNode(paragraph);
    assert.equal(serialize(paragraph), firstVisiblePass);
});

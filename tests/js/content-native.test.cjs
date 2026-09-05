const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const themeSource = fs.readFileSync(
    path.resolve(__dirname, '../../assets/VOID.js'),
    'utf8'
).replace(/\r\n/g, '\n');
const hyphenSource = fs.readFileSync(
    path.resolve(__dirname, '../../assets/libs/hyphen/hyphen.js'),
    'utf8'
);

class FakeClassList {
    constructor(names = []) {
        this.names = new Set(names);
    }

    add(name) {
        this.names.add(name);
    }

    contains(name) {
        return this.names.has(name);
    }

    remove(name) {
        this.names.delete(name);
    }
}

class FakeElement {
    constructor(tagName, document) {
        this.attributes = new Map();
        this.children = [];
        this.childNodes = this.children;
        this.classList = new FakeClassList();
        this.closestMatches = new Map();
        this.document = document;
        this.hostname = '';
        this.id = '';
        this.listeners = new Map();
        this.nodeType = 1;
        this.parentNode = null;
        this.tagName = String(tagName || '').toUpperCase();
        this.textContent = '';
    }

    get firstChild() {
        return this.children[0] || null;
    }

    get nextSibling() {
        if (!this.parentNode) {
            return null;
        }
        const index = this.parentNode.children.indexOf(this);
        return this.parentNode.children[index + 1] || null;
    }

    get previousSibling() {
        if (!this.parentNode) {
            return null;
        }
        const index = this.parentNode.children.indexOf(this);
        return index > 0 ? this.parentNode.children[index - 1] : null;
    }

    addEventListener(name, listener) {
        if (!this.listeners.has(name)) {
            this.listeners.set(name, []);
        }
        this.listeners.get(name).push(listener);
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    closest(selector) {
        return this.closestMatches.get(selector) || null;
    }

    dispatch(name, event) {
        for (const listener of this.listeners.get(name) || []) {
            listener.call(this, event);
        }
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    insertBefore(child, reference) {
        child.parentNode = this;
        const index = this.children.indexOf(reference);
        this.children.splice(index < 0 ? this.children.length : index, 0, child);
        return child;
    }

    matches(selector) {
        return selector === '.comments-container .pager a' && this.isCommentPager;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index >= 0) {
            this.children.splice(index, 1);
            child.parentNode = null;
        }
        return child;
    }

    setAttribute(name, value) {
        const stringValue = String(value);
        this.attributes.set(name, stringValue);
        if (name === 'id') {
            if (this.id) {
                this.document.ids.delete(this.id);
            }
            this.id = stringValue;
            this.document.ids.set(this.id, this);
        }
    }
}

class FakeDocument {
    constructor() {
        this.domain = 'blog.example.test';
        this.ids = new Map();
        this.queries = new Map();
    }

    createElement(tagName) {
        return new FakeElement(tagName, this);
    }

    getElementById(id) {
        return this.ids.get(id) || null;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        const value = this.queries.get(selector);
        return typeof value === 'function' ? value() : value || [];
    }

    setQuery(selector, value) {
        this.queries.set(selector, value);
    }
}

function loadContent(document, overrides = {}) {
    const start = themeSource.indexOf('var VOID_Content = {');
    const end = themeSource.indexOf('\n};\n\nvar VOID_DialogScrollLock', start);
    const window = overrides.window || {};
    const context = {
        Prism: overrides.Prism,
        TOC: overrides.TOC,
        VOIDConfig: overrides.VOIDConfig,
        VOID_Ui: overrides.VOID_Ui,
        console: { error() {}, log() {} },
        document,
        pangu: overrides.pangu,
        tocbot: overrides.tocbot,
        window
    };
    window.window = window;

    assert.notEqual(start, -1, 'VOID_Content should exist');
    assert.notEqual(end, -1, 'VOID_Content should have a stable boundary');
    vm.runInNewContext(themeSource.slice(start, end + '\n};'.length), context);
    return { content: context.VOID_Content, window };
}

function createClickEvent(overrides = {}) {
    return Object.assign({
        altKey: false,
        button: 0,
        ctrlKey: false,
        defaultPrevented: false,
        metaKey: false,
        prevented: false,
        shiftKey: false,
        stopped: false,
        preventDefault() {
            this.defaultPrevented = true;
            this.prevented = true;
        },
        stopPropagation() {
            this.stopped = true;
        }
    }, overrides);
}

test('stage 2A content boundaries contain no jQuery calls', () => {
    const ranges = [
        themeSource.slice(themeSource.indexOf('countWords: function'), themeSource.indexOf('getFigureImage: function')),
        themeSource.slice(themeSource.indexOf('parseDetails: function'), themeSource.indexOf('normalizeTableLabel: function')),
        themeSource.slice(themeSource.indexOf('parseUrl: function'), themeSource.indexOf('isPanguSpaceElement: function')),
        themeSource.slice(themeSource.indexOf('cleanupLittlefootPanguSpacing: function'), themeSource.indexOf('prepareLittlefootMobileCompat: function')),
        themeSource.slice(themeSource.indexOf('hyphenate: function'), themeSource.indexOf('\n};\n\nvar VOID_DialogScrollLock'))
    ];
    const jQueryReference = /\$\s*\(|\$\s*\.|\bjQuery\b/;

    for (const range of ranges) {
        assert.doesNotMatch(range, jQueryReference);
    }
    assert.doesNotMatch(hyphenSource, /\$\.fn\.hyphenate|\bjQuery\b/);
    assert.match(hyphenSource, /Hypher'\]\['hyphenateElement'\] = function \(element, language\)/);
    assert.match(themeSource, /window\.Hypher\.hyphenateElement\(item, 'en-us'\)/);
});

test('word totals, details summaries, and code classes use native DOM state idempotently', () => {
    const document = new FakeDocument();
    const total = document.createElement('span');
    const firstTitle = document.createElement('a');
    const secondTitle = document.createElement('a');
    const missingSummary = document.createElement('details');
    const existingSummary = document.createElement('details');
    const paragraph = document.createElement('p');
    const summary = document.createElement('summary');
    const plainCode = document.createElement('code');
    const customCode = document.createElement('code');
    const languageCode = document.createElement('code');
    let highlightCount = 0;

    total.setAttribute('id', 'totalWordCount');
    firstTitle.setAttribute('data-words', '12');
    secondTitle.setAttribute('data-words', '30');
    missingSummary.appendChild(paragraph);
    existingSummary.appendChild(summary);
    customCode.setAttribute('class', 'line-numbers');
    languageCode.setAttribute('class', 'language-js');
    document.setQuery('a.archive-title', [firstTitle, secondTitle]);
    document.setQuery('article.yue details', [missingSummary, existingSummary]);
    document.setQuery('.yue pre code', [plainCode, customCode, languageCode]);

    const { content } = loadContent(document, {
        Prism: { highlightAll() { highlightCount += 1; } },
        window: {}
    });
    content.countWords();
    content.parseDetails();
    content.parseDetails();
    content.highlight();
    content.highlight();

    assert.equal(total.textContent, 42);
    assert.equal(missingSummary.children.length, 2);
    assert.equal(missingSummary.children[0].tagName, 'SUMMARY');
    assert.equal(missingSummary.children[0].textContent, '展开详情');
    assert.equal(missingSummary.children[0].getAttribute('data-void-generated'), '');
    assert.equal(existingSummary.children.length, 1);
    assert.equal(plainCode.getAttribute('class'), 'language-none');
    assert.equal(customCode.getAttribute('class'), 'line-numbers language-none');
    assert.equal(languageCode.getAttribute('class'), 'language-js');
    assert.equal(highlightCount, 2);
});

test('TOC links bind once, scroll normally, and preserve modified link activation', () => {
    const document = new FakeDocument();
    const toc = document.createElement('nav');
    const link = document.createElement('a');
    const scrolls = [];
    let closeCount = 0;
    let initCount = 0;
    let openCount = 0;

    link.setAttribute('href', '#section-two');
    document.setQuery('.TOC', [toc]);
    document.setQuery('.toc-link', [link]);
    const runtime = loadContent(document, {
        TOC: {
            close() { closeCount += 1; },
            open() { openCount += 1; }
        },
        VOID_Ui: {
            scrollToWithHeader(target, offset, options) {
                scrolls.push({ offset, options, target });
            }
        },
        tocbot: { init() { initCount += 1; } },
        window: { innerWidth: 390 }
    });

    runtime.content.parseTOC();
    runtime.content.parseTOC();
    assert.equal(link.listeners.get('click').length, 1);
    assert.equal(initCount, 2);

    const click = createClickEvent();
    link.dispatch('click', click);
    assert.equal(click.prevented, true);
    assert.equal(click.stopped, true);
    assert.equal(scrolls.length, 1);
    assert.equal(scrolls[0].target, '#section-two');
    assert.equal(scrolls[0].offset, 0);
    assert.equal(scrolls[0].options.behavior, 'smooth');
    assert.equal(scrolls[0].options.stabilize, true);
    assert.equal(closeCount, 1);

    const modifiedClick = createClickEvent({ ctrlKey: true });
    link.dispatch('click', modifiedClick);
    assert.equal(modifiedClick.prevented, false);
    assert.equal(modifiedClick.stopped, false);
    assert.equal(scrolls.length, 1);

    runtime.window.innerWidth = 1200;
    runtime.content.parseTOC();
    assert.equal(openCount, 1);
    assert.equal(link.listeners.get('click').length, 1);
});

test('external links and PJAX classes preserve the existing link rules', () => {
    const document = new FakeDocument();
    const external = document.createElement('a');
    const externalSelf = document.createElement('a');
    const internal = document.createElement('a');
    const commentPager = document.createElement('a');
    const noPjax = document.createElement('a');
    const links = [external, externalSelf, internal, commentPager, noPjax];
    const binds = [];

    external.hostname = 'outside.example.test';
    externalSelf.hostname = 'outside.example.test';
    externalSelf.setAttribute('target', '_self');
    internal.hostname = document.domain;
    commentPager.hostname = document.domain;
    commentPager.isCommentPager = true;
    commentPager.classList.add('pjax');
    noPjax.hostname = document.domain;
    noPjax.setAttribute('no-pjax', '');
    document.setQuery('a:not([href^="#"]):not(.post-like):not(.void-image-link)', links);
    document.setQuery('a:not([target="_blank"]):not([no-pjax])', () => links.filter((link) => (
        link.getAttribute('target') !== '_blank' && link.getAttribute('no-pjax') === null
    )));

    const { content } = loadContent(document, {
        VOIDConfig: { PJAX: true },
        window: {
            VoidPjax: {
                bind(selector, options) {
                    binds.push({ options, selector });
                }
            }
        }
    });
    content.parseUrl();

    assert.equal(external.getAttribute('target'), '_blank');
    assert.equal(externalSelf.getAttribute('target'), '_self');
    assert.equal(internal.classList.contains('pjax'), true);
    assert.equal(commentPager.classList.contains('pjax'), false);
    assert.equal(noPjax.classList.contains('pjax'), false);
    assert.equal(binds.length, 1);
    assert.equal(binds[0].selector, 'a.pjax');
    assert.equal(binds[0].options.container, '#pjax-container');
    assert.equal(binds[0].options.fragment, '#pjax-container');
    assert.equal(binds[0].options.timeout, 8000);
});

test('littlefoot reference and active state cleanup uses DOM elements directly', () => {
    const document = new FakeDocument();
    const printReference = document.createElement('sup');
    const button = document.createElement('button');
    const activeHost = document.createElement('span');
    const spacingParent = document.createElement('div');
    const before = document.createElement('pangu');
    const footnote = document.createElement('span');
    const after = document.createElement('pangu');

    printReference.classList.add('littlefoot--print');
    printReference.setAttribute('id', 'fn:1');
    button.classList.add('littlefoot__button');
    button.setAttribute('id', 'lf-fn:1');
    activeHost.classList.add('littlefoot');
    activeHost.classList.add('littlefoot--active');
    button.closestMatches.set('.littlefoot', activeHost);
    before.textContent = ' ';
    after.textContent = '';
    spacingParent.appendChild(before);
    spacingParent.appendChild(footnote);
    spacingParent.appendChild(after);
    document.setQuery('.littlefoot__button[id^="lf-"]', [button]);
    document.setQuery('[data-lf-original-id]', () => (
        printReference.getAttribute('data-lf-original-id') === null ? [] : [printReference]
    ));
    document.setQuery('.littlefoot', [footnote]);
    document.setQuery('sup.littlefoot--print, a.littlefoot--print', []);
    document.setQuery('.littlefoot.littlefoot--active', [activeHost]);

    const { content } = loadContent(document, { window: {} });
    content.bridgeLittlefootBacklinks();
    assert.equal(button.id, 'fn:1');
    assert.equal(printReference.id, 'lf-print-fn:1');
    assert.equal(printReference.getAttribute('data-lf-original-id'), 'fn:1');

    content.restoreLittlefootReferenceIds();
    assert.equal(printReference.id, 'fn:1');
    assert.equal(printReference.getAttribute('data-lf-original-id'), null);

    content.cleanupLittlefootPanguSpacing();
    assert.equal(spacingParent.children.length, 1);
    assert.equal(spacingParent.children[0], footnote);

    content.setLittlefootActiveState(button, false);
    assert.equal(activeHost.classList.contains('littlefoot--active'), false);
    content.setLittlefootActiveState(button, true);
    content.clearLittlefootActiveState();
    assert.equal(activeHost.classList.contains('littlefoot--active'), false);
});

test('Hypher exposes a DOM-element entry point and keeps nested nodes untouched', () => {
    const window = {};
    vm.runInNewContext(hyphenSource, { window });

    assert.equal(typeof window.Hypher.hyphenateElement, 'function');
    assert.equal(typeof window.Hypher.languages['en-us'].hyphenateText, 'function');

    const directText = { nodeType: 3, nodeValue: 'extraordinary hyphenation' };
    const nestedText = { nodeType: 3, nodeValue: 'extraordinary hyphenation' };
    const element = {
        childNodes: [directText, { childNodes: [nestedText], nodeType: 1 }]
    };
    window.Hypher.hyphenateElement(element, 'en-us');

    assert.match(directText.nodeValue, /\u00ad/);
    assert.equal(nestedText.nodeValue, 'extraordinary hyphenation');
});

test('content hyphenation skips alerts, fallback markers, and TeX before using Hypher', () => {
    const document = new FakeDocument();
    const prose = document.createElement('p');
    const alert = document.createElement('p');
    const fallback = document.createElement('p');
    const tex = document.createElement('blockquote');
    const hyphenated = [];

    prose.textContent = 'Extraordinary prose';
    alert.textContent = 'Alert prose';
    alert.closestMatches.set('.void-alert', alert);
    fallback.textContent = '[!NOTE] fallback';
    tex.textContent = '\\begin{align} x \\end{align}';
    document.setQuery('div.articleBody p, div.articleBody blockquote', [prose, alert, fallback, tex]);

    const { content } = loadContent(document, {
        window: {
            Hypher: {
                hyphenateElement(element, language) {
                    hyphenated.push({ element, language });
                }
            }
        }
    });
    content.hyphenate();

    assert.equal(hyphenated.length, 1);
    assert.equal(hyphenated[0].element, prose);
    assert.equal(hyphenated[0].language, 'en-us');
});

test('pangu marks footnote anchors and spaces paragraphs without jQuery', () => {
    const document = new FakeDocument();
    const footnoteLink = document.createElement('a');
    const regularLink = document.createElement('a');
    const footnoteSup = document.createElement('sup');
    const firstParagraph = document.createElement('p');
    const secondParagraph = document.createElement('p');
    const spaced = [];

    footnoteLink.setAttribute('href', '#fn:1');
    footnoteLink.closestMatches.set('sup', footnoteSup);
    regularLink.setAttribute('href', '#section');
    document.setQuery('a[href*="#"]', [footnoteLink, regularLink]);
    document.setQuery('p', [firstParagraph, secondParagraph]);

    const { content } = loadContent(document, {
        pangu: {
            spacingNode(element) {
                spaced.push(element);
            }
        },
        window: {}
    });
    content.pangu();

    assert.equal(footnoteLink.classList.contains('no-pangu-spacing'), true);
    assert.equal(footnoteSup.classList.contains('no-pangu-spacing'), true);
    assert.equal(regularLink.classList.contains('no-pangu-spacing'), false);
    assert.deepEqual(spaced, [firstParagraph, secondParagraph]);
});

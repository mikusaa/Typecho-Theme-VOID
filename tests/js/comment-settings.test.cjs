const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { readVoidModule } = require('./helpers/void-source.cjs');

const ajaxCommentSource = readVoidModule('comments');
const commentStyles = fs.readFileSync(path.resolve(__dirname, '../../assets/parts/_comments.scss'), 'utf8');

function loadAjaxComment(jQuery, document = {}, window = {}) {
    window.window = window;
    const context = {
        $: jQuery,
        document,
        window,
        VOID_Content: window.VOID_Content || {},
        VOID_Ui: window.VOID_Ui || { checkScrollTop() {} },
        VOID_Vote: window.VOID_Vote || {},
        VOID: window.VOID || {},
        VOID_AnchorScroller: window.VOID_AnchorScroller
    };

    vm.runInNewContext(ajaxCommentSource, context);
    return context.AjaxComment;
}

class FakeEventTarget {
    constructor() {
        this.listeners = new Map();
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

    dispatch(name, event = {}) {
        event.type = name;
        (this.listeners.get(name) || []).slice().forEach((listener) => listener.call(this, event));
    }

    listenerCount(name) {
        return (this.listeners.get(name) || []).length;
    }
}

function createClassList() {
    const values = new Set();
    return {
        contains(name) {
            return values.has(name);
        },
        toggle(name, force) {
            if (force) {
                values.add(name);
            } else {
                values.delete(name);
            }
        }
    };
}

test('AjaxComment is fully native while the external jQuery compatibility layer remains separate', () => {
    const jQueryReference = /(?:^|[^\w$])\$\s*(?:\(|\.)|\bjQuery\b/;

    assert.doesNotMatch(ajaxCommentSource, jQueryReference);
    assert.match(ajaxCommentSource, /new FormData\(form\)/);
    assert.match(ajaxCommentSource, /new URLSearchParams\(\)/);
    assert.match(ajaxCommentSource, /new DOMParser\(\)/);
    assert.match(ajaxCommentSource, /fetch\(form\.getAttribute\('action'\)/);
});

test('native comment page queries and loading state follow the current PJAX DOM', () => {
    const container = { classList: createClassList() };
    const comments = {
        classList: createClassList(),
        closest(selector) {
            return selector === '.comments-container' ? container : null;
        },
        getAttribute(name) {
            return name === 'data-comments-order' ? this.order : null;
        },
        order: 'DESC'
    };
    const pager = {
        attributes: new Map(),
        classList: createClassList(),
        removeAttribute(name) {
            this.attributes.delete(name);
        },
        setAttribute(name, value) {
            this.attributes.set(name, value);
        }
    };
    let hasPrevious = false;
    let hasNext = true;
    const document = {
        querySelector(selector) {
            if (selector === '#comments') return comments;
            if (selector === '#comments .pager .prev') return hasPrevious ? pager : null;
            if (selector === '#comments .pager .next') return hasNext ? pager : null;
            return null;
        },
        querySelectorAll(selector) {
            return selector === '.comments-container .pager a' ? [pager] : [];
        }
    };
    const ajaxComment = loadAjaxComment(() => {
        throw new Error('native page state must not call jQuery');
    }, document, {});

    assert.equal(ajaxComment.getCommentsOrder(), 'DESC');
    assert.equal(ajaxComment.isNewestCommentPage(), true);
    hasPrevious = true;
    assert.equal(ajaxComment.isNewestCommentPage(), false);

    comments.order = 'ASC';
    hasNext = false;
    assert.equal(ajaxComment.getCommentsOrder(), 'ASC');
    assert.equal(ajaxComment.isNewestCommentPage(), true);

    ajaxComment.setCommentPageLoading(true);
    assert.equal(container.classList.contains('is-loading'), true);
    assert.equal(comments.classList.contains('is-loading'), true);
    assert.equal(pager.classList.contains('is-disabled'), true);
    assert.equal(pager.attributes.get('aria-disabled'), 'true');

    ajaxComment.setCommentPageLoading(false);
    assert.equal(container.classList.contains('is-loading'), false);
    assert.equal(comments.classList.contains('is-loading'), false);
    assert.equal(pager.attributes.has('aria-disabled'), false);
});

test('comment pager and hash listeners bind once and survive PJAX DOM replacement', () => {
    const document = new FakeEventTarget();
    const window = new FakeEventTarget();
    const visits = [];
    const scrollChecks = [];
    let syncCount = 0;
    let currentPager;

    document.documentElement = { contains: () => true };
    document.querySelector = () => null;
    document.querySelectorAll = () => [];
    window.location = { hash: '', search: '' };
    window.VoidPjax = { visit: (options) => visits.push(options) };
    window.VOID_Ui = { checkScrollTop: (options) => scrollChecks.push(options) };

    function createPager(href) {
        return {
            href,
            closest(selector) {
                return selector === '.comments-container .pager a' ? this : null;
            },
            getAttribute(name) {
                return name === 'href' ? href : null;
            }
        };
    }

    const ajaxComment = loadAjaxComment(() => {
        throw new Error('native lifecycle listeners must not call jQuery');
    }, document, window);
    ajaxComment.syncThreadFocusFromHash = () => { syncCount += 1; };

    ajaxComment.bindPager();
    ajaxComment.bindPager();
    ajaxComment.bindHashChange();
    ajaxComment.bindHashChange();
    assert.equal(document.listenerCount('click'), 1);
    assert.equal(window.listenerCount('hashchange'), 1);

    currentPager = createPager('https://example.test/post/comment-page-2');
    const firstClick = {
        button: 0,
        defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; },
        target: currentPager
    };
    document.dispatch('click', firstClick);
    assert.equal(firstClick.defaultPrevented, true);
    assert.equal(visits.length, 1);
    assert.equal(visits[0].container, '#comments');
    assert.equal(visits[0].target, currentPager);

    currentPager = createPager('https://example.test/post/comment-page-3');
    document.dispatch('click', {
        button: 0,
        defaultPrevented: false,
        preventDefault() {},
        target: currentPager
    });
    assert.equal(visits.length, 2);
    assert.equal(visits[1].target, currentPager);

    window.dispatch('hashchange');
    assert.equal(syncCount, 1);
    assert.equal(scrollChecks.length, 1);
    assert.equal(scrollChecks[0].ignoreSavedPosition, true);

    ajaxComment.unbindPager();
    ajaxComment.unbindPager();
    ajaxComment.unbindHashChange();
    ajaxComment.unbindHashChange();
    assert.equal(document.listenerCount('click'), 0);
    assert.equal(window.listenerCount('hashchange'), 0);

    ajaxComment.bindPager();
    ajaxComment.bindHashChange();
    assert.equal(document.listenerCount('click'), 1);
    assert.equal(window.listenerCount('hashchange'), 1);
});

test('reply trigger state uses elements and cancel restores focus without scrolling', () => {
    const attributes = new Map([
        ['data-comment-id', 'comment-12'],
        ['data-comment-coid', '12']
    ]);
    const classes = createClassList();
    const focusCalls = [];
    const comment = {
        getAttribute(name) {
            return name === 'data-comment-id' ? 'comment-12' : null;
        },
        id: 'comment-12'
    };
    const trigger = {
        classList: classes,
        closest(selector) {
            return selector === '[data-comment-id], .comment-body[id]' ? comment : null;
        },
        focus(options) {
            focusCalls.push(options);
        },
        getAttribute(name) {
            return attributes.get(name) || null;
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
        },
        textContent: ' 回复 '
    };
    const document = {
        getElementById() {
            return null;
        },
        querySelector() {
            return null;
        },
        querySelectorAll(selector) {
            return selector === '.comment-reply a' ? [trigger] : [];
        }
    };
    const ajaxComment = loadAjaxComment(() => {
        throw new Error('reply trigger state must not call jQuery');
    }, document, {});

    ajaxComment.bindClick();
    assert.equal(attributes.get('data-reply-word'), '回复');
    assert.equal(attributes.get('data-cancel-word'), '取消回复');
    assert.equal(attributes.get('aria-pressed'), 'false');

    ajaxComment.activateReplyTrigger(trigger, 'comment-12', '12');
    assert.equal(trigger.textContent, '取消回复');
    assert.equal(classes.contains('is-reply-active'), true);
    ajaxComment.restoreReplyForm = () => false;
    ajaxComment.cancelActiveReply();

    assert.equal(trigger.textContent, '回复');
    assert.equal(attributes.get('data-reply-state'), 'idle');
    assert.equal(classes.contains('is-reply-active'), false);
    assert.equal(focusCalls.length, 1);
    assert.equal(focusCalls[0].preventScroll, true);
    assert.equal(ajaxComment.activeReplyCommentId, '');
    assert.equal(ajaxComment.parentID, '');
});

test('thread panel identity, layout preservation, and focus use DOM elements directly', () => {
    const root = { id: 'comment-42' };
    const attributes = new Map();
    const focusCalls = [];
    const control = {
        focus(options) {
            focusCalls.push(options);
        }
    };
    const children = {
        listenerCount: 0,
        addEventListener(name) {
            if (name === 'click') this.listenerCount += 1;
        },
        contains() {
            return false;
        },
        parentElement: root,
        querySelector(selector) {
            return selector === '.comment-thread-collapse' ? control : null;
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
        }
    };
    const preserved = [];
    const window = {
        VOID_AnchorScroller: {
            preserveElement(element, callback, options) {
                preserved.push({ element, options });
                callback();
            }
        }
    };
    const ajaxComment = loadAjaxComment(() => {
        throw new Error('thread controls must not call jQuery');
    }, {}, window);
    let callbackCount = 0;

    assert.equal(ajaxComment.getThreadPanelId(children), 'comment-thread-42');
    assert.equal(attributes.get('id'), 'comment-thread-42');
    ajaxComment.updateThreadLayout(children, () => { callbackCount += 1; }, { trackFrames: false });
    ajaxComment.focusThreadControl(children, '.comment-thread-collapse');

    assert.equal(callbackCount, 1);
    assert.equal(preserved.length, 1);
    assert.equal(preserved[0].element, root);
    assert.equal(preserved[0].options.trackFrames, false);
    assert.equal(focusCalls.length, 1);
    assert.equal(focusCalls[0].preventScroll, true);
    ajaxComment.bindThreadPanel(children);
    ajaxComment.bindThreadPanel(children);
    assert.equal(children.listenerCount, 1);
});

function commentPageDocument(state) {
    const comments = {
        getAttribute(name) {
            return name === 'data-comments-order' ? state.order : null;
        }
    };

    return {
        querySelector(selector) {
            if (selector === '#comments') {
                return comments;
            }

            if (selector === '#comments .pager .prev') {
                return state.hasPrev ? {} : null;
            }
            if (selector === '#comments .pager .next') {
                return state.hasNext ? {} : null;
            }
            return null;
        }
    };
}

test('comment page boundary follows the configured ASC or DESC order', () => {
    const state = { order: 'DESC', hasPrev: false, hasNext: true };
    const ajaxComment = loadAjaxComment(null, commentPageDocument(state));

    assert.equal(ajaxComment.getCommentsOrder(), 'DESC');
    assert.equal(ajaxComment.isNewestCommentPage(), true);
    state.hasPrev = true;
    assert.equal(ajaxComment.isNewestCommentPage(), false);

    state.order = 'ASC';
    state.hasPrev = true;
    state.hasNext = false;
    assert.equal(ajaxComment.getCommentsOrder(), 'ASC');
    assert.equal(ajaxComment.isNewestCommentPage(), true);
    state.hasNext = true;
    assert.equal(ajaxComment.isNewestCommentPage(), false);

    state.order = 'unexpected';
    state.hasPrev = false;
    assert.equal(ajaxComment.getCommentsOrder(), 'DESC');
});

test('new root and direct reply insertion follows ASC or DESC order', () => {
    const state = { order: 'DESC', hasPrev: false, hasNext: false };
    const ajaxComment = loadAjaxComment(null, commentPageDocument(state));
    const calls = [];
    const comment = { id: 'new-comment' };
    let footer = null;
    const list = {
        get firstChild() {
            return footer;
        },
        get firstElementChild() {
            return footer;
        },
        appendChild(value) {
            calls.push(['append', value]);
        },
        insertBefore(value, reference) {
            calls.push([reference ? 'before-footer' : 'prepend', value]);
        }
    };

    ajaxComment.insertNewestComment(list, comment);
    assert.deepEqual(calls.pop(), ['prepend', comment]);

    state.order = 'ASC';
    ajaxComment.insertNewestComment(list, comment);
    assert.deepEqual(calls.pop(), ['append', comment]);

    footer = {
        matches(selector) {
            return selector === '.comment-thread-footer';
        },
        nextElementSibling: null
    };
    ajaxComment.insertNewestComment(list, comment);
    assert.deepEqual(calls.pop(), ['before-footer', comment]);
});

test('comment hashes expand only replies hidden by the collapsed preview', () => {
    const ajaxComment = loadAjaxComment(() => ({}));

    assert.deepEqual(
        { ...ajaxComment.resolveThreadFocusState(3, 2, true, -1, true) },
        { currentPage: 1, handled: true, isExpanded: false }
    );
    assert.deepEqual(
        { ...ajaxComment.resolveThreadFocusState(3, 1, false, 0, false) },
        { currentPage: 1, handled: true, isExpanded: false }
    );
    assert.deepEqual(
        { ...ajaxComment.resolveThreadFocusState(3, 1, false, 1, false) },
        { currentPage: 1, handled: true, isExpanded: true }
    );
    assert.deepEqual(
        { ...ajaxComment.resolveThreadFocusState(10, 1, false, 9, false) },
        { currentPage: 2, handled: true, isExpanded: true }
    );
});

test('thread controls restore focus without scrolling and expose their panel state', () => {
    const ajaxComment = loadAjaxComment(null);
    const focusOptions = [];
    const control = {
        focus(options) {
            focusOptions.push(options);
        }
    };
    const children = {
        querySelector() {
            return control;
        }
    };

    ajaxComment.focusThreadControl(children, '.comment-thread-expand');
    assert.equal(focusOptions.length, 1);
    assert.equal(focusOptions[0].preventScroll, true);
    assert.match(ajaxCommentSource, /setAttribute\('aria-expanded', 'false'\)/);
    assert.match(ajaxCommentSource, /setAttribute\('aria-expanded', 'true'\)/);
    assert.match(ajaxCommentSource, /setAttribute\('aria-controls', panelId\)/);
});

test('collapsing a comment thread preserves its visual position without anchor scrolling', () => {
    const handlerStart = ajaxCommentSource.indexOf('bindThreadPanel: function');
    const handlerEnd = ajaxCommentSource.indexOf('\n    renderThreadFooter: function', handlerStart);
    const collapseHandler = ajaxCommentSource.slice(handlerStart, handlerEnd);

    assert.ok(handlerStart > -1 && handlerEnd > handlerStart, 'collapse handler should exist');
    assert.match(collapseHandler, /classList\.contains\('comment-thread-collapse'\)/);
    assert.match(collapseHandler, /AjaxComment\.updateThreadLayout\(/);
    assert.match(collapseHandler, /data-thread-expanded', 'false'/);
    assert.match(collapseHandler, /trackFrames: false/);
    assert.doesNotMatch(collapseHandler, /scrollToWithHeader/);
});

test('comment thread spacing and reduced-motion entry remain stable', () => {
    const collapsedContentStart = commentStyles.indexOf('.comment-thread-panel.is-thread-collapsed');
    const collapsedInnerStart = commentStyles.indexOf('.comment-content-inner{', collapsedContentStart);
    const collapsedContentRule = commentStyles.slice(
        collapsedContentStart,
        collapsedInnerStart
    );

    assert.notEqual(collapsedContentStart, -1);
    assert.ok(collapsedInnerStart > collapsedContentStart);
    assert.doesNotMatch(collapsedContentRule, /line-height:/);
    assert.match(
        commentStyles,
        /&\.is-thread-footer-collapsed\s*\{[\s\S]*?padding-bottom:\s*0\.5rem;/
    );
    assert.doesNotMatch(ajaxCommentSource, /addClass\('is-collapsed'\)/);
    assert.doesNotMatch(commentStyles, /&\.is-collapsed\s*\{/);
    assert.doesNotMatch(commentStyles, /padding-bottom:\s*1\.8rem;/);
    assert.match(commentStyles, /html\.void-anchor-scrolling[\s\S]*?overflow-anchor:\s*none;/);
    assert.match(
        commentStyles,
        /@media \(prefers-reduced-motion: reduce\)[\s\S]*?#comments\.float-up[\s\S]*?animation:\s*none;/
    );
});

function createAntiSpamEnvironment() {
    const listeners = new Map();
    const document = {
        createElement() {
            return {};
        },
        documentElement: {
            contains(form) {
                return form.attached;
            }
        }
    };
    const window = {
        addEventListener(name, listener) {
            const current = listeners.get(name) || [];
            current.push(listener);
            listeners.set(name, current);
        },
        removeEventListener(name, listener) {
            const current = listeners.get(name) || [];
            listeners.set(name, current.filter((candidate) => candidate !== listener));
        }
    };
    const form = {
        appended: [],
        attached: true,
        appendChild(input) {
            this.appended.push(input);
        },
        querySelector(selector) {
            if (selector !== 'input[name="_"]') {
                return null;
            }
            return this.appended.find((input) => input.name === '_') || null;
        }
    };

    return { document, form, listeners, window };
}

test('PJAX anti-spam token waits for a real interaction and cleans listeners', () => {
    const environment = createAntiSpamEnvironment();
    const ajaxComment = loadAjaxComment(() => ({}), environment.document, environment.window);

    ajaxComment.installAntiSpamToken(environment.form, 'secure-token');
    assert.deepEqual(
        Array.from(environment.listeners.keys()).sort(),
        ['keyup', 'mousemove', 'scroll', 'touchstart']
    );
    assert.equal(environment.form.appended.length, 0);

    environment.listeners.get('mousemove')[0]();
    assert.equal(environment.form.appended.length, 1);
    assert.equal(environment.form.appended[0].name, '_');
    assert.equal(environment.form.appended[0].value, 'secure-token');
    assert.equal(Array.from(environment.listeners.values()).every((items) => items.length === 0), true);
    assert.equal(ajaxComment.antiSpamCleanup, null);
});

test('installing a PJAX token retires the previous detached-form listeners', () => {
    const environment = createAntiSpamEnvironment();
    const ajaxComment = loadAjaxComment(() => ({}), environment.document, environment.window);
    const oldForm = environment.form;
    const newForm = Object.assign({}, oldForm, { appended: [], attached: true });

    ajaxComment.installAntiSpamToken(oldForm, 'old-token');
    oldForm.attached = false;
    ajaxComment.installAntiSpamToken(newForm, 'new-token');

    assert.equal(Array.from(environment.listeners.values()).every((items) => items.length === 1), true);
    environment.listeners.get('keyup')[0]();
    assert.equal(oldForm.appended.length, 0);
    assert.equal(newForm.appended[0].value, 'new-token');
});

class FakeDomNode {
    constructor(tagName, id = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.name = '';
        this.parentNode = null;
        this.children = [];
        this.style = {};
        this.attributes = new Map();
        this.classes = new Set();
        this.listeners = new Map();
        this.nodeType = 1;
        this.textContent = '';
        this.classList = {
            add: (...names) => names.forEach((name) => this.classes.add(name)),
            contains: (name) => this.classes.has(name),
            remove: (...names) => names.forEach((name) => this.classes.delete(name)),
            toggle: (name, force) => {
                if (force === undefined ? !this.classes.has(name) : force) {
                    this.classes.add(name);
                    return true;
                }
                this.classes.delete(name);
                return false;
            }
        };
    }

    get className() {
        return Array.from(this.classes).join(' ');
    }

    set className(value) {
        this.classes = new Set(String(value || '').split(/\s+/).filter(Boolean));
    }

    get firstChild() {
        return this.children[0] || null;
    }

    get firstElementChild() {
        return this.firstChild;
    }

    get parentElement() {
        return this.parentNode;
    }

    get nextSibling() {
        if (!this.parentNode) {
            return null;
        }
        const index = this.parentNode.children.indexOf(this);
        return this.parentNode.children[index + 1] || null;
    }

    get nextElementSibling() {
        return this.nextSibling;
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    insertBefore(child, reference) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }
        const index = reference ? this.children.indexOf(reference) : -1;
        child.parentNode = this;
        if (index === -1) {
            this.children.push(child);
        } else {
            this.children.splice(index, 0, child);
        }
        return child;
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parentNode = null;
        }
        return child;
    }

    addEventListener(name, listener) {
        const listeners = this.listeners.get(name) || [];
        listeners.push(listener);
        this.listeners.set(name, listeners);
    }

    contains(node) {
        if (node === this) return true;
        return this.children.some((child) => child.contains(node));
    }

    getAttribute(name) {
        if (name === 'class') return this.className || null;
        if (name === 'id') return this.id || null;
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    hasAttribute(name) {
        return this.getAttribute(name) !== null;
    }

    matches(selector) {
        if (selector === 'form') return this.tagName === 'FORM';
        if (selector === 'input[name="parent"]') {
            return this.tagName === 'INPUT' && this.name === 'parent';
        }
        if (selector === 'textarea[name="text"]') {
            return this.tagName === 'TEXTAREA' && this.name === 'text';
        }
        if (selector === 'button') return this.tagName === 'BUTTON';
        if (selector === 'button[data-thread-page]') {
            return this.tagName === 'BUTTON' && this.hasAttribute('data-thread-page');
        }
        if (selector[0] === '#') return this.id === selector.slice(1);
        if (selector[0] === '.') {
            return selector.slice(1).split('.').every((name) => this.classes.has(name));
        }
        return false;
    }

    closest(selector) {
        let node = this;
        while (node) {
            if (node.matches(selector)) return node;
            node = node.parentNode;
        }
        return null;
    }

    querySelector(selector) {
        for (const child of this.children) {
            if (child.matches(selector)) {
                return child;
            }
            const nested = child.querySelector(selector);
            if (nested) {
                return nested;
            }
        }
        return null;
    }

    querySelectorAll(selector) {
        const matches = [];
        for (const child of this.children) {
            if (child.matches(selector)) matches.push(child);
            matches.push(...child.querySelectorAll(selector));
        }
        return matches;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    setAttribute(name, value) {
        if (name === 'id') {
            this.id = String(value);
            return;
        }
        if (name === 'class') {
            this.className = value;
            return;
        }
        this.attributes.set(name, String(value));
    }

    focus(options) {
        this.focused = true;
        this.focusOptions = options;
    }
}

test('reply form is placed after the trigger block and restored on cancel', () => {
    const nodes = new Map();
    const container = new FakeDomNode('div');
    const response = new FakeDomNode('div', 'respond-post-1');
    const form = new FakeDomNode('form');
    const textarea = new FakeDomNode('textarea');
    const comment = new FakeDomNode('div', 'comment-12');
    const content = new FakeDomNode('div');
    const trigger = new FakeDomNode('a');
    const thread = new FakeDomNode('div');
    const cancel = new FakeDomNode('a', 'cancel-comment-reply-link');
    const preserved = [];
    const layoutEvents = [];

    textarea.name = 'text';
    textarea.focus = (options) => {
        textarea.focused = true;
        textarea.focusOptions = options;
        layoutEvents.push('focus');
    };
    content.appendChild(trigger);
    comment.appendChild(content);
    comment.appendChild(thread);
    form.appendChild(textarea);
    response.appendChild(form);
    container.appendChild(response);
    [response, comment, cancel].forEach((node) => nodes.set(node.id, node));

    const insertReplyForm = comment.insertBefore.bind(comment);
    comment.insertBefore = (child, reference) => {
        const inserted = insertReplyForm(child, reference);
        const parent = form.querySelector('input[name="parent"]');

        if (child === response && parent) {
            parent.value = '';
            parent.removeAttribute('value');
        }
        return inserted;
    };

    const document = {
        createElement(tagName) {
            const node = new FakeDomNode(tagName);
            if (tagName === 'div') {
                nodes.set('void-comment-form-place-holder', node);
            }
            return node;
        },
        getElementById(id) {
            if (id === 'void-comment-form-place-holder') {
                return container.children.find((node) => node.id === id)
                    || comment.children.find((node) => node.id === id)
                    || null;
            }
            return nodes.get(id) || null;
        },
        querySelector(selector) {
            return selector === '.respond' ? response : null;
        }
    };
    const window = {
        VOID_AnchorScroller: {
            preserveElement(element, callback) {
                preserved.push(element);
                layoutEvents.push('preserve:start');
                callback();
                layoutEvents.push('preserve:end');
            }
        }
    };
    const ajaxComment = loadAjaxComment(() => ({}), document, window);

    assert.equal(ajaxComment.moveReplyForm('comment-12', '12', trigger), false);
    assert.deepEqual(comment.children, [content, response, thread]);
    assert.equal(form.querySelector('input[name="parent"]').value, '12');
    assert.equal(form.querySelector('input[name="parent"]').getAttribute('value'), '12');
    assert.equal(textarea.focused, true);
    assert.equal(textarea.focusOptions.preventScroll, true);
    assert.equal(cancel.style.display, '');
    assert.deepEqual(preserved, [comment]);
    assert.deepEqual(layoutEvents, ['preserve:start', 'preserve:end', 'focus']);

    ajaxComment.restoreReplyForm();
    assert.equal(container.children[0], response);
    assert.equal(form.querySelector('input[name="parent"]'), null);
    assert.equal(cancel.style.display, 'none');
    assert.deepEqual(preserved, [comment, comment]);
});

test('nested replies flatten once and thread controls paginate without duplicate listeners', () => {
    const parent = new FakeDomNode('div', 'comment-1');
    const children = new FakeDomNode('div');
    const list = new FakeDomNode('div');
    const replies = [];
    const preserveCalls = [];

    parent.classList.add('comment-body', 'comment-parent');
    children.classList.add('comment-children');
    list.classList.add('comment-list');
    children.appendChild(list);
    parent.appendChild(children);

    for (let index = 0; index < 10; index++) {
        const reply = new FakeDomNode('div', `comment-${index + 2}`);
        reply.classList.add('comment-body', 'comment-child');
        reply.setAttribute('data-comment-depth', index < 2 ? '1' : '2');
        replies.push(reply);
    }

    list.appendChild(replies[0]);
    list.appendChild(replies[1]);
    const nestedChildren = new FakeDomNode('div');
    const nestedList = new FakeDomNode('div');
    nestedChildren.classList.add('comment-children');
    nestedList.classList.add('comment-list');
    nestedChildren.appendChild(nestedList);
    nestedList.appendChild(replies[2]);
    nestedList.appendChild(replies[3]);
    replies[1].appendChild(nestedChildren);
    replies.slice(4).forEach((reply) => list.appendChild(reply));

    const findById = (node, id) => {
        if (node.id === id) return node;
        for (const child of node.children) {
            const match = findById(child, id);
            if (match) return match;
        }
        return null;
    };
    const document = {
        createElement(tagName) {
            return new FakeDomNode(tagName);
        },
        getElementById(id) {
            return findById(parent, id);
        }
    };
    const window = {
        VOID_AnchorScroller: {
            preserveElement(root, callback, options) {
                preserveCalls.push({ options, root });
                callback();
            }
        }
    };
    const ajaxComment = loadAjaxComment(null, document, window);
    const threadList = ajaxComment.ensureThreadPanel(children);

    assert.equal(children.classList.contains('comment-thread-panel'), true);
    assert.deepEqual(
        Array.from(ajaxComment.getDirectElements(threadList, '.comment-thread-item'), (item) => item.id),
        replies.map((item) => item.id)
    );
    assert.equal(replies[1].querySelector('.comment-children'), null);
    assert.equal(children.listeners.get('click').length, 1);
    ajaxComment.ensureThreadPanel(children);
    assert.equal(children.listeners.get('click').length, 1);

    children.setAttribute('data-thread-expanded', 'false');
    ajaxComment.renderThreadPage(children, 1);
    let visible = replies.filter((reply) => !reply.classList.contains('is-thread-hidden'));
    assert.deepEqual(visible.map((reply) => reply.id), ['comment-2']);

    let expand = children.querySelector('.comment-thread-expand');
    children.__voidThreadHandler({ target: expand });
    visible = replies.filter((reply) => !reply.classList.contains('is-thread-hidden'));
    assert.equal(children.getAttribute('data-thread-expanded'), 'true');
    assert.equal(visible.length, 8);
    assert.equal(children.querySelector('.comment-thread-collapse').focusOptions.preventScroll, true);

    const next = children.querySelector('.comment-thread-next');
    children.__voidThreadHandler({ target: next });
    visible = replies.filter((reply) => !reply.classList.contains('is-thread-hidden'));
    assert.deepEqual(visible.map((reply) => reply.id), ['comment-10', 'comment-11']);
    assert.equal(children.getAttribute('data-thread-page'), '2');
    assert.equal(children.querySelector('.comment-thread-page.is-active').focusOptions.preventScroll, true);

    const collapse = children.querySelector('.comment-thread-collapse');
    children.__voidThreadHandler({ target: collapse });
    visible = replies.filter((reply) => !reply.classList.contains('is-thread-hidden'));
    assert.deepEqual(visible.map((reply) => reply.id), ['comment-2']);
    expand = children.querySelector('.comment-thread-expand');
    assert.equal(expand.focusOptions.preventScroll, true);
    assert.equal(preserveCalls.length, 3);
    assert.equal(preserveCalls[2].options.trackFrames, false);
});

test('TypechoComment compatibility facade never replaces a plugin implementation', () => {
    const pluginComment = { reply() {} };
    const pluginWindow = { TypechoComment: pluginComment };
    const pluginAjaxComment = loadAjaxComment(() => ({}), {}, pluginWindow);

    pluginAjaxComment.ensureTypechoCommentFacade();
    assert.equal(pluginWindow.TypechoComment, pluginComment);

    const fallbackWindow = {};
    const fallbackAjaxComment = loadAjaxComment(() => ({}), {}, fallbackWindow);
    fallbackAjaxComment.ensureTypechoCommentFacade();
    assert.equal(typeof fallbackWindow.TypechoComment.reply, 'function');
    assert.equal(typeof fallbackWindow.TypechoComment.cancelReply, 'function');
});

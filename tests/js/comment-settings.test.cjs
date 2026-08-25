const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const voidSource = fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.js'), 'utf8');
const ajaxCommentStart = voidSource.indexOf('var AjaxComment = {');
const ajaxCommentEnd = voidSource.indexOf('\n};\n\n(function ()', ajaxCommentStart);

assert.notEqual(ajaxCommentStart, -1, 'AjaxComment source should exist');
assert.notEqual(ajaxCommentEnd, -1, 'AjaxComment source should have a stable boundary');

function loadAjaxComment(jQuery, document = {}, window = {}) {
    window.window = window;
    const context = {
        $: jQuery,
        document,
        window
    };

    vm.runInNewContext(
        voidSource.slice(ajaxCommentStart, ajaxCommentEnd + 3),
        context
    );
    return context.AjaxComment;
}

function selectorJQuery(state) {
    return (selector) => {
        if (selector === '#comments') {
            return {
                attr(name) {
                    return name === 'data-comments-order' ? state.order : undefined;
                }
            };
        }

        return {
            length: selector === '#comments .pager .prev'
                ? state.hasPrev ? 1 : 0
                : selector === '#comments .pager .next' && state.hasNext ? 1 : 0
        };
    };
}

test('comment page boundary follows the configured ASC or DESC order', () => {
    const state = { order: 'DESC', hasPrev: false, hasNext: true };
    const ajaxComment = loadAjaxComment(selectorJQuery(state));

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
    const ajaxComment = loadAjaxComment(selectorJQuery(state));
    const calls = [];
    const comment = { id: 'new-comment' };
    let footer = { length: 0 };
    const list = {
        append(value) {
            calls.push(['append', value]);
        },
        children() {
            return {
                first() {
                    return footer;
                }
            };
        },
        prepend(value) {
            calls.push(['prepend', value]);
        }
    };

    ajaxComment.insertNewestComment(list, comment);
    assert.deepEqual(calls.pop(), ['prepend', comment]);

    state.order = 'ASC';
    ajaxComment.insertNewestComment(list, comment);
    assert.deepEqual(calls.pop(), ['append', comment]);

    footer = {
        length: 1,
        before(value) {
            calls.push(['before-footer', value]);
        }
    };
    ajaxComment.insertNewestComment(list, comment);
    assert.deepEqual(calls.pop(), ['before-footer', comment]);
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
    }

    get nextSibling() {
        if (!this.parentNode) {
            return null;
        }
        const index = this.parentNode.children.indexOf(this);
        return this.parentNode.children[index + 1] || null;
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

    querySelector(selector) {
        const matches = (node) => selector === 'form'
            ? node.tagName === 'FORM'
            : selector === 'input[name="parent"]'
                ? node.tagName === 'INPUT' && node.name === 'parent'
                : selector === 'textarea[name="text"]'
                    ? node.tagName === 'TEXTAREA' && node.name === 'text'
                    : false;

        for (const child of this.children) {
            if (matches(child)) {
                return child;
            }
            const nested = child.querySelector(selector);
            if (nested) {
                return nested;
            }
        }
        return null;
    }

    focus() {
        this.focused = true;
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

    textarea.name = 'text';
    content.appendChild(trigger);
    comment.appendChild(content);
    comment.appendChild(thread);
    form.appendChild(textarea);
    response.appendChild(form);
    container.appendChild(response);
    [response, comment, cancel].forEach((node) => nodes.set(node.id, node));

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
    const ajaxComment = loadAjaxComment(() => ({}), document, {});

    assert.equal(ajaxComment.moveReplyForm('comment-12', '12', trigger), false);
    assert.deepEqual(comment.children, [content, response, thread]);
    assert.equal(form.querySelector('input[name="parent"]').value, '12');
    assert.equal(textarea.focused, true);
    assert.equal(cancel.style.display, '');

    ajaxComment.restoreReplyForm();
    assert.equal(container.children[0], response);
    assert.equal(form.querySelector('input[name="parent"]'), null);
    assert.equal(cancel.style.display, 'none');
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

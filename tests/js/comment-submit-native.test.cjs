const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const voidSource = fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.js'), 'utf8');
const ajaxCommentStart = voidSource.indexOf('var AjaxComment = {');
const ajaxCommentEnd = voidSource.indexOf('\n};\n\nfunction VOID_onReady', ajaxCommentStart);

class FakeFormData {
    constructor(form) {
        this.values = form.entries.slice();
    }

    forEach(callback) {
        this.values.forEach(([name, value]) => callback(value, name, this));
    }
}

class FakeField {
    constructor(value = '', required = false) {
        this.value = value;
        this.required = required;
    }

    hasAttribute(name) {
        return name === 'required' && this.required;
    }
}

class FakeForm {
    constructor({ anonymous = false, text = '有效评论' } = {}) {
        this.action = 'http://localhost.test/post/comment';
        this.method = 'post';
        this.connected = true;
        this.listeners = new Map();
        this.button = { disabled: false, textContent: '提交评论' };
        this.fields = {
            '#author': anonymous ? new FakeField('访客', true) : null,
            '#mail': anonymous ? new FakeField('visitor@example.com', true) : null,
            '#url': anonymous ? new FakeField('', false) : null,
            '#textarea': new FakeField(text)
        };
        this.entries = anonymous
            ? [['author', '访客'], ['mail', 'visitor@example.com'], ['url', ''], ['text', text]]
            : [['text', text]];
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

    dispatchSubmit() {
        const event = {
            defaultPrevented: false,
            preventDefault() {
                this.defaultPrevented = true;
            }
        };
        (this.listeners.get('submit') || []).slice().forEach((listener) => listener(event));
        return event;
    }

    getAttribute(name) {
        if (name === 'action') return this.action;
        if (name === 'method') return this.method;
        return null;
    }

    querySelector(selector) {
        if (selector === '#comment-submit-button') return this.button;
        return this.fields[selector] || null;
    }
}

function createDocument(getForm) {
    return {
        documentElement: {
            contains(node) {
                return node.connected !== false;
            }
        },
        getElementById() {
            return null;
        },
        querySelector(selector) {
            if (selector === '#comment-form') return getForm();
            return null;
        },
        querySelectorAll() {
            return [];
        }
    };
}

function loadAjaxComment(options = {}) {
    const window = options.window || {};
    const alerts = [];
    const context = {
        AbortController: options.AbortController || AbortController,
        DOMParser: options.DOMParser || class {
            parseFromString() {
                throw new Error('DOMParser fixture missing');
            }
        },
        FormData: options.FormData || FakeFormData,
        URLSearchParams,
        document: options.document || {},
        fetch: options.fetch || (() => Promise.reject(new Error('fetch fixture missing'))),
        window,
        VOID: options.VOID || {
            alert(message) {
                alerts.push(message);
            }
        },
        VOID_AnchorScroller: window.VOID_AnchorScroller,
        VOID_Content: window.VOID_Content || { highlight() {} },
        VOID_Ui: window.VOID_Ui || { checkScrollTop() {}, scrollToWithHeader() {} },
        VOID_Vote: window.VOID_Vote || {}
    };

    window.window = window;
    vm.runInNewContext(voidSource.slice(ajaxCommentStart, ajaxCommentEnd + 3), context);
    return { ajaxComment: context.AjaxComment, alerts, context };
}

function responseDocument({ error = '', hasList = true, nodes = [] } = {}) {
    const byId = new Map(nodes.map((node) => [node.id, node]));

    return {
        getElementById(id) {
            return byId.get(id) || null;
        },
        querySelector(selector) {
            if (selector === 'parsererror') return null;
            if (selector === '#comments .comment-list') return hasList ? {} : null;
            if (selector === 'body .container' && error) return { textContent: error };
            return null;
        },
        querySelectorAll(selector) {
            return selector === '#comments [id^="comment-"]' ? nodes : [];
        }
    };
}

function commentNode(id, parent = '') {
    return {
        id: `comment-${id}`,
        style: {},
        getAttribute(name) {
            return name === 'data-comment-parent' ? parent : null;
        },
        matches() {
            return false;
        }
    };
}

function commentList(existing = []) {
    return {
        children: existing.slice(),
        get firstChild() {
            return this.children[0] || null;
        },
        get firstElementChild() {
            return this.firstChild;
        },
        appendChild(node) {
            this.children.push(node);
        },
        insertBefore(node, reference) {
            const index = this.children.indexOf(reference);
            if (index === -1) {
                this.children.push(node);
            } else {
                this.children.splice(index, 0, node);
            }
        }
    };
}

function activateSubmit(ajaxComment, form, generation = 1) {
    const token = { commentIds: [] };
    ajaxComment.submitForm = form;
    ajaxComment.submitToken = token;
    ajaxComment.submitGeneration = generation;
    return token;
}

function settle() {
    return new Promise((resolve) => setImmediate(resolve));
}

test('anonymous validation covers required identity fields while logged-in comments only require text', () => {
    const anonymous = new FakeForm({ anonymous: true });
    const loggedIn = new FakeForm();
    const { ajaxComment } = loadAjaxComment();

    anonymous.fields['#author'].value = '   ';
    assert.equal(ajaxComment.validateCommentForm(anonymous), ajaxComment.noName);
    anonymous.fields['#author'].value = '访客';
    anonymous.fields['#mail'].value = '';
    assert.equal(ajaxComment.validateCommentForm(anonymous), ajaxComment.noMail);
    anonymous.fields['#mail'].value = 'invalid@example.technology';
    assert.equal(ajaxComment.validateCommentForm(anonymous), ajaxComment.invalidMail);
    anonymous.fields['#mail'].value = 'visitor@example.com';
    anonymous.fields['#url'].required = true;
    assert.equal(ajaxComment.validateCommentForm(anonymous), ajaxComment.noUrl);
    anonymous.fields['#url'].required = false;
    anonymous.fields['#textarea'].value = '\n\t ';
    assert.equal(ajaxComment.validateCommentForm(anonymous), ajaxComment.noContent);

    assert.equal(ajaxComment.validateCommentForm(loggedIn), '');
    loggedIn.fields['#textarea'].value = '';
    assert.equal(ajaxComment.validateCommentForm(loggedIn), ajaxComment.noContent);
});

test('FormData is appended into URLSearchParams without losing duplicates or special characters', () => {
    const form = new FakeForm();
    const { ajaxComment } = loadAjaxComment();

    form.entries = [
        ['text', '中文\n& + = % ? / : ::aru::'],
        ['duplicate', 'first'],
        ['duplicate', 'second'],
        ['empty', '']
    ];
    const body = ajaxComment.buildSubmitBody(form);

    assert.deepEqual(Array.from(body.entries()), form.entries);
    assert.equal(body.getAll('duplicate').length, 2);
    assert.equal(body.get('text'), '中文\n& + = % ? / : ::aru::');
    assert.match(body.toString(), /duplicate=first&duplicate=second/);
    assert.match(body.toString(), /%26\+%2B\+%3D\+%25\+%3F/);
});

test('submit binds once, sends the verified URL-encoded contract, and blocks duplicates', async () => {
    const form = new FakeForm();
    const calls = [];
    let resolveFetch;
    const document = createDocument(() => form);
    const fetch = (url, options) => {
        calls.push({ options, url });
        return new Promise((resolve) => {
            resolveFetch = resolve;
        });
    };
    const { ajaxComment } = loadAjaxComment({ document, fetch });
    const applied = [];

    ajaxComment.applySubmitResponse = (...args) => {
        applied.push(args);
        ajaxComment.err(form);
    };
    ajaxComment.bindSubmit();
    ajaxComment.bindSubmit();
    assert.equal(form.listeners.get('submit').length, 1);

    assert.equal(form.dispatchSubmit().defaultPrevented, true);
    form.dispatchSubmit();
    assert.equal(calls.length, 1);
    assert.equal(form.button.disabled, true);
    assert.equal(form.button.textContent, '提交中');
    assert.equal(calls[0].url, form.action);
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.credentials, 'same-origin');
    assert.equal(
        calls[0].options.headers['Content-Type'],
        'application/x-www-form-urlencoded;charset=UTF-8'
    );
    assert.equal(calls[0].options.headers['X-Requested-With'], 'XMLHttpRequest');
    assert.equal(calls[0].options.body.get('text'), '有效评论');

    resolveFetch({ ok: true, text: () => Promise.resolve('<html>ok</html>'), url: form.action });
    await settle();
    assert.equal(applied.length, 1);
    assert.equal(form.button.disabled, false);
    assert.equal(form.button.textContent, '提交评论');
    assert.equal(ajaxComment.submitToken, null);
});

test('HTTP error HTML is reduced to safe text and always restores the button', () => {
    const form = new FakeForm();
    const document = createDocument(() => form);
    const { ajaxComment, alerts } = loadAjaxComment({ document });
    const token = activateSubmit(ajaxComment, form);
    const parsed = responseDocument({ error: '  必须填写用户名  \n  邮箱地址不合法  ' });

    ajaxComment.parseCommentResponse = () => parsed;
    form.button.disabled = true;
    form.button.textContent = '提交中';
    ajaxComment.applySubmitResponse(
        { ok: false, url: form.action },
        '<error>',
        form,
        token,
        1
    );

    assert.equal(alerts[0], '提交失败！请重试。\n必须填写用户名\n邮箱地址不合法');
    assert.equal(form.button.disabled, false);
    assert.equal(form.button.textContent, '提交评论');
});

test('missing comment lists and missing new comments fail without reloading', () => {
    const form = new FakeForm();
    const document = createDocument(() => form);
    const window = { location: { reload: () => assert.fail('malformed HTML must not reload') } };
    const { ajaxComment, alerts } = loadAjaxComment({ document, window });

    let token = activateSubmit(ajaxComment, form, 1);
    ajaxComment.parseCommentResponse = () => responseDocument({ hasList: false });
    ajaxComment.applySubmitResponse({ ok: true, url: form.action }, '<html>', form, token, 1);
    assert.equal(alerts.length, 1);

    token = activateSubmit(ajaxComment, form, 2);
    ajaxComment.parseCommentResponse = () => responseDocument({ hasList: true });
    ajaxComment.applySubmitResponse({ ok: true, url: form.action }, '<html>', form, token, 2);
    assert.equal(alerts.length, 2);
    assert.equal(form.button.disabled, false);
});

test('a successful page without a new response ID is not mistaken for a submitted comment', () => {
    const form = new FakeForm();
    const document = createDocument(() => form);
    const { ajaxComment, alerts } = loadAjaxComment({ document });
    const oldComment = commentNode(41);
    const parsed = responseDocument({ nodes: [oldComment] });
    const token = activateSubmit(ajaxComment, form, 1);

    token.commentIds = ['comment-41'];
    ajaxComment.parseCommentResponse = () => parsed;
    ajaxComment.applySubmitResponse({ ok: true, url: form.action }, '', form, token, 1);

    assert.deepEqual(alerts, ['提交失败！请重试。']);
    assert.equal(ajaxComment.newID, '');
    assert.equal(form.button.disabled, false);
});

test('successful parsed responses insert DESC/ASC roots and replies through the native helpers', () => {
    const form = new FakeForm();
    const currentDocument = createDocument(() => form);
    currentDocument.importNode = (node) => node;
    const { ajaxComment, alerts } = loadAjaxComment({ document: currentDocument });
    const existing = commentNode(10);
    const list = commentList([existing]);
    let finished = 0;
    let revealed = 0;
    let reply;

    ajaxComment.finish = () => { finished += 1; };
    ajaxComment.revealComment = () => { revealed += 1; };
    ajaxComment.ensureCommentList = () => list;
    ajaxComment.isNewestCommentPage = () => true;

    let fresh = commentNode(42);
    let parsed = responseDocument({ nodes: [existing, fresh] });
    let token = activateSubmit(ajaxComment, form, 1);
    ajaxComment.parseCommentResponse = () => parsed;
    ajaxComment.getCommentsOrder = () => 'DESC';
    ajaxComment.applySubmitResponse({ ok: true, url: `${form.action}#comment-42` }, '', form, token, 1);
    assert.deepEqual(list.children.map((node) => node.id), ['comment-42', 'comment-10']);

    fresh = commentNode(43);
    parsed = responseDocument({ nodes: [existing, fresh] });
    token = activateSubmit(ajaxComment, form, 2);
    ajaxComment.parseCommentResponse = () => parsed;
    ajaxComment.getCommentsOrder = () => 'ASC';
    ajaxComment.applySubmitResponse({ ok: true, url: `${form.action}#comment-43` }, '', form, token, 2);
    assert.deepEqual(list.children.map((node) => node.id), ['comment-42', 'comment-10', 'comment-43']);

    fresh = commentNode(44, '10');
    parsed = responseDocument({ nodes: [existing, fresh] });
    token = activateSubmit(ajaxComment, form, 3);
    ajaxComment.parseCommentResponse = () => parsed;
    ajaxComment.parentID = 'comment-10';
    ajaxComment.insertReplyComment = (node) => {
        reply = node;
        return true;
    };
    ajaxComment.applySubmitResponse({ ok: true, url: `${form.action}#comment-44` }, '', form, token, 3);
    assert.equal(reply.id, 'comment-44');
    assert.equal(reply.getAttribute('data-comment-parent'), '10');
    assert.equal(ajaxComment.parentID, '');
    assert.equal(finished, 3);
    assert.equal(revealed, 3);
    assert.deepEqual(alerts, ['评论成功！', '评论成功！', '评论成功！']);
});

test('a root comment submitted from a stale page reports the configured ASC/DESC destination', () => {
    const form = new FakeForm();
    const document = createDocument(() => form);
    const { ajaxComment, alerts } = loadAjaxComment({ document });
    const fresh = commentNode(45);
    const parsed = responseDocument({ nodes: [fresh] });
    let finished = 0;

    ajaxComment.parseCommentResponse = () => parsed;
    ajaxComment.isNewestCommentPage = () => false;
    ajaxComment.finish = () => { finished += 1; };

    let token = activateSubmit(ajaxComment, form, 1);
    ajaxComment.getCommentsOrder = () => 'ASC';
    ajaxComment.applySubmitResponse({ ok: true, url: `${form.action}#comment-45` }, '', form, token, 1);
    token = activateSubmit(ajaxComment, form, 2);
    ajaxComment.getCommentsOrder = () => 'DESC';
    ajaxComment.applySubmitResponse({ ok: true, url: `${form.action}#comment-45` }, '', form, token, 2);

    assert.deepEqual(alerts, [
        '评论成功！请前往评论最后一页查看。',
        '评论成功！请回到评论第一页查看。'
    ]);
    assert.equal(finished, 2);
});

test('DOMParser failures and network failures restore state without writing response DOM', async () => {
    for (const mode of ['parser', 'network']) {
        const form = new FakeForm();
        const document = createDocument(() => form);
        const fetch = mode === 'network'
            ? () => Promise.reject(new Error('offline'))
            : () => Promise.resolve({
                ok: true,
                text: () => Promise.resolve('<not-a-comment-response>'),
                url: form.action
            });
        const { ajaxComment, alerts } = loadAjaxComment({ document, fetch });

        ajaxComment.bindSubmit();
        form.dispatchSubmit();
        await settle();
        assert.deepEqual(alerts, ['提交失败！请重试。']);
        assert.equal(form.button.disabled, false);
        assert.equal(form.button.textContent, '提交评论');
        assert.equal(ajaxComment.submitToken, null);
    }
});

test('replaced forms abort pending work and stale responses cannot update the new DOM', async () => {
    const oldForm = new FakeForm();
    const newForm = new FakeForm({ text: '新页面评论' });
    let currentForm = oldForm;
    let resolveFetch;
    const calls = [];
    const document = createDocument(() => currentForm);
    const fetch = (url, options) => {
        calls.push({ options, url });
        return new Promise((resolve) => {
            resolveFetch = resolve;
        });
    };
    const { ajaxComment } = loadAjaxComment({ document, fetch });
    let applied = 0;

    ajaxComment.applySubmitResponse = () => { applied += 1; };
    ajaxComment.bindSubmit();
    oldForm.dispatchSubmit();
    assert.equal(oldForm.button.disabled, true);

    oldForm.connected = false;
    currentForm = newForm;
    ajaxComment.bindSubmit();
    assert.equal(calls[0].options.signal.aborted, true);
    assert.equal(oldForm.button.disabled, false);
    assert.equal((oldForm.listeners.get('submit') || []).length, 0);
    assert.equal((newForm.listeners.get('submit') || []).length, 1);

    resolveFetch({ ok: true, text: () => Promise.resolve('<html>stale</html>'), url: oldForm.action });
    await settle();
    assert.equal(applied, 0);
    assert.equal(newForm.button.disabled, false);
});

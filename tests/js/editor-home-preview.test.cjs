const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorPath = path.resolve(__dirname, '../../assets/editor.js');
const editorCssPath = path.resolve(__dirname, '../../assets/editor-admin.css');
const editorSource = fs.readFileSync(editorPath, 'utf8');
const editorCssSource = fs.readFileSync(editorCssPath, 'utf8');

class FakeFormData {
    constructor(entries = []) {
        if (Array.isArray(entries)) {
            this.values = entries.slice();
            return;
        }

        this.values = [];
        for (const control of entries.descendants()) {
            if (
                !control.disabled
                && control.name
                && ['INPUT', 'SELECT', 'TEXTAREA'].includes(control.tagName)
            ) {
                this.values.push([control.name, control.value]);
            }
        }
    }

    append(name, value) {
        this.values.push([name, value]);
    }

    entries() {
        return this.values[Symbol.iterator]();
    }

    forEach(callback) {
        this.values.forEach(([name, value]) => callback(value, name, this));
    }

    getAll(name) {
        return this.values
            .filter(([entryName]) => entryName === name)
            .map(([, value]) => value);
    }
}

class FakeElement {
    constructor(tagName, ownerDocument) {
        this.attributes = new Map();
        this.children = [];
        this.className = '';
        this.disabled = false;
        this.hidden = false;
        this.id = '';
        this.listeners = new Map();
        this.name = '';
        this.ownerDocument = ownerDocument;
        this.parentNode = null;
        this.tagName = String(tagName).toUpperCase();
        this.value = '';
    }

    get nextSibling() {
        if (!this.parentNode) {
            return null;
        }

        const index = this.parentNode.children.indexOf(this);
        return index === -1 ? null : this.parentNode.children[index + 1] || null;
    }

    appendChild(child) {
        return this.insertBefore(child, null);
    }

    insertBefore(child, reference) {
        if (child.parentNode) {
            child.parentNode.removeChild(child);
        }

        const index = reference ? this.children.indexOf(reference) : -1;
        if (reference && index === -1) {
            throw new Error('Reference node is not a child');
        }

        child.parentNode = this;
        if (index === -1) {
            this.children.push(child);
        } else {
            this.children.splice(index, 0, child);
        }
        this.ownerDocument.queueMutation(this);
        return child;
    }

    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parentNode = null;
            this.ownerDocument.queueMutation(this);
        }
        return child;
    }

    descendants() {
        const result = [];
        for (const child of this.children) {
            result.push(child, ...child.descendants());
        }
        return result;
    }

    contains(node) {
        return node === this || this.descendants().includes(node);
    }

    setAttribute(name, value) {
        const normalized = String(value);
        this.attributes.set(name, normalized);
        if (name === 'class') {
            this.className = normalized;
        } else if (name === 'id') {
            this.id = normalized;
        } else if (name === 'name') {
            this.name = normalized;
        }
    }

    getAttribute(name) {
        if (name === 'class') {
            return this.className || null;
        }
        if (name === 'id') {
            return this.id || null;
        }
        if (name === 'name') {
            return this.name || null;
        }
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    addEventListener(name, listener) {
        if (!this.listeners.has(name)) {
            this.listeners.set(name, []);
        }
        this.listeners.get(name).push(listener);
    }

    removeEventListener(name, listener) {
        const listeners = this.listeners.get(name) || [];
        this.listeners.set(name, listeners.filter((candidate) => candidate !== listener));
    }

    dispatchEvent(event) {
        event.target = event.target || this;
        event.currentTarget = this;
        for (const listener of this.listeners.get(event.type) || []) {
            listener.call(this, event);
        }
    }

    focus() {
        this.ownerDocument.activeElement = this;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        return this.descendants().filter((element) => matchesSelector(element, selector));
    }
}

function matchesSelector(element, selector) {
    if (selector === '[role="menuitem"]:not(:disabled):not([hidden])') {
        return element.getAttribute('role') === 'menuitem' && !element.disabled && !element.hidden;
    }

    const attributeMatch = selector.match(/^([a-z]+)?\[([\w-]+)="([^"]*)"\]$/i);
    if (attributeMatch) {
        const [, tagName, name, value] = attributeMatch;
        return (!tagName || element.tagName === tagName.toUpperCase())
            && String(element[name] || element.getAttribute(name) || '') === value;
    }

    if (selector.startsWith('#')) {
        return element.id === selector.slice(1);
    }
    if (selector.startsWith('.')) {
        return element.className.split(/\s+/).includes(selector.slice(1));
    }
    return element.tagName === selector.toUpperCase();
}

class FakeDocument extends FakeElement {
    constructor() {
        super('#document', null);
        this.ownerDocument = this;
        this.activeElement = null;
        this.mutationObservers = [];
        this.mutationPending = false;
        this.documentElement = new FakeElement('html', this);
        this.body = new FakeElement('body', this);
        this.documentElement.appendChild(this.body);
        this.children = [this.documentElement];
        this.mutationPending = false;
    }

    createElement(tagName) {
        return new FakeElement(tagName, this);
    }

    getElementById(id) {
        return this.descendants().find((element) => element.id === id) || null;
    }

    queueMutation() {
        this.mutationPending = true;
    }

    flushMutations() {
        let passes = 0;
        while (this.mutationPending && passes < 10) {
            this.mutationPending = false;
            for (const observer of this.mutationObservers) {
                if (observer.connected) {
                    observer.callback([], observer);
                }
            }
            passes++;
        }
    }
}

class FakeQuery {
    constructor(nodes, harness) {
        this.nodes = nodes.filter(Boolean);
        this.harness = harness;
    }

    find(selector) {
        return new FakeQuery(this.nodes.flatMap((node) => node.querySelectorAll(selector)), this.harness);
    }

    first() {
        return new FakeQuery(this.nodes.slice(0, 1), this.harness);
    }

    val(value) {
        if (arguments.length) {
            for (const node of this.nodes) {
                node.value = String(value);
            }
            return this;
        }
        return this.nodes[0] ? this.nodes[0].value : undefined;
    }

    on(names, listener) {
        for (const node of this.nodes) {
            for (const name of names.split(/\s+/)) {
                this.harness.addJqueryListener(node, name, listener);
            }
        }
        return this;
    }

    off(namespace) {
        for (const node of this.nodes) {
            this.harness.removeJqueryListeners(node, namespace);
        }
        return this;
    }

    trigger(name) {
        for (const node of this.nodes) {
            this.harness.emitJquery(node, name);
        }
        return this;
    }

    toArray() {
        return this.nodes.slice();
    }
}

function createHomePreviewHarness({ editArea = true } = {}) {
    const document = new FakeDocument();
    const jqueryListeners = new Map();
    const requests = [];
    const timers = new Map();
    const openedWindows = [];
    let changed = false;
    let nextTimerId = 1;

    const harness = {
        addJqueryListener(target, eventName, listener) {
            if (!jqueryListeners.has(target)) {
                jqueryListeners.set(target, []);
            }
            jqueryListeners.get(target).push({ eventName, listener });
        },
        removeJqueryListeners(target, namespace) {
            const listeners = jqueryListeners.get(target) || [];
            jqueryListeners.set(
                target,
                listeners.filter(({ eventName }) => !eventName.endsWith(namespace))
            );
        },
        emitJquery(target, name, args = []) {
            for (const entry of jqueryListeners.get(target) || []) {
                if (entry.eventName.split('.')[0] === name) {
                    entry.listener.call(target, { target, type: name }, ...args);
                }
            }
        }
    };

    const jQuery = (value) => {
        if (typeof value === 'function') {
            value();
            return new FakeQuery([], harness);
        }
        if (typeof value === 'string') {
            return new FakeQuery(document.querySelectorAll(value), harness);
        }
        return new FakeQuery([value], harness);
    };

    class MutationObserver {
        constructor(callback) {
            this.callback = callback;
            this.connected = true;
            document.mutationObservers.push(this);
        }

        observe() {
            this.connected = true;
        }

        disconnect() {
            this.connected = false;
        }
    }

    const window = {
        FormData: FakeFormData,
        MutationObserver,
        URL,
        VOIDHomePreviewConfig: {
            urlTemplate: 'https://example.test/?void_home_preview={cid}&_=token'
        },
        clearTimeout(id) {
            timers.delete(id);
        },
        jQuery,
        location: {
            href: 'https://example.test/admin/write-post.php'
        },
        open() {
            const previewWindow = {
                closed: false,
                close() {
                    this.closed = true;
                },
                location: {
                    href: '',
                    replace(url) {
                        this.href = url;
                    }
                },
                opener: {}
            };
            openedWindows.push(previewWindow);
            return previewWindow;
        },
        setTimeout(callback) {
            const id = nextTimerId++;
            timers.set(id, callback);
            return id;
        }
    };
    window.window = window;

    const form = document.createElement('form');
    form.setAttribute('name', 'write_post');
    form.setAttribute('action', '/admin/write-post.php');
    document.body.appendChild(form);

    const editorParent = document.createElement('div');
    editorParent.className = 'editor-parent';
    form.appendChild(editorParent);

    const addControl = (tagName, name, value) => {
        const control = document.createElement(tagName);
        control.setAttribute('name', name);
        control.value = value;
        form.appendChild(control);
        return control;
    };
    const cid = addControl('input', 'cid', '42');
    const title = addControl('input', 'title', '标题');
    const text = addControl('textarea', 'text', '已保存正文');

    if (editArea) {
        const area = document.createElement('div');
        area.id = 'wmd-editarea';
        editorParent.appendChild(area);
    }

    jQuery(form).on('datachange.typechoCore', () => {
        changed = true;
    });

    const Typecho = {
        savePost() {
            if (!changed) {
                return;
            }

            changed = false;
            const data = new FakeFormData(form);
            data.append('do', 'save');
            const xhr = {};
            const settings = {
                data,
                type: 'POST',
                url: form.getAttribute('action')
            };
            const request = {
                complete() {
                    harness.emitJquery(document, 'ajaxComplete', [xhr, settings]);
                },
                succeed(response = { cid: '42', success: 1 }) {
                    cid.value = String(response.cid);
                    harness.emitJquery(document, 'ajaxSuccess', [xhr, settings, response]);
                },
                settings,
                xhr
            };
            requests.push(request);
            harness.emitJquery(document, 'ajaxSend', [xhr, settings]);
        }
    };
    window.Typecho = Typecho;

    const context = {
        URL,
        console,
        document,
        window
    };
    vm.runInNewContext(extractHomePreviewSource(), context);

    return {
        api: context.VOID_HomePreview,
        click(element) {
            element.dispatchEvent({
                preventDefault() {},
                type: 'click'
            });
        },
        document,
        editorParent,
        flushMutations() {
            document.flushMutations();
        },
        flushTimers() {
            const callbacks = [...timers.values()];
            timers.clear();
            callbacks.forEach((callback) => callback());
        },
        form,
        jQuery,
        openedWindows,
        requests,
        text,
        title,
        Typecho
    };
}

function extractHomePreviewSource() {
    const startMarker = 'var VOID_HomePreview = (function ($) {';
    const endMarker = '})(window.jQuery);';
    const start = editorSource.indexOf(startMarker);
    const end = editorSource.indexOf(endMarker, start);

    assert.notEqual(start, -1, 'VOID_HomePreview IIFE should exist');
    assert.notEqual(end, -1, 'VOID_HomePreview IIFE should be complete');
    return editorSource.slice(start, end + endMarker.length);
}

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start + startMarker.length);

    assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
    assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
    return source.slice(start, end);
}

function loadHomePreviewTests() {
    const window = {
        URL,
        jQuery() {},
        location: {
            href: 'https://example.test/admin/write-post.php'
        }
    };
    window.window = window;

    const context = {
        URL,
        console,
        document: {},
        window
    };

    vm.runInNewContext(extractHomePreviewSource(), context);
    return context.VOID_HomePreview.__test;
}

const homePreviewSource = extractHomePreviewSource();
const preview = loadHomePreviewTests();

test('form fingerprints ignore Typecho volatile fields but retain content and field order', () => {
    const first = new FakeFormData([
        ['title', '标题'],
        ['text', '正文'],
        ['do', 'publish'],
        ['do', 'save'],
        ['cid', '12'],
        ['draft', '18'],
        ['timezone', '28800'],
        ['dst', '0'],
        ['fields[headline]', '摘要']
    ]);
    const volatileValuesChanged = new FakeFormData([
        ['title', '标题'],
        ['text', '正文'],
        ['do', 'publish'],
        ['cid', '999'],
        ['draft', '1001'],
        ['timezone', '0'],
        ['dst', '1'],
        ['fields[headline]', '摘要']
    ]);
    const bodyChanged = new FakeFormData([
        ['title', '标题'],
        ['text', '修改后的正文'],
        ['fields[headline]', '摘要']
    ]);
    const fieldChanged = new FakeFormData([
        ['title', '标题'],
        ['text', '正文'],
        ['fields[headline]', '修改后的摘要']
    ]);
    const reordered = new FakeFormData([
        ['text', '正文'],
        ['title', '标题'],
        ['fields[headline]', '摘要']
    ]);

    const fingerprint = preview.fingerprintFormData(first);
    assert.equal(fingerprint, preview.fingerprintFormData(volatileValuesChanged));
    assert.notEqual(fingerprint, preview.fingerprintFormData(bodyChanged));
    assert.notEqual(fingerprint, preview.fingerprintFormData(fieldChanged));
    assert.notEqual(fingerprint, preview.fingerprintFormData(reordered));
});

test('save request matching requires POST, the post form action, FormData and last do=save', () => {
    const baseUrl = 'https://example.test/admin/write-post.php';
    const formAction = '/admin/write-post.php';
    const saveData = new FakeFormData([
        ['do', 'publish'],
        ['title', '标题'],
        ['do', 'save']
    ]);
    const matching = {
        data: saveData,
        type: 'post',
        url: 'https://example.test/admin/write-post.php#editor'
    };

    assert.equal(preview.isSaveRequest(matching, formAction, FakeFormData, baseUrl), true);
    assert.equal(preview.isSaveRequest({ ...matching, type: 'GET' }, formAction, FakeFormData, baseUrl), false);
    assert.equal(preview.isSaveRequest({ ...matching, url: '/admin/write-page.php' }, formAction, FakeFormData, baseUrl), false);
    assert.equal(preview.isSaveRequest({ ...matching, data: { do: 'save' } }, formAction, FakeFormData, baseUrl), false);

    const publishLast = new FakeFormData([
        ['do', 'save'],
        ['do', 'publish']
    ]);
    assert.equal(
        preview.isSaveRequest({ ...matching, data: publishLast }, formAction, FakeFormData, baseUrl),
        false
    );
});

test('save responses require a canonical cid and preview with cid', () => {
    const parsed = preview.parseSaveResponse({
        cid: 42,
        success: 1
    });

    assert.equal(parsed.cid, '42');
    assert.deepEqual(Object.keys(parsed), ['cid']);
    assert.equal(
        preview.buildPreviewUrl('https://example.test/?void-home-preview={cid}', parsed.cid),
        'https://example.test/?void-home-preview=42'
    );
    assert.equal(
        preview.parseSaveResponse('{"success":true,"cid":"43"}').cid,
        '43'
    );

    for (const response of [
        null,
        'not-json',
        { success: 0, cid: 42 },
        { success: 1 },
        { success: 1, cid: 0 },
        { success: 1, cid: 'revision' }
    ]) {
        assert.equal(preview.parseSaveResponse(response), null);
    }
});

test('preview source uses the latest canonical cid, then the saved form cid', () => {
    assert.equal(preview.getPreviewSource('27', '12'), '27');
    assert.equal(preview.getPreviewSource('', '12'), '12');
    assert.equal(preview.getPreviewSource('0', '12'), '12');
    assert.equal(preview.getPreviewSource('', '', '999'), '');
    assert.equal(preview.getPreviewSource('revision', '0007'), '');
});

test('preview URL replaces every cid placeholder and rejects invalid sources', () => {
    assert.equal(
        preview.buildPreviewUrl('/preview/{cid}?parent={cid}', '123'),
        '/preview/123?parent=123'
    );
    assert.equal(preview.buildPreviewUrl('/preview/{cid}', ''), '');
    assert.equal(preview.buildPreviewUrl('/preview/{cid}', 'revision'), '');
    assert.equal(preview.buildPreviewUrl('/preview', '123'), '');
});

test('preview windows are opened in a new tab, detached from opener and report blocking', () => {
    const openedWindow = { opener: { id: 'editor' } };
    const calls = [];
    const result = preview.openPreviewWindow((url, target) => {
        calls.push([url, target]);
        return openedWindow;
    }, '');

    assert.equal(result, openedWindow);
    assert.deepEqual(calls, [['', '_blank']]);
    assert.equal(openedWindow.opener, null);
    assert.equal(preview.openPreviewWindow(() => null, ''), null);
    assert.equal(preview.openPreviewWindow(() => { throw new Error('blocked'); }, ''), null);
});

test('popup blocking returns before any draft save can start', () => {
    const saveFlow = sourceBetween(
        homePreviewSource,
        'function startSaveAndPreview()',
        'function onAjaxSend('
    );

    assert.match(
        saveFlow,
        /if \(!previewWindow\) \{[\s\S]*?草稿尚未保存[\s\S]*?return;[\s\S]*?\}\s*closeMenu\(false\);\s*requestSaveForPreview\(previewWindow\);/
    );
});

test('editor integration adds an independent post-only action band and leaves native preview untouched', () => {
    assert.match(homePreviewSource, /document\.querySelector\('form\[name="write_post"\]'\)/);
    assert.doesNotMatch(homePreviewSource, /write_page|#btn-preview|btn-preview/);
    assert.match(homePreviewSource, /!window\.Typecho/);
    assert.match(homePreviewSource, /typeof window\.Typecho\.savePost !== 'function'/);
    assert.match(homePreviewSource, /document\.getElementById\('wmd-editarea'\)/);
    assert.match(homePreviewSource, /document\.getElementById\('void-editor-stats'\)/);
    assert.match(homePreviewSource, /parent\.insertBefore\(ui\.root, editArea\.nextSibling\)/);
    assert.match(homePreviewSource, /parent\.insertBefore\(ui\.root, stats\)/);
    assert.match(homePreviewSource, /new window\.MutationObserver/);
    assert.match(homePreviewSource, /'首页预览 ↗'/);
    assert.doesNotMatch(homePreviewSource, /i-exlink/);
    assert.match(homePreviewSource, /'保存草稿并预览'/);
    assert.match(homePreviewSource, /'查看上次保存版本'/);
    assert.match(homePreviewSource, /'取消'/);
    assert.match(homePreviewSource, /ui\.menu\.previous\.hidden = !source/);
});

test('matching saves own the busy state until ajaxComplete and editor changes refresh dirty state', () => {
    const sendFlow = sourceBetween(homePreviewSource, 'function onAjaxSend(', 'function onAjaxSuccess(');
    const completeFlow = sourceBetween(homePreviewSource, 'function onAjaxComplete(', 'function onTriggerClick(');

    assert.match(sendFlow, /if \(!isSaveRequest\(/);
    assert.match(sendFlow, /activeSaveRequests\+\+/);
    assert.match(sendFlow, /ui\.trigger\.disabled = true/);
    assert.match(sendFlow, /ui\.trigger\.setAttribute\('aria-busy', 'true'\)/);
    assert.match(completeFlow, /activeSaveRequests = Math\.max\(0, activeSaveRequests - 1\)/);
    assert.match(completeFlow, /ui\.trigger\.disabled = false/);
    assert.match(completeFlow, /ui\.trigger\.removeAttribute\('aria-busy'\)/);
    assert.match(
        homePreviewSource,
        /'input\.voidHomePreview change\.voidHomePreview write\.voidHomePreview datachange\.voidHomePreview'/
    );
    assert.match(homePreviewSource, /ajaxSend\.voidHomePreview/);
    assert.match(homePreviewSource, /ajaxSuccess\.voidHomePreview/);
    assert.match(homePreviewSource, /ajaxError\.voidHomePreview/);
    assert.match(homePreviewSource, /ajaxComplete\.voidHomePreview/);
    assert.doesNotMatch(homePreviewSource, /VOIDHomePreviewConfig\.autoSave|config\.autoSave/);
});

test('preview saves close failed blank tabs and settle races after active saves', () => {
    const saveFlow = sourceBetween(
        homePreviewSource,
        'function requestSaveForPreview(',
        'function startSaveAndPreview()'
    );
    const successFlow = sourceBetween(
        homePreviewSource,
        'function onAjaxSuccess(',
        'function onAjaxError('
    );
    const completeFlow = sourceBetween(
        homePreviewSource,
        'function onAjaxComplete(',
        'function onTriggerClick('
    );

    assert.match(saveFlow, /try \{[\s\S]*?trigger\('datachange'\)[\s\S]*?Typecho\.savePost\(\)[\s\S]*?\} catch \(error\) \{[\s\S]*?failPreviewSave/);
    assert.match(successFlow, /savedFingerprint = requestState\.fingerprint/);
    assert.match(completeFlow, /if \(activeSaveRequests\) \{[\s\S]*?return;/);
    assert.match(completeFlow, /if \(pendingPreviewWindow\)/);
    assert.match(completeFlow, /currentFingerprint\(\) === savedFingerprint/);
    assert.match(completeFlow, /navigatePreview\(previewWindow, latestCid\)/);
    assert.match(completeFlow, /requestSaveForPreview\(previewWindow\)/);
    assert.match(homePreviewSource, /function failPreviewSave\([\s\S]*?closePreviewWindow\(previewWindow\)/);
});

test('both saved and dirty preview paths detach an empty tab before navigation', () => {
    const savedFlow = sourceBetween(
        homePreviewSource,
        'function openSavedPreview(',
        'function requestSaveForPreview('
    );
    const dirtyFlow = sourceBetween(
        homePreviewSource,
        'function startSaveAndPreview()',
        'function onAjaxSend('
    );

    assert.match(savedFlow, /openPreviewWindow\([\s\S]*?, ''\)/);
    assert.match(savedFlow, /navigatePreview\(previewWindow, sourceCid\)/);
    assert.match(dirtyFlow, /openPreviewWindow\([\s\S]*?, ''\)/);
    assert.match(dirtyFlow, /requestSaveForPreview\(previewWindow\)/);
});

test('previous-version preview never saves and the module does not enter the publish chain', () => {
    const previousFlow = sourceBetween(homePreviewSource, 'function openPrevious()', 'function cancelMenu()');

    assert.match(previousFlow, /openSavedPreview\(source\)/);
    assert.doesNotMatch(previousFlow, /savePost|datachange/);
    assert.doesNotMatch(homePreviewSource, /finishPublish|finishSave|\.submit\s*\(|visibility/);
    assert.equal((homePreviewSource.match(/Typecho\.savePost\(\)/g) || []).length, 1);
});

test('late Markdown edit area discovery initializes the action band exactly once', () => {
    const harness = createHomePreviewHarness({ editArea: false });

    harness.api.start();
    assert.equal(
        harness.document.getElementById('void-home-preview-actions'),
        null,
        'the action band waits for the real editor area'
    );

    const editArea = harness.document.createElement('div');
    editArea.id = 'wmd-editarea';
    harness.editorParent.appendChild(editArea);
    harness.flushMutations();
    harness.flushTimers();

    const actionBand = harness.document.getElementById('void-home-preview-actions');
    assert.ok(actionBand, 'inserting the Markdown editor area initializes the action band');
    assert.equal(actionBand.parentNode, harness.editorParent);
    assert.equal(editArea.nextSibling, actionBand, 'the action band follows the late editor area');

    harness.api.start();
    harness.flushMutations();
    assert.equal(
        harness.document.querySelectorAll('#void-home-preview-actions').length,
        1,
        'repeated discovery and explicit init do not duplicate the action band'
    );
});

test('concurrent saves converge before preview navigation or a serial repair save', async (t) => {
    function startPreviewSave(harness, text) {
        harness.api.init();
        harness.text.value = text;
        harness.jQuery(harness.form).trigger('datachange');

        const trigger = harness.document.querySelector('.void-home-preview-actions__trigger');
        harness.click(trigger);
        const save = harness.document.querySelector('[data-action="save"]');
        harness.click(save);

        assert.equal(harness.requests.length, 1, 'the preview starts one native save');
        assert.equal(harness.openedWindows.length, 1, 'the preview owns one detached tab');
    }

    await t.test('the last in-flight success already matches the editor', () => {
        const harness = createHomePreviewHarness();
        startPreviewSave(harness, '第一版修改');

        const older = harness.requests[0];
        harness.text.value = '第二版修改';
        harness.jQuery(harness.form).trigger('datachange');
        harness.Typecho.savePost();
        const newer = harness.requests[1];
        assert.ok(newer, 'auto-save starts while the preview save is in flight');

        older.succeed();
        older.complete();
        assert.equal(
            harness.requests.length,
            2,
            'an older completion does not start a third save while a newer request is active'
        );
        assert.equal(harness.openedWindows[0].location.href, '', 'preview waits for every active save');

        newer.succeed();
        newer.complete();
        assert.equal(harness.requests.length, 2, 'matching latest success needs no repair save');
        assert.equal(
            harness.openedWindows[0].location.href,
            'https://example.test/?void_home_preview=42&_=token',
            'preview navigates after the latest saved fingerprint converges'
        );
    });

    await t.test('an older request wins last and requires one serial repair save', () => {
        const harness = createHomePreviewHarness();
        startPreviewSave(harness, '第一版修改');

        const older = harness.requests[0];
        harness.text.value = '第二版修改';
        harness.jQuery(harness.form).trigger('datachange');
        harness.Typecho.savePost();
        const newer = harness.requests[1];

        newer.succeed();
        newer.complete();
        assert.equal(harness.requests.length, 2, 'no repair starts while the older request remains active');
        assert.equal(harness.openedWindows[0].location.href, '', 'preview still waits for the older request');

        older.succeed();
        older.complete();
        assert.equal(harness.requests.length, 3, 'stale last success starts one repair after convergence');
        assert.equal(harness.openedWindows[0].location.href, '', 'preview waits for the serial repair');

        const repair = harness.requests[2];
        repair.succeed();
        repair.complete();
        assert.equal(harness.requests.length, 3, 'the repair does not recursively save');
        assert.equal(
            harness.openedWindows[0].location.href,
            'https://example.test/?void_home_preview=42&_=token',
            'preview navigates only after the current fingerprint is the final saved snapshot'
        );
    });
});

test('action band has narrow-screen, dark-mode, hidden-menu and fullscreen CSS contracts', () => {
    assert.match(editorCssSource, /\.void-home-preview-actions__menu\[hidden\][\s\S]*?display: none !important/);
    assert.match(editorCssSource, /\.fullscreen \.void-home-preview-actions[\s\S]*?display: none !important/);
    assert.match(editorCssSource, /html\[data-typecho-theme="dark"\][\s\S]*?\.void-home-preview-actions/);
    assert.match(
        editorCssSource,
        /@media \(max-width: 420px\)[\s\S]*?\.void-home-preview-actions[\s\S]*?\.void-home-preview-actions__trigger/
    );
    assert.match(
        editorCssSource,
        /@media \(max-width: 340px\)[\s\S]*?\.void-home-preview-actions__trigger/
    );
    assert.match(editorCssSource, /max-width: calc\(100vw - 32px\)/);
});

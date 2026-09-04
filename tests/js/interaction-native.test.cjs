const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.js'), 'utf8')
    .replace(/\r\n/g, '\n');

class FakeClassList {
    constructor(element) {
        this.element = element;
    }

    add(...names) {
        const values = new Set(this.element.className.split(/\s+/).filter(Boolean));
        names.forEach((name) => values.add(name));
        this.element.className = Array.from(values).join(' ');
    }

    contains(name) {
        return this.element.className.split(/\s+/).includes(name);
    }

    toggle(name) {
        const values = new Set(this.element.className.split(/\s+/).filter(Boolean));
        if (values.has(name)) {
            values.delete(name);
        } else {
            values.add(name);
        }
        this.element.className = Array.from(values).join(' ');
        return values.has(name);
    }
}

class FakeElement {
    constructor(tagName, text = '') {
        this.attributes = new Map();
        this.children = [];
        this.className = '';
        this.classList = new FakeClassList(this);
        this.listeners = new Map();
        this.parentNode = null;
        this.style = {};
        this.tagName = String(tagName || '').toUpperCase();
        this._textContent = String(text);
    }

    get firstChild() {
        return this.children[0] || null;
    }

    get parentElement() {
        return this.parentNode;
    }

    get textContent() {
        return this._textContent + this.children.map((child) => child.textContent).join('');
    }

    set textContent(value) {
        this.children = [];
        this._textContent = String(value);
    }

    addEventListener(name, listener) {
        const listeners = this.listeners.get(name) || [];
        listeners.push(listener);
        this.listeners.set(name, listeners);
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    closest(selector) {
        let current = this;
        while (current) {
            if ((selector === '.clipboard' && current.classList.contains('clipboard'))
                || (selector === 'pre' && current.tagName === 'PRE')) {
                return current;
            }
            current = current.parentNode;
        }
        return null;
    }

    contains(candidate) {
        if (candidate === this) {
            return true;
        }
        return this.children.some((child) => child.contains(candidate));
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    insertBefore(child, reference) {
        child.parentNode = this;
        const index = reference ? this.children.indexOf(reference) : -1;
        if (index < 0) {
            this.children.push(child);
        } else {
            this.children.splice(index, 0, child);
        }
        return child;
    }

    querySelector(selector) {
        const match = (element) => (selector === '.value' && element.classList.contains('value'))
            || (selector === '.clipboard' && element.classList.contains('clipboard'))
            || (selector === 'code' && element.tagName === 'CODE');
        for (const child of this.children) {
            if (match(child)) {
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
        const result = [];
        const match = (element) => selector === 'pre' && element.tagName === 'PRE';
        for (const child of this.children) {
            if (match(child)) {
                result.push(child);
            }
            result.push(...child.querySelectorAll(selector));
        }
        return result;
    }

    removeChild(child) {
        this.children = this.children.filter((candidate) => candidate !== child);
        child.parentNode = null;
        return child;
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
        if (name === 'class') {
            this.className = String(value);
        }
    }
}

function createVoteButton({ id = '42', table = 'content', type = 'up', comment = false } = {}) {
    const button = new FakeElement('a');
    const value = new FakeElement('span', '7');
    button.className = comment ? 'vote-button comment-vote' : 'vote-button';
    button.setAttribute('data-item-id', id);
    button.setAttribute('data-table', table);
    button.setAttribute('data-type', type);
    value.className = 'value';
    button.appendChild(value);
    return { button, value };
}

function loadVote(options = {}) {
    const start = source.indexOf('var VOID_Vote = {');
    const end = source.indexOf('\n\nvar Share = {', start);
    const alerts = [];
    const cookieWrites = [];
    const cookies = new Map(Object.entries(options.cookies || {}));
    const buttons = options.buttons || [];
    const comments = options.comments || new Map();
    const fetchCalls = [];
    const fetchImpl = options.fetchImpl || (() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ code: 200 })
    }));
    const context = vm.createContext({
        JSON,
        Promise,
        VOID: {
            alert(message) {
                alerts.push(message);
            }
        },
        VOIDConfig: { votePath: 'https://blog.example.test/action/void?' },
        VOID_Util: {
            getCookie(name) {
                return cookies.has(name) ? cookies.get(name) : null;
            },
            setCookie(name, value, lifetime) {
                cookies.set(name, value);
                cookieWrites.push({ lifetime, name, value });
            }
        },
        document: {
            getElementById(id) {
                return comments.get(id) || null;
            },
            querySelectorAll(selector) {
                return selector === '.vote-button' ? buttons : [];
            }
        },
        window: {
            fetch(url, request) {
                fetchCalls.push({ request, url });
                return fetchImpl(url, request);
            }
        }
    });

    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    vm.runInContext(source.slice(start, end), context);
    return {
        alerts,
        cookieWrites,
        cookies,
        fetchCalls,
        vote: context.VOID_Vote
    };
}

function createBottomEnvironment(options = {}) {
    const start = source.indexOf('function VOID_onReady');
    const body = new FakeElement('body');
    const pre = new FakeElement('pre');
    const code = new FakeElement('code', 'const answer = 42;');
    const uptime = new FakeElement('span');
    const readyListeners = [];
    const intervals = [];
    const alerts = [];
    const clipboardWrites = [];
    const document = {
        body,
        readyState: 'loading',
        addEventListener(name, listener, listenerOptions) {
            readyListeners.push({ listener, name, options: listenerOptions });
        },
        createElement(tagName) {
            const element = new FakeElement(tagName);
            if (String(tagName).toLowerCase() === 'textarea') {
                element.focus = () => { element.focused = true; };
                element.select = () => { element.selected = true; };
                element.setSelectionRange = (startValue, endValue) => {
                    element.selectionRange = [startValue, endValue];
                };
            }
            return element;
        },
        createElementNS(namespace, tagName) {
            const element = new FakeElement(tagName);
            element.namespace = namespace;
            return element;
        },
        execCommand(command) {
            document.execCommandCalls.push(command);
            return options.execCommandResult !== false;
        },
        execCommandCalls: [],
        getElementById(id) {
            return id === 'uptime' ? uptime : null;
        },
        querySelectorAll(selector) {
            return selector === 'pre' ? body.querySelectorAll('pre') : [];
        }
    };
    pre.appendChild(code);
    body.appendChild(pre);
    body.appendChild(uptime);

    class FixedDate extends Date {
        constructor(...args) {
            super(...(args.length ? args : ['2020-01-03T01:02:03Z']));
        }
    }

    const navigator = options.navigator || {
        clipboard: {
            writeText(text) {
                clipboardWrites.push(text);
                return Promise.resolve();
            }
        }
    };
    const calls = [];
    const window = {
        isSecureContext: options.isSecureContext !== false,
        navigator,
        setInterval(callback, delay) {
            intervals.push({ callback, delay });
            return intervals.length;
        }
    };
    window.window = window;
    const context = vm.createContext({
        Date: FixedDate,
        Error,
        Promise,
        VOID: {
            alert(message) { alerts.push(message); },
            bindPjaxLifecycle() { calls.push('bindPjax'); },
            init() { calls.push('init'); }
        },
        VOIDConfig: {
            PJAX: true,
            buildTime: '2020-01-01T00:00:00Z'
        },
        document,
        navigator,
        window
    });
    vm.runInContext(source.slice(start), context);

    return {
        alerts,
        body,
        calls,
        clipboardWrites,
        code,
        context,
        document,
        intervals,
        pre,
        readyListeners,
        uptime
    };
}

test('stage 2B interaction boundaries contain no jQuery calls', () => {
    const alertStart = source.indexOf('    alert: function');
    const commentStart = source.indexOf('var AjaxComment = {', alertStart);
    const readyStart = source.indexOf('function VOID_onReady');
    const jQueryReference = /\$\s*\(|\$\s*\.|\bjQuery\b/;

    assert.doesNotMatch(source.slice(alertStart, commentStart), jQueryReference);
    assert.doesNotMatch(source.slice(readyStart), jQueryReference);
    assert.match(source.slice(alertStart, commentStart), /window\.fetch\(/);
});

test('vote 200 keeps the JSON request, cookie lifetime, count, and duplicate guard', async () => {
    let resolveFetch;
    const response = new Promise((resolve) => { resolveFetch = resolve; });
    const { button, value } = createVoteButton();
    const runtime = loadVote({ fetchImpl: () => response });

    const pending = runtime.vote.vote(button);
    assert.equal(runtime.vote.vote(button), undefined);
    assert.equal(runtime.fetchCalls.length, 1);
    assert.equal(runtime.fetchCalls[0].url, 'https://blog.example.test/action/void?content');
    assert.deepEqual(JSON.parse(JSON.stringify(runtime.fetchCalls[0].request)), {
        body: JSON.stringify({ id: 42, type: 'up' }),
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        method: 'POST'
    });

    resolveFetch({ ok: true, json: () => Promise.resolve({ code: 200 }) });
    await pending;
    assert.equal(button.classList.contains('done'), true);
    assert.equal(value.textContent, '8');
    assert.deepEqual(runtime.cookieWrites, [{
        lifetime: 3600 * 24 * 90,
        name: 'void_vote_content_up',
        value: ',42,'
    }]);

    runtime.vote.vote(button);
    assert.equal(runtime.fetchCalls.length, 1);
    assert.deepEqual(runtime.alerts, ['您已经投过票了~']);
});

test('vote 302 and 403 preserve their cookie and message contracts', async () => {
    const duplicate = createVoteButton({ id: '7', table: 'comment' });
    const duplicateRuntime = loadVote({
        fetchImpl: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ code: 302 }) })
    });
    await duplicateRuntime.vote.vote(duplicate.button);
    assert.equal(duplicate.button.classList.contains('done'), true);
    assert.equal(duplicate.value.textContent, '7');
    assert.deepEqual(duplicateRuntime.alerts, ['您好像已经投过票了呢～']);
    assert.equal(duplicateRuntime.cookieWrites.length, 1);

    const changed = createVoteButton({ id: '8', table: 'comment', type: 'down' });
    const changedRuntime = loadVote({
        fetchImpl: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ code: 403 }) })
    });
    await changedRuntime.vote.vote(changed.button);
    assert.equal(changed.button.classList.contains('done'), false);
    assert.deepEqual(changedRuntime.alerts, ['暂不支持更改投票哦～']);
    assert.equal(changedRuntime.cookieWrites.length, 0);
});

test('vote reports HTTP, malformed JSON, and network failures without recording a vote', async () => {
    const cases = [
        () => Promise.resolve({ ok: false, json: () => Promise.resolve({ code: 200 }) }),
        () => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('bad json')) }),
        () => Promise.reject(new Error('offline'))
    ];

    for (const fetchImpl of cases) {
        const { button } = createVoteButton();
        const runtime = loadVote({ fetchImpl });
        await runtime.vote.vote(button);
        assert.equal(button.classList.contains('done'), false);
        assert.equal(runtime.cookieWrites.length, 0);
        assert.deepEqual(runtime.alerts, ['投票失败 o(╥﹏╥)o，请稍后重试']);
    }
});

test('comment votes reject an opposite local vote and reload and fold use native DOM state', () => {
    const { button } = createVoteButton({ id: '9', table: 'comment', type: 'up', comment: true });
    const comment = new FakeElement('article');
    const trigger = new FakeElement('a');
    const runtime = loadVote({
        buttons: [button],
        comments: new Map([['comment-9', comment]]),
        cookies: {
            void_vote_comment_down: ',9,'
        },
        fetchImpl: () => {
            throw new Error('fetch should not run');
        }
    });

    runtime.vote.vote(button);
    assert.deepEqual(runtime.alerts, ['暂不支持更改投票哦～']);
    assert.equal(runtime.fetchCalls.length, 0);
    runtime.cookies.set('void_vote_comment_up', ',9,');
    runtime.vote.reload();
    assert.equal(button.classList.contains('done'), true);

    runtime.vote.toggleFoldComment(9, trigger);
    assert.equal(comment.classList.contains('fold'), true);
    assert.equal(trigger.textContent, '点击展开');
    runtime.vote.toggleFoldComment(9, trigger);
    assert.equal(comment.classList.contains('fold'), false);
    assert.equal(trigger.textContent, '还是叠上吧');
});

test('native ready initializes once while runtime and clipboard follow replaced DOM', async () => {
    const runtime = createBottomEnvironment();

    assert.equal(runtime.readyListeners.length, 1);
    assert.equal(runtime.readyListeners[0].name, 'DOMContentLoaded');
    assert.equal(runtime.readyListeners[0].options.once, true);
    assert.equal(runtime.intervals.length, 1);
    assert.equal(runtime.intervals[0].delay, 1000);

    runtime.readyListeners[0].listener();
    assert.deepEqual(runtime.calls, ['bindPjax', 'init']);
    assert.equal(runtime.pre.children.filter((item) => item.classList.contains('clipboard')).length, 1);
    assert.equal((runtime.body.listeners.get('click') || []).length, 1);

    runtime.context.loadClipboard();
    runtime.context.bindClipboard();
    assert.equal(runtime.pre.children.filter((item) => item.classList.contains('clipboard')).length, 1);
    assert.equal((runtime.body.listeners.get('click') || []).length, 1);

    runtime.intervals[0].callback();
    assert.equal(runtime.uptime.textContent, '2 天 1 小时 2 分 3 秒 ');

    const button = runtime.pre.children[0];
    const icon = button.children[0];
    runtime.body.listeners.get('click')[0]({ target: icon });
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(runtime.clipboardWrites, ['const answer = 42;']);
    assert.deepEqual(runtime.alerts, ['复制成功']);
});

test('clipboard fallback copies through a temporary textarea and cleans it up', async () => {
    const runtime = createBottomEnvironment({
        isSecureContext: false,
        navigator: {}
    });
    const originalCount = runtime.body.children.length;

    await runtime.context.copyToClipboard('fallback text');

    assert.deepEqual(runtime.document.execCommandCalls, ['copy']);
    assert.equal(runtime.body.children.length, originalCount);
});

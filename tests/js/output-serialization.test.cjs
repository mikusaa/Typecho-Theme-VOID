const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

class FakeNode {
    constructor(tagName, text = '') {
        this.tagName = tagName ? tagName.toUpperCase() : '';
        this.children = [];
        this.className = '';
        this.id = '';
        this.parentNode = null;
        this.protocol = '';
        this._href = '';
        this._textContent = text;
    }

    get firstChild() {
        return this.children[0] || null;
    }

    get href() {
        return this._href;
    }

    set href(value) {
        const parsed = new URL(String(value), 'https://admin.example.test/');
        this._href = parsed.href;
        this.protocol = parsed.protocol;
    }

    get textContent() {
        return this._textContent + this.children.map((child) => child.textContent).join('');
    }

    set textContent(value) {
        this.children = [];
        this._textContent = String(value);
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
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

    removeChild(child) {
        this.children = this.children.filter((candidate) => candidate !== child);
        child.parentNode = null;
        return child;
    }
}

function loadAlert() {
    const source = fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.js'), 'utf8')
        .replace(/\r\n/g, '\n');
    const start = source.indexOf('alert: function');
    const end = source.indexOf('\n    },\n\n    startSearch:', start);
    const body = new FakeNode('body');
    const document = {
        body,
        createElement(tagName) {
            return new FakeNode(tagName);
        }
    };

    assert.notEqual(start, -1, 'VOID.alert should exist');
    assert.notEqual(end, -1, 'VOID.alert should have a stable boundary');

    function jQuery(target) {
        const nodes = typeof target === 'string' ? body.children : [target];
        return {
            addClass() { return this; },
            attr(name) { return nodes[0] ? nodes[0][name] : undefined; },
            css() { return this; },
            offset() { return { top: 0 }; },
            outerHeight() { return 0; },
            remove() { return this; }
        };
    }
    jQuery.each = (items, callback) => Array.from(items).forEach((item, index) => callback(index, item));

    const expression = source.slice(start + 'alert: '.length, end + '\n    }'.length);
    const alert = vm.runInNewContext('(' + expression + ')', {
        $: jQuery,
        String,
        document,
        setTimeout() {}
    });

    return { alert, body };
}

class FakeXMLHttpRequest {
    constructor() {
        FakeXMLHttpRequest.last = this;
        this.readyState = 0;
        this.responseText = '';
        this.status = 0;
    }

    open() {}

    send() {}
}

function loadUpdateChecker() {
    const container = new FakeNode('p');
    const document = {
        createElement(tagName) {
            return new FakeNode(tagName);
        },
        createTextNode(value) {
            return new FakeNode('', String(value));
        },
        getElementById(id) {
            return id === 'void-check-update' ? container : null;
        }
    };

    vm.runInNewContext(
        fs.readFileSync(path.resolve(__dirname, '../../assets/check_update.js'), 'utf8'),
        {
            String,
            VOIDVersion: '3.5.4.1',
            XMLHttpRequest: FakeXMLHttpRequest,
            document
        }
    );

    return { container, request: FakeXMLHttpRequest.last };
}

test('VOID alert renders server messages as text', () => {
    const { alert, body } = loadAlert();
    const attack = '失败 </div><script id="injected">alert(1)</script>';

    alert(attack);

    assert.equal(body.children.length, 1);
    assert.equal(body.children[0].tagName, 'DIV');
    assert.equal(body.children[0].textContent, attack);
    assert.equal(body.children[0].children.length, 0);
});

test('update checker builds remote release details with text and safe links', () => {
    const { container, request } = loadUpdateChecker();
    const attack = '新版 </a><script id="injected">alert(1)</script>';

    request.readyState = 4;
    request.status = 200;
    request.responseText = JSON.stringify({
        assets: [{ browser_download_url: 'https://downloads.example.test/theme.zip' }],
        html_url: 'javascript:alert(1)',
        name: attack,
        tag_name: '9.0.0'
    });
    request.onreadystatechange();

    assert.match(container.textContent, new RegExp(attack.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(container.children.filter((child) => child.tagName === 'SCRIPT').length, 0);
    const links = container.children.filter((child) => child.tagName === 'A');
    assert.equal(links.length, 1);
    assert.equal(links[0].protocol, 'https:');
    assert.equal(links[0].target, undefined);

    request.responseText = JSON.stringify({
        assets: [{ browser_download_url: 'https://downloads.example.test/theme.zip' }],
        html_url: 'https://releases.example.test/void',
        name: 'VOID 9',
        tag_name: '9.0.0'
    });
    request.onreadystatechange();

    const releaseLinks = container.children.filter((child) => child.tagName === 'A');
    assert.equal(releaseLinks.length, 2);
    assert.equal(releaseLinks[1].target, '_blank');
    assert.equal(releaseLinks[1].rel, 'noopener noreferrer');
});

test('dynamic output sources no longer assign innerHTML', () => {
    const updateSource = fs.readFileSync(path.resolve(__dirname, '../../assets/check_update.js'), 'utf8');
    const voidSource = fs.readFileSync(path.resolve(__dirname, '../../assets/VOID.js'), 'utf8')
        .replace(/\r\n/g, '\n');
    const alertStart = voidSource.indexOf('alert: function');
    const alertEnd = voidSource.indexOf('\n    startSearch:', alertStart);

    assert.doesNotMatch(updateSource, /\.innerHTML\s*=/);
    assert.doesNotMatch(voidSource.slice(alertStart, alertEnd), /\.html\(|\.prepend\(|innerHTML/);
});

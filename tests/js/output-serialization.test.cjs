const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { readVoidModule } = require('./helpers/void-source.cjs');

class FakeNode {
    constructor(tagName, text = '') {
        this.tagName = tagName ? tagName.toUpperCase() : '';
        this.children = [];
        this.className = '';
        this.id = '';
        this.parentNode = null;
        this.protocol = '';
        this.attributes = new Map();
        this.offsetHeight = 0;
        this.style = {};
        this._href = '';
        this._textContent = text;
        this.classList = {
            add: (...names) => {
                const values = new Set(this.className.split(/\s+/).filter(Boolean));
                names.forEach((name) => values.add(name));
                this.className = Array.from(values).join(' ');
            },
            contains: (name) => this.className.split(/\s+/).includes(name)
        };
    }

    get firstChild() {
        return this.children[0] || null;
    }

    get parentElement() {
        return this.parentNode;
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

    blur() {
        this.blurred = true;
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    getBoundingClientRect() {
        return { top: this.rectTop || 0 };
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

    remove() {
        if (this.parentNode) {
            this.parentNode.removeChild(this);
        }
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }
}

function loadAlert() {
    const source = readVoidModule('runtime');
    const start = source.indexOf('alert: function');
    const end = source.indexOf('\n    },\n\n    startSearch:', start);
    const body = new FakeNode('body');
    const timers = [];
    const document = {
        body,
        createElement(tagName) {
            const element = new FakeNode(tagName);
            element.offsetHeight = 30;
            return element;
        },
        querySelectorAll(selector) {
            return selector === '.msg'
                ? body.children.filter((item) => item.classList.contains('msg'))
                : [];
        }
    };

    assert.notEqual(start, -1, 'VOID.alert should exist');
    assert.notEqual(end, -1, 'VOID.alert should have a stable boundary');

    const expression = source.slice(start + 'alert: '.length, end + '\n    }'.length);
    const alert = vm.runInNewContext('(' + expression + ')', {
        String,
        document,
        setTimeout(callback, delay) {
            timers.push({ callback, delay });
            return timers.length;
        }
    });

    return { alert, body, timers };
}

function loadStartSearch(pjax) {
    const source = readVoidModule('runtime');
    const start = source.indexOf('startSearch: function');
    const end = source.indexOf('\n    },\n\n    enterSearch:', start);
    const input = new FakeNode('input');
    input.value = '';
    const opened = [];
    const visits = [];

    assert.notEqual(start, -1, 'VOID.startSearch should exist');
    assert.notEqual(end, -1, 'VOID.startSearch should have a stable boundary');

    const window = {
        VoidPjax: {
            visit(options) {
                visits.push(options);
            }
        },
        open(url, target) {
            opened.push({ target, url: String(url) });
        }
    };
    const expression = source.slice(start + 'startSearch: '.length, end + '\n    }'.length);
    const startSearch = vm.runInNewContext('(' + expression + ')', {
        VOIDConfig: {
            PJAX: pjax,
            searchBase: 'https://blog.example.test/search/'
        },
        document: {
            querySelector(selector) {
                return selector === '#search' ? input : null;
            }
        },
        encodeURIComponent,
        window
    });

    return { input, opened, startSearch, visits };
}

function loadShare(content) {
    const source = readVoidModule('interactions');
    const start = source.indexOf('var Share = {');
    const opened = [];
    const context = vm.createContext({
        URL,
        window: {
            open(url) {
                opened.push(String(url));
            }
        }
    });

    assert.notEqual(start, -1, 'Share should exist');

    vm.runInContext(source.slice(start), context);
    const parent = new FakeNode('div');
    const item = new FakeNode('a');
    for (const [name, value] of Object.entries(content)) {
        parent.setAttribute('data-' + name, value);
    }
    parent.appendChild(item);

    return { item, opened, share: context.Share };
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
            VOIDVersion: '3.6.0',
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

test('VOID alert stacks, hides, and removes native message elements', () => {
    const { alert, body, timers } = loadAlert();
    const existing = new FakeNode('div', 'older');
    existing.className = 'msg show';
    existing.rectTop = 10;
    body.appendChild(existing);

    alert('newer', 600);

    const current = body.children[0];
    assert.equal(current.classList.contains('show'), true);
    assert.equal(existing.style.top, '60px');
    assert.equal(timers[0].delay, 600);

    timers[0].callback();
    assert.equal(current.classList.contains('hide'), true);
    assert.equal(timers[1].delay, 1000);
    timers[1].callback();
    assert.equal(body.children.includes(current), false);
    assert.equal(body.children.includes(existing), true);
});

test('search encodes keywords for PJAX and full navigation', () => {
    const keyword = '中文 a/b?c=1&d=#片段 + 100% "引号"';
    const expected = 'https://blog.example.test/search/' + encodeURIComponent(keyword);

    const pjaxSearch = loadStartSearch(true);
    pjaxSearch.input.value = keyword;
    pjaxSearch.startSearch(pjaxSearch.input);

    assert.equal(pjaxSearch.visits.length, 1);
    assert.equal(pjaxSearch.visits[0].url, expected);
    assert.equal(pjaxSearch.opened.length, 0);
    assert.equal(decodeURIComponent(pjaxSearch.visits[0].url.slice(pjaxSearch.visits[0].url.lastIndexOf('/') + 1)), keyword);

    const fullSearch = loadStartSearch(false);
    fullSearch.input.value = keyword;
    fullSearch.startSearch('#search');

    assert.equal(fullSearch.visits.length, 0);
    assert.deepEqual(fullSearch.opened, [{ target: '_self', url: expected }]);
    assert.equal(decodeURIComponent(fullSearch.opened[0].url.slice(fullSearch.opened[0].url.lastIndexOf('/') + 1)), keyword);

    const emptySearch = loadStartSearch(true);
    emptySearch.startSearch(emptySearch.input);
    assert.equal(emptySearch.input.blurred, true);
    assert.equal(emptySearch.input.getAttribute('placeholder'), '你还没有输入任何信息');
    assert.equal(emptySearch.visits.length, 0);
});

test('share parameters round-trip without injecting query fields', () => {
    const content = {
        excerpt: '摘要\n第二行 &excerptInjected=yes',
        img: 'https://cdn.example.test/banner.jpg?size=large&crop=1#image',
        title: '标题 中文 / ? # &evil=1 = 100% "引号"',
        twitter: 'twitter/name?x=1&accountInjected=yes#tag%',
        url: 'https://blog.example.test/post/a%20b?x=1&y=2#part',
        weibo: '微博/name?x=1&accountInjected=yes#tag%'
    };
    const { item, opened, share } = loadShare(content);

    share.toWeibo(item);
    share.toTwitter(item);

    assert.equal(opened.length, 2);

    const weiboUrl = new URL(opened[0]);
    assert.equal(weiboUrl.origin, 'http://service.weibo.com');
    assert.equal(weiboUrl.pathname, '/share/share.php');
    assert.equal(weiboUrl.hash, '');
    assert.equal(weiboUrl.searchParams.get('title'), '分享《' + content.title + '》 @' + content.weibo + '\n\n' + content.excerpt);
    assert.equal(weiboUrl.searchParams.get('url'), content.url);
    assert.equal(weiboUrl.searchParams.get('pic'), content.img);
    assert.equal(weiboUrl.searchParams.get('appkey'), '');
    assert.equal(weiboUrl.searchParams.get('searchPic'), 'false');
    assert.equal(weiboUrl.searchParams.get('style'), 'simple');
    assert.equal(weiboUrl.searchParams.has('evil'), false);
    assert.equal(weiboUrl.searchParams.has('excerptInjected'), false);
    assert.equal(weiboUrl.searchParams.has('accountInjected'), false);
    assert.deepEqual(
        Array.from(weiboUrl.searchParams.keys()).sort(),
        ['appkey', 'pic', 'searchPic', 'style', 'title', 'url']
    );

    const twitterUrl = new URL(opened[1]);
    assert.equal(twitterUrl.origin, 'https://twitter.com');
    assert.equal(twitterUrl.pathname, '/intent/tweet');
    assert.equal(twitterUrl.hash, '');
    assert.equal(
        twitterUrl.searchParams.get('text'),
        '分享《' + content.title + '》 @' + content.twitter + '\n\n' + content.excerpt + ' ' + content.url
    );
    assert.equal(twitterUrl.searchParams.has('evil'), false);
    assert.equal(twitterUrl.searchParams.has('excerptInjected'), false);
    assert.equal(twitterUrl.searchParams.has('accountInjected'), false);
    assert.deepEqual(Array.from(twitterUrl.searchParams.keys()), ['text']);
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
    const voidSource = readVoidModule('runtime');
    const alertStart = voidSource.indexOf('alert: function');
    const alertEnd = voidSource.indexOf('\n    startSearch:', alertStart);

    assert.doesNotMatch(updateSource, /\.innerHTML\s*=/);
    assert.doesNotMatch(voidSource.slice(alertStart, alertEnd), /\.html\(|\.prepend\(|innerHTML/);
});

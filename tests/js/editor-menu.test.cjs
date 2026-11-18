/* global __dirname */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { readEditorModule } = require('./helpers/editor-source.cjs');

const menuSource = readEditorModule('menu');
const editorCss = fs.readFileSync(path.resolve(__dirname, '../../assets/editor-admin.css'), 'utf8');

function createEnvironment() {
    let document;

    class Element {
        constructor(tagName = 'div') {
            this.tagName = tagName.toUpperCase();
            this.children = [];
            this.parentNode = null;
            this.attributes = new Map();
            this.listeners = new Map();
            this.className = '';
            this.id = '';
            this.hidden = false;
            this.type = '';
            this.value = '';
            this.selectionStart = 0;
            this.selectionEnd = 0;
            this.scrollTop = 0;
            this.style = {};
            this._textContent = '';
        }

        appendChild(child) {
            child.parentNode = this;
            this.children.push(child);
            return child;
        }

        removeChild(child) {
            this.children.splice(this.children.indexOf(child), 1);
            child.parentNode = null;
            return child;
        }

        setAttribute(name, value) {
            this.attributes.set(name, String(value));
            if (name === 'id') {
                this.id = String(value);
            } else if (name === 'class') {
                this.className = String(value);
            }
        }

        getAttribute(name) {
            if (name === 'id') {
                return this.id || null;
            }
            if (name === 'class') {
                return this.className || null;
            }
            return this.attributes.has(name) ? this.attributes.get(name) : null;
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

        dispatchEvent(event) {
            event.target = event.target || this;
            event.currentTarget = this;
            event.preventDefault = event.preventDefault || function () {
                event.defaultPrevented = true;
            };
            (this.listeners.get(event.type) || []).slice().forEach((listener) => listener.call(this, event));
            return !event.defaultPrevented;
        }

        click() {
            this.dispatchEvent({ type: 'click' });
        }

        matches(selector) {
            if (selector[0] === '.') {
                return this.className.split(/\s+/).includes(selector.slice(1));
            }
            if (selector === '[role="menuitem"]') {
                return this.getAttribute('role') === 'menuitem';
            }
            return false;
        }

        querySelectorAll(selector) {
            const matches = [];
            function visit(element) {
                element.children.forEach((child) => {
                    if (child.matches(selector)) {
                        matches.push(child);
                    }
                    visit(child);
                });
            }
            visit(this);
            return matches;
        }

        querySelector(selector) {
            return this.querySelectorAll(selector)[0] || null;
        }

        contains(candidate) {
            while (candidate) {
                if (candidate === this) {
                    return true;
                }
                candidate = candidate.parentNode;
            }
            return false;
        }

        focus() {
            document.activeElement = this;
        }

        setSelectionRange(start, end) {
            this.selectionStart = start;
            this.selectionEnd = end;
        }

        getBoundingClientRect() {
            return this.bounds || { left: 16, right: 234 };
        }

        get textContent() {
            return this._textContent;
        }

        set textContent(value) {
            this._textContent = String(value);
        }
    }

    class Document extends Element {
        constructor() {
            super('#document');
            this.documentElement = { scrollTop: 0, clientWidth: 1280 };
            this.activeElement = null;
            this.body = new Element('body');
            this.appendChild(this.body);
        }

        createElement(tagName) {
            return new Element(tagName);
        }

        getElementById(id) {
            let result = null;
            function visit(element) {
                if (element.id === id) {
                    result = element;
                    return;
                }
                element.children.forEach((child) => {
                    if (!result) {
                        visit(child);
                    }
                });
            }
            visit(this);
            return result;
        }
    }

    document = new Document();
    const toolbar = new Element('ul');
    toolbar.id = 'wmd-button-row';
    const field = new Element('textarea');
    field.id = 'text';
    document.body.appendChild(toolbar);
    document.body.appendChild(field);

    function jQuery(element) {
        return {
            trigger(name) {
                element.dispatchEvent({ type: name });
            }
        };
    }

    let mountCount = 0;
    let mountOptions = null;
    const window = Object.assign(new Element('window'), {
        jQuery,
        VoidEmotes: {
            mount(options) {
                mountCount++;
                mountOptions = options;
                const panel = new Element('section');
                const closeButton = new Element('button');
                panel.id = `void-emotes-test-${mountCount}-panel`;
                panel.hidden = true;
                options.container.appendChild(panel);
                return {
                    closeButton,
                    destroyed: false,
                    isOpen: false,
                    panel,
                    open() {
                        if (this.destroyed || this.isOpen) {
                            return;
                        }
                        this.isOpen = true;
                        this.panel.hidden = false;
                        options.onOpen(this);
                    },
                    close() {
                        if (!this.isOpen) {
                            return;
                        }
                        this.isOpen = false;
                        this.panel.hidden = true;
                        options.onClose(this);
                    },
                    destroy() {
                        this.close();
                        this.destroyed = true;
                        if (this.panel.parentNode) {
                            this.panel.parentNode.removeChild(this.panel);
                        }
                    }
                };
            }
        }
    });
    window.window = window;
    class Event {
        constructor(type, options = {}) {
            this.type = type;
            this.bubbles = !!options.bubbles;
        }
    }
    const context = { document, Element, Event, window };

    vm.runInNewContext(
        menuSource,
        context
    );

    return {
        document,
        field,
        menu: context.VOID_Editor_Menu,
        toolbar,
        window,
        getMountCount: () => mountCount,
        getMountOptions: () => mountOptions
    };
}

function menuItems(document) {
    return document.getElementById('void-editor-menu').querySelectorAll('[role="menuitem"]');
}

test('creates all five GitHub Alert tokens', () => {
    const helpers = createEnvironment().menu.__test;
    for (const type of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
        assert.equal(helpers.createTemplate(type, '正文'), `> [!${type}]\n> 正文`);
    }
});

test('empty selection inserts and selects the placeholder', () => {
    const result = createEnvironment().menu.__test.applyTemplate('', 0, 0, 'NOTE');

    assert.equal(result.value, '> [!NOTE]\n> 提示内容');
    assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), '提示内容');
});

test('quotes multiline and CRLF selections with valid blank quote lines', () => {
    const helpers = createEnvironment().menu.__test;
    assert.equal(
        helpers.createTemplate('TIP', '第一行\n\n第三行'),
        '> [!TIP]\n> 第一行\n>\n> 第三行'
    );
    assert.equal(
        helpers.createTemplate('IMPORTANT', '第一行\r\n\r\n第三行'),
        '> [!IMPORTANT]\n> 第一行\n>\n> 第三行'
    );
});

test('preserves CRLF when inserting into a CRLF document', () => {
    const result = createEnvironment().menu.__test.applyTemplate('开头\r\n结尾', 0, 2, 'WARNING');
    assert.equal(result.value, '> [!WARNING]\r\n> 开头\r\n\r\n结尾');
});

test('rejects unsupported and incorrectly cased Alert types', () => {
    const helpers = createEnvironment().menu.__test;
    assert.equal(helpers.createTemplate('SUCCESS', '正文'), null);
    assert.equal(helpers.createTemplate('note', '正文'), null);
    assert.equal(helpers.applyTemplate('', 0, 0, 'SUCCESS'), null);
});

test('creates one VOID entry with the fixed menu order and one emote host', () => {
    const environment = createEnvironment();
    const first = environment.menu.init();
    const second = environment.menu.init();
    const items = menuItems(environment.document);

    assert.equal(second, first);
    assert.equal(environment.toolbar.children.length, 2);
    assert.equal(environment.toolbar.children[0].id, 'void-editor-menu-spacer');
    assert.equal(environment.toolbar.children[1].id, 'wmd-void-button');
    assert.equal(environment.document.getElementById('wmd-photoset-button'), null);
    assert.equal(environment.document.getElementById('wmd-emotes-button'), null);
    assert.equal(environment.document.getElementById('wmd-alerts-button'), null);
    assert.deepEqual(
        items.map((item) => item.getAttribute('data-void-action') || item.getAttribute('data-alert-type')),
        ['photos', 'details', 'emotes', 'NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']
    );
    assert.equal(items[1].children[1].textContent, '折叠块');
    assert.equal(items[1].children[2].tagName, 'CODE');
    assert.equal(items[1].children[2].textContent, '<details>');
    assert.equal(environment.getMountCount(), 1);
    assert.equal(environment.getMountOptions().manualTrigger, true);
    assert.equal(environment.getMountOptions().trigger.id, 'void-editor-menu-trigger');
});

test('inserts the existing photos template and all Alert types from the menu', () => {
    const environment = createEnvironment();
    environment.menu.init();
    const items = menuItems(environment.document);

    environment.field.value = '正文';
    environment.field.selectionStart = 2;
    environment.field.selectionEnd = 2;
    items[0].click();
    assert.equal(environment.field.value, '正文\n\n[photos]\n\n[/photos]\n\n');

    for (let index = 3; index < items.length; index++) {
        const type = items[index].getAttribute('data-alert-type');
        environment.field.value = '选区';
        environment.field.selectionStart = 0;
        environment.field.selectionEnd = 2;
        items[index].click();
        assert.equal(environment.field.value, `> [!${type}]\n> 选区`);
    }
});

test('inserts a closed details block and selects its title from the menu', () => {
    const environment = createEnvironment();
    environment.menu.init();
    const trigger = environment.document.getElementById('void-editor-menu-trigger');
    const popup = environment.document.getElementById('void-editor-menu');
    let inputEvents = 0;
    environment.field.addEventListener('input', (event) => {
        assert.equal(event.bubbles, true);
        inputEvents++;
    });

    trigger.click();
    menuItems(environment.document)[1].click();

    assert.equal(
        environment.field.value,
        '<details>\n<summary>折叠标题</summary>\n\n折叠内容\n\n</details>'
    );
    assert.equal(
        environment.field.value.slice(environment.field.selectionStart, environment.field.selectionEnd),
        '折叠标题'
    );
    assert.equal(environment.document.activeElement, environment.field);
    assert.equal(popup.hidden, true);
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(inputEvents, 1);
});

test('wraps selected Markdown without changing it and selects the details title', () => {
    const environment = createEnvironment();
    const selected = '**粗体**\n\n- 第一项\n- 第二项\n\n```js\nconsole.log("<标签>");\n```';
    const before = '前段\n\n';
    const after = '\n\n后段';
    environment.field.value = before + selected + after;
    environment.field.setSelectionRange(before.length, before.length + selected.length);
    environment.menu.init();

    menuItems(environment.document)[1].click();

    assert.equal(
        environment.field.value,
        before + '<details>\n<summary>折叠标题</summary>\n\n' + selected + '\n\n</details>' + after
    );
    assert.equal(
        environment.field.value.slice(environment.field.selectionStart, environment.field.selectionEnd),
        '折叠标题'
    );
});

test('separates details from neighboring text and preserves document line endings', () => {
    const helpers = createEnvironment().menu.__test;
    for (const lineEnding of ['\n', '\r\n']) {
        for (const separator of ['', lineEnding, lineEnding + lineEnding]) {
            const before = '前段' + separator;
            const selected = '第一行' + lineEnding + '第二行';
            const after = separator + '后段';
            const source = before + selected + after;
            const result = helpers.applyTemplate(source, before.length, before.length + selected.length, 'details');
            const expected = [
                '前段',
                '',
                '<details>',
                '<summary>折叠标题</summary>',
                '',
                selected,
                '',
                '</details>',
                '',
                '后段'
            ].join(lineEnding);

            assert.equal(result.value, expected);
            assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), '折叠标题');
        }
    }
});

for (const [itemIndex, placeholder] of [[1, '折叠标题'], [3, '提示内容']]) {
    test(`preserves editor and document scroll when inserting ${placeholder} into existing content`, () => {
        const environment = createEnvironment();
        const field = environment.field;
        let value = '';
        let focusOptions = null;

        Object.defineProperty(field, 'value', {
            configurable: true,
            get() {
                return value;
            },
            set(nextValue) {
                value = String(nextValue);
                this.selectionStart = value.length;
                this.selectionEnd = value.length;
                this.scrollTop = 9999;
            }
        });
        field.focus = function (options) {
            focusOptions = options;
            environment.document.activeElement = this;
            environment.document.documentElement.scrollTop = 9999;
        };

        field.value = Array.from({ length: 200 }, (_, index) => `第 ${index} 行`).join('\n');
        field.selectionStart = field.value.indexOf('第 80 行');
        field.selectionEnd = field.selectionStart;
        field.scrollTop = 480;
        environment.document.documentElement.scrollTop = 240;

        environment.menu.init();
        menuItems(environment.document)[itemIndex].click();

        assert.equal(field.scrollTop, 480);
        assert.equal(environment.document.documentElement.scrollTop, 240);
        assert.equal(focusOptions.preventScroll, true);
        assert.equal(field.value.slice(field.selectionStart, field.selectionEnd), placeholder);
    });
}

test('supports trigger and menu keyboard navigation, Tab closing and focus restoration', () => {
    const environment = createEnvironment();
    environment.menu.init();
    const trigger = environment.document.getElementById('void-editor-menu-trigger');
    const popup = environment.document.getElementById('void-editor-menu');
    const items = menuItems(environment.document);

    trigger.dispatchEvent({ type: 'keydown', key: 'ArrowDown' });
    assert.equal(popup.hidden, false);
    assert.equal(environment.document.activeElement, items[0]);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');

    items[0].dispatchEvent({ type: 'keydown', key: 'ArrowDown' });
    assert.equal(environment.document.activeElement, items[1]);
    items[1].dispatchEvent({ type: 'keydown', key: 'Enter' });
    assert.equal(popup.hidden, true);
    assert.equal(environment.document.activeElement, environment.field);
    assert.equal(environment.field.value.slice(environment.field.selectionStart, environment.field.selectionEnd), '折叠标题');

    trigger.dispatchEvent({ type: 'keydown', key: 'ArrowDown' });
    items[0].dispatchEvent({ type: 'keydown', key: 'ArrowDown' });
    items[1].dispatchEvent({ type: 'keydown', key: 'End' });
    assert.equal(environment.document.activeElement, items[items.length - 1]);
    items[items.length - 1].dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.equal(popup.hidden, true);
    assert.equal(environment.document.activeElement, trigger);

    trigger.click();
    items[0].dispatchEvent({ type: 'keydown', key: 'Tab' });
    assert.equal(popup.hidden, true);
});

test('switches the VOID trigger between the menu and emote picker', () => {
    const environment = createEnvironment();
    const controller = environment.menu.init();
    const trigger = environment.document.getElementById('void-editor-menu-trigger');
    const popup = environment.document.getElementById('void-editor-menu');
    const items = menuItems(environment.document);

    trigger.click();
    items[2].click();
    assert.equal(popup.hidden, true);
    assert.equal(controller.picker.isOpen, true);
    assert.equal(trigger.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(trigger.getAttribute('aria-controls'), controller.picker.panel.id);
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(environment.document.activeElement, controller.picker.closeButton);

    trigger.click();
    assert.equal(controller.picker.isOpen, false);
    assert.equal(popup.hidden, false);
    assert.equal(trigger.getAttribute('aria-haspopup'), 'menu');
    assert.equal(trigger.getAttribute('aria-controls'), popup.id);
});

test('keeps the open menu inside the viewport and repositions it after resizing', () => {
    const environment = createEnvironment();
    environment.menu.init();
    const trigger = environment.document.getElementById('void-editor-menu-trigger');
    const popup = environment.document.getElementById('void-editor-menu');
    popup.bounds = { left: 280, right: 498 };
    environment.document.documentElement.clientWidth = 390;

    trigger.click();
    assert.equal(popup.style.transform, 'translateX(-116px)');

    environment.document.documentElement.clientWidth = 1280;
    environment.window.dispatchEvent({ type: 'resize' });
    assert.equal(popup.style.transform, 'translateX(0px)');

    popup.bounds = { left: -40, right: 178 };
    environment.window.dispatchEvent({ type: 'resize' });
    assert.equal(popup.style.transform, 'translateX(48px)');
});

test('outside clicks close the active popup without duplicating nodes after remount', () => {
    const environment = createEnvironment();
    const first = environment.menu.init();
    const trigger = environment.document.getElementById('void-editor-menu-trigger');
    const popup = environment.document.getElementById('void-editor-menu');

    trigger.click();
    environment.document.dispatchEvent({ type: 'mousedown', target: environment.field });
    assert.equal(popup.hidden, true);

    first.destroy();
    const second = environment.menu.init();
    assert.notEqual(second, first);
    assert.equal(environment.toolbar.children.length, 2);
    assert.equal(environment.document.querySelectorAll('.void-editor-menu').length, 1);
    assert.equal(environment.document.querySelectorAll('.void-editor-menu-spacer').length, 1);
    assert.equal(environment.getMountCount(), 2);
});

test('menu CSS keeps the approved width, visible focus and semantic dark colors', () => {
    assert.match(editorCss, /\.void-editor-menu__popup\s*\{[^}]*width:\s*218px/s);
    assert.match(
        editorCss,
        /@media\s*\(max-width:\s*575px\)[^{]*\{[^}]*\.void-editor-menu__popup\s*\{[^}]*right:\s*auto;[^}]*left:\s*0;/s
    );
    assert.match(editorCss, /\.void-editor-menu__trigger:focus-visible/);
    assert.match(editorCss, /\.void-editor-menu__icon--note\s*\{[^}]*#0969da/s);
    assert.match(editorCss, /data-typecho-theme="dark"[^}]*\.void-editor-menu__icon--caution\s*\{[^}]*#f85149/s);
});

test('menu dimensions override Typecho toolbar span sizing without affecting native buttons', () => {
    assert.match(
        editorCss,
        /#wmd-button-bar \.wmd-button-row\s*\{[^}]*height:\s*auto;/s
    );
    assert.match(
        editorCss,
        /li#wmd-void-button \.void-editor-menu__caret\s*\{[^}]*width:\s*0;[^}]*height:\s*0;/s
    );
    assert.match(
        editorCss,
        /li#wmd-void-button \.void-editor-menu__icon\s*\{[^}]*width:\s*16px;[^}]*height:\s*16px;/s
    );
    assert.match(
        editorCss,
        /li#wmd-void-button \.void-editor-menu__item-label[^}]*\{[^}]*width:\s*auto;[^}]*height:\s*auto;/s
    );
    assert.doesNotMatch(editorCss, /#wmd-button-bar \.wmd-button-row li span\s*\{/);
});

/* global __dirname */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorSource = fs.readFileSync(path.resolve(__dirname, '../../assets/editor.js'), 'utf8');

function extract(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(start, -1, `missing ${startMarker}`);
    assert.notEqual(end, -1, `missing ${endMarker}`);
    return source.slice(start, end + endMarker.length);
}

function loadAlertEditor() {
    const window = { jQuery() {} };
    window.window = window;
    const context = { window };

    vm.runInNewContext(
        extract(editorSource, 'var VOID_Editor_Alerts =', '})(window.jQuery);'),
        context
    );
    return context.VOID_Editor_Alerts.__test;
}

const alerts = loadAlertEditor();

test('creates all five GitHub Alert tokens', () => {
    for (const type of ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']) {
        assert.equal(alerts.createTemplate(type, '正文'), `> [!${type}]\n> 正文`);
    }
});

test('empty selection inserts and selects the placeholder', () => {
    const result = alerts.applyTemplate('', 0, 0, 'NOTE');

    assert.equal(result.value, '> [!NOTE]\n> 提示内容');
    assert.equal(result.value.slice(result.selectionStart, result.selectionEnd), '提示内容');
});

test('quotes single-line and multiline selections', () => {
    assert.equal(
        alerts.createTemplate('WARNING', '升级之前请备份'),
        '> [!WARNING]\n> 升级之前请备份'
    );
    assert.equal(
        alerts.createTemplate('TIP', '第一行\n\n第三行'),
        '> [!TIP]\n> 第一行\n>\n> 第三行'
    );
});

test('normalizes CRLF selection and preserves a valid blank quote line', () => {
    assert.equal(
        alerts.createTemplate('IMPORTANT', '第一行\r\n\r\n第三行'),
        '> [!IMPORTANT]\n> 第一行\n>\n> 第三行'
    );
});

test('separates an inserted Alert from surrounding content', () => {
    const result = alerts.applyTemplate('开头选区结尾', 2, 4, 'CAUTION');

    assert.equal(result.value, '开头\n\n> [!CAUTION]\n> 选区\n\n结尾');
    assert.equal(result.selectionStart, result.selectionEnd);
    assert.equal(result.selectionStart, result.value.indexOf('\n\n结尾'));
});

test('rejects unsupported and incorrectly cased types', () => {
    assert.equal(alerts.createTemplate('SUCCESS', '正文'), null);
    assert.equal(alerts.createTemplate('note', '正文'), null);
    assert.equal(alerts.applyTemplate('', 0, 0, 'SUCCESS'), null);
});

test('menu markup and handlers expose the accessibility contract', () => {
    for (const contract of [
        'aria-haspopup="menu"',
        'aria-expanded="false"',
        'role="menu"',
        'role="menuitem"',
        "event.key === 'ArrowDown'",
        "event.key === 'Enter'",
        "event.key === 'Escape'",
        "event.key === 'Tab'",
        'mousedown.voidEditorAlerts'
    ]) {
        assert.match(editorSource, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});

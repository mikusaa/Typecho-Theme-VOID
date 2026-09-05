const assert = require('node:assert/strict');
const test = require('node:test');
const { readVoidModule } = require('./helpers/void-source.cjs');

const source = readVoidModule('content');

test('hyphenation leaves Alert content and fallback markers untouched', () => {
    const start = source.indexOf('hyphenate: function ()');
    const end = source.indexOf('\n    }', start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);

    const implementation = source.slice(start, end);
    assert.match(implementation, /closest\('\.void-alert'\)/);
    assert.ok(implementation.includes('/\\[!|\\[\\/?notice\\b/i.test(text)'));
});

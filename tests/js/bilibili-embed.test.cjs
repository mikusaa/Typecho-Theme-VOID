const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const sass = require('sass');

const root = path.resolve(__dirname, '../..');
const css = sass.compile(path.join(root, 'assets/VOID.scss'), {
    style: 'expanded'
}).css;
const mainTemplate = fs.readFileSync(path.join(root, 'includes/main.php'), 'utf8');

test('Bilibili embeds use a direct responsive aspect ratio', () => {
    const match = css.match(/\.yue iframe\[src\*="\/\/player\.bilibili\.com\/"\]\s*\{([^}]*)\}/);

    assert.ok(match, 'missing compiled Bilibili iframe selector');
    assert.match(match[1], /width: 100%;/);
    assert.match(match[1], /height: auto;/);
    assert.match(match[1], /aspect-ratio: 16\/9;/);
    assert.match(match[1], /border: 0;/);
    assert.match(match[1], /background: #000;/);
});

test('article template no longer mutates Bilibili iframe markup', () => {
    assert.doesNotMatch(mainTemplate, /player\.bilibili\.com/);
    assert.doesNotMatch(mainTemplate, /bili-player/);
    assert.doesNotMatch(mainTemplate, /high_quality/);
    assert.doesNotMatch(css, /\.bili-player(?:\s|\{|,)/);
});

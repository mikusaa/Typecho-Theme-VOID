const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const sass = require('sass');

const css = sass.compile(path.resolve(__dirname, '../../assets/VOID.scss'), {
    style: 'expanded'
}).css;

const articleLinkSelector = '.yue .articleBody a:not(.void-image-link):not(.post-like):not(.edit-button):not(.board-item):not(.littlefoot--print)';

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function declarationsFor(selector) {
    const match = css.match(new RegExp('(?:^|\\n)' + escapeRegExp(selector) + '\\s*\\{([^}]*)\\}'));
    assert.ok(match, 'missing compiled selector: ' + selector);
    return match[1];
}

test('article links compile the proposed underline, wrapping and interaction styles', () => {
    const wrapping = declarationsFor('.yue .articleBody a');
    const base = declarationsFor(articleLinkSelector);
    const interactive = declarationsFor(articleLinkSelector + ':hover, ' + articleLinkSelector + ':focus-visible');
    const focus = declarationsFor(articleLinkSelector + ':focus-visible');
    const dark = declarationsFor('.theme-dark ' + articleLinkSelector);
    const darkInteractive = declarationsFor(
        '.theme-dark ' + articleLinkSelector + ':hover, .theme-dark ' + articleLinkSelector + ':focus-visible'
    );

    assert.match(wrapping, /overflow-wrap: anywhere;/);
    assert.match(wrapping, /word-break: normal;/);

    assert.match(base, /border-bottom: 0;/);
    assert.match(base, /color: inherit;/);
    assert.match(base, /text-decoration-line: underline;/);
    assert.match(base, /text-decoration-style: solid;/);
    assert.match(base, /text-decoration-thickness: 1px;/);
    assert.match(base, /text-decoration-color: rgba\(0, 0, 0, 0\.28\);/);
    assert.match(base, /text-underline-offset: 0\.18em;/);
    assert.match(base, /text-decoration-skip-ink: auto;/);

    assert.match(interactive, /color: #ad5555;/);
    assert.match(interactive, /text-decoration-color: currentColor;/);
    assert.match(interactive, /text-decoration-thickness: 1\.5px;/);
    assert.match(focus, /outline: 2px solid #ad5555;/);
    assert.match(focus, /outline-offset: 3px;/);

    assert.match(dark, /text-decoration-color: rgba\(255, 255, 255, 0\.42\);/);
    assert.match(darkInteractive, /color: #d18383;/);
    assert.match(darkInteractive, /text-decoration-color: currentColor;/);
});

test('article link styling preserves non-content links and component-owned decoration', () => {
    const nonArticle = declarationsFor('.yue a:not(.void-image-link):not(.post-like):not(.edit-button)');
    const figureCaption = declarationsFor('article figure figcaption a');
    const footnote = declarationsFor('article sup a');
    const boardItem = declarationsFor('.board-list .board-item');
    const concealedLink = declarationsFor('.yue del:not(:hover) a');

    assert.match(nonArticle, /border-bottom: 1px solid rgba\(0, 0, 0, 0\.2\);/);
    assert.match(figureCaption, /text-decoration: none !important;/);
    assert.match(footnote, /text-decoration: none !important;/);
    assert.match(boardItem, /text-decoration: none;/);
    assert.match(concealedLink, /text-decoration: none !important;/);

    assert.match(
        css,
        /\.yue \.articleBody h1 a,[\s\S]*?\.yue \.articleBody h6 a \{\s*text-decoration: none !important;/
    );
    assert.match(
        css,
        /@media \(prefers-reduced-motion: reduce\) \{\s*\.yue \.articleBody a:not\([\s\S]*?transition: none;/
    );
    assert.doesNotMatch(css, /\.yue \.articleBody[^,{]*:visited/);
});

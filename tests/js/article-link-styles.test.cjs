const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const sass = require('sass');
const CleanCSS = require('clean-css');

const css = sass.compile(path.resolve(__dirname, '../../assets/VOID.scss'), {
    style: 'expanded'
}).css;

const articleLinkSelector = ':where(.yue) :where(.articleBody) a';

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function declarationsFor(selector) {
    const match = css.match(new RegExp('(?:^|\\n)' + escapeRegExp(selector) + '\\s*\\{([^}]*)\\}'));
    assert.ok(match, 'missing compiled selector: ' + selector);
    return match[1];
}

test('article links retain underline, wrapping and interaction defaults in both themes', () => {
    const base = declarationsFor(articleLinkSelector);
    const interactive = declarationsFor(articleLinkSelector + ':where(:hover, :focus-visible)');
    const focus = declarationsFor(articleLinkSelector + ':where(:focus-visible)');
    const dark = declarationsFor(':where(.theme-dark) ' + articleLinkSelector);
    const darkInteractive = declarationsFor(
        ':where(.theme-dark) ' + articleLinkSelector + ':where(:hover, :focus-visible)'
    );

    assert.match(base, /overflow-wrap: anywhere;/);
    assert.match(base, /word-break: normal;/);

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
    assert.doesNotMatch(focus, /border-radius:/);

    assert.match(dark, /text-decoration-color: rgba\(255, 255, 255, 0\.42\);/);
    assert.match(darkInteractive, /color: #d18383;/);
    assert.match(darkInteractive, /text-decoration-color: currentColor;/);
});

test('legacy borders remain defaults and components own their decoration', () => {
    const nonArticleSelector = ':where(.yue) a:where(:not(.void-image-link, .post-like, .edit-button))';
    const nonArticle = declarationsFor(nonArticleSelector);
    const figureCaption = declarationsFor('article figure figcaption a');
    const footnote = declarationsFor('article sup a');
    const boardItem = declarationsFor('.board-list .board-item');
    const concealedLink = declarationsFor('.yue del:not(:hover) a');
    const heading = declarationsFor(':where(.yue) :where(.articleBody) :where(h1, h2, h3, h4, h5, h6) a');

    assert.match(nonArticle, /border-bottom: 1px solid rgba\(0, 0, 0, 0\.2\);/);
    assert.ok(css.indexOf(nonArticleSelector + ' {') < css.indexOf(articleLinkSelector + ' {'));
    assert.match(figureCaption, /text-decoration: none !important;/);
    assert.match(footnote, /text-decoration: none !important;/);
    assert.match(boardItem, /text-decoration: none;/);
    assert.match(concealedLink, /text-decoration: none !important;/);
    assert.match(heading, /color: inherit;/);
    assert.match(heading, /text-decoration: none;/);

    for (const selector of ['.btn', '.social-button a.social-button-icon', 'main .wrapper .tag-item', 'article a.void-image-link']) {
        assert.match(declarationsFor(selector), /text-decoration: none;/, selector);
    }
    assert.match(declarationsFor('main .wrapper .tag-item'), /color: inherit;/);

    assert.doesNotMatch(css, /\.yue \.articleBody blockquote a \{/);
    assert.match(
        css,
        /@media \(prefers-reduced-motion: reduce\) \{\s*:where\(\.yue\) :where\(\.articleBody\) a \{\s*transition: none;/
    );
    assert.doesNotMatch(css, /\.yue \.articleBody[^,{]*:visited/);
});

test('link resets and article interaction states do not outrank component classes', () => {
    assert.match(declarationsFor(':where(a, a:hover)'), /text-decoration: none;/);
    assert.match(declarationsFor(':where(.theme-dark) :where(a, a:hover)'), /color:/);
    assert.doesNotMatch(css, /(?:^|\n)a, a:hover \{/);

    const defaults = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter((match) => match[1].includes(':where(.yue) :where(.articleBody)'));

    assert.ok(defaults.length > 0, 'missing article link defaults');
    for (const [, selector, declarations] of defaults) {
        const outsideWhere = selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '').trim();
        assert.equal(outsideWhere, 'a', 'non-default specificity: ' + selector.trim());
        assert.doesNotMatch(declarations, /!important|border-radius:/);
    }
});

test('production CSS minification preserves descendant scopes and interaction states', () => {
    const result = new CleanCSS().minify(css);
    assert.deepEqual(result.errors, []);
    for (const selector of [
        articleLinkSelector,
        articleLinkSelector + ':where(:hover,:focus-visible)',
        articleLinkSelector + ':where(:focus-visible)',
        ':where(.theme-dark) ' + articleLinkSelector,
        ':where(.yue) :where(.articleBody) :where(h1,h2,h3,h4,h5,h6) a'
    ]) {
        assert.ok(result.styles.includes(selector + '{'), 'missing minified selector: ' + selector);
    }
});

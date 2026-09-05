const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { readVoidSource } = require('./helpers/void-source.cjs');

const repositoryRoot = path.resolve(__dirname, '../..');

test('advanced setting sample is valid JSON without retired keys', () => {
    const samplePath = path.join(repositoryRoot, 'advanceSetting.sample.json');
    const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

    assert.equal(Array.isArray(sample), false);
    assert.equal(sample === null, false);
    assert.equal(Object.prototype.hasOwnProperty.call(sample, 'bluredLazyload'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(sample, 'CDNType'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(sample, 'browserLevelLoadingLazy'), false);
    assert.equal(sample.twitterId, '');
    assert.equal(sample.weiboId, '');
});

test('README links the advanced setting reference and JSON sample', () => {
    const readme = fs.readFileSync(path.join(repositoryRoot, 'README.md'), 'utf8');

    assert.match(readme, /\[超高级设置说明\]\(\.\/advanceSetting\.md\)/);
    assert.match(readme, /\[JSON 示例\]\(\.\/advanceSetting\.sample\.json\)/);
});

test('runtime sources no longer contain the blurred placeholder contract', () => {
    const runtimeSources = [
        'libs/Contents.php',
        'includes/header.php',
        'assets/header.js',
        'assets/VOID.scss',
        'assets/parts/_article.scss',
        'assets/parts/_gallery.scss',
        'assets/parts/_index.scss'
    ];

    for (const relativePath of runtimeSources) {
        const source = fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
        assert.doesNotMatch(source, /blured-placeholder|remove-after|genBluredPlaceholderSrc/);
    }
});

test('native lazy loading no longer depends on theme visibility JavaScript', () => {
    const headTemplate = fs.readFileSync(path.join(repositoryRoot, 'includes/head.php'), 'utf8');
    const headerScript = fs.readFileSync(path.join(repositoryRoot, 'assets/header.js'), 'utf8');
    const contentScript = readVoidSource();
    const styles = fs.readFileSync(path.join(repositoryRoot, 'assets/VOID.scss'), 'utf8');

    for (const source of [headTemplate, headerScript, contentScript, styles]) {
        assert.doesNotMatch(source, /browserLevelLoadingLazy|browserlevel-lazy|VOID_BrowserLoadingLazy|VOID_Lazyload/);
    }
    assert.match(headerScript, /\[data-void-gallery\] img\.lazyload/);
    assert.match(styles, /\[data-void-gallery\] img\.lazyload/);
    assert.doesNotMatch(styles, /(?:^|\n)img\.lazyload\s*\{/);
});

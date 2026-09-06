const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { headerSourcePaths, readHeaderSource } = require('./helpers/header-source.cjs');
const { readVoidSource } = require('./helpers/void-source.cjs');

const repositoryRoot = path.resolve(__dirname, '../..');

test('advanced setting sample is valid JSON without retired keys', () => {
    const samplePath = path.join(repositoryRoot, 'advanceSetting.sample.json');
    const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

    assert.equal(Array.isArray(sample), false);
    assert.equal(sample === null, false);
    for (const retired of [
        'darkModeTime',
        'followSystemColorScheme',
        'bluredLazyload',
        'CDNType',
        'browserLevelLoadingLazy',
        'feedContentMode'
    ]) {
        assert.equal(Object.prototype.hasOwnProperty.call(sample, retired), false);
    }
    assert.equal(sample.twitterId, '');
    assert.equal(sample.weiboId, '');
});

test('README links the advanced setting reference and JSON sample', () => {
    const readme = fs.readFileSync(path.join(repositoryRoot, 'README.md'), 'utf8');

    assert.match(readme, /\[超高级设置说明\]\(https:\/\/github\.com\/mikusaa\/Typecho-Theme-VOID\/blob\/master\/docs\/advanceSetting\.md\)/);
    assert.match(readme, /\[JSON 示例\]\(\.\/advanceSetting\.sample\.json\)/);
    assert.equal(fs.existsSync(path.join(repositoryRoot, 'advanceSetting.md')), false);
    assert.equal(fs.existsSync(path.join(repositoryRoot, 'docs/advanceSetting.md')), true);
});

test('advanced setting documentation stays outside theme build inputs', () => {
    const gulpfile = fs.readFileSync(path.join(repositoryRoot, 'gulpfile.js'), 'utf8');
    const buildCheck = fs.readFileSync(path.join(repositoryRoot, 'scripts/check-build-output.mjs'), 'utf8');

    assert.doesNotMatch(gulpfile, /['"]\.\/docs\/advanceSetting\.md['"]/);
    assert.doesNotMatch(gulpfile, /['"]\.\/advanceSetting\.md['"]/);
    assert.match(buildCheck, /file === 'docs\/advanceSetting\.md'/);
});

test('runtime sources no longer contain the blurred placeholder contract', () => {
    const runtimeSources = [
        'libs/Contents.php',
        'includes/header.php',
        ...headerSourcePaths,
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
    const headerScript = readHeaderSource();
    const contentScript = readVoidSource();
    const styles = fs.readFileSync(path.join(repositoryRoot, 'assets/VOID.scss'), 'utf8');

    for (const source of [headTemplate, headerScript, contentScript, styles]) {
        assert.doesNotMatch(source, /browserLevelLoadingLazy|browserlevel-lazy|VOID_BrowserLoadingLazy|VOID_Lazyload/);
    }
    assert.match(headerScript, /\[data-void-gallery\] img\.lazyload/);
    assert.match(styles, /\[data-void-gallery\] img\.lazyload/);
    assert.doesNotMatch(styles, /(?:^|\n)img\.lazyload\s*\{/);
});

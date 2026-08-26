const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../..');

test('advanced setting sample is valid JSON without retired keys', () => {
    const samplePath = path.join(repositoryRoot, 'advanceSetting.sample.json');
    const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));

    assert.equal(Array.isArray(sample), false);
    assert.equal(sample === null, false);
    assert.equal(Object.prototype.hasOwnProperty.call(sample, 'bluredLazyload'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(sample, 'CDNType'), false);
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

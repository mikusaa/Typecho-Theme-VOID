const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
    editorSourcePaths,
    readEditorModule,
    readEditorSource,
    repositoryRoot
} = require('./helpers/editor-source.cjs');

test('editor source manifest is complete, unique, and keeps bootstrap last', () => {
    const sourceDirectory = path.join(repositoryRoot, 'assets/js/editor');
    const discovered = fs.readdirSync(sourceDirectory)
        .filter((name) => name.endsWith('.js'))
        .map((name) => path.posix.join('assets/js/editor', name))
        .sort();
    const manifestEntries = [...editorSourcePaths].sort();

    assert.equal(new Set(editorSourcePaths).size, editorSourcePaths.length);
    assert.deepEqual(editorSourcePaths.map((entry) => path.basename(entry)), [
        'menu.js',
        'banner-meta.js',
        'fields.js',
        'bootstrap.js'
    ]);
    assert.deepEqual(manifestEntries, discovered);
    assert.equal(path.basename(editorSourcePaths.at(-1)), 'bootstrap.js');
    assert.equal(fs.existsSync(path.join(repositoryRoot, 'assets/editor.js')), false);
    assert.match(fs.readFileSync(path.join(repositoryRoot, '.gitignore'), 'utf8'), /^\/assets\/editor\.js$/m);
});

test('editor modules preserve their classic-script responsibilities and order', () => {
    const source = readEditorSource();
    const menu = readEditorModule('menu');
    const bannerMeta = readEditorModule('banner-meta');
    const fields = readEditorModule('fields');
    const declarations = [
        'function insertAtCursor',
        'var VOID_Editor_Menu =',
        'function initEditorToolbar',
        'var VOID_BannerMeta =',
        'var VOID_Editor_Admin =',
        '$(function () {'
    ];
    let previousIndex = -1;

    for (const declaration of declarations) {
        const currentIndex = source.indexOf(declaration);
        assert.ok(currentIndex > previousIndex, `${declaration} must keep its production order`);
        previousIndex = currentIndex;
    }

    assert.match(menu, /function insertAtCursor/);
    assert.match(menu, /window\.VoidEmotes\.mount/);
    assert.match(menu, /PHOTOS_TEMPLATE/);
    assert.match(menu, /ALERT_TYPES/);
    assert.match(bannerMeta, /function parseMeta/);
    assert.match(bannerMeta, /function serializeMeta/);
    assert.match(bannerMeta, /probeToken/);
    assert.match(fields, /function buildVoidFieldPanel/);
    assert.match(fields, /function initSegmentedSelects/);
    assert.match(fields, /function initSwitchControls/);
    assert.match(fields, /function initMediaFieldLayout/);
});

test('bootstrap is the only DOM-ready initializer', () => {
    const source = readEditorSource();
    const bootstrap = readEditorModule('bootstrap');

    assert.equal((source.match(/\$\(function \(\) \{/g) || []).length, 1);
    assert.match(bootstrap, /^\$\(function \(\) \{/);
    assert.match(bootstrap, /initEditorToolbar\(\);/);
    assert.match(bootstrap, /window\.VOID_BannerMeta\.init\(\);/);
    assert.match(bootstrap, /window\.VOID_Editor_Admin\.init\(\);/);
});

test('build, development, watch, lint, and tests consume the editor manifest', () => {
    const gulpfile = fs.readFileSync(path.join(repositoryRoot, 'gulpfile.js'), 'utf8');
    const eslintConfig = fs.readFileSync(path.join(repositoryRoot, 'eslint.config.cjs'), 'utf8');
    const buildCheck = fs.readFileSync(
        path.join(repositoryRoot, 'scripts/check-build-output.mjs'),
        'utf8'
    );
    const helper = fs.readFileSync(
        path.join(repositoryRoot, 'tests/js/helpers/editor-source.cjs'),
        'utf8'
    );

    assert.match(gulpfile, /require\('\.\/scripts\/editor-sources\.cjs'\)/);
    assert.equal((gulpfile.match(/gulp\.src\(editorJsSources\)/g) || []).length, 2);
    assert.match(gulpfile, /gulp\.watch\(editorJsSources/);
    assert.match(eslintConfig, /require\('\.\/scripts\/editor-sources\.cjs'\)/);
    assert.match(buildCheck, /import editorSourcePaths from '\.\/editor-sources\.cjs'/);
    assert.match(helper, /require\('\.\.\/\.\.\/\.\.\/scripts\/editor-sources\.cjs'\)/);
});

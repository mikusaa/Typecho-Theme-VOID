const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
    headerSourcePaths,
    readHeaderModule,
    readHeaderSource,
    repositoryRoot
} = require('./helpers/header-source.cjs');

test('header source manifest is complete, unique, and keeps bootstrap last', () => {
    const sourceDirectory = path.join(repositoryRoot, 'assets/js/header');
    const discovered = fs.readdirSync(sourceDirectory)
        .filter((name) => name.endsWith('.js'))
        .map((name) => path.posix.join('assets/js/header', name))
        .sort();
    const manifestEntries = [...headerSourcePaths].sort();

    assert.equal(new Set(headerSourcePaths).size, headerSourcePaths.length);
    assert.deepEqual(manifestEntries, discovered);
    assert.equal(path.basename(headerSourcePaths.at(-1)), 'bootstrap.js');
    assert.equal(fs.existsSync(path.join(repositoryRoot, 'assets/header.js')), false);

    for (const relativePath of headerSourcePaths) {
        assert.equal(fs.existsSync(path.join(repositoryRoot, relativePath)), true, relativePath);
    }
});

test('assembled header source preserves classic globals and dependency order', () => {
    const source = readHeaderSource();
    const declarations = [
        'TOC = {',
        'VOID_Util = {',
        'VOID_CardCover = {',
        'VOID_GalleryLazyload = {',
        'VOID_SmoothScroller = {',
        'VOID_AnchorScroller = {',
        'VOID_ControllerPanel = {',
        'VOID_Ui = {',
        'VOID_Ui.toggleLoginForm = function',
        'VOID_Ui.MasonryCtrler = {',
        'VOID_Ui.DarkModeSwitcher = {',
        'VOID_Ui.Swiper = {'
    ];
    let previousIndex = -1;

    for (const declaration of declarations) {
        const currentIndex = source.indexOf(declaration);
        assert.ok(currentIndex > previousIndex, `${declaration} must keep its production order`);
        previousIndex = currentIndex;
    }

    assert.ok(source.indexOf('VOID_SmoothScroller = {') < source.indexOf('VOID_AnchorScroller = {'));
    assert.ok(source.indexOf('VOID_AnchorScroller = {') < source.indexOf('VOID_Ui = {'));
});

test('bootstrap owns the two loading-time side effects exactly once', () => {
    const source = readHeaderSource();
    const bootstrap = readHeaderModule('bootstrap');

    assert.equal(bootstrap.trim(), 'VOID_CardCover.bind();\nVOID_Ui.bindGlobalEvents();');
    assert.equal((source.match(/VOID_CardCover\.bind\(\);/g) || []).length, 1);
    assert.equal((source.match(/VOID_Ui\.bindGlobalEvents\(\);/g) || []).length, 1);
});

test('build, development, lint, and tests consume the authoritative header manifest', () => {
    const gulpfile = fs.readFileSync(path.join(repositoryRoot, 'gulpfile.js'), 'utf8');
    const eslintConfig = fs.readFileSync(path.join(repositoryRoot, 'eslint.config.cjs'), 'utf8');
    const helper = fs.readFileSync(
        path.join(repositoryRoot, 'tests/js/helpers/header-source.cjs'),
        'utf8'
    );

    assert.match(gulpfile, /require\('\.\/scripts\/header-sources\.cjs'\)/);
    assert.equal((gulpfile.match(/gulp\.src\(headerJsSources\)/g) || []).length, 2);
    assert.match(gulpfile, /gulp\.watch\(headerJsSources/);
    assert.match(eslintConfig, /require\('\.\/scripts\/header-sources\.cjs'\)/);
    assert.match(helper, /require\('\.\.\/\.\.\/\.\.\/scripts\/header-sources\.cjs'\)/);
});

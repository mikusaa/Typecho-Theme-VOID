const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
    readVoidSource,
    repositoryRoot,
    voidSourcePaths
} = require('./helpers/void-source.cjs');

test('VOID source manifest is complete, unique, and keeps bootstrap last', () => {
    const sourceDirectory = path.join(repositoryRoot, 'assets/js/void');
    const discovered = fs.readdirSync(sourceDirectory)
        .filter((name) => name.endsWith('.js'))
        .map((name) => path.posix.join('assets/js/void', name))
        .sort();
    const manifestEntries = [...voidSourcePaths].sort();

    assert.equal(new Set(voidSourcePaths).size, voidSourcePaths.length, 'manifest entries must be unique');
    assert.deepEqual(manifestEntries, discovered, 'manifest must include every VOID source module');
    assert.equal(path.basename(voidSourcePaths.at(-1)), 'bootstrap.js');

    for (const relativePath of voidSourcePaths) {
        assert.equal(fs.existsSync(path.join(repositoryRoot, relativePath)), true, relativePath);
    }
});

test('assembled VOID source preserves the public classic-script globals and startup order', () => {
    const source = readVoidSource();
    const declarations = [
        'var VOID_Content = {',
        'var VOID_DialogScrollLock = {',
        'var VOID_PhotoSets = {',
        'var VOID_Gallery = {',
        'var VOID_PhotoSwipe = {',
        'var VOID_RewardDialog = {',
        'var VOID = {',
        'var VOID_Vote = {',
        'var Share = {',
        'var AjaxComment = {',
        'function VOID_onReady(callback) {'
    ];
    let previousIndex = -1;

    for (const declaration of declarations) {
        const currentIndex = source.indexOf(declaration);
        assert.ok(currentIndex > previousIndex, `${declaration} must keep its production order`);
        previousIndex = currentIndex;
    }

    assert.match(
        source,
        /VOID_Gallery\.init\(\);\s*VOID_PhotoSets\.init\(\);\s*VOID_PhotoSwipe\.init\(\);/
    );
    assert.match(
        source,
        /VOID_PhotoSwipe\.destroy\(\);\s*VOID_Gallery\.suspend\(\);\s*VOID_PhotoSets\.destroy\(\);/
    );
    assert.ok(source.indexOf('VOID.bindPjaxLifecycle();') < source.indexOf('VOID.init();'));
});

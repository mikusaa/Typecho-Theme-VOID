const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

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

function topLevelLines(source) {
    return source.split('\n').filter((line) => /^[A-Za-z_$]/.test(line));
}

test('every load-time reference follows the module that defines its global', () => {
    const definedBy = new Map();
    const modules = headerSourcePaths.map((relativePath) => ({
        name: path.basename(relativePath),
        lines: topLevelLines(readHeaderModule(path.basename(relativePath)))
    }));

    modules.forEach((module, index) => {
        for (const line of module.lines) {
            const definition = line.match(/^([A-Za-z_$][\w$]*) = /);
            if (definition) {
                assert.equal(definedBy.has(definition[1]), false, `${definition[1]} is defined once`);
                definedBy.set(definition[1], index);
            }
        }
    });
    for (const expectedGlobal of ['TOC', 'VOID_Util', 'VOID_SmoothScroller', 'VOID_AnchorScroller', 'VOID_Ui']) {
        assert.ok(definedBy.has(expectedGlobal), `${expectedGlobal} stays a classic global`);
    }

    // Statements such as `VOID_Ui.Swiper = {` or `VOID_Ui.bindGlobalEvents();` run while the
    // bundle loads, so the object they touch must already exist.
    modules.forEach((module, index) => {
        for (const line of module.lines) {
            const reference = line.match(/^([A-Za-z_$][\w$]*)\./);
            if (!reference) {
                continue;
            }
            assert.ok(definedBy.has(reference[1]), `${module.name} references a defined global ${reference[1]}`);
            assert.ok(
                definedBy.get(reference[1]) < index,
                `${module.name} must load after the module defining ${reference[1]}`
            );
        }
    });
});

test('bootstrap runs the two loading-time side effects exactly once, in order', () => {
    const calls = [];
    const context = {
        VOID_CardCover: { bind: () => calls.push('VOID_CardCover.bind') },
        VOID_Ui: { bindGlobalEvents: () => calls.push('VOID_Ui.bindGlobalEvents') }
    };
    const source = readHeaderSource();

    vm.runInNewContext(readHeaderModule('bootstrap'), context);

    assert.deepEqual(calls, ['VOID_CardCover.bind', 'VOID_Ui.bindGlobalEvents']);
    assert.equal((source.match(/VOID_CardCover\.bind\(\)/g) || []).length, 1);
    assert.equal((source.match(/VOID_Ui\.bindGlobalEvents\(\)/g) || []).length, 1);
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

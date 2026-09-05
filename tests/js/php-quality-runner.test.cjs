const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
    discoverPhpTests,
    listTrackedPhpFiles,
    runPhpFiles
} = require('../../scripts/php-quality.cjs');

const repositoryRoot = path.resolve(__dirname, '../..');

test('PHP test discovery is recursive, sorted, and limited to Test.php files', async (t) => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'void-php-tests-'));
    t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));

    await fs.mkdir(path.join(temporaryRoot, 'nested'));
    await fs.writeFile(path.join(temporaryRoot, 'ZetaTest.php'), '');
    await fs.writeFile(path.join(temporaryRoot, 'AlphaTest.php'), '');
    await fs.writeFile(path.join(temporaryRoot, 'nested', 'BetaTest.php'), '');
    await fs.writeFile(path.join(temporaryRoot, 'Ignored.php'), '');

    assert.deepEqual(
        discoverPhpTests(temporaryRoot).map((filePath) =>
            path.relative(temporaryRoot, filePath).split(path.sep).join('/')
        ),
        ['AlphaTest.php', 'nested/BetaTest.php', 'ZetaTest.php']
    );
});

test('PHP files run in independent processes and failures are summarized', async (t) => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'void-php-processes-'));
    t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));

    const first = path.join(temporaryRoot, 'FirstTest.php');
    const second = path.join(temporaryRoot, 'SecondTest.php');
    const failing = path.join(temporaryRoot, 'FailingTest.php');
    await fs.writeFile(first, 'globalThis.__voidSharedState = true;');
    await fs.writeFile(second, 'if (globalThis.__voidSharedState) process.exit(2);');
    await fs.writeFile(failing, 'process.exit(3);');

    const isolated = runPhpFiles([first, second], {
        binary: process.execPath,
        cwd: temporaryRoot,
        quiet: true,
        stdio: 'ignore'
    });
    assert.equal(isolated.total, 2);
    assert.deepEqual(isolated.failures, []);

    const failed = runPhpFiles([first, failing], {
        binary: process.execPath,
        cwd: temporaryRoot,
        quiet: true,
        stdio: 'ignore'
    });
    assert.equal(failed.total, 2);
    assert.equal(failed.failures.length, 1);
    assert.equal(failed.failures[0].file, failing);
    assert.equal(failed.failures[0].status, 3);
});

test('tracked PHP discovery covers runtime sources and every contract test', () => {
    const tracked = listTrackedPhpFiles(repositoryRoot).map((filePath) =>
        path.relative(repositoryRoot, filePath).split(path.sep).join('/')
    );
    const tests = discoverPhpTests().map((filePath) =>
        path.relative(repositoryRoot, filePath).split(path.sep).join('/')
    );

    assert.ok(tracked.includes('functions.php'));
    assert.ok(tracked.includes('libs/Contents.php'));
    assert.deepEqual(tracked.filter((filePath) => filePath.startsWith('tests/php/')), tests);
});

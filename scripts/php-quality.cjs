const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.resolve(__dirname, '..');

function toPosixPath(filePath) {
    return filePath.split(path.sep).join('/');
}

function discoverPhpTests(directory = path.join(repositoryRoot, 'tests/php')) {
    const tests = [];

    function visit(currentDirectory) {
        const entries = fs.readdirSync(currentDirectory, { withFileTypes: true })
            .sort((left, right) => left.name.localeCompare(right.name));

        for (const entry of entries) {
            const entryPath = path.join(currentDirectory, entry.name);
            if (entry.isDirectory()) {
                visit(entryPath);
            } else if (entry.isFile() && entry.name.endsWith('Test.php')) {
                tests.push(entryPath);
            }
        }
    }

    visit(directory);
    return tests.sort((left, right) => toPosixPath(left).localeCompare(toPosixPath(right)));
}

function listTrackedPhpFiles(root = repositoryRoot, gitBinary = 'git') {
    const result = spawnSync(gitBinary, ['ls-files', '-z', '--', '*.php'], {
        cwd: root,
        encoding: 'buffer'
    });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`git ls-files failed with status ${result.status}`);
    }

    return result.stdout.toString('utf8')
        .split('\0')
        .filter(Boolean)
        .sort()
        .map((relativePath) => path.join(root, ...relativePath.split('/')));
}

function runPhpFiles(files, options = {}) {
    const binary = options.binary || process.env.PHP_BINARY || 'php';
    const argumentsForFile = options.argumentsForFile || ((filePath) => [filePath]);
    const cwd = options.cwd || repositoryRoot;
    const stdio = options.stdio || 'inherit';
    const failures = [];

    for (const filePath of files) {
        const displayPath = toPosixPath(path.relative(cwd, filePath));
        if (!options.quiet) {
            console.log(`\n==> ${displayPath}`);
        }
        const result = spawnSync(binary, argumentsForFile(filePath), { cwd, stdio });
        if (result.error || result.status !== 0) {
            failures.push({
                file: filePath,
                status: result.status,
                error: result.error || null
            });
        }
    }

    return { failures, total: files.length };
}

function printSummary(label, result, root = repositoryRoot) {
    if (result.failures.length === 0) {
        console.log(`\n${label}: ${result.total}/${result.total} passed.`);
        return;
    }

    console.error(`\n${label}: ${result.failures.length}/${result.total} failed:`);
    for (const failure of result.failures) {
        const displayPath = toPosixPath(path.relative(root, failure.file));
        const detail = failure.error ? failure.error.message : `exit ${failure.status}`;
        console.error(`- ${displayPath}: ${detail}`);
    }
}

function run(mode, options = {}) {
    const root = options.repositoryRoot || repositoryRoot;
    let files;
    let result;
    let label;

    if (mode === 'test') {
        files = discoverPhpTests(options.testDirectory || path.join(root, 'tests/php'));
        label = 'PHP contract tests';
        result = runPhpFiles(files, {
            ...options,
            cwd: root,
            argumentsForFile: (filePath) => [filePath]
        });
    } else if (mode === 'lint') {
        files = listTrackedPhpFiles(root, options.gitBinary);
        label = 'PHP syntax checks';
        result = runPhpFiles(files, {
            ...options,
            cwd: root,
            argumentsForFile: (filePath) => ['-l', filePath]
        });
    } else {
        throw new Error(`Unknown PHP quality mode: ${mode || '(empty)'}`);
    }

    printSummary(label, result, root);
    return result.failures.length === 0 ? 0 : 1;
}

if (require.main === module) {
    try {
        process.exitCode = run(process.argv[2]);
    } catch (error) {
        console.error(`PHP quality runner failed: ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    discoverPhpTests,
    listTrackedPhpFiles,
    run,
    runPhpFiles,
    toPosixPath
};

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../..');

function read(relativePath) {
    return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

test('Makefile exposes the authoritative local workflows through repository tools', () => {
    const makefile = read('Makefile');

    assert.match(makefile, /^\.PHONY: .*clean.*dev-build.*watch.*build.*verify/m);
    assert.match(makefile, /^GULP := \.\/node_modules\/\.bin\/gulp$/m);
    assert.match(makefile, /^node_modules\/\.package-lock\.json: package\.json package-lock\.json$/m);
    assert.match(makefile, /^dev-build: node_modules\/\.package-lock\.json$/m);
    assert.match(makefile, /\$\(GULP\) dev-build\n\tnpm run dev-build:check/);
    assert.match(makefile, /^build: node_modules\/\.package-lock\.json$/m);
    assert.match(makefile, /\$\(GULP\) build\n\tnpm run fonts:check\n\tnpm run build:check/);
    assert.match(makefile, /^verify: node_modules\/\.package-lock\.json$/m);
    assert.doesNotMatch(makefile, /\bnpx gulp\b|npm install -g/);
});

test('generated development and production units are isolated from source assets', () => {
    const ignore = read('.gitignore');
    const gulpfile = read('gulpfile.js');

    assert.match(ignore, /^\/build\/$/m);
    assert.match(ignore, /^\/dev-build\/$/m);
    assert.doesNotMatch(ignore, /^assets\/(?:VOID|bundle)/m);
    assert.match(gulpfile, /var developmentRoot = '\.\/dev-build';/);
    assert.doesNotMatch(gulpfile, /gulp\.dest\('\.\/assets/);
    assert.match(gulpfile, /'\.\/assets\/parts\/\*\*\/\*\.scss'/);
    assert.match(gulpfile, /var watchOptions = \{\n    usePolling: true,/);
});

test('CI validates pull requests and publishes only a verified master artifact', () => {
    const workflow = read('.github/workflows/ci.yml');

    assert.match(workflow, /^  pull_request:$/m);
    assert.match(workflow, /^permissions:\n  contents: read$/m);
    assert.match(workflow, /^  verify:$/m);
    assert.match(workflow, /run: make verify/);
    assert.match(workflow, /php-version: \['7\.0', '8\.5'\]/);
    assert.match(workflow, /^  nightly:\n    if: github\.event_name == 'push'/m);
    assert.match(workflow, /needs: \[verify, php-contracts\]/);
    assert.match(workflow, /name: void-build-\$\{\{ github\.sha \}\}/g);
    assert.match(workflow, /^    permissions:\n      contents: write$/m);
});

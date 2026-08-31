const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function sha256(relativePath) {
    return crypto.createHash('sha256')
        .update(fs.readFileSync(path.join(root, relativePath)))
        .digest('hex');
}

function listFiles(directory) {
    const files = [];

    function visit(relativePath) {
        const current = path.join(directory, relativePath);
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const child = path.join(relativePath, entry.name);
            if (entry.isDirectory()) {
                visit(child);
            } else {
                files.push(child.split(path.sep).join('/'));
            }
        }
    }

    visit('');
    return files.sort();
}

test('vendored release files match the pinned official npm artifacts', () => {
    const expectedHashes = {
        'assets/libs/header/ResizeSensor/LICENSE': '39bae37cadf50a0a400b982bb3e4b2d2c907f95a531236b62fa4cdf0d6029a67',
        'assets/libs/littlefoot/LICENSE': '27dd58a18d0a0d12c035cb40badfb47805eb7f3053f33ce53c2186e9739ae9d2',
        'assets/libs/littlefoot/littlefoot.js': '7ee71129ae558229f1d4eb35ee16f60e0e58e401bee900a50b27727cd63f26f8',
        'assets/libs/mathjax/4.1.3/LICENSE': 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30',
        'assets/libs/mathjax/4.1.3/input/tex/extensions/autoload.js': '8da941fdea660944fc6a4434823dce9cf369b88cb6c0ab50b00700b7a92dbf0c',
        'assets/libs/mathjax/4.1.3/input/tex/extensions/cancel.js': '9ff91ff84d9776606cdb66da62ffe9bb39cfdfabcf070f214d35e553689ffece',
        'assets/libs/mathjax/4.1.3/input/tex/extensions/color.js': 'f569ebbf53726afeb3f7a7803500ac2088aada400a2000394879d0b503311b17',
        'assets/libs/mathjax/4.1.3/input/tex/extensions/enclose.js': '5301d91e2e7d6f86a29c13c1b9726b7476b9de9b1745011886c914372fab4cf3',
        'assets/libs/mathjax/4.1.3/input/tex/extensions/mhchem.js': '7447710d9804aea68b4491e8fde752d69a905e0d27a8a39705c535f64cfa7fdc',
        'assets/libs/mathjax/4.1.3/input/tex/extensions/require.js': '6ccbfb7f9a6e627fabdc39ce034f99355172b9778891cce33243844501098130',
        'assets/libs/mathjax/4.1.3/sre/mathmaps/base.json': '72558700556d997a95e9281044e330eba9a472dda43642a9b5cc0483294d875f',
        'assets/libs/mathjax/4.1.3/sre/mathmaps/en.json': '5e60d1843351966a159cc409eb73e9abc7c7e375a3311c40d35843d70fee79fb',
        'assets/libs/mathjax/4.1.3/sre/mathmaps/nemeth.json': '16f30ad5bc7db02bbcce4623b108626f1a73d65660799891f23efd76dcaa333e',
        'assets/libs/mathjax/4.1.3/sre/require.d.mts': '946701066b1225bbb539cb3b7b9dfadfea309b7dfb728dc28e59599af97c102d',
        'assets/libs/mathjax/4.1.3/sre/require.mjs': '399cff836df7d7cfa42bc5459d69e334074b50a9473b42bd8beac21108ac0536',
        'assets/libs/mathjax/4.1.3/sre/speech-worker.js': '80bd663f2d48505291dcc256728a4fe3be1be4b73d3675b905bd51b1c431745b',
        'assets/libs/mathjax/4.1.3/tex-svg.js': '23c036deccc0f2374834a47e4032e452419f3ac027bf17e17c104e2746b19f4c',
        'assets/libs/pangu/LICENSE': 'eeccd5776471b1e421a3b647c616722db5439e38a62f07bf378d8de476979c9d',
        'assets/libs/pangu/pangu.js': 'e3cecd88763276e3e758ea9b66e2546d358a915c47be36dab352562ba3bc1bd3',
        'assets/libs/tocbot/LICENSE': 'f4415c75dae0e1fcc887baa3a3d5cc0f9db463305be7cc3a0bbe382f155faa4b',
        'assets/libs/tocbot/tocbot.min.js': 'd40d0ac62013e692bc18358b968815c91339211cf6df1da77dee2bd3db34b7fa'
    };

    for (const [relativePath, expectedHash] of Object.entries(expectedHashes)) {
        assert.equal(sha256(relativePath), expectedHash, relativePath);
    }
});

test('vendored licenses are included in the distributable build', () => {
    const gulpfile = read('gulpfile.js');

    for (const licensePath of [
        './assets/libs/header/ResizeSensor/LICENSE',
        './assets/libs/littlefoot/LICENSE',
        './assets/libs/mathjax/**/*',
        './assets/libs/pangu/LICENSE',
        './assets/libs/tocbot/LICENSE'
    ]) {
        assert.ok(gulpfile.includes(`'${licensePath}'`), licensePath);
    }
});

test('MathJax keeps the intentional minimal runtime file set', () => {
    assert.deepEqual(listFiles(path.join(root, 'assets/libs/mathjax/4.1.3')), [
        'LICENSE',
        'input/tex/extensions/autoload.js',
        'input/tex/extensions/cancel.js',
        'input/tex/extensions/color.js',
        'input/tex/extensions/enclose.js',
        'input/tex/extensions/mhchem.js',
        'input/tex/extensions/require.js',
        'sre/mathmaps/base.json',
        'sre/mathmaps/en.json',
        'sre/mathmaps/nemeth.json',
        'sre/require.d.mts',
        'sre/require.mjs',
        'sre/speech-worker.js',
        'tex-svg.js'
    ]);
});

test('runtime references and browser bundles expose the expected APIs', () => {
    const head = read('includes/head.php');
    const footer = read('includes/footer.php');
    assert.match(head, /assets\/libs\/mathjax\/4\.1\.3\/tex-svg\.js/);
    assert.match(head, /'mathJaxUrl'\s*=>\s*\$mathJaxUrl/);
    assert.doesNotMatch(footer, /assets\/libs\/mathjax\/4\.1\.3\/tex-svg\.js/);
    assert.doesNotMatch(head + footer, /assets\/libs\/mathjax\/4\.1\.1\//);

    const mathJax = read('assets/libs/mathjax/4.1.3/tex-svg.js');
    assert.match(mathJax, /const nC="4\.1\.3"/);
    new vm.Script(mathJax, { filename: 'tex-svg.js' });

    const littlefootDocument = { addEventListener() {} };
    const littlefootWindow = { addEventListener() {} };
    const littlefootContext = {
        AbortController,
        document: littlefootDocument,
        window: littlefootWindow
    };
    vm.runInNewContext(read('assets/libs/littlefoot/littlefoot.js'), littlefootContext);
    assert.equal(typeof littlefootContext.littlefoot.littlefoot, 'function');

    const panguContext = {};
    vm.runInNewContext(read('assets/libs/pangu/pangu.js'), panguContext);
    assert.equal(panguContext.pangu.version, '9.1.0');
    assert.equal(typeof panguContext.pangu.spacingNode, 'function');
    assert.equal(typeof panguContext.pangu.spacingText, 'function');
    assert.equal(typeof panguContext.pangu.BrowserPangu, 'function');

    const tocbotDocument = { body: {}, querySelector() {} };
    const tocbotWindow = {
        addEventListener() {},
        document: tocbotDocument
    };
    vm.runInNewContext(read('assets/libs/tocbot/tocbot.min.js'), {
        document: tocbotDocument,
        HTMLElement: class HTMLElement {},
        window: tocbotWindow
    });
    assert.equal(typeof tocbotWindow.tocbot.init, 'function');
    assert.equal(typeof tocbotWindow.tocbot.destroy, 'function');
    assert.equal(typeof tocbotWindow.tocbot.refresh, 'function');
});

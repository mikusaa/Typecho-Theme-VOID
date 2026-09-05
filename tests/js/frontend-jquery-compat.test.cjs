const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const jQueryReference = /\$\s*\(|\$\s*\.|\bjQuery\b/;

function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function loadExSearchAdapter(overrides = {}) {
    const footer = read('includes/footer.php');
    const start = footer.indexOf('function ExSearchCall');
    const end = footer.indexOf('<?php endif; ?>', start);
    const context = {
        document: overrides.document,
        window: overrides.window
    };

    assert.notEqual(start, -1, 'ExSearch adapter should exist');
    assert.ok(end > start, 'ExSearch adapter should end before the PHP conditional');
    vm.runInNewContext(footer.slice(start, end), context);
    return context.ExSearchCall;
}

function createSearchItem(url) {
    return {
        nodeType: 1,
        getAttribute(name) {
            return name === 'data-url' ? url : null;
        }
    };
}

test('theme-owned frontend sources and templates contain no jQuery references', () => {
    const frontendSources = [
        'assets/VOID.js',
        'assets/VOIDCacheRule.js',
        'assets/header.js',
        'assets/libs/emotes/emote-picker.js',
        'assets/libs/hyphen/hyphen.js',
        'assets/libs/pjax/void-pjax.js'
    ];
    const frontendTemplates = [
        'Archives.php',
        'Gallery.php',
        'archive.php',
        'index.php',
        'page.php',
        'post.php',
        ...fs.readdirSync(path.join(root, 'includes'))
            .filter((name) => name.endsWith('.php'))
            .map((name) => `includes/${name}`)
    ];

    for (const relativePath of frontendSources.concat(frontendTemplates)) {
        assert.doesNotMatch(read(relativePath), jQueryReference, relativePath);
    }
});

test('3.x retains frontend jQuery while editor.js uses the Typecho admin boundary', () => {
    const editor = read('assets/editor.js');
    const functions = read('functions.php');
    const gulpfile = read('gulpfile.js');
    const templates = fs.readdirSync(path.join(root, 'includes'))
        .filter((name) => name.endsWith('.php'))
        .map((name) => read(`includes/${name}`))
        .join('\n');
    const utils = read('libs/Utils.php');

    assert.equal(
        (gulpfile.match(/assets\/libs\/header\/jquery\/jquery\.min\.js/g) || []).length,
        2,
        'pack and dev header bundles should both retain jQuery during 3.x'
    );
    assert.equal(fs.existsSync(path.join(root, 'assets/libs/header/jquery/jquery.min.js')), true);
    assert.match(read('assets/libs/header/jquery/jquery.min.js'), /\.jQuery=.*\.\$=/);

    assert.match(functions, /factory\('admin\/write-post\.php'\)->bottom = array\('Utils', 'addButton'\)/);
    assert.match(functions, /factory\('admin\/write-page\.php'\)->bottom = array\('Utils', 'addButton'\)/);
    assert.match(utils, /public static function addButton\(\)[\s\S]*indexTheme\('\/assets\/editor\.js'\)/);
    assert.match(editor, /\}\)\(window\.jQuery\);/);
    assert.match(editor, /\$\(function \(\) \{/);
    assert.doesNotMatch(templates, /assets\/editor\.js/);
});

test('ExSearch prefers DOM elements and uses native PJAX navigation', () => {
    const closeButton = { clicks: 0, click() { this.clicks += 1; } };
    const visits = [];
    const directItem = createSearchItem('/direct');
    const contextItem = createSearchItem('/context');
    const window = {
        VoidPjax: {
            visit(options) {
                visits.push(options);
            }
        }
    };
    const ExSearchCall = loadExSearchAdapter({
        document: { querySelector() { return closeButton; } },
        window
    });

    ExSearchCall(directItem, { element: contextItem, url: '/fallback' });
    ExSearchCall({ 0: directItem, length: 1 }, { element: contextItem, url: '/fallback' });

    assert.equal(closeButton.clicks, 2);
    assert.deepEqual(visits.map((visit) => visit.url), ['/direct', '/context']);
    assert.deepEqual(JSON.parse(JSON.stringify(visits[0])), {
        container: '#pjax-container',
        fragment: '#pjax-container',
        timeout: 8000,
        url: '/direct'
    });
});

test('ExSearch accepts a legacy jQuery-shaped object without calling jQuery', () => {
    const opens = [];
    const item = createSearchItem('/legacy');
    const ExSearchCall = loadExSearchAdapter({
        document: { querySelector() { return null; } },
        window: {
            open(url, target) {
                opens.push({ target, url });
            }
        }
    });

    ExSearchCall({ 0: item, length: 1, attr() { throw new Error('attr should not be needed'); } });
    ExSearchCall(null);

    assert.deepEqual(opens, [{ target: '_self', url: '/legacy' }]);
});

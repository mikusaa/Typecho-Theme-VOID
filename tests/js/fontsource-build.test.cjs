const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { pathToFileURL } = require('node:url');

const repositoryRoot = path.resolve(__dirname, '../..');
const checkerPath = path.join(repositoryRoot, 'scripts/check-fontsource-build.mjs');

async function loadChecker() {
    return import(pathToFileURL(checkerPath).href);
}

async function createFontsourceOutput(t, checker) {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'void-fontsource-test-'));
    const outputRoot = path.join(temporaryRoot, 'fontsource');
    const runtimeTemplatePath = path.join(temporaryRoot, 'head.php');

    t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));

    for (const family of checker.FONTSOURCE_FAMILIES) {
        const packageRoot = path.join(repositoryRoot, 'node_modules', family.packageName);
        const outputDirectory = path.join(
            outputRoot,
            family.directory,
            checker.FONTSOURCE_ASSET_VERSION
        );
        const selectedFiles = await checker.selectFontsourceSourceFiles(
            packageRoot,
            family.sourceFiles
        );

        for (const relativePath of selectedFiles) {
            const sourcePath = path.join(packageRoot, ...relativePath.split('/'));
            const outputPath = path.join(outputDirectory, ...relativePath.split('/'));

            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            if (path.extname(relativePath) === '.css') {
                const source = await fs.readFile(sourcePath, 'utf8');
                await fs.writeFile(outputPath, checker.toWoff2OnlyCss(source));
            } else {
                await fs.copyFile(sourcePath, outputPath);
            }
        }
    }

    const references = checker.FONTSOURCE_FAMILIES.flatMap((family) =>
        family.runtimeFiles.map((file) =>
            `/assets/fonts/fontsource/${family.directory}/${checker.FONTSOURCE_ASSET_VERSION}/${file}`
        )
    );
    await fs.writeFile(
        runtimeTemplatePath,
        references.map((reference) => `<?php Utils::indexTheme('${reference}'); ?>`).join('\n')
    );

    return { outputRoot, runtimeTemplatePath };
}

test('Fontsource CSS normalization removes only the WOFF fallback', async () => {
    const checker = await loadChecker();
    const source = [
        '@font-face {',
        "  src: url(./files/font.woff2) format('woff2'), url(./files/font.woff) format('woff');",
        '}'
    ].join('\n');
    const normalized = checker.toWoff2OnlyCss(source);

    assert.match(normalized, /font\.woff2/);
    assert.doesNotMatch(normalized, /font\.woff\)/);
});

test('Fontsource build audit accepts the selected tree and rejects invalid output', async (t) => {
    const checker = await loadChecker();
    const fixture = await createFontsourceOutput(t, checker);
    const checkOptions = { repositoryRoot, ...fixture };
    const result = await checker.checkFontsourceBuild(checkOptions);

    assert.ok(result.totalFiles > 0);
    assert.ok(result.totalBytes < checker.FONTSOURCE_MAX_BYTES);
    await assert.rejects(
        checker.checkFontsourceBuild({ ...checkOptions, maximumBytes: 1 }),
        /limit is less than 1 bytes/
    );

    const validTemplate = await fs.readFile(fixture.runtimeTemplatePath, 'utf8');
    await fs.writeFile(
        fixture.runtimeTemplatePath,
        validTemplate.replace(checker.FONTSOURCE_ASSET_VERSION, '5.3.0-stale')
    );
    await assert.rejects(
        checker.checkFontsourceBuild(checkOptions),
        /Fontsource runtime references mismatch/
    );
    await fs.writeFile(fixture.runtimeTemplatePath, validTemplate);

    const localReference = '/assets/fonts/fontsource/open-sans/' +
        `${checker.FONTSOURCE_ASSET_VERSION}/wght.css`;
    await fs.writeFile(
        fixture.runtimeTemplatePath,
        validTemplate.replace(localReference, `https://third-party.example${localReference}`)
    );
    await assert.rejects(
        checker.checkFontsourceBuild(checkOptions),
        /Fontsource runtime (?:references|path literals) mismatch/
    );
    await fs.writeFile(
        fixture.runtimeTemplatePath,
        validTemplate.replace(
            `<?php Utils::indexTheme('${localReference}'); ?>`,
            `<!-- <?php Utils::indexTheme('${localReference}'); ?> -->`
        )
    );
    await assert.rejects(
        checker.checkFontsourceBuild(checkOptions),
        /Fontsource runtime references mismatch/
    );
    await fs.writeFile(fixture.runtimeTemplatePath, validTemplate);

    const openSansRoot = path.join(
        fixture.outputRoot,
        'open-sans',
        checker.FONTSOURCE_ASSET_VERSION
    );
    const openSansFamilyRoot = path.dirname(openSansRoot);
    const cssPath = path.join(openSansRoot, 'wght.css');
    const validCss = await fs.readFile(cssPath, 'utf8');

    const unexpectedPath = path.join(openSansFamilyRoot, 'extra.bin');
    await fs.writeFile(unexpectedPath, 'unexpected');
    await assert.rejects(
        checker.checkFontsourceBuild(checkOptions),
        /Unexpected entry in open-sans output: extra\.bin/
    );
    await fs.unlink(unexpectedPath);

    const fontPath = path.join(openSansRoot, 'files/open-sans-latin-wght-normal.woff2');
    const validFont = await fs.readFile(fontPath);
    const changedFont = Buffer.from(validFont);
    changedFont[0] ^= 0xff;
    await fs.writeFile(fontPath, changedFont);
    await assert.rejects(
        checker.checkFontsourceBuild(checkOptions),
        /open-sans\/files\/open-sans-latin-wght-normal\.woff2 differs from the package source/
    );
    await fs.writeFile(fontPath, validFont);

    await fs.writeFile(cssPath, `${validCss}\n@import url(https://example.test/font.css);\n`);
    await assert.rejects(
        checker.checkFontsourceBuild(checkOptions),
        /contains a remote stylesheet reference/
    );

    await fs.writeFile(cssPath, validCss);
    await fs.unlink(fontPath);
    await assert.rejects(
        checker.checkFontsourceBuild(checkOptions),
        /open-sans output mismatch/
    );
});

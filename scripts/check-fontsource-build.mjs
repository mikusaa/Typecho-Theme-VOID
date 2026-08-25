import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const FONTSOURCE_PACKAGE_VERSION = '5.3.0';
export const FONTSOURCE_ASSET_VERSION = '5.3.0-r1';
export const FONTSOURCE_MAX_BYTES = 7 * 1024 * 1024;

export const FONTSOURCE_FAMILIES = Object.freeze([
    Object.freeze({
        directory: 'open-sans',
        packageName: '@fontsource-variable/open-sans',
        metadataId: 'open-sans',
        licenseType: 'OFL-1.1',
        cssFiles: Object.freeze(['wght.css']),
        runtimeFiles: Object.freeze([
            'wght.css',
            'files/open-sans-latin-wght-normal.woff2'
        ]),
        sourceFiles: Object.freeze([
            'LICENSE',
            'metadata.json',
            'wght.css',
            'files/open-sans-*-wght-normal.woff2'
        ])
    }),
    Object.freeze({
        directory: 'fira-code',
        packageName: '@fontsource/fira-code',
        metadataId: 'fira-code',
        licenseType: 'OFL-1.1',
        cssFiles: Object.freeze(['400.css']),
        runtimeFiles: Object.freeze(['400.css']),
        sourceFiles: Object.freeze([
            'LICENSE',
            'metadata.json',
            '400.css',
            'files/fira-code-*-400-normal.woff2'
        ])
    }),
    Object.freeze({
        directory: 'noto-serif-sc',
        packageName: '@fontsource-variable/noto-serif-sc',
        metadataId: 'noto-serif-sc',
        licenseType: 'OFL-1.1',
        cssFiles: Object.freeze(['wght.css']),
        runtimeFiles: Object.freeze(['wght.css']),
        sourceFiles: Object.freeze([
            'LICENSE',
            'metadata.json',
            'wght.css',
            'files/noto-serif-sc-*-wght-normal.woff2'
        ])
    })
]);

const WOFF_FALLBACK_PATTERN = /,\s*url\(\s*(['"]?)([^)'"\s]+\.woff(?:[?#][^)'"\s]*)?)\1\s*\)\s*format\(\s*(['"])woff\3\s*\)/g;
const CSS_URL_PATTERN = /url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/g;

export function toWoff2OnlyCss(source) {
    return source.replace(WOFF_FALLBACK_PATTERN, '');
}

async function readJson(filePath) {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function listFiles(directory, prefix = '') {
    const files = [];
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
        const relativePath = path.posix.join(prefix, entry.name);
        const absolutePath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...await listFiles(absolutePath, relativePath));
        } else if (entry.isFile()) {
            files.push(relativePath);
        } else {
            throw new Error(`Unsupported font asset entry: ${absolutePath}`);
        }
    }

    return files.sort();
}

function globPatternToRegExp(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${escaped.replaceAll('*', '[^/]*')}$`);
}

export async function selectFontsourceSourceFiles(packageRoot, patterns) {
    const packageFiles = await listFiles(packageRoot);
    const selectedFiles = new Set();

    for (const pattern of patterns) {
        const matches = pattern.includes('*')
            ? packageFiles.filter((file) => globPatternToRegExp(pattern).test(file))
            : packageFiles.filter((file) => file === pattern);

        if (matches.length === 0) {
            throw new Error(`Fontsource source pattern matched no files: ${pattern}`);
        }
        for (const match of matches) {
            selectedFiles.add(match);
        }
    }

    return [...selectedFiles].sort();
}

function assertEqualLists(actual, expected, label) {
    if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
        throw new Error(
            `${label} mismatch\nExpected: ${expected.join(', ')}\nActual: ${actual.join(', ')}`
        );
    }
}

function extractCssUrls(source) {
    const urls = [];

    for (const match of source.matchAll(CSS_URL_PATTERN)) {
        urls.push(match[2]);
    }
    return urls;
}

async function checkRuntimeReferences(outputRoot, runtimeTemplatePath) {
    const template = await fs.readFile(runtimeTemplatePath, 'utf8');
    const uncommentedTemplate = template
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<\?php([\s\S]*?)\?>/gi, (block, php) => `<?php${php
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/[^\r\n]*|#[^\r\n]*/g, '')}?>`);
    const runtimeCallPattern = /Utils::indexTheme\(\s*(['"])\/assets\/fonts\/fontsource\/([^'"\s)<>?]+)\1\s*\)/g;
    const fontsourceLiteralPattern = /(['"])([^'"\r\n]*\/assets\/fonts\/fontsource\/[^'"\r\n]*)\1/g;
    const actualReferences = [...uncommentedTemplate.matchAll(runtimeCallPattern)]
        .map((match) => match[2])
        .sort();
    const actualLiterals = [...uncommentedTemplate.matchAll(fontsourceLiteralPattern)]
        .map((match) => match[2])
        .sort();
    const expectedReferences = FONTSOURCE_FAMILIES.flatMap((family) =>
        family.runtimeFiles.map((file) =>
            `${family.directory}/${FONTSOURCE_ASSET_VERSION}/${file}`
        )
    ).sort();
    const expectedLiterals = expectedReferences.map((reference) =>
        `/assets/fonts/fontsource/${reference}`
    ).sort();

    assertEqualLists(actualReferences, expectedReferences, 'Fontsource runtime references');
    assertEqualLists(actualLiterals, expectedLiterals, 'Fontsource runtime path literals');
    for (const reference of actualReferences) {
        await fs.access(path.join(outputRoot, ...reference.split('/')));
    }
}

function relativeFontPath(cssFile, url) {
    if (!url.startsWith('./') || /^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(url)) {
        throw new Error(`${cssFile} contains a non-relative URL: ${url}`);
    }

    const pathname = url.split(/[?#]/, 1)[0];
    if (path.posix.extname(pathname) !== '.woff2') {
        throw new Error(`${cssFile} contains a non-WOFF2 URL: ${url}`);
    }

    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(cssFile), pathname));
    if (resolved === '..' || resolved.startsWith('../')) {
        throw new Error(`${cssFile} contains an escaping URL: ${url}`);
    }
    return resolved;
}

async function assertDependencyVersions(repositoryRoot) {
    const packageJson = await readJson(path.join(repositoryRoot, 'package.json'));
    const packageLock = await readJson(path.join(repositoryRoot, 'package-lock.json'));
    const lockRoot = packageLock.packages?.['']?.devDependencies || {};

    for (const family of FONTSOURCE_FAMILIES) {
        const declaredVersion = packageJson.devDependencies?.[family.packageName];
        const lockedDeclaration = lockRoot[family.packageName];
        const lockEntry = packageLock.packages?.[`node_modules/${family.packageName}`];
        const installedPackage = await readJson(path.join(
            repositoryRoot,
            'node_modules',
            family.packageName,
            'package.json'
        ));

        if (declaredVersion !== FONTSOURCE_PACKAGE_VERSION ||
            lockedDeclaration !== FONTSOURCE_PACKAGE_VERSION ||
            lockEntry?.version !== FONTSOURCE_PACKAGE_VERSION ||
            installedPackage.version !== FONTSOURCE_PACKAGE_VERSION) {
            throw new Error(`${family.packageName} must be pinned to ${FONTSOURCE_PACKAGE_VERSION}`);
        }
    }
}

async function checkFamily(repositoryRoot, outputRoot, family) {
    const packageRoot = path.join(repositoryRoot, 'node_modules', family.packageName);
    const familyRoot = path.join(outputRoot, family.directory, FONTSOURCE_ASSET_VERSION);
    const expectedFiles = await selectFontsourceSourceFiles(packageRoot, family.sourceFiles);
    const actualFiles = await listFiles(familyRoot);

    assertEqualLists(actualFiles, expectedFiles, `${family.directory} output`);

    const metadata = await readJson(path.join(familyRoot, 'metadata.json'));
    if (metadata.id !== family.metadataId) {
        throw new Error(`${family.directory} metadata id must be ${family.metadataId}`);
    }
    if (metadata.license?.type !== family.licenseType) {
        throw new Error(`${family.directory} license must be ${family.licenseType}`);
    }

    const license = await fs.readFile(path.join(familyRoot, 'LICENSE'), 'utf8');
    if (license.trim() === '') {
        throw new Error(`${family.directory} LICENSE is empty`);
    }

    for (const file of actualFiles.filter((file) => path.posix.extname(file) !== '.css')) {
        const source = await fs.readFile(path.join(packageRoot, ...file.split('/')));
        const output = await fs.readFile(path.join(familyRoot, ...file.split('/')));

        if (!source.equals(output)) {
            throw new Error(`${family.directory}/${file} differs from the package source`);
        }
    }

    const referencedFonts = new Set();
    for (const cssFile of family.cssFiles) {
        const sourceCss = await fs.readFile(path.join(packageRoot, cssFile), 'utf8');
        const outputCss = await fs.readFile(path.join(familyRoot, cssFile), 'utf8');
        const expectedCss = toWoff2OnlyCss(sourceCss);

        if (/https?:|\/\//i.test(outputCss) || /@import\b/i.test(outputCss)) {
            throw new Error(`${family.directory}/${cssFile} contains a remote stylesheet reference`);
        }
        if (!/font-style:\s*normal\s*;/i.test(outputCss)) {
            throw new Error(`${family.directory}/${cssFile} does not declare normal font style`);
        }

        const urls = extractCssUrls(outputCss);
        if (urls.length === 0) {
            throw new Error(`${family.directory}/${cssFile} contains no font URLs`);
        }
        for (const url of urls) {
            const fontPath = relativeFontPath(cssFile, url);
            await fs.access(path.join(familyRoot, ...fontPath.split('/')));
            referencedFonts.add(fontPath);
        }
        if (outputCss !== expectedCss) {
            throw new Error(`${family.directory}/${cssFile} differs from the normalized package CSS`);
        }
    }

    const copiedFonts = actualFiles.filter((file) => file.startsWith('files/'));
    assertEqualLists(
        [...referencedFonts].sort(),
        copiedFonts,
        `${family.directory} referenced fonts`
    );

    let bytes = 0;
    for (const file of actualFiles) {
        bytes += (await fs.stat(path.join(familyRoot, ...file.split('/')))).size;
    }
    return { bytes, files: actualFiles.length };
}

export async function checkFontsourceBuild(options = {}) {
    const repositoryRoot = options.repositoryRoot || path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..'
    );
    const outputRoot = options.outputRoot || path.join(
        repositoryRoot,
        'build/assets/fonts/fontsource'
    );
    const runtimeTemplatePath = options.runtimeTemplatePath || path.join(
        repositoryRoot,
        'build/includes/head.php'
    );
    const maximumBytes = options.maximumBytes || FONTSOURCE_MAX_BYTES;

    await assertDependencyVersions(repositoryRoot);

    const outputEntries = (await fs.readdir(outputRoot, { withFileTypes: true }))
        .map((entry) => {
            if (!entry.isDirectory()) {
                throw new Error(`Unexpected file in Fontsource output root: ${entry.name}`);
            }
            return entry.name;
        })
        .sort();
    const expectedDirectories = FONTSOURCE_FAMILIES.map((family) => family.directory).sort();
    assertEqualLists(outputEntries, expectedDirectories, 'Fontsource family directories');

    let totalBytes = 0;
    let totalFiles = 0;
    for (const family of FONTSOURCE_FAMILIES) {
        const familyDirectory = path.join(outputRoot, family.directory);
        const versionEntries = await fs.readdir(familyDirectory, { withFileTypes: true });
        const unexpectedEntry = versionEntries.find((entry) => !entry.isDirectory());
        if (unexpectedEntry) {
            throw new Error(
                `Unexpected entry in ${family.directory} output: ${unexpectedEntry.name}`
            );
        }
        const versions = versionEntries
            .map((entry) => entry.name)
            .sort();
        assertEqualLists(versions, [FONTSOURCE_ASSET_VERSION], `${family.directory} versions`);

        const result = await checkFamily(repositoryRoot, outputRoot, family);
        totalBytes += result.bytes;
        totalFiles += result.files;
    }

    await checkRuntimeReferences(outputRoot, runtimeTemplatePath);

    if (totalBytes >= maximumBytes) {
        throw new Error(
            `Fontsource output is ${totalBytes} bytes; limit is less than ${maximumBytes} bytes`
        );
    }

    return { totalBytes, totalFiles };
}

const isMain = process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    try {
        const result = await checkFontsourceBuild();
        console.log(
            `Fontsource build verified: ${result.totalFiles} files, ${result.totalBytes} bytes`
        );
    } catch (error) {
        console.error(`Fontsource build check failed: ${error.message}`);
        process.exitCode = 1;
    }
}

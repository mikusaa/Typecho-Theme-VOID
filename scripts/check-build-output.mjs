import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { checkFontsourceBuild } from './check-fontsource-build.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootSources = Object.freeze([
    'LICENSE',
    'README.md',
    'screenshot.webp',
    'advanceSetting.md',
    'advanceSetting.sample.json',
    'change-log.md'
]);
const staticTrees = Object.freeze([
    'assets/libs/mathjax',
    'assets/libs/emotes/quyin',
    'assets/libs/emotes/bilibili',
    'assets/libs/emotes/mihoyo',
    'assets/libs/emotes/aru',
    'assets/libs/emotes/packs',
    'assets/libs/emotes/bangumi'
]);
const staticFiles = Object.freeze([
    'assets/VOIDCacheRule.js',
    'assets/libs/littlefoot/LICENSE',
    'assets/libs/octicons/LICENSE',
    'assets/libs/pangu/LICENSE',
    'assets/libs/photoswipe/LICENSE',
    'assets/libs/tocbot/LICENSE',
    'assets/libs/emotes/packs.json'
]);
const developmentAssets = Object.freeze([
    'assets/VOID.css',
    'assets/VOID.js',
    'assets/bundle.css',
    'assets/bundle.js',
    'assets/bundle-header.js',
    'assets/check_update.js',
    'assets/editor-admin.css',
    'assets/editor.js',
    'assets/header.js',
    'assets/libs/emotes/emote-picker.css',
    'assets/libs/emotes/emote-picker.js'
]);
const productionAssets = Object.freeze([
    ['assets', /^VOID-[a-f0-9]+\.css$/],
    ['assets', /^VOID-[a-f0-9]+\.js$/],
    ['assets', /^bundle-[a-f0-9]+\.css$/],
    ['assets', /^bundle-[a-f0-9]+\.js$/],
    ['assets', /^bundle-header-[a-f0-9]+\.js$/],
    ['assets', /^check_update-[a-f0-9]+\.js$/],
    ['assets', /^editor-admin-[a-f0-9]+\.css$/],
    ['assets', /^editor-[a-f0-9]+\.js$/],
    ['assets', /^header-[a-f0-9]+\.js$/],
    ['assets/libs/emotes', /^emote-picker-[a-f0-9]+\.css$/],
    ['assets/libs/emotes', /^emote-picker-[a-f0-9]+\.js$/]
]);

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
            throw new Error(`Unsupported output entry: ${absolutePath}`);
        }
    }

    return files.sort();
}

async function assertFileExists(filePath) {
    const stats = await fs.stat(filePath).catch((error) => {
        if (error && error.code === 'ENOENT') {
            throw new Error(`Missing build output: ${filePath}`);
        }
        throw error;
    });
    if (!stats.isFile()) {
        throw new Error(`Expected a build file: ${filePath}`);
    }
}

async function assertFileEqual(sourcePath, outputPath) {
    const [source, output] = await Promise.all([
        fs.readFile(sourcePath),
        fs.readFile(outputPath).catch((error) => {
            if (error && error.code === 'ENOENT') {
                throw new Error(`Missing copied runtime file: ${outputPath}`);
            }
            throw error;
        })
    ]);
    if (!source.equals(output)) {
        throw new Error(`Copied runtime file differs from source: ${outputPath}`);
    }
}

async function assertTreeEqual(relativePath, outputRoot) {
    const sourceRoot = path.join(repositoryRoot, ...relativePath.split('/'));
    const destinationRoot = path.join(outputRoot, ...relativePath.split('/'));
    const [sourceFiles, outputFiles] = await Promise.all([
        listFiles(sourceRoot),
        listFiles(destinationRoot)
    ]);

    if (JSON.stringify(sourceFiles) !== JSON.stringify(outputFiles)) {
        throw new Error(`${relativePath} output file list differs from source`);
    }
    for (const file of sourceFiles) {
        await assertFileEqual(path.join(sourceRoot, file), path.join(destinationRoot, file));
    }
}

async function discoverRuntimePhp() {
    const rootEntries = await fs.readdir(repositoryRoot, { withFileTypes: true });
    const rootPhp = rootEntries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.php'))
        .map((entry) => entry.name);
    const nestedPhp = [];

    for (const directory of ['includes', 'libs']) {
        const files = await listFiles(path.join(repositoryRoot, directory));
        nestedPhp.push(...files
            .filter((file) => file.endsWith('.php'))
            .map((file) => path.posix.join(directory, file)));
    }
    return [...rootPhp, ...nestedPhp].sort();
}

async function requireSingleAsset(outputRoot, directory, pattern) {
    const directoryPath = path.join(outputRoot, ...directory.split('/'));
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    const matches = entries
        .filter((entry) => entry.isFile() && pattern.test(entry.name))
        .map((entry) => path.posix.join(directory, entry.name));
    if (matches.length !== 1) {
        throw new Error(`${directory}/${pattern} matched ${matches.length} build files`);
    }
    return matches[0];
}

async function checkPhpAssetReferences(outputRoot, assets) {
    const phpFiles = (await discoverRuntimePhp()).map((relativePath) =>
        path.join(outputRoot, ...relativePath.split('/'))
    );
    const sources = await Promise.all(phpFiles.map((filePath) => fs.readFile(filePath, 'utf8')));
    const combined = sources.join('\n');

    for (const asset of assets) {
        if (!combined.includes(`/assets/${asset.slice('assets/'.length)}`)) {
            throw new Error(`Build PHP does not reference ${asset}`);
        }
    }
}

async function checkCopiedRuntime(outputRoot, mode) {
    const runtimePhp = await discoverRuntimePhp();
    for (const relativePath of runtimePhp) {
        const outputPath = path.join(outputRoot, ...relativePath.split('/'));
        await assertFileExists(outputPath);
        if (mode === 'development') {
            await assertFileEqual(
                path.join(repositoryRoot, ...relativePath.split('/')),
                outputPath
            );
        }
    }

    for (const relativePath of rootSources) {
        await assertFileEqual(
            path.join(repositoryRoot, ...relativePath.split('/')),
            path.join(outputRoot, ...relativePath.split('/'))
        );
    }
    for (const relativePath of staticFiles) {
        await assertFileEqual(
            path.join(repositoryRoot, ...relativePath.split('/')),
            path.join(outputRoot, ...relativePath.split('/'))
        );
    }
    for (const relativePath of staticTrees) {
        await assertTreeEqual(relativePath, outputRoot);
    }

    const iconFiles = await listFiles(path.join(repositoryRoot, 'assets/fonts'));
    for (const relativePath of iconFiles) {
        await assertFileEqual(
            path.join(repositoryRoot, 'assets/fonts', relativePath),
            path.join(outputRoot, 'assets/fonts', relativePath)
        );
    }
}

async function checkForbiddenOutput(outputRoot) {
    const files = await listFiles(outputRoot);
    const forbidden = files.find((file) =>
        file.startsWith('tests/') ||
        file.startsWith('node_modules/') ||
        file.startsWith('dev-build/') ||
        file.startsWith('build/') ||
        file.startsWith('temp/') ||
        file.startsWith('assets/js/') ||
        file.endsWith('.scss') ||
        file.endsWith('.css.map')
    );
    if (forbidden) {
        throw new Error(`Unexpected source or intermediate file in build: ${forbidden}`);
    }
    return files;
}

export async function checkBuildOutput(options = {}) {
    const mode = options.mode || 'production';
    const outputRoot = options.outputRoot || path.join(
        repositoryRoot,
        mode === 'production' ? 'build' : 'dev-build'
    );
    if (!['production', 'development'].includes(mode)) {
        throw new Error(`Unknown build mode: ${mode}`);
    }

    await checkCopiedRuntime(outputRoot, mode);
    const referencedAssets = [];
    if (mode === 'development') {
        for (const relativePath of developmentAssets) {
            await assertFileExists(path.join(outputRoot, ...relativePath.split('/')));
            referencedAssets.push(relativePath);
        }
    } else {
        for (const [directory, pattern] of productionAssets) {
            referencedAssets.push(await requireSingleAsset(outputRoot, directory, pattern));
        }
        for (const relativePath of developmentAssets) {
            const logicalPath = path.join(outputRoot, ...relativePath.split('/'));
            const exists = await fs.stat(logicalPath).then(() => true, () => false);
            if (exists) {
                throw new Error(`Production build contains an unhashed asset: ${relativePath}`);
            }
        }
    }

    await checkPhpAssetReferences(outputRoot, referencedAssets);
    await checkFontsourceBuild({
        repositoryRoot,
        outputRoot: path.join(outputRoot, 'assets/fonts/fontsource'),
        runtimeTemplatePath: path.join(outputRoot, 'includes/head.php')
    });

    const files = await checkForbiddenOutput(outputRoot);
    let bytes = 0;
    for (const file of files) {
        bytes += (await fs.stat(path.join(outputRoot, ...file.split('/')))).size;
    }
    return { bytes, files: files.length, mode, outputRoot };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    try {
        const mode = process.argv[3] || 'production';
        const outputRoot = process.argv[2]
            ? path.resolve(repositoryRoot, process.argv[2])
            : undefined;
        const result = await checkBuildOutput({ mode, outputRoot });
        console.log(
            `${result.mode} build verified: ${result.files} files, ${result.bytes} bytes`
        );
    } catch (error) {
        console.error(`Build output check failed: ${error.message}`);
        process.exitCode = 1;
    }
}

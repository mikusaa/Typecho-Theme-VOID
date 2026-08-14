#!/usr/bin/env node

import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, basename, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EMOTES_DIR = resolve(ROOT, 'assets/libs/emotes');
const PACKS_DIR = resolve(EMOTES_DIR, 'packs');
const ANIMATED_DIR = resolve(EMOTES_DIR, 'bangumi/animated');
const POSTER_DIR = resolve(EMOTES_DIR, 'bangumi/poster');
const BANGUMI_SOURCES_FILE = resolve(ROOT, 'scripts/emotes/bangumi-sources.json');
const LEGACY_PACKS_FILE = resolve(ROOT, 'scripts/emotes/legacy-packs.json');
const PACK_INDEX_FILE = resolve(EMOTES_DIR, 'packs.json');
const BANGUMI_COUNT = 97;
const POSTER_SIZE = 96;
const SHARP_VERSION = '0.35.3';
const THEME_PUBLIC_PREFIX = '/usr/themes/VOID/';
const OLD_ASSET_PREFIX = '/usr/themes/VOID/assets/libs/owo/biaoqing/';
const SOURCE_PATTERN = /^Bangumi娘_(.+)_(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})\.gif$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const OLD_PACKS = [
    { id: 'quyin', label: '蛆音娘', count: 20, tokenPrefix: ':&(', assetDirectory: 'quyin' },
    { id: 'bilibili', label: '哔哩哔哩', count: 15, tokenPrefix: ':$(', assetDirectory: '2233' },
    { id: 'mihoyo', label: '米哈游', count: 60, tokenPrefix: ':!(', assetDirectory: 'mihoyo' },
    { id: 'aru', label: '阿鲁', count: 62, tokenPrefix: ':@(', assetDirectory: 'aru' }
];

sharp.cache(false);
sharp.concurrency(1);

function fail(message) {
    throw new Error(message);
}

function assert(condition, message) {
    if (!condition) {
        fail(message);
    }
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function padId(number) {
    return String(number).padStart(3, '0');
}

function canonicalJson(value) {
    return JSON.stringify(value, null, 2) + '\n';
}

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function normalizeText(value) {
    return (value == null ? '' : String(value)).normalize('NFC').replace(/\s+/gu, ' ').trim();
}

function normalizeBangumiLabel(value) {
    return normalizeText(String(value).replace(/_/gu, ' '));
}

function isValidTimestamp(value) {
    const parts = value.split('-').map(Number);
    if (parts.length !== 6) {
        return false;
    }
    const [year, month, day, hour, minute, second] = parts;
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day
        && date.getUTCHours() === hour
        && date.getUTCMinutes() === minute
        && date.getUTCSeconds() === second;
}

function parseSourceFilename(filename) {
    assert(typeof filename === 'string', 'Bangumi source filename must be a string');
    assert(filename === basename(filename), `Bangumi source filename must not contain a path: ${filename}`);
    assert(filename === filename.normalize('NFC'), `Bangumi source filename must use NFC: ${filename}`);
    const match = SOURCE_PATTERN.exec(filename);
    assert(match, `Unexpected Bangumi source filename: ${filename}`);
    const label = normalizeBangumiLabel(match[1]);
    const timestamp = match[2];
    assert(label !== '', `Bangumi label is empty: ${filename}`);
    assert(isValidTimestamp(timestamp), `Invalid Bangumi timestamp: ${filename}`);
    return { filename, label, timestamp };
}

function ensureUnique(items, select, description) {
    const seen = new Set();
    for (const item of items) {
        const value = select(item);
        assert(!seen.has(value), `Duplicate ${description}: ${value}`);
        seen.add(value);
    }
}

function validateBangumiSources(sources) {
    assert(sources.length === BANGUMI_COUNT, `Expected ${BANGUMI_COUNT} Bangumi GIFs, found ${sources.length}`);
    ensureUnique(sources, (item) => item.filename, 'Bangumi source filename');
    ensureUnique(sources, (item) => item.timestamp, 'Bangumi timestamp');
    ensureUnique(sources, (item) => item.label, 'Bangumi label');

    for (let index = 0; index < sources.length; index++) {
        assert(
            typeof sources[index].sha256 === 'string' && SHA256_PATTERN.test(sources[index].sha256),
            `Bangumi ${padId(index + 1)} has an invalid SHA-256 digest`
        );
    }

    for (let index = 1; index < sources.length; index++) {
        assert(
            sources[index - 1].timestamp < sources[index].timestamp,
            `Bangumi timestamps are not strictly increasing at ${padId(index + 1)}`
        );
    }

    const anchors = new Map([
        ['001', '通知 提示 Bits'],
        ['051', '爱心 1'],
        ['052', '爱心 2'],
        ['053', '爱心 3'],
        ['054', '钱'],
        ['097', 'Raid 2']
    ]);
    for (const [id, label] of anchors) {
        assert(sources[Number(id) - 1].label === label, `Bangumi ${id} must be ${label}`);
    }
}

function makeBangumiManifest(sources) {
    validateBangumiSources(sources);
    return {
        version: 1,
        id: 'bangumi',
        label: 'Bangumi 娘',
        type: 'image',
        items: sources.map((source, index) => {
            const id = padId(index + 1);
            return {
                id,
                label: source.label,
                token: `:bgm(${id})`,
                poster: `poster/${id}.webp`,
                animated: `animated/${id}.gif`,
                width: 240,
                height: 240
            };
        })
    };
}

async function readJson(file) {
    let raw;
    try {
        raw = await readFile(file, 'utf8');
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            fail(`Missing JSON file: ${file}`);
        }
        throw error;
    }
    try {
        return { raw, value: JSON.parse(raw) };
    } catch (error) {
        fail(`Invalid JSON in ${file}: ${error.message}`);
    }
}

async function writeAtomic(file, data) {
    await mkdir(dirname(file), { recursive: true });
    const temporary = `${file}.tmp-${process.pid}`;
    await writeFile(temporary, data);
    await rename(temporary, file);
}

async function writeCanonicalJson(file, value) {
    await writeAtomic(file, canonicalJson(value));
}

function validateOldToken(token, definition, index) {
    assert(typeof token === 'string' && token !== '', `${definition.id} item ${index} has no token`);
    assert(
        token.startsWith(definition.tokenPrefix) && token.endsWith(')'),
        `${definition.id} item ${index} uses an unexpected token prefix: ${token}`
    );
    const payload = token.slice(definition.tokenPrefix.length, -1);
    assert(
        payload !== '' && payload.length <= 240 && !/[()\r\n]/u.test(payload),
        `${definition.id} item ${index} has an invalid token payload: ${token}`
    );
    return token;
}

function validateOldAssetPath(src, definition, index) {
    assert(typeof src === 'string', `${definition.id} item ${index} has no asset path`);
    const expectedPrefix = `${OLD_ASSET_PREFIX}${definition.assetDirectory}/`;
    assert(src.startsWith(expectedPrefix), `${definition.id} item ${index} uses an unexpected asset path: ${src}`);
    assert(src.endsWith('.png'), `${definition.id} item ${index} must use a PNG asset: ${src}`);
    assert(!src.includes('..') && !src.includes('\\'), `${definition.id} item ${index} uses an unsafe asset path: ${src}`);
    return src;
}

function makeKaomojiManifest(source) {
    assert(source && Array.isArray(source.items), 'Legacy kaomoji source is invalid');
    assert(source.items.length === 54, `Expected 54 kaomoji, found ${source.items.length}`);
    return {
        version: 1,
        id: 'kaomoji',
        label: '颜文字',
        type: 'emoticon',
        items: source.items.map((entry, index) => {
            assert(entry && typeof entry.value === 'string' && entry.value !== '', `Kaomoji item ${index + 1} is invalid`);
            assert(
                JSON.stringify(Object.keys(entry)) === JSON.stringify(['label', 'value']),
                `Kaomoji source item ${index + 1} has an invalid schema`
            );
            const value = entry.value.normalize('NFC');
            const label = normalizeText(entry.label) || value;
            return { id: padId(index + 1), label, value };
        })
    };
}

function makeOldImageManifest(source, definition) {
    assert(source && Array.isArray(source.items), `Legacy ${definition.id} source is invalid`);
    assert(
        source.items.length === definition.count,
        `Expected ${definition.count} ${definition.label} emotes, found ${source.items.length}`
    );
    return {
        version: 1,
        id: definition.id,
        label: definition.label,
        type: 'image',
        items: source.items.map((entry, index) => {
            const itemNumber = index + 1;
            assert(entry && typeof entry.token === 'string' && entry.token !== '', `${definition.id} item ${itemNumber} has no token`);
            assert(
                JSON.stringify(Object.keys(entry)) === JSON.stringify(['label', 'token', 'src']),
                `${definition.id} source item ${itemNumber} has an invalid schema`
            );
            const label = normalizeText(entry.label);
            assert(label !== '', `${definition.id} item ${itemNumber} has no label`);
            return {
                id: padId(itemNumber),
                label,
                token: validateOldToken(entry.token.normalize('NFC'), definition, itemNumber),
                src: validateOldAssetPath(entry.src, definition, itemNumber)
            };
        })
    };
}

async function makeLegacyManifests() {
    const { raw, value: source } = await readJson(LEGACY_PACKS_FILE);
    assert(isPlainObject(source), 'Legacy pack source root must be an object');
    assert(raw === canonicalJson(source), 'Legacy pack source metadata must use canonical JSON formatting');
    assert(
        JSON.stringify(Object.keys(source)) === JSON.stringify(['version', 'packs']),
        'Legacy pack source root has an invalid schema'
    );
    assert(source.version === 1, 'Legacy pack source version must be 1');
    assert(isPlainObject(source.packs), 'Legacy pack source has no packs object');
    assert(
        JSON.stringify(Object.keys(source.packs)) === JSON.stringify(['kaomoji', 'quyin', 'bilibili', 'mihoyo', 'aru']),
        'Legacy pack source must contain only the retained packs in canonical order'
    );
    for (const [packId, pack] of Object.entries(source.packs)) {
        assert(isPlainObject(pack), `Legacy ${packId} source must be an object`);
        assert(
            JSON.stringify(Object.keys(pack)) === JSON.stringify(['items']),
            `Legacy ${packId} source has an invalid schema`
        );
    }
    assert(!raw.includes('"Emoji"'), 'Legacy pack source must not contain Emoji');
    assert(!raw.includes('泡泡') && !raw.includes('paopao'), 'Legacy pack source must not contain 泡泡');
    const manifests = { kaomoji: makeKaomojiManifest(source.packs.kaomoji) };
    for (const definition of OLD_PACKS) {
        manifests[definition.id] = makeOldImageManifest(source.packs[definition.id], definition);
    }
    return manifests;
}

function makePackIndex(bangumi, legacy) {
    return {
        version: 1,
        defaultPack: 'bangumi',
        tabs: [
            {
                id: 'recent',
                label: '最近使用',
                type: 'virtual',
                count: 0,
                manifest: null,
                icon: { symbol: 'history' }
            },
            {
                id: 'kaomoji',
                label: legacy.kaomoji.label,
                type: legacy.kaomoji.type,
                count: legacy.kaomoji.items.length,
                manifest: 'packs/kaomoji.json',
                icon: { text: 'OωO' }
            },
            {
                id: 'bangumi',
                label: bangumi.label,
                type: bangumi.type,
                count: bangumi.items.length,
                manifest: 'packs/bangumi.json',
                icon: {
                    poster: 'bangumi/poster/053.webp',
                    animated: 'bangumi/animated/053.gif'
                }
            },
            ...OLD_PACKS.map((definition) => {
                const manifest = legacy[definition.id];
                return {
                    id: definition.id,
                    label: manifest.label,
                    type: manifest.type,
                    count: manifest.items.length,
                    manifest: `packs/${definition.id}.json`,
                    icon: { poster: manifest.items[0].src }
                };
            })
        ]
    };
}

async function loadCommittedBangumiSources() {
    const { raw, value } = await readJson(BANGUMI_SOURCES_FILE);
    assert(isPlainObject(value), 'Bangumi source metadata root must be an object');
    assert(raw === canonicalJson(value), 'Bangumi source metadata must use canonical JSON formatting');
    assert(
        JSON.stringify(Object.keys(value)) === JSON.stringify(['version', 'sources']),
        'Bangumi source metadata root has an invalid schema'
    );
    assert(value && value.version === 1, 'Bangumi source metadata version must be 1');
    assert(Array.isArray(value.sources), 'Bangumi source metadata has no sources array');
    const sources = value.sources.map((item, index) => {
        assert(item && typeof item === 'object', `Bangumi source ${padId(index + 1)} is invalid`);
        assert(
            JSON.stringify(Object.keys(item)) === JSON.stringify(['filename', 'timestamp', 'sha256']),
            `Bangumi source ${padId(index + 1)} has an invalid schema`
        );
        const parsed = parseSourceFilename(item.filename);
        assert(item.timestamp === parsed.timestamp, `Bangumi source ${padId(index + 1)} timestamp does not match its filename`);
        return { ...parsed, sha256: item.sha256 };
    });
    validateBangumiSources(sources);
    return sources;
}

async function loadImportSources(directory) {
    const sourceDirectory = resolve(directory);
    const sourceStats = await stat(sourceDirectory).catch((error) => {
        if (error && error.code === 'ENOENT') {
            fail(`Import directory does not exist: ${sourceDirectory}`);
        }
        throw error;
    });
    assert(sourceStats.isDirectory(), `Import path is not a directory: ${sourceDirectory}`);

    const entries = await readdir(sourceDirectory, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile());
    assert(files.length === entries.length, 'Import directory must contain files only');
    const sources = files.map((entry) => ({
        ...parseSourceFilename(entry.name),
        importPath: resolve(sourceDirectory, entry.name)
    })).sort((left, right) => left.timestamp < right.timestamp ? -1 : left.timestamp > right.timestamp ? 1 : 0);
    for (const source of sources) {
        source.sha256 = sha256(await readFile(source.importPath));
    }
    validateBangumiSources(sources);
    return sources;
}

async function reconcileNumberedFiles(directory, extension, count) {
    await mkdir(directory, { recursive: true });
    const expected = new Set(Array.from({ length: count }, (_, index) => `${padId(index + 1)}.${extension}`));
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isFile() && /^\d{3}\.[A-Za-z0-9]+$/u.test(entry.name) && !expected.has(entry.name)) {
            await unlink(resolve(directory, entry.name));
        }
    }
}

async function validateGif(file, id, expectedSha256) {
    const contents = await readFile(file);
    const signature = contents.subarray(0, 6).toString('ascii');
    assert(signature === 'GIF89a', `Bangumi ${id} must be GIF89a, found ${signature || 'empty file'}`);
    if (expectedSha256 !== undefined) {
        assert(sha256(contents) === expectedSha256, `Bangumi ${id} content does not match its source metadata`);
    }
    const metadata = await sharp(file).metadata();
    assert(metadata.format === 'gif', `Bangumi ${id} is not a GIF`);
    assert(metadata.width === 240 && metadata.height === 240, `Bangumi ${id} must be 240x240, found ${metadata.width}x${metadata.height}`);
    assert(Number(metadata.pages) > 1, `Bangumi ${id} is not animated`);
    return contents;
}

async function makePoster(input) {
    return sharp(input, { page: 0 })
        .resize(POSTER_SIZE, POSTER_SIZE, {
            fit: 'fill',
            kernel: sharp.kernel.lanczos3
        })
        .webp({
            quality: 82,
            alphaQuality: 100,
            effort: 6,
            smartSubsample: true
        })
        .toBuffer();
}

async function generatePosters(sources) {
    await reconcileNumberedFiles(POSTER_DIR, 'webp', sources.length);
    for (let index = 0; index < sources.length; index++) {
        const id = padId(index + 1);
        const animated = resolve(ANIMATED_DIR, `${id}.gif`);
        await validateGif(animated, id, sources[index].sha256);
        await writeAtomic(resolve(POSTER_DIR, `${id}.webp`), await makePoster(animated));
    }
}

async function importAnimated(sources) {
    await reconcileNumberedFiles(ANIMATED_DIR, 'gif', sources.length);
    for (let index = 0; index < sources.length; index++) {
        const id = padId(index + 1);
        const contents = await validateGif(sources[index].importPath, id, sources[index].sha256);
        await writeAtomic(resolve(ANIMATED_DIR, `${id}.gif`), contents);
    }
}

async function writeManifests(bangumi, legacy) {
    await writeCanonicalJson(resolve(PACKS_DIR, 'bangumi.json'), bangumi);
    await writeCanonicalJson(resolve(PACKS_DIR, 'kaomoji.json'), legacy.kaomoji);
    for (const definition of OLD_PACKS) {
        await writeCanonicalJson(resolve(PACKS_DIR, `${definition.id}.json`), legacy[definition.id]);
    }
    await writeCanonicalJson(PACK_INDEX_FILE, makePackIndex(bangumi, legacy));
}

async function writeBangumiSources(sources) {
    await writeCanonicalJson(BANGUMI_SOURCES_FILE, {
        version: 1,
        sources: sources.map((source) => ({
            filename: source.filename,
            timestamp: source.timestamp,
            sha256: source.sha256
        }))
    });
}

async function assertCanonicalFile(file, expected) {
    const { raw } = await readJson(file);
    assert(raw === canonicalJson(expected), `JSON is stale or non-canonical: ${file}`);
}

async function assertExactFiles(directory, expectedNames) {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
        if (error && error.code === 'ENOENT') {
            fail(`Missing asset directory: ${directory}`);
        }
        throw error;
    });
    assert(entries.every((entry) => entry.isFile()), `Asset directory contains a non-file entry: ${directory}`);
    const actual = entries.map((entry) => entry.name).sort();
    const expected = [...expectedNames].sort();
    assert(JSON.stringify(actual) === JSON.stringify(expected), `Unexpected asset set in ${directory}`);
}

function localPathForOldAsset(src) {
    assert(src.startsWith(THEME_PUBLIC_PREFIX), `Not a theme asset path: ${src}`);
    const relative = src.slice(THEME_PUBLIC_PREFIX.length);
    const local = resolve(ROOT, relative);
    assert(local.startsWith(ROOT + sep), `Old emote path escapes the theme: ${src}`);
    return local;
}

async function validateOldAssets(legacy) {
    for (const definition of OLD_PACKS) {
        const assetDirectory = resolve(ROOT, `assets/libs/owo/biaoqing/${definition.assetDirectory}`);
        const assetEntries = await readdir(assetDirectory, { withFileTypes: true });
        const exactNames = new Set(assetEntries.filter((entry) => entry.isFile()).map((entry) => entry.name));
        const caseInsensitiveNames = new Map(
            [...exactNames].map((name) => [name.toLowerCase(), name])
        );

        for (const item of legacy[definition.id].items) {
            const file = localPathForOldAsset(item.src);
            const expectedName = basename(file);
            if (!exactNames.has(expectedName)) {
                const actualName = caseInsensitiveNames.get(expectedName.toLowerCase());
                if (actualName) {
                    fail(`Old emote asset path has incorrect filename casing: ${item.src} (found ${actualName})`);
                }
                fail(`Missing old emote asset: ${item.src}`);
            }
            const metadata = await stat(file).catch((error) => {
                if (error && error.code === 'ENOENT') {
                    fail(`Missing old emote asset: ${item.src}`);
                }
                throw error;
            });
            assert(metadata.isFile(), `Old emote asset is not a file: ${item.src}`);
        }
    }
}

function validateManifestContracts(packIndex, bangumi, legacy) {
    const tabIds = packIndex.tabs.map((tab) => tab.id);
    assert(
        JSON.stringify(tabIds) === JSON.stringify(['recent', 'kaomoji', 'bangumi', 'quyin', 'bilibili', 'mihoyo', 'aru']),
        'Pack tab order is invalid'
    );
    assert(packIndex.defaultPack === 'bangumi', 'Default pack must be bangumi');
    ensureUnique(packIndex.tabs, (tab) => tab.id, 'pack ID');
    ensureUnique(bangumi.items, (item) => item.id, 'Bangumi ID');
    ensureUnique(bangumi.items, (item) => item.token, 'Bangumi token');

    const imageTokens = [];
    for (const item of bangumi.items) {
        imageTokens.push(item.token);
        assert(item.poster === `poster/${item.id}.webp`, `Invalid Bangumi poster path: ${item.id}`);
        assert(item.animated === `animated/${item.id}.gif`, `Invalid Bangumi animated path: ${item.id}`);
        assert(!item.poster.includes('..') && !item.animated.includes('..'), `Unsafe Bangumi path: ${item.id}`);
    }
    for (const definition of OLD_PACKS) {
        const manifest = legacy[definition.id];
        ensureUnique(manifest.items, (item) => item.id, `${definition.id} ID`);
        ensureUnique(manifest.items, (item) => item.src, `${definition.id} asset path`);
        imageTokens.push(...manifest.items.map((item) => item.token));
    }
    ensureUnique(imageTokens, (token) => token, 'image token');

    const generatedText = canonicalJson(packIndex)
        + canonicalJson(bangumi)
        + Object.values(legacy).map(canonicalJson).join('');
    assert(!generatedText.includes('"Emoji"'), 'Emoji must not be included in generated manifests');
    assert(!generatedText.includes('泡泡') && !generatedText.includes('paopao'), '泡泡 must not be included in generated manifests');
    assert(!generatedText.includes('/Users/'), 'Generated manifests must not contain an external absolute source path');
}

async function checkGeneratedImages(bangumi, sources) {
    assert(bangumi.items.length === sources.length, 'Bangumi manifest and source metadata counts differ');
    const animatedNames = bangumi.items.map((item) => `${item.id}.gif`);
    const posterNames = bangumi.items.map((item) => `${item.id}.webp`);
    await assertExactFiles(ANIMATED_DIR, animatedNames);
    await assertExactFiles(POSTER_DIR, posterNames);

    for (let index = 0; index < bangumi.items.length; index++) {
        const item = bangumi.items[index];
        const animated = resolve(ANIMATED_DIR, `${item.id}.gif`);
        const poster = resolve(POSTER_DIR, `${item.id}.webp`);
        await validateGif(animated, item.id, sources[index].sha256);
        const posterMetadata = await sharp(poster).metadata();
        assert(posterMetadata.format === 'webp', `Bangumi poster ${item.id} is not WebP`);
        assert(
            posterMetadata.width === POSTER_SIZE && posterMetadata.height === POSTER_SIZE,
            `Bangumi poster ${item.id} must be ${POSTER_SIZE}x${POSTER_SIZE}`
        );
        const [committed, rebuilt] = await Promise.all([readFile(poster), makePoster(animated)]);
        assert(committed.equals(rebuilt), `Bangumi poster ${item.id} is stale or non-deterministic`);
    }
}

async function checkAll() {
    assert(sharp.versions.sharp === SHARP_VERSION, `Expected sharp ${SHARP_VERSION}, found ${sharp.versions.sharp}`);
    const sources = await loadCommittedBangumiSources();
    const bangumi = makeBangumiManifest(sources);
    const legacy = await makeLegacyManifests();
    const packIndex = makePackIndex(bangumi, legacy);
    validateManifestContracts(packIndex, bangumi, legacy);

    await assertCanonicalFile(BANGUMI_SOURCES_FILE, {
        version: 1,
        sources: sources.map((source) => ({
            filename: source.filename,
            timestamp: source.timestamp,
            sha256: source.sha256
        }))
    });

    const manifestFiles = ['aru.json', 'bangumi.json', 'bilibili.json', 'kaomoji.json', 'mihoyo.json', 'quyin.json'];
    await assertExactFiles(PACKS_DIR, manifestFiles);
    await assertCanonicalFile(PACK_INDEX_FILE, packIndex);
    await assertCanonicalFile(resolve(PACKS_DIR, 'bangumi.json'), bangumi);
    await assertCanonicalFile(resolve(PACKS_DIR, 'kaomoji.json'), legacy.kaomoji);
    for (const definition of OLD_PACKS) {
        await assertCanonicalFile(resolve(PACKS_DIR, `${definition.id}.json`), legacy[definition.id]);
    }
    await validateOldAssets(legacy);
    await checkGeneratedImages(bangumi, sources);
    return bangumi.items.length;
}

async function buildFromCommitted() {
    const sources = await loadCommittedBangumiSources();
    const bangumi = makeBangumiManifest(sources);
    const legacy = await makeLegacyManifests();
    await generatePosters(sources);
    await writeManifests(bangumi, legacy);
    return checkAll();
}

async function importFrom(directory) {
    const sources = await loadImportSources(directory);
    const bangumi = makeBangumiManifest(sources);
    const legacy = await makeLegacyManifests();
    await importAnimated(sources);
    await generatePosters(sources);
    await writeBangumiSources(sources);
    await writeManifests(bangumi, legacy);
    return checkAll();
}

function printHelp() {
    console.log(`Usage:
  node scripts/build-emotes.mjs
  node scripts/build-emotes.mjs --check
  node scripts/build-emotes.mjs --import <directory>

Modes:
  default    Rebuild posters and manifests from committed GIFs and metadata.
  --check    Validate committed manifests and assets without writing files.
  --import   Import the original timestamped Bangumi GIFs, then rebuild all data.
`);
}

function parseArguments(arguments_) {
    if (arguments_.length === 0) {
        return { mode: 'build' };
    }
    if (arguments_.length === 1 && (arguments_[0] === '--help' || arguments_[0] === '-h')) {
        return { mode: 'help' };
    }
    if (arguments_.length === 1 && arguments_[0] === '--check') {
        return { mode: 'check' };
    }
    if (arguments_.length === 2 && arguments_[0] === '--import') {
        return { mode: 'import', directory: arguments_[1] };
    }
    fail('Invalid arguments. Run with --help for usage.');
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    if (options.mode === 'help') {
        printHelp();
        return;
    }
    if (options.mode === 'check') {
        const count = await checkAll();
        console.log(`Verified ${count} Bangumi emotes and 5 retained packs.`);
        return;
    }
    if (options.mode === 'import') {
        const count = await importFrom(options.directory);
        console.log(`Imported and verified ${count} Bangumi emotes.`);
        return;
    }
    const count = await buildFromCommitted();
    console.log(`Rebuilt and verified ${count} Bangumi emotes.`);
}

main().catch((error) => {
    console.error(`emotes: ${error.message}`);
    process.exitCode = 1;
});

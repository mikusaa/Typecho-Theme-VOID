const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../../..');
const voidSourcePaths = require('../../../scripts/void-sources.cjs');

function normalizeSource(source) {
    return source.replace(/\r\n?/g, '\n');
}

function readSource(relativePath) {
    return normalizeSource(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'));
}

function readVoidSource() {
    return voidSourcePaths.map(readSource).join('\n');
}

function readVoidModule(name) {
    const fileName = name.endsWith('.js') ? name : `${name}.js`;
    const relativePath = voidSourcePaths.find((candidate) => path.basename(candidate) === fileName);

    if (!relativePath) {
        throw new Error(`Unknown VOID source module: ${name}`);
    }

    return readSource(relativePath);
}

module.exports = {
    readVoidModule,
    readVoidSource,
    repositoryRoot,
    voidSourcePaths
};

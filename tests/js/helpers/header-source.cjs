const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../../..');
const headerSourcePaths = require('../../../scripts/header-sources.cjs');

function normalizeSource(source) {
    return source.replace(/\r\n?/g, '\n');
}

function readSource(relativePath) {
    return normalizeSource(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'));
}

function readHeaderSource() {
    return headerSourcePaths.map(readSource).join('\n');
}

function readHeaderModule(name) {
    const fileName = name.endsWith('.js') ? name : `${name}.js`;
    const relativePath = headerSourcePaths.find((candidate) => path.basename(candidate) === fileName);

    if (!relativePath) {
        throw new Error(`Unknown header source module: ${name}`);
    }

    return readSource(relativePath);
}

module.exports = {
    headerSourcePaths,
    readHeaderModule,
    readHeaderSource,
    repositoryRoot
};

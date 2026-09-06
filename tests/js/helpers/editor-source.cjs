const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../../..');
const editorSourcePaths = require('../../../scripts/editor-sources.cjs');

function normalizeSource(source) {
    return source.replace(/\r\n?/g, '\n');
}

function readSource(relativePath) {
    return normalizeSource(fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8'));
}

function readEditorSource() {
    return editorSourcePaths.map(readSource).join('\n');
}

function readEditorModule(name) {
    const fileName = name.endsWith('.js') ? name : `${name}.js`;
    const relativePath = editorSourcePaths.find((candidate) => path.basename(candidate) === fileName);

    if (!relativePath) {
        throw new Error(`Unknown editor source module: ${name}`);
    }

    return readSource(relativePath);
}

module.exports = {
    editorSourcePaths,
    readEditorModule,
    readEditorSource,
    repositoryRoot
};

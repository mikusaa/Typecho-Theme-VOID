const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const sass = require('sass');

const themeSource = fs.readFileSync(
    path.resolve(__dirname, '../../assets/VOID.js'),
    'utf8'
);

class FakeClassList {
    constructor(element) {
        this.element = element;
    }

    values() {
        return this.element.className ? this.element.className.split(/\s+/).filter(Boolean) : [];
    }

    add(name) {
        const names = this.values();
        if (!names.includes(name)) {
            names.push(name);
            this.element.className = names.join(' ');
        }
    }

    contains(name) {
        return this.values().includes(name);
    }

    remove(name) {
        this.element.className = this.values().filter((candidate) => candidate !== name).join(' ');
    }
}

class FakeElement {
    constructor(tagName, ownerDocument, text = '') {
        this.attributes = new Map();
        this.children = [];
        this.className = '';
        this.classList = new FakeClassList(this);
        this.ownerDocument = ownerDocument;
        this.parentNode = null;
        this.tagName = String(tagName || '').toUpperCase();
        this.value = String(text);
    }

    get textContent() {
        return this.value + this.children.map((child) => child.textContent).join('');
    }

    set textContent(value) {
        this.value = String(value);
        this.children = [];
    }

    appendChild(child) {
        if (child.parentNode) {
            child.parentNode.children = child.parentNode.children.filter((candidate) => candidate !== child);
        }
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    hasAttribute(name) {
        return this.attributes.has(name);
    }

    insertBefore(child, reference) {
        if (child.parentNode) {
            child.parentNode.children = child.parentNode.children.filter((candidate) => candidate !== child);
        }
        const index = this.children.indexOf(reference);
        child.parentNode = this;
        this.children.splice(index < 0 ? this.children.length : index, 0, child);
        return child;
    }

    matches(selector) {
        if (selector === 'td') {
            return this.tagName === 'TD';
        }
        if (selector === 'tbody tr') {
            return this.tagName === 'TR' && this.parentNode && this.parentNode.tagName === 'TBODY';
        }
        if (selector === 'table') {
            return this.tagName === 'TABLE';
        }
        if (selector === 'img[data-void-image-content]' || selector === 'img') {
            return this.tagName === 'IMG';
        }
        return false;
    }

    querySelector(selector) {
        const selectors = selector.split(',').map((value) => value.trim());
        return this.querySelectorAll(selectors).shift() || null;
    }

    querySelectorAll(selector) {
        const selectors = Array.isArray(selector) ? selector : [selector];
        const matches = [];
        const visit = (node) => {
            node.children.forEach((child) => {
                if (selectors.some((candidate) => child.matches(candidate))) {
                    matches.push(child);
                }
                visit(child);
            });
        };
        visit(this);
        return matches;
    }

    removeAttribute(name) {
        this.attributes.delete(name);
    }

    setAttribute(name, value) {
        this.attributes.set(name, String(value));
    }
}

class FakeDocument {
    createElement(tagName) {
        return new FakeElement(tagName, this);
    }
}

function createCell(document, tagName, text = '') {
    return new FakeElement(tagName, document, text);
}

function createTable(headers, rows, options = {}) {
    const document = new FakeDocument();
    const host = document.createElement('article');
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const headerRows = [];
    const primaryHeaderRow = document.createElement('tr');

    primaryHeaderRow.cells = headers.map((header) => createCell(document, 'th', header));
    primaryHeaderRow.cells.forEach((cell) => primaryHeaderRow.appendChild(cell));
    headerRows.push(primaryHeaderRow);
    thead.appendChild(primaryHeaderRow);

    if (options.multipleHeaderRows) {
        const extraHeaderRow = document.createElement('tr');
        extraHeaderRow.cells = headers.map((header) => createCell(document, 'th', header));
        extraHeaderRow.cells.forEach((cell) => extraHeaderRow.appendChild(cell));
        headerRows.push(extraHeaderRow);
        thead.appendChild(extraHeaderRow);
    }

    tbody.rows = rows.map((values) => {
        const row = document.createElement('tr');
        row.cells = values.map((value) => {
            if (value === 'IMAGE') {
                const cell = createCell(document, 'td');
                const image = createCell(document, 'img');
                image.setAttribute('data-void-image-content', '');
                cell.appendChild(image);
                return cell;
            }
            if (value === 'FIGURE_IMAGE') {
                const cell = createCell(document, 'td');
                const figure = createCell(document, 'figure');
                const link = createCell(document, 'a');
                const image = createCell(document, 'img');
                const caption = createCell(document, 'figcaption', '图片说明');
                figure.setAttribute('data-void-image-item', '');
                image.setAttribute('data-void-image-content', '');
                link.appendChild(image);
                figure.appendChild(link);
                figure.appendChild(caption);
                cell.appendChild(figure);
                return cell;
            }
            return createCell(document, 'td', value);
        });
        row.cells.forEach((cell) => row.appendChild(cell));
        tbody.appendChild(row);
        return row;
    });

    thead.rows = headerRows;
    table.tHead = thead;
    table.tBodies = [tbody];
    table.tFoot = options.footer ? document.createElement('tfoot') : null;
    table.appendChild(thead);
    table.appendChild(tbody);
    host.appendChild(table);

    return { document, host, table, thead, tbody };
}

function loadContent() {
    const document = {
        readyState: 'loading',
        addEventListener() {},
        createElement() {},
        querySelectorAll() { return []; }
    };

    const window = {
        clearTimeout() {},
        setInterval() {},
        setTimeout() {}
    };
    window.window = window;

    const context = {
        console: { error() {}, log() {} },
        document,
        window
    };

    vm.runInNewContext(themeSource, context);
    return context.VOID_Content;
}

function createScope(tables) {
    return {
        querySelectorAll(selector) {
            return selector === '.yue table' ? tables : [];
        }
    };
}

test('simple image tables map headers and keep one idempotent wrapper', () => {
    const content = loadContent();
    const fixture = createTable(
        ['图片', '文章', '出处'],
        [['IMAGE', 'Steam Deck 初步上手指南', '休息日 / Homutan #Pixiv']]
    );
    const scope = createScope([fixture.table]);

    content.parseTables(scope);
    content.parseTables(scope);

    const wrapper = fixture.table.parentNode;
    const row = fixture.tbody.rows[0];
    assert.equal(fixture.host.children.length, 1);
    assert.equal(wrapper.classList.contains('void-table-scroll'), true);
    assert.equal(wrapper.classList.contains('void-table-scroll--responsive'), true);
    assert.equal(wrapper.getAttribute('role'), 'region');
    assert.equal(wrapper.getAttribute('tabindex'), '0');
    assert.equal(wrapper.children.length, 1);
    assert.equal(fixture.table.hasAttribute('data-void-table-responsive'), true);
    assert.equal(fixture.thead.rows[0].cells[0].getAttribute('scope'), 'col');
    assert.equal(row.getAttribute('data-void-table-has-media'), '');
    assert.equal(row.cells[0].getAttribute('data-void-table-label'), '图片');
    assert.equal(row.cells[0].getAttribute('data-void-table-media'), '');
    assert.equal(row.cells[1].getAttribute('data-void-table-label'), '文章');
    assert.equal(row.cells[1].getAttribute('data-void-table-primary'), '');
    assert.equal(row.cells[2].getAttribute('data-void-table-label'), '出处');
    assert.equal(row.cells[2].getAttribute('data-void-table-primary'), null);
});

test('text-only tables use the first column as the mobile primary field', () => {
    const content = loadContent();
    const fixture = createTable(
        ['命令', '说明'],
        [['npm test', '运行测试'], ['make build', '生成完整构建']]
    );

    content.parseTables(createScope([fixture.table]));

    fixture.tbody.rows.forEach((row) => {
        assert.equal(row.getAttribute('data-void-table-has-media'), null);
        assert.equal(row.cells[0].getAttribute('data-void-table-primary'), '');
        assert.equal(row.cells[1].getAttribute('data-void-table-primary'), null);
    });
});

test('semantic figures with captions remain pure mobile media cells', () => {
    const content = loadContent();
    const fixture = createTable(
        ['图片', '文章'],
        [['FIGURE_IMAGE', '带说明的图片']]
    );

    content.parseTables(createScope([fixture.table]));

    assert.equal(fixture.tbody.rows[0].getAttribute('data-void-table-has-media'), '');
    assert.equal(fixture.tbody.rows[0].cells[0].getAttribute('data-void-table-media'), '');
    assert.equal(fixture.tbody.rows[0].cells[1].getAttribute('data-void-table-primary'), '');
});

test('complex or ambiguous tables retain the scroll-only fallback', () => {
    const content = loadContent();
    const fixtures = [
        createTable(['分组', '值'], [['A', '1']], { multipleHeaderRows: true }),
        createTable(['', '值'], [['A', '1']]),
        createTable(['图片', '比较图'], [['IMAGE', 'IMAGE']]),
        createTable(['分组', '值'], [['A']]),
        createTable(['分组', '值'], [['A', '1']], { footer: true }),
        createTable(['分组', '值'], [['A', '1']])
    ];
    fixtures[0].thead.rows[0].cells[0].setAttribute('colspan', '2');
    fixtures[5].tbody.rows[0].cells[0].tagName = 'TH';

    content.parseTables(createScope(fixtures.map((fixture) => fixture.table)));

    fixtures.forEach((fixture) => {
        assert.equal(fixture.table.hasAttribute('data-void-table-responsive'), false);
        assert.equal(fixture.table.parentNode.classList.contains('void-table-scroll'), true);
        assert.equal(fixture.table.parentNode.classList.contains('void-table-scroll--responsive'), false);
        fixture.tbody.rows.forEach((row) => {
            row.cells.forEach((cell) => {
                assert.equal(cell.getAttribute('data-void-table-label'), null);
            });
        });
    });
});

test('new PJAX content can be enhanced independently after the first page', () => {
    const content = loadContent();
    const first = createTable(['项目', '状态'], [['首页', '完成']]);
    const next = createTable(['图片', '文章'], [['IMAGE', '下一篇']]);

    content.parseTables(createScope([first.table]));
    content.parseTables(createScope([next.table]));

    assert.equal(first.table.hasAttribute('data-void-table-responsive'), true);
    assert.equal(next.table.hasAttribute('data-void-table-responsive'), true);
    assert.equal(next.tbody.rows[0].cells[0].hasAttribute('data-void-table-media'), true);
    assert.equal(
        (themeSource.match(/VOID_Content\.parseTables\(document\.getElementById\('pjax-container'\) \|\| document\);/g) || []).length,
        2
    );
});

test('reinitialization clears responsive state when a table becomes complex', () => {
    const content = loadContent();
    const fixture = createTable(['项目', '状态'], [['首页', '完成']]);
    const scope = createScope([fixture.table]);

    content.parseTables(scope);
    fixture.tbody.rows[0].cells[0].setAttribute('rowspan', '2');
    content.parseTables(scope);

    assert.equal(fixture.table.hasAttribute('data-void-table-responsive'), false);
    assert.equal(fixture.table.parentNode.classList.contains('void-table-scroll--responsive'), false);
    assert.equal(fixture.tbody.rows[0].cells[0].getAttribute('data-void-table-label'), null);
    assert.equal(fixture.tbody.rows[0].cells[0].getAttribute('data-void-table-primary'), null);
});

test('compiled table styles preserve labels, thumbnails and normal word breaking', () => {
    const css = sass.compile(path.resolve(__dirname, '../../assets/parts/_yue.scss')).css;

    assert.match(css, /\.yue \.void-table-scroll/);
    assert.match(css, /table\[data-void-table-responsive\]/);
    assert.match(css, /content: attr\(data-void-table-label\)/);
    assert.match(css, /width: 144px !important/);
    assert.match(css, /width: 92px !important/);
    assert.match(css, /height: 90px/);
    assert.match(css, /height: 69px/);
    assert.match(css, /word-break: normal/);
    assert.match(css, /@media screen and \(max-width: 767px\)/);
});

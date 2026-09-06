const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { readEditorModule, repositoryRoot } = require('./helpers/editor-source.cjs');

const fieldsSource = readEditorModule('fields');

function sliceSource(startMarker, endMarker) {
    const start = fieldsSource.indexOf(startMarker);
    const end = fieldsSource.indexOf(endMarker, start);

    assert.notEqual(start, -1, `missing ${startMarker}`);
    assert.notEqual(end, -1, `missing ${endMarker}`);
    return fieldsSource.slice(start, end);
}

class ExtractionWrapper {
    constructor(kind, options = {}) {
        this.kind = kind;
        this.tag = options.tag || '';
        this.length = options.length === undefined ? 1 : options.length;
        this.attributes = new Map(Object.entries(options.attributes || {}));
        this.appended = [];
        this.beforeItems = [];
        this.childLookup = options.childLookup || {};
        this.childItems = options.childItems || [];
        this.contentItems = options.contentItems || [];
        this.dataValues = new Map();
        this.items = options.items || null;
        this.row = options.row || null;
        this.detached = false;
        this.removed = false;
    }

    first() {
        return this;
    }

    eq(index) {
        return this.items && this.items[index] ? this.items[index] : EMPTY_EXTRACTION;
    }

    find(selector) {
        return this.childLookup[selector] || EMPTY_EXTRACTION;
    }

    closest() {
        return this.row || EMPTY_EXTRACTION;
    }

    is(selector) {
        return this.tag === selector;
    }

    children(selector) {
        if (selector) {
            return this.childLookup[selector] || EMPTY_EXTRACTION;
        }
        return new ExtractionWrapper('collection', {
            items: this.childItems,
            length: this.childItems.length
        });
    }

    contents() {
        return new ExtractionWrapper('collection', {
            items: this.contentItems,
            length: this.contentItems.length
        });
    }

    append(value) {
        if (value.items) {
            this.appended.push(...value.items);
        } else if (value.length) {
            this.appended.push(value);
        }
        return this;
    }

    attr(name, value) {
        if (arguments.length === 1) {
            return this.attributes.get(name);
        }
        this.attributes.set(name, String(value));
        return this;
    }

    data(name, value) {
        if (arguments.length === 1) {
            return this.dataValues.get(name);
        }
        this.dataValues.set(name, value);
        return this;
    }

    detach() {
        this.detached = true;
        return this;
    }

    remove() {
        this.removed = true;
        return this;
    }

    before(value) {
        this.beforeItems.push(value);
        return this;
    }
}

const EMPTY_EXTRACTION = new ExtractionWrapper('empty', { length: 0 });

function loadExtractionHelpers() {
    const created = [];

    function jQuery(value) {
        if (value === undefined) {
            return EMPTY_EXTRACTION;
        }
        if (typeof value === 'string' && value.startsWith('<')) {
            const wrapper = new ExtractionWrapper(value);
            created.push(wrapper);
            return wrapper;
        }
        throw new Error(`Unexpected extraction jQuery value: ${String(value)}`);
    }

    const context = { $: jQuery };
    vm.runInNewContext(
        `${sliceSource('function preserveHiddenMetadataField', '    function cleanupCustomField')}
this.preserveHiddenMetadataField = preserveHiddenMetadataField;
this.extractVoidField = extractVoidField;`,
        context
    );

    return {
        created,
        extractVoidField: context.extractVoidField,
        preserveHiddenMetadataField: context.preserveHiddenMetadataField
    };
}

function createTypechoField(tag, fieldName, value, wrapped) {
    const labelText = { text: `${fieldName} label` };
    const control = new ExtractionWrapper('control', {
        attributes: { name: `fields[${fieldName}]`, value }
    });
    const valueContent = wrapped
        ? new ExtractionWrapper('div', { tag: 'div', contentItems: [control] })
        : null;
    const labelSource = new ExtractionWrapper('label-source', { contentItems: [labelText] });
    const valueSource = new ExtractionWrapper('value-source', {
        childItems: valueContent ? [valueContent] : [],
        contentItems: valueContent ? [valueContent] : [control]
    });
    const row = new ExtractionWrapper('row', { tag });

    if (tag === 'li') {
        row.childLookup['.field-name'] = labelSource;
        row.childLookup['.field-value'] = valueSource;
    } else {
        row.childLookup.td = new ExtractionWrapper('cells', {
            items: [labelSource, valueSource],
            length: 2
        });
    }
    control.row = row;

    const customField = new ExtractionWrapper('custom-field');
    customField.find = (selector) => selector.includes(fieldName) ? control : EMPTY_EXTRACTION;

    return { control, customField, labelText, row };
}

class FakeList {
    constructor(items = []) {
        this.items = items;
        this.length = items.length;
    }

    first() {
        return this.items[0] || EMPTY_CONTROL;
    }

    each(callback) {
        this.items.forEach((item, index) => callback.call(item.raw, index, item.raw));
        return this;
    }

    add(value) {
        const additions = value instanceof FakeList ? value.items : [value];
        return new FakeList(this.items.concat(additions.filter((item) => item && item.length)));
    }

    eq(index) {
        return this.items[index] || EMPTY_CONTROL;
    }

    index(raw) {
        return this.items.findIndex((item) => item.raw === raw);
    }
}

class FakeControl {
    constructor(name, length = 1) {
        this.name = name;
        this.length = length;
        this.attributes = new Map();
        this.properties = new Map();
        this.dataValues = new Map();
        this.listeners = [];
        this.classes = new Set();
        this.children = [];
        this.insertions = [];
        this.effects = [];
        this.value = '';
        this.textValue = '';
        this.parent = null;
        this.raw = { wrapper: this };
    }

    first() {
        return this;
    }

    attr(name, value) {
        if (arguments.length === 1) {
            return this.attributes.get(name);
        }
        this.attributes.set(name, String(value));
        return this;
    }

    prop(name, value) {
        if (arguments.length === 1) {
            return this.properties.get(name) || false;
        }
        this.properties.set(name, value);
        return this;
    }

    data(name, value) {
        if (arguments.length === 1) {
            return this.dataValues.get(name);
        }
        this.dataValues.set(name, value);
        return this;
    }

    val(value) {
        if (!arguments.length) {
            return this.value;
        }
        this.value = String(value);
        return this;
    }

    text(value) {
        if (!arguments.length) {
            return this.textValue;
        }
        this.textValue = String(value);
        return this;
    }

    addClass(name) {
        this.classes.add(name);
        return this;
    }

    toggleClass(name, enabled) {
        if (enabled) {
            this.classes.add(name);
        } else {
            this.classes.delete(name);
        }
        return this;
    }

    append(child) {
        child.parent = this;
        this.children.push(child);
        return this;
    }

    after(control) {
        this.insertions.push(control);
        return this;
    }

    find(selector) {
        if (selector === 'option') {
            return new FakeList(this.children.filter((child) => child.name === 'option'));
        }
        if (selector === '.void-segmented-control__item') {
            return new FakeList(this.children.filter((child) => child.name === 'button'));
        }
        if (selector === '.void-segmented-control__item:not(:disabled)') {
            return new FakeList(this.children.filter((child) =>
                child.name === 'button' && !child.prop('disabled')
            ));
        }
        return EMPTY_CONTROL;
    }

    on(names, selector, listener) {
        if (typeof selector === 'function') {
            listener = selector;
            selector = null;
        }
        this.listeners.push({ listener, names, selector });
        return this;
    }

    trigger(name, event = {}) {
        const invoke = (owner, delegated) => {
            owner.listeners.forEach((entry) => {
                const matches = entry.names.split(/\s+/)
                    .some((eventName) => eventName.split('.')[0] === name);
                if (matches && Boolean(entry.selector) === delegated) {
                    entry.listener.call(this.raw, event);
                }
            });
        };

        invoke(this, false);
        if (this.parent) {
            invoke(this.parent, true);
        }
        return this;
    }

    focus() {
        this.focused = true;
        return this;
    }

    css() {
        return this;
    }

    stop() {
        return this;
    }

    hide() {
        this.effects.push({ name: 'hide' });
        return this;
    }

    slideDown(duration) {
        this.effects.push({ duration, name: 'slideDown' });
        return this;
    }

    slideUp(duration, complete) {
        this.effects.push({ duration, name: 'slideUp' });
        if (complete) {
            complete();
        }
        return this;
    }

    animate(properties, options) {
        this.effects.push({
            duration: options && options.duration,
            name: 'animate',
            properties
        });
        if (options && options.complete) {
            options.complete();
        }
        return this;
    }
}

const EMPTY_CONTROL = new FakeControl('empty', 0);

function createJQuery() {
    function jQuery(value) {
        if (value === undefined) {
            return new FakeList();
        }
        if (value && value.wrapper) {
            return value.wrapper;
        }
        if (typeof value === 'string' && value.includes('void-segmented-control__item')) {
            return new FakeControl('button').attr('role', 'radio');
        }
        if (typeof value === 'string' && value.includes('void-segmented-control')) {
            return new FakeControl('segmented').attr('role', 'radiogroup');
        }
        throw new Error(`Unexpected control jQuery value: ${String(value)}`);
    }

    jQuery.each = (values, callback) => {
        Object.keys(values).forEach((key) => callback(key, values[key]));
    };
    jQuery.inArray = (value, values) => values.indexOf(value);
    return jQuery;
}

function loadSegmentedInitializer() {
    const jQuery = createJQuery();
    const context = {
        $: jQuery,
        VOID_SEGMENTED_FIELDS: {
            bannerStyle: {
                labels: { 0: '正常顶部', 1: '顶部模糊', 2: '不显示' }
            }
        },
        getSegmentedOptionLabel(config, value, fallbackLabel) {
            return Object.prototype.hasOwnProperty.call(config.labels, value)
                ? config.labels[value]
                : String(fallbackLabel).trim();
        },
        normalizeDescription(value) {
            return String(value || '').trim().replace(/\s+/g, ' ');
        }
    };

    vm.runInNewContext(
        `${sliceSource('function initSegmentedSelects', '    function initSwitchControls')}
this.initSegmentedSelects = initSegmentedSelects;`,
        context
    );
    return context.initSegmentedSelects;
}

function createSegmentedFixture() {
    const select = new FakeControl('select').val('1').attr('name', 'fields[bannerStyle]');
    const field = new FakeControl('field');
    const label = new FakeControl('label').text('题图样式');

    ['0', '1', '2'].forEach((value) => {
        select.append(new FakeControl('option').attr('value', value).text(`option ${value}`));
    });
    field.find = (selector) => {
        if (selector === 'select') {
            return select;
        }
        if (selector === '.void-editor-field__label') {
            return label;
        }
        return EMPTY_CONTROL;
    };
    const scope = {
        find(selector) {
            return selector === '[data-void-field="bannerStyle"]' ? field : EMPTY_CONTROL;
        }
    };
    return { field, scope, select };
}

function loadMediaInitializer(reducedMotion) {
    const jQuery = createJQuery();
    const context = {
        $: jQuery,
        findFieldControl(scope, fieldName) {
            return fieldName === 'banner' ? scope.banner : EMPTY_CONTROL;
        },
        normalizeDescription(value) {
            return String(value || '').trim().replace(/\s+/g, ' ');
        },
        window: {
            matchMedia() {
                return { matches: reducedMotion };
            }
        }
    };

    vm.runInNewContext(
        `${sliceSource('function initMediaFieldLayout', '    function applyFieldCopy')}
this.initMediaFieldLayout = initMediaFieldLayout;`,
        context
    );
    return context.initMediaFieldLayout;
}

function createMediaFixture(initialBanner) {
    const banner = new FakeControl('banner').val(initialBanner).attr('name', 'fields[banner]');
    const group = new FakeControl('group');
    const targets = {
        bannerSource: new FakeControl('bannerSource'),
        bannerStyle: new FakeControl('bannerStyle'),
        bannerascover: new FakeControl('bannerascover')
    };
    group.find = (selector) => {
        const match = selector.match(/data-void-field="([^"]+)"/);
        return match && targets[match[1]] ? targets[match[1]] : EMPTY_CONTROL;
    };
    const scope = {
        banner,
        find(selector) {
            return selector.includes('data-group="media"') ? group : EMPTY_CONTROL;
        }
    };
    return { banner, group, scope, targets };
}

test('post and page editor hooks keep the same public editor asset entry', () => {
    const functions = fs.readFileSync(path.join(repositoryRoot, 'functions.php'), 'utf8');
    const utils = fs.readFileSync(path.join(repositoryRoot, 'libs/Utils.php'), 'utf8');

    assert.match(functions, /factory\('admin\/write-post\.php'\)->bottom = array\('Utils', 'addButton'\)/);
    assert.match(functions, /factory\('admin\/write-page\.php'\)->bottom = array\('Utils', 'addButton'\)/);
    assert.match(utils, /indexTheme\('\/assets\/editor\.js'\)/);
});

for (const fixture of [
    { label: 'li.field', tag: 'li', wrapped: false },
    { label: 'table/tr', tag: 'tr', wrapped: true }
]) {
    test(`${fixture.label} fields keep the original submittable control`, () => {
        const helpers = loadExtractionHelpers();
        const field = createTypechoField(fixture.tag, 'banner', 'https://example.test/cover.jpg', fixture.wrapped);
        const extracted = helpers.extractVoidField(field.customField, 'banner');

        assert.equal(extracted.length, 1);
        assert.equal(extracted.appended.length, 2);
        assert.equal(extracted.appended[1].appended[0], field.control);
        assert.equal(field.control.attr('name'), 'fields[banner]');
        assert.equal(field.control.attr('value'), 'https://example.test/cover.jpg');
        assert.equal(field.row.removed, true);
    });
}

test('hidden bannerMeta is moved intact instead of being discarded with its row', () => {
    const helpers = loadExtractionHelpers();
    const meta = '{"version":1,"source":"cover.jpg","width":1200,"height":800}';
    const field = createTypechoField('tr', 'bannerMeta', meta, true);

    helpers.preserveHiddenMetadataField(field.customField, 'bannerMeta');

    assert.equal(field.control.detached, true);
    assert.equal(field.row.removed, true);
    assert.equal(field.customField.beforeItems[0], field.control);
    assert.equal(field.control.attr('name'), 'fields[bannerMeta]');
    assert.equal(field.control.attr('value'), meta);
});

test('segmented controls keep native select state, keyboard flow, and ARIA synchronized', () => {
    const initSegmentedSelects = loadSegmentedInitializer();
    const fixture = createSegmentedFixture();

    initSegmentedSelects(fixture.scope);
    assert.equal(fixture.select.insertions.length, 1);
    const control = fixture.select.insertions[0];
    const buttons = control.find('.void-segmented-control__item');

    assert.equal(control.attr('role'), 'radiogroup');
    assert.equal(control.attr('aria-label'), '题图样式');
    assert.equal(control.attr('aria-disabled'), 'false');
    assert.equal(buttons.length, 3);
    assert.equal(buttons.eq(1).attr('aria-checked'), 'true');
    assert.equal(buttons.eq(1).attr('tabindex'), '0');
    assert.equal(buttons.eq(0).attr('tabindex'), '-1');

    buttons.eq(2).trigger('click');
    assert.equal(fixture.select.val(), '2');
    assert.equal(buttons.eq(2).attr('aria-checked'), 'true');

    let prevented = false;
    buttons.eq(2).trigger('keydown', {
        key: 'ArrowRight',
        preventDefault() {
            prevented = true;
        }
    });
    assert.equal(prevented, true);
    assert.equal(fixture.select.val(), '0');
    assert.equal(buttons.eq(0).focused, true);

    fixture.select.val('1').trigger('change');
    assert.equal(buttons.eq(1).attr('aria-checked'), 'true');
    assert.equal(fixture.select.attr('name'), 'fields[bannerStyle]');

    initSegmentedSelects(fixture.scope);
    assert.equal(fixture.select.insertions.length, 1, 'repeated init must not duplicate controls');
});

test('banner-dependent fields hide, reveal, and animate without changing the banner control', () => {
    const initMediaFieldLayout = loadMediaInitializer(false);
    const fixture = createMediaFixture('');

    initMediaFieldLayout(fixture.scope);
    Object.values(fixture.targets).forEach((target) => {
        assert.equal(target.prop('hidden'), true);
        assert.equal(target.attr('aria-hidden'), 'true');
        assert.equal(target.effects.length, 0, 'initial visibility sync stays immediate');
    });

    fixture.banner.val('https://example.test/cover.jpg').trigger('input');
    Object.values(fixture.targets).forEach((target) => {
        assert.equal(target.prop('hidden'), false);
        assert.equal(target.attr('aria-hidden'), 'false');
        assert.equal(target.effects.some((effect) => effect.name === 'slideDown' && effect.duration === 180), true);
    });
    assert.equal(fixture.banner.attr('name'), 'fields[banner]');
    assert.equal(fixture.banner.val(), 'https://example.test/cover.jpg');
});

test('prefers-reduced-motion makes banner-dependent field changes immediate', () => {
    const initMediaFieldLayout = loadMediaInitializer(true);
    const fixture = createMediaFixture('');

    initMediaFieldLayout(fixture.scope);
    fixture.banner.val('cover.jpg').trigger('change');
    fixture.banner.val('').trigger('input');

    Object.values(fixture.targets).forEach((target) => {
        assert.equal(target.prop('hidden'), true);
        assert.equal(target.attr('aria-hidden'), 'true');
        assert.equal(target.effects.length, 0);
    });
});

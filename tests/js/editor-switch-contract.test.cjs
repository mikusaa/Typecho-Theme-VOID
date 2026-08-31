/* global __dirname */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const editorSource = fs.readFileSync(path.resolve(__dirname, '../../assets/editor.js'), 'utf8');

function extract(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.notEqual(start, -1, `missing ${startMarker}`);
    assert.notEqual(end, -1, `missing ${endMarker}`);
    return source.slice(start, end + endMarker.length);
}

class FakeWrapper {
    constructor(name, length = 1) {
        this.name = name;
        this.length = length;
        this.attributes = new Map();
        this.properties = new Map();
        this.dataValues = new Map();
        this.listeners = [];
        this.classes = new Set();
        this.value = '';
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

    on(names, listener) {
        this.listeners.push({ names, listener });
        return this;
    }

    trigger(name, event = {}) {
        for (const entry of this.listeners) {
            const matches = entry.names.split(/\s+/).some((eventName) => eventName.split('.')[0] === name);
            if (matches) {
                entry.listener.call(this.raw, event);
            }
        }
        return this;
    }
}

function createSwitchEnvironment(initialValue = '0') {
    const empty = new FakeWrapper('empty', 0);
    const select = new FakeWrapper('select').val(initialValue).attr('title', '原生字段说明');
    const label = new FakeWrapper('label');
    const description = new FakeWrapper('description');
    const field = new FakeWrapper('field');
    const insertions = [];

    field.find = (selector) => {
        if (selector === 'select') {
            return select;
        }
        if (selector === '.void-editor-field__label label') {
            return label;
        }
        if (selector === '.void-editor-field__label .void-editor-field__meta') {
            return description;
        }
        return empty;
    };
    select.after = (control) => {
        insertions.push(control);
        return select;
    };

    const scope = {
        find(selector) {
            return selector === '[data-void-field="showOutdated"]' ? field : empty;
        }
    };

    function jQuery(value) {
        if (value && value.wrapper) {
            return value.wrapper;
        }
        if (typeof value === 'string' && value.includes('void-switch-control')) {
            const button = new FakeWrapper('button');
            button.attr('type', 'button');
            button.attr('class', 'void-switch-control');
            button.attr('role', 'switch');
            return button;
        }
        throw new Error(`Unexpected jQuery value: ${String(value)}`);
    }

    jQuery.each = (values, callback) => {
        Object.keys(values).forEach((key) => callback(key, values[key]));
    };
    jQuery.trim = (value) => String(value).trim();

    const start = editorSource.indexOf('function initSwitchControls');
    const end = editorSource.indexOf('    function compactFieldDescriptions', start);
    assert.notEqual(start, -1, 'missing initSwitchControls');
    assert.notEqual(end, -1, 'missing compactFieldDescriptions');

    const context = {
        $: jQuery,
        VOID_SWITCH_FIELDS: {
            showOutdated: {
                label: '显示内容时效提醒',
                description: '启用后，当文章最后更新时间超过 90 天时，在正文顶部显示时效提醒。',
                onValue: '1',
                offValue: '0'
            }
        },
        normalizeDescription(value) {
            return String(value || '').trim().replace(/\s+/g, ' ');
        }
    };

    vm.runInNewContext(
        `${editorSource.slice(start, end)}\nthis.runSwitchInitializer = initSwitchControls;`,
        context
    );

    return {
        run: () => context.runSwitchInitializer(scope),
        select,
        label,
        description,
        field,
        insertions
    };
}

test('content freshness switch keeps its label and description', () => {
    const field = extract(editorSource, 'showOutdated: {', '        }\n    };');

    assert.match(field, /label:\s*'显示内容时效提醒'/);
    assert.match(field, /description:\s*'启用后，当文章最后更新时间超过 90 天时，在正文顶部显示时效提醒。'/);
    assert.match(field, /onValue:\s*'1'/);
    assert.match(field, /offValue:\s*'0'/);
});

test('generated switch exposes an accessible name and description', () => {
    const implementation = extract(editorSource, 'function initSwitchControls', '    function compactFieldDescriptions');

    assert.match(implementation, /<button type="button" class="void-switch-control" role="switch">/);
    assert.match(implementation, /aria-labelledby/);
    assert.match(implementation, /aria-describedby/);
    assert.match(implementation, /aria-label.*config\.label/);
    assert.match(implementation, /void-field-label-/);
    assert.match(implementation, /void-field-description-/);
});

test('switch interaction contracts remain synchronized with the native select', () => {
    const environment = createSwitchEnvironment();
    environment.run();

    assert.equal(environment.insertions.length, 1);
    const control = environment.insertions[0];
    assert.equal(control.attr('role'), 'switch');
    assert.equal(control.attr('aria-checked'), 'false');
    assert.equal(control.attr('aria-labelledby'), 'void-field-label-showOutdated');
    assert.equal(control.attr('aria-describedby'), 'void-field-description-showOutdated');
    assert.equal(environment.label.attr('id'), 'void-field-label-showOutdated');
    assert.equal(environment.description.attr('id'), 'void-field-description-showOutdated');

    control.trigger('click');
    assert.equal(environment.select.val(), '1');
    assert.equal(control.attr('aria-checked'), 'true');

    let prevented = false;
    control.trigger('keydown', {
        key: ' ',
        preventDefault() {
            prevented = true;
        }
    });
    assert.equal(prevented, true);
    assert.equal(environment.select.val(), '0');
    assert.equal(control.attr('aria-checked'), 'false');

    control.trigger('keydown', { key: 'Enter', preventDefault() {} });
    assert.equal(environment.select.val(), '1');
    assert.equal(control.attr('aria-checked'), 'true');

    environment.select.prop('disabled', true).trigger('change');
    assert.equal(control.prop('disabled'), true);
    control.trigger('click');
    assert.equal(environment.select.val(), '1');

    environment.run();
    assert.equal(environment.insertions.length, 1, 'repeated initialization must not duplicate the switch');
});

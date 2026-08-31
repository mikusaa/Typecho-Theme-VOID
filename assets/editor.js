/* eslint-disable no-unused-vars */

function insertAtCursor(myField, myValue) {
    var textTop = myField.scrollTop;
    var documentTop = document.documentElement.scrollTop;

    //IE 浏览器
    if (document.selection) {
        myField.focus();
        var sel = document.selection.createRange();
        sel.text = myValue;
        sel.select();
    }

    //FireFox、Chrome等
    else if (myField.selectionStart || myField.selectionStart == '0') {
        var startPos = myField.selectionStart;
        var endPos = myField.selectionEnd;
        myField.value = myField.value.substring(0, startPos) + myValue + myField.value.substring(endPos, myField.value.length);
        myField.focus();
        myField.selectionStart = startPos + myValue.length;
        myField.selectionEnd = startPos + myValue.length;
    } else {
        myField.value += myValue;
        myField.focus();
    }

    myField.scrollTop = textTop;
    document.documentElement.scrollTop=documentTop;
}

var VOID_Editor_Menu = (function ($) {
    var ALERT_TYPES = {
        NOTE: '说明',
        TIP: '提示',
        IMPORTANT: '重要',
        WARNING: '警告',
        CAUTION: '危险'
    };
    var MENU_ITEMS = [
        { action: 'photos', label: '图集', meta: '[photos]' },
        { action: 'emotes', label: '表情', meta: '选择器' },
        { alertType: 'NOTE', label: '说明', meta: 'NOTE' },
        { alertType: 'TIP', label: '提示', meta: 'TIP' },
        { alertType: 'IMPORTANT', label: '重要', meta: 'IMPORTANT' },
        { alertType: 'WARNING', label: '警告', meta: 'WARNING' },
        { alertType: 'CAUTION', label: '危险', meta: 'CAUTION' }
    ];
    var PHOTOS_TEMPLATE = '\n\n[photos]\n\n[/photos]\n\n';
    var PLACEHOLDER = '提示内容';
    var instance = null;

    function isSupportedType(type) {
        return Object.prototype.hasOwnProperty.call(ALERT_TYPES, type);
    }

    function createTemplate(type, selection, lineEnding) {
        var body;
        var lines;

        if (!isSupportedType(type)) {
            return null;
        }

        body = selection === undefined || selection === null || selection === ''
            ? PLACEHOLDER : String(selection);
        lineEnding = lineEnding || '\n';
        lines = body.split(/\r\n|\r|\n/);

        return '> [!' + type + ']' + lineEnding + lines.map(function (line) {
            return line === '' ? '>' : '> ' + line;
        }).join(lineEnding);
    }

    function detectLineEnding(value) {
        return /\r\n/.test(value) ? '\r\n' : '\n';
    }

    function getLeadingSeparator(value, lineEnding) {
        if (value === '') {
            return '';
        }
        if (/(?:\r\n|\r|\n)[ \t]*(?:\r\n|\r|\n)$/.test(value)) {
            return '';
        }
        return /(?:\r\n|\r|\n)$/.test(value) ? lineEnding : lineEnding + lineEnding;
    }

    function getTrailingSeparator(value, lineEnding) {
        if (value === '') {
            return '';
        }
        if (/^(?:\r\n|\r|\n)[ \t]*(?:\r\n|\r|\n)/.test(value)) {
            return '';
        }
        return /^(?:\r\n|\r|\n)/.test(value) ? lineEnding : lineEnding + lineEnding;
    }

    function applyTemplate(value, selectionStart, selectionEnd, type) {
        var source = String(value == null ? '' : value);
        var start = Math.max(0, Math.min(source.length, Number(selectionStart) || 0));
        var end = Math.max(start, Math.min(source.length, Number(selectionEnd) || 0));
        var selected = source.substring(start, end);
        var lineEnding = detectLineEnding(source);
        var template = createTemplate(type, selected, lineEnding);
        var before;
        var after;
        var leading;
        var trailing;
        var insertedStart;
        var nextValue;

        if (template === null) {
            return null;
        }

        before = source.substring(0, start);
        after = source.substring(end);
        leading = getLeadingSeparator(before, lineEnding);
        trailing = getTrailingSeparator(after, lineEnding);
        insertedStart = before.length + leading.length;
        nextValue = before + leading + template + trailing + after;

        if (selected === '') {
            start = insertedStart + template.indexOf(PLACEHOLDER);
            end = start + PLACEHOLDER.length;
        } else {
            start = insertedStart + template.length;
            end = start;
        }

        return {
            selectionEnd: end,
            selectionStart: start,
            value: nextValue
        };
    }

    function applyToField(field, type) {
        var result;

        if (!field || typeof field.selectionStart !== 'number'
            || typeof field.selectionEnd !== 'number') {
            return false;
        }

        result = applyTemplate(field.value, field.selectionStart, field.selectionEnd, type);
        if (result === null) {
            return false;
        }

        field.value = result.value;
        field.focus();
        field.setSelectionRange(result.selectionStart, result.selectionEnd);
        $(field).trigger('input');
        return true;
    }

    function insertPhotos(field) {
        if (!field) {
            return false;
        }
        insertAtCursor(field, PHOTOS_TEMPLATE);
        $(field).trigger('input');
        return true;
    }

    function createMenuItem(item) {
        var button = document.createElement('button');
        var icon = document.createElement('span');
        var label = document.createElement('span');
        var meta = document.createElement(item.alertType || item.action === 'photos' ? 'code' : 'span');
        var iconType = item.alertType ? item.alertType.toLowerCase() : item.action;

        button.type = 'button';
        button.setAttribute('role', 'menuitem');
        if (item.action) {
            button.setAttribute('data-void-action', item.action);
        }
        if (item.alertType) {
            button.setAttribute('data-alert-type', item.alertType);
        }

        icon.className = 'void-editor-menu__icon void-editor-menu__icon--' + iconType;
        icon.setAttribute('aria-hidden', 'true');
        label.className = 'void-editor-menu__item-label';
        label.textContent = item.label;
        meta.className = 'void-editor-menu__meta';
        meta.textContent = item.meta;

        button.appendChild(icon);
        button.appendChild(label);
        button.appendChild(meta);
        return button;
    }

    function createMenuLabel(text) {
        var label = document.createElement('span');
        label.className = 'void-editor-menu__label';
        label.textContent = text;
        return label;
    }

    function createToolbarMenu(toolbar) {
        var spacer = document.createElement('li');
        var wrapper = document.createElement('li');
        var trigger = document.createElement('button');
        var triggerLabel = document.createElement('span');
        var caret = document.createElement('span');
        var menu = document.createElement('div');
        var separator = document.createElement('span');

        spacer.className = 'wmd-spacer wmd-spacer1 void-editor-menu-spacer';
        spacer.id = 'void-editor-menu-spacer';

        wrapper.className = 'wmd-button void-editor-menu';
        wrapper.id = 'wmd-void-button';

        trigger.type = 'button';
        trigger.className = 'void-editor-menu__trigger';
        trigger.id = 'void-editor-menu-trigger';
        trigger.setAttribute('aria-label', '插入 VOID 扩展语法');
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-controls', 'void-editor-menu');
        triggerLabel.textContent = 'VOID';
        caret.className = 'void-editor-menu__caret';
        caret.setAttribute('aria-hidden', 'true');
        trigger.appendChild(triggerLabel);
        trigger.appendChild(caret);

        menu.className = 'void-editor-menu__popup';
        menu.id = 'void-editor-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'VOID 扩展语法');
        menu.hidden = true;
        menu.appendChild(createMenuLabel('内容块'));
        menu.appendChild(createMenuItem(MENU_ITEMS[0]));
        menu.appendChild(createMenuItem(MENU_ITEMS[1]));
        separator.className = 'void-editor-menu__separator';
        separator.setAttribute('aria-hidden', 'true');
        menu.appendChild(separator);
        menu.appendChild(createMenuLabel('提示块'));
        MENU_ITEMS.slice(2).forEach(function (item) {
            menu.appendChild(createMenuItem(item));
        });

        wrapper.appendChild(trigger);
        wrapper.appendChild(menu);
        toolbar.appendChild(spacer);
        toolbar.appendChild(wrapper);
        return wrapper;
    }

    function init() {
        var toolbar = document.getElementById('wmd-button-row');
        var field = document.getElementById('text');
        var wrapper;
        var trigger;
        var menu;
        var host = null;
        var picker = null;
        var listeners = [];
        var controller;

        if (!toolbar || !field) {
            return null;
        }
        if (instance && instance.toolbar === toolbar && instance.field === field) {
            return instance;
        }
        if (instance) {
            instance.destroy();
        }

        wrapper = document.getElementById('wmd-void-button');
        if (!wrapper) {
            wrapper = createToolbarMenu(toolbar);
        }

        trigger = wrapper.querySelector('.void-editor-menu__trigger');
        menu = wrapper.querySelector('.void-editor-menu__popup');
        if (!trigger || !menu) {
            return null;
        }

        function listen(element, eventName, handler) {
            element.addEventListener(eventName, handler);
            listeners.push([element, eventName, handler]);
        }

        function getItems() {
            return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'));
        }

        function syncTrigger(popup) {
            var isMenu = popup === 'menu';
            var isEmotes = popup === 'emotes' && picker;
            trigger.setAttribute('aria-haspopup', isEmotes ? 'dialog' : 'menu');
            trigger.setAttribute('aria-controls', isEmotes ? picker.panel.id : menu.id);
            trigger.setAttribute('aria-expanded', isMenu || isEmotes ? 'true' : 'false');
            trigger.setAttribute('aria-label', isEmotes
                ? '关闭表情选择器'
                : (isMenu ? '关闭 VOID 扩展菜单' : '插入 VOID 扩展语法'));
        }

        function closeMenu(restoreFocus) {
            menu.hidden = true;
            if (!picker || !picker.isOpen) {
                syncTrigger(null);
            }
            if (restoreFocus) {
                trigger.focus();
            }
        }

        function openMenu(focusIndex) {
            var items = getItems();
            if (picker && picker.isOpen) {
                picker.close();
            }
            menu.hidden = false;
            syncTrigger('menu');
            if (typeof focusIndex === 'number' && items.length) {
                items[(focusIndex + items.length) % items.length].focus();
            }
        }

        function moveItemFocus(current, direction) {
            var items = getItems();
            var index = items.indexOf(current);
            if (index !== -1 && items.length) {
                items[(index + direction + items.length) % items.length].focus();
            }
        }

        function ensureEmotePicker() {
            if (picker && !picker.destroyed) {
                return picker;
            }
            if (!window.VoidEmotes || typeof window.VoidEmotes.mount !== 'function') {
                return null;
            }

            host = document.getElementById('void-editor-emotes');
            if (!host) {
                host = document.createElement('div');
                host.id = 'void-editor-emotes';
                document.body.appendChild(host);
            }
            host.setAttribute('data-trigger', trigger.id);
            picker = window.VoidEmotes.mount({
                container: host,
                target: field,
                trigger: trigger,
                mode: 'popover',
                manualTrigger: true,
                onOpen: function () {
                    menu.hidden = true;
                    syncTrigger('emotes');
                },
                onClose: function () {
                    syncTrigger(menu.hidden ? null : 'menu');
                }
            });
            return picker;
        }

        function openEmotes() {
            var emotes = ensureEmotePicker();
            if (!emotes) {
                closeMenu(true);
                return;
            }
            closeMenu(false);
            emotes.open();
            if (emotes.closeButton) {
                emotes.closeButton.focus();
            }
        }

        listen(trigger, 'click', function () {
            if (picker && picker.isOpen) {
                openMenu();
            } else if (menu.hidden) {
                openMenu();
            } else {
                closeMenu(false);
            }
        });
        listen(trigger, 'keydown', function (event) {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                openMenu(event.key === 'ArrowDown' ? 0 : -1);
            } else if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (menu.hidden) {
                    openMenu(0);
                } else {
                    closeMenu(false);
                }
            } else if (event.key === 'Escape' && (!menu.hidden || (picker && picker.isOpen))) {
                event.preventDefault();
                if (picker && picker.isOpen) {
                    picker.close();
                }
                closeMenu(true);
            }
        });

        getItems().forEach(function (item) {
            listen(item, 'click', function () {
                var action = item.getAttribute('data-void-action');
                if (action === 'emotes') {
                    openEmotes();
                } else if ((action === 'photos' && insertPhotos(field))
                    || applyToField(field, item.getAttribute('data-alert-type'))) {
                    closeMenu(false);
                }
            });
            listen(item, 'keydown', function (event) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    moveItemFocus(item, event.key === 'ArrowDown' ? 1 : -1);
                } else if (event.key === 'Home' || event.key === 'End') {
                    event.preventDefault();
                    openMenu(event.key === 'Home' ? 0 : -1);
                } else if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    item.click();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    closeMenu(true);
                } else if (event.key === 'Tab') {
                    closeMenu(false);
                }
            });
        });

        listen(document, 'mousedown', function (event) {
            if (event.target === wrapper || wrapper.contains(event.target)
                || (host && (event.target === host || host.contains(event.target)))) {
                return;
            }
            if (picker && picker.isOpen) {
                picker.close();
            }
            if (!menu.hidden) {
                closeMenu(false);
            }
        });

        controller = {
            field: field,
            toolbar: toolbar,
            get picker() {
                return picker;
            },
            destroy: function () {
                if (instance !== controller) {
                    return;
                }
                listeners.forEach(function (listener) {
                    listener[0].removeEventListener(listener[1], listener[2]);
                });
                listeners = [];
                if (picker && !picker.destroyed) {
                    picker.destroy();
                }
                picker = null;
                if (host && host.parentNode) {
                    host.parentNode.removeChild(host);
                }
                host = null;
                closeMenu(false);
                instance = null;
            }
        };
        instance = controller;
        ensureEmotePicker();
        return controller;
    }

    return {
        __test: {
            applyTemplate: applyTemplate,
            createTemplate: createTemplate,
            insertPhotos: insertPhotos,
            menuItems: MENU_ITEMS,
            photosTemplate: PHOTOS_TEMPLATE
        },
        init: init
    };
})(window.jQuery);

function initEditorToolbar() {
    if (window.VOID_Editor_Menu && typeof window.VOID_Editor_Menu.init === 'function') {
        window.VOID_Editor_Menu.init();
    }
}

var VOID_BannerMeta = (function ($) {
    var MAX_DIMENSION = 100000;
    var PROBE_DELAY = 300;
    var instance = null;

    function normalizeSource(value) {
        return String(value == null ? '' : value).trim();
    }

    function parseDimension(value) {
        var text = String(value == null ? '' : value);
        var number;

        if (!/^[1-9][0-9]*$/.test(text)) {
            return null;
        }

        number = Number(text);
        return number >= 1 && number <= MAX_DIMENSION && Math.floor(number) === number
            ? number
            : null;
    }

    function parseMeta(value, source) {
        var meta;
        var width;
        var height;

        try {
            meta = JSON.parse(String(value || ''));
        } catch (error) {
            return null;
        }

        if (!meta || meta.version !== 1 || typeof meta.source !== 'string'
            || meta.source !== normalizeSource(source)) {
            return null;
        }

        width = typeof meta.width === 'number' ? parseDimension(meta.width) : null;
        height = typeof meta.height === 'number' ? parseDimension(meta.height) : null;
        return width && height ? [width, height] : null;
    }

    function serializeMeta(source, width, height) {
        return JSON.stringify({
            version: 1,
            source: normalizeSource(source),
            width: width,
            height: height
        });
    }

    function init() {
        var $banner = $('[name="fields[banner]"], [name="banner"]').first();
        var $meta = $('[name="fields[bannerMeta]"], [name="bannerMeta"]').first();
        var probeTimer = null;
        var probeImage = null;
        var probeToken = 0;
        var controller;

        if (instance || !$banner.length || !$meta.length) {
            return instance;
        }

        function setMeta(source, width, height) {
            var normalizedSource = normalizeSource(source);
            var serialized;

            if (!normalizedSource || normalizeSource($banner.val()) !== normalizedSource
                || !parseDimension(width) || !parseDimension(height)) {
                return false;
            }

            serialized = serializeMeta(normalizedSource, Number(width), Number(height));
            if ($meta.val() === serialized) {
                return false;
            }

            $meta.val(serialized).trigger('input').trigger('change');
            return true;
        }

        function clearMeta() {
            if ($meta.val() === '') {
                return false;
            }

            $meta.val('').trigger('input').trigger('change');
            return true;
        }

        function clearStaleMeta() {
            var source = normalizeSource($banner.val());

            if ($meta.val() !== '' && (!source || !parseMeta($meta.val(), source))) {
                clearMeta();
            }
        }

        function cancelProbe() {
            probeToken++;
            if (probeTimer !== null) {
                window.clearTimeout(probeTimer);
                probeTimer = null;
            }
            if (probeImage) {
                probeImage.onload = null;
                probeImage.onerror = null;
                probeImage = null;
            }
        }

        function startProbe(source, token) {
            var image;

            probeTimer = null;
            if (token !== probeToken || normalizeSource($banner.val()) !== source) {
                return;
            }

            image = new window.Image();
            probeImage = image;

            function finish(succeeded) {
                if (token !== probeToken || probeImage !== image) {
                    return;
                }

                probeImage = null;
                image.onload = null;
                image.onerror = null;
                if (succeeded) {
                    setMeta(source, image.naturalWidth, image.naturalHeight);
                }
            }

            image.onload = function () {
                finish(true);
            };
            image.onerror = function () {
                finish(false);
            };
            image.src = source;

            if (image.complete) {
                finish(image.naturalWidth > 0 && image.naturalHeight > 0);
            }
        }

        function scheduleProbe() {
            var source;
            var token;

            cancelProbe();
            clearStaleMeta();
            source = normalizeSource($banner.val());
            if (!source || parseMeta($meta.val(), source) || typeof window.Image !== 'function') {
                return false;
            }

            token = probeToken;
            probeTimer = window.setTimeout(function () {
                startProbe(source, token);
            }, PROBE_DELAY);
            return true;
        }

        controller = {
            destroy: function () {
                if (instance !== controller) {
                    return;
                }

                cancelProbe();
                $banner.off('.voidBannerMeta');
                instance = null;
            }
        };

        instance = controller;
        $banner.on('input.voidBannerMeta change.voidBannerMeta', scheduleProbe);
        scheduleProbe();
        return controller;
    }

    return {
        __test: {
            parseMeta: parseMeta,
            serializeMeta: serializeMeta
        },
        init: init
    };
})(window.jQuery);

var VOID_Editor_Admin = (function ($) {
    var VOID_FIELD_GROUPS = [
        {
            key: 'media',
            title: '摘要与主图',
            description: '设置首页摘要与主图。',
            full: true,
            fields: ['excerpt', 'banner', 'bannerSource', 'bannerStyle', 'bannerascover']
        },
        {
            key: 'behavior',
            title: '展示行为',
            description: '控制首页展示方式与文章目录。',
            full: true,
            fields: ['posttype', 'showOutdated', 'showfullcontent', 'showTOC']
        }
    ];
    var VOID_SEGMENTED_FIELDS = {
        bannerStyle: {
            labels: {
                0: '正常顶部',
                1: '顶部模糊',
                2: '不显示'
            }
        },
        bannerascover: {
            labels: {
                1: '标题上方',
                2: '标题背景',
                0: '不显示'
            }
        },
        posttype: {
            labels: {
                0: '一般文章',
                1: '封面文章'
            }
        }
    };
    var VOID_SWITCH_FIELDS = {
        showTOC: {
            label: '显示文章目录',
            description: '在文章详情页侧边栏显示',
            onValue: '1',
            offValue: '0'
        },
        showfullcontent: {
            label: '首页显示完整内容',
            description: '卡片将直接展示文章全文',
            onValue: '1',
            offValue: '0'
        },
        showOutdated: {
            label: '显示过时提示',
            description: '在文章正文顶部显示过时提醒',
            onValue: '1',
            offValue: '0'
        }
    };

    function init() {
        var $panel = buildVoidFieldPanel();
        if ($panel && $panel.length) {
            compactFieldDescriptions($panel);
            initBehaviorFieldLayout($panel);
            initSegmentedSelects($panel);
            initSwitchControls($panel);
            initMediaFieldLayout($panel);
        }
    }

    function buildVoidFieldPanel() {
        var $customField = $('#custom-field');
        if (!$customField.length || $('#void-editor-fields').length) {
            return null;
        }

        preserveHiddenMetadataField($customField, 'bannerMeta');

        var collectedGroups = [];
        var movedCount = 0;

        $.each(VOID_FIELD_GROUPS, function (_, group) {
            var $groupFields = $();

            $.each(group.fields, function (_, fieldName) {
                var $field = extractVoidField($customField, fieldName);
                if ($field && $field.length) {
                    $groupFields = $groupFields.add($field);
                    movedCount++;
                }
            });

            if ($groupFields.length) {
                collectedGroups.push({
                    config: group,
                    fields: $groupFields
                });
            }
        });

        if (!movedCount) {
            return null;
        }

        var $panel = $(
            '<section id="void-editor-fields" class="void-editor-fields typecho-post-option">' +
            '  <header class="void-editor-fields__header">' +
            '    <h3 class="void-editor-fields__title">VOID 扩展字段</h3>' +
            '    <p class="void-editor-fields__description">仅管理 VOID 主题使用的字段，其他自定义字段仍保留在原生「自定义字段」中。</p>' +
            '  </header>' +
            '  <div class="void-editor-fields__grid"></div>' +
            '</section>'
        );
        var $grid = $panel.find('.void-editor-fields__grid');

        $.each(collectedGroups, function (_, groupData) {
            var groupClass = 'void-editor-fields__group';
            if (groupData.config.full) {
                groupClass += ' void-editor-fields__group--full';
            }

            var $group = $(
                '<section class="' + groupClass + '" data-group="' + groupData.config.key + '">' +
                '  <div class="void-editor-fields__group-header">' +
                '    <h4 class="void-editor-fields__group-title">' + groupData.config.title + '</h4>' +
                '    <p class="void-editor-fields__group-description">' + groupData.config.description + '</p>' +
                '  </div>' +
                '  <div class="void-editor-fields__group-body"></div>' +
                '</section>'
            );

            $group.find('.void-editor-fields__group-body').append(groupData.fields);
            $grid.append($group);
        });

        $customField.before($panel);
        cleanupCustomField($customField);
        return $panel;
    }

    function preserveHiddenMetadataField($customField, fieldName) {
        var $control = $customField
            .find('[name="fields[' + fieldName + ']"], [name="' + fieldName + '"]')
            .first();
        var $row;

        if (!$control.length) {
            return;
        }

        $row = $control.closest('li.field, tr');
        if (!$row.length) {
            return;
        }

        $control.detach();
        $customField.before($control);
        $row.remove();
    }

    function extractVoidField($customField, fieldName) {
        var $control = $customField.find('[name="fields[' + fieldName + ']"], [name="' + fieldName + '"]').first();
        if (!$control.length) {
            return null;
        }

        var $row = $control.closest('li.field, tr');
        if (!$row.length || $row.data('voidFieldMoved')) {
            return null;
        }

        var $labelSource;
        var $valueSource;
        if ($row.is('li')) {
            $labelSource = $row.children('.field-name').first();
            $valueSource = $row.children('.field-value').first();
        } else {
            var $cells = $row.children('td');
            $labelSource = $cells.eq(0);
            $valueSource = $cells.eq(1);
        }

        if (!$labelSource.length || !$valueSource.length) {
            return null;
        }

        var $field = $('<section class="void-editor-field" data-void-field="' + fieldName + '"></section>');
        var $label = $('<div class="void-editor-field__label"></div>');
        var $controlWrap = $('<div class="void-editor-field__control"></div>');
        var $contentSource = unwrapTypechoFieldValue($valueSource);

        $label.append($labelSource.contents());
        $controlWrap.append($contentSource.contents());
        $field.append($label).append($controlWrap);

        $row.data('voidFieldMoved', true).remove();
        return $field;
    }

    function unwrapTypechoFieldValue($valueSource) {
        if (
            $valueSource.children().length === 1 &&
            $valueSource.children().eq(0).is('div') &&
            !$valueSource.children().eq(0).attr('class')
        ) {
            return $valueSource.children().eq(0);
        }

        return $valueSource;
    }

    function cleanupCustomField($customField) {
        var $list = $customField.children('.fields');
        if ($list.length && !$list.children().length) {
            $list.remove();
        }

        var $table = $customField.children('table.typecho-list-table');
        if ($table.length && !$table.find('tr').length) {
            $table.remove();
        }
    }

    function initBehaviorFieldLayout($scope) {
        var $groupBody = $scope.find('[data-group="behavior"] .void-editor-fields__group-body').first();
        if (!$groupBody.length || $groupBody.data('voidBehaviorLayoutReady')) {
            return;
        }

        var $postTypeField = $groupBody.find('[data-void-field="posttype"]').first();
        var $tocField = $groupBody.find('[data-void-field="showTOC"]').first();
        var $fullContentField = $groupBody.find('[data-void-field="showfullcontent"]').first();
        var $outdatedField = $groupBody.find('[data-void-field="showOutdated"]').first();

        if (!$postTypeField.length && !$tocField.length && !$fullContentField.length && !$outdatedField.length) {
            return;
        }

        if ($postTypeField.length) {
            $postTypeField.addClass('void-editor-field--behavior-type');
            applyFieldCopy($postTypeField, {
                label: '文章类型'
            });
        }

        if ($tocField.length) {
            $tocField.addClass('void-editor-field--switch');
            applyFieldCopy($tocField, VOID_SWITCH_FIELDS.showTOC);
        }

        if ($fullContentField.length) {
            $fullContentField.addClass('void-editor-field--switch');
            applyFieldCopy($fullContentField, VOID_SWITCH_FIELDS.showfullcontent);
        }

        if ($outdatedField.length) {
            $outdatedField.addClass('void-editor-field--switch');
            applyFieldCopy($outdatedField, VOID_SWITCH_FIELDS.showOutdated);
        }

        if ($postTypeField.length) {
            $groupBody.append($postTypeField);
        }
        if ($outdatedField.length) {
            $groupBody.append($outdatedField);
        }
        if ($tocField.length) {
            $groupBody.append($tocField);
        }
        if ($fullContentField.length) {
            $groupBody.append($fullContentField);
        }

        $groupBody.data('voidBehaviorLayoutReady', true);
    }

    function initMediaFieldLayout($scope) {
        var $groupBody = $scope.find('[data-group="media"] .void-editor-fields__group-body').first();
        var $bannerControl = findFieldControl($scope, 'banner');
        var $targets = $();
        var visibilityState = null;
        var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

        if (!$groupBody.length || !$bannerControl.length || $groupBody.data('voidMediaLayoutReady')) {
            return;
        }

        $.each(['bannerSource', 'bannerStyle', 'bannerascover'], function (_, fieldName) {
            var $field = $groupBody.find('[data-void-field="' + fieldName + '"]').first();

            if ($field.length) {
                $targets = $targets.add($field.addClass('void-editor-media-dependent'));
            }
        });

        if (!$targets.length) {
            return;
        }

        function toggleDependent($target, shouldShow, skipAnimation) {
            var duration = !skipAnimation && !(motionQuery && motionQuery.matches) ? 180 : 0;

            $target.stop(true, true);
            $target.attr('aria-hidden', shouldShow ? 'false' : 'true');

            if (!duration) {
                $target.prop('hidden', !shouldShow).css({
                    opacity: '',
                    display: '',
                    height: '',
                    overflow: ''
                });
                return;
            }

            if (shouldShow) {
                $target.prop('hidden', false);
                $target
                    .css('opacity', 0)
                    .hide()
                    .slideDown(duration)
                    .animate(
                        { opacity: 1 },
                        {
                            duration: duration,
                            queue: false,
                            complete: function () {
                                $target.css({
                                    opacity: '',
                                    display: '',
                                    height: '',
                                    overflow: ''
                                });
                            }
                        }
                    );
                return;
            }

            $target.animate({ opacity: 0 }, { duration: duration, queue: false });
            $target.slideUp(duration, function () {
                $target.prop('hidden', true).css({
                    opacity: '',
                    display: '',
                    height: '',
                    overflow: ''
                });
            });
        }

        function syncMediaDependents() {
            var shouldShow = normalizeDescription($bannerControl.val()) !== '';
            var isInitialSync = visibilityState === null;

            if (shouldShow === visibilityState) {
                return;
            }

            visibilityState = shouldShow;

            $targets.each(function () {
                toggleDependent($(this), shouldShow, isInitialSync);
            });

        }

        $bannerControl.on('input.voidMediaLayout change.voidMediaLayout', syncMediaDependents);
        syncMediaDependents();
        $groupBody.data('voidMediaLayoutReady', true);
    }

    function applyFieldCopy($field, copy) {
        var $labelWrap = $field.find('.void-editor-field__label').first();
        if (!$labelWrap.length || !copy) {
            return;
        }

        var labelText = normalizeDescription(copy.label);
        var descriptionText = normalizeDescription(copy.description);

        $labelWrap.empty();
        if (labelText) {
            $labelWrap.append($('<label class="typecho-label"></label>').text(labelText));
        }
        if (descriptionText) {
            $labelWrap.append($('<p class="void-editor-field__meta"></p>').text(descriptionText));
        }
    }

    function initSegmentedSelects($scope) {
        $.each(VOID_SEGMENTED_FIELDS, function (fieldName, config) {
            var $field = $scope.find('[data-void-field="' + fieldName + '"]').first();
            var $select = $field.find('select').first();

            if (!$field.length || !$select.length || $field.data('voidSegmentedReady')) {
                return;
            }

            var $options = $select.find('option');
            if ($options.length < 2) {
                return;
            }

            var fieldLabel = normalizeDescription($field.find('.void-editor-field__label').text()) || '选项';
            var controlTitle = normalizeDescription($select.attr('title'));
            var $segmentedControl = $('<div class="void-segmented-control" role="radiogroup"></div>');

            $segmentedControl.attr('aria-label', fieldLabel);
            $segmentedControl.css('--void-segment-count', String($options.length));

            if (controlTitle) {
                $segmentedControl.attr('title', controlTitle);
            }

            $options.each(function () {
                var $option = $(this);
                var optionValue = String($option.attr('value'));
                var optionLabel = getSegmentedOptionLabel(config, optionValue, $option.text());
                var $button = $('<button type="button" class="void-segmented-control__item" role="radio"></button>');

                $button.attr('data-value', optionValue).text(optionLabel);
                if (controlTitle) {
                    $button.attr('title', controlTitle);
                }

                $segmentedControl.append($button);
            });

            $select.after($segmentedControl);
            $field.addClass('void-editor-field--segmented').data('voidSegmentedReady', true);

            function syncSegmentedControl() {
                var currentValue = String($select.val());
                var isDisabled = $select.prop('disabled');

                $segmentedControl.attr('aria-disabled', isDisabled ? 'true' : 'false');
                $segmentedControl.find('.void-segmented-control__item').each(function () {
                    var $button = $(this);
                    var isActive = $button.attr('data-value') === currentValue;

                    $button.toggleClass('is-active', isActive);
                    $button.attr('aria-checked', isActive ? 'true' : 'false');
                    $button.attr('tabindex', isActive ? '0' : '-1');
                    $button.prop('disabled', isDisabled);
                });
            }

            $segmentedControl.on('click', '.void-segmented-control__item', function () {
                var nextValue = $(this).attr('data-value');
                if ($select.prop('disabled')) {
                    return;
                }

                if (String($select.val()) !== nextValue) {
                    $select.val(nextValue).trigger('change');
                    return;
                }

                syncSegmentedControl();
            });

            $segmentedControl.on('keydown', '.void-segmented-control__item', function (event) {
                var supportedKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
                if ($.inArray(event.key, supportedKeys) === -1) {
                    return;
                }

                event.preventDefault();

                var $buttons = $segmentedControl.find('.void-segmented-control__item:not(:disabled)');
                var currentIndex = $buttons.index(this);
                var nextIndex = currentIndex;

                if (!$buttons.length) {
                    return;
                }

                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                    nextIndex = currentIndex <= 0 ? $buttons.length - 1 : currentIndex - 1;
                } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                    nextIndex = currentIndex >= $buttons.length - 1 ? 0 : currentIndex + 1;
                } else if (event.key === 'Home') {
                    nextIndex = 0;
                } else if (event.key === 'End') {
                    nextIndex = $buttons.length - 1;
                }

                $buttons.eq(nextIndex).focus().trigger('click');
            });

            $select.on('change.voidSegmentedControl', syncSegmentedControl);
            syncSegmentedControl();
        });
    }

    function initSwitchControls($scope) {
        $.each(VOID_SWITCH_FIELDS, function (fieldName, config) {
            var $field = $scope.find('[data-void-field="' + fieldName + '"]').first();
            var $select = $field.find('select').first();
            var controlTitle = normalizeDescription($select.attr('title'));
            var onValue = String(config.onValue || '1');
            var offValue = String(config.offValue || '0');
            var $switchControl;

            if (!$field.length || !$select.length || $field.data('voidSwitchReady')) {
                return;
            }

            $switchControl = $(
                '<button type="button" class="void-switch-control" role="switch">' +
                '  <span class="void-switch-control__thumb" aria-hidden="true"></span>' +
                '</button>'
            );

            if (controlTitle) {
                $switchControl.attr('title', controlTitle);
            }

            $select.after($switchControl);
            $field.addClass('void-editor-field--switch-ready').data('voidSwitchReady', true);

            function syncSwitchControl() {
                var isChecked = String($select.val()) === onValue;
                var isDisabled = $select.prop('disabled');

                $switchControl.toggleClass('is-on', isChecked);
                $switchControl.attr('aria-checked', isChecked ? 'true' : 'false');
                $switchControl.prop('disabled', isDisabled);
            }

            $switchControl.on('click', function () {
                var nextValue;
                if ($select.prop('disabled')) {
                    return;
                }

                nextValue = String($select.val()) === onValue ? offValue : onValue;
                $select.val(nextValue).trigger('change');
            });

            $switchControl.on('keydown', function (event) {
                if (event.key !== ' ' && event.key !== 'Enter') {
                    return;
                }

                event.preventDefault();
                $(this).trigger('click');
            });

            $select.on('change.voidSwitchControl', syncSwitchControl);
            syncSwitchControl();
        });
    }

    function compactFieldDescriptions($scope) {
        $scope.find('.void-editor-field').each(function () {
            var $field = $(this);
            var $controlWrap = $field.find('.void-editor-field__control').first();
            var $description = $controlWrap.find('.description').first();
            if (!$description.length) {
                return;
            }

            var descriptionText = normalizeDescription($description.text());
            var $textControl = $controlWrap.find('textarea, input[type="text"], input[type="url"], input.text').first();
            var $selectControl = $controlWrap.find('select').first();

            if (!descriptionText) {
                $description.remove();
                return;
            }

            if ($textControl.length) {
                if (!$textControl.attr('placeholder')) {
                    $textControl.attr('placeholder', descriptionText);
                }
                $textControl.attr('title', descriptionText);
            } else if ($selectControl.length) {
                $selectControl.attr('title', descriptionText);
            }

            $description.remove();
        });
    }

    function normalizeDescription(text) {
        return $.trim(String(text || '').replace(/\s+/g, ' '));
    }

    function getSegmentedOptionLabel(config, value, fallbackLabel) {
        if (
            config &&
            config.labels &&
            Object.prototype.hasOwnProperty.call(config.labels, value)
        ) {
            return config.labels[value];
        }

        return normalizeDescription(fallbackLabel);
    }

    function findFieldControl($scope, fieldName) {
        var $field = $scope.find('[data-void-field="' + fieldName + '"]').first();
        if (!$field.length) {
            return $();
        }

        return $field.find('input, textarea, select').first();
    }

    return {
        init: init
    };
})(window.jQuery);

$(function () {
    initEditorToolbar();

    if (window.VOID_BannerMeta && typeof window.VOID_BannerMeta.init === 'function') {
        window.VOID_BannerMeta.init();
    }

    if (window.VOID_Editor_Admin && typeof window.VOID_Editor_Admin.init === 'function') {
        window.VOID_Editor_Admin.init();
    }
});

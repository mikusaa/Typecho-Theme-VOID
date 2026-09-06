/* exported VOID_Editor_Menu, initEditorToolbar */

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
        var textTop;
        var documentTop;

        if (!field || typeof field.selectionStart !== 'number'
            || typeof field.selectionEnd !== 'number') {
            return false;
        }

        result = applyTemplate(field.value, field.selectionStart, field.selectionEnd, type);
        if (result === null) {
            return false;
        }

        textTop = field.scrollTop;
        documentTop = document.documentElement.scrollTop;
        field.value = result.value;
        try {
            field.focus({ preventScroll: true });
        } catch (error) {
            field.focus();
        }
        field.setSelectionRange(result.selectionStart, result.selectionEnd);
        field.scrollTop = textTop;
        document.documentElement.scrollTop = documentTop;
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

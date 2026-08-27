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

function initEditorToolbar() {
    if ($('#wmd-button-row').length > 0) {
        $('#wmd-button-row').append('<li class="wmd-spacer wmd-spacer1"></li><li class="wmd-button" id="wmd-photoset-button" style="" title="插入图集">图集</li>');
        $('#wmd-button-row').append('<li class="wmd-spacer wmd-spacer1"></li><li class="wmd-button" id="wmd-emotes-button"><button type="button" id="void-editor-emotes-trigger" class="void-editor-emotes-trigger" title="插入表情" aria-label="打开表情选择器">☺</button></li>');

        if (window.VoidEmotes && document.getElementById('text')) {
            var host = document.createElement('div');
            host.id = 'void-editor-emotes';
            host.setAttribute('data-trigger', 'void-editor-emotes-trigger');
            document.body.appendChild(host);
            window.VoidEmotes.mount({
                container: host,
                target: document.getElementById('text'),
                mode: 'popover'
            });
        }
    }

    $(document).on('click', '#wmd-photoset-button', function () {
        var myField = document.getElementById('text');
        insertAtCursor(myField, '\n\n[photos]\n\n[/photos]\n\n');
    });
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

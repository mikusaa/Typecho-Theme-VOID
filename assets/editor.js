/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */

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
        $('#wmd-button-row').append('<li class="wmd-spacer wmd-spacer1"></li><li class="wmd-button" id="wmd-owo-button" style="" title="插入表情"><span style="width:unset" class="OwO"></span></li>');
        new OwO({
            logo: 'OωO',
            container: document.getElementsByClassName('OwO')[0],
            target: document.getElementById('text'),
            api: '/usr/themes/VOID/assets/libs/owo/OwO_01.json',
            position: 'down',
            width: '400px',
            maxHeight: '250px'
        });
    }

    $(document).on('click', '#wmd-photoset-button', function () {
        var myField = document.getElementById('text');
        insertAtCursor(myField, '\n\n[photos]\n\n[/photos]\n\n');
    });
}

var VOID_Editor_Admin = (function ($) {
    var VOID_FIELD_GROUPS = [
        {
            key: 'media',
            title: '摘要、主图与预览',
            description: '设置首页摘要、主图与卡片效果。',
            full: true,
            fields: ['excerpt', 'banner', 'bannerStyle', 'bannerascover']
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
            initPostCardPreview($panel);
        }
    }

    function buildVoidFieldPanel() {
        var $customField = $('#custom-field');
        if (!$customField.length || $('#void-editor-fields').length) {
            return null;
        }

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

    function initPostCardPreview($scope) {
        var $mediaGroup = $scope.find('[data-group="media"] .void-editor-fields__group-body').first();
        if (!$mediaGroup.length || $mediaGroup.data('voidPostPreviewReady')) {
            return;
        }

        var controls = {
            title: $('#title').first(),
            content: $('#text').first(),
            excerpt: findFieldControl($scope, 'excerpt'),
            banner: findFieldControl($scope, 'banner'),
            bannerAsCover: findFieldControl($scope, 'bannerascover'),
            showFullContent: findFieldControl($scope, 'showfullcontent')
        };

        if (!controls.banner.length) {
            return;
        }

        $mediaGroup.data('voidPostPreviewReady', true);
        $mediaGroup.append([
            '<details class="void-post-preview">',
            '  <summary>',
            '    <span class="void-post-preview__title">首页卡片预览</span>',
            '    <span class="void-post-preview__tip">展开查看效果</span>',
            '  </summary>',
            '  <div class="void-post-preview__body">',
            '    <div class="void-post-preview__badges">',
            '      <span class="void-post-preview__badge" data-role="index-mode"></span>',
            '      <span class="void-post-preview__badge" data-role="list-banner"></span>',
            '      <span class="void-post-preview__badge" data-role="excerpt-mode"></span>',
            '    </div>',
            '    <p class="void-post-preview__status" data-state="idle"></p>',
            '    <div class="void-post-preview__scenes">',
            '      <section class="void-post-preview__scene">',
            '        <div class="void-index-stage void-index-stage--desktop">',
            '          <article class="void-home-preview-card void-home-preview-card--desktop" data-list-style="0">',
            '            <div class="void-home-preview-card__banner" hidden>',
            '              <img class="void-home-preview-card__image" alt="首页卡片主图预览" referrerpolicy="no-referrer">',
            '            </div>',
            '            <div class="void-home-preview-card__content">',
            '              <div class="void-home-preview-card__meta">PREVIEW</div>',
            '              <h1 class="void-home-preview-card__title">未填写标题</h1>',
            '              <p class="void-home-preview-card__headline" hidden></p>',
            '              <div class="void-home-preview-card__article-body" hidden>',
            '                <p class="void-home-preview-card__body-text"></p>',
            '              </div>',
            '            </div>',
            '          </article>',
            '        </div>',
            '      </section>',
            '    </div>',
            '  </div>',
            '</details>'
        ].join(''));

        var $preview = $mediaGroup.find('.void-post-preview').last();
        var $status = $preview.find('.void-post-preview__status');
        var $indexModeBadge = $preview.find('[data-role="index-mode"]');
        var $listBannerBadge = $preview.find('[data-role="list-banner"]');
        var $excerptModeBadge = $preview.find('[data-role="excerpt-mode"]');
        var updateTimer = null;
        var currentCardUrl = '';
        var cardVariants = [
            {
                key: 'desktop',
                autoExcerptLimit: 80,
                fullContentLimit: 200,
                refs: collectCardRefs($preview.find('.void-home-preview-card--desktop').first())
            }
        ];

        function setStatus(text, state) {
            $status.text(text).attr('data-state', state);
        }

        function collectCardRefs($root) {
            return {
                root: $root,
                banner: $root.find('.void-home-preview-card__banner').first(),
                image: $root.find('.void-home-preview-card__image').first(),
                title: $root.find('.void-home-preview-card__title').first(),
                headline: $root.find('.void-home-preview-card__headline').first(),
                body: $root.find('.void-home-preview-card__article-body').first(),
                bodyText: $root.find('.void-home-preview-card__body-text').first()
            };
        }

        function resetCardImage(refs) {
            refs.banner.removeClass('is-loading is-error');
            refs.image.removeAttr('data-void-preview-url');
            refs.image.removeAttr('src');
        }

        function getCardImageState(refs, url) {
            var imageEl = refs.image.get(0);

            if (!imageEl || !url || refs.image.attr('data-void-preview-url') !== url || !refs.image.attr('src')) {
                return 'idle';
            }

            if (refs.banner.hasClass('is-error')) {
                return 'error';
            }

            if (imageEl.complete) {
                return imageEl.naturalWidth > 0 ? 'loaded' : 'error';
            }

            return 'loading';
        }

        function findValue($control) {
            if (!$control || !$control.length) {
                return '';
            }

            return normalizeDescription($control.val());
        }

        function stripPreviewMarkup(text) {
            return String(text || '')
                .replace(/<!--html-->|<!--markdown-->|<!--more-->/gi, ' ')
                .replace(/```[\s\S]*?```/g, ' ')
                .replace(/~~~[\s\S]*?~~~/g, ' ')
                .replace(/`[^`\n]+`/g, ' ')
                .replace(/\[photos[^\]]*\][\s\S]*?\[\/photos\]/gi, ' ')
                .replace(/\[links[^\]]*\][\s\S]*?\[\/links\]/gi, ' ')
                .replace(/\[notice([^\]]*)\]([\s\S]*?)\[\/notice\]/gi, '$2')
                .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
                .replace(/\[([^\]]+)\]\(([^)]*)\)/g, '$1')
                .replace(/^#{1,6}\s+/gm, '')
                .replace(/^\s*[-*+]\s+/gm, '')
                .replace(/^\s*\d+\.\s+/gm, '')
                .replace(/<img\b[^>]*>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/#vwid=\d{1,5}&vhei=\d{1,5}/gi, ' ')
                .replace(/\{\{(.+?):(.+?)\}\}/g, '$1')
                .replace(/::\((.*?)\)|:@\((.*?)\)|:&\((.*?)\)|:\$\((.*?)\)|:!\((.*?)\)/g, ' ')
                .replace(/\u00a0/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function truncateText(text, limit) {
            var chars = Array.from(String(text || ''));
            if (chars.length <= limit) {
                return chars.join('');
            }

            return chars.slice(0, limit).join('') + '...';
        }

        function getPreviewData() {
            var rawContent = controls.content.length ? controls.content.val() : '';
            var normalizedContent = stripPreviewMarkup(rawContent);
            var customExcerpt = findValue(controls.excerpt);
            var bannerUrl = findValue(controls.banner);
            var bannerAsCover = findValue(controls.bannerAsCover) || '1';
            var showFullContent = findValue(controls.showFullContent) === '1';
            var hasBanner = bannerUrl !== '';
            var effectiveListStyle = '0';

            if (hasBanner) {
                if (showFullContent) {
                    effectiveListStyle = '1';
                } else if (bannerAsCover === '2') {
                    effectiveListStyle = '2';
                } else if (bannerAsCover === '0') {
                    effectiveListStyle = '0';
                } else {
                    effectiveListStyle = '1';
                }
            }

            return {
                title: findValue(controls.title) || '未填写标题',
                customExcerpt: customExcerpt,
                bannerUrl: bannerUrl,
                bannerAsCover: bannerAsCover,
                showFullContent: showFullContent,
                effectiveListStyle: effectiveListStyle,
                hasVisibleBanner: hasBanner && effectiveListStyle !== '0',
                normalizedContent: normalizedContent
            };
        }

        function getIndexModeLabel(data) {
            return data.showFullContent ? '首页模式：全文展示' : '首页模式：摘要卡片';
        }

        function getListBannerLabel(data) {
            if (!data.bannerUrl) {
                return '首页主图：未设置';
            }

            if (data.showFullContent) {
                return '首页主图：全文模式下为顶部图';
            }

            if (data.bannerAsCover === '2') {
                return '首页主图：标题背景';
            }

            if (data.bannerAsCover === '0') {
                return '首页主图：不显示';
            }

            return '首页主图：标题上方';
        }

        function getExcerptModeLabel(data) {
            if (data.showFullContent) {
                if (data.customExcerpt) {
                    return '摘要：自定义引文';
                }

                return '摘要：正文截取';
            }

            if (data.customExcerpt) {
                return '摘要：自定义';
            }

            return '摘要：自动';
        }

        function getClosedStatus(data) {
            if (!data.bannerUrl) {
                return '未设置主图，当前为无图卡片。';
            }

            return '展开后按首页样式预览卡片效果。';
        }

        function renderCard(cardVariant, data) {
            var refs = cardVariant.refs;
            var autoExcerpt = truncateText(data.normalizedContent, cardVariant.autoExcerptLimit);
            var fullContentPreview = truncateText(data.normalizedContent, cardVariant.fullContentLimit);

            refs.root.attr('data-list-style', data.effectiveListStyle);
            refs.root.toggleClass('is-full-content', data.showFullContent);
            refs.root.toggleClass('has-banner', data.hasVisibleBanner);
            refs.title.text(data.title);

            if (data.customExcerpt) {
                refs.headline.text(data.customExcerpt).prop('hidden', false);
            } else {
                refs.headline.text('').prop('hidden', true);
            }

            if (data.showFullContent) {
                refs.body.prop('hidden', false);
                refs.bodyText.text(fullContentPreview || '正文内容预览将在这里显示。');
            } else if (!data.customExcerpt) {
                refs.body.prop('hidden', false);
                refs.bodyText.text(autoExcerpt || '未填写摘要时，这里会显示自动摘要。');
            } else {
                refs.body.prop('hidden', true);
                refs.bodyText.text('');
            }

            refs.banner.prop('hidden', !data.hasVisibleBanner);
        }

        function renderPreview(data) {
            $indexModeBadge.text(getIndexModeLabel(data));
            $listBannerBadge.text(getListBannerLabel(data));
            $excerptModeBadge.text(getExcerptModeLabel(data));

            $.each(cardVariants, function (_, cardVariant) {
                renderCard(cardVariant, data);
            });
        }

        function loadCardImages(data, forceRefresh) {
            if (!data.hasVisibleBanner) {
                currentCardUrl = '';
                $.each(cardVariants, function (_, cardVariant) {
                    resetCardImage(cardVariant.refs);
                });
                setStatus(data.bannerUrl ? '首页卡片当前不显示主图，已按首页样式更新预览。' : '未设置主图，当前按无图状态预览。', data.bannerUrl ? 'muted' : 'empty');
                return;
            }

            if (!$preview.prop('open')) {
                if (data.bannerUrl !== currentCardUrl) {
                    currentCardUrl = '';
                    $.each(cardVariants, function (_, cardVariant) {
                        resetCardImage(cardVariant.refs);
                    });
                }
                setStatus(getClosedStatus(data), 'collapsed');
                return;
            }

            if (!forceRefresh && currentCardUrl === data.bannerUrl) {
                var allLoaded = true;
                var hasStoredError = false;

                $.each(cardVariants, function (_, cardVariant) {
                    var imageState = getCardImageState(cardVariant.refs, data.bannerUrl);
                    if (imageState === 'error') {
                        hasStoredError = true;
                    }

                    if (imageState !== 'loaded') {
                        allLoaded = false;
                    }
                });

                if (hasStoredError) {
                    setStatus('主图加载失败，请检查链接是否可访问。', 'error');
                    return;
                }

                if (allLoaded) {
                    setStatus('当前首页卡片预览已同步。', 'ready');
                    return;
                }
            }

            currentCardUrl = data.bannerUrl;
            setStatus('正在加载首页卡片...', 'loading');

            var pending = 0;
            var hasError = false;

            $.each(cardVariants, function (index, cardVariant) {
                var refs = cardVariant.refs;
                var imageEl = refs.image.get(0);
                var imageState = getCardImageState(refs, data.bannerUrl);

                if (imageState === 'loaded') {
                    refs.banner.removeClass('is-loading is-error').prop('hidden', false);
                    return;
                }

                refs.banner.addClass('is-loading').removeClass('is-error').prop('hidden', false);
                refs.image.off('.voidIndexPreview' + index);
                pending++;
                refs.image.one('load.voidIndexPreview' + index, function () {
                    refs.banner.removeClass('is-loading');
                    pending--;
                    if (!hasError && pending === 0) {
                        setStatus('当前首页卡片预览已同步。', 'ready');
                    }
                });
                refs.image.one('error.voidIndexPreview' + index, function () {
                    refs.banner.removeClass('is-loading').addClass('is-error');
                    pending--;
                    if (!hasError) {
                        hasError = true;
                        setStatus('主图加载失败，请检查链接是否可访问。', 'error');
                    } else if (pending === 0) {
                        setStatus('主图加载失败，请检查链接是否可访问。', 'error');
                    }
                });
                refs.image.attr('data-void-preview-url', data.bannerUrl);
                refs.image.attr('src', data.bannerUrl);

                if (imageEl && imageEl.complete) {
                    refs.image.triggerHandler(imageEl.naturalWidth > 0 ? 'load' : 'error');
                }
            });

            if (!hasError && pending === 0) {
                setStatus('当前首页卡片预览已同步。', 'ready');
            }
        }

        function updatePreview(forceRefresh) {
            var data = getPreviewData();
            renderPreview(data);
            loadCardImages(data, forceRefresh);
        }

        function schedulePreview(forceRefresh) {
            window.clearTimeout(updateTimer);
            updateTimer = window.setTimeout(function () {
                updatePreview(forceRefresh);
            }, 160);
        }

        $.each(controls, function (_, $control) {
            if ($control && $control.length) {
                $control.on('input change', function () {
                    schedulePreview($preview.prop('open'));
                });
            }
        });

        $preview.on('toggle', function () {
            if ($preview.prop('open')) {
                updatePreview(true);
                return;
            }

            schedulePreview(false);
        });

        $(window).on('resize.voidPostPreview', function () {
            schedulePreview($preview.prop('open'));
        });

        updatePreview(false);
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

    if (window.VOID_Editor_Admin && typeof window.VOID_Editor_Admin.init === 'function') {
        window.VOID_Editor_Admin.init();
    }
});

/* eslint-disable linebreak-style */
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
            fields: ['posttype', 'showfullcontent', 'showTOC']
        }
    ];

    function init() {
        var $panel = buildVoidFieldPanel();
        if ($panel && $panel.length) {
            compactFieldDescriptions($panel);
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

        var $labelSource = $();
        var $valueSource = $();
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
            refs.image.removeAttr('src');
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
                $.each(cardVariants, function (_, cardVariant) {
                    if (!cardVariant.refs.image.attr('src')) {
                        allLoaded = false;
                    }
                });

                if (allLoaded) {
                    setStatus('当前首页卡片预览已同步。', 'ready');
                    return;
                }
            }

            currentCardUrl = data.bannerUrl;
            setStatus('正在加载首页卡片...', 'loading');

            var pending = cardVariants.length;
            var hasError = false;

            $.each(cardVariants, function (index, cardVariant) {
                var refs = cardVariant.refs;

                refs.banner.addClass('is-loading').removeClass('is-error').prop('hidden', false);
                refs.image.off('.voidIndexPreview' + index);
                refs.image.on('load.voidIndexPreview' + index, function () {
                    refs.banner.removeClass('is-loading');
                    pending--;
                    if (!hasError && pending === 0) {
                        setStatus('当前首页卡片预览已同步。', 'ready');
                    }
                });
                refs.image.on('error.voidIndexPreview' + index, function () {
                    refs.banner.removeClass('is-loading').addClass('is-error');
                    if (!hasError) {
                        hasError = true;
                        setStatus('主图加载失败，请检查链接是否可访问。', 'error');
                    }
                });
                refs.image.attr('src', data.bannerUrl);
            });
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

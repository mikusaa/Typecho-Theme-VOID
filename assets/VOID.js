/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// VOID
// Author: 熊猫小A
// Link: https://blog.imalan.cn/archives/247/

console.log(' %c Theme VOID %c https://blog.imalan.cn/archives/247/ ', 'color: #fadfa3; background: #23b7e5; padding:5px;', 'background: #1c2b36; padding:5px;');

var VOID_Content = {
    littlefootInstance: null,
    littlefootTouchClickGuardBound: false,
    littlefootLastTouchAt: 0,

    countWords: function () {
        if ($('#totalWordCount').length) {
            var total = 0;
            $.each($('a.archive-title'), function (i, item) {
                total += parseInt($(item).attr('data-words'));
            });
            $('#totalWordCount').html(total);
        }
    },

    // 解析文章目录
    parseTOC: function () {
        if ($('.TOC').length > 0) {
            var toc_option = {
                // Where to render the table of contents.
                tocSelector: '.TOC',
                // Where to grab the headings to build the table of contents.
                contentSelector: 'div.articleBody',
                // Which headings to grab inside of the contentSelector element.
                headingSelector: 'h2, h3, h4, h5',
                // 收缩深度
                collapseDepth: 6
            };
            tocbot.init(toc_option);
            $.each($('.toc-link'), function (i, item) {
                $(item).click(function () {
                    VOID_Ui.scrollToWithHeader($(this).attr('href'));
                    if (window.innerWidth < 1200) {
                        TOC.close();
                    }
                    return false;
                });
            });
            // 检查目录
            if (window.innerWidth >= 1200) {
                TOC.open();
            }
        }
    },

    getFigureImage: function (item) {
        return item && item.querySelector
            ? item.querySelector('img[data-void-image-content]')
            : null;
    },

    applyFigureSize: function (item, width, height) {
        var image;

        if (!(width > 0 && height > 0)) {
            return;
        }

        width = Math.round(width);
        height = Math.round(height);
        item.setAttribute('data-void-image-width', String(width));
        item.setAttribute('data-void-image-height', String(height));
        item.style.setProperty('--void-image-ratio', String(width / height));

        image = VOID_Content.getFigureImage(item);
        if (image) {
            image.setAttribute('width', String(width));
            image.setAttribute('height', String(height));
        }
    },

    // 为省略 summary 的旧文章补充可样式化、可访问的折叠标题
    parseDetails: function () {
        $.each($('article.yue details'), function (i, item) {
            if ($(item).children('summary').length > 0) {
                return;
            }

            var summary = document.createElement('summary');
            summary.textContent = '展开详情';
            summary.setAttribute('data-void-generated', '');
            item.insertBefore(summary, item.firstChild);
        });
    },

    normalizeTableLabel: function (value) {
        return String(value || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    },

    tableCellHasSpan: function (cell) {
        return !cell || parseInt(cell.getAttribute('colspan') || '1', 10) !== 1
            || parseInt(cell.getAttribute('rowspan') || '1', 10) !== 1;
    },

    isPureTableMediaCell: function (cell) {
        var mediaRoot;
        var rootTag;

        if (!cell || typeof cell.querySelector !== 'function'
            || !cell.children || cell.children.length !== 1) {
            return false;
        }

        mediaRoot = cell.children[0];
        rootTag = String(mediaRoot.tagName || '').toUpperCase();
        if (rootTag !== 'IMG'
            && rootTag !== 'A'
            && rootTag !== 'PICTURE'
            && rootTag !== 'FIGURE') {
            return false;
        }
        if (rootTag !== 'IMG'
            && (!mediaRoot.querySelector
                || !mediaRoot.querySelector('img[data-void-image-content], img'))) {
            return false;
        }
        if (rootTag !== 'FIGURE' && this.normalizeTableLabel(mediaRoot.textContent) !== '') {
            return false;
        }

        return this.normalizeTableLabel(cell.textContent)
            === this.normalizeTableLabel(mediaRoot.textContent);
    },

    getResponsiveTableModel: function (table) {
        var bodyIndex;
        var cellIndex;
        var headerCells;
        var headerIndex;
        var headerRow;
        var labels = [];
        var rowIndex;
        var rows = [];
        var mediaIndexes = [];

        if (!table || !table.tHead || table.tHead.rows.length !== 1
            || !table.tBodies || table.tBodies.length === 0 || table.tFoot
            || (typeof table.querySelector === 'function' && table.querySelector('table'))) {
            return null;
        }

        headerRow = table.tHead.rows[0];
        headerCells = headerRow.cells;
        if (!headerCells || headerCells.length === 0) {
            return null;
        }

        for (headerIndex = 0; headerIndex < headerCells.length; headerIndex++) {
            if (headerCells[headerIndex].tagName.toLowerCase() !== 'th'
                || this.tableCellHasSpan(headerCells[headerIndex])) {
                return null;
            }

            labels.push(this.normalizeTableLabel(headerCells[headerIndex].textContent));
            if (labels[headerIndex] === '') {
                return null;
            }
        }

        for (bodyIndex = 0; bodyIndex < table.tBodies.length; bodyIndex++) {
            for (rowIndex = 0; rowIndex < table.tBodies[bodyIndex].rows.length; rowIndex++) {
                var row = table.tBodies[bodyIndex].rows[rowIndex];
                var mediaIndex = -1;
                var mediaCount = 0;

                if (!row.cells || row.cells.length !== labels.length) {
                    return null;
                }

                for (cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
                    if (String(row.cells[cellIndex].tagName || '').toLowerCase() !== 'td'
                        || this.tableCellHasSpan(row.cells[cellIndex])) {
                        return null;
                    }
                    if (this.isPureTableMediaCell(row.cells[cellIndex])) {
                        mediaIndex = cellIndex;
                        mediaCount += 1;
                    }
                }

                if (mediaCount > 1) {
                    return null;
                }

                rows.push(row);
                mediaIndexes.push(mediaIndex);
            }
        }

        return {
            headerCells: headerCells,
            labels: labels,
            mediaIndexes: mediaIndexes,
            rows: rows
        };
    },

    ensureTableWrapper: function (table) {
        var wrapper = table.parentNode;

        if (wrapper && wrapper.classList && wrapper.classList.contains('void-table-scroll')) {
            return wrapper;
        }
        if (!table.ownerDocument || !table.parentNode) {
            return null;
        }

        wrapper = table.ownerDocument.createElement('div');
        wrapper.className = 'void-table-scroll';
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-label', '可横向滚动的表格');
        wrapper.setAttribute('tabindex', '0');
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
        return wrapper;
    },

    clearResponsiveTableState: function (table, wrapper) {
        var cells = table.querySelectorAll('td');
        var index;
        var rows = table.querySelectorAll('tbody tr');

        table.removeAttribute('data-void-table-responsive');
        if (wrapper) {
            wrapper.classList.remove('void-table-scroll--responsive');
        }

        for (index = 0; index < rows.length; index++) {
            rows[index].removeAttribute('data-void-table-has-media');
        }
        for (index = 0; index < cells.length; index++) {
            cells[index].removeAttribute('data-void-table-label');
            cells[index].removeAttribute('data-void-table-media');
            cells[index].removeAttribute('data-void-table-primary');
        }
    },

    enhanceTable: function (table) {
        var cellIndex;
        var headerIndex;
        var mediaIndex;
        var model;
        var primaryAssigned;
        var row;
        var rowIndex;
        var wrapper = this.ensureTableWrapper(table);

        if (!wrapper) {
            return;
        }

        this.clearResponsiveTableState(table, wrapper);
        model = this.getResponsiveTableModel(table);
        if (!model) {
            return;
        }

        table.setAttribute('data-void-table-responsive', '');
        wrapper.classList.add('void-table-scroll--responsive');

        for (headerIndex = 0; headerIndex < model.headerCells.length; headerIndex++) {
            if (!model.headerCells[headerIndex].getAttribute('scope')) {
                model.headerCells[headerIndex].setAttribute('scope', 'col');
            }
        }

        for (rowIndex = 0; rowIndex < model.rows.length; rowIndex++) {
            row = model.rows[rowIndex];
            mediaIndex = model.mediaIndexes[rowIndex];
            primaryAssigned = false;

            if (mediaIndex >= 0) {
                row.setAttribute('data-void-table-has-media', '');
            }

            for (cellIndex = 0; cellIndex < row.cells.length; cellIndex++) {
                row.cells[cellIndex].setAttribute('data-void-table-label', model.labels[cellIndex]);
                if (cellIndex === mediaIndex) {
                    row.cells[cellIndex].setAttribute('data-void-table-media', '');
                } else if (!primaryAssigned) {
                    row.cells[cellIndex].setAttribute('data-void-table-primary', '');
                    primaryAssigned = true;
                }
            }
        }
    },

    parseTables: function (root) {
        var index;
        var scope = root && typeof root.querySelectorAll === 'function' ? root : document;
        var tables = scope.querySelectorAll('.yue table');

        for (index = 0; index < tables.length; index++) {
            this.enhanceTable(tables[index]);
        }
    },

    // 处理友链列表
    parseBoardThumbs: function () {
        var items = document.querySelectorAll('.board-thumb');
        var i;

        for (i = 0; i < items.length; i++) {
            var item = items[i];
            var title = item.parentNode ? item.parentNode.querySelector('.board-title') : null;
            var titleText = title && title.textContent
                ? title.textContent.replace(/^\s+|\s+$/g, '')
                : '';
            var titleContent;
            var image;
            var thumb = item.getAttribute('data-thumb') || '';

            item.setAttribute('data-fallback', titleText ? titleText.charAt(0).toUpperCase() : '#');

            if (title && !title.querySelector('.board-title-text')) {
                titleContent = document.createElement('span');
                titleContent.className = 'board-title-text';
                while (title.firstChild) {
                    titleContent.appendChild(title.firstChild);
                }
                title.appendChild(titleContent);
            }

            image = item.querySelector('img');
            if (image) {
                image.setAttribute('alt', '');
                continue;
            }

            image = document.createElement('img');
            image.setAttribute('alt', '');
            image.setAttribute('decoding', 'async');
            image.addEventListener('error', function () {
                this.classList.add('error');
                if (this.parentNode) {
                    this.parentNode.classList.add('error');
                }
            });

            if (VOIDConfig.lazyload) {
                image.setAttribute('loading', 'lazy');
            }
            image.setAttribute('src', thumb);

            item.appendChild(image);
        }
    },

    // 解析URL
    parseUrl: function () {
        var domain = document.domain;
        $('a:not([href^="#"]):not(.post-like):not(.void-image-link)').each(function (i, item) {
            if ((!$(item).attr('target') || (!$(item).attr('target') == '' && !$(item).attr('target') == '_self'))) {
                if (item.hostname != domain) {
                    $(item).attr('target', '_blank');
                }
            }
        });

        if (VOIDConfig.PJAX) {
            $.each($('a:not(a[target="_blank"], a[no-pjax])'), function (i, item) {
                var $item = $(item);

                if (item.hostname == domain) {
                    if ($item.is('.comments-container .pager a')) {
                        $item.removeClass('pjax');
                        return;
                    }

                    $item.addClass('pjax');
                }
            });
            if (window.VoidPjax && typeof window.VoidPjax.bind === 'function') {
                window.VoidPjax.bind('a.pjax', {
                    container: '#pjax-container',
                    fragment: '#pjax-container',
                    timeout: 8000
                });
            }
        }
    },

    highlight: function () {
        $.each($('.yue pre code'), function (i, item) {
            var classStr = $(item).attr('class');

            if (typeof (classStr) == 'undefined') {
                classStr = 'language-none';
            }

            if (classStr.indexOf('lang') == -1) {
                classStr += ' language-none';
            }

            $(item).attr('class', classStr);
        });

        Prism.highlightAll();
    },

    restoreLittlefootReferenceIds: function () {
        $.each($('[data-lf-original-id]'), function (i, item) {
            var originalId = $(item).attr('data-lf-original-id');
            if (typeof originalId !== 'undefined' && originalId !== '') {
                $(item).attr('id', originalId);
            }
            $(item).removeAttr('data-lf-original-id');
        });
    },

    bridgeLittlefootBacklinks: function () {
        $.each($('.littlefoot__button[id^="lf-"]'), function (i, item) {
            var originalId = item.id.replace(/^lf-/, '');
            if (originalId === '') {
                return;
            }

            var printRef = document.getElementById(originalId);
            if (printRef && printRef.classList.contains('littlefoot--print')) {
                $(printRef).attr('data-lf-original-id', originalId);
                $(printRef).attr('id', 'lf-print-' + originalId);
            }

            $(item).attr('id', originalId);
        });
    },

    isPanguSpaceElement: function (node) {
        if (!node || node.nodeType !== 1 || !node.tagName) {
            return false;
        }

        if (node.tagName.toLowerCase() !== 'pangu') {
            return false;
        }

        return /^\s*$/.test(node.textContent || '');
    },

    cleanupPanguAroundNode: function (node) {
        if (!node || !node.parentNode) {
            return;
        }

        var previousNode = node.previousSibling;
        if (this.isPanguSpaceElement(previousNode)) {
            previousNode.parentNode.removeChild(previousNode);
        }

        var nextNode = node.nextSibling;
        if (this.isPanguSpaceElement(nextNode)) {
            nextNode.parentNode.removeChild(nextNode);
        }
    },

    cleanupLittlefootPanguSpacing: function () {
        var self = this;

        $.each($('.littlefoot'), function (i, item) {
            self.cleanupPanguAroundNode(item);
        });

        $.each($('sup.littlefoot--print, a.littlefoot--print'), function (i, item) {
            self.cleanupPanguAroundNode(item);
        });
    },

    setLittlefootActiveState: function (button, isActive) {
        if (!button || typeof button.closest !== 'function') {
            return;
        }

        var footnoteHost = button.closest('.littlefoot');
        if (!footnoteHost) {
            return;
        }

        if (isActive) {
            footnoteHost.classList.add('littlefoot--active');
        } else {
            footnoteHost.classList.remove('littlefoot--active');
        }
    },

    clearLittlefootActiveState: function () {
        $.each($('.littlefoot.littlefoot--active'), function (i, item) {
            item.classList.remove('littlefoot--active');
        });
    },

    prepareLittlefootMobileCompat: function () {
        if (typeof window.AbortController !== 'function') {
            window.AbortController = function () {
                this.signal = undefined;
                this.abort = function () {};
            };
        }

        if (this.littlefootTouchClickGuardBound || !('ontouchstart' in window)) {
            return;
        }

        this.littlefootTouchClickGuardBound = true;

        document.addEventListener('touchend', function (event) {
            var target = event.target;
            if (!target || typeof target.closest !== 'function') {
                return;
            }
            if (!target.closest('[data-footnote-button]')) {
                return;
            }
            VOID_Content.littlefootLastTouchAt = Date.now();
        }, true);

        document.addEventListener('click', function (event) {
            var target = event.target;
            if (!target || typeof target.closest !== 'function') {
                return;
            }
            if (!target.closest('[data-footnote-button]')) {
                return;
            }
            if (Date.now() - VOID_Content.littlefootLastTouchAt > 600) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }
        }, true);
    },

    bigfoot: function () {
        this.restoreLittlefootReferenceIds();
        this.clearLittlefootActiveState();

        if (this.littlefootInstance && typeof this.littlefootInstance.unmount === 'function') {
            this.littlefootInstance.unmount();
            this.littlefootInstance = null;
        }

        this.prepareLittlefootMobileCompat();

        if (typeof littlefoot === 'undefined' || typeof littlefoot.littlefoot !== 'function') {
            return;
        }

        this.littlefootInstance = littlefoot.littlefoot({
            allowDuplicates: true,
            activateCallback: function (popover, button) {
                VOID_Content.setLittlefootActiveState(button, true);
            },
            dismissCallback: function (popover, button) {
                VOID_Content.setLittlefootActiveState(button, false);
            }
        });

        this.bridgeLittlefootBacklinks();
        this.cleanupLittlefootPanguSpacing();
    },

    pangu: function () {
        if (typeof pangu === 'undefined' || typeof pangu.spacingNode !== 'function') {
            return;
        }

        var footnoteAnchorPattern = /(fn|footnote|note)[:\-_\d]/i;
        $.each($('a[href*="#"]'), function (index, item) {
            var hrefAttr = item.getAttribute('href') || '';
            var relAttr = item.getAttribute('rel') || '';
            if (!(hrefAttr + relAttr).match(footnoteAnchorPattern)) {
                return;
            }

            item.classList.add('no-pangu-spacing');
            if (typeof item.closest === 'function') {
                var supNode = item.closest('sup');
                if (supNode) {
                    supNode.classList.add('no-pangu-spacing');
                }
            }
        });

        $.each($('p'), function (index, item) {
            pangu.spacingNode(item);
        });
    },

    math: function () {
        if (!VOIDConfig.enableMath || typeof MathJax === 'undefined') {
            return;
        }

        var container = document.getElementById('pjax-container') || document.body;
        if (!MathJax.startup || !MathJax.startup.promise || typeof MathJax.typesetPromise !== 'function') {
            return;
        }

        MathJax.startup.promise = MathJax.startup.promise
            .then(function () {
                if (typeof MathJax.typesetClear === 'function') {
                    MathJax.typesetClear([container]);
                }
                return MathJax.typesetPromise([container]);
            })
            .catch(function (err) {
                console.error('MathJax typeset failed:', err);
            });
    },

    hyphenate: function () {
        $.each($('div.articleBody p, div.articleBody blockquote'), function (index, item) {
            var text = item.textContent || '';

            // Alert markup and fallback markers are structured content, not prose to hyphenate.
            if ($(item).closest('.void-alert').length > 0 || /\[!|\[\/?notice\b/i.test(text)) {
                return;
            }

            // 避免在 MathJax 解析前把 TeX 命令打断（如 \begin 被插入软连字符）
            if (/\\begin\{|\\\(|\\\[|(^|[^\\])\$\$|(^|[^\\])\$/.test(text)) {
                return;
            }

            $(item).hyphenate('en-us');
        });
    }
};

var VOID_DialogScrollLock = {
    owners: {},

    lock: function (owner) {
        if (!owner || this.owners[owner]) {
            return;
        }

        this.owners[owner] = true;
        if (document.body && document.body.classList) {
            document.body.classList.add('void-dialog-open');
        }
    },

    unlock: function (owner) {
        var key;

        if (owner && this.owners[owner]) {
            delete this.owners[owner];
        }

        for (key in this.owners) {
            if (Object.prototype.hasOwnProperty.call(this.owners, key)) {
                return;
            }
        }

        if (document.body && document.body.classList) {
            document.body.classList.remove('void-dialog-open');
        }
    }
};

var VOID_PhotoSets = {
    root: null,
    generation: 0,
    imageBindings: [],
    setBindings: [],
    dragThreshold: 6,

    classifyLayout: function (count) {
        if (count === 2) {
            return 'pair';
        }
        return count >= 3 ? 'strip' : 'single';
    },

    isReducedMotion: function () {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    },

    resolveDimensions: function (figure, image) {
        var width = parseFloat(figure.getAttribute('data-void-image-width'));
        var height = parseFloat(figure.getAttribute('data-void-image-height'));

        if (width > 0 && height > 0) {
            return { width: width, height: height, source: 'semantic' };
        }

        if (image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
            return {
                width: parseFloat(image.naturalWidth),
                height: parseFloat(image.naturalHeight),
                source: 'natural'
            };
        }

        return null;
    },

    hydrateFigure: function (figure) {
        var self = this;
        var image = VOID_Content.getFigureImage(figure);
        var dimensions;
        var binding;
        var generation = this.generation;

        if (!image) {
            return;
        }

        dimensions = this.resolveDimensions(figure, image);
        if (dimensions) {
            VOID_Content.applyFigureSize(figure, dimensions.width, dimensions.height);
            return;
        }

        binding = {
            image: image,
            onLoad: function () {
                var naturalDimensions;

                if (generation !== self.generation || !self.root) {
                    return;
                }
                if (self.root.contains && !self.root.contains(figure)) {
                    return;
                }

                naturalDimensions = self.resolveDimensions(figure, image);
                if (naturalDimensions) {
                    VOID_Content.applyFigureSize(figure, naturalDimensions.width, naturalDimensions.height);
                    image.removeEventListener('load', binding.onLoad);
                }
            }
        };

        image.addEventListener('load', binding.onLoad);
        this.imageBindings.push(binding);
    },

    closestImageItem: function (target, set) {
        while (target && target !== set) {
            if (target.getAttribute && target.hasAttribute('data-void-image-item')) {
                return target;
            }
            target = target.parentNode;
        }
        return null;
    },

    closestImageLink: function (target, set) {
        while (target && target !== set) {
            if (target.getAttribute && target.hasAttribute('data-void-image-zoom')) {
                return target;
            }
            target = target.parentNode;
        }
        return null;
    },

    ensureItemVisible: function (set, item) {
        var setRect = set.getBoundingClientRect();
        var itemRect = item.getBoundingClientRect();
        var nextLeft = null;
        var behavior = this.isReducedMotion() ? 'auto' : 'smooth';

        if (itemRect.left < setRect.left) {
            nextLeft = Math.max(0, set.scrollLeft - (setRect.left - itemRect.left) - 20);
        } else if (itemRect.right > setRect.right) {
            nextLeft = Math.max(0, set.scrollLeft + itemRect.right - setRect.right + 20);
        }

        if (null === nextLeft) {
            return;
        }

        if (typeof set.scrollTo === 'function') {
            try {
                set.scrollTo({ left: nextLeft, behavior: behavior });
                return;
            } catch (error) {
                // Older engines only accept numeric scroll coordinates.
            }
        }
        set.scrollLeft = nextLeft;
    },

    enhanceSet: function (set) {
        var self = this;
        var record;

        if (set.getAttribute('data-void-photo-layout') !== 'strip') {
            return;
        }

        record = {
            set: set,
            active: false,
            dragging: false,
            captured: false,
            pointerId: null,
            startX: 0,
            startScrollLeft: 0,
            suppressClickUntil: 0
        };

        record.resetPointer = function (releaseCapture) {
            var pointerId = record.pointerId;
            var shouldRelease = releaseCapture && record.captured
                && typeof set.releasePointerCapture === 'function' && pointerId !== null;

            record.active = false;
            record.dragging = false;
            record.captured = false;
            record.pointerId = null;
            set.classList.remove('is-dragging');

            if (shouldRelease) {
                try {
                    set.releasePointerCapture(pointerId);
                } catch (error) {
                    // Pointer capture may already have been released by the browser.
                }
            }
        };

        record.onPointerDown = function (event) {
            if ((event.pointerType && event.pointerType !== 'mouse') || event.button !== 0) {
                return;
            }

            if (record.active) {
                record.resetPointer(true);
            }

            record.active = true;
            record.dragging = false;
            record.captured = false;
            record.pointerId = event.pointerId;
            record.startX = event.clientX;
            record.startScrollLeft = set.scrollLeft;
        };

        record.onPointerMove = function (event) {
            var delta;

            if (!record.active || (record.pointerId !== null && event.pointerId !== record.pointerId)) {
                return;
            }

            delta = event.clientX - record.startX;
            if (!record.dragging && Math.abs(delta) <= self.dragThreshold) {
                return;
            }

            if (!record.dragging) {
                record.dragging = true;
                set.classList.add('is-dragging');

                if (typeof set.setPointerCapture === 'function' && event.pointerId !== undefined) {
                    try {
                        set.setPointerCapture(event.pointerId);
                        record.captured = true;
                    } catch (error) {
                        record.captured = false;
                    }
                }
            }
            set.scrollLeft = record.startScrollLeft - delta;
            event.preventDefault();
        };

        record.onPointerUp = function (event) {
            var wasDragging;

            if (!record.active || (record.pointerId !== null && event.pointerId !== record.pointerId)) {
                return;
            }

            wasDragging = record.dragging;
            record.resetPointer(true);

            if (wasDragging) {
                record.suppressClickUntil = Date.now() + 400;
            }
        };

        record.onPointerCancel = function (event) {
            if (!record.active || (record.pointerId !== null && event.pointerId !== record.pointerId)) {
                return;
            }

            record.suppressClickUntil = 0;
            record.resetPointer(true);
        };

        record.onPointerLeave = function (event) {
            if (!record.active || record.captured
                || (record.pointerId !== null && event.pointerId !== record.pointerId)) {
                return;
            }

            record.suppressClickUntil = 0;
            record.resetPointer(false);
        };

        record.onLostPointerCapture = function (event) {
            if (!record.active || (record.pointerId !== null && event.pointerId !== record.pointerId)) {
                return;
            }

            record.suppressClickUntil = 0;
            record.resetPointer(false);
        };

        record.onClick = function (event) {
            if (Date.now() > record.suppressClickUntil || !self.closestImageLink(event.target, set)) {
                return;
            }

            record.suppressClickUntil = 0;
            event.preventDefault();
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            } else if (typeof event.stopPropagation === 'function') {
                event.stopPropagation();
            }
        };

        record.onFocusIn = function (event) {
            var item = self.closestImageItem(event.target, set);
            if (item) {
                self.ensureItemVisible(set, item);
            }
        };

        record.onDragStart = function (event) {
            event.preventDefault();
        };

        set.addEventListener('pointerdown', record.onPointerDown);
        set.addEventListener('pointermove', record.onPointerMove);
        set.addEventListener('pointerup', record.onPointerUp);
        set.addEventListener('pointercancel', record.onPointerCancel);
        set.addEventListener('pointerleave', record.onPointerLeave);
        set.addEventListener('lostpointercapture', record.onLostPointerCapture);
        set.addEventListener('click', record.onClick, true);
        set.addEventListener('focusin', record.onFocusIn);
        set.addEventListener('dragstart', record.onDragStart);
        this.setBindings.push(record);
    },

    init: function (root) {
        var figures;
        var sets;
        var index;

        this.destroy();
        this.generation++;
        this.root = root || document.getElementById('pjax-container') || document;
        if (!this.root || typeof this.root.querySelectorAll !== 'function') {
            return;
        }

        figures = this.root.querySelectorAll('figure[data-void-image-item]');
        for (index = 0; index < figures.length; index++) {
            this.hydrateFigure(figures[index]);
        }

        sets = this.root.querySelectorAll('[data-void-photo-set]');
        for (index = 0; index < sets.length; index++) {
            this.enhanceSet(sets[index]);
        }
    },

    destroy: function () {
        var index;
        var record;

        this.generation++;

        for (index = 0; index < this.imageBindings.length; index++) {
            record = this.imageBindings[index];
            record.image.removeEventListener('load', record.onLoad);
        }

        for (index = 0; index < this.setBindings.length; index++) {
            record = this.setBindings[index];
            record.resetPointer(true);
            record.set.removeEventListener('pointerdown', record.onPointerDown);
            record.set.removeEventListener('pointermove', record.onPointerMove);
            record.set.removeEventListener('pointerup', record.onPointerUp);
            record.set.removeEventListener('pointercancel', record.onPointerCancel);
            record.set.removeEventListener('pointerleave', record.onPointerLeave);
            record.set.removeEventListener('lostpointercapture', record.onLostPointerCapture);
            record.set.removeEventListener('click', record.onClick, true);
            record.set.removeEventListener('focusin', record.onFocusIn);
            record.set.removeEventListener('dragstart', record.onDragStart);
        }

        this.imageBindings = [];
        this.setBindings = [];
        this.root = null;
    },

    __test: {
        classifyLayout: function (count) {
            return VOID_PhotoSets.classifyLayout(count);
        },
        shouldStartDrag: function (startX, currentX) {
            return Math.abs(currentX - startX) > VOID_PhotoSets.dragThreshold;
        }
    }
};

var VOID_Gallery = {
    root: null,
    sets: [],
    rows: [],
    resizeObserver: null,
    resizeHandler: null,
    imageLoadHandler: null,
    loadMoreControl: null,
    loadMoreButton: null,
    loadMoreLabel: null,
    loadMoreCount: null,
    loadMoreStatus: null,
    loadMoreHandler: null,
    generatedRootId: false,
    hiddenLeadNodes: [],
    hiddenSets: [],
    rafId: null,
    rafUsesTimeout: false,
    generation: 0,
    observedWidth: 0,
    observedViewportHeight: 0,
    revealedItemCount: 0,
    restoredRevealCount: 0,
    progressiveTriggerScreens: 4.5,
    progressiveInitialScreens: 2.75,
    progressiveBatchScreens: 2,
    progressiveMinRemainingItems: 4,

    calculateRows: function (ratios, containerWidth, options) {
        var rows = [];
        var current = [];
        var currentRatio = 0;
        var offset = 0;
        var width = parseFloat(containerWidth);
        var gap = options && parseFloat(options.gap);
        var targetHeight = options && parseFloat(options.targetHeight);
        var maxItems = options && parseInt(options.maxItems, 10);
        var singleItemMinRatio = options && parseFloat(options.singleItemMinRatio);
        var index;

        if (!(width > 0 && isFinite(width))) {
            return rows;
        }
        if (!(gap >= 0 && isFinite(gap))) {
            gap = 8;
        }
        if (!(targetHeight > 0 && isFinite(targetHeight))) {
            targetHeight = 240;
        }
        if (!(maxItems > 0 && isFinite(maxItems))) {
            maxItems = ratios.length || 1;
        }
        if (!(singleItemMinRatio > 0 && isFinite(singleItemMinRatio))) {
            singleItemMinRatio = 0;
        }

        var finishRow = function (justified) {
            var availableWidth = Math.max(1, width - gap * Math.max(0, current.length - 1));
            var height = justified ? availableWidth / currentRatio : targetHeight;
            var widths = [];
            var usedWidth = 0;
            var itemIndex;

            if (!justified && current.length === 1) {
                height = Math.min(targetHeight * 1.75, availableWidth / currentRatio);
            }

            for (itemIndex = 0; itemIndex < current.length; itemIndex++) {
                var itemWidth = current[itemIndex] * height;
                if (justified && itemIndex === current.length - 1) {
                    itemWidth = Math.max(1, availableWidth - usedWidth);
                }
                widths.push(itemWidth);
                usedWidth += itemWidth;
            }

            rows.push({
                start: offset,
                end: offset + current.length,
                height: height,
                justified: justified,
                widths: widths
            });
            offset += current.length;
            current = [];
            currentRatio = 0;
        };

        for (index = 0; index < ratios.length; index++) {
            var ratio = parseFloat(ratios[index]);
            if (!(ratio > 0 && isFinite(ratio))) {
                ratio = 4 / 3;
            }

            if (singleItemMinRatio && ratio >= singleItemMinRatio) {
                if (current.length) {
                    finishRow(false);
                }
                current.push(ratio);
                currentRatio += ratio;
                finishRow(true);
                continue;
            }

            current.push(ratio);
            currentRatio += ratio;
            var availableWidth = Math.max(1, width - gap * Math.max(0, current.length - 1));
            var candidateHeight = availableWidth / currentRatio;
            if (candidateHeight <= targetHeight || current.length >= maxItems) {
                finishRow(true);
            }
        }

        if (current.length) {
            finishRow(false);
        }

        return rows;
    },

    getLayoutOptions: function (width, viewportWidth) {
        var currentViewportWidth = viewportWidth || width;
        if (currentViewportWidth <= 639) {
            return {
                gap: 14,
                targetHeight: 160,
                maxItems: 2,
                singleItemMinRatio: 1.6
            };
        }
        if (currentViewportWidth <= 959) {
            return { gap: 14, targetHeight: 240, maxItems: 2 };
        }
        return { gap: 16, targetHeight: 320, maxItems: 4 };
    },

    isImageFigure: function (element) {
        return !!(element && element.tagName && element.hasAttribute
            && element.tagName.toLowerCase() === 'figure'
            && element.hasAttribute('data-void-image-item'));
    },

    isContentImage: function (element) {
        return !!(element && element.tagName && element.hasAttribute
            && element.tagName.toLowerCase() === 'img'
            && element.hasAttribute('data-void-image-content'));
    },

    getFigureRatio: function (figure) {
        var image = VOID_Content.getFigureImage(figure);
        var dimensions = VOID_PhotoSets.resolveDimensions(figure, image);

        if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
            return dimensions.width / dimensions.height;
        }
        return 4 / 3;
    },

    focusWithoutScroll: function (element) {
        if (!element || typeof element.focus !== 'function') {
            return;
        }

        try {
            element.focus({ preventScroll: true });
        } catch (error) {
            element.focus();
        }
    },

    getViewportHeight: function () {
        return window.innerHeight
            || (document.documentElement && document.documentElement.clientHeight)
            || 800;
    },

    getTotalItemCount: function () {
        var total = 0;
        var index;

        for (index = 0; index < this.rows.length; index++) {
            total += this.rows[index].itemCount;
        }
        return total;
    },

    getRowsHeight: function (start, end) {
        var height = 0;
        var index;

        start = Math.max(0, start || 0);
        end = typeof end === 'number' ? Math.min(end, this.rows.length) : this.rows.length;
        for (index = start; index < end; index++) {
            if (index > start) {
                height += this.rows[index].gap;
            }
            height += this.rows[index].height;
        }
        return height;
    },

    getRowEndForHeight: function (start, budget) {
        var end = Math.max(0, start || 0);
        var height = 0;

        while (end < this.rows.length) {
            if (end > start) {
                height += this.rows[end].gap;
            }
            height += this.rows[end].height;
            end += 1;
            if (height >= budget) {
                break;
            }
        }
        return end;
    },

    getItemCountThroughRow: function (end) {
        var total = 0;
        var index;

        end = Math.min(end, this.rows.length);
        for (index = 0; index < end; index++) {
            total += this.rows[index].itemCount;
        }
        return total;
    },

    getVisibleRowCount: function (itemCount) {
        var total = 0;
        var index;

        for (index = 0; index < this.rows.length; index++) {
            total += this.rows[index].itemCount;
            if (total >= itemCount) {
                return index + 1;
            }
        }
        return this.rows.length;
    },

    getRevealStorageKey: function () {
        if (!window.location) {
            return null;
        }
        return 'VOID_Gallery.revealed:' + (window.location.pathname || '') + (window.location.search || '');
    },

    readStoredRevealCount: function () {
        var key = this.getRevealStorageKey();
        var storage;
        var value;

        if (!key) {
            return 0;
        }
        try {
            storage = window.sessionStorage;
            if (!storage) {
                return 0;
            }
            value = parseInt(storage.getItem(key), 10);
        } catch (error) {
            return 0;
        }
        return value > 0 && isFinite(value) ? value : 0;
    },

    storeRevealCount: function () {
        var key = this.getRevealStorageKey();
        var storage;

        if (!key || !(this.revealedItemCount > 0)) {
            return;
        }
        try {
            storage = window.sessionStorage;
            if (storage) {
                storage.setItem(key, String(this.revealedItemCount));
            }
        } catch (error) {
            // Storage can be unavailable in private or restricted browsing modes.
        }
    },

    getLeadNodesForSet: function (set) {
        var children = Array.prototype.slice.call(this.root.children);
        var setIndex = children.indexOf(set);
        var previousSetIndex = -1;
        var headingIndex = -1;
        var index;

        if (setIndex < 0) {
            return [];
        }
        for (index = setIndex - 1; index >= 0; index--) {
            if (children[index].hasAttribute && children[index].hasAttribute('data-void-gallery-set')) {
                previousSetIndex = index;
                break;
            }
        }
        for (index = previousSetIndex + 1; index < setIndex; index++) {
            if (children[index].tagName && /^H[2-6]$/.test(children[index].tagName.toUpperCase())) {
                headingIndex = index;
            }
        }
        return headingIndex >= 0 ? children.slice(headingIndex, setIndex) : [];
    },

    clearProgressiveVisibility: function () {
        var index;

        for (index = 0; index < this.rows.length; index++) {
            this.rows[index].element.hidden = false;
            this.rows[index].element.classList.remove('is-revealing');
        }
        for (index = 0; index < this.hiddenLeadNodes.length; index++) {
            this.hiddenLeadNodes[index].hidden = false;
        }
        for (index = 0; index < this.hiddenSets.length; index++) {
            this.hiddenSets[index].hidden = false;
        }
        this.hiddenLeadNodes = [];
        this.hiddenSets = [];
    },

    ensureLoadMoreControl: function () {
        var control;
        var button;
        var label;
        var count;
        var icon;
        var status;
        var rootId;
        var self = this;

        if (this.loadMoreControl || !this.root || !this.root.parentNode) {
            return;
        }
        rootId = this.root.getAttribute('id');
        if (!rootId) {
            rootId = 'void-gallery-content';
            this.root.setAttribute('id', rootId);
            this.generatedRootId = true;
        }

        control = document.createElement('div');
        control.className = 'void-gallery-more';

        button = document.createElement('button');
        button.className = 'void-gallery-more__button';
        button.setAttribute('type', 'button');
        button.setAttribute('data-void-gallery-more', '');
        button.setAttribute('aria-controls', rootId);

        label = document.createElement('span');
        label.className = 'void-gallery-more__label';
        label.textContent = '显示更多照片';

        count = document.createElement('span');
        count.className = 'void-gallery-more__count';

        icon = document.createElement('i');
        icon.className = 'void-gallery-more__icon voidicon-down';
        icon.setAttribute('aria-hidden', 'true');

        status = document.createElement('span');
        status.className = 'void-gallery-more__status';
        status.setAttribute('id', rootId + '-more-status');
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-atomic', 'true');
        button.setAttribute('aria-describedby', rootId + '-more-status');

        button.appendChild(label);
        button.appendChild(count);
        button.appendChild(icon);
        control.appendChild(button);
        control.appendChild(status);
        this.root.parentNode.insertBefore(control, this.root.nextSibling);

        this.loadMoreHandler = function (event) {
            self.revealMore(event);
        };
        button.addEventListener('click', this.loadMoreHandler);
        this.loadMoreControl = control;
        this.loadMoreButton = button;
        this.loadMoreLabel = label;
        this.loadMoreCount = count;
        this.loadMoreStatus = status;
    },

    removeLoadMoreControl: function () {
        if (this.loadMoreButton && this.loadMoreHandler) {
            this.loadMoreButton.removeEventListener('click', this.loadMoreHandler);
        }
        if (this.loadMoreControl && this.loadMoreControl.parentNode) {
            this.loadMoreControl.parentNode.removeChild(this.loadMoreControl);
        }
        this.loadMoreControl = null;
        this.loadMoreButton = null;
        this.loadMoreLabel = null;
        this.loadMoreCount = null;
        this.loadMoreStatus = null;
        this.loadMoreHandler = null;
    },

    updateLoadMoreControl: function () {
        var total = this.getTotalItemCount();
        var remaining = Math.max(0, total - this.revealedItemCount);

        if (!remaining) {
            this.removeLoadMoreControl();
            return;
        }
        this.ensureLoadMoreControl();
        if (!this.loadMoreButton) {
            return;
        }
        this.loadMoreLabel.textContent = '显示更多照片';
        this.loadMoreCount.textContent = '还剩 ' + remaining + ' 张';
        this.loadMoreButton.setAttribute('aria-label', '显示更多照片，还剩 ' + remaining + ' 张');
        this.loadMoreStatus.textContent = '已显示 ' + this.revealedItemCount + ' / ' + total + ' 张照片';
    },

    applyProgressiveVisibility: function (animate) {
        var visibleRowCount = this.getVisibleRowCount(this.revealedItemCount);
        var index;

        for (index = 0; index < this.hiddenLeadNodes.length; index++) {
            this.hiddenLeadNodes[index].hidden = false;
        }
        for (index = 0; index < this.hiddenSets.length; index++) {
            this.hiddenSets[index].hidden = false;
        }
        this.hiddenLeadNodes = [];
        this.hiddenSets = [];

        for (index = 0; index < this.rows.length; index++) {
            var row = this.rows[index].element;
            var wasHidden = !!row.hidden;
            row.hidden = index >= visibleRowCount;
            row.classList.remove('is-revealing');
            if (animate && wasHidden && !row.hidden) {
                row.classList.add('is-revealing');
            }
        }

        for (index = 0; index < this.sets.length; index++) {
            var set = this.sets[index];
            var hasVisibleRow = false;
            var rowIndex;

            for (rowIndex = 0; rowIndex < this.rows.length; rowIndex++) {
                if (this.rows[rowIndex].set === set && !this.rows[rowIndex].element.hidden) {
                    hasVisibleRow = true;
                    break;
                }
            }
            if (hasVisibleRow) {
                set.hidden = false;
                continue;
            }

            set.hidden = true;
            this.hiddenSets.push(set);
            var leadNodes = this.getLeadNodesForSet(set);
            var leadIndex;
            for (leadIndex = 0; leadIndex < leadNodes.length; leadIndex++) {
                if (!leadNodes[leadIndex].hidden) {
                    leadNodes[leadIndex].hidden = true;
                    this.hiddenLeadNodes.push(leadNodes[leadIndex]);
                }
            }
        }
    },

    refreshProgressiveDisplay: function () {
        var total = this.getTotalItemCount();
        var viewportHeight = this.getViewportHeight();
        var totalHeight = this.getRowsHeight(0, this.rows.length);
        var initialRowEnd;
        var visibleRowCount;

        if (!total || totalHeight <= viewportHeight * this.progressiveTriggerScreens) {
            this.revealedItemCount = total;
            this.clearProgressiveVisibility();
            this.removeLoadMoreControl();
            return;
        }

        initialRowEnd = this.getRowEndForHeight(0, viewportHeight * this.progressiveInitialScreens);
        this.revealedItemCount = Math.max(
            this.revealedItemCount,
            this.getItemCountThroughRow(initialRowEnd)
        );
        this.revealedItemCount = Math.max(this.revealedItemCount, this.restoredRevealCount);
        this.revealedItemCount = Math.min(this.revealedItemCount, total);
        visibleRowCount = this.getVisibleRowCount(this.revealedItemCount);
        this.revealedItemCount = this.getItemCountThroughRow(visibleRowCount);

        if (total - this.revealedItemCount < this.progressiveMinRemainingItems) {
            this.revealedItemCount = total;
        }
        this.applyProgressiveVisibility(false);
        this.updateLoadMoreControl();
    },

    revealMore: function (event) {
        var visibleRowCount = this.getVisibleRowCount(this.revealedItemCount);
        var firstNewRow = this.rows[visibleRowCount];
        var firstNewLink = firstNewRow && firstNewRow.element.querySelector
            ? firstNewRow.element.querySelector('a[data-void-image-zoom]') : null;
        var end = this.getRowEndForHeight(
            visibleRowCount,
            this.getViewportHeight() * this.progressiveBatchScreens
        );
        var total = this.getTotalItemCount();
        var self = this;

        this.revealedItemCount = Math.max(this.revealedItemCount, this.getItemCountThroughRow(end));
        if (total - this.revealedItemCount < this.progressiveMinRemainingItems) {
            this.revealedItemCount = total;
        }
        this.storeRevealCount();
        this.applyProgressiveVisibility(true);
        this.updateLoadMoreControl();

        if (typeof VOID_Ui !== 'undefined' && VOID_Ui && typeof VOID_Ui.lazyload === 'function') {
            VOID_Ui.lazyload();
        }
        if (event && event.detail === 0 && firstNewLink && typeof firstNewLink.focus === 'function') {
            window.setTimeout(function () {
                if (self.root && self.root.contains(firstNewLink)) {
                    firstNewLink.focus();
                }
            }, 0);
        }
    },

    unwrapGeneratedSets: function (root) {
        var sets = Array.prototype.slice.call(root.querySelectorAll('[data-void-gallery-set]'));
        var index;

        for (index = 0; index < sets.length; index++) {
            var set = sets[index];
            var parent = set.parentNode;
            var figures;
            var figureIndex;

            if (!parent) {
                continue;
            }
            figures = Array.prototype.slice.call(set.querySelectorAll('figure[data-void-image-item]'));
            for (figureIndex = 0; figureIndex < figures.length; figureIndex++) {
                parent.insertBefore(figures[figureIndex], set);
            }
            parent.removeChild(set);
        }
    },

    flattenPhotoSets: function (root) {
        var wrappers = Array.prototype.slice.call(root.querySelectorAll('[data-void-photo-set]'));
        var index;

        for (index = 0; index < wrappers.length; index++) {
            var wrapper = wrappers[index];
            var parent = wrapper.parentNode;
            if (!parent) {
                continue;
            }
            while (wrapper.firstChild) {
                parent.insertBefore(wrapper.firstChild, wrapper);
            }
            parent.removeChild(wrapper);
        }
    },

    unwrapFigureParagraphs: function (root) {
        var children = Array.prototype.slice.call(root.children);
        var index;

        for (index = 0; index < children.length; index++) {
            var paragraph = children[index];
            var nodes;
            var hasFigure = false;
            var onlyFigures = true;
            var nodeIndex;

            if (!paragraph.tagName || paragraph.tagName.toLowerCase() !== 'p') {
                continue;
            }

            nodes = Array.prototype.slice.call(paragraph.childNodes);
            for (nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
                var node = nodes[nodeIndex];
                if (node.nodeType === 3 && !node.nodeValue.trim()) {
                    continue;
                }
                if (node.nodeType === 1 && this.isImageFigure(node)) {
                    hasFigure = true;
                    continue;
                }
                onlyFigures = false;
                break;
            }

            if (!hasFigure || !onlyFigures) {
                continue;
            }
            while (paragraph.firstChild) {
                root.insertBefore(paragraph.firstChild, paragraph);
            }
            root.removeChild(paragraph);
        }
    },

    removePhotoSeparators: function (root) {
        var children = Array.prototype.slice.call(root.children);
        var isSeparator = function (element) {
            var tagName = element.tagName.toLowerCase();
            var nodes;
            var index;

            if (tagName === 'br') {
                return true;
            }
            if (tagName !== 'p') {
                return false;
            }

            nodes = Array.prototype.slice.call(element.childNodes);
            for (index = 0; index < nodes.length; index++) {
                if (nodes[index].nodeType === 3 && !nodes[index].nodeValue.trim()) {
                    continue;
                }
                if (nodes[index].nodeType === 1 && nodes[index].tagName.toLowerCase() === 'br') {
                    continue;
                }
                return false;
            }
            return true;
        };
        var index;

        for (index = 0; index < children.length; index++) {
            if (!isSeparator(children[index])) {
                continue;
            }

            var previousIndex = index - 1;
            var nextIndex = index + 1;
            while (previousIndex >= 0 && isSeparator(children[previousIndex])) {
                previousIndex -= 1;
            }
            while (nextIndex < children.length && isSeparator(children[nextIndex])) {
                nextIndex += 1;
            }

            var previous = previousIndex >= 0 ? children[previousIndex] : null;
            var next = nextIndex < children.length ? children[nextIndex] : null;
            if (this.isImageFigure(previous) && this.isImageFigure(next)) {
                root.removeChild(children[index]);
            }
        }
    },

    createSets: function (root) {
        var self = this;
        var sets = [];
        var figures = [];
        var children = Array.prototype.slice.call(root.children);
        var index;

        var finishSet = function () {
            var set;
            var figureIndex;

            if (!figures.length) {
                return;
            }
            set = document.createElement('div');
            set.className = 'void-gallery-set';
            set.setAttribute('data-void-gallery-set', '');
            root.insertBefore(set, figures[0]);
            for (figureIndex = 0; figureIndex < figures.length; figureIndex++) {
                set.appendChild(figures[figureIndex]);
            }
            sets.push(set);
            figures = [];
        };

        for (index = 0; index < children.length; index++) {
            if (self.isImageFigure(children[index])) {
                figures.push(children[index]);
            } else {
                finishSet();
            }
        }
        finishSet();
        return sets;
    },

    normalize: function (root) {
        this.unwrapGeneratedSets(root);
        this.flattenPhotoSets(root);
        this.unwrapFigureParagraphs(root);
        this.removePhotoSeparators(root);
        this.sets = this.createSets(root);
    },

    layoutSet: function (set) {
        var width = set.clientWidth;
        var figures;
        var ratios = [];
        var fragment;
        var activeElement;
        var restoreFocus;
        var viewportWidth;
        var options;
        var rows;
        var figureIndex = 0;
        var index;

        if (!(width > 0)) {
            return;
        }

        figures = Array.prototype.slice.call(set.querySelectorAll('figure[data-void-image-item]'));
        if (!figures.length) {
            return;
        }

        fragment = document.createDocumentFragment();
        activeElement = document.activeElement;
        restoreFocus = activeElement && set.contains(activeElement);

        for (index = 0; index < figures.length; index++) {
            ratios.push(this.getFigureRatio(figures[index]));
            fragment.appendChild(figures[index]);
        }
        while (set.firstChild) {
            set.removeChild(set.firstChild);
        }

        viewportWidth = window.innerWidth || document.documentElement.clientWidth || width;
        options = this.getLayoutOptions(width, viewportWidth);
        rows = this.calculateRows(ratios, width, options);
        for (index = 0; index < rows.length; index++) {
            var rowData = rows[index];
            var row = document.createElement('div');
            var itemIndex;
            row.className = 'void-gallery-row'
                + (rowData.justified ? ' is-justified' : ' is-last')
                + (rowData.widths.length === 1 ? ' is-single' : '');

            for (itemIndex = 0; itemIndex < rowData.widths.length; itemIndex++) {
                var figure = figures[figureIndex++];
                figure.style.setProperty('--void-gallery-item-width', Math.max(1, rowData.widths[itemIndex]) + 'px');
                figure.style.setProperty('--void-gallery-item-height', Math.max(1, rowData.height) + 'px');
                row.appendChild(figure);
            }
            set.appendChild(row);
            this.rows.push({
                element: row,
                set: set,
                height: rowData.height,
                gap: options.gap,
                itemCount: rowData.widths.length
            });
        }

        if (restoreFocus) {
            this.focusWithoutScroll(activeElement);
        }
    },

    layout: function () {
        var index;

        this.clearProgressiveVisibility();
        this.rows = [];
        for (index = 0; index < this.sets.length; index++) {
            this.layoutSet(this.sets[index]);
        }
        this.refreshProgressiveDisplay();
    },

    scheduleLayout: function (generation) {
        if (this.rafId !== null) {
            return;
        }

        var callback = function () {
            VOID_Gallery.rafId = null;
            VOID_Gallery.rafUsesTimeout = false;
            if (generation === VOID_Gallery.generation && VOID_Gallery.root !== null) {
                VOID_Gallery.layout();
            }
        };

        if (typeof window.requestAnimationFrame === 'function') {
            this.rafUsesTimeout = false;
            this.rafId = window.requestAnimationFrame(callback);
        } else {
            this.rafUsesTimeout = true;
            this.rafId = window.setTimeout(callback, 16);
        }
    },

    promoteFirstImage: function () {
        var firstFigure;
        var image;

        if (document.querySelector('#banner img')) {
            return;
        }

        firstFigure = this.root.querySelector('figure[data-void-image-item]');
        image = firstFigure ? VOID_Content.getFigureImage(firstFigure) : null;
        if (!image) {
            return;
        }

        image.setAttribute('loading', 'eager');
        image.setAttribute('fetchpriority', 'high');
        image.setAttribute('decoding', 'async');
    },

    init: function () {
        var self = this;
        var root;
        var generation;
        var activeElement;
        var restoreFocus;

        this.destroy();
        if (typeof document.querySelector !== 'function') {
            return;
        }
        root = document.querySelector('[data-void-gallery]');
        if (!root) {
            return;
        }

        this.root = root;
        this.restoredRevealCount = this.readStoredRevealCount();
        this.revealedItemCount = this.restoredRevealCount;
        generation = this.generation;
        activeElement = document.activeElement;
        restoreFocus = activeElement && root.contains(activeElement);
        this.normalize(root);
        if (!this.sets.length) {
            root.classList.add('is-ready');
            return;
        }

        this.promoteFirstImage();
        this.layout();
        if (restoreFocus && document.activeElement !== activeElement) {
            this.focusWithoutScroll(activeElement);
        }
        root.classList.add('is-ready');
        this.observedWidth = root.clientWidth;
        this.observedViewportHeight = this.getViewportHeight();

        this.imageLoadHandler = function (event) {
            var target = event && event.target;
            var figure;
            var dimensions;
            if (generation !== self.generation || root !== self.root || !self.isContentImage(target)) {
                return;
            }
            if (root.contains && !root.contains(target)) {
                return;
            }
            figure = target.parentNode;
            while (figure && figure !== root && !self.isImageFigure(figure)) {
                figure = figure.parentNode;
            }
            dimensions = figure && figure !== root
                ? VOID_PhotoSets.resolveDimensions(figure, target) : null;
            if (dimensions && dimensions.source === 'semantic') {
                return;
            }
            self.scheduleLayout(generation);
        };
        root.addEventListener('load', this.imageLoadHandler, true);

        if (typeof window.ResizeObserver === 'function') {
            this.resizeObserver = new window.ResizeObserver(function (entries) {
                var width;
                if (generation !== self.generation || root !== self.root) {
                    return;
                }
                width = entries.length && entries[0].contentRect
                    ? entries[0].contentRect.width : root.clientWidth;
                if (Math.abs(width - self.observedWidth) < 0.5) {
                    return;
                }
                self.observedWidth = width;
                self.scheduleLayout(generation);
            });
            this.resizeObserver.observe(root);
        }

        this.resizeHandler = function () {
            var viewportHeight;
            var width;

            if (generation !== self.generation || root !== self.root) {
                return;
            }
            viewportHeight = self.getViewportHeight();
            width = root.clientWidth;
            if (Math.abs(width - self.observedWidth) < 0.5
                && Math.abs(viewportHeight - self.observedViewportHeight) < 1) {
                return;
            }
            self.observedWidth = width;
            self.observedViewportHeight = viewportHeight;
            self.scheduleLayout(generation);
        };
        window.addEventListener('resize', this.resizeHandler);
    },

    suspend: function () {
        if (this.loadMoreButton) {
            this.loadMoreButton.setAttribute('disabled', '');
            this.loadMoreButton.setAttribute('aria-busy', 'true');
            if (this.loadMoreHandler) {
                this.loadMoreButton.removeEventListener('click', this.loadMoreHandler);
            }
        }
        this.teardown(true);
    },

    destroy: function () {
        this.teardown(false);
    },

    teardown: function (preserveDisplay) {
        this.generation += 1;
        if (!preserveDisplay) {
            this.clearProgressiveVisibility();
            this.removeLoadMoreControl();
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }
        if (this.root && this.imageLoadHandler) {
            this.root.removeEventListener('load', this.imageLoadHandler, true);
        }
        if (this.rafId !== null) {
            if (this.rafUsesTimeout) {
                window.clearTimeout(this.rafId);
            } else if (typeof window.cancelAnimationFrame === 'function') {
                window.cancelAnimationFrame(this.rafId);
            }
        }

        this.resizeObserver = null;
        this.resizeHandler = null;
        this.imageLoadHandler = null;
        this.rafId = null;
        this.rafUsesTimeout = false;
        if (preserveDisplay) {
            return;
        }
        if (this.root && this.generatedRootId) {
            this.root.removeAttribute('id');
        }

        this.root = null;
        this.sets = [];
        this.rows = [];
        this.observedWidth = 0;
        this.observedViewportHeight = 0;
        this.revealedItemCount = 0;
        this.restoredRevealCount = 0;
        this.generatedRootId = false;
    },

    __test: {
        calculateRows: function (ratios, containerWidth, options) {
            return VOID_Gallery.calculateRows(ratios, containerWidth, options);
        },
        getLayoutOptions: function () {
            return VOID_Gallery.getLayoutOptions.apply(VOID_Gallery, arguments);
        },
        getFigureRatio: function (figure) {
            return VOID_Gallery.getFigureRatio(figure);
        },
        removePhotoSeparators: function (root) {
            return VOID_Gallery.removePhotoSeparators(root);
        }
    }
};

var VOID_ImageZoom = {
    root: null,
    overlay: null,
    stage: null,
    previewButton: null,
    previewImage: null,
    sourceLink: null,
    sourceImage: null,
    isOpen: false,
    isClosing: false,
    scrollArmed: false,
    inputLocked: false,
    generation: 0,
    transitionFrame: null,
    transitionTimer: null,
    transitionPhase: null,
    transitionGeneration: 0,
    transitionProperty: 'transform',
    transitionReady: false,
    scrollCloseTimer: null,
    inputFrame: null,
    inputResetTimer: null,
    inputIntent: 0,
    inputPending: 0,
    inputStartScrollY: 0,
    scrollStart: 0,
    touchY: null,
    openTransform: '',
    viewportWidth: 0,
    restoreFocusOnClose: true,
    fallbackLink: null,
    handlers: null,
    scrollThreshold: 40,
    transitionFallback: 360,

    isReducedMotion: function () {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    },

    findLink: function (target) {
        while (target && target !== this.root) {
            if (target.getAttribute && target.hasAttribute('data-void-image-zoom')) {
                return target;
            }
            target = target.parentNode;
        }
        return null;
    },

    getSourceImage: function (link) {
        return link && link.querySelector ? link.querySelector('img[data-void-image-content]') : null;
    },

    getPreviewSource: function (image) {
        return (image && (image.currentSrc || image.src || image.getAttribute('src'))) || '';
    },

    canActivate: function (link, event) {
        var target;
        var image;

        if (!link || !event || event.defaultPrevented) {
            return false;
        }
        if (typeof event.button === 'number' && event.button !== 0) {
            return false;
        }
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return false;
        }
        if (link.hasAttribute('download')) {
            return false;
        }

        target = (link.getAttribute('target') || '').toLowerCase();
        if (target === '_blank' || !link.getAttribute('href')) {
            return false;
        }
        if (this.root && this.root.contains && !this.root.contains(link)) {
            return false;
        }

        image = this.getSourceImage(link);
        return !!(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
            && this.getPreviewSource(image));
    },

    isValidRect: function (rect) {
        return !!(rect && isFinite(rect.left) && isFinite(rect.top)
            && isFinite(rect.width) && isFinite(rect.height)
            && rect.width > 0 && rect.height > 0);
    },

    calculateTransform: function (sourceRect, targetRect) {
        var sourceCenterX = sourceRect.left + sourceRect.width / 2;
        var sourceCenterY = sourceRect.top + sourceRect.height / 2;
        var targetCenterX = targetRect.left + targetRect.width / 2;
        var targetCenterY = targetRect.top + targetRect.height / 2;
        var scaleX = sourceRect.width > 0 ? targetRect.width / sourceRect.width : 1;
        var scaleY = sourceRect.height > 0 ? targetRect.height / sourceRect.height : 1;
        var translateX = targetCenterX - sourceCenterX;
        var translateY = targetCenterY - sourceCenterY;

        return {
            scaleX: scaleX,
            scaleY: scaleY,
            translateX: translateX,
            translateY: translateY,
            transform: 'translate3d(' + translateX + 'px, ' + translateY + 'px, 0) scale('
                + scaleX + ', ' + scaleY + ')'
        };
    },

    calculateFit: function (width, height, viewportWidth, viewportHeight, padding) {
        var insets = typeof padding === 'number'
            ? { top: padding, right: padding, bottom: padding, left: padding }
            : padding;
        var availableWidth;
        var availableHeight;
        var scale;
        var fittedWidth;
        var fittedHeight;

        insets = insets || { top: 0, right: 0, bottom: 0, left: 0 };
        availableWidth = Math.max(0, viewportWidth - insets.left - insets.right);
        availableHeight = Math.max(0, viewportHeight - insets.top - insets.bottom);
        scale = Math.min(availableWidth / width, availableHeight / height, 1);
        fittedWidth = width * scale;
        fittedHeight = height * scale;

        return {
            width: fittedWidth,
            height: fittedHeight,
            left: insets.left + (availableWidth - fittedWidth) / 2,
            top: insets.top + (availableHeight - fittedHeight) / 2
        };
    },

    getScrollY: function () {
        if (typeof window.scrollY === 'number') {
            return window.scrollY;
        }
        return typeof window.pageYOffset === 'number' ? window.pageYOffset : 0;
    },

    getScrollX: function () {
        if (typeof window.scrollX === 'number') {
            return window.scrollX;
        }
        return typeof window.pageXOffset === 'number' ? window.pageXOffset : 0;
    },

    getViewportWidth: function () {
        if (typeof window.innerWidth === 'number') {
            return window.innerWidth;
        }
        return document.documentElement ? document.documentElement.clientWidth : 0;
    },

    getViewportHeight: function () {
        if (typeof window.innerHeight === 'number') {
            return window.innerHeight;
        }
        return document.documentElement ? document.documentElement.clientHeight : 0;
    },

    getOverlayPadding: function () {
        var style = window.getComputedStyle && this.overlay ? window.getComputedStyle(this.overlay) : null;
        var readInset = function (name, fallback) {
            var value = style ? parseFloat(style[name]) : NaN;
            return isFinite(value) ? value : fallback;
        };

        return {
            top: readInset('paddingTop', 24),
            right: readInset('paddingRight', 24),
            bottom: readInset('paddingBottom', 24),
            left: readInset('paddingLeft', 24)
        };
    },

    rectToDocument: function (rect) {
        return {
            left: rect.left + this.getScrollX(),
            top: rect.top + this.getScrollY(),
            width: rect.width,
            height: rect.height
        };
    },

    setStageBase: function (rect) {
        this.stage.style.left = rect.left + 'px';
        this.stage.style.top = rect.top + 'px';
        this.stage.style.width = rect.width + 'px';
        this.stage.style.height = rect.height + 'px';
    },

    clearStagePresentation: function () {
        if (!this.stage) {
            return;
        }

        this.stage.style.left = '';
        this.stage.style.top = '';
        this.stage.style.width = '';
        this.stage.style.height = '';
        this.stage.style.transform = '';
        this.stage.style.opacity = '';
        this.stage.classList.remove('is-preparing');
        this.stage.classList.remove('is-closing');
        this.stage.classList.remove('is-input-locked');
    },

    forceStageLayout: function () {
        if (this.stage && this.stage.getBoundingClientRect) {
            this.stage.getBoundingClientRect();
        }
    },

    focusWithoutScroll: function (element) {
        if (!element || typeof element.focus !== 'function') {
            return;
        }

        try {
            element.focus({ preventScroll: true });
        } catch (error) {
            element.focus();
        }
    },

    restoreScrollPosition: function (scrollX, scrollY) {
        if (typeof window.scrollTo !== 'function'
            || (Math.abs(this.getScrollX() - scrollX) <= 0.5 && Math.abs(this.getScrollY() - scrollY) <= 0.5)) {
            return;
        }

        try {
            window.scrollTo({ left: scrollX, top: scrollY, behavior: 'auto' });
        } catch (error) {
            window.scrollTo(scrollX, scrollY);
        }
    },

    setRootOverflowClip: function (active) {
        var root = document.documentElement;

        if (!root || !root.classList) {
            return;
        }
        if (active) {
            root.classList.add('void-image-zoom-active');
        } else {
            root.classList.remove('void-image-zoom-active');
        }
    },

    activateFallback: function (link) {
        if (!link || typeof link.click !== 'function') {
            return;
        }

        this.fallbackLink = link;
        try {
            link.click();
        } catch (error) {
            // The restored real link remains available for a subsequent click.
        }
        this.fallbackLink = null;
    },

    handlePreviewError: function () {
        var generation = this.generation;
        var link = this.sourceLink;
        var canActivateFallback;

        if (!this.isOpen || this.isClosing || !link) {
            return;
        }

        canActivateFallback = !!(this.root && this.root.contains && this.root.contains(link));
        this.finishClose(false, generation);
        if (canActivateFallback) {
            this.activateFallback(link);
        }
    },

    setInputLock: function (locked) {
        if (locked === this.inputLocked || !this.handlers) {
            return;
        }

        this.inputLocked = locked;
        if (locked) {
            window.addEventListener('wheel', this.handlers.blockInput, { passive: false });
            window.addEventListener('touchmove', this.handlers.blockInput, { passive: false });
            this.overlay.classList.add('is-input-locked');
            this.stage.classList.add('is-input-locked');
        } else {
            window.removeEventListener('wheel', this.handlers.blockInput, { passive: false });
            window.removeEventListener('touchmove', this.handlers.blockInput, { passive: false });
            if (this.overlay) {
                this.overlay.classList.remove('is-input-locked');
            }
            if (this.stage) {
                this.stage.classList.remove('is-input-locked');
            }
        }
    },

    cancelTransitionWork: function () {
        if (this.transitionFrame !== null && window.cancelAnimationFrame) {
            window.cancelAnimationFrame(this.transitionFrame);
        }
        this.transitionFrame = null;

        if (this.transitionTimer !== null) {
            window.clearTimeout(this.transitionTimer);
            this.transitionTimer = null;
        }

        this.transitionPhase = null;
        this.transitionGeneration = 0;
        this.transitionProperty = 'transform';
        this.transitionReady = false;
    },

    clearInputIntent: function () {
        if (this.inputFrame !== null && window.cancelAnimationFrame) {
            window.cancelAnimationFrame(this.inputFrame);
        }
        this.inputFrame = null;
        if (this.inputResetTimer !== null) {
            window.clearTimeout(this.inputResetTimer);
            this.inputResetTimer = null;
        }

        this.inputIntent = 0;
        this.inputPending = 0;
        this.touchY = null;
    },

    cancelScrollWork: function () {
        if (this.scrollCloseTimer !== null) {
            window.clearTimeout(this.scrollCloseTimer);
            this.scrollCloseTimer = null;
        }
        this.clearInputIntent();
    },

    cancelAsyncWork: function () {
        this.cancelTransitionWork();
        this.cancelScrollWork();
        this.setInputLock(false);
    },

    armScrollClose: function (generation) {
        if (!this.isOpen || this.isClosing || this.scrollArmed || generation !== this.generation) {
            return;
        }

        if (this.transitionFrame !== null && window.cancelAnimationFrame) {
            window.cancelAnimationFrame(this.transitionFrame);
        }
        this.transitionFrame = null;
        if (this.transitionTimer !== null) {
            window.clearTimeout(this.transitionTimer);
            this.transitionTimer = null;
        }
        this.transitionPhase = null;
        this.transitionGeneration = 0;

        this.stage.classList.remove('is-preparing');
        this.stage.style.transform = this.openTransform;
        this.overlay.classList.remove('is-closing');
        this.overlay.classList.add('is-visible');
        this.setInputLock(false);

        this.scrollStart = this.getScrollY();
        this.inputStartScrollY = this.scrollStart;
        this.inputIntent = 0;
        this.inputPending = 0;
        this.scrollArmed = true;
    },

    startOpenTransition: function (generation) {
        var self = this;
        var start = function () {
            self.transitionFrame = null;
            if (!self.isOpen || self.isClosing || generation !== self.generation) {
                return;
            }

            self.stage.classList.remove('is-preparing');
            self.overlay.classList.add('is-visible');
            self.stage.style.transform = self.openTransform;
        };

        if (this.isReducedMotion()) {
            start();
            this.armScrollClose(generation);
            return;
        }

        this.transitionPhase = 'opening';
        this.transitionGeneration = generation;
        this.transitionProperty = 'transform';
        this.transitionTimer = window.setTimeout(function () {
            self.armScrollClose(generation);
        }, this.transitionFallback);

        if (window.requestAnimationFrame) {
            this.transitionFrame = window.requestAnimationFrame(start);
        } else {
            start();
        }
    },

    open: function (link) {
        var image = this.getSourceImage(link);
        var previewSource = this.getPreviewSource(image);
        var sourceRect;
        var sourceDocumentRect;
        var targetRect;
        var targetDocumentRect;
        var generation;
        var alt;

        if (this.isOpen || !image || !previewSource) {
            return false;
        }

        sourceRect = image.getBoundingClientRect ? image.getBoundingClientRect() : null;
        if (!this.isValidRect(sourceRect)) {
            return false;
        }

        targetRect = this.calculateFit(
            image.naturalWidth,
            image.naturalHeight,
            this.getViewportWidth(),
            this.getViewportHeight(),
            this.getOverlayPadding()
        );
        if (!this.isValidRect(targetRect)) {
            return false;
        }

        sourceDocumentRect = this.rectToDocument(sourceRect);
        targetDocumentRect = this.rectToDocument(targetRect);
        this.cancelAsyncWork();
        this.generation++;
        generation = this.generation;
        this.sourceLink = link;
        this.sourceImage = image;
        this.isOpen = true;
        this.isClosing = false;
        this.scrollArmed = false;
        this.restoreFocusOnClose = true;
        this.viewportWidth = this.getViewportWidth();
        this.openTransform = this.calculateTransform(sourceDocumentRect, targetDocumentRect).transform;
        alt = image.getAttribute('alt') || '';

        try {
            this.previewImage.setAttribute('src', previewSource);
            this.previewImage.setAttribute('alt', '');
            this.previewImage.setAttribute('width', String(image.naturalWidth));
            this.previewImage.setAttribute('height', String(image.naturalHeight));
            this.previewButton.setAttribute('aria-label', alt ? '关闭图片预览：' + alt : '关闭图片预览');

            this.clearStagePresentation();
            this.setStageBase(sourceDocumentRect);
            this.stage.style.transform = 'none';
            this.stage.style.opacity = '1';
            this.stage.classList.add('is-preparing');
            this.overlay.classList.remove('is-visible');
            this.overlay.classList.remove('is-closing');
            this.overlay.hidden = false;
            this.stage.hidden = false;
            this.setRootOverflowClip(true);
            link.classList.add('void-image-zoom-source');
            this.setInputLock(true);
            this.focusWithoutScroll(this.previewButton);
            this.forceStageLayout();
            this.startOpenTransition(generation);
        } catch (error) {
            this.finishClose(false, generation);
            return false;
        }

        return true;
    },

    finishClose: function (restoreFocus, generation) {
        var sourceLink = this.sourceLink;
        var scrollX;
        var scrollY;

        if (!this.isOpen || (typeof generation === 'number' && generation !== this.generation)) {
            return;
        }

        scrollX = this.getScrollX();
        scrollY = this.getScrollY();
        this.cancelAsyncWork();
        this.isOpen = false;
        this.isClosing = false;
        this.scrollArmed = false;
        this.setRootOverflowClip(false);

        if (sourceLink && sourceLink.classList) {
            sourceLink.classList.remove('void-image-zoom-source');
        }
        if (this.overlay) {
            this.overlay.classList.remove('is-visible');
            this.overlay.classList.remove('is-closing');
            this.overlay.classList.remove('is-input-locked');
            this.overlay.hidden = true;
        }
        if (this.stage) {
            this.clearStagePresentation();
            this.stage.hidden = true;
        }
        if (this.previewImage) {
            this.previewImage.removeAttribute('src');
            this.previewImage.removeAttribute('width');
            this.previewImage.removeAttribute('height');
        }
        if (this.previewButton) {
            this.previewButton.setAttribute('aria-label', '关闭图片预览');
        }

        this.sourceLink = null;
        this.sourceImage = null;
        this.openTransform = '';
        this.viewportWidth = 0;
        if (restoreFocus) {
            this.focusWithoutScroll(sourceLink);
            this.restoreScrollPosition(scrollX, scrollY);
        }
    },

    close: function (immediate, restoreFocus) {
        var self = this;
        var sourceRect;
        var stageRect;
        var sourceDocumentRect;
        var stageDocumentRect;
        var canReturnToSource;
        var generation;

        if (!this.isOpen || this.isClosing) {
            return;
        }

        this.restoreFocusOnClose = restoreFocus !== false;
        this.isClosing = true;
        this.scrollArmed = false;
        this.generation++;
        generation = this.generation;
        this.cancelAsyncWork();

        if (immediate || this.isReducedMotion()) {
            this.finishClose(this.restoreFocusOnClose, generation);
            return;
        }

        sourceRect = this.sourceImage && this.sourceImage.getBoundingClientRect
            ? this.sourceImage.getBoundingClientRect() : null;
        stageRect = this.stage && this.stage.getBoundingClientRect
            ? this.stage.getBoundingClientRect() : null;
        canReturnToSource = !!(this.sourceLink && this.sourceImage && this.root
            && this.root.contains && this.root.contains(this.sourceLink)
            && this.sourceLink.contains && this.sourceLink.contains(this.sourceImage)
            && this.isValidRect(sourceRect) && this.isValidRect(stageRect));

        this.transitionPhase = 'closing';
        this.transitionGeneration = generation;
        this.transitionProperty = canReturnToSource ? 'transform' : 'opacity';
        this.stage.classList.add('is-preparing');

        if (canReturnToSource) {
            sourceDocumentRect = this.rectToDocument(sourceRect);
            stageDocumentRect = this.rectToDocument(stageRect);
            this.setStageBase(sourceDocumentRect);
            this.stage.style.transform = this.calculateTransform(
                sourceDocumentRect,
                stageDocumentRect
            ).transform;
            this.stage.style.opacity = '1';
        } else {
            this.stage.style.opacity = '1';
        }

        this.forceStageLayout();
        this.stage.classList.remove('is-preparing');
        this.stage.classList.add('is-closing');
        this.overlay.classList.remove('is-visible');
        this.overlay.classList.add('is-closing');

        if (canReturnToSource) {
            this.stage.style.transform = 'none';
        } else {
            this.stage.style.opacity = '0';
        }

        if (window.requestAnimationFrame) {
            this.transitionFrame = window.requestAnimationFrame(function () {
                self.transitionFrame = null;
                if (self.isOpen && self.isClosing && generation === self.generation
                    && self.transitionPhase === 'closing') {
                    self.transitionReady = true;
                }
            });
        } else {
            this.transitionReady = true;
        }

        this.transitionTimer = window.setTimeout(function () {
            VOID_ImageZoom.finishClose(VOID_ImageZoom.restoreFocusOnClose, generation);
        }, this.transitionFallback);
    },

    handleTransitionEnd: function (event) {
        var phase = this.transitionPhase;
        var generation = this.transitionGeneration;

        if (!this.isOpen || !event || event.target !== this.stage
            || (event.propertyName && event.propertyName !== this.transitionProperty)) {
            return;
        }

        if (phase === 'opening') {
            this.armScrollClose(generation);
        } else if (phase === 'closing' && this.isClosing && this.transitionReady) {
            this.finishClose(this.restoreFocusOnClose, generation);
        }
    },

    requestScrollClose: function () {
        var self = this;
        var generation = this.generation;

        if (!this.isOpen || this.isClosing || !this.scrollArmed || this.scrollCloseTimer !== null) {
            return;
        }

        this.scrollArmed = false;
        if (this.isReducedMotion()) {
            this.close(true, true);
            return;
        }

        this.scrollCloseTimer = window.setTimeout(function () {
            self.scrollCloseTimer = null;
            if (self.isOpen && !self.isClosing && generation === self.generation) {
                self.close(false, true);
            }
        }, 150);
    },

    evaluateScroll: function () {
        if (!this.isOpen || this.isClosing || !this.scrollArmed) {
            return;
        }

        if (Math.abs((this.getScrollY() - this.scrollStart) + this.inputIntent) >= this.scrollThreshold) {
            this.requestScrollClose();
        }
    },

    resetInputIntentSoon: function () {
        var self = this;

        if (!this.isOpen || this.isClosing) {
            return;
        }

        if (this.inputResetTimer !== null) {
            window.clearTimeout(this.inputResetTimer);
        }
        this.inputResetTimer = window.setTimeout(function () {
            self.inputResetTimer = null;
            self.inputIntent = 0;
            self.inputPending = 0;
        }, 220);
    },

    recordInputIntent: function (delta, resetSoon) {
        var self = this;
        var evaluate = function () {
            var currentScrollY = self.getScrollY();
            var actualDelta = currentScrollY - self.inputStartScrollY;
            var unconsumedInput = self.inputPending;

            self.inputFrame = null;
            if (!self.isOpen || self.isClosing || !self.scrollArmed) {
                self.inputPending = 0;
                return;
            }

            if (unconsumedInput * actualDelta > 0) {
                if (Math.abs(actualDelta) >= Math.abs(unconsumedInput)) {
                    unconsumedInput = 0;
                } else {
                    unconsumedInput -= actualDelta;
                }
            }
            self.inputIntent += unconsumedInput;
            self.inputPending = 0;
            self.evaluateScroll();
        };

        if (!this.isOpen || this.isClosing || !this.scrollArmed || !isFinite(delta) || delta === 0) {
            return;
        }

        if (this.inputFrame === null) {
            this.inputStartScrollY = this.getScrollY();
        }
        this.inputPending += delta;
        if (resetSoon) {
            this.resetInputIntentSoon();
        }
        if (this.inputFrame !== null) {
            return;
        }

        if (window.requestAnimationFrame) {
            this.inputFrame = window.requestAnimationFrame(evaluate);
        } else {
            evaluate();
        }
    },

    isOpeningScrollKey: function (event) {
        var key = event.key;
        if ((key === ' ' || key === 'Spacebar' || key === 'Enter')
            && event.target === this.previewButton) {
            return false;
        }

        return key === 'ArrowUp' || key === 'ArrowDown' || key === 'PageUp'
            || key === 'PageDown' || key === 'Home' || key === 'End'
            || key === ' ' || key === 'Spacebar';
    },

    init: function (root) {
        var self = this;

        this.destroy();
        this.generation++;
        this.root = root || document.getElementById('pjax-container') || document;
        if (!this.root || typeof this.root.querySelector !== 'function'
            || !this.root.querySelector('a[data-void-image-zoom]') || !document.body) {
            return;
        }

        this.overlay = document.createElement('div');
        this.overlay.className = 'void-image-zoom-overlay';
        this.overlay.setAttribute('aria-hidden', 'true');
        this.overlay.hidden = true;

        this.stage = document.createElement('div');
        this.stage.className = 'void-image-zoom-stage';
        this.stage.setAttribute('role', 'dialog');
        this.stage.setAttribute('aria-modal', 'true');
        this.stage.setAttribute('aria-label', '图片放大预览');
        this.stage.hidden = true;

        this.previewButton = document.createElement('button');
        this.previewButton.className = 'void-image-zoom__button';
        this.previewButton.setAttribute('type', 'button');
        this.previewButton.setAttribute('aria-label', '关闭图片预览');

        this.previewImage = document.createElement('img');
        this.previewImage.className = 'void-image-zoom__image';
        this.previewImage.setAttribute('alt', '');
        this.previewImage.setAttribute('draggable', 'false');
        this.previewButton.appendChild(this.previewImage);
        this.stage.appendChild(this.previewButton);
        document.body.appendChild(this.overlay);
        document.body.appendChild(this.stage);

        this.handlers = {
            documentClick: function (event) {
                var link = self.findLink(event.target);
                if (link && link === self.fallbackLink) {
                    return;
                }
                if (self.canActivate(link, event) && self.open(link)) {
                    event.preventDefault();
                }
            },
            overlayClick: function (event) {
                if (event.target === self.overlay) {
                    self.close(false, true);
                }
            },
            previewClick: function () {
                self.close(false, true);
            },
            keydown: function (event) {
                if (!self.isOpen) {
                    return;
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    self.close(false, true);
                    return;
                }
                if (event.key === 'Tab') {
                    event.preventDefault();
                    self.focusWithoutScroll(self.previewButton);
                    return;
                }
                if (self.inputLocked && self.isOpeningScrollKey(event)) {
                    event.preventDefault();
                }
            },
            transitionEnd: function (event) {
                self.handleTransitionEnd(event);
            },
            previewError: function () {
                self.handlePreviewError();
            },
            resize: function () {
                if (self.isOpen && Math.abs(self.getViewportWidth() - self.viewportWidth) > 1) {
                    self.close(true, true);
                }
            },
            orientationChange: function () {
                self.close(true, true);
            },
            scroll: function () {
                self.evaluateScroll();
            },
            wheel: function (event) {
                var delta = event.deltaY || 0;
                if (event.ctrlKey) {
                    self.clearInputIntent();
                    return;
                }
                if (event.deltaMode === 1) {
                    delta *= 16;
                } else if (event.deltaMode === 2) {
                    delta *= window.innerHeight || 800;
                }
                self.recordInputIntent(delta, true);
            },
            touchStart: function (event) {
                var touch = event.touches && event.touches[0];
                if (!self.isOpen || self.isClosing || !self.scrollArmed) {
                    return;
                }
                self.clearInputIntent();
                if (!event.touches || event.touches.length !== 1) {
                    return;
                }
                self.touchY = touch ? touch.clientY : null;
            },
            touchMove: function (event) {
                var touch = event.touches && event.touches[0];
                var nextY;
                if (!event.touches || event.touches.length !== 1 || !touch) {
                    self.clearInputIntent();
                    return;
                }
                nextY = touch.clientY;
                if (self.touchY !== null) {
                    self.recordInputIntent(self.touchY - nextY, false);
                }
                self.touchY = nextY;
            },
            touchEnd: function () {
                self.touchY = null;
                self.resetInputIntentSoon();
            },
            touchCancel: function () {
                self.clearInputIntent();
            },
            blockInput: function (event) {
                if (self.isOpen && self.inputLocked && event.preventDefault) {
                    event.preventDefault();
                }
            }
        };

        document.addEventListener('click', this.handlers.documentClick);
        document.addEventListener('keydown', this.handlers.keydown);
        this.overlay.addEventListener('click', this.handlers.overlayClick);
        this.previewButton.addEventListener('click', this.handlers.previewClick);
        this.previewImage.addEventListener('error', this.handlers.previewError);
        this.stage.addEventListener('transitionend', this.handlers.transitionEnd);
        window.addEventListener('scroll', this.handlers.scroll, { passive: true });
        window.addEventListener('wheel', this.handlers.wheel, { passive: true });
        window.addEventListener('touchstart', this.handlers.touchStart, { passive: true });
        window.addEventListener('touchmove', this.handlers.touchMove, { passive: true });
        window.addEventListener('touchend', this.handlers.touchEnd, { passive: true });
        window.addEventListener('touchcancel', this.handlers.touchCancel, { passive: true });
        window.addEventListener('resize', this.handlers.resize);
        window.addEventListener('orientationchange', this.handlers.orientationChange);
    },

    destroy: function () {
        this.generation++;
        if (this.isOpen) {
            this.finishClose(false, this.generation);
        } else {
            this.cancelAsyncWork();
            this.setRootOverflowClip(false);
            if (this.sourceLink && this.sourceLink.classList) {
                this.sourceLink.classList.remove('void-image-zoom-source');
            }
        }

        if (this.handlers) {
            document.removeEventListener('click', this.handlers.documentClick);
            document.removeEventListener('keydown', this.handlers.keydown);
            if (this.overlay) {
                this.overlay.removeEventListener('click', this.handlers.overlayClick);
            }
            if (this.previewButton) {
                this.previewButton.removeEventListener('click', this.handlers.previewClick);
            }
            if (this.previewImage) {
                this.previewImage.removeEventListener('error', this.handlers.previewError);
            }
            if (this.stage) {
                this.stage.removeEventListener('transitionend', this.handlers.transitionEnd);
            }
            window.removeEventListener('scroll', this.handlers.scroll, { passive: true });
            window.removeEventListener('wheel', this.handlers.wheel, { passive: true });
            window.removeEventListener('touchstart', this.handlers.touchStart, { passive: true });
            window.removeEventListener('touchmove', this.handlers.touchMove, { passive: true });
            window.removeEventListener('touchend', this.handlers.touchEnd, { passive: true });
            window.removeEventListener('touchcancel', this.handlers.touchCancel, { passive: true });
            window.removeEventListener('resize', this.handlers.resize);
            window.removeEventListener('orientationchange', this.handlers.orientationChange);
            window.removeEventListener('wheel', this.handlers.blockInput, { passive: false });
            window.removeEventListener('touchmove', this.handlers.blockInput, { passive: false });
        }

        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        if (this.stage && this.stage.parentNode) {
            this.stage.parentNode.removeChild(this.stage);
        }

        this.handlers = null;
        this.overlay = null;
        this.stage = null;
        this.previewButton = null;
        this.previewImage = null;
        this.sourceLink = null;
        this.sourceImage = null;
        this.isOpen = false;
        this.isClosing = false;
        this.scrollArmed = false;
        this.inputLocked = false;
        this.openTransform = '';
        this.viewportWidth = 0;
        this.restoreFocusOnClose = true;
        this.fallbackLink = null;
        this.root = null;
    },

    __test: {
        calculateFit: function (width, height, viewportWidth, viewportHeight, padding) {
            return VOID_ImageZoom.calculateFit(width, height, viewportWidth, viewportHeight, padding);
        },
        calculateTransform: function (sourceRect, targetRect) {
            return VOID_ImageZoom.calculateTransform(sourceRect, targetRect);
        },
        rectToDocument: function (rect) {
            return VOID_ImageZoom.rectToDocument(rect);
        }
    }
};
var VOID_RewardDialog = {
    root: null,
    trigger: null,
    dialog: null,
    imageButton: null,
    isOpen: false,
    restoreFocusOnClose: true,
    handlers: null,

    canActivate: function (event) {
        if (!event || event.defaultPrevented) {
            return false;
        }
        if (typeof event.button === 'number' && event.button !== 0) {
            return false;
        }
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return false;
        }
        return !!(this.trigger && !this.trigger.hasAttribute('download') && this.trigger.getAttribute('href'));
    },

    open: function () {
        if (this.isOpen || !this.dialog || !this.trigger) {
            return false;
        }

        try {
            this.dialog.showModal();
        } catch (error) {
            return false;
        }

        this.isOpen = true;
        this.restoreFocusOnClose = true;
        VOID_DialogScrollLock.lock('reward');
        if (this.imageButton && typeof this.imageButton.focus === 'function') {
            try {
                this.imageButton.focus({ preventScroll: true });
            } catch (error) {
                this.imageButton.focus();
            }
        }
        return true;
    },

    finishClose: function () {
        if (!this.isOpen) {
            return;
        }

        this.isOpen = false;
        VOID_DialogScrollLock.unlock('reward');
        if (this.restoreFocusOnClose && this.trigger && typeof this.trigger.focus === 'function') {
            try {
                this.trigger.focus({ preventScroll: true });
            } catch (error) {
                this.trigger.focus();
            }
        }
    },

    close: function (restoreFocus) {
        if (!this.isOpen) {
            return;
        }

        this.restoreFocusOnClose = restoreFocus !== false;
        if (this.dialog && this.dialog.open) {
            try {
                this.dialog.close();
            } catch (error) {
                this.dialog.removeAttribute('open');
            }
        }
        this.finishClose();
    },

    init: function (root) {
        var self = this;

        this.destroy();
        this.root = root || document.getElementById('pjax-container') || document;
        if (!this.root || typeof this.root.querySelector !== 'function') {
            return;
        }

        this.trigger = this.root.querySelector('[data-void-reward-link]');
        this.dialog = this.root.querySelector('dialog[data-void-reward-dialog]');
        if (!this.trigger || !this.dialog || typeof this.dialog.showModal !== 'function') {
            this.trigger = null;
            this.dialog = null;
            return;
        }

        this.imageButton = this.dialog.querySelector('[data-void-reward-close]');
        if (!this.imageButton) {
            this.trigger = null;
            this.dialog = null;
            return;
        }

        this.handlers = {
            triggerClick: function (event) {
                if (self.canActivate(event) && self.open()) {
                    event.preventDefault();
                }
            },
            imageClick: function () {
                self.close(true);
            },
            dialogClick: function (event) {
                if (event.target === self.dialog
                    || (self.imageButton && !self.imageButton.contains(event.target))) {
                    self.close(true);
                }
            },
            cancel: function (event) {
                event.preventDefault();
                self.close(true);
            },
            close: function () {
                self.finishClose();
            }
        };

        this.trigger.addEventListener('click', this.handlers.triggerClick);
        this.imageButton.addEventListener('click', this.handlers.imageClick);
        this.dialog.addEventListener('click', this.handlers.dialogClick);
        this.dialog.addEventListener('cancel', this.handlers.cancel);
        this.dialog.addEventListener('close', this.handlers.close);
    },

    destroy: function () {
        if (this.isOpen) {
            this.close(false);
        } else {
            VOID_DialogScrollLock.unlock('reward');
        }

        if (this.handlers) {
            if (this.trigger) {
                this.trigger.removeEventListener('click', this.handlers.triggerClick);
            }
            if (this.imageButton) {
                this.imageButton.removeEventListener('click', this.handlers.imageClick);
            }
            if (this.dialog) {
                this.dialog.removeEventListener('click', this.handlers.dialogClick);
                this.dialog.removeEventListener('cancel', this.handlers.cancel);
                this.dialog.removeEventListener('close', this.handlers.close);
            }
        }

        this.root = null;
        this.trigger = null;
        this.dialog = null;
        this.imageButton = null;
        this.handlers = null;
        this.restoreFocusOnClose = true;
    }
};

var VOID = {
    pjaxLifecycleBound: false,
    emotePicker: null,
    emoteContentObserver: null,
    typographyGeneration: 0,

    safeRunPangu: function () {
        try {
            VOID_Content.pangu();
        } catch (err) {
            console.error('Pangu init failed:', err);
        }
    },

    cancelScheduledTypography: function () {
        this.typographyGeneration += 1;
    },

    isTypographyReady: function () {
        if (typeof document.querySelectorAll !== 'function'
            || typeof window.getComputedStyle !== 'function') {
            return true;
        }

        var enteringContent = document.querySelectorAll('.float-up');
        for (var index = 0; index < enteringContent.length; index++) {
            if (parseFloat(window.getComputedStyle(enteringContent[index]).opacity) === 0) {
                return false;
            }
        }

        return true;
    },

    scheduleTypography: function () {
        var generation = ++this.typographyGeneration;
        var visibilityChecksRemaining = 120;
        var scheduleFrame = typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame.bind(window)
            : function (callback) {
                window.setTimeout(callback, 34);
            };
        var run = function () {
            if (generation !== VOID.typographyGeneration) {
                return;
            }

            VOID.safeRunPangu();
            VOID_Content.bigfoot();
            VOID_Content.math();
            VOID_Content.hyphenate();
        };
        var runWhenVisible = function () {
            if (generation !== VOID.typographyGeneration) {
                return;
            }

            if (VOID.isTypographyReady() || visibilityChecksRemaining <= 0) {
                run();
                return;
            }

            visibilityChecksRemaining -= 1;
            scheduleFrame(runWhenVisible);
        };

        scheduleFrame(function () {
            scheduleFrame(runWhenVisible);
        });
    },

    resolvePjaxOptions: function (args) {
        var index;
        var event = args && args[0];
        var originalEvent = event && event.originalEvent ? event.originalEvent : event;
        var detail = originalEvent && originalEvent.detail;

        if (detail && detail.options && typeof detail.options === 'object') {
            return detail.options;
        }

        for (index = args ? args.length - 1 : -1; index >= 0; index--) {
            if (args[index] && typeof args[index] === 'object' && args[index].container) {
                return args[index];
            }
        }

        return null;
    },

    bindPjaxLifecycle: function () {
        if (!VOIDConfig.PJAX || this.pjaxLifecycleBound) {
            return;
        }

        this.pjaxLifecycleBound = true;

        $(document).on('pjax:send', function () {
            var options = VOID.resolvePjaxOptions(arguments);

            if (AjaxComment.isCommentPjaxRequest(options)) {
                VOID.destroyEmotes();
                AjaxComment.setCommentPageLoading(true);
                return;
            }

            if (VOID.isMainPjaxRequest(options)) {
                VOID.beforePjax();
            }
        });

        $(document).on('pjax:beforeReplace', function () {
            var options = VOID.resolvePjaxOptions(arguments);

            if (VOID.isMainPjaxRequest(options)) {
                VOID.beforePjaxReplace();
            }
        });

        $(document).on('pjax:complete', function () {
            var options = VOID.resolvePjaxOptions(arguments);

            if (AjaxComment.isCommentPjaxRequest(options)) {
                AjaxComment.afterPagePjax();
                return;
            }

            if (VOID.isMainPjaxRequest(options)) {
                VOID.afterPjax();
            }
        });

        $(document).on('pjax:abort', function () {
            var options = VOID.resolvePjaxOptions(arguments);

            if (VOID.isMainPjaxRequest(options)) {
                VOID.afterPjax();
            }
        });

        $(document).on('pjax:end', function () {
            var options = VOID.resolvePjaxOptions(arguments);

            if (AjaxComment.isCommentPjaxRequest(options)) {
                AjaxComment.endPagePjax();
                return;
            }

            if (VOID.isMainPjaxRequest(options)) {
                VOID.endPjax();
            }
        });
    },

    // 初始化单页应用
    init: function () {
        /* 初始化 UI */
        VOID_Ui.checkHeader();
        if (typeof VOID_CardCover !== 'undefined') {
            VOID_CardCover.init(document.getElementById('pjax-container'));
        }
        VOID_Ui.MasonryCtrler.init();
        VOID_Ui.DarkModeSwitcher.checkColorScheme();
        VOID_Ui.checkScrollTop();
        VOID_Content.parseBoardThumbs();
        VOID_Gallery.init();
        VOID_PhotoSets.init();
        VOID_ImageZoom.init();
        VOID_RewardDialog.init();
        VOID_Ui.lazyload();
        VOID_Ui.headroom();

        VOID_Content.countWords();
        VOID_Content.parseDetails();
        VOID_Content.parseTables(document.getElementById('pjax-container') || document);
        VOID_Content.parseTOC();
        if (typeof VOID_ControllerPanel !== 'undefined') {
            VOID_ControllerPanel.init();
        }
        VOID_Content.highlight();
        VOID_Content.parseUrl();
        VOID.scheduleTypography();

        VOID_Vote.reload();
        VOID.initEmotes();
        AjaxComment.init();

        $('body').on('click', function (e) {
            if (!VOID_Util.clickIn(e, '.mobile-search-form') && !VOID_Util.clickIn(e, '#toggle-mobile-search')) {
                if ($('.mobile-search-form').hasClass('opened')) {
                    $('.mobile-search-form').removeClass('opened');
                    return false;
                }
            }
            if (!VOID_Util.clickIn(e, '#toggle-setting-pc') && !VOID_Util.clickIn(e, '#toggle-setting')) {
                if ($('body').hasClass('setting-panel-show') && !VOID_Util.clickIn(e, '#setting-panel')) {
                    $('body').removeClass('setting-panel-show');
                    setTimeout(function () {
                        $('#setting-panel').hide();
                    }, 300);
                    return false;
                }
            }
        });
    },

    initEmotes: function () {
        var container = document.getElementById('void-comment-emotes');
        var target = document.getElementById('textarea');

        if (window.VoidEmotes && container && target) {
            this.emotePicker = window.VoidEmotes.mount({
                container: container,
                target: target,
                mode: 'inline'
            });
        }

        this.initEmoteContent();
    },

    initEmoteContent: function () {
        if (this.emoteContentObserver && typeof this.emoteContentObserver.destroy === 'function') {
            this.emoteContentObserver.destroy();
        }
        this.emoteContentObserver = window.VoidEmotes
            ? window.VoidEmotes.observeContent(document.getElementById('pjax-container') || document)
            : null;
    },

    destroyEmotes: function () {
        if (this.emotePicker && typeof this.emotePicker.destroy === 'function') {
            this.emotePicker.destroy();
        }
        if (this.emoteContentObserver && typeof this.emoteContentObserver.destroy === 'function') {
            this.emoteContentObserver.destroy();
        }
        this.emotePicker = null;
        this.emoteContentObserver = null;
    },

    isMainPjaxRequest: function (options) {
        return !options || options.container === '#pjax-container';
    },

    // PJAX 开始前
    beforePjax: function () {
        VOID.cancelScheduledTypography();
        NProgress.start();
        VOID_RewardDialog.destroy();
        VOID_ImageZoom.destroy();
        VOID_Gallery.suspend();
        VOID_PhotoSets.destroy();
        VOID.destroyEmotes();
        VOID_Ui.reset();
    },

    beforePjaxReplace: function () {
        VOID_Ui.MasonryCtrler.destroy();
    },

    // PJAX 结束后
    afterPjax: function () {
        NProgress.done();
	
        VOID_Content.parseBoardThumbs();

        VOID_Gallery.init();
        VOID_PhotoSets.init();
        VOID_ImageZoom.init();
        VOID_RewardDialog.init();

        if ($('#loggin-form').length) {
            $('#loggin-form').addClass('need-refresh');
        }

        if (typeof VOID_CardCover !== 'undefined') {
            VOID_CardCover.init(document.getElementById('pjax-container'));
        }
        VOID_Ui.MasonryCtrler.init();
        VOID_Ui.lazyload();

        VOID_Ui.checkScrollTop();
        VOID_Content.countWords();
        VOID_Content.parseDetails();
        VOID_Content.parseTables(document.getElementById('pjax-container') || document);
        VOID_Content.parseTOC();
        if (typeof VOID_ControllerPanel !== 'undefined') {
            VOID_ControllerPanel.refresh();
        }
        VOID_Content.parseUrl();
        VOID_Content.highlight();
        VOID.scheduleTypography();
        loadClipboard();

        VOID_Vote.reload();
        VOID.initEmotes();
        AjaxComment.init();
    },

    endPjax: function () {
        if ($('.TOC').length < 1) {
            TOC.close();
        }
    },

    alert: function (content, time) {
        var id = new Date().getTime();
        var message = document.createElement('div');
        message.className = 'msg';
        message.id = 'msg' + id;
        message.textContent = content == null ? '' : String(content);
        document.body.insertBefore(message, document.body.firstChild);
        $.each($('.msg'), function (i, item) {
            if ($(item).attr('id') != 'msg' + id) {
                $(item).css('top', $(item).offset().top - $(document).scrollTop() + $('.msg#msg' + id).outerHeight() + 20 + 'px');
            }
        });
        $('.msg#msg' + id).addClass('show');
        var t = time;
        if (typeof (t) != 'number') {
            t = 2500;
        }
        setTimeout(function () {
            $('.msg#msg' + id).addClass('hide');
            setTimeout(function () {
                $('.msg#msg' + id).remove();
            }, 1000);
        }, t);
    },

    startSearch: function (item) {
        var c = $(item).val();
        $(item).val('');
        $(item).blur();
        if (!c || c == '') {
            $(item).attr('placeholder', '你还没有输入任何信息');
            return;
        }
        var t = VOIDConfig.searchBase + encodeURIComponent(c);
        if (VOIDConfig.PJAX && window.VoidPjax && typeof window.VoidPjax.visit === 'function') {
            window.VoidPjax.visit({
                url: t,
                container: '#pjax-container',
                fragment: '#pjax-container',
                timeout: 8000
            });
        } else {
            window.open(t, '_self');
        }
    },

    enterSearch: function (item) {
        var event = window.event || arguments.callee.caller.arguments[0];
        if (event.keyCode == 13) {
            VOID.startSearch(item);
        }
    }
};

var VOID_Vote = {
    vote: function (item) {
        var type = $(item).attr('data-type');
        var id = $(item).attr('data-item-id');
        var table = $(item).attr('data-table');

        var cookieName = 'void_vote_' + table + '_' + type;
        var voted = VOID_Util.getCookie(cookieName);
        if (voted == null) voted = ',';

        // 首先检查本地 cookie
        if (voted.indexOf(',' + id + ',') != -1) {
            $(item).addClass('done');
            VOID.alert('您已经投过票了~');
            return;
        }

        // 当是评论投票时检查是否已经投过另一个选项
        if ($(item).hasClass('comment-vote')) {
            var type_2 = type == 'up' ? 'down' : 'up';
            if (VOID_Vote.checkVoted(type_2, id, table)) {
                VOID.alert('暂不支持更改投票哦～');
                return;
            }
        }

        $.ajax({
            url: VOIDConfig.votePath + table,
            type: 'POST',
            data: JSON.stringify({
                'id': parseInt(id),
                'type': type
            }),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            success: function (data) {
                if (data.code >= 200 && data.code < 400) {
                    $(item).addClass('done');
                    voted += id + ',';
                    VOID_Util.setCookie(cookieName, voted, 3600 * 24 * 90);
                }
                switch (data.code) {
                    case 200:
                        var prev = parseInt($(item).find('.value').text());
                        $(item).find('.value').text(prev + 1);
                        break;
                    case 302:
                        VOID.alert('您好像已经投过票了呢～');
                        break;
                    case 403:
                        VOID.alert('暂不支持更改投票哦～');
                        break;
                    default:
                        break;
                }
            },
            error: function () {
                VOID.alert('投票失败 o(╥﹏╥)o，请稍后重试');
            }
        });
    },

    checkVoted: function (type, id, table) {
        var cookieName = 'void_vote_' + table + '_' + type;
        var voted = VOID_Util.getCookie(cookieName);
        if (voted == null) voted = ',';
        return voted.indexOf(',' + id + ',') != -1;
    },

    reload: function () {
        // 高亮已记录的
        $.each($('.vote-button'), function (i, item) {
            var type = $(item).attr('data-type');
            var id = $(item).attr('data-item-id');
            var table = $(item).attr('data-table');

            if (VOID_Vote.checkVoted(type, id, table)) {
                $(item).addClass('done');
            }
        });
    },

    toggleFoldComment: function (coid, item) {
        var sel = '#comment-' + String(coid);
        $(sel).toggleClass('fold');
        if ($(sel).hasClass('fold')) {
            $(item).text('点击展开');
        } else {
            $(item).text('还是叠上吧');
        }
    },
};

var Share = {
    parseItem: function (item) {
        item = $(item).parent();
        return {
            url: $(item).attr('data-url'),
            title: $(item).attr('data-title'),
            excerpt: $(item).attr('data-excerpt'),
            img: $(item).attr('data-img'),
            twitter: $(item).attr('data-twitter'),
            weibo: $(item).attr('data-weibo'),
        };
    },

    toWeibo: function (item) {
        var content = Share.parseItem(item);
        var title = '分享《' + content.title + '》 @' + content.weibo + '\n\n' + content.excerpt;
        var url = new URL('http://service.weibo.com/share/share.php');
        url.searchParams.set('appkey', '');
        url.searchParams.set('title', title);
        url.searchParams.set('url', content.url);
        url.searchParams.set('pic', content.img);
        url.searchParams.set('searchPic', 'false');
        url.searchParams.set('style', 'simple');
        window.open(url.toString());
    },

    toTwitter: function (item) {
        var content = Share.parseItem(item);
        var text = '分享《' + content.title + '》 @' + content.twitter + '\n\n' + content.excerpt + ' ' + content.url;
        var url = new URL('https://twitter.com/intent/tweet');
        url.searchParams.set('text', text);
        window.open(url.toString());
    }
};

var AjaxComment = {
    noName: '必须填写用户名',
    noMail: '必须填写电子邮箱地址',
    noUrl: '必须填写 URL',
    noContent: '必须填写评论内容',
    invalidMail: '邮箱地址不合法',
    commentList: '.comment-list',
    comments: '#comments .comments-title',
    commentReply: '.comment-reply',
    commentForm: '#comment-form',
    respond: '.respond',
    commentPager: '.comments-container .pager a',
    textarea: '#textarea',
    submitBtn: '#comment-submit-button',
    newID: '',
    parentID: '',
    activeReplyCommentId: '',
    activeReplyCoid: '',
    replyWord: '回复',
    cancelReplyWord: '取消回复',
    threadPreviewSize: 1,
    threadPageSize: 8,
    threadPaginationThreshold: 8,
    threadPagerWindow: 5,
    threadFocusPendingId: '',
    antiSpamCleanup: null,

    isCommentPjaxRequest: function (options) {
        return !!(options && options.container === '#comments');
    },

    getCommentsOrder: function () {
        var order = String($('#comments').attr('data-comments-order') || '').toUpperCase();

        return order === 'ASC' ? 'ASC' : 'DESC';
    },

    isNewestCommentPage: function () {
        var pagerSelector = AjaxComment.getCommentsOrder() === 'ASC'
            ? '#comments .pager .next'
            : '#comments .pager .prev';

        return $(pagerSelector).length === 0;
    },

    insertNewestComment: function ($list, $comment) {
        var $footer;

        if (AjaxComment.getCommentsOrder() === 'DESC') {
            $list.prepend($comment);
            return;
        }

        $footer = $list.children('.comment-thread-footer').first();
        if ($footer.length) {
            $footer.before($comment);
        } else {
            $list.append($comment);
        }
    },

    getCommentDepth: function ($comment) {
        var depth = parseInt($comment.attr('data-comment-depth'), 10);

        return isNaN(depth) ? 0 : depth;
    },

    installAntiSpamToken: function (form, token) {
        var events = ['scroll', 'mousemove', 'keyup', 'touchstart'];
        var input = document.createElement('input');
        var listening = true;

        AjaxComment.destroyAntiSpamToken();
        if (!form) {
            return;
        }

        input.type = 'hidden';
        input.name = '_';
        input.value = token;

        function cleanup() {
            if (!listening) {
                return;
            }
            listening = false;
            for (var i = 0; i < events.length; i++) {
                window.removeEventListener(events[i], append);
            }
            if (AjaxComment.antiSpamCleanup === cleanup) {
                AjaxComment.antiSpamCleanup = null;
            }
        }

        function append() {
            if (!document.documentElement.contains(form)) {
                cleanup();
                return;
            }
            if (!form.querySelector('input[name="_"]')) {
                form.appendChild(input);
            }
            cleanup();
        }

        for (var i = 0; i < events.length; i++) {
            window.addEventListener(events[i], append);
        }
        AjaxComment.antiSpamCleanup = cleanup;
    },

    destroyAntiSpamToken: function () {
        if (typeof AjaxComment.antiSpamCleanup === 'function') {
            AjaxComment.antiSpamCleanup();
        }
        AjaxComment.antiSpamCleanup = null;
    },

    getDirectChild: function (root, node) {
        if (!node || !node.parentNode) {
            return null;
        }
        if (node.parentNode === root) {
            return node;
        }
        return AjaxComment.getDirectChild(root, node.parentNode);
    },

    moveReplyForm: function (commentId, coid, trigger) {
        var comment = document.getElementById(commentId);
        var response = document.querySelector(AjaxComment.respond);
        var form;
        var input;
        var holder;
        var child;
        var cancel;
        var textarea;

        if (!comment || !response) {
            return true;
        }

        form = response.tagName === 'FORM' ? response : response.querySelector('form');
        if (!form) {
            return true;
        }

        input = form.querySelector('input[name="parent"]');
        if (!input) {
            input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'parent';
            input.id = 'comment-parent';
            form.appendChild(input);
        }
        input.value = coid;

        holder = document.getElementById('void-comment-form-place-holder');
        if (!holder) {
            holder = document.createElement('div');
            holder.id = 'void-comment-form-place-holder';
            response.parentNode.insertBefore(holder, response);
        }

        child = AjaxComment.getDirectChild(comment, trigger);
        if (child) {
            comment.insertBefore(response, child.nextSibling);
        } else {
            comment.appendChild(response);
        }

        cancel = document.getElementById('cancel-comment-reply-link');
        if (cancel) {
            cancel.style.display = '';
        }

        textarea = response.querySelector('textarea[name="text"]');
        if (textarea) {
            textarea.focus();
        }
        return false;
    },

    restoreReplyForm: function () {
        var response = document.querySelector(AjaxComment.respond);
        var holder = document.getElementById('void-comment-form-place-holder');
        var input = response ? response.querySelector('input[name="parent"]') : null;
        var cancel = document.getElementById('cancel-comment-reply-link');

        if (input && input.parentNode) {
            input.parentNode.removeChild(input);
        }
        if (response && holder && holder.parentNode) {
            holder.parentNode.insertBefore(response, holder);
        }
        if (cancel) {
            cancel.style.display = 'none';
        }
        return false;
    },

    ensureTypechoCommentFacade: function () {
        if (window.TypechoComment) {
            return;
        }

        window.TypechoComment = {
            reply: function (commentId, coid, trigger) {
                return AjaxComment.moveReplyForm(commentId, coid, trigger);
            },
            cancelReply: function () {
                return AjaxComment.restoreReplyForm();
            }
        };
    },

    setCommentPageLoading: function (isLoading) {
        var $comments = $('#comments');
        var $container = $comments.closest('.comments-container');

        if ($comments.length === 0 || $container.length === 0) {
            return;
        }

        $container.toggleClass('is-loading', isLoading);
        $comments.toggleClass('is-loading', isLoading);
        $(AjaxComment.commentPager)
            .toggleClass('is-disabled', isLoading)
            .attr('aria-disabled', isLoading ? 'true' : null);
    },

    bindPager: function () {
        $(document).off('click', AjaxComment.commentPager);
        $(document).on('click', AjaxComment.commentPager, function (event) {
            var href = this.href || $(this).attr('href');

            if (!window.VoidPjax || typeof window.VoidPjax.visit !== 'function' || !href) {
                return true;
            }

            event.preventDefault();
            window.VoidPjax.visit({
                url: href,
                container: '#comments',
                fragment: '#comments',
                timeout: 8000,
                scrollTop: false,
                push: true,
                target: this
            });
            return false;
        });
    },

    afterPagePjax: function () {
        VOID_Content.parseUrl();
        VOID_Content.highlight();
        VOID_Vote.reload();
        VOID.initEmotes();
        AjaxComment.init();
    },

    endPagePjax: function () {
        AjaxComment.setCommentPageLoading(false);
    },

    resolveCommentTarget: function ($trigger) {
        var $comment = $trigger.closest('[data-comment-id], .comment-body[id]');
        if ($comment.length === 0) {
            return '';
        }

        return $comment.attr('data-comment-id') || $comment.attr('id') || '';
    },

    getReplyText: function ($trigger, attrName, fallback) {
        var value;

        if (!$trigger || !$trigger.length) {
            return fallback;
        }

        value = $.trim(String($trigger.attr(attrName) || ''));
        return value || fallback;
    },

    resolveReplyTrigger: function (matcher) {
        var $triggers = $(AjaxComment.commentReply + ' a');
        var $match = $();

        if (typeof matcher !== 'function') {
            return $match;
        }

        $triggers.each(function () {
            var $trigger = $(this);

            if (matcher($trigger)) {
                $match = $trigger;
                return false;
            }

            return undefined;
        });

        return $match;
    },

    findReplyTriggerByCommentId: function (commentId) {
        commentId = String(commentId || '');
        if (!commentId) {
            return $();
        }

        return AjaxComment.resolveReplyTrigger(function ($trigger) {
            return String($trigger.attr('data-comment-id') || '') === commentId;
        });
    },

    findReplyTriggerByCoid: function (coid) {
        coid = String(coid || '');
        if (!coid) {
            return $();
        }

        return AjaxComment.resolveReplyTrigger(function ($trigger) {
            return String($trigger.attr('data-comment-coid') || '') === coid;
        });
    },

    setReplyTriggerState: function ($trigger, isActive) {
        var replyWord;
        var cancelWord;

        if (!$trigger || !$trigger.length) {
            return;
        }

        replyWord = AjaxComment.getReplyText($trigger, 'data-reply-word', AjaxComment.replyWord);
        cancelWord = AjaxComment.getReplyText($trigger, 'data-cancel-word', AjaxComment.cancelReplyWord);

        $trigger.text(isActive ? cancelWord : replyWord);
        $trigger.attr('aria-pressed', isActive ? 'true' : 'false');
        $trigger.attr('data-reply-state', isActive ? 'active' : 'idle');
        $trigger.toggleClass('is-reply-active', isActive);
    },

    resetReplyTriggerState: function () {
        var $activeTrigger = AjaxComment.findReplyTriggerByCommentId(AjaxComment.activeReplyCommentId);

        if ($activeTrigger.length) {
            AjaxComment.setReplyTriggerState($activeTrigger, false);
        }

        AjaxComment.activeReplyCommentId = '';
        AjaxComment.activeReplyCoid = '';
        AjaxComment.parentID = '';
    },

    activateReplyTrigger: function ($trigger, commentId, coid) {
        if (!$trigger || !$trigger.length) {
            AjaxComment.resetReplyTriggerState();
            return;
        }

        if (AjaxComment.activeReplyCommentId && AjaxComment.activeReplyCommentId !== String(commentId || '')) {
            AjaxComment.setReplyTriggerState(
                AjaxComment.findReplyTriggerByCommentId(AjaxComment.activeReplyCommentId),
                false
            );
        }

        commentId = String(commentId || '');
        coid = String(coid || '');

        AjaxComment.setReplyTriggerState($trigger, true);
        AjaxComment.activeReplyCommentId = commentId;
        AjaxComment.activeReplyCoid = coid;
        AjaxComment.parentID = commentId;
    },

    getHashCommentSelector: function () {
        var hash = window.location.hash || '';

        if (!/^#comment-\d+$/.test(hash)) {
            return '';
        }

        return hash;
    },

    getHashCommentId: function () {
        var selector = AjaxComment.getHashCommentSelector();

        return selector ? selector.replace(/^#comment-/, '') : '';
    },

    scheduleHashCommentScroll: function () {
        var selector = AjaxComment.getHashCommentSelector();
        var scroll = function () {
            if (!selector || $(selector).length === 0) {
                return;
            }

            VOID_Ui.scrollToWithHeader(selector);
        };

        if (!selector) {
            return;
        }

        if (typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(scroll);
            return;
        }

        window.setTimeout(scroll, 0);
    },

    syncThreadFocusFromHash: function (shouldScroll) {
        var hashCommentId = AjaxComment.getHashCommentId();

        if (hashCommentId) {
            AjaxComment.threadFocusPendingId = hashCommentId;
        }

        AjaxComment.applyThreadPanels();

        if (hashCommentId && shouldScroll !== false) {
            AjaxComment.scheduleHashCommentScroll();
        }
    },

    bindHashChange: function () {
        $(window).off('hashchange.ajaxComment');
        $(window).on('hashchange.ajaxComment', function () {
            AjaxComment.syncThreadFocusFromHash(true);
        });
    },

    getReplyToFromLocation: function () {
        var query = window.location.search || '';
        var matched = query.match(/[?&]replyTo=(\d+)/);

        return matched ? matched[1] : '';
    },

    getCurrentReplyCoid: function () {
        var parentValue = $.trim(String($(AjaxComment.commentForm).find('input[name="parent"]').val() || ''));

        if (parentValue) {
            return parentValue;
        }

        if ($('#cancel-comment-reply-link').is(':visible')) {
            return AjaxComment.getReplyToFromLocation();
        }

        return '';
    },

    syncReplyTriggerState: function () {
        var coid = AjaxComment.getCurrentReplyCoid();
        var $trigger;
        var commentId;

        if (!coid) {
            AjaxComment.resetReplyTriggerState();
            return;
        }

        $trigger = AjaxComment.findReplyTriggerByCoid(coid);
        if (!$trigger.length) {
            AjaxComment.resetReplyTriggerState();
            return;
        }

        commentId = String($trigger.attr('data-comment-id') || AjaxComment.resolveCommentTarget($trigger));
        AjaxComment.activateReplyTrigger($trigger, commentId, coid);
    },

    handleReplyClick: function (commentId, coid, trigger) {
        var $trigger = $(trigger);
        var nextCommentId = String(commentId || AjaxComment.resolveCommentTarget($trigger));
        var nextCoid = String(coid || $trigger.attr('data-comment-coid') || '');
        var currentCoid = AjaxComment.getCurrentReplyCoid();

        if (AjaxComment.activeReplyCommentId === nextCommentId && currentCoid === nextCoid) {
            return AjaxComment.cancelActiveReply();
        }

        if (AjaxComment.moveReplyForm(nextCommentId, nextCoid, trigger)) {
            return true;
        }
        AjaxComment.activateReplyTrigger($trigger, nextCommentId, nextCoid);
        return false;
    },

    cancelActiveReply: function () {
        AjaxComment.restoreReplyForm();
        AjaxComment.resetReplyTriggerState();
        return false;
    },

    bindClick: function () {
        $(AjaxComment.commentReply + ' a').each(function () {
            var $trigger = $(this);

            if (!$trigger.attr('data-reply-word')) {
                $trigger.attr('data-reply-word', $.trim($trigger.text()) || AjaxComment.replyWord);
            }

            if (!$trigger.attr('data-cancel-word')) {
                $trigger.attr('data-cancel-word', AjaxComment.cancelReplyWord);
            }

            AjaxComment.setReplyTriggerState($trigger, false);
        });

        AjaxComment.syncReplyTriggerState();
    },

    collectThreadItems: function ($children) {
        var items = [];

        var walk = function ($container) {
            var $list = $container.children('.comment-list');
            if ($list.length === 0) {
                return;
            }

            $list.children('.comment-body').each(function () {
                var $comment = $(this);
                var $nested = $comment.children('.comment-children').detach();
                items.push($comment);

                if ($nested.length > 0) {
                    walk($nested);
                }
            });
        };

        walk($children);
        return items;
    },

    ensureThreadPanel: function ($children) {
        var $list = $children.children('.comment-list');

        if (!$children.hasClass('comment-thread-panel')) {
            var items = AjaxComment.collectThreadItems($children);
            if (items.length === 0) {
                return $();
            }

            $children.empty().addClass('comment-thread-panel');
            $list = $('<div class="comment-list comment-thread-list"></div>');

            $.each(items, function (index, $comment) {
                $comment
                    .addClass('comment-thread-item')
                    .attr('data-thread-index', index);
                $list.append($comment);
            });

            $children.append($list);
            return $list;
        }

        if ($list.length === 0) {
            $list = $('<div class="comment-list comment-thread-list"></div>');
            $children.append($list);
        }

        $list.addClass('comment-thread-list');
        $list.children('.comment-body').each(function (index) {
            $(this)
                .addClass('comment-thread-item')
                .attr('data-thread-index', index);
        });

        return $list;
    },

    insertReplyComment: function ($comment) {
        var parentCoid = String($comment.attr('data-comment-parent') || '');
        var $parent = parentCoid ? $('#comment-' + parentCoid) : $();
        var $root;
        var $children;
        var $list;
        var $cursor;
        var $next;
        var parentDepth;

        if (!$parent.length) {
            return false;
        }

        $root = $parent.hasClass('comment-parent') ? $parent : $parent.closest('.comment-parent');
        if (!$root.length) {
            return false;
        }

        $children = $root.children('.comment-children');
        if (!$children.length) {
            $children = $('<div class="comment-children comment-thread-panel" data-thread-expanded="false"></div>');
            $list = $('<div class="comment-list comment-thread-list"></div>');
            $children.append($list);
            $root.append($children);
        } else {
            $list = AjaxComment.ensureThreadPanel($children);
        }

        if (!$list.length) {
            return false;
        }

        if ($parent.hasClass('comment-parent')) {
            AjaxComment.insertNewestComment($list, $comment);
            return true;
        }

        if (AjaxComment.getCommentsOrder() === 'DESC') {
            $parent.after($comment);
            return true;
        }

        parentDepth = AjaxComment.getCommentDepth($parent);
        $cursor = $parent;
        $next = $cursor.next('.comment-body');
        while ($next.length && AjaxComment.getCommentDepth($next) > parentDepth) {
            $cursor = $next;
            $next = $cursor.next('.comment-body');
        }
        $cursor.after($comment);
        return true;
    },

    buildThreadPages: function (currentPage, totalPages) {
        var pages = [];
        var windowSize = AjaxComment.threadPagerWindow;
        var start;
        var end;
        var page;

        if (totalPages <= windowSize + 1) {
            for (page = 1; page <= totalPages; page++) {
                pages.push(page);
            }
            return pages;
        }

        pages.push(1);
        start = Math.max(2, currentPage - 1);
        end = Math.min(totalPages - 1, currentPage + 2);

        if (start > 2) {
            pages.push('ellipsis');
        }

        for (page = start; page <= end; page++) {
            pages.push(page);
        }

        if (end < totalPages - 1) {
            pages.push('ellipsis');
        }

        pages.push(totalPages);
        return pages;
    },

    renderThreadFooter: function ($children, totalItems, currentPage, totalPages, shouldPaginate) {
        var $list = $children.children('.comment-thread-list');
        var $footer = $list.children('.comment-thread-footer');
        var $pagination;
        var pages;
        var isExpanded = $children.attr('data-thread-expanded') === 'true';

        if ($footer.length === 0) {
            $footer = $('<div class="comment-thread-footer"></div>');
            $list.append($footer);
        }

        $footer.empty();
        if (!isExpanded) {
            $footer
                .addClass('is-collapsed')
                .append('<button type="button" class="comment-thread-expand">查看全部 ' + totalItems + ' 条回复</button>');

            $footer.find('.comment-thread-expand').on('click', function () {
                $children.attr('data-thread-expanded', 'true');
                AjaxComment.renderThreadPage($children, currentPage);
            });
            return;
        }

        $footer.removeClass('is-collapsed');
        $footer.append('<span class="comment-thread-total">共 ' + totalItems + ' 条回复</span>');
        $pagination = $('<div class="comment-thread-pagination"></div>');

        if (shouldPaginate) {
            pages = AjaxComment.buildThreadPages(currentPage, totalPages);

            if (currentPage > 1) {
                $pagination.append('<button type="button" class="comment-thread-prev" data-thread-page="' + (currentPage - 1) + '">上一页</button>');
            }

            $.each(pages, function (_, page) {
                var $button;

                if (page === 'ellipsis') {
                    $pagination.append('<span class="comment-thread-ellipsis">...</span>');
                    return;
                }

                $button = $('<button type="button" class="comment-thread-page"></button>');
                $button.text(page);
                $button.attr('data-thread-page', page);

                if (page === currentPage) {
                    $button.addClass('is-active').attr('aria-current', 'page');
                }

                $pagination.append($button);
            });

            if (currentPage < totalPages) {
                $pagination.append('<button type="button" class="comment-thread-next" data-thread-page="' + (currentPage + 1) + '">下一页</button>');
            }
        }

        $pagination.append('<button type="button" class="comment-thread-collapse">收起</button>');
        $footer.append($pagination);

        $footer.find('button[data-thread-page]').on('click', function () {
            AjaxComment.renderThreadPage($children, parseInt($(this).attr('data-thread-page'), 10));
        });

        $footer.find('.comment-thread-collapse').on('click', function () {
            $children.attr('data-thread-expanded', 'false');
            AjaxComment.renderThreadPage($children, 1);
            if ($children.parent().attr('id')) {
                VOID_Ui.scrollToWithHeader('#' + $children.parent().attr('id'));
            }
        });
    },

    renderThreadPage: function ($children, targetPage) {
        var $list = $children.children('.comment-thread-list');
        var $items = $list.children('.comment-thread-item');
        var focusCommentId = String(AjaxComment.threadFocusPendingId || '');
        var parentCommentId = String($children.parent().attr('id') || '').replace(/^comment-/, '');
        var $newComment = focusCommentId ? $children.find('#comment-' + focusCommentId).first() : $();
        var totalItems = $items.length;
        var previewSize = AjaxComment.threadPreviewSize;
        var pageSize = AjaxComment.threadPageSize;
        var paginationThreshold = AjaxComment.threadPaginationThreshold;
        var canCollapseThread = totalItems > previewSize;
        var shouldPaginate = totalItems > paginationThreshold;
        var totalPages = shouldPaginate ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
        var shouldShowThreadFooter = canCollapseThread;
        var currentPage = targetPage || parseInt($children.attr('data-thread-page'), 10) || 1;
        var preferredPage = 0;
        var isExpanded = $children.attr('data-thread-expanded') === 'true';
        var shouldExpandForFocus = !!focusCommentId && (focusCommentId === parentCommentId || $newComment.length > 0);
        var startIndex;
        var endIndex;

        if ($newComment.length > 0) {
            preferredPage = shouldPaginate ? Math.ceil(($items.index($newComment) + 1) / pageSize) : 1;
        }

        if (shouldExpandForFocus) {
            isExpanded = true;
            AjaxComment.threadFocusPendingId = '';
        }

        if (preferredPage > 0) {
            currentPage = preferredPage;
        }

        if (!canCollapseThread) {
            isExpanded = true;
        } else if (totalPages > 1 && !$children.attr('data-thread-expanded') && !shouldExpandForFocus) {
            isExpanded = false;
        }

        if (!isExpanded) {
            currentPage = 1;
            startIndex = 0;
            endIndex = previewSize;
        } else if (!shouldPaginate) {
            currentPage = 1;
            startIndex = 0;
            endIndex = totalItems;
        } else {
            currentPage = Math.max(1, Math.min(currentPage, totalPages));
            startIndex = (currentPage - 1) * pageSize;
            endIndex = startIndex + pageSize;
        }

        $children.attr('data-thread-page', currentPage);
        $children.attr('data-thread-expanded', isExpanded ? 'true' : 'false');
        $children
            .toggleClass('is-thread-expanded', isExpanded)
            .toggleClass('is-thread-collapsed', canCollapseThread && !isExpanded)
            .toggleClass('no-thread-footer', !shouldShowThreadFooter);

        $items.each(function (index) {
            $(this)
                .attr('data-thread-index', index)
                .toggleClass('is-thread-hidden', index < startIndex || index >= endIndex);
        });

        if (!shouldShowThreadFooter) {
            $list.children('.comment-thread-footer').remove();
            return;
        }

        AjaxComment.renderThreadFooter($children, totalItems, currentPage, totalPages, shouldPaginate);
    },

    applyThreadPanels: function () {
        $('#comments > .comment-list > .comment-body.comment-parent').each(function () {
            var $parent = $(this);
            var $children = $parent.children('.comment-children');
            var $list;

            if ($children.length === 0) {
                return;
            }

            $list = AjaxComment.ensureThreadPanel($children);
            if ($list.length === 0) {
                return;
            }

            if (!$children.attr('data-thread-expanded')) {
                $children.attr('data-thread-expanded', 'false');
            }
            AjaxComment.renderThreadPage($children);
        });

        AjaxComment.threadFocusPendingId = '';
    },

    err: function () {
        $(AjaxComment.submitBtn).attr('disabled', false);
        AjaxComment.newID = '';
    },

    finish: function () {
        AjaxComment.cancelActiveReply();
        $(AjaxComment.submitBtn).html('提交评论');
        $(AjaxComment.textarea).val('');
        $(AjaxComment.submitBtn).attr('disabled', false);
        if ($('#comment-' + AjaxComment.newID).length > 0) {
            VOID_Ui.scrollToWithHeader('#comment-' + AjaxComment.newID);
            $('#comment-' + AjaxComment.newID).fadeTo(500, 1);
        }
        $('.comment-num .num').html(parseInt($('.comment-num .num').html()) + 1);
        AjaxComment.threadFocusPendingId = AjaxComment.newID;
        AjaxComment.bindClick();
        AjaxComment.applyThreadPanels();
        VOID_Content.highlight();
        VOID.initEmoteContent();
    },

    init: function () {
        AjaxComment.ensureTypechoCommentFacade();
        AjaxComment.bindPager();
        AjaxComment.bindHashChange();
        AjaxComment.bindClick();
        AjaxComment.syncThreadFocusFromHash(true);
        $(AjaxComment.commentForm).off('submit').on('submit', function () { // 提交事件
            $(AjaxComment.submitBtn).attr('disabled', true);

            /* 检查 */
            if ($(AjaxComment.commentForm).find('#author')[0]) {
                if ($(AjaxComment.commentForm).find('#author').val() == '') {
                    VOID.alert(AjaxComment.noName);
                    AjaxComment.err();
                    return false;
                }

                if (typeof $(AjaxComment.commentForm).find('#mail').attr('required') != 'undefined') {
                    // 需要邮箱
                    if ($(AjaxComment.commentForm).find('#mail').val() == '') {
                        VOID.alert(AjaxComment.noMail);
                        AjaxComment.err();
                        return false;
                    }
                }

                if ($(AjaxComment.commentForm).find('#mail').val() != '') {
                    var filter = /^[^@\s<&>]+@([a-z0-9]+\.)+[a-z]{2,4}$/i;
                    if (!filter.test($(AjaxComment.commentForm).find('#mail').val())) {
                        VOID.alert(AjaxComment.invalidMail);
                        AjaxComment.err();
                        return false;
                    }
                }

                if ($(AjaxComment.commentForm).find('#url').val() == ''
                    && typeof $(AjaxComment.commentForm).find('#url').attr('required') != 'undefined') {
                    VOID.alert(AjaxComment.noUrl);
                    AjaxComment.err();
                    return false;
                }
            }

            var textValue = $(AjaxComment.commentForm).find(AjaxComment.textarea).val().replace(/(^\s*)|(\s*$)/g, '');//检查空格信息
            if (textValue == null || textValue == '') {
                VOID.alert(AjaxComment.noContent);
                AjaxComment.err();
                return false;
            }
            $(AjaxComment.submitBtn).html('提交中');
            $.ajax({
                url: $(AjaxComment.commentForm).attr('action'),
                type: $(AjaxComment.commentForm).attr('method'),
                data: $(AjaxComment.commentForm).serializeArray(),
                error: function () {
                    VOID.alert('提交失败！请重试。');
                    $(AjaxComment.submitBtn).html('提交评论');
                    AjaxComment.err();
                    return false;
                },
                success: function (data) { //成功取到数据
                    try {
                        if (!$(AjaxComment.commentList, data).length) {
                            var msg = '提交失败！请重试。' + $($(data)[7]).text();
                            VOID.alert(msg);
                            $(AjaxComment.submitBtn).html('提交评论');
                            AjaxComment.err();
                            return false;
                        } else {
                            AjaxComment.newID = $(AjaxComment.commentList, data).html().match(/id="?comment-\d+/g).join().match(/\d+/g).sort(function (a, b) {
                                return a - b;
                            }).pop();

                            if (!AjaxComment.isNewestCommentPage() && AjaxComment.parentID == '') {
                                // 在分页对文章发表评论，无法取得最新评论内容
                                VOID.alert(AjaxComment.getCommentsOrder() === 'ASC'
                                    ? '评论成功！请前往评论最后一页查看。'
                                    : '评论成功！请回到评论第一页查看。');
                                AjaxComment.newID = '';
                                AjaxComment.parentID = '';
                                AjaxComment.finish();
                                return false;
                            }

                            var $newComment = $(data).find('#comment-' + AjaxComment.newID).first();
                            if (!$newComment.length) {
                                throw new Error('New comment is missing from the response');
                            }
                            $newComment.css('opacity', 0);

                            // 当页面无评论，先添加一个评论容器
                            if ($(AjaxComment.commentList).length <= 0) {
                                $('#comments').append('<h3 class="comment-separator"><div class="comment-tab-current"><span class="comment-num">已有 <span class="num">0</span> 条评论</span></div></h3>')
                                    .append('<div class="comment-list"></div>');
                            }

                            if (AjaxComment.parentID == '') {
                                // 无父 id，按后台评论顺序插入顶层评论
                                AjaxComment.insertNewestComment($('#comments > .comment-list').first(), $newComment);
                                VOID.alert('评论成功！');
                                AjaxComment.finish();
                                AjaxComment.newID = '';
                                return false;
                            } else {
                                if (!AjaxComment.insertReplyComment($newComment)) {
                                    throw new Error('Comment parent is missing from the current page');
                                }
                                VOID.alert('评论成功！');
                                AjaxComment.finish();
                                AjaxComment.parentID = '';
                                AjaxComment.newID = '';
                                return false;
                            }
                        }
                    } catch (e) {
                        window.location.reload();
                    }
                } // end success()
            }); // end ajax()
            return false;
        }); // end submit()
    }
};

(function () {
    $(document).ready(function () {
        if (VOIDConfig.PJAX) {
            VOID.bindPjaxLifecycle();
        }
        VOID.init();
    });

    window.setInterval(function () {
        var times = new Date().getTime() - Date.parse(VOIDConfig.buildTime);
        times = Math.floor(times / 1000); // convert total milliseconds into total seconds
        var days = Math.floor(times / (60 * 60 * 24)); //separate days
        times %= 60 * 60 * 24; //subtract entire days
        var hours = Math.floor(times / (60 * 60)); //separate hours
        times %= 60 * 60; //subtract entire hours
        var minutes = Math.floor(times / 60); //separate minutes
        times %= 60; //subtract entire minutes
        var seconds = Math.floor(times / 1); // remainder is seconds
        $('#uptime').html(days + ' 天 ' + hours + ' 小时 ' + minutes + ' 分 ' + seconds + ' 秒 ');
    }, 1000);
})();

// 复制到剪贴板（带 fallback）
function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    // fallback for non-HTTPS or older browsers
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(textarea);
    // 兼容早期 iOS
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    try {
        var success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success ? Promise.resolve() : Promise.reject(new Error('Copy failed'));
    } catch (e) {
        document.body.removeChild(textarea);
        return Promise.reject(e);
    }
}

var clipboardCopyIcon = '<svg aria-hidden="true" role="img" class="clipboard-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="display: inline-block; user-select: none; vertical-align: text-bottom;"><path fill-rule="evenodd" d="M5.75 1a.75.75 0 00-.75.75v3c0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75v-3a.75.75 0 00-.75-.75h-4.5zm.75 3V2.5h3V4h-3zm-2.874-.467a.75.75 0 00-.752-1.298A1.75 1.75 0 002 3.75v9.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 13.25v-9.5a1.75 1.75 0 00-.874-1.515.75.75 0 10-.752 1.298.25.25 0 01.126.217v9.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-9.5a.25.25 0 01.126-.217z"></path></svg>';

function loadClipboard() {
    $('pre').each(function () {
        if (!$(this).find('.clipboard').length) {
            $(this).prepend('<div class="clipboard" title="复制代码">' + clipboardCopyIcon + '</div>');
        }
    });
}

// 事件委托只绑定一次，PJAX 安全
$(document).ready(function () {
    loadClipboard();

    $('body').on('click', '.clipboard', function () {
        var btn = $(this);
        var code = btn.closest('pre').find('code').text() || btn.closest('pre').text();
        copyToClipboard(code).then(function () {
            VOID.alert('复制成功');
        }).catch(function () {
            VOID.alert('复制失败');
        });
    });
});

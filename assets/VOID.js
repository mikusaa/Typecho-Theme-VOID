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
    mathJaxLoadPromise: null,

    countWords: function () {
        var totalWordCount = document.getElementById('totalWordCount');
        var total = 0;
        var titles;

        if (!totalWordCount) {
            return;
        }

        titles = document.querySelectorAll('a.archive-title');
        for (var index = 0; index < titles.length; index++) {
            total += parseInt(titles[index].getAttribute('data-words'), 10);
        }

        totalWordCount.textContent = total;
    },

    // 解析文章目录
    parseTOC: function () {
        if (document.querySelector('.TOC')) {
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
            var tocLinks = document.querySelectorAll('.toc-link');
            for (var index = 0; index < tocLinks.length; index++) {
                var item = tocLinks[index];
                if (item._voidTocClickBound) {
                    continue;
                }

                item._voidTocClickBound = true;
                item.addEventListener('click', function (event) {
                    if (event.defaultPrevented
                        || (typeof event.button === 'number' && event.button !== 0)
                        || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                        return;
                    }

                    var href = this.getAttribute('href');
                    if (!href) {
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    VOID_Ui.scrollToWithHeader(href, 0, {
                        behavior: 'smooth',
                        stabilize: true
                    });
                    if (window.innerWidth < 1200) {
                        TOC.close();
                    }
                });
            }
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
        var details = document.querySelectorAll('article.yue details');

        for (var index = 0; index < details.length; index++) {
            var item = details[index];
            var hasSummary = false;
            for (var childIndex = 0; childIndex < item.children.length; childIndex++) {
                if (item.children[childIndex].tagName.toLowerCase() === 'summary') {
                    hasSummary = true;
                    break;
                }
            }

            if (hasSummary) {
                continue;
            }

            var summary = document.createElement('summary');
            summary.textContent = '展开详情';
            summary.setAttribute('data-void-generated', '');
            item.insertBefore(summary, item.firstChild);
        }
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

    revealBoardThumb: function (image) {
        var finish = function () {
            if (!image || image.isConnected === false || image.classList.contains('error')) {
                return;
            }

            image.__voidBoardThumbDecodePending = false;
            image.classList.remove('loading');
            image.classList.add('loaded');
        };

        if (window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            finish();
            return;
        }
        if (typeof window.requestAnimationFrame !== 'function') {
            finish();
            return;
        }

        window.requestAnimationFrame(function () {
            if (!image || image.isConnected === false || image.classList.contains('error')) {
                return;
            }
            window.requestAnimationFrame(finish);
        });
    },

    decodeBoardThumb: function (image) {
        var decodeResult;
        var settle;

        if (!image
            || image.classList.contains('error')
            || image.__voidBoardThumbDecodePending) {
            return;
        }

        image.__voidBoardThumbDecodePending = true;
        settle = function () {
            VOID_Content.revealBoardThumb(image);
        };

        if (typeof image.decode !== 'function') {
            settle();
            return;
        }

        try {
            decodeResult = image.decode();
        } catch (err) {
            settle();
            return;
        }

        if (decodeResult && typeof decodeResult.then === 'function') {
            decodeResult.then(settle, settle);
        } else {
            settle();
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
            image.addEventListener('load', function () {
                VOID_Content.decodeBoardThumb(this);
            });
            image.addEventListener('error', function () {
                this.__voidBoardThumbDecodePending = false;
                this.classList.remove('loading');
                this.classList.remove('loaded');
                this.classList.add('error');
                if (this.parentNode) {
                    this.parentNode.classList.add('error');
                }
            });

            if (VOIDConfig.lazyload) {
                image.setAttribute('loading', 'lazy');
                image.classList.add('loading');
            }

            item.appendChild(image);
            image.setAttribute('src', thumb);
        }
    },

    // 解析URL
    parseUrl: function () {
        var domain = document.domain;
        var links = document.querySelectorAll('a:not([href^="#"]):not(.post-like):not(.void-image-link)');
        var index;
        var item;

        for (index = 0; index < links.length; index++) {
            item = links[index];
            if (!item.getAttribute('target') && item.hostname != domain) {
                item.setAttribute('target', '_blank');
            }
        }

        if (VOIDConfig.PJAX) {
            links = document.querySelectorAll('a:not([target="_blank"]):not([no-pjax])');
            for (index = 0; index < links.length; index++) {
                item = links[index];
                if (item.hostname == domain) {
                    if (item.matches('.comments-container .pager a')) {
                        item.classList.remove('pjax');
                        continue;
                    }

                    item.classList.add('pjax');
                }
            }
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
        var codeBlocks = document.querySelectorAll('.yue pre code');

        for (var index = 0; index < codeBlocks.length; index++) {
            var item = codeBlocks[index];
            var classStr = item.getAttribute('class');

            if (classStr === null) {
                classStr = 'language-none';
            }

            if (classStr.indexOf('lang') == -1) {
                classStr += ' language-none';
            }

            item.setAttribute('class', classStr);
        }

        Prism.highlightAll();
    },

    restoreLittlefootReferenceIds: function () {
        var references = document.querySelectorAll('[data-lf-original-id]');

        for (var index = 0; index < references.length; index++) {
            var item = references[index];
            var originalId = item.getAttribute('data-lf-original-id');
            if (originalId !== null && originalId !== '') {
                item.setAttribute('id', originalId);
            }
            item.removeAttribute('data-lf-original-id');
        }
    },

    bridgeLittlefootBacklinks: function () {
        var buttons = document.querySelectorAll('.littlefoot__button[id^="lf-"]');

        for (var index = 0; index < buttons.length; index++) {
            var item = buttons[index];
            var originalId = item.id.replace(/^lf-/, '');
            if (originalId === '') {
                continue;
            }

            var printRef = document.getElementById(originalId);
            if (printRef && printRef.classList.contains('littlefoot--print')) {
                printRef.setAttribute('data-lf-original-id', originalId);
                printRef.setAttribute('id', 'lf-print-' + originalId);
            }

            item.setAttribute('id', originalId);
        }
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
        var footnotes = document.querySelectorAll('.littlefoot');
        var printReferences = document.querySelectorAll('sup.littlefoot--print, a.littlefoot--print');

        for (var index = 0; index < footnotes.length; index++) {
            self.cleanupPanguAroundNode(footnotes[index]);
        }

        for (index = 0; index < printReferences.length; index++) {
            self.cleanupPanguAroundNode(printReferences[index]);
        }
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
        var activeFootnotes = document.querySelectorAll('.littlefoot.littlefoot--active');

        for (var index = 0; index < activeFootnotes.length; index++) {
            activeFootnotes[index].classList.remove('littlefoot--active');
        }
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

    getMathContainer: function () {
        return document.getElementById('pjax-container') || document.body;
    },

    isMathDelimiterEscaped: function (text, index) {
        var slashCount = 0;

        for (index -= 1; index >= 0 && text.charAt(index) === '\\'; index--) {
            slashCount++;
        }

        return slashCount % 2 === 1;
    },

    hasMathDelimiterPair: function (text, opening, closing) {
        var openingIndex = text.indexOf(opening);
        var closingIndex;

        while (openingIndex !== -1) {
            if (!this.isMathDelimiterEscaped(text, openingIndex)) {
                closingIndex = text.indexOf(closing, openingIndex + opening.length);
                while (closingIndex !== -1) {
                    if (!this.isMathDelimiterEscaped(text, closingIndex)
                        && text.slice(openingIndex + opening.length, closingIndex).replace(/\s/g, '') !== '') {
                        return true;
                    }
                    closingIndex = text.indexOf(closing, closingIndex + closing.length);
                }
            }
            openingIndex = text.indexOf(opening, openingIndex + opening.length);
        }

        return false;
    },

    hasDollarMath: function (text) {
        var delimiterLength;
        var endIndex;
        var index;

        for (index = 0; index < text.length; index++) {
            if (text.charAt(index) !== '$' || this.isMathDelimiterEscaped(text, index)) {
                continue;
            }

            delimiterLength = text.charAt(index + 1) === '$' ? 2 : 1;
            if (delimiterLength === 1 && /\s/.test(text.charAt(index + 1))) {
                continue;
            }
            for (endIndex = index + delimiterLength; endIndex < text.length; endIndex++) {
                if (text.charAt(endIndex) !== '$' || this.isMathDelimiterEscaped(text, endIndex)) {
                    continue;
                }

                if (delimiterLength === 2) {
                    if (text.charAt(endIndex + 1) !== '$') {
                        continue;
                    }
                } else if (text.charAt(endIndex - 1) === '$'
                    || text.charAt(endIndex + 1) === '$'
                    || /\s/.test(text.charAt(endIndex - 1))) {
                    continue;
                }

                if (text.slice(index + delimiterLength, endIndex).replace(/\s/g, '') !== '') {
                    return true;
                }
            }

            if (delimiterLength === 2) {
                index++;
            }
        }

        return false;
    },

    hasMathText: function (text) {
        var environmentPattern = /\\begin\s*\{[^{}\s]+\}/g;
        var environmentMatch;

        if (!text) {
            return false;
        }

        if (this.hasMathDelimiterPair(text, '\\(', '\\)')
            || this.hasMathDelimiterPair(text, '\\[', '\\]')
            || this.hasDollarMath(text)) {
            return true;
        }

        while ((environmentMatch = environmentPattern.exec(text)) !== null) {
            if (!this.isMathDelimiterEscaped(text, environmentMatch.index)) {
                return true;
            }
        }

        return false;
    },

    hasMath: function (container) {
        var ignoredElements = {
            CODE: true,
            'MJX-CONTAINER': true,
            NOSCRIPT: true,
            PRE: true,
            SCRIPT: true,
            STYLE: true,
            TEMPLATE: true,
            TEXTAREA: true
        };
        var self = this;

        function visit(node) {
            var child;
            var nodeName;

            if (!node) {
                return false;
            }

            if (node.nodeType === 3) {
                return self.hasMathText(node.nodeValue || node.textContent || '');
            }

            nodeName = String(node.nodeName || node.tagName || '').toUpperCase();
            if (ignoredElements[nodeName]) {
                return false;
            }

            for (child = node.firstChild; child; child = child.nextSibling) {
                if (visit(child)) {
                    return true;
                }
            }

            return false;
        }

        return !!container && visit(container);
    },

    isMathJaxReady: function () {
        var mathJax = window.MathJax;

        return !!(mathJax && mathJax.startup && mathJax.startup.promise
            && typeof mathJax.typesetPromise === 'function');
    },

    configureMathJax: function () {
        window.MathJax = {
            startup: {
                typeset: false
            },
            tex: {
                inlineMath: [['$', '$'], ['\\(', '\\)']],
                displayMath: [['$$', '$$'], ['\\[', '\\]']],
                processEscapes: true
            },
            svg: {
                fontCache: 'global'
            }
        };
    },

    loadMathJax: function () {
        var existingScript;
        var self = this;

        if (!VOIDConfig.enableMath || !VOIDConfig.mathJaxUrl) {
            return null;
        }

        if (this.isMathJaxReady()) {
            return Promise.resolve(window.MathJax);
        }

        if (this.mathJaxLoadPromise) {
            return this.mathJaxLoadPromise;
        }

        existingScript = document.getElementById('MathJax-script');
        if (existingScript && existingScript.parentNode) {
            existingScript.parentNode.removeChild(existingScript);
        }

        this.configureMathJax();
        this.mathJaxLoadPromise = new Promise(function (resolve) {
            var parent = document.head || document.documentElement;
            var script = document.createElement('script');

            script.id = 'MathJax-script';
            script.async = true;
            script.src = VOIDConfig.mathJaxUrl;
            script.setAttribute('data-void-mathjax', '');
            script.onload = function () {
                if (self.isMathJaxReady()) {
                    resolve(window.MathJax);
                    return;
                }

                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                self.mathJaxLoadPromise = null;
                window.MathJax = null;
                console.error('MathJax loaded without the expected typesetting API.');
                resolve(null);
            };
            script.onerror = function () {
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                self.mathJaxLoadPromise = null;
                window.MathJax = null;
                console.error('MathJax failed to load.');
                resolve(null);
            };

            parent.appendChild(script);
        });

        return this.mathJaxLoadPromise;
    },

    prepareMath: function (container) {
        if (!VOIDConfig.enableMath || !VOIDConfig.mathJaxUrl || !this.hasMath(container)) {
            return null;
        }

        return this.loadMathJax();
    },

    isCurrentMathContainer: function (container, generation) {
        if (!container || container.isConnected === false) {
            return false;
        }

        if (typeof generation === 'number' && generation !== VOID.typographyGeneration) {
            return false;
        }

        return container === this.getMathContainer();
    },

    math: function (container, generation, loadPromise) {
        var self = this;

        container = container || this.getMathContainer();
        if (arguments.length < 3) {
            loadPromise = this.prepareMath(container);
        }

        if (!loadPromise || typeof loadPromise.then !== 'function') {
            return;
        }

        loadPromise.then(function (mathJax) {
            if (!mathJax || !self.isCurrentMathContainer(container, generation)) {
                return;
            }

            mathJax.startup.promise = mathJax.startup.promise
                .then(function () {
                    if (!self.isCurrentMathContainer(container, generation)) {
                        return;
                    }
                    if (typeof mathJax.typesetClear === 'function') {
                        mathJax.typesetClear([container]);
                    }
                    return mathJax.typesetPromise([container]);
                })
                .catch(function (err) {
                    console.error('MathJax typeset failed:', err);
                });
        });
    },

    clearMath: function (container) {
        if (!container || !this.isMathJaxReady()
            || typeof window.MathJax.typesetClear !== 'function') {
            return;
        }

        try {
            window.MathJax.typesetClear([container]);
        } catch (err) {
            console.error('MathJax clear failed:', err);
        }
    },

    hyphenate: function () {
        if (!window.Hypher || typeof window.Hypher.hyphenateElement !== 'function') {
            return;
        }

        var paragraphs = document.querySelectorAll('div.articleBody p, div.articleBody blockquote');
        for (var index = 0; index < paragraphs.length; index++) {
            var item = paragraphs[index];
            var text = item.textContent || '';

            // Alert markup and fallback markers are structured content, not prose to hyphenate.
            if (item.closest('.void-alert') || /\[!|\[\/?notice\b/i.test(text)) {
                continue;
            }

            // 避免在 MathJax 解析前把 TeX 命令打断（如 \begin 被插入软连字符）
            if (/\\begin\{|\\\(|\\\[|(^|[^\\])\$\$|(^|[^\\])\$/.test(text)) {
                continue;
            }

            window.Hypher.hyphenateElement(item, 'en-us');
        }
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

    getScrollPadding: function (set) {
        var style = window.getComputedStyle && window.getComputedStyle(set);
        var padding = style ? parseFloat(style.paddingLeft) : NaN;

        return padding >= 0 && isFinite(padding) ? padding : 20;
    },

    createStripControls: function (set) {
        var parent = set && set.parentNode;
        var frame;
        var controls;
        var previousButton;
        var nextButton;
        var createButton = function (className, attribute, label, iconClass) {
            var button = document.createElement('button');
            var icon = document.createElement('i');

            button.className = 'void-photo-strip-control ' + className;
            button.setAttribute('type', 'button');
            button.setAttribute(attribute, '');
            button.setAttribute('aria-label', label);
            icon.className = iconClass;
            icon.setAttribute('aria-hidden', 'true');
            button.appendChild(icon);
            return button;
        };

        if (!parent || typeof parent.insertBefore !== 'function' || typeof document.createElement !== 'function') {
            return null;
        }

        frame = document.createElement('div');
        frame.className = 'void-photo-strip-frame';
        frame.setAttribute('data-void-photo-strip-frame', '');
        controls = document.createElement('div');
        controls.className = 'void-photo-strip-controls';
        previousButton = createButton(
            'void-photo-strip-control--prev',
            'data-void-photo-prev',
            '滚动到上一张图片',
            'voidicon-left'
        );
        nextButton = createButton(
            'void-photo-strip-control--next',
            'data-void-photo-next',
            '滚动到下一张图片',
            'voidicon-right'
        );

        parent.insertBefore(frame, set);
        frame.appendChild(controls);
        controls.appendChild(previousButton);
        controls.appendChild(nextButton);
        frame.appendChild(set);

        return {
            controls: controls,
            frame: frame,
            nextButton: nextButton,
            previousButton: previousButton
        };
    },

    updateStripControls: function (record) {
        var set = record && record.set;
        var maxScroll;
        var scrollLeft;
        var hasOverflow;
        var atStart;
        var atEnd;

        if (!set || !record.previousButton || !record.nextButton) {
            return;
        }

        maxScroll = Math.max(0, (parseFloat(set.scrollWidth) || 0) - (parseFloat(set.clientWidth) || 0));
        scrollLeft = Math.max(0, parseFloat(set.scrollLeft) || 0);
        hasOverflow = maxScroll > 1;
        atStart = scrollLeft <= 1;
        atEnd = scrollLeft >= maxScroll - 1;

        record.previousButton.hidden = !hasOverflow || atStart;
        record.nextButton.hidden = !hasOverflow || atEnd;
        record.previousButton.disabled = !hasOverflow || atStart;
        record.nextButton.disabled = !hasOverflow || atEnd;
        if (hasOverflow) {
            record.frame.classList.add('is-overflowing');
        } else {
            record.frame.classList.remove('is-overflowing');
        }
    },

    scrollToPhoto: function (record, direction) {
        var set = record && record.set;
        var figures;
        var setRect;
        var current;
        var padding;
        var anchor = -1;
        var targetIndex;
        var target;
        var targetRect;
        var targetStart;
        var maxScroll;
        var index;
        var itemRect;
        var itemStart;
        var behavior;

        if (!set || !direction) {
            return;
        }

        current = Math.max(0, parseFloat(set.scrollLeft) || 0);
        maxScroll = Math.max(0, (parseFloat(set.scrollWidth) || 0) - (parseFloat(set.clientWidth) || 0));
        figures = set.querySelectorAll ? set.querySelectorAll('figure[data-void-image-item]') : [];
        target = current + (direction > 0 ? Math.max(1, (parseFloat(set.clientWidth) || 320) * 0.85) : -Math.max(1, (parseFloat(set.clientWidth) || 320) * 0.85));

        if (figures.length && typeof set.getBoundingClientRect === 'function') {
            setRect = set.getBoundingClientRect();
            padding = this.getScrollPadding(set);
            for (index = 0; index < figures.length; index++) {
                itemRect = figures[index].getBoundingClientRect();
                itemStart = itemRect.left - setRect.left + current;
                if (itemStart <= current + padding + 4) {
                    anchor = index;
                } else {
                    break;
                }
            }
            if (anchor < 0) {
                anchor = 0;
            }
            targetIndex = direction > 0
                ? Math.min(figures.length - 1, anchor + 1)
                : Math.max(0, anchor - 1);
            if (targetIndex !== anchor) {
                targetRect = figures[targetIndex].getBoundingClientRect();
                targetStart = targetRect.left - setRect.left + current;
                target = targetStart - padding;
            }
        }

        target = Math.max(0, Math.min(maxScroll, target));
        if (Math.abs(target - current) <= 0.5) {
            this.updateStripControls(record);
            return;
        }

        behavior = this.isReducedMotion() ? 'auto' : 'smooth';
        if (typeof set.scrollTo === 'function') {
            try {
                set.scrollTo({ left: target, behavior: behavior });
            } catch (error) {
                set.scrollLeft = target;
            }
        } else {
            set.scrollLeft = target;
        }
        this.updateStripControls(record);
    },

    enhanceSet: function (set) {
        var self = this;
        var record;
        var controls;

        if (set.getAttribute('data-void-photo-layout') !== 'strip') {
            return;
        }

        controls = this.createStripControls(set);

        record = {
            set: set,
            frame: controls ? controls.frame : null,
            controls: controls ? controls.controls : null,
            previousButton: controls ? controls.previousButton : null,
            nextButton: controls ? controls.nextButton : null,
            active: false,
            dragging: false,
            captured: false,
            pointerId: null,
            startX: 0,
            startScrollLeft: 0,
            suppressClickUntil: 0,
            onScroll: null,
            onResize: null,
            onLoad: null,
            onPreviousClick: null,
            onNextClick: null
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

        record.onScroll = function () {
            self.updateStripControls(record);
        };

        record.onResize = function () {
            self.updateStripControls(record);
        };

        record.onLoad = function () {
            self.updateStripControls(record);
        };

        record.onPreviousClick = function (event) {
            event.preventDefault();
            self.scrollToPhoto(record, -1);
        };

        record.onNextClick = function (event) {
            event.preventDefault();
            self.scrollToPhoto(record, 1);
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
        set.addEventListener('scroll', record.onScroll, { passive: true });
        set.addEventListener('load', record.onLoad, true);
        window.addEventListener('resize', record.onResize);
        if (record.previousButton) {
            record.previousButton.addEventListener('click', record.onPreviousClick);
            record.nextButton.addEventListener('click', record.onNextClick);
        }
        this.setBindings.push(record);
        this.updateStripControls(record);
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
            record.set.removeEventListener('scroll', record.onScroll, { passive: true });
            record.set.removeEventListener('load', record.onLoad, true);
            window.removeEventListener('resize', record.onResize);
            if (record.previousButton) {
                record.previousButton.removeEventListener('click', record.onPreviousClick);
                record.nextButton.removeEventListener('click', record.onNextClick);
            }
            if (record.frame && record.frame.parentNode) {
                record.frame.parentNode.insertBefore(record.set, record.frame);
                record.frame.parentNode.removeChild(record.frame);
            }
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

var VOID_PhotoSwipe = {
    root: null,
    lightbox: null,
    handlers: null,
    sourceLink: null,
    isDestroying: false,

    getSafeAreaInset: function (side) {
        var element = window.pswp && window.pswp.element;
        var style;
        var value;

        if (!element && document.querySelector) {
            element = document.querySelector('.void-photoswipe');
        }
        if (!element || !window.getComputedStyle) {
            return 0;
        }

        style = window.getComputedStyle(element);
        value = style && style.getPropertyValue
            ? parseFloat(style.getPropertyValue('--void-pswp-safe-' + side))
            : NaN;
        return Number.isFinite(value) && value >= 0 ? value : 0;
    },

    getPadding: function (viewportSize) {
        var isMobile = viewportSize && viewportSize.x <= 600;
        var verticalPadding = isMobile ? 16 : 24;
        var horizontalPadding = isMobile ? 12 : 24;

        return {
            top: Math.max(verticalPadding, this.getSafeAreaInset('top')),
            right: Math.max(horizontalPadding, this.getSafeAreaInset('right')),
            bottom: Math.max(verticalPadding, this.getSafeAreaInset('bottom')),
            left: Math.max(horizontalPadding, this.getSafeAreaInset('left'))
        };
    },

    findLink: function (target) {
        while (target) {
            if (target.getAttribute && target.hasAttribute('data-void-image-zoom')) {
                return target;
            }
            if (target === this.root) {
                break;
            }
            target = target.parentNode;
        }
        return null;
    },

    findAncestor: function (element, predicate) {
        while (element) {
            if (predicate(element)) {
                return element;
            }
            if (element === this.root) {
                break;
            }
            element = element.parentNode;
        }
        return null;
    },

    getGroupElement: function (link) {
        var gallerySet = this.findAncestor(link, function (element) {
            return !!(element.hasAttribute && element.hasAttribute('data-void-gallery-set'));
        });
        var article;

        if (gallerySet) {
            return gallerySet;
        }

        article = this.findAncestor(link, function (element) {
            return !!(element.tagName && element.tagName.toLowerCase() === 'article');
        });
        return article || link;
    },

    getGroupLinks: function (link) {
        var group = this.getGroupElement(link);

        if (!group || group === link || typeof group.querySelectorAll !== 'function') {
            return [link];
        }
        return Array.prototype.slice.call(group.querySelectorAll('a[data-void-image-zoom]'));
    },

    getSourceImage: function (link) {
        return link && link.querySelector ? link.querySelector('img[data-void-image-content]') : null;
    },

    getImageFigure: function (link) {
        return this.findAncestor(link, function (element) {
            return !!(element.hasAttribute && element.hasAttribute('data-void-image-item'));
        });
    },

    parseDimension: function (value) {
        var dimension = parseInt(value, 10);
        return isFinite(dimension) && dimension > 0 ? dimension : 0;
    },

    resolveDisplayDimensions: function (link, image) {
        var figure = this.getImageFigure(link);
        var width = figure ? this.parseDimension(figure.getAttribute('data-void-image-width')) : 0;
        var height = figure ? this.parseDimension(figure.getAttribute('data-void-image-height')) : 0;

        if (!width || !height) {
            width = this.parseDimension(image && image.getAttribute('width'));
            height = this.parseDimension(image && image.getAttribute('height'));
        }
        return width && height ? { width: width, height: height } : null;
    },

    resolveNaturalDimensions: function (image) {
        var width = this.parseDimension(image && image.naturalWidth);
        var height = this.parseDimension(image && image.naturalHeight);

        return width && height ? { width: width, height: height } : null;
    },

    resolveDimensions: function (link, image) {
        return this.resolveNaturalDimensions(image)
            || this.resolveDisplayDimensions(link, image);
    },

    applyDimensions: function (itemData, dimensions) {
        if (!itemData || !dimensions) {
            return;
        }
        itemData.width = dimensions.width;
        itemData.height = dimensions.height;
        itemData.w = dimensions.width;
        itemData.h = dimensions.height;
    },

    syncLoadedDimensions: function (event) {
        var content = event && event.content;
        var slide = event && event.slide;
        var contentChanged;
        var slideChanged;
        var dimensions;

        if (!content || event.isError) {
            return false;
        }

        dimensions = this.resolveNaturalDimensions(content.element);
        if (!dimensions) {
            return false;
        }

        contentChanged = content.width !== dimensions.width
            || content.height !== dimensions.height;
        slide = slide || content.slide;
        slideChanged = !!(slide && (slide.width !== dimensions.width
            || slide.height !== dimensions.height));
        this.applyDimensions(content.data, dimensions);
        if (slide) {
            this.applyDimensions(slide.data, dimensions);
        }
        if (!contentChanged && !slideChanged) {
            return true;
        }

        content.width = dimensions.width;
        content.height = dimensions.height;

        if (!slide) {
            return true;
        }

        slide.width = dimensions.width;
        slide.height = dimensions.height;
        slide.currentResolution = 0;
        if (typeof slide.calculateSize === 'function') {
            slide.calculateSize();
        }
        if (slide.isActive && typeof slide.zoomAndPanToInitial === 'function') {
            slide.zoomAndPanToInitial();
        }
        if (typeof slide.updateContentSize === 'function') {
            slide.updateContentSize(true);
        }
        if (slide.isActive && typeof slide.applyCurrentZoomPan === 'function') {
            slide.applyCurrentZoomPan();
        }
        return true;
    },

    getPreviewSource: function (image) {
        return (image && (image.currentSrc || image.getAttribute('src'))) || '';
    },

    isCroppedThumbnail: function (image, width, height) {
        var style = window.getComputedStyle && image ? window.getComputedStyle(image) : null;
        var rect = image && image.getBoundingClientRect ? image.getBoundingClientRect() : null;
        var sourceRatio;
        var thumbnailRatio;

        if (style && style.objectFit === 'cover') {
            return true;
        }
        if (!rect || !isFinite(rect.width) || !isFinite(rect.height)
            || rect.width <= 0 || rect.height <= 0) {
            return false;
        }

        sourceRatio = width / height;
        thumbnailRatio = rect.width / rect.height;
        return Math.abs(thumbnailRatio - sourceRatio) / sourceRatio > 0.01;
    },

    getItemData: function (link) {
        var image = this.getSourceImage(link);
        var dimensions = this.resolveDimensions(link, image);
        var source = link && (link.href || link.getAttribute('href'));
        var previewSource;
        var itemData;

        if (!image || !dimensions || !source) {
            return null;
        }

        previewSource = this.getPreviewSource(image);
        if (previewSource && image.complete && image.naturalWidth === 0) {
            return null;
        }

        itemData = {
            src: source,
            width: dimensions.width,
            height: dimensions.height,
            w: dimensions.width,
            h: dimensions.height,
            alt: image.getAttribute('alt') || '',
            element: link,
            thumbCropped: this.isCroppedThumbnail(image, dimensions.width, dimensions.height)
        };
        if (previewSource) {
            itemData.msrc = previewSource;
        }
        return itemData;
    },

    getDataSource: function (link) {
        var links = this.getGroupLinks(link);
        var items = [];
        var index = -1;
        var linkIndex;

        for (linkIndex = 0; linkIndex < links.length; linkIndex++) {
            var itemData = this.getItemData(links[linkIndex]);
            if (!itemData) {
                continue;
            }
            if (links[linkIndex] === link) {
                index = items.length;
            }
            items.push(itemData);
        }

        return index >= 0 ? { items: items, index: index } : null;
    },

    canActivate: function (link, event) {
        var target;

        if (!this.lightbox || !link || !event || event.defaultPrevented) {
            return false;
        }
        if (typeof event.button === 'number' && event.button !== 0) {
            return false;
        }
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
            || link.hasAttribute('download')) {
            return false;
        }

        target = (link.getAttribute('target') || '').toLowerCase();
        if (target === '_blank' || !link.getAttribute('href')) {
            return false;
        }
        if (this.root && this.root.contains && !this.root.contains(link)) {
            return false;
        }
        return !!this.getItemData(link);
    },

    getInitialPoint: function (event) {
        if (!event || (!event.clientX && !event.clientY)) {
            return null;
        }
        return { x: event.clientX, y: event.clientY };
    },

    open: function (link, event) {
        var dataSource = this.getDataSource(link);
        var opened;

        if (!dataSource || !this.lightbox) {
            return false;
        }

        try {
            opened = this.lightbox.loadAndOpen(
                dataSource.index,
                dataSource.items,
                this.getInitialPoint(event)
            );
        } catch (error) {
            return false;
        }
        if (opened) {
            this.sourceLink = link;
        }
        return opened;
    },

    restoreSourceFocus: function () {
        var sourceLink = this.sourceLink;

        this.sourceLink = null;
        if (this.isDestroying || !sourceLink || !this.root
            || (this.root.contains && !this.root.contains(sourceLink))
            || typeof sourceLink.focus !== 'function') {
            return;
        }

        try {
            sourceLink.focus({ preventScroll: true });
        } catch (error) {
            sourceLink.focus();
        }
    },

    isViewerControlTarget: function (target, viewer) {
        var tagName;

        if (!target || !viewer || !viewer.contains || !viewer.contains(target)) {
            return false;
        }

        while (target && target !== viewer) {
            tagName = target.tagName ? target.tagName.toLowerCase() : '';
            if (tagName === 'button' || tagName === 'a' || tagName === 'input'
                || tagName === 'select' || tagName === 'textarea'
                || target.isContentEditable
                || (target.getAttribute
                    && target.getAttribute('contenteditable') === 'true')) {
                return true;
            }
            target = target.parentNode;
        }
        return false;
    },

    handleKeydown: function (event) {
        var originalEvent = event && event.originalEvent;
        var pswp = this.lightbox && this.lightbox.pswp;
        var key = originalEvent && originalEvent.key;

        if (!originalEvent || !pswp
            || (key !== ' ' && key !== 'Spacebar' && key !== 'Enter')
            || originalEvent.ctrlKey || originalEvent.metaKey
            || originalEvent.altKey || originalEvent.shiftKey
            || this.isViewerControlTarget(originalEvent.target, pswp.element)) {
            return false;
        }

        if (event.preventDefault) {
            event.preventDefault();
        }
        if (originalEvent.preventDefault) {
            originalEvent.preventDefault();
        }
        pswp.close();
        return true;
    },

    getOptions: function () {
        return {
            pswpModule: window.PhotoSwipe,
            mainClass: 'void-photoswipe',
            bgOpacity: 1,
            paddingFn: function (viewportSize) {
                return VOID_PhotoSwipe.getPadding(viewportSize);
            },
            returnFocus: false,
            closeTitle: '关闭图片预览',
            zoomTitle: '切换图片缩放',
            arrowPrevTitle: '上一张图片',
            arrowNextTitle: '下一张图片',
            errorMsg: '图片加载失败'
        };
    },

    init: function (root) {
        var self = this;

        this.destroy();
        this.root = root || document.getElementById('pjax-container') || document;
        if (!this.root || typeof this.root.querySelector !== 'function'
            || !this.root.querySelector('a[data-void-image-zoom]')
            || typeof window.PhotoSwipe !== 'function'
            || typeof window.PhotoSwipeLightbox !== 'function') {
            return;
        }

        try {
            this.lightbox = new window.PhotoSwipeLightbox(this.getOptions());
            this.lightbox.on('destroy', function () {
                self.restoreSourceFocus();
            });
            this.lightbox.on('keydown', function (event) {
                self.handleKeydown(event);
            });
            this.lightbox.on('loadComplete', function (event) {
                self.syncLoadedDimensions(event);
            });
            this.lightbox.on('contentAppendImage', function (event) {
                self.syncLoadedDimensions(event);
            });
            this.lightbox.init();
        } catch (error) {
            this.lightbox = null;
            return;
        }

        this.handlers = {
            click: function (event) {
                var link = self.findLink(event.target);
                if (self.canActivate(link, event) && self.open(link, event)) {
                    event.preventDefault();
                }
            }
        };
        this.root.addEventListener('click', this.handlers.click, false);
    },

    destroy: function () {
        if (this.root && this.handlers) {
            this.root.removeEventListener('click', this.handlers.click, false);
        }
        if (this.lightbox) {
            this.isDestroying = true;
            this.lightbox.destroy();
            this.isDestroying = false;
        }

        this.root = null;
        this.lightbox = null;
        this.handlers = null;
        this.sourceLink = null;
        this.isDestroying = false;
    },

    __test: {
        getGroupElement: function (link) {
            return VOID_PhotoSwipe.getGroupElement(link);
        },
        getDataSource: function (link) {
            return VOID_PhotoSwipe.getDataSource(link);
        },
        getItemData: function (link) {
            return VOID_PhotoSwipe.getItemData(link);
        },
        syncLoadedDimensions: function (event) {
            return VOID_PhotoSwipe.syncLoadedDimensions(event);
        },
        getPadding: function (viewportSize) {
            return VOID_PhotoSwipe.getPadding(viewportSize);
        },
        handleKeydown: function (event) {
            return VOID_PhotoSwipe.handleKeydown(event);
        },
        getOptions: function () {
            return VOID_PhotoSwipe.getOptions();
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
    pjaxLifecycleHandlers: null,
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
        var container = VOID_Content.getMathContainer();
        var mathJaxLoadPromise = VOID_Content.prepareMath(container);
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
            VOID_Content.math(container, generation, mathJaxLoadPromise);
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

        for (index = detail && detail.args && typeof detail.args.length === 'number'
            ? detail.args.length - 1 : -1; index >= 0; index--) {
            if (detail.args[index]
                && typeof detail.args[index] === 'object'
                && detail.args[index].container) {
                return detail.args[index];
            }
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

        this.pjaxLifecycleHandlers = {
            send: function () {
                var options = VOID.resolvePjaxOptions(arguments);

                if (AjaxComment.isCommentPjaxRequest(options)) {
                    AjaxComment.cancelSubmit();
                    VOID.destroyEmotes();
                    AjaxComment.setCommentPageLoading(true);
                    return;
                }

                if (VOID.isMainPjaxRequest(options)) {
                    AjaxComment.cancelSubmit();
                    VOID.beforePjax();
                }
            },
            beforeReplace: function () {
                var options = VOID.resolvePjaxOptions(arguments);

                if (AjaxComment.isCommentPjaxRequest(options)) {
                    AjaxComment.beforePjaxReplace();
                    return;
                }

                if (VOID.isMainPjaxRequest(options)) {
                    AjaxComment.beforePjaxReplace();
                    VOID.beforePjaxReplace();
                }
            },
            complete: function () {
                var options = VOID.resolvePjaxOptions(arguments);

                if (AjaxComment.isCommentPjaxRequest(options)) {
                    AjaxComment.afterPagePjax(options);
                    return;
                }

                if (VOID.isMainPjaxRequest(options)) {
                    VOID.afterPjax(options);
                }
            },
            abort: function () {
                var options = VOID.resolvePjaxOptions(arguments);

                if (VOID.isMainPjaxRequest(options)) {
                    VOID.afterPjax();
                }
            },
            end: function () {
                var options = VOID.resolvePjaxOptions(arguments);

                if (AjaxComment.isCommentPjaxRequest(options)) {
                    AjaxComment.endPagePjax();
                    return;
                }

                if (VOID.isMainPjaxRequest(options)) {
                    VOID.endPjax();
                }
            }
        };

        document.addEventListener('pjax:send', this.pjaxLifecycleHandlers.send);
        document.addEventListener('pjax:beforeReplace', this.pjaxLifecycleHandlers.beforeReplace);
        document.addEventListener('pjax:complete', this.pjaxLifecycleHandlers.complete);
        document.addEventListener('pjax:abort', this.pjaxLifecycleHandlers.abort);
        document.addEventListener('pjax:end', this.pjaxLifecycleHandlers.end);
        this.pjaxLifecycleBound = true;
    },

    unbindPjaxLifecycle: function () {
        var handlers = this.pjaxLifecycleHandlers;

        if (!handlers) {
            this.pjaxLifecycleBound = false;
            return;
        }

        document.removeEventListener('pjax:send', handlers.send);
        document.removeEventListener('pjax:beforeReplace', handlers.beforeReplace);
        document.removeEventListener('pjax:complete', handlers.complete);
        document.removeEventListener('pjax:abort', handlers.abort);
        document.removeEventListener('pjax:end', handlers.end);
        this.pjaxLifecycleHandlers = null;
        this.pjaxLifecycleBound = false;
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
        VOID_Content.parseBoardThumbs();
        VOID_Gallery.init();
        VOID_PhotoSets.init();
        VOID_PhotoSwipe.init();
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
        VOID_Ui.checkScrollTop();

        VOID_Ui.bindDismissEvents();
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
        if (typeof VOID_AnchorScroller !== 'undefined') {
            VOID_AnchorScroller.stop();
        }
        NProgress.start();
        VOID_RewardDialog.destroy();
        VOID_PhotoSwipe.destroy();
        VOID_Gallery.suspend();
        VOID_PhotoSets.destroy();
        VOID.destroyEmotes();
        VOID_Ui.reset();
    },

    beforePjaxReplace: function () {
        VOID_Content.clearMath(VOID_Content.getMathContainer());
        VOID_Ui.MasonryCtrler.destroy();
    },

    // PJAX 结束后
    afterPjax: function () {
        NProgress.done();
	
        VOID_Content.parseBoardThumbs();

        VOID_Gallery.init();
        VOID_PhotoSets.init();
        VOID_PhotoSwipe.init();
        VOID_RewardDialog.init();

        VOID_Ui.invalidateLoginAction();

        if (typeof VOID_CardCover !== 'undefined') {
            VOID_CardCover.init(document.getElementById('pjax-container'));
        }
        VOID_Ui.MasonryCtrler.init();
        VOID_Ui.lazyload();

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
        VOID_Ui.checkScrollTop();
    },

    endPjax: function () {
        if ($('.TOC').length < 1) {
            TOC.close();
        }
    },

    alert: function (content, time) {
        var id = new Date().getTime();
        var message = document.createElement('div');
        var messages;
        var messageHeight;
        message.className = 'msg';
        message.id = 'msg' + id;
        message.textContent = content == null ? '' : String(content);
        document.body.insertBefore(message, document.body.firstChild);
        messages = document.querySelectorAll('.msg');
        messageHeight = message.offsetHeight;
        for (var index = 0; index < messages.length; index++) {
            if (messages[index] !== message) {
                messages[index].style.top = messages[index].getBoundingClientRect().top
                    + messageHeight + 20 + 'px';
            }
        }
        message.classList.add('show');
        var t = time;
        if (typeof (t) != 'number') {
            t = 2500;
        }
        setTimeout(function () {
            message.classList.add('hide');
            setTimeout(function () {
                message.remove();
            }, 1000);
        }, t);
    },

    startSearch: function (item) {
        item = typeof item === 'string' ? document.querySelector(item) : item;
        if (!item) {
            return;
        }

        var c = item.value;
        item.value = '';
        item.blur();
        if (!c || c == '') {
            item.setAttribute('placeholder', '你还没有输入任何信息');
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

    enterSearch: function (item, event) {
        event = event || window.event;
        if (event && (event.key === 'Enter' || event.keyCode == 13)) {
            VOID.startSearch(item);
        }
    }
};

var VOID_Vote = {
    pendingItems: new WeakSet(),

    vote: function (item) {
        var type = item.getAttribute('data-type');
        var id = item.getAttribute('data-item-id');
        var table = item.getAttribute('data-table');

        var cookieName = 'void_vote_' + table + '_' + type;
        var voted = VOID_Util.getCookie(cookieName);
        if (voted == null) voted = ',';

        // 首先检查本地 cookie
        if (voted.indexOf(',' + id + ',') != -1) {
            item.classList.add('done');
            VOID.alert('您已经投过票了~');
            return;
        }

        // 当是评论投票时检查是否已经投过另一个选项
        if (item.classList.contains('comment-vote')) {
            var type_2 = type == 'up' ? 'down' : 'up';
            if (VOID_Vote.checkVoted(type_2, id, table)) {
                VOID.alert('暂不支持更改投票哦～');
                return;
            }
        }

        if (VOID_Vote.pendingItems.has(item)) {
            return;
        }
        VOID_Vote.pendingItems.add(item);

        return window.fetch(VOIDConfig.votePath + table, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                'id': parseInt(id),
                'type': type
            })
        }).then(function (response) {
            if (!response.ok) {
                throw new Error('Vote request failed');
            }
            return response.json();
        }).then(function (data) {
            if (!data || typeof data.code !== 'number') {
                throw new Error('Invalid vote response');
            }
            if (data.code >= 200 && data.code < 400) {
                item.classList.add('done');
                voted += id + ',';
                VOID_Util.setCookie(cookieName, voted, 3600 * 24 * 90);
            }
            switch (data.code) {
                case 200:
                    var value = item.querySelector('.value');
                    if (value) {
                        value.textContent = parseInt(value.textContent) + 1;
                    }
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
        }).catch(function () {
            VOID.alert('投票失败 o(╥﹏╥)o，请稍后重试');
        }).then(function () {
            VOID_Vote.pendingItems.delete(item);
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
        var items = document.querySelectorAll('.vote-button');
        for (var index = 0; index < items.length; index++) {
            var item = items[index];
            var type = item.getAttribute('data-type');
            var id = item.getAttribute('data-item-id');
            var table = item.getAttribute('data-table');

            if (VOID_Vote.checkVoted(type, id, table)) {
                item.classList.add('done');
            }
        }
    },

    toggleFoldComment: function (coid, item) {
        var comment = document.getElementById('comment-' + String(coid));
        if (!comment) {
            return;
        }

        comment.classList.toggle('fold');
        if (comment.classList.contains('fold')) {
            item.textContent = '点击展开';
        } else {
            item.textContent = '还是叠上吧';
        }
    },
};

var Share = {
    parseItem: function (item) {
        item = item ? item.parentElement : null;
        return {
            url: item ? item.getAttribute('data-url') : null,
            title: item ? item.getAttribute('data-title') : null,
            excerpt: item ? item.getAttribute('data-excerpt') : null,
            img: item ? item.getAttribute('data-img') : null,
            twitter: item ? item.getAttribute('data-twitter') : null,
            weibo: item ? item.getAttribute('data-weibo') : null,
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
    pagerHandler: null,
    hashChangeHandler: null,
    submitForm: null,
    submitHandler: null,
    submitController: null,
    submitToken: null,
    submitGeneration: 0,

    isCommentPjaxRequest: function (options) {
        return !!(options && options.container === '#comments');
    },

    getCommentsOrder: function () {
        var comments = document.querySelector('#comments');
        var order = comments ? String(comments.getAttribute('data-comments-order') || '').toUpperCase() : '';

        return order === 'ASC' ? 'ASC' : 'DESC';
    },

    isNewestCommentPage: function () {
        var pagerSelector = AjaxComment.getCommentsOrder() === 'ASC'
            ? '#comments .pager .next'
            : '#comments .pager .prev';

        return !document.querySelector(pagerSelector);
    },

    insertNewestComment: function (list, comment) {
        var footer;

        if (!list || !comment) {
            return;
        }

        if (AjaxComment.getCommentsOrder() === 'DESC') {
            list.insertBefore(comment, list.firstChild);
            return;
        }

        footer = AjaxComment.getDirectElement(list, '.comment-thread-footer');
        if (footer) {
            list.insertBefore(comment, footer);
        } else {
            list.appendChild(comment);
        }
    },

    getCommentDepth: function (comment) {
        var depth = comment ? parseInt(comment.getAttribute('data-comment-depth'), 10) : 0;

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

    beforePjaxReplace: function () {
        AjaxComment.destroyAntiSpamToken();
        AjaxComment.unbindSubmit();
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

    getDirectElement: function (root, selector) {
        var child = root ? root.firstElementChild : null;

        while (child) {
            if (child.matches(selector)) {
                return child;
            }
            child = child.nextElementSibling;
        }
        return null;
    },

    getDirectElements: function (root, selector) {
        var elements = [];
        var child = root ? root.firstElementChild : null;

        while (child) {
            if (child.matches(selector)) {
                elements.push(child);
            }
            child = child.nextElementSibling;
        }
        return elements;
    },

    focusWithoutScroll: function (element) {
        var scrollLeft;
        var scrollTop;

        if (!element || typeof element.focus !== 'function') {
            return;
        }

        try {
            element.focus({ preventScroll: true });
        } catch (err) {
            scrollLeft = window.pageXOffset || 0;
            scrollTop = window.pageYOffset || 0;
            element.focus();
            if (typeof window.scrollTo === 'function') {
                window.scrollTo(scrollLeft, scrollTop);
            }
        }
    },

    preserveLayout: function (element, callback, options) {
        if (typeof VOID_AnchorScroller !== 'undefined'
            && typeof VOID_AnchorScroller.preserveElement === 'function') {
            VOID_AnchorScroller.preserveElement(element, callback, options);
            return;
        }
        callback();
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

        holder = document.getElementById('void-comment-form-place-holder');
        if (!holder) {
            holder = document.createElement('div');
            holder.id = 'void-comment-form-place-holder';
            response.parentNode.insertBefore(holder, response);
        }

        AjaxComment.preserveLayout(comment, function () {
            child = AjaxComment.getDirectChild(comment, trigger);
            if (child) {
                comment.insertBefore(response, child.nextSibling);
            } else {
                comment.appendChild(response);
            }

            input.value = String(coid);
            input.setAttribute('value', String(coid));

            cancel = document.getElementById('cancel-comment-reply-link');
            if (cancel) {
                cancel.style.display = '';
            }
        });

        textarea = response.querySelector('textarea[name="text"]');
        if (textarea) {
            AjaxComment.focusWithoutScroll(textarea);
        }
        return false;
    },

    restoreReplyForm: function () {
        var response = document.querySelector(AjaxComment.respond);
        var holder = document.getElementById('void-comment-form-place-holder');
        var input = response ? response.querySelector('input[name="parent"]') : null;
        var cancel = document.getElementById('cancel-comment-reply-link');
        var anchor = response ? response.parentElement : null;

        AjaxComment.preserveLayout(anchor, function () {
            if (input && input.parentNode) {
                input.parentNode.removeChild(input);
            }
            if (response && holder && holder.parentNode) {
                holder.parentNode.insertBefore(response, holder);
            }
            if (cancel) {
                cancel.style.display = 'none';
            }
        });
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
        var comments = document.querySelector('#comments');
        var container = comments ? comments.closest('.comments-container') : null;
        var pagers;

        if (!comments || !container) {
            return;
        }

        container.classList.toggle('is-loading', isLoading);
        comments.classList.toggle('is-loading', isLoading);
        pagers = document.querySelectorAll(AjaxComment.commentPager);
        for (var i = 0; i < pagers.length; i++) {
            pagers[i].classList.toggle('is-disabled', isLoading);
            if (isLoading) {
                pagers[i].setAttribute('aria-disabled', 'true');
            } else {
                pagers[i].removeAttribute('aria-disabled');
            }
        }
    },

    bindPager: function () {
        if (AjaxComment.pagerHandler) {
            return;
        }

        AjaxComment.pagerHandler = function (event) {
            var target = event.target && event.target.nodeType === 3
                ? event.target.parentElement : event.target;
            var pager = target && typeof target.closest === 'function'
                ? target.closest(AjaxComment.commentPager) : null;
            var href;

            if (!pager || (document.documentElement
                && typeof document.documentElement.contains === 'function'
                && !document.documentElement.contains(pager))) {
                return;
            }

            if (event.defaultPrevented
                || (typeof event.button === 'number' && event.button !== 0)
                || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                return;
            }

            href = pager.href || pager.getAttribute('href');

            if (!window.VoidPjax || typeof window.VoidPjax.visit !== 'function' || !href) {
                return;
            }

            event.preventDefault();
            if (pager.getAttribute('aria-disabled') === 'true') {
                return;
            }
            window.VoidPjax.visit({
                url: href,
                container: '#comments',
                fragment: '#comments',
                timeout: 8000,
                scrollTop: false,
                push: true,
                target: pager
            });
        };
        document.addEventListener('click', AjaxComment.pagerHandler);
    },

    unbindPager: function () {
        if (!AjaxComment.pagerHandler) {
            return;
        }
        document.removeEventListener('click', AjaxComment.pagerHandler);
        AjaxComment.pagerHandler = null;
    },

    afterPagePjax: function (options) {
        VOID_Content.parseUrl();
        VOID_Content.highlight();
        VOID_Vote.reload();
        VOID.initEmotes();
        AjaxComment.init();
        if (options && options.fromPopstate && AjaxComment.getHashCommentSelector()) {
            VOID_Ui.checkScrollTop({ ignoreSavedPosition: true });
        }
    },

    endPagePjax: function () {
        AjaxComment.setCommentPageLoading(false);
    },

    resolveCommentTarget: function (trigger) {
        var comment = trigger && typeof trigger.closest === 'function'
            ? trigger.closest('[data-comment-id], .comment-body[id]') : null;
        if (!comment) {
            return '';
        }

        return comment.getAttribute('data-comment-id') || comment.id || '';
    },

    getReplyText: function (trigger, attrName, fallback) {
        var value;

        if (!trigger) {
            return fallback;
        }

        value = String(trigger.getAttribute(attrName) || '').trim();
        return value || fallback;
    },

    resolveReplyTrigger: function (matcher) {
        var triggers = document.querySelectorAll(AjaxComment.commentReply + ' a');

        if (typeof matcher !== 'function') {
            return null;
        }

        for (var i = 0; i < triggers.length; i++) {
            if (matcher(triggers[i])) {
                return triggers[i];
            }
        }
        return null;
    },

    findReplyTriggerByCommentId: function (commentId) {
        commentId = String(commentId || '');
        if (!commentId) {
            return null;
        }

        return AjaxComment.resolveReplyTrigger(function (trigger) {
            return String(trigger.getAttribute('data-comment-id') || '') === commentId;
        });
    },

    findReplyTriggerByCoid: function (coid) {
        coid = String(coid || '');
        if (!coid) {
            return null;
        }

        return AjaxComment.resolveReplyTrigger(function (trigger) {
            return String(trigger.getAttribute('data-comment-coid') || '') === coid;
        });
    },

    setReplyTriggerState: function (trigger, isActive) {
        var replyWord;
        var cancelWord;

        if (!trigger) {
            return;
        }

        replyWord = AjaxComment.getReplyText(trigger, 'data-reply-word', AjaxComment.replyWord);
        cancelWord = AjaxComment.getReplyText(trigger, 'data-cancel-word', AjaxComment.cancelReplyWord);

        trigger.textContent = isActive ? cancelWord : replyWord;
        trigger.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        trigger.setAttribute('data-reply-state', isActive ? 'active' : 'idle');
        trigger.classList.toggle('is-reply-active', isActive);
    },

    resetReplyTriggerState: function () {
        var activeTrigger = AjaxComment.findReplyTriggerByCommentId(AjaxComment.activeReplyCommentId);

        if (activeTrigger) {
            AjaxComment.setReplyTriggerState(activeTrigger, false);
        }

        AjaxComment.activeReplyCommentId = '';
        AjaxComment.activeReplyCoid = '';
        AjaxComment.parentID = '';
    },

    activateReplyTrigger: function (trigger, commentId, coid) {
        if (!trigger) {
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

        AjaxComment.setReplyTriggerState(trigger, true);
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

    syncThreadFocusFromHash: function () {
        var hashCommentId = AjaxComment.getHashCommentId();

        if (hashCommentId) {
            AjaxComment.threadFocusPendingId = hashCommentId;
        }

        AjaxComment.applyThreadPanels();
    },

    bindHashChange: function () {
        if (AjaxComment.hashChangeHandler) {
            return;
        }

        AjaxComment.hashChangeHandler = function () {
            AjaxComment.syncThreadFocusFromHash();
            VOID_Ui.checkScrollTop({ ignoreSavedPosition: true });
        };
        window.addEventListener('hashchange', AjaxComment.hashChangeHandler);
    },

    unbindHashChange: function () {
        if (!AjaxComment.hashChangeHandler) {
            return;
        }
        window.removeEventListener('hashchange', AjaxComment.hashChangeHandler);
        AjaxComment.hashChangeHandler = null;
    },

    getReplyToFromLocation: function () {
        var query = window.location.search || '';
        var matched = query.match(/[?&]replyTo=(\d+)/);

        return matched ? matched[1] : '';
    },

    getCurrentReplyCoid: function () {
        var form = document.querySelector(AjaxComment.commentForm);
        var parent = form ? form.querySelector('input[name="parent"]') : null;
        var parentValue = parent ? String(parent.value || '').trim() : '';
        var cancel;

        if (parentValue) {
            return parentValue;
        }

        cancel = document.getElementById('cancel-comment-reply-link');
        if (AjaxComment.isElementVisible(cancel)) {
            return AjaxComment.getReplyToFromLocation();
        }

        return '';
    },

    isElementVisible: function (element) {
        if (!element || element.hidden || (element.style && element.style.display === 'none')) {
            return false;
        }
        if (typeof element.getClientRects === 'function') {
            return element.getClientRects().length > 0;
        }
        return true;
    },

    syncReplyTriggerState: function () {
        var coid = AjaxComment.getCurrentReplyCoid();
        var trigger;
        var commentId;

        if (!coid) {
            AjaxComment.resetReplyTriggerState();
            return;
        }

        trigger = AjaxComment.findReplyTriggerByCoid(coid);
        if (!trigger) {
            AjaxComment.resetReplyTriggerState();
            return;
        }

        commentId = String(trigger.getAttribute('data-comment-id') || AjaxComment.resolveCommentTarget(trigger));
        AjaxComment.activateReplyTrigger(trigger, commentId, coid);
    },

    handleReplyClick: function (commentId, coid, trigger) {
        var nextCommentId = String(commentId || AjaxComment.resolveCommentTarget(trigger));
        var nextCoid = String(coid || (trigger ? trigger.getAttribute('data-comment-coid') : '') || '');
        var currentCoid = AjaxComment.getCurrentReplyCoid();

        if (AjaxComment.activeReplyCommentId === nextCommentId && currentCoid === nextCoid) {
            return AjaxComment.cancelActiveReply();
        }

        if (AjaxComment.moveReplyForm(nextCommentId, nextCoid, trigger)) {
            return true;
        }
        AjaxComment.activateReplyTrigger(trigger, nextCommentId, nextCoid);
        return false;
    },

    cancelActiveReply: function () {
        var activeTrigger = AjaxComment.findReplyTriggerByCommentId(AjaxComment.activeReplyCommentId);

        AjaxComment.restoreReplyForm();
        AjaxComment.resetReplyTriggerState();
        if (activeTrigger) {
            AjaxComment.focusWithoutScroll(activeTrigger);
        }
        return false;
    },

    bindClick: function () {
        var triggers = document.querySelectorAll(AjaxComment.commentReply + ' a');
        var trigger;

        for (var i = 0; i < triggers.length; i++) {
            trigger = triggers[i];
            if (!trigger.getAttribute('data-reply-word')) {
                trigger.setAttribute('data-reply-word', String(trigger.textContent || '').trim() || AjaxComment.replyWord);
            }

            if (!trigger.getAttribute('data-cancel-word')) {
                trigger.setAttribute('data-cancel-word', AjaxComment.cancelReplyWord);
            }

            AjaxComment.setReplyTriggerState(trigger, false);
        }

        AjaxComment.syncReplyTriggerState();
    },

    collectThreadItems: function (children) {
        var items = [];

        var walk = function (container) {
            var list = AjaxComment.getDirectElement(container, '.comment-list');
            var comments;
            var nested;

            if (!list) {
                return;
            }

            comments = AjaxComment.getDirectElements(list, '.comment-body');
            for (var i = 0; i < comments.length; i++) {
                nested = AjaxComment.getDirectElement(comments[i], '.comment-children');
                if (nested) {
                    comments[i].removeChild(nested);
                }
                items.push(comments[i]);

                if (nested) {
                    walk(nested);
                }
            }
        };

        walk(children);
        return items;
    },

    ensureThreadPanel: function (children) {
        var list;
        var items;

        if (!children) {
            return null;
        }

        list = AjaxComment.getDirectElement(children, '.comment-list');
        if (!children.classList.contains('comment-thread-panel')) {
            items = AjaxComment.collectThreadItems(children);
            if (items.length === 0) {
                return null;
            }

            while (children.firstChild) {
                children.removeChild(children.firstChild);
            }
            children.classList.add('comment-thread-panel');
            list = document.createElement('div');
            list.className = 'comment-list comment-thread-list';

            for (var i = 0; i < items.length; i++) {
                items[i].classList.add('comment-thread-item');
                items[i].setAttribute('data-thread-index', i);
                list.appendChild(items[i]);
            }

            children.appendChild(list);
            AjaxComment.bindThreadPanel(children);
            return list;
        }

        if (!list) {
            list = document.createElement('div');
            list.className = 'comment-list comment-thread-list';
            children.appendChild(list);
        }

        list.classList.add('comment-thread-list');
        items = AjaxComment.getDirectElements(list, '.comment-body');
        for (var index = 0; index < items.length; index++) {
            items[index].classList.add('comment-thread-item');
            items[index].setAttribute('data-thread-index', index);
        }

        AjaxComment.bindThreadPanel(children);
        return list;
    },

    insertReplyComment: function (comment) {
        var parentCoid = comment ? String(comment.getAttribute('data-comment-parent') || '') : '';
        var parent = parentCoid ? document.getElementById('comment-' + parentCoid) : null;
        var root;
        var children;
        var list;
        var cursor;
        var next;
        var parentDepth;

        if (!parent) {
            return false;
        }

        root = parent.classList.contains('comment-parent') ? parent : parent.closest('.comment-parent');
        if (!root) {
            return false;
        }

        children = AjaxComment.getDirectElement(root, '.comment-children');
        if (!children) {
            children = document.createElement('div');
            children.className = 'comment-children comment-thread-panel';
            children.setAttribute('data-thread-expanded', 'false');
            list = document.createElement('div');
            list.className = 'comment-list comment-thread-list';
            children.appendChild(list);
            root.appendChild(children);
            AjaxComment.bindThreadPanel(children);
        } else {
            list = AjaxComment.ensureThreadPanel(children);
        }

        if (!list) {
            return false;
        }

        if (parent.classList.contains('comment-parent')) {
            AjaxComment.insertNewestComment(list, comment);
            return true;
        }

        if (AjaxComment.getCommentsOrder() === 'DESC') {
            parent.parentNode.insertBefore(comment, parent.nextSibling);
            return true;
        }

        parentDepth = AjaxComment.getCommentDepth(parent);
        cursor = parent;
        next = cursor.nextElementSibling;
        while (next && next.matches('.comment-body') && AjaxComment.getCommentDepth(next) > parentDepth) {
            cursor = next;
            next = cursor.nextElementSibling;
        }
        cursor.parentNode.insertBefore(comment, cursor.nextSibling);
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

    resolveThreadFocusState: function (totalItems, currentPage, isExpanded, focusIndex, isParentFocus) {
        var canCollapse = totalItems > AjaxComment.threadPreviewSize;
        var shouldPaginate = totalItems > AjaxComment.threadPaginationThreshold;
        var preferredPage = focusIndex >= 0 && shouldPaginate
            ? Math.ceil((focusIndex + 1) / AjaxComment.threadPageSize)
            : 1;

        if (!canCollapse) {
            isExpanded = true;
        } else if (isParentFocus) {
            isExpanded = false;
            currentPage = 1;
        } else if (focusIndex >= 0) {
            if (focusIndex >= AjaxComment.threadPreviewSize) {
                isExpanded = true;
            }
            if (isExpanded) {
                currentPage = preferredPage;
            } else {
                currentPage = 1;
            }
        }

        return {
            currentPage: currentPage,
            handled: isParentFocus || focusIndex >= 0,
            isExpanded: isExpanded
        };
    },

    getThreadPanelId: function (children) {
        var parentId = children && children.parentElement
            ? String(children.parentElement.id || '').replace(/^comment-/, '') : '';
        var panelId = parentId ? 'comment-thread-' + parentId : '';

        if (panelId) {
            children.setAttribute('id', panelId);
        }
        return panelId;
    },

    focusThreadControl: function (children, selector) {
        var control = children ? children.querySelector(selector) : null;

        AjaxComment.focusWithoutScroll(control);
    },

    updateThreadLayout: function (children, callback, options) {
        var root = children ? children.parentElement : null;
        AjaxComment.preserveLayout(root, callback, options);
    },

    createThreadButton: function (className, text, page) {
        var button = document.createElement('button');

        button.type = 'button';
        button.className = className;
        button.textContent = text;
        if (page !== undefined) {
            button.setAttribute('data-thread-page', page);
        }
        return button;
    },

    bindThreadPanel: function (children) {
        if (!children || children.__voidThreadHandler) {
            return;
        }

        children.__voidThreadHandler = function (event) {
            var target = event.target && event.target.nodeType === 3
                ? event.target.parentElement : event.target;
            var button = target && typeof target.closest === 'function'
                ? target.closest('button') : null;
            var targetPage;
            var currentPage;

            if (!button || !children.contains(button)) {
                return;
            }

            if (button.classList.contains('comment-thread-expand')) {
                currentPage = parseInt(children.getAttribute('data-thread-page'), 10) || 1;
                AjaxComment.updateThreadLayout(children, function () {
                    children.setAttribute('data-thread-expanded', 'true');
                    AjaxComment.renderThreadPage(children, currentPage);
                    AjaxComment.focusThreadControl(children, '.comment-thread-collapse');
                });
                return;
            }

            if (button.hasAttribute('data-thread-page')) {
                targetPage = parseInt(button.getAttribute('data-thread-page'), 10);
                AjaxComment.updateThreadLayout(children, function () {
                    AjaxComment.renderThreadPage(children, targetPage);
                    AjaxComment.focusThreadControl(children, '.comment-thread-page.is-active');
                });
                return;
            }

            if (button.classList.contains('comment-thread-collapse')) {
                AjaxComment.updateThreadLayout(children, function () {
                    children.setAttribute('data-thread-expanded', 'false');
                    AjaxComment.renderThreadPage(children, 1);
                    AjaxComment.focusThreadControl(children, '.comment-thread-expand');
                }, { trackFrames: false });
            }
        };
        children.addEventListener('click', children.__voidThreadHandler);
    },

    renderThreadFooter: function (children, totalItems, currentPage, totalPages, shouldPaginate) {
        var list = AjaxComment.getDirectElement(children, '.comment-thread-list');
        var footer = AjaxComment.getDirectElement(list, '.comment-thread-footer');
        var pagination;
        var pages;
        var button;
        var isExpanded = children.getAttribute('data-thread-expanded') === 'true';
        var panelId = AjaxComment.getThreadPanelId(children);

        if (!footer) {
            footer = document.createElement('div');
            footer.className = 'comment-thread-footer';
            list.appendChild(footer);
        }

        while (footer.firstChild) {
            footer.removeChild(footer.firstChild);
        }
        if (!isExpanded) {
            button = AjaxComment.createThreadButton(
                'comment-thread-expand',
                '查看全部 ' + totalItems + ' 条回复'
            );
            button.setAttribute('aria-expanded', 'false');
            if (panelId) button.setAttribute('aria-controls', panelId);
            footer.classList.remove('is-collapsed');
            footer.classList.add('is-thread-footer-collapsed');
            footer.appendChild(button);
            return;
        }

        footer.classList.remove('is-collapsed', 'is-thread-footer-collapsed');
        var total = document.createElement('span');
        total.className = 'comment-thread-total';
        total.textContent = '共 ' + totalItems + ' 条回复';
        footer.appendChild(total);
        pagination = document.createElement('div');
        pagination.className = 'comment-thread-pagination';

        if (shouldPaginate) {
            pages = AjaxComment.buildThreadPages(currentPage, totalPages);

            if (currentPage > 1) {
                pagination.appendChild(AjaxComment.createThreadButton(
                    'comment-thread-prev', '上一页', currentPage - 1
                ));
            }

            for (var i = 0; i < pages.length; i++) {
                var page = pages[i];
                if (page === 'ellipsis') {
                    var ellipsis = document.createElement('span');
                    ellipsis.className = 'comment-thread-ellipsis';
                    ellipsis.textContent = '...';
                    pagination.appendChild(ellipsis);
                    continue;
                }

                button = AjaxComment.createThreadButton('comment-thread-page', page, page);

                if (page === currentPage) {
                    button.classList.add('is-active');
                    button.setAttribute('aria-current', 'page');
                }

                pagination.appendChild(button);
            }

            if (currentPage < totalPages) {
                pagination.appendChild(AjaxComment.createThreadButton(
                    'comment-thread-next', '下一页', currentPage + 1
                ));
            }
        }

        button = AjaxComment.createThreadButton('comment-thread-collapse', '收起');
        button.setAttribute('aria-expanded', 'true');
        if (panelId) button.setAttribute('aria-controls', panelId);
        pagination.appendChild(button);
        footer.appendChild(pagination);
    },

    renderThreadPage: function (children, targetPage) {
        var list = AjaxComment.getDirectElement(children, '.comment-thread-list');
        var items = AjaxComment.getDirectElements(list, '.comment-thread-item');
        var focusCommentId = String(AjaxComment.threadFocusPendingId || '');
        var parentCommentId = children.parentElement
            ? String(children.parentElement.id || '').replace(/^comment-/, '') : '';
        var focusComment = focusCommentId && document.getElementById
            ? document.getElementById('comment-' + focusCommentId) : null;
        var totalItems = items.length;
        var previewSize = AjaxComment.threadPreviewSize;
        var pageSize = AjaxComment.threadPageSize;
        var paginationThreshold = AjaxComment.threadPaginationThreshold;
        var canCollapseThread = totalItems > previewSize;
        var shouldPaginate = totalItems > paginationThreshold;
        var totalPages = shouldPaginate ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
        var shouldShowThreadFooter = canCollapseThread;
        var currentPage = targetPage || parseInt(children.getAttribute('data-thread-page'), 10) || 1;
        var isExpanded = children.getAttribute('data-thread-expanded') === 'true';
        var isParentFocus = !!focusCommentId && focusCommentId === parentCommentId;
        var focusIndex = focusComment && children.contains(focusComment) ? items.indexOf(focusComment) : -1;
        var focusState = AjaxComment.resolveThreadFocusState(
            totalItems,
            currentPage,
            isExpanded,
            focusIndex,
            isParentFocus
        );
        var startIndex;
        var endIndex;

        isExpanded = focusState.isExpanded;
        currentPage = focusState.currentPage;
        if (focusState.handled) {
            AjaxComment.threadFocusPendingId = '';
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

        children.setAttribute('data-thread-page', currentPage);
        children.setAttribute('data-thread-expanded', isExpanded ? 'true' : 'false');
        children.classList.toggle('is-thread-expanded', isExpanded);
        children.classList.toggle('is-thread-collapsed', canCollapseThread && !isExpanded);
        children.classList.toggle('no-thread-footer', !shouldShowThreadFooter);

        for (var i = 0; i < items.length; i++) {
            items[i].setAttribute('data-thread-index', i);
            items[i].classList.toggle('is-thread-hidden', i < startIndex || i >= endIndex);
        }

        if (!shouldShowThreadFooter) {
            var footer = AjaxComment.getDirectElement(list, '.comment-thread-footer');
            if (footer) {
                list.removeChild(footer);
            }
            return;
        }

        AjaxComment.renderThreadFooter(children, totalItems, currentPage, totalPages, shouldPaginate);
    },

    applyThreadPanels: function () {
        var parents = document.querySelectorAll('#comments > .comment-list > .comment-body.comment-parent');
        var children;
        var list;

        for (var i = 0; i < parents.length; i++) {
            children = AjaxComment.getDirectElement(parents[i], '.comment-children');
            if (!children) {
                continue;
            }

            list = AjaxComment.ensureThreadPanel(children);
            if (!list) {
                continue;
            }

            if (!children.getAttribute('data-thread-expanded')) {
                children.setAttribute('data-thread-expanded', 'false');
            }
            AjaxComment.renderThreadPage(children);
        }

        AjaxComment.threadFocusPendingId = '';
    },

    getSubmitButton: function (form) {
        return form ? form.querySelector(AjaxComment.submitBtn) : null;
    },

    setSubmitState: function (form, isSubmitting) {
        var submit = AjaxComment.getSubmitButton(form);

        if (!submit) {
            return;
        }
        submit.textContent = isSubmitting ? '提交中' : '提交评论';
        submit.disabled = isSubmitting;
    },

    validateCommentForm: function (form) {
        var author = form ? form.querySelector('#author') : null;
        var mail = form ? form.querySelector('#mail') : null;
        var url = form ? form.querySelector('#url') : null;
        var textarea = form ? form.querySelector(AjaxComment.textarea) : null;
        var filter = /^[^@\s<&>]+@([a-z0-9]+\.)+[a-z]{2,4}$/i;

        if (author) {
            if (String(author.value || '').trim() === '') {
                return AjaxComment.noName;
            }
            if (mail && mail.hasAttribute('required') && String(mail.value || '').trim() === '') {
                return AjaxComment.noMail;
            }
            if (mail && String(mail.value || '').trim() !== '' && !filter.test(String(mail.value).trim())) {
                return AjaxComment.invalidMail;
            }
            if (url && url.hasAttribute('required') && String(url.value || '').trim() === '') {
                return AjaxComment.noUrl;
            }
        }

        if (!textarea || String(textarea.value || '').trim() === '') {
            return AjaxComment.noContent;
        }
        return '';
    },

    buildSubmitBody: function (form) {
        var formData = new FormData(form);
        var body = new URLSearchParams();

        formData.forEach(function (value, name) {
            body.append(name, typeof value === 'string' ? value : value.name);
        });
        return body;
    },

    parseCommentResponse: function (html) {
        var parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');

        if (!parsed || typeof parsed.querySelector !== 'function'
            || parsed.querySelector('parsererror')) {
            throw new Error('Invalid comment response');
        }
        return parsed;
    },

    normalizeResponseText: function (value) {
        return String(value || '').replace(/\r/g, '').split('\n').map(function (line) {
            return line.trim();
        }).filter(function (line) {
            return line !== '';
        }).join('\n').slice(0, 500);
    },

    getResponseError: function (parsed) {
        var selectors = ['body .container', 'body [role="alert"]', 'body main', 'body'];
        var target;

        for (var i = 0; i < selectors.length; i++) {
            target = parsed.querySelector(selectors[i]);
            if (target) {
                var message = AjaxComment.normalizeResponseText(target.textContent);
                if (message) {
                    return message;
                }
            }
        }
        return '';
    },

    getCurrentCommentIds: function () {
        var nodes = document.querySelectorAll('#comments [id^="comment-"]');
        var ids = [];

        for (var i = 0; i < nodes.length; i++) {
            if (/^comment-\d+$/.test(String(nodes[i].id || ''))) {
                ids.push(nodes[i].id);
            }
        }
        return ids;
    },

    getResponseCommentId: function (parsed, responseUrl, existingIds) {
        var matched = String(responseUrl || '').match(/#comment-(\d+)$/);
        var comments;
        var newest = 0;
        var known = {};

        for (var knownIndex = 0; existingIds && knownIndex < existingIds.length; knownIndex++) {
            known[String(existingIds[knownIndex])] = true;
        }

        if (matched && parsed.getElementById('comment-' + matched[1])
            && !known['comment-' + matched[1]]) {
            return matched[1];
        }

        comments = parsed.querySelectorAll('#comments [id^="comment-"]');
        for (var i = 0; i < comments.length; i++) {
            matched = String(comments[i].id || '').match(/^comment-(\d+)$/);
            if (matched && !known[comments[i].id]) {
                newest = Math.max(newest, parseInt(matched[1], 10));
            }
        }
        return newest ? String(newest) : '';
    },

    ensureCommentList: function () {
        var comments = document.querySelector('#comments');
        var list = document.querySelector('#comments > .comment-list');
        var separator;
        var tab;
        var count;
        var number;

        if (list || !comments) {
            return list;
        }

        separator = comments.querySelector('.comment-separator');
        if (!separator) {
            separator = document.createElement('h3');
            separator.className = 'comment-separator';
            tab = document.createElement('div');
            tab.className = 'comment-tab-current';
            count = document.createElement('span');
            count.className = 'comment-num';
            count.appendChild(document.createTextNode('已有 '));
            number = document.createElement('span');
            number.className = 'num';
            number.textContent = '0';
            count.appendChild(number);
            count.appendChild(document.createTextNode(' 条评论'));
            tab.appendChild(count);
            separator.appendChild(tab);
            comments.appendChild(separator);
        }

        count = separator.querySelector('.comment-num');
        number = count ? count.querySelector('.num') : null;
        if (count && !number) {
            while (count.firstChild) {
                count.removeChild(count.firstChild);
            }
            count.appendChild(document.createTextNode('已有 '));
            number = document.createElement('span');
            number.className = 'num';
            number.textContent = '0';
            count.appendChild(number);
            count.appendChild(document.createTextNode(' 条评论'));
        }

        list = document.createElement('div');
        list.className = 'comment-list';
        comments.appendChild(list);
        return list;
    },

    revealComment: function (comment) {
        var reducedMotion = window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (!comment || !comment.style) {
            return;
        }
        if (reducedMotion || typeof window.requestAnimationFrame !== 'function') {
            comment.style.opacity = '1';
            return;
        }

        comment.style.transition = 'opacity 500ms';
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                comment.style.opacity = '1';
            });
        });
    },

    isCurrentSubmit: function (form, token, generation) {
        return AjaxComment.submitForm === form
            && AjaxComment.submitToken === token
            && AjaxComment.submitGeneration === generation
            && (!document.documentElement
                || typeof document.documentElement.contains !== 'function'
                || document.documentElement.contains(form));
    },

    releaseSubmit: function (token, generation) {
        if (AjaxComment.submitToken !== token || AjaxComment.submitGeneration !== generation) {
            return;
        }
        AjaxComment.submitToken = null;
        AjaxComment.submitController = null;
    },

    cancelSubmit: function () {
        var form = AjaxComment.submitForm;
        var controller = AjaxComment.submitController;

        AjaxComment.submitGeneration += 1;
        AjaxComment.submitToken = null;
        AjaxComment.submitController = null;
        if (controller && typeof controller.abort === 'function') {
            controller.abort();
        }
        AjaxComment.setSubmitState(form, false);
    },

    unbindSubmit: function () {
        var form = AjaxComment.submitForm;

        AjaxComment.cancelSubmit();
        if (form && AjaxComment.submitHandler) {
            form.removeEventListener('submit', AjaxComment.submitHandler);
        }
        AjaxComment.submitForm = null;
        AjaxComment.submitHandler = null;
    },

    err: function (form) {
        var submit = AjaxComment.getSubmitButton(form || AjaxComment.submitForm);

        if (submit) {
            submit.textContent = '提交评论';
            submit.disabled = false;
        }
        AjaxComment.newID = '';
    },

    finish: function (form, token) {
        var newCommentId = AjaxComment.newID;
        var submit = AjaxComment.getSubmitButton(form || AjaxComment.submitForm);
        var textarea = form ? form.querySelector(AjaxComment.textarea) : document.querySelector(AjaxComment.textarea);
        var commentCount = document.querySelector('.comment-num .num');
        var newComment = newCommentId ? document.getElementById('comment-' + newCommentId) : null;
        var submittedParentCoid = token ? String(token.parentCoid || '') : '';
        var submittedText = token ? String(token.text || '') : '';
        var currentParentCoid = AjaxComment.getCurrentReplyCoid();
        var canResetComposer = !!textarea
            && String(textarea.value || '') === submittedText
            && currentParentCoid === submittedParentCoid;
        var count;

        if (submit) {
            submit.textContent = '提交评论';
            submit.disabled = false;
        }
        if (canResetComposer) {
            textarea.value = '';
            if (submittedParentCoid) {
                AjaxComment.cancelActiveReply();
            }
        }
        if (commentCount) {
            count = parseInt(commentCount.textContent, 10);
            if (!isNaN(count)) {
                commentCount.textContent = count + 1;
            }
        }
        AjaxComment.threadFocusPendingId = newCommentId;
        AjaxComment.bindClick();
        AjaxComment.applyThreadPanels();
        if (newComment) {
            VOID_Ui.scrollToWithHeader('#comment-' + newCommentId, 0, {
                behavior: 'smooth',
                stabilize: true
            });
        }
        VOID_Content.highlight();
        VOID.initEmoteContent();
    },

    failSubmit: function (form, message) {
        VOID.alert('提交失败！请重试。' + (message ? '\n' + message : ''));
        AjaxComment.err(form);
    },

    applySubmitResponse: function (response, html, form, token, generation) {
        var parsed = AjaxComment.parseCommentResponse(html);
        var responseList;
        var newCommentId;
        var responseComment;
        var newComment;
        var currentList;

        if (!AjaxComment.isCurrentSubmit(form, token, generation)) {
            return;
        }
        if (!response.ok) {
            AjaxComment.failSubmit(form, AjaxComment.getResponseError(parsed));
            return;
        }

        responseList = parsed.querySelector('#comments .comment-list');
        if (!responseList) {
            AjaxComment.failSubmit(form, '');
            return;
        }

        newCommentId = AjaxComment.getResponseCommentId(parsed, response.url, token.commentIds);
        responseComment = newCommentId ? parsed.getElementById('comment-' + newCommentId) : null;
        if (!newCommentId || !responseComment) {
            AjaxComment.failSubmit(form, '');
            return;
        }
        AjaxComment.newID = newCommentId;

        if (!AjaxComment.isNewestCommentPage() && !token.parentCoid) {
            VOID.alert(AjaxComment.getCommentsOrder() === 'ASC'
                ? '评论成功！请前往评论最后一页查看。'
                : '评论成功！请回到评论第一页查看。');
            AjaxComment.newID = '';
            AjaxComment.finish(form, token);
            return;
        }

        newComment = typeof document.importNode === 'function'
            ? document.importNode(responseComment, true) : responseComment;
        newComment.style.opacity = '0';
        if (!token.parentCoid) {
            currentList = AjaxComment.ensureCommentList();
            if (!currentList) {
                AjaxComment.failSubmit(form, '');
                return;
            }
            AjaxComment.insertNewestComment(currentList, newComment);
        } else if (!AjaxComment.insertReplyComment(newComment)) {
            AjaxComment.failSubmit(form, '');
            return;
        }

        AjaxComment.revealComment(newComment);
        VOID.alert('评论成功！');
        AjaxComment.finish(form, token);
        AjaxComment.newID = '';
    },

    submitComment: function (form) {
        var validationMessage;
        var body;
        var token;
        var generation;
        var controller;
        var requestOptions;

        if (!form || AjaxComment.submitToken) {
            return false;
        }

        AjaxComment.setSubmitState(form, true);
        validationMessage = AjaxComment.validateCommentForm(form);
        if (validationMessage) {
            VOID.alert(validationMessage);
            AjaxComment.err(form);
            return false;
        }

        try {
            body = AjaxComment.buildSubmitBody(form);
        } catch (error) {
            AjaxComment.failSubmit(form, '');
            return false;
        }

        token = {
            commentIds: AjaxComment.getCurrentCommentIds(),
            parentCoid: String(body.get('parent') || '').trim(),
            text: String((form.querySelector(AjaxComment.textarea) || {}).value || '')
        };
        generation = AjaxComment.submitGeneration + 1;
        controller = typeof AbortController === 'function' ? new AbortController() : null;
        AjaxComment.submitGeneration = generation;
        AjaxComment.submitToken = token;
        AjaxComment.submitController = controller;
        requestOptions = {
            method: String(form.getAttribute('method') || 'post').toUpperCase(),
            body: body,
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            }
        };
        if (controller) {
            requestOptions.signal = controller.signal;
        }

        fetch(form.getAttribute('action'), requestOptions).then(function (response) {
            return response.text().then(function (html) {
                return { response: response, html: html };
            });
        }).then(function (result) {
            if (!AjaxComment.isCurrentSubmit(form, token, generation)) {
                AjaxComment.releaseSubmit(token, generation);
                return;
            }
            try {
                AjaxComment.applySubmitResponse(result.response, result.html, form, token, generation);
            } catch (error) {
                AjaxComment.failSubmit(form, '');
            }
            AjaxComment.releaseSubmit(token, generation);
        }).catch(function (error) {
            if (!AjaxComment.isCurrentSubmit(form, token, generation)) {
                AjaxComment.releaseSubmit(token, generation);
                return;
            }
            if (!error || error.name !== 'AbortError') {
                AjaxComment.failSubmit(form, '');
            } else {
                AjaxComment.err(form);
            }
            AjaxComment.releaseSubmit(token, generation);
        });
        return false;
    },

    bindSubmit: function () {
        var form = document.querySelector(AjaxComment.commentForm);

        if (AjaxComment.submitForm === form && AjaxComment.submitHandler) {
            return;
        }
        if (AjaxComment.submitForm || AjaxComment.submitHandler) {
            AjaxComment.unbindSubmit();
        }
        if (!form) {
            return;
        }

        AjaxComment.submitForm = form;
        AjaxComment.submitHandler = function (event) {
            event.preventDefault();
            AjaxComment.submitComment(form);
        };
        form.addEventListener('submit', AjaxComment.submitHandler);
    },

    init: function () {
        AjaxComment.ensureTypechoCommentFacade();
        AjaxComment.bindPager();
        AjaxComment.bindHashChange();
        AjaxComment.bindClick();
        AjaxComment.syncThreadFocusFromHash();
        AjaxComment.bindSubmit();
    }
};

function VOID_onReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
        callback();
    }
}

function updateVoidRuntime() {
    var uptime = document.getElementById('uptime');
    if (!uptime) {
        return;
    }

    var times = new Date().getTime() - Date.parse(VOIDConfig.buildTime);
    times = Math.floor(times / 1000); // convert total milliseconds into total seconds
    var days = Math.floor(times / (60 * 60 * 24)); //separate days
    times %= 60 * 60 * 24; //subtract entire days
    var hours = Math.floor(times / (60 * 60)); //separate hours
    times %= 60 * 60; //subtract entire hours
    var minutes = Math.floor(times / 60); //separate minutes
    times %= 60; //subtract entire minutes
    var seconds = Math.floor(times / 1); // remainder is seconds
    uptime.textContent = days + ' 天 ' + hours + ' 小时 ' + minutes + ' 分 ' + seconds + ' 秒 ';
}

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

function createClipboardButton() {
    var namespace = 'http://www.w3.org/2000/svg';
    var button = document.createElement('div');
    var icon = document.createElementNS(namespace, 'svg');
    var path = document.createElementNS(namespace, 'path');

    button.className = 'clipboard';
    button.setAttribute('title', '复制代码');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('role', 'img');
    icon.setAttribute('class', 'clipboard-icon');
    icon.setAttribute('viewBox', '0 0 16 16');
    icon.setAttribute('width', '16');
    icon.setAttribute('height', '16');
    icon.setAttribute('fill', 'currentColor');
    icon.setAttribute('style', 'display: inline-block; user-select: none; vertical-align: text-bottom;');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('d', 'M5.75 1a.75.75 0 00-.75.75v3c0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75v-3a.75.75 0 00-.75-.75h-4.5zm.75 3V2.5h3V4h-3zm-2.874-.467a.75.75 0 00-.752-1.298A1.75 1.75 0 002 3.75v9.5c0 .966.784 1.75 1.75 1.75h8.5A1.75 1.75 0 0014 13.25v-9.5a1.75 1.75 0 00-.874-1.515.75.75 0 10-.752 1.298.25.25 0 01.126.217v9.5a.25.25 0 01-.25.25h-8.5a.25.25 0 01-.25-.25v-9.5a.25.25 0 01.126-.217z');
    icon.appendChild(path);
    button.appendChild(icon);
    return button;
}

function loadClipboard() {
    var blocks = document.querySelectorAll('pre');
    for (var index = 0; index < blocks.length; index++) {
        if (!blocks[index].querySelector('.clipboard')) {
            blocks[index].insertBefore(createClipboardButton(), blocks[index].firstChild);
        }
    }
}

var clipboardClickBound = false;

function bindClipboard() {
    if (clipboardClickBound || !document.body) {
        return;
    }

    clipboardClickBound = true;
    document.body.addEventListener('click', function (event) {
        var target = event.target;
        var button = target && typeof target.closest === 'function'
            ? target.closest('.clipboard') : null;
        if (!button || !document.body.contains(button)) {
            return;
        }

        var block = button.closest('pre');
        if (!block) {
            return;
        }
        var codeNode = block.querySelector('code');
        var code = codeNode && codeNode.textContent ? codeNode.textContent : block.textContent;
        copyToClipboard(code).then(function () {
            VOID.alert('复制成功');
        }).catch(function () {
            VOID.alert('复制失败');
        });
    });
}

(function () {
    VOID_onReady(function () {
        if (VOIDConfig.PJAX) {
            VOID.bindPjaxLifecycle();
        }
        VOID.init();
        loadClipboard();
        bindClipboard();
    });

    window.setInterval(updateVoidRuntime, 1000);
})();

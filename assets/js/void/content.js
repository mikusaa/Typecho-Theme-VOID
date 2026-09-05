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
        var footnoteLinks = document.querySelectorAll('a[href*="#"]');
        for (var linkIndex = 0; linkIndex < footnoteLinks.length; linkIndex++) {
            var item = footnoteLinks[linkIndex];
            var hrefAttr = item.getAttribute('href') || '';
            var relAttr = item.getAttribute('rel') || '';
            if (!(hrefAttr + relAttr).match(footnoteAnchorPattern)) {
                continue;
            }

            item.classList.add('no-pangu-spacing');
            if (typeof item.closest === 'function') {
                var supNode = item.closest('sup');
                if (supNode) {
                    supNode.classList.add('no-pangu-spacing');
                }
            }
        }

        var paragraphs = document.querySelectorAll('p');
        for (var paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex++) {
            pangu.spacingNode(paragraphs[paragraphIndex]);
        }
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

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

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

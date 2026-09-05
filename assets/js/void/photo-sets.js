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

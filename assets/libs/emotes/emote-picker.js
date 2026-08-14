/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
'use strict';

(function (window, document) {
    var RECENT_KEY = 'void-emotes-recent-v1';
    var RECENT_LIMIT = 20;
    var BATCH_SIZE = 32;
    var ANIMATION_LIMIT = 4;
    var instanceSequence = 0;
    var memoryRecent = [];
    var animationQueue = [];
    var animationActive = 0;
    var animationPumping = false;

    function asElement(value) {
        if (!value) {
            return null;
        }
        if (typeof value === 'string') {
            return document.querySelector(value);
        }
        return value;
    }

    function getBaseUrl(optionBase) {
        var configured = optionBase
            || (window.VOIDEmotesConfig && window.VOIDEmotesConfig.baseUrl)
            || (window.VOIDConfig && window.VOIDConfig.emotesBase)
            || '/usr/themes/VOID/assets/libs/emotes/';

        return configured.replace(/\/?$/, '/');
    }

    function assetUrl(baseUrl, path) {
        if (!path) {
            return '';
        }
        if (/^(?:[a-z]+:)?\/\//i.test(path) || path.charAt(0) === '/' || path.indexOf('data:') === 0) {
            return path;
        }
        return baseUrl + path.replace(/^\.\//, '');
    }

    function packAssetPath(packId, path) {
        if (packId !== 'bangumi') {
            return path;
        }
        if (typeof path !== 'string'
            || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path)
            || path.split('/').some(function (segment) {
                return segment === '' || segment === '.' || segment === '..';
            })) {
            return '';
        }
        return 'bangumi/' + path;
    }

    function motionAllowed() {
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var connection = window.navigator && window.navigator.connection;
        return !reduced && !(connection && connection.saveData);
    }

    function isMobileInput() {
        var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        return coarse || window.innerWidth <= 767;
    }

    function safeRecent(value) {
        if (!Array.isArray(value)) {
            return [];
        }

        return value.filter(function (entry) {
            return entry && typeof entry.pack === 'string' && typeof entry.id === 'string';
        }).slice(0, RECENT_LIMIT).map(function (entry) {
            return { pack: entry.pack, id: entry.id };
        });
    }

    function RecentStore(storage) {
        this.storage = storage;
        this.usesMemory = false;
    }

    function getStorage() {
        try {
            return window.localStorage;
        } catch (error) {
            return null;
        }
    }

    RecentStore.prototype.read = function () {
        if (!this.storage || this.usesMemory) {
            return memoryRecent.slice();
        }

        try {
            var parsed = safeRecent(JSON.parse(this.storage.getItem(RECENT_KEY) || '[]'));
            memoryRecent = parsed.slice();
            return parsed;
        } catch (error) {
            this.usesMemory = true;
            return memoryRecent.slice();
        }
    };

    RecentStore.prototype.write = function (entries) {
        var normalized = safeRecent(entries);
        memoryRecent = normalized.slice();

        if (!this.storage || this.usesMemory) {
            return normalized;
        }

        try {
            this.storage.setItem(RECENT_KEY, JSON.stringify(normalized));
        } catch (error) {
            this.usesMemory = true;
        }

        return normalized;
    };

    RecentStore.prototype.add = function (pack, id) {
        var key = pack + '\n' + id;
        var next = [{ pack: pack, id: id }].concat(this.read().filter(function (entry) {
            return entry.pack + '\n' + entry.id !== key;
        }));
        return this.write(next.slice(0, RECENT_LIMIT));
    };

    function insertIntoText(value, start, end, rawValue) {
        var source = String(value || '');
        var safeStart = Math.max(0, Math.min(Number(start) || 0, source.length));
        var safeEnd = Math.max(safeStart, Math.min(Number(end) || safeStart, source.length));
        var inserted = ' ' + String(rawValue || '') + ' ';
        var nextValue = source.slice(0, safeStart) + inserted + source.slice(safeEnd);
        var nextCursor = safeStart + inserted.length;

        return {
            value: nextValue,
            start: nextCursor,
            end: nextCursor
        };
    }

    function dispatchInput(target) {
        var event;
        try {
            event = new window.Event('input', { bubbles: true });
        } catch (error) {
            event = document.createEvent('Event');
            event.initEvent('input', true, false);
        }
        target.dispatchEvent(event);
    }

    function AnimatedImages(root) {
        this.root = root || null;
        this.enabled = motionAllowed() && typeof window.IntersectionObserver === 'function';
        this.images = [];
        this.queue = [];
        this.tasks = [];
        this.active = 0;
        this.epoch = 0;
        this.observer = null;
        this.destroyed = false;

        if (this.enabled) {
            this.observer = new window.IntersectionObserver(this.handleEntries.bind(this), {
                root: this.root,
                rootMargin: '48px 0px',
                threshold: 0.01
            });
        }
    }

    AnimatedImages.prototype.observe = function (image) {
        if (this.destroyed || !image || !image.getAttribute('data-animated-src')) {
            return;
        }

        if (!image.getAttribute('data-poster-src')) {
            image.setAttribute('data-poster-src', image.getAttribute('src') || '');
        }

        this.images.push(image);
        if (this.observer) {
            this.observer.observe(image);
        }
    };

    AnimatedImages.prototype.handleEntries = function (entries) {
        if (this.destroyed) {
            return;
        }

        var self = this;
        entries.forEach(function (entry) {
            var image = entry.target;
            var state = image.getAttribute('data-void-emote-animation');
            image.setAttribute('data-void-emote-visible', entry.isIntersecting ? 'true' : 'false');
            if (entry.isIntersecting) {
                self.enqueue(image);
            } else if (state !== 'queued' && state !== 'loading') {
                self.restore(image);
            }
        });
    };

    AnimatedImages.prototype.enqueue = function (image) {
        var state = image.getAttribute('data-void-emote-animation');
        if (this.destroyed || state === 'queued' || state === 'loading' || state === 'animated') {
            return;
        }

        var queuedTask = {
            controller: this,
            image: image,
            epoch: this.epoch,
            loader: null,
            started: false,
            finished: false
        };
        image.setAttribute('data-void-emote-animation', 'queued');
        this.queue.push(queuedTask);
        animationQueue.push(queuedTask);
        pumpAnimationQueue();
    };

    AnimatedImages.prototype.pump = function () {
        pumpAnimationQueue();
    };

    function removeAnimationTask(tasks, task) {
        var index = tasks.indexOf(task);
        if (index !== -1) {
            tasks.splice(index, 1);
        }
    }

    function finishAnimationTask(task, didLoad) {
        if (task.finished) {
            return;
        }

        task.finished = true;
        if (task.loader) {
            task.loader.onload = null;
            task.loader.onerror = null;
        }

        var controller = task.controller;
        releaseAnimationSlot(task);

        if (!controller.destroyed && task.epoch === controller.epoch) {
            var target = task.image;
            if (didLoad && target.getAttribute('data-void-emote-visible') === 'true') {
                target.src = target.getAttribute('data-animated-src');
                target.setAttribute('data-void-emote-animation', 'animated');
            } else {
                controller.restore(target);
            }
        }

        pumpAnimationQueue();
    }

    function cancelAnimationTask(task) {
        if (task.finished) {
            return;
        }

        task.finished = true;
        if (task.loader) {
            task.loader.onload = null;
            task.loader.onerror = null;
            task.loader.src = '';
        }

        releaseAnimationSlot(task);
    }

    function releaseAnimationSlot(task) {
        var controller = task.controller;
        removeAnimationTask(controller.tasks, task);
        if (!task.started) {
            return;
        }

        task.started = false;
        controller.active = Math.max(0, controller.active - 1);
        animationActive = Math.max(0, animationActive - 1);
    }

    function pumpAnimationQueue() {
        if (animationPumping) {
            return;
        }

        animationPumping = true;
        try {
            while (animationActive < ANIMATION_LIMIT && animationQueue.length) {
                var task = animationQueue.shift();
                var controller = task.controller;
                var image = task.image;
                removeAnimationTask(controller.queue, task);

                if (task.finished || controller.destroyed || task.epoch !== controller.epoch) {
                    task.finished = true;
                    continue;
                }
                if (!image || image.getAttribute('data-void-emote-visible') !== 'true') {
                    task.finished = true;
                    if (image) {
                        controller.restore(image);
                    }
                    continue;
                }

                var animatedSrc = image.getAttribute('data-animated-src');
                if (!animatedSrc) {
                    task.finished = true;
                    controller.restore(image);
                    continue;
                }

                try {
                    task.loader = new window.Image();
                    task.started = true;
                    controller.tasks.push(task);
                    controller.active++;
                    animationActive++;
                    image.setAttribute('data-void-emote-animation', 'loading');
                    task.loader.onload = finishAnimationTask.bind(null, task, true);
                    task.loader.onerror = finishAnimationTask.bind(null, task, false);
                    task.loader.src = animatedSrc;
                } catch (error) {
                    finishAnimationTask(task, false);
                }
            }
        } finally {
            animationPumping = false;
        }
    }

    AnimatedImages.prototype.restore = function (image) {
        var poster = image && image.getAttribute('data-poster-src');
        if (!image || !poster) {
            return;
        }
        if (image.getAttribute('src') !== poster) {
            image.src = poster;
        }
        image.setAttribute('data-void-emote-animation', 'poster');
    };

    AnimatedImages.prototype.destroy = function () {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.epoch++;
        if (this.observer) {
            this.observer.disconnect();
        }
        animationQueue = animationQueue.filter(function (task) {
            if (task.controller === this) {
                task.finished = true;
                return false;
            }
            return true;
        }, this);
        this.queue = [];
        this.tasks.slice().forEach(cancelAnimationTask);
        this.tasks = [];
        this.active = 0;
        this.images.forEach(this.restore.bind(this));
        this.images = [];
        pumpAnimationQueue();
    };

    function Picker(options) {
        this.container = asElement(options.container);
        this.target = asElement(options.target);
        this.mode = options.mode === 'popover' ? 'popover' : 'inline';
        this.baseUrl = getBaseUrl(options.baseUrl);
        this.trigger = asElement(options.trigger)
            || asElement(this.container.getAttribute('data-trigger') ? '#' + this.container.getAttribute('data-trigger') : null);
        this.abortController = typeof window.AbortController === 'function' ? new window.AbortController() : null;
        this.index = null;
        this.indexPromise = null;
        this.manifests = {};
        this.manifestPromises = {};
        this.currentPack = '';
        this.currentItems = [];
        this.renderedCount = 0;
        this.renderEpoch = 0;
        this.isOpen = false;
        this.destroyed = false;
        this.generatedTrigger = false;
        this.listeners = [];
        this.tabButtons = [];
        this.tileButtons = [];
        this.animationController = null;
        this.selection = {
            start: this.target.selectionStart || 0,
            end: this.target.selectionEnd || 0
        };
        this.recent = new RecentStore(getStorage());
        this.id = 'void-emotes-' + (++instanceSequence);

        this.build();
        this.bind();
    }

    Picker.prototype.listen = function (element, eventName, handler, options) {
        element.addEventListener(eventName, handler, options || false);
        this.listeners.push([element, eventName, handler, options || false]);
    };

    Picker.prototype.build = function () {
        if (!this.trigger) {
            this.trigger = document.createElement('button');
            this.trigger.type = 'button';
            this.trigger.className = 'void-emotes-trigger';
            this.trigger.textContent = '☺';
            this.container.appendChild(this.trigger);
            this.generatedTrigger = true;
        }

        this.trigger.setAttribute('aria-label', '打开表情选择器');
        this.trigger.setAttribute('title', '表情');
        this.trigger.setAttribute('aria-expanded', 'false');
        this.trigger.setAttribute('aria-controls', this.id + '-panel');

        this.container.classList.add('void-emotes-host', 'void-emotes-host--' + this.mode);

        this.panel = document.createElement('section');
        this.panel.id = this.id + '-panel';
        this.panel.className = 'void-emotes-panel';
        this.panel.setAttribute('aria-label', '表情选择器');
        this.panel.hidden = true;

        var header = document.createElement('div');
        header.className = 'void-emotes-header';
        this.headerIcon = document.createElement('span');
        this.headerIcon.className = 'void-emotes-header__icon';
        this.headerIcon.setAttribute('aria-hidden', 'true');
        this.headerTitle = document.createElement('strong');
        this.headerTitle.className = 'void-emotes-header__title';
        this.headerTitle.textContent = 'Bangumi 娘';
        this.headerCount = document.createElement('span');
        this.headerCount.className = 'void-emotes-header__count';
        this.closeButton = document.createElement('button');
        this.closeButton.type = 'button';
        this.closeButton.className = 'void-emotes-close';
        this.closeButton.setAttribute('aria-label', '关闭表情选择器');
        this.closeButton.setAttribute('title', '关闭');
        this.closeButton.textContent = '×';
        header.appendChild(this.headerIcon);
        header.appendChild(this.headerTitle);
        header.appendChild(this.headerCount);
        header.appendChild(this.closeButton);

        this.grid = document.createElement('div');
        this.grid.id = this.id + '-grid';
        this.grid.className = 'void-emotes-grid';
        this.grid.setAttribute('role', 'grid');
        this.grid.setAttribute('aria-label', '表情列表');

        this.navigation = document.createElement('div');
        this.navigation.className = 'void-emotes-tabs';
        this.navigation.setAttribute('role', 'tablist');
        this.navigation.setAttribute('aria-label', '表情包');

        this.liveRegion = document.createElement('span');
        this.liveRegion.className = 'void-emotes-visually-hidden';
        this.liveRegion.setAttribute('aria-live', 'polite');

        this.panel.appendChild(header);
        this.panel.appendChild(this.grid);
        this.panel.appendChild(this.navigation);
        this.panel.appendChild(this.liveRegion);
        this.container.appendChild(this.panel);
    };

    Picker.prototype.bind = function () {
        var self = this;
        this.listen(this.trigger, 'click', function () {
            if (self.isOpen) {
                self.close();
            } else {
                self.open();
            }
        });
        this.listen(this.closeButton, 'click', function () {
            self.close();
            self.trigger.focus();
        });
        this.listen(window, 'keydown', function (event) {
            if (event.key === 'Escape' && self.isOpen) {
                event.preventDefault();
                self.close();
                self.trigger.focus();
            }
        });
        this.listen(this.grid, 'scroll', function () {
            if (self.grid.scrollHeight - self.grid.scrollTop - self.grid.clientHeight < 160) {
                self.renderMore();
            }
        }, { passive: true });
        this.listen(this.grid, 'click', function (event) {
            var button = event.target;
            while (button && button !== self.grid && !button.classList.contains('void-emotes-tile')) {
                button = button.parentNode;
            }
            if (!button || button === self.grid || !button.__voidEmoteItem) {
                return;
            }
            self.insertItem(button.__voidEmoteItem, button.__voidEmotePack, event.detail === 0, button);
        });
        this.listen(this.grid, 'keydown', this.handleGridKeydown.bind(this));
        this.listen(this.navigation, 'keydown', this.handleTabKeydown.bind(this));

        ['select', 'keyup', 'click', 'input'].forEach(function (eventName) {
            self.listen(self.target, eventName, function () {
                self.saveSelection();
            });
        });
        this.listen(this.target, 'focus', function () {
            if (self.isOpen && isMobileInput()) {
                self.close();
            }
        });

        if (this.mode === 'popover') {
            this.repositionHandler = this.positionPopover.bind(this);
        }
    };

    Picker.prototype.saveSelection = function () {
        if (typeof this.target.selectionStart === 'number') {
            this.selection.start = this.target.selectionStart;
            this.selection.end = this.target.selectionEnd;
        }
    };

    Picker.prototype.open = function () {
        if (this.destroyed || this.isOpen) {
            return;
        }

        this.saveSelection();
        this.isOpen = true;
        this.panel.hidden = false;
        this.container.classList.add('is-open');
        this.trigger.setAttribute('aria-expanded', 'true');
        this.trigger.setAttribute('aria-label', '关闭表情选择器');

        if (isMobileInput()) {
            this.target.blur();
        }

        if (this.mode === 'popover') {
            this.positionPopover();
            window.addEventListener('resize', this.repositionHandler);
            window.addEventListener('scroll', this.repositionHandler, true);
        }

        if (this.index) {
            this.selectPack(this.currentPack || this.index.defaultPack || 'bangumi');
        } else {
            this.loadIndex();
        }
    };

    Picker.prototype.close = function () {
        if (!this.isOpen) {
            return;
        }

        this.isOpen = false;
        this.renderEpoch++;
        this.panel.hidden = true;
        this.container.classList.remove('is-open');
        this.trigger.setAttribute('aria-expanded', 'false');
        this.trigger.setAttribute('aria-label', '打开表情选择器');
        this.stopAnimations();
        this.restoreAnimatedIcons();

        if (this.mode === 'popover') {
            window.removeEventListener('resize', this.repositionHandler);
            window.removeEventListener('scroll', this.repositionHandler, true);
        }
    };

    Picker.prototype.positionPopover = function () {
        if (!this.isOpen || this.mode !== 'popover') {
            return;
        }

        var rect = this.trigger.getBoundingClientRect();
        var panelWidth = Math.min(420, Math.max(280, window.innerWidth - 16));
        var panelHeight = Math.min(286, Math.max(180, window.innerHeight - 16));
        var below = window.innerHeight - rect.bottom;
        var above = rect.top;
        var openBelow = below >= panelHeight + 8 || below >= above;
        var left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8));
        var top = openBelow
            ? Math.min(window.innerHeight - panelHeight - 8, rect.bottom + 8)
            : Math.max(8, rect.top - panelHeight - 8);

        this.container.style.width = panelWidth + 'px';
        this.container.style.left = left + 'px';
        this.container.style.top = top + 'px';
        this.panel.style.height = panelHeight + 'px';
        this.container.classList.toggle('void-emotes-host--above', !openBelow);
    };

    Picker.prototype.fetchJson = function (path) {
        var options = { credentials: 'same-origin' };
        if (this.abortController) {
            options.signal = this.abortController.signal;
        }

        return window.fetch(assetUrl(this.baseUrl, path), options).then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.json();
        });
    };

    Picker.prototype.loadIndex = function () {
        var self = this;
        if (this.indexPromise) {
            return this.indexPromise;
        }

        this.showState('正在载入表情包…');
        this.indexPromise = this.fetchJson('packs.json').then(function (data) {
            var tabs = data && (data.tabs || data.packs);
            if (!Array.isArray(tabs) || !tabs.length) {
                throw new Error('Invalid pack index');
            }
            self.index = data;
            self.index.tabs = tabs;
            self.renderTabs();
            if (!self.isOpen) {
                return data;
            }
            return self.selectPack(data.defaultPack || 'bangumi');
        }).catch(function (error) {
            if (error && error.name === 'AbortError') {
                return null;
            }
            self.indexPromise = null;
            self.showError('表情包载入失败', function () {
                self.loadIndex();
            });
            return null;
        });

        return this.indexPromise;
    };

    Picker.prototype.getPack = function (packId) {
        if (!this.index) {
            return null;
        }
        return this.index.tabs.filter(function (pack) {
            return pack.id === packId;
        })[0] || null;
    };

    Picker.prototype.loadManifest = function (packId) {
        var self = this;
        var pack = this.getPack(packId);
        if (!pack || !pack.manifest) {
            return Promise.resolve(null);
        }
        if (this.manifests[packId]) {
            return Promise.resolve(this.manifests[packId]);
        }
        if (this.manifestPromises[packId]) {
            return this.manifestPromises[packId];
        }

        this.manifestPromises[packId] = this.fetchJson(pack.manifest).then(function (manifest) {
            if (!manifest || !Array.isArray(manifest.items)) {
                throw new Error('Invalid manifest: ' + packId);
            }
            self.manifests[packId] = manifest;
            return manifest;
        }).catch(function (error) {
            delete self.manifestPromises[packId];
            throw error;
        });
        return this.manifestPromises[packId];
    };

    Picker.prototype.renderTabs = function () {
        var self = this;
        this.navigation.textContent = '';
        this.tabButtons = [];

        this.index.tabs.forEach(function (pack, index) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'void-emotes-tab';
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-controls', self.id + '-grid');
            button.setAttribute('aria-selected', 'false');
            button.setAttribute('tabindex', index === 0 ? '0' : '-1');
            button.setAttribute('aria-label', pack.label);
            button.setAttribute('title', pack.label);
            button.setAttribute('data-pack', pack.id);
            button.appendChild(self.createIcon(pack.icon, 'void-emotes-tab__icon'));
            self.listen(button, 'click', function () {
                self.selectPack(pack.id);
            });
            self.navigation.appendChild(button);
            self.tabButtons.push(button);
        });
    };

    Picker.prototype.createIcon = function (icon, className) {
        var wrapper = document.createElement('span');
        wrapper.className = className;
        wrapper.setAttribute('aria-hidden', 'true');

        if (typeof icon === 'string') {
            wrapper.classList.add('void-emotes-icon--text');
            wrapper.textContent = icon;
            return wrapper;
        }

        icon = icon || {};
        if (icon.text) {
            wrapper.classList.add('void-emotes-icon--text');
            wrapper.textContent = icon.text;
            return wrapper;
        }

        if (icon.symbol === 'history') {
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            svg.setAttribute('focusable', 'false');

            [
                ['path', 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'],
                ['path', 'M3 3v5h5'],
                ['path', 'M12 7v5l4 2']
            ].forEach(function (shape) {
                var element = document.createElementNS('http://www.w3.org/2000/svg', shape[0]);
                element.setAttribute('d', shape[1]);
                svg.appendChild(element);
            });

            wrapper.classList.add('void-emotes-icon--svg');
            wrapper.appendChild(svg);
            return wrapper;
        }

        var poster = assetUrl(this.baseUrl, icon.poster || icon.src);
        if (poster) {
            wrapper.classList.add('void-emotes-icon--image');
            var image = document.createElement('img');
            image.alt = '';
            image.decoding = 'async';
            image.src = poster;
            image.setAttribute('data-poster-src', poster);
            if (icon.animated) {
                image.setAttribute('data-animated-src', assetUrl(this.baseUrl, icon.animated));
            }
            wrapper.appendChild(image);
        }
        return wrapper;
    };

    Picker.prototype.restoreAnimatedIcons = function () {
        var images = this.panel.querySelectorAll('.void-emotes-tab__icon img, .void-emotes-header__icon img');
        Array.prototype.forEach.call(images, function (image) {
            var poster = image.getAttribute('data-poster-src');
            if (poster) {
                image.src = poster;
            }
        });
    };

    Picker.prototype.animateIcons = function () {
        if (!this.animationController || !this.animationController.enabled) {
            return;
        }
        var controller = this.animationController;
        var images = this.panel.querySelectorAll('.void-emotes-tab__icon img, .void-emotes-header__icon img');
        Array.prototype.forEach.call(images, function (image) {
            if (image.getAttribute('data-animated-src')) {
                if (controller.images.indexOf(image) === -1) {
                    controller.images.push(image);
                }
                image.setAttribute('data-void-emote-visible', 'true');
                controller.enqueue(image);
            }
        });
    };

    Picker.prototype.updateTabs = function (packId) {
        this.tabButtons.forEach(function (button) {
            var selected = button.getAttribute('data-pack') === packId;
            button.setAttribute('aria-selected', selected ? 'true' : 'false');
            button.setAttribute('tabindex', selected ? '0' : '-1');
        });
    };

    Picker.prototype.updateHeader = function (pack, count) {
        this.headerIcon.textContent = '';
        this.headerIcon.appendChild(this.createIcon(pack.icon, 'void-emotes-header__icon-content'));
        this.headerTitle.textContent = pack.label;
        this.headerCount.textContent = String(typeof count === 'number' ? count : (pack.count || 0)) + ' 个';
    };

    Picker.prototype.selectPack = function (packId) {
        var self = this;
        var pack = this.getPack(packId);
        if (!pack || this.destroyed) {
            return Promise.resolve(null);
        }

        this.currentPack = packId;
        this.renderEpoch++;
        var epoch = this.renderEpoch;
        this.updateTabs(packId);
        this.updateHeader(pack, packId === 'recent' ? this.recent.read().length : pack.count);
        this.showState('正在载入…');
        this.stopAnimations();

        var promise = packId === 'recent' ? this.loadRecentItems() : this.loadManifest(packId).then(function (manifest) {
            return manifest ? manifest.items : [];
        });

        return promise.then(function (items) {
            if (self.destroyed || !self.isOpen || epoch !== self.renderEpoch) {
                return null;
            }
            self.renderItems(items || []);
            self.updateHeader(pack, (items || []).length);
            return items;
        }).catch(function (error) {
            if (error && error.name === 'AbortError') {
                return null;
            }
            if (epoch === self.renderEpoch) {
                self.showError('这个表情包暂时无法载入', function () {
                    delete self.manifests[packId];
                    delete self.manifestPromises[packId];
                    self.selectPack(packId);
                });
            }
            return null;
        });
    };

    Picker.prototype.loadRecentItems = function () {
        var self = this;
        var recent = this.recent.read();
        var packIds = recent.map(function (entry) { return entry.pack; }).filter(function (packId, index, values) {
            return packId !== 'recent' && values.indexOf(packId) === index && self.getPack(packId);
        });

        return Promise.all(packIds.map(function (packId) {
            return self.loadManifest(packId).then(function (manifest) {
                return { pack: packId, items: manifest.items };
            }).catch(function () {
                return { pack: packId, items: [] };
            });
        })).then(function (loaded) {
            var lookup = {};
            loaded.forEach(function (group) {
                group.items.forEach(function (item) {
                    lookup[group.pack + '\n' + item.id] = item;
                });
            });
            return recent.map(function (entry) {
                var item = lookup[entry.pack + '\n' + entry.id];
                if (!item) {
                    return null;
                }
                var copy = {};
                Object.keys(item).forEach(function (key) { copy[key] = item[key]; });
                copy.pack = entry.pack;
                return copy;
            }).filter(Boolean);
        });
    };

    Picker.prototype.showState = function (message) {
        this.grid.textContent = '';
        this.grid.setAttribute('aria-busy', 'true');
        var state = document.createElement('p');
        state.className = 'void-emotes-state';
        state.textContent = message;
        this.grid.appendChild(state);
    };

    Picker.prototype.showError = function (message, retry) {
        this.grid.textContent = '';
        this.grid.setAttribute('aria-busy', 'false');
        var state = document.createElement('div');
        state.className = 'void-emotes-state void-emotes-state--error';
        var text = document.createElement('span');
        text.textContent = message;
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = '重试';
        button.addEventListener('click', retry);
        state.appendChild(text);
        state.appendChild(button);
        this.grid.appendChild(state);
    };

    Picker.prototype.renderItems = function (items) {
        this.currentItems = items;
        this.renderedCount = 0;
        this.tileButtons = [];
        this.grid.textContent = '';
        this.grid.scrollTop = 0;
        this.grid.setAttribute('aria-busy', 'false');
        this.animationController = new AnimatedImages(this.grid);
        this.animateIcons();

        if (!items.length) {
            var empty = document.createElement('p');
            empty.className = 'void-emotes-state';
            empty.textContent = this.currentPack === 'recent' ? '还没有使用记录' : '这个表情包是空的';
            this.grid.appendChild(empty);
            return;
        }

        this.renderMore();
    };

    Picker.prototype.renderMore = function () {
        var self = this;
        if (!this.currentItems.length || this.renderedCount >= this.currentItems.length) {
            return;
        }

        var end = Math.min(this.renderedCount + BATCH_SIZE, this.currentItems.length);
        var fragment = document.createDocumentFragment();

        this.currentItems.slice(this.renderedCount, end).forEach(function (item) {
            var sourcePack = item.pack || self.currentPack;
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'void-emotes-tile' + (item.poster || item.src ? ' void-emotes-tile--image' : ' void-emotes-tile--text');
            button.setAttribute('role', 'gridcell');
            button.setAttribute('aria-label', item.label);
            button.setAttribute('title', item.label);
            button.setAttribute('tabindex', self.tileButtons.length ? '-1' : '0');
            button.setAttribute('data-pack', sourcePack);
            button.setAttribute('data-id', item.id);
            button.__voidEmoteItem = item;
            button.__voidEmotePack = sourcePack;

            var poster = assetUrl(self.baseUrl, packAssetPath(sourcePack, item.poster || item.src));
            if (poster) {
                var image = document.createElement('img');
                image.alt = '';
                image.loading = 'lazy';
                image.decoding = 'async';
                image.src = poster;
                image.setAttribute('data-poster-src', poster);
                if (item.width) {
                    image.width = item.width;
                }
                if (item.height) {
                    image.height = item.height;
                }
                if (item.animated) {
                    image.setAttribute('data-animated-src', assetUrl(
                        self.baseUrl,
                        packAssetPath(sourcePack, item.animated)
                    ));
                    self.animationController.observe(image);
                }
                button.appendChild(image);
            } else {
                var text = document.createElement('span');
                text.textContent = item.value || item.token || item.label;
                button.appendChild(text);
            }

            fragment.appendChild(button);
            self.tileButtons.push(button);
        });

        this.grid.appendChild(fragment);
        this.renderedCount = end;
    };

    Picker.prototype.insertItem = function (item, packId, keyboard, button) {
        var rawValue = item.token || item.value;
        if (!rawValue) {
            return;
        }

        var result = insertIntoText(this.target.value, this.selection.start, this.selection.end, rawValue);
        var scrollTop = this.target.scrollTop;
        this.target.value = result.value;
        this.selection.start = result.start;
        this.selection.end = result.end;

        if (!isMobileInput() && !keyboard) {
            try {
                this.target.focus({ preventScroll: true });
            } catch (error) {
                this.target.focus();
            }
        }

        if (typeof this.target.setSelectionRange === 'function') {
            this.target.setSelectionRange(result.start, result.end);
        }
        this.target.scrollTop = scrollTop;
        dispatchInput(this.target);
        this.recent.add(packId, item.id);
        this.liveRegion.textContent = '已插入' + item.label;

        if (keyboard && button && !isMobileInput()) {
            button.focus();
        }
    };

    Picker.prototype.handleTabKeydown = function (event) {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key) === -1) {
            return;
        }

        var current = this.tabButtons.indexOf(document.activeElement);
        if (current === -1) {
            return;
        }
        event.preventDefault();

        var next;
        if (event.key === 'Home') {
            next = 0;
        } else if (event.key === 'End') {
            next = this.tabButtons.length - 1;
        } else if (event.key === 'ArrowLeft') {
            next = (current - 1 + this.tabButtons.length) % this.tabButtons.length;
        } else {
            next = (current + 1) % this.tabButtons.length;
        }

        this.tabButtons[next].focus();
        this.selectPack(this.tabButtons[next].getAttribute('data-pack'));
    };

    Picker.prototype.getGridColumns = function () {
        if (this.tileButtons.length < 2) {
            return 1;
        }

        var firstTop = this.tileButtons[0].offsetTop;
        var columns = 1;
        while (columns < this.tileButtons.length && this.tileButtons[columns].offsetTop === firstTop) {
            columns++;
        }
        return columns;
    };

    Picker.prototype.handleGridKeydown = function (event) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].indexOf(event.key) === -1) {
            return;
        }

        var current = this.tileButtons.indexOf(document.activeElement);
        if (current === -1) {
            return;
        }
        event.preventDefault();

        var columns = this.getGridColumns();
        var next = current;
        if (event.key === 'Home') {
            next = 0;
        } else if (event.key === 'End') {
            while (this.renderedCount < this.currentItems.length) {
                this.renderMore();
            }
            next = this.tileButtons.length - 1;
        } else if (event.key === 'ArrowLeft') {
            next = Math.max(0, current - 1);
        } else if (event.key === 'ArrowRight') {
            next = Math.min(this.tileButtons.length - 1, current + 1);
        } else if (event.key === 'ArrowUp') {
            next = Math.max(0, current - columns);
        } else if (event.key === 'ArrowDown') {
            next = Math.min(this.tileButtons.length - 1, current + columns);
            if (next === this.tileButtons.length - 1 && this.renderedCount < this.currentItems.length) {
                this.renderMore();
                next = Math.min(current + columns, this.tileButtons.length - 1);
            }
        }

        this.tileButtons[current].setAttribute('tabindex', '-1');
        this.tileButtons[next].setAttribute('tabindex', '0');
        this.tileButtons[next].focus();
    };

    Picker.prototype.stopAnimations = function () {
        if (this.animationController) {
            this.animationController.destroy();
            this.animationController = null;
        }
    };

    Picker.prototype.destroy = function () {
        if (this.destroyed) {
            return;
        }

        this.close();
        this.destroyed = true;
        this.renderEpoch++;
        if (this.abortController) {
            this.abortController.abort();
        }
        this.stopAnimations();
        this.listeners.forEach(function (listener) {
            listener[0].removeEventListener(listener[1], listener[2], listener[3]);
        });
        this.listeners = [];
        if (this.panel.parentNode) {
            this.panel.parentNode.removeChild(this.panel);
        }
        if (this.generatedTrigger && this.trigger.parentNode) {
            this.trigger.parentNode.removeChild(this.trigger);
        }
        this.container.classList.remove('void-emotes-host', 'void-emotes-host--' + this.mode, 'is-open');
        this.container.style.width = '';
        this.container.style.left = '';
        this.container.style.top = '';
        this.panel.style.height = '';
        if (this.container.__voidEmotesInstance === this) {
            this.container.__voidEmotesInstance = null;
        }
    };

    function mount(options) {
        options = options || {};
        var container = asElement(options.container);
        var target = asElement(options.target);
        if (!container || !target) {
            return null;
        }
        if (container.__voidEmotesInstance && !container.__voidEmotesInstance.destroyed) {
            return container.__voidEmotesInstance;
        }

        options.container = container;
        options.target = target;
        var instance = new Picker(options);
        container.__voidEmotesInstance = instance;
        return instance;
    }

    function observeContent(root) {
        var scope = asElement(root) || document;
        var controller = new AnimatedImages(null);
        var images = scope.querySelectorAll('.biaoqing--bangumi[data-animated-src]');
        Array.prototype.forEach.call(images, function (image) {
            controller.observe(image);
        });
        return {
            destroy: function () {
                controller.destroy();
            }
        };
    }

    window.VoidEmotes = {
        mount: mount,
        observeContent: observeContent,
        __test: {
            insertIntoText: insertIntoText,
            RecentStore: RecentStore,
            safeRecent: safeRecent,
            packAssetPath: packAssetPath,
            AnimatedImages: AnimatedImages
        }
    };
})(window, document);

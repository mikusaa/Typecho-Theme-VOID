/* eslint-disable no-undef */
(function (window, document) {
    'use strict';

    var defaults = {
        selector: 'a.pjax',
        container: '#pjax-container',
        fragment: '#pjax-container',
        timeout: 8000,
        scrollTop: true
    };

    var runtime = {
        bound: false,
        selector: defaults.selector,
        options: null,
        requestId: 0,
        controller: null,
        requestOptions: null,
        onceScriptCache: {},
        historyEntrySerial: 0,
        scrollPositions: {}
    };

    function extend(base, extra) {
        var out = {};
        var key;
        for (key in base) {
            if (Object.prototype.hasOwnProperty.call(base, key)) {
                out[key] = base[key];
            }
        }
        if (!extra) {
            return out;
        }
        for (key in extra) {
            if (Object.prototype.hasOwnProperty.call(extra, key) && typeof extra[key] !== 'undefined') {
                out[key] = extra[key];
            }
        }
        return out;
    }

    function normalizeUrl(url) {
        try {
            return new URL(url, window.location.href).toString();
        } catch (err) {
            return '';
        }
    }

    function stripHash(url) {
        var index = url.indexOf('#');
        return index > -1 ? url.slice(0, index) : url;
    }

    function normalizeScrollCoordinate(value) {
        return typeof value === 'number' && isFinite(value) ? Math.max(0, value) : 0;
    }

    function normalizeScrollPosition(position) {
        return {
            x: normalizeScrollCoordinate(position && position.x),
            y: normalizeScrollCoordinate(position && position.y)
        };
    }

    function getScrollPosition() {
        var scrollingElement = document.scrollingElement || document.documentElement || document.body;
        var x = typeof window.pageXOffset === 'number'
            ? window.pageXOffset : (scrollingElement ? scrollingElement.scrollLeft : 0);
        var y = typeof window.pageYOffset === 'number'
            ? window.pageYOffset : (scrollingElement ? scrollingElement.scrollTop : 0);

        return normalizeScrollPosition({ x: x, y: y });
    }

    function restoreScrollPosition(position) {
        position = normalizeScrollPosition(position);
        if (typeof window.scrollTo === 'function') {
            window.scrollTo(position.x, position.y);
            return;
        }

        var scrollingElement = document.scrollingElement || document.documentElement || document.body;
        if (scrollingElement) {
            scrollingElement.scrollLeft = position.x;
            scrollingElement.scrollTop = position.y;
        }
    }

    function createHistoryEntryId() {
        runtime.historyEntrySerial += 1;
        return String(new Date().getTime()) + ':' + runtime.historyEntrySerial;
    }

    function rememberHistoryPosition(state, position) {
        if (!state || !state.entryId) {
            return;
        }
        runtime.scrollPositions[state.entryId] = normalizeScrollPosition(position);
    }

    function resolveHistoryPosition(state) {
        if (!state || typeof state !== 'object') {
            return null;
        }
        if (state.entryId && runtime.scrollPositions[state.entryId]) {
            return normalizeScrollPosition(runtime.scrollPositions[state.entryId]);
        }
        if (typeof state.scrollX === 'number' || typeof state.scrollY === 'number') {
            return normalizeScrollPosition({ x: state.scrollX, y: state.scrollY });
        }
        return null;
    }

    function setManualScrollRestoration() {
        if (window.history && 'scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
    }

    function rememberCurrentScrollPosition() {
        if (!window.history) {
            return;
        }
        rememberHistoryPosition(window.history.state, getScrollPosition());
    }

    function persistCurrentScrollPosition() {
        var current = window.history && window.history.state;
        if (!current || !current.__voidPjax) {
            return;
        }

        var position = getScrollPosition();
        rememberHistoryPosition(current, position);
        if (current.scrollX === position.x && current.scrollY === position.y) {
            return;
        }

        var nextState = extend(current, {
            scrollX: position.x,
            scrollY: position.y
        });
        window.history.replaceState(nextState, '', window.location.href);
    }

    function isHistoryPageShow(event) {
        if (event && event.persisted) {
            return true;
        }
        if (window.performance && typeof window.performance.getEntriesByType === 'function') {
            var entries = window.performance.getEntriesByType('navigation');
            if (entries && entries[0]) {
                return entries[0].type === 'back_forward';
            }
        }
        return !!(window.performance
            && window.performance.navigation
            && window.performance.navigation.type === 2);
    }

    function onPageShow(event) {
        var current = window.history && window.history.state;
        var position = resolveHistoryPosition(current);

        setManualScrollRestoration();
        if (isHistoryPageShow(event) && current && current.__voidPjax && position) {
            restoreScrollPosition(position);
        }
    }

    function isLocalUrl(url) {
        try {
            return new URL(url, window.location.href).origin === window.location.origin;
        } catch (err) {
            return false;
        }
    }

    function getEventTarget(options) {
        var selector = options && options.container ? options.container : defaults.container;
        return document.querySelector(selector) || document;
    }

    function emit(name, args, options) {
        var target = getEventTarget(options);

        if (typeof window.CustomEvent === 'function') {
            target.dispatchEvent(new window.CustomEvent(name, {
                bubbles: true,
                cancelable: true,
                detail: {
                    args: args || [],
                    options: options || {}
                }
            }));
        }
    }

    function safeEmit(name, args, options) {
        try {
            emit(name, args, options);
        } catch (err) {
            if (window.console && typeof window.console.error === 'function') {
                window.console.error('VoidPjax event error:', name, err);
            }
        }
    }

    function shouldHandleLink(link, event) {
        if (!link || link.tagName.toUpperCase() !== 'A') {
            return false;
        }

        if (event.defaultPrevented) {
            return false;
        }

        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return false;
        }

        if (link.hasAttribute('download') || link.hasAttribute('no-pjax')) {
            return false;
        }

        var target = link.getAttribute('target');
        if (target && target !== '' && target !== '_self') {
            return false;
        }

        var href = link.getAttribute('href');
        if (!href) {
            return false;
        }

        var lowHref = href.toLowerCase();
        if (lowHref.indexOf('javascript:') === 0 || lowHref.indexOf('mailto:') === 0 || lowHref.indexOf('tel:') === 0) {
            return false;
        }

        var url = normalizeUrl(link.href || href);
        if (!url || !isLocalUrl(url)) {
            return false;
        }

        if (link.hash && stripHash(url) === stripHash(window.location.href)) {
            return false;
        }

        return true;
    }

    function isExecutableScript(script) {
        var type = script.getAttribute('type');
        if (!type) {
            return true;
        }
        type = type.toLowerCase();
        return type === 'text/javascript' ||
            type === 'application/javascript' ||
            type === 'text/ecmascript' ||
            type === 'application/ecmascript' ||
            type === 'module';
    }

    function trimText(text) {
        return String(text || '').replace(/^\s+|\s+$/g, '');
    }

    function isOnceScript(script) {
        if (!script) {
            return false;
        }

        var onceFlag = script.getAttribute('data-pjax-once');
        if (onceFlag === '' || onceFlag === '1' || onceFlag === 'true') {
            return true;
        }

        return script.getAttribute('data-void-pjax') === 'once';
    }

    function getOnceScriptKey(script) {
        if (script.src) {
            var src = normalizeUrl(script.src || script.getAttribute('src'));
            return src ? 'src:' + src : '';
        }

        var explicitKey = trimText(script.getAttribute('data-pjax-once-id'));
        if (explicitKey !== '') {
            return 'id:' + explicitKey;
        }

        var scriptCode = trimText(script.textContent || '');
        if (scriptCode === '') {
            return '';
        }

        return 'inline:' + scriptCode;
    }

    function shouldSkipScript(script) {
        if (!isOnceScript(script)) {
            return false;
        }

        var key = getOnceScriptKey(script);
        if (key === '') {
            return false;
        }

        if (runtime.onceScriptCache[key]) {
            return true;
        }

        runtime.onceScriptCache[key] = true;
        return false;
    }

    function rememberOnceScripts(root) {
        if (!root) {
            return;
        }
        var scripts = root.querySelectorAll('script');
        var i;
        for (i = 0; i < scripts.length; i++) {
            var script = scripts[i];
            if (!isExecutableScript(script)) {
                continue;
            }
            shouldSkipScript(script);
        }
    }

    function rerunScripts(root) {
        var scripts = root.querySelectorAll('script');
        var i;
        for (i = 0; i < scripts.length; i++) {
            var oldScript = scripts[i];
            if (!isExecutableScript(oldScript)) {
                continue;
            }

            if (shouldSkipScript(oldScript)) {
                continue;
            }

            var newScript = document.createElement('script');
            var j;
            for (j = 0; j < oldScript.attributes.length; j++) {
                var attr = oldScript.attributes[j];
                newScript.setAttribute(attr.name, attr.value);
            }

            if (oldScript.textContent) {
                newScript.textContent = oldScript.textContent;
            }

            oldScript.parentNode.replaceChild(newScript, oldScript);
        }
    }

    function updateTitle(parsedDoc, containerNode) {
        var nextTitle = '';
        if (parsedDoc && parsedDoc.title) {
            nextTitle = parsedDoc.title;
        }
        if (!nextTitle && containerNode) {
            var containerTitle = containerNode.querySelector('title');
            if (containerTitle) {
                nextTitle = containerTitle.textContent;
            }
        }
        if (nextTitle && nextTitle.replace(/\s+/g, '') !== '') {
            document.title = nextTitle.replace(/^\s+|\s+$/g, '');
        }
    }

    function ensureHistoryState() {
        var current = window.history.state;
        var options = resolveStateOptions(current);
        var position = resolveHistoryPosition(current) || getScrollPosition();
        var entryId = current && current.__voidPjax ? current.entryId : '';
        var nextState = buildHistoryState(window.location.href, options, position, entryId);

        window.history.replaceState(nextState, '', window.location.href);
        rememberHistoryPosition(nextState, position);
    }

    function buildHistoryState(url, options, position, entryId) {
        var resolvedOptions = extend(runtime.options || defaults, options || {});
        var resolvedPosition = normalizeScrollPosition(position || getScrollPosition());

        return {
            __voidPjax: true,
            entryId: entryId || createHistoryEntryId(),
            url: normalizeUrl(url) || window.location.href,
            container: resolvedOptions.container || defaults.container,
            fragment: resolvedOptions.fragment || resolvedOptions.container || defaults.fragment,
            scrollTop: !!resolvedOptions.scrollTop,
            scrollX: resolvedPosition.x,
            scrollY: resolvedPosition.y
        };
    }

    function resolveStateOptions(state) {
        var options = extend(runtime.options || defaults, null);

        if (!state || typeof state !== 'object') {
            return options;
        }

        if (state.container) {
            options.container = state.container;
        }

        if (state.fragment) {
            options.fragment = state.fragment;
        }

        if (typeof state.scrollTop !== 'undefined') {
            options.scrollTop = !!state.scrollTop;
        }

        return options;
    }

    function fallbackNavigate(url) {
        if (window.history && 'scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'auto';
        }
        window.location.href = url;
    }

    function swapContainer(html, options, finalUrl, historyMode) {
        var parsedDoc = new DOMParser().parseFromString(html, 'text/html');
        var fragmentSelector = options.fragment || options.container;
        var nextContainer = parsedDoc.querySelector(fragmentSelector);
        var currentContainer = document.querySelector(options.container);

        if (!nextContainer || !currentContainer || !currentContainer.parentNode) {
            fallbackNavigate(finalUrl);
            return false;
        }

        var sourcePosition = getScrollPosition();
        var targetPosition = options.fromPopstate
            ? normalizeScrollPosition(options.historyScrollPosition)
            : (options.scrollTop ? { x: 0, y: 0 } : sourcePosition);
        var currentState = window.history.state;
        var currentEntryId = currentState && currentState.__voidPjax ? currentState.entryId : '';

        if (historyMode === 'push') {
            currentState = buildHistoryState(window.location.href, options, sourcePosition, currentEntryId);
            window.history.replaceState(currentState, '', window.location.href);
            rememberHistoryPosition(currentState, sourcePosition);
        }

        var adoptedContainer = document.importNode(nextContainer, true);
        safeEmit('pjax:beforeReplace', [adoptedContainer, options], options);
        currentContainer.parentNode.replaceChild(adoptedContainer, currentContainer);

        updateTitle(parsedDoc, adoptedContainer);
        rerunScripts(adoptedContainer);

        if (historyMode === 'push') {
            var pushedState = buildHistoryState(finalUrl, options, targetPosition);
            window.history.pushState(pushedState, '', finalUrl);
            rememberHistoryPosition(pushedState, targetPosition);
        } else if (historyMode === 'replace') {
            var replacedState = buildHistoryState(finalUrl, options, targetPosition, currentEntryId);
            window.history.replaceState(replacedState, '', finalUrl);
            rememberHistoryPosition(replacedState, targetPosition);
        }

        if (options.fromPopstate || options.scrollTop) {
            restoreScrollPosition(targetPosition);
        }

        return true;
    }

    function resolveHistoryMode(options) {
        if (options.push === false) {
            return options.replace ? 'replace' : 'none';
        }
        return options.replace ? 'replace' : 'push';
    }

    function visit(input) {
        var options = typeof input === 'string' ? { url: input } : (input || {});
        options = extend(runtime.options || defaults, options);

        var url = normalizeUrl(options.url);
        if (!url) {
            return Promise.reject(new Error('VoidPjax.visit() requires a valid url'));
        }
        var requestUrl = stripHash(url);
        var hash = '';
        var hashIndex = url.indexOf('#');
        if (hashIndex > -1) {
            hash = url.slice(hashIndex);
        }

        if (!window.fetch || !window.history || typeof window.history.pushState !== 'function' || !window.DOMParser) {
            fallbackNavigate(url);
            return Promise.resolve(false);
        }

        var previousOptions = runtime.requestOptions;
        runtime.requestId += 1;
        var requestId = runtime.requestId;

        if (runtime.controller && typeof runtime.controller.abort === 'function') {
            runtime.controller.abort();
        }

        var controller = typeof window.AbortController === 'function' ? new AbortController() : null;
        runtime.controller = controller;
        runtime.requestOptions = options;

        if (previousOptions) {
            safeEmit('pjax:abort', [null, 'abort', previousOptions], previousOptions);
        }

        var timeoutId = null;
        var timedOut = false;
        if (controller && options.timeout > 0) {
            timeoutId = window.setTimeout(function () {
                timedOut = true;
                controller.abort();
            }, options.timeout);
        }

        safeEmit('pjax:start', [null, options], options);
        safeEmit('pjax:send', [null, options], options);

        var fetchOptions = {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'X-PJAX': 'true',
                'X-PJAX-Container': options.container
            }
        };
        if (controller) {
            fetchOptions.signal = controller.signal;
        }

        function cleanup() {
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
            if (runtime.controller === controller) {
                runtime.controller = null;
            }
            if (runtime.requestOptions === options) {
                runtime.requestOptions = null;
            }
        }

        return window.fetch(requestUrl, fetchOptions).then(function (response) {
            if (!response.ok) {
                throw new Error('HTTP ' + response.status);
            }
            return response.text().then(function (html) {
                var finalUrl = normalizeUrl(response.url || requestUrl) || requestUrl;
                if (hash && finalUrl.indexOf('#') === -1) {
                    finalUrl += hash;
                }
                return {
                    html: html,
                    finalUrl: finalUrl
                };
            });
        }).then(function (payload) {
            cleanup();
            if (requestId !== runtime.requestId) {
                return false;
            }

            var historyMode = resolveHistoryMode(options);
            var replaced = swapContainer(payload.html, options, payload.finalUrl, historyMode);
            if (!replaced) {
                return false;
            }

            safeEmit('pjax:success', [payload.html, 'success', null, options], options);
            safeEmit('pjax:complete', [null, 'success', options], options);
            safeEmit('pjax:end', [null, options], options);
            return true;
        }, function (error) {
            cleanup();
            if (requestId !== runtime.requestId) {
                return false;
            }

            if (error && error.name === 'AbortError' && !timedOut) {
                return false;
            }

            safeEmit('pjax:error', [null, 'error', error, options], options);
            safeEmit('pjax:complete', [null, 'error', options], options);
            safeEmit('pjax:end', [null, options], options);
            fallbackNavigate(url);
            return false;
        });
    }

    function findLinkFromEvent(event) {
        if (!event.target || typeof event.target.closest !== 'function') {
            return null;
        }
        try {
            return event.target.closest(runtime.selector);
        } catch (err) {
            return null;
        }
    }

    function onDocumentClick(event) {
        var link = findLinkFromEvent(event);
        if (!shouldHandleLink(link, event)) {
            return;
        }
        event.preventDefault();
        visit({
            url: link.href,
            container: runtime.options.container,
            fragment: runtime.options.fragment,
            timeout: runtime.options.timeout,
            target: link,
            scrollTop: true,
            push: true
        });
    }

    function onPopState(event) {
        if (!event.state || !event.state.__voidPjax) {
            return;
        }

        var stateOptions = resolveStateOptions(event.state);
        var historyScrollPosition = resolveHistoryPosition(event.state) || { x: 0, y: 0 };

        visit({
            url: event.state.url || window.location.href,
            container: stateOptions.container,
            fragment: stateOptions.fragment,
            timeout: stateOptions.timeout,
            push: false,
            replace: false,
            fromPopstate: true,
            historyScrollPosition: historyScrollPosition,
            scrollTop: false
        });
    }

    function bind(selector, options) {
        if (typeof selector === 'object') {
            options = selector;
            selector = options.selector;
        }

        runtime.selector = selector || runtime.selector || defaults.selector;
        runtime.options = extend(defaults, options || {});
        runtime.options.selector = runtime.selector;

        if (!runtime.bound) {
            document.addEventListener('click', onDocumentClick, false);
            window.addEventListener('popstate', onPopState, false);
            window.addEventListener('scroll', rememberCurrentScrollPosition, false);
            window.addEventListener('pagehide', persistCurrentScrollPosition, false);
            window.addEventListener('pageshow', onPageShow, false);
            runtime.bound = true;
        }

        rememberOnceScripts(document.querySelector(runtime.options.container));
        ensureHistoryState();
        setManualScrollRestoration();
        return true;
    }

    runtime.options = extend(defaults, null);

    window.VoidPjax = {
        bind: bind,
        visit: visit,
        getOptions: function () {
            return extend(runtime.options || defaults, null);
        }
    };
})(window, document);

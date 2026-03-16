/* eslint-disable linebreak-style */
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
        onceScriptCache: {}
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
            target.dispatchEvent(new CustomEvent(name, {
                bubbles: true,
                cancelable: true,
                detail: {
                    args: args || [],
                    options: options || {}
                }
            }));
        }

        if (window.jQuery) {
            window.jQuery(target).trigger(name, args || []);
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
        if (!current || !current.__voidPjax) {
            window.history.replaceState(buildHistoryState(window.location.href, runtime.options), '', window.location.href);
        }
    }

    function buildHistoryState(url, options) {
        var resolvedOptions = extend(runtime.options || defaults, options || {});

        return {
            __voidPjax: true,
            url: normalizeUrl(url) || window.location.href,
            container: resolvedOptions.container || defaults.container,
            fragment: resolvedOptions.fragment || resolvedOptions.container || defaults.fragment,
            scrollTop: !!resolvedOptions.scrollTop
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

        var adoptedContainer = document.importNode(nextContainer, true);
        currentContainer.parentNode.replaceChild(adoptedContainer, currentContainer);

        updateTitle(parsedDoc, adoptedContainer);
        rerunScripts(adoptedContainer);

        if (historyMode === 'push') {
            window.history.replaceState(buildHistoryState(window.location.href, options), '', window.location.href);
            window.history.pushState(buildHistoryState(finalUrl, options), '', finalUrl);
        } else if (historyMode === 'replace') {
            window.history.replaceState(buildHistoryState(finalUrl, options), '', finalUrl);
        }

        if (options.scrollTop && !options.fromPopstate) {
            window.scrollTo(0, 0);
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

        runtime.requestId += 1;
        var requestId = runtime.requestId;

        if (runtime.controller && typeof runtime.controller.abort === 'function') {
            runtime.controller.abort();
        }

        var controller = typeof window.AbortController === 'function' ? new AbortController() : null;
        runtime.controller = controller;

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

        visit({
            url: event.state.url || window.location.href,
            container: stateOptions.container,
            fragment: stateOptions.fragment,
            timeout: stateOptions.timeout,
            push: false,
            replace: false,
            fromPopstate: true,
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
            runtime.bound = true;
        }

        rememberOnceScripts(document.querySelector(runtime.options.container));
        ensureHistoryState();
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

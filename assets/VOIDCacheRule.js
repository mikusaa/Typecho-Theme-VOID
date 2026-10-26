/* eslint-disable indent */
'use strict';

(function () {
  'use strict';

  var cacheVersion = '-native-v6';
  var staticAssetsCacheName = 'static-assets' + cacheVersion;
  var emoteStaticCacheName = 'emote-static' + cacheVersion;
  var emoteAnimatedCacheName = 'emote-animated' + cacheVersion;
  var fontAssetsCacheName = 'font-assets-native-v1';
  var staticMaxEntries = 200;
  var emoteStaticMaxEntries = 140;
  var emoteAnimatedMaxEntries = 48;
  var fontAssetsMaxEntries = 160;
  // The Worker lives in the Typecho root, so its directory is the site path even in a subdirectory install.
  var sitePath = new URL('./', self.location).pathname;
  var usrPath = sitePath + 'usr/';
  var themeAssetsPath = usrPath + 'themes/VOID/assets/';
  var hashedThemeAssetPattern = /^[A-Za-z0-9_-]+-[0-9a-f]{10}\.(?:css|js)$/;
  var versionedThemeLibraryPattern = /^libs\/[^/]+\/\d+(?:\.\d+)+\//;
  var retiredCacheNames = [
    'dynamic-vendor-toolbox-v1',
    'static-vendor-toolbox-v1',
    'static-assets-toolbox-v1',
    'content-toolbox-v1',
    'static-vendor-toolbox-v2',
    'static-assets-toolbox-v2',
    'emote-static-toolbox-v2',
    'emote-animated-toolbox-v2',
    'static-vendor-toolbox-v3',
    'static-assets-toolbox-v3',
    'emote-static-toolbox-v3',
    'emote-animated-toolbox-v3',
    'static-vendor-toolbox-v4',
    'static-assets-toolbox-v4',
    'emote-static-toolbox-v4',
    'emote-animated-toolbox-v4',
    'static-vendor-toolbox-v5',
    'static-assets-toolbox-v5',
    'emote-static-toolbox-v5',
    'emote-animated-toolbox-v5',
    'static-vendor-native-v6',
    // Third-party avatars and fonts are no longer routed through the Worker.
    'static-vendor-native-v7'
  ];

  function isSuccessfulResponse(response) {
    // An error page must never replace or stand in for a stored success.
    return response.status >= 200 && response.status < 300;
  }

  // Cache.keys() lists entries in insertion order and Cache.put() re-appends a replaced URL,
  // so trimming the front evicts the entry written longest ago. Concurrent trims only delete
  // prefixes of that order, so they converge on the limit without coordination. A URL re-written
  // while a trim runs may still be removed; its next request simply fetches it again.
  function trimCache(cache, maximumEntries) {
    return cache.keys().then(function (requests) {
      var overflow = requests.length - maximumEntries;

      if (overflow <= 0) {
        return self.Promise.resolve();
      }
      return self.Promise.all(requests.slice(0, overflow).map(function (request) {
        return cache.delete(request);
      }));
    });
  }

  function cacheOperation(cacheName, maximumEntries, request, response) {
    // Clone before respondWith can hand the body to the page.
    var responseForCache = response.clone();

    return caches.open(cacheName).then(function (cache) {
      return cache.put(request, responseForCache).then(function () {
        return trimCache(cache, maximumEntries);
      });
    }).catch(function () {
      // Cache quota or storage failures must not fail the resource request.
    });
  }

  function strategyResult(response, operation) {
    return {
      response: response,
      cacheOperation: operation || self.Promise.resolve()
    };
  }

  function cacheFirst(request, cacheName, maximumEntries) {
    return caches.open(cacheName).then(function (cache) {
      return cache.match(request);
    }).then(function (cachedResponse) {
      if (cachedResponse) {
        return strategyResult(cachedResponse);
      }

      return fetch(request.clone()).then(function (networkResponse) {
        if (!isSuccessfulResponse(networkResponse)) {
          return strategyResult(networkResponse);
        }
        return strategyResult(
          networkResponse,
          cacheOperation(cacheName, maximumEntries, request, networkResponse)
        );
      });
    });
  }

  function networkFirst(request, cacheName, maximumEntries) {
    return fetch(request.clone()).then(function (networkResponse) {
      if (isSuccessfulResponse(networkResponse)) {
        return strategyResult(
          networkResponse,
          cacheOperation(cacheName, maximumEntries, request, networkResponse)
        );
      }

      return caches.open(cacheName).then(function (cache) {
        return cache.match(request);
      }).then(function (cachedResponse) {
        return strategyResult(cachedResponse || networkResponse);
      });
    }, function (networkError) {
      return caches.open(cacheName).then(function (cache) {
        return cache.match(request);
      }).then(function (cachedResponse) {
        if (cachedResponse) {
          return strategyResult(cachedResponse);
        }
        throw networkError;
      });
    });
  }

  function hasPathPrefix(pathname, prefix) {
    return pathname.indexOf(prefix) === 0;
  }

  function isImmutableThemeAsset(pathname) {
    var relativePath;

    if (!hasPathPrefix(pathname, themeAssetsPath)) {
      return false;
    }
    relativePath = pathname.slice(themeAssetsPath.length);
    return hashedThemeAssetPattern.test(relativePath) ||
      versionedThemeLibraryPattern.test(relativePath);
  }

  function routeRequest(request) {
    var url;
    var pathname;

    if (request.method !== 'GET') {
      return null;
    }

    url = new URL(request.url);
    // Third-party requests go straight to the network.
    if (url.origin !== self.location.origin) {
      return null;
    }
    pathname = url.pathname;

    if (hasPathPrefix(pathname, themeAssetsPath + 'libs/emotes/bangumi/animated/')) {
      return cacheFirst(request, emoteAnimatedCacheName, emoteAnimatedMaxEntries);
    }
    if (pathname === themeAssetsPath + 'libs/emotes/packs.json' ||
        hasPathPrefix(pathname, themeAssetsPath + 'libs/emotes/packs/')) {
      return networkFirst(request, emoteStaticCacheName, emoteStaticMaxEntries);
    }
    if (hasPathPrefix(pathname, themeAssetsPath + 'libs/emotes/bangumi/poster/')) {
      return cacheFirst(request, emoteStaticCacheName, emoteStaticMaxEntries);
    }
    if (hasPathPrefix(pathname, themeAssetsPath + 'fonts/fontsource/')) {
      return cacheFirst(request, fontAssetsCacheName, fontAssetsMaxEntries);
    }
    if (isImmutableThemeAsset(pathname)) {
      return cacheFirst(request, staticAssetsCacheName, staticMaxEntries);
    }
    // Uploads, plugins and unhashed theme files can be replaced in place.
    if (hasPathPrefix(pathname, usrPath)) {
      return networkFirst(request, staticAssetsCacheName, staticMaxEntries);
    }
    return null;
  }

  function deleteRetiredMetadataDatabases() {
    if (!self.indexedDB) {
      return self.Promise.resolve();
    }

    return self.Promise.all(retiredCacheNames.map(function (cacheName) {
      return new self.Promise(function (resolve) {
        var request = self.indexedDB.deleteDatabase('sw-toolbox-' + cacheName);

        request.onsuccess = resolve;
        request.onerror = resolve;
        request.onblocked = resolve;
      });
    }));
  }

  function getRetiredCacheNames() {
    var scope = self.registration && self.registration.scope ?
      self.registration.scope : new URL('./', self.location).href;
    var defaultCacheName = '$$$toolbox-cache$$$' + scope + '$$$';

    return retiredCacheNames.concat([
      defaultCacheName,
      defaultCacheName + '$$$inactive$$$'
    ]);
  }

  self.addEventListener('fetch', function (event) {
    var operation = routeRequest(event.request);

    if (operation) {
      event.respondWith(operation.then(function (result) {
        return result.response;
      }));
      event.waitUntil(operation.then(function (result) {
        return result.cacheOperation;
      }, function () {
        return self.Promise.resolve();
      }));
    }
  });

  self.addEventListener('install', function (event) {
    event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('activate', function (event) {
    var cachesToDelete = getRetiredCacheNames();

    event.waitUntil(self.Promise.all([
      self.clients.claim(),
      caches.keys().then(function (cacheNames) {
        return self.Promise.all(cacheNames.map(function (cacheName) {
          if (cachesToDelete.indexOf(cacheName) !== -1) {
            return caches.delete(cacheName);
          }
          return self.Promise.resolve(false);
        }));
      }),
      deleteRetiredMetadataDatabases()
    ]));
  });
})();
